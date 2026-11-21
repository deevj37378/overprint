import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, parseIsoDate, weekdayOf } from './date.ts';
import { dateToSeed, deriveSeed, mulberry32 } from './prng.ts';
import {
  DIFFICULTY,
  generateDailyPuzzle,
  isSolved,
  MAX_INKED_FRACTION,
  MIN_INKED_FRACTION,
  targetToEmojiGrid,
  verifySolve,
  type Puzzle,
} from './puzzle.ts';
import {
  applyPlacements,
  countInked,
  countMixed,
  sheetsEqual,
  type Placement,
  type Stamp,
} from './sheet.ts';

const LAUNCH = '2026-12-01';
const YEAR_START = '2026-12-01';
const YEAR_END = '2027-11-30';

const datesFrom = (start: string, end: string): string[] => {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
};

test('dates: parsing, weekdays and day arithmetic are UTC', () => {
  assert.equal(weekdayOf('2026-12-01'), 'tue');
  assert.equal(weekdayOf('2026-12-06'), 'sun');
  assert.equal(weekdayOf('2027-02-28'), 'sun');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(daysBetween('2026-12-01', '2027-12-01'), 365);
  assert.throws(() => parseIsoDate('2026-02-30'));
  assert.throws(() => parseIsoDate('2026-2-3'));
  assert.throws(() => parseIsoDate('yesterday'));
});

test('prng: mulberry32 is deterministic and in [0, 1)', () => {
  const a = mulberry32(dateToSeed('2026-12-01'));
  const b = mulberry32(dateToSeed('2026-12-01'));
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(dateToSeed('2026-12-01'), dateToSeed('2026-12-02'));
  assert.notEqual(deriveSeed(1, 0), deriveSeed(1, 1));
  assert.throws(() => dateToSeed('2026-13-01'));
});

test('puzzle numbers count from launch day', () => {
  assert.equal(generateDailyPuzzle(LAUNCH, LAUNCH).number, 1);
  assert.equal(generateDailyPuzzle('2026-12-08', LAUNCH).number, 8);
  assert.throws(() => generateDailyPuzzle('2026-11-30', LAUNCH), RangeError);
});

test('the same date always gives the same puzzle', () => {
  for (const date of ['2026-12-01', '2027-03-14', '2027-06-20']) {
    assert.deepEqual(
      generateDailyPuzzle(date, LAUNCH),
      generateDailyPuzzle(date, LAUNCH)
    );
  }
  // Launch date only changes the number, not the print.
  const a = generateDailyPuzzle('2027-01-05', '2026-12-01');
  const b = generateDailyPuzzle('2027-01-05', '2027-01-01');
  assert.deepEqual({ ...a, number: 0 }, { ...b, number: 0 });
});

test('a full year: every day meets its weekday rules', (t) => {
  const dates = datesFrom(YEAR_START, YEAR_END);
  assert.equal(dates.length, 365);

  const lastSeen = new Map<string, string>();
  const repeats: string[] = [];
  let slowest = { date: '', ms: 0 };
  let totalMs = 0;

  for (const date of dates) {
    const started = performance.now();
    const puzzle = generateDailyPuzzle(date, LAUNCH);
    const ms = performance.now() - started;
    totalMs += ms;
    if (ms > slowest.ms) slowest = { date, ms };

    const weekday = weekdayOf(date);
    const rules = DIFFICULTY[weekday];
    const label = `${date} (${weekday})`;
    const cells = puzzle.size * puzzle.size;

    assert.equal(puzzle.date, date, label);
    assert.equal(puzzle.number, daysBetween(LAUNCH, date) + 1, label);
    assert.equal(puzzle.size, rules.size, label);
    assert.equal(puzzle.target.length, rules.size, label);
    assert.ok(
      puzzle.target.every((line) => line.length === rules.size),
      label
    );

    // Tray: exactly the generator's stamps, plus one decoy on Sat/Sun.
    assert.equal(puzzle.solution.length, rules.stamps, label);
    assert.equal(
      puzzle.tray.length,
      rules.stamps + (rules.decoy ? 1 : 0),
      label
    );
    assert.equal(
      new Set(puzzle.tray.map((s) => s.id)).size,
      puzzle.tray.length,
      label
    );
    assert.equal(
      new Set(puzzle.solution.map((p) => p.stampId)).size,
      rules.stamps,
      label
    );
    const combos = new Set(puzzle.tray.map((s) => `${s.shape}/${s.ink}`));
    assert.equal(
      combos.size,
      puzzle.tray.length,
      `${label}: two identical stamps`
    );

    // Target rules.
    assert.ok(
      countMixed(puzzle.target) >= rules.minMixed,
      `${label}: too few mixed cells`
    );
    const inked = countInked(puzzle.target) / cells;
    assert.ok(
      inked >= MIN_INKED_FRACTION && inked <= MAX_INKED_FRACTION,
      `${label}: ${inked}`
    );

    // The stored solution verifies, on both the client and the server checks.
    assert.ok(
      isSolved(puzzle, puzzle.solution),
      `${label}: solution does not solve`
    );
    assert.deepEqual(verifySolve(puzzle, puzzle.solution), { ok: true }, label);

    // No stamp is invisible: removing any one of them changes the print.
    for (const placement of puzzle.solution) {
      const without = puzzle.solution.filter((p) => p !== placement);
      const result = applyPlacements(puzzle.size, puzzle.tray, without);
      assert.ok(result.ok, label);
      assert.ok(
        !sheetsEqual(result.sheet, puzzle.target),
        `${label}: stamp ${placement.stampId} has no visible effect`
      );
    }

    // No print repeats the same weekday within the previous 52 weeks.
    const grid = targetToEmojiGrid(puzzle);
    const previous = lastSeen.get(grid);
    if (previous) {
      repeats.push(`${previous}=${date}`);
      assert.ok(
        daysBetween(previous, date) > 7 * 52,
        `${label} repeats ${previous}`
      );
    }
    lastSeen.set(grid, date);
  }

  t.diagnostic(
    `365 puzzles in ${totalMs.toFixed(0)} ms; slowest ${slowest.date} ` +
      `(${weekdayOf(slowest.date)}) at ${slowest.ms.toFixed(2)} ms; ` +
      `repeated prints: ${repeats.length ? repeats.join(', ') : 'none'}`
  );
  // The first call is cold (it also computes 52 earlier first-choice prints for the
  // no-repeat check); the server caches each day's puzzle in Redis.
  assert.ok(slowest.ms < 400, `slowest day took ${slowest.ms} ms`);
  assert.ok(
    totalMs / dates.length < 20,
    `average ${totalMs / dates.length} ms`
  );
});

test('generation never fails for five years ahead', () => {
  for (const date of datesFrom('2026-12-01', '2031-11-30')) {
    assert.doesNotThrow(() => generateDailyPuzzle(date, LAUNCH), date);
  }
});

const saturday = (): Puzzle => generateDailyPuzzle('2026-12-05', LAUNCH);

test('verifySolve rejects tampered placements', () => {
  const puzzle = saturday();
  const first = puzzle.solution[0];
  assert.ok(first);

  const offGrid = puzzle.solution.map((p) =>
    p === first ? { ...p, row: puzzle.size } : p
  );
  assert.deepEqual(verifySolve(puzzle, offGrid), {
    ok: false,
    error: 'out-of-bounds',
  });

  const negative = puzzle.solution.map((p) =>
    p === first ? { ...p, col: -5 } : p
  );
  assert.deepEqual(verifySolve(puzzle, negative), {
    ok: false,
    error: 'out-of-bounds',
  });

  const usedTwice = [...puzzle.solution, first];
  assert.equal(verifySolve(puzzle, usedTwice).ok, false);
  const usedTwiceShort = [first, first];
  assert.deepEqual(verifySolve(puzzle, usedTwiceShort), {
    ok: false,
    error: 'duplicate-stamp',
  });

  const wrongId = puzzle.solution.map((p) =>
    p === first ? { ...p, stampId: 's99' } : p
  );
  assert.deepEqual(verifySolve(puzzle, wrongId), {
    ok: false,
    error: 'unknown-stamp',
  });

  assert.deepEqual(verifySolve(puzzle, puzzle.solution.slice(1)), {
    ok: false,
    error: 'mismatch',
  });
  assert.deepEqual(verifySolve(puzzle, []), { ok: false, error: 'mismatch' });
});

test('verifySolve rejects malformed input', () => {
  const puzzle = saturday();
  const first = puzzle.solution[0];
  assert.ok(first);
  const bad: unknown[] = [
    null,
    'placements',
    { stampId: first.stampId },
    [null],
    [{ ...first, rotation: 4 }],
    [{ ...first, rotation: '1' }],
    [{ ...first, row: 1.5 }],
    [{ ...first, row: '0' }],
    [{ ...first, stampId: 7 }],
    [{ row: 0, col: 0, rotation: 0 }],
  ];
  for (const input of bad) {
    assert.deepEqual(
      verifySolve(puzzle, input),
      { ok: false, error: 'malformed' },
      String(input)
    );
  }
});

test('any arrangement that matches wins, not only the stored one', () => {
  // A blue and a pink domino on the same two cells: rotation 0 and 2 cover the same cells.
  const tray: Stamp[] = [
    { id: 's1', shape: 'domino', ink: 'blue' },
    { id: 's2', shape: 'domino', ink: 'pink' },
  ];
  const stored: Placement[] = [
    { stampId: 's1', row: 0, col: 0, rotation: 0 },
    { stampId: 's2', row: 0, col: 0, rotation: 0 },
  ];
  const target = applyPlacements(5, tray, stored);
  assert.ok(target.ok);
  const puzzle: Puzzle = {
    date: LAUNCH,
    number: 1,
    size: 5,
    tray,
    target: target.sheet,
    solution: stored,
  };
  const alternative: Placement[] = [
    { stampId: 's2', row: 0, col: 0, rotation: 2 },
    { stampId: 's1', row: 0, col: 0, rotation: 2 },
  ];
  assert.ok(isSolved(puzzle, alternative));
  assert.deepEqual(verifySolve(puzzle, alternative), { ok: true });
});

test('targetToEmojiGrid is one emoji row per sheet row', () => {
  const puzzle = generateDailyPuzzle('2026-12-07', LAUNCH);
  const rows = targetToEmojiGrid(puzzle).split('\n');
  assert.equal(rows.length, puzzle.size);
  for (const row of rows) assert.equal([...row].length, puzzle.size);
  assert.match(targetToEmojiGrid(puzzle), /^[🟦🟥🟨🟩🟧🟪🟫⬜\n]+$/u);
});
