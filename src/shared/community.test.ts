import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShopStamp } from './api.ts';
import {
  buildCommunityPuzzle,
  checkPrint,
  communityScore,
  parseShopStamps,
  pickSunday,
  printTitle,
  TITLE_ADJECTIVES,
  TITLE_NOUNS,
} from './community.ts';
import { isoWeek } from './date.ts';
import { verifySolve } from './puzzle.ts';

// A valid 5×5 print: blue L, yellow plus overlapping it, pink bar.
const blueP: ShopStamp = {
  shape: 'p5',
  ink: 'blue',
  row: 0,
  col: 0,
  rotation: 0,
};
const yellowPlus: ShopStamp = {
  shape: 'plus',
  ink: 'yellow',
  row: 1,
  col: 1,
  rotation: 0,
};
const pinkBar: ShopStamp = {
  shape: 'i4',
  ink: 'pink',
  row: 4,
  col: 0,
  rotation: 0,
};
const good: ShopStamp[] = [blueP, yellowPlus, pinkBar];

test('a good print passes', () => {
  const check = checkPrint(5, good);
  assert.ok(check.ok, check.ok ? '' : check.reason);
  assert.ok(check.mixed >= 2);
});

test('live stats are measured even before a print is valid', () => {
  const one = checkPrint(5, [blueP]);
  assert.equal(one.ok, false);
  assert.equal(one.inkedFraction, 5 / 25);
  assert.equal(one.mixed, 0);
});

test('friendly reasons for each rule', () => {
  const reason = (size: number, stamps: ShopStamp[]) => {
    const c = checkPrint(size, stamps);
    return c.ok ? '' : c.reason;
  };
  assert.match(reason(4, good), /5×5, 6×6 or 7×7/);
  assert.match(reason(5, good.slice(0, 1)), /at least 2/);
  assert.match(reason(5, [...good, ...good, blueP]), /at most 6/);
  assert.match(
    reason(5, [{ ...blueP, col: 4 }, yellowPlus]),
    /fully on the paper/
  );
  assert.match(reason(5, [blueP, { ...blueP, row: 2 }]), /same shape and ink/);
  // A blue domino hidden under the blue P.
  assert.match(
    reason(5, [
      ...good,
      { shape: 'domino', ink: 'blue', row: 0, col: 0, rotation: 0 },
    ]),
    /hidden/
  );
  // Two stamps that don't overlap at all.
  assert.match(
    reason(5, [
      blueP,
      { shape: 'i4', ink: 'pink', row: 4, col: 0, rotation: 0 },
    ]),
    /mixed/
  );
  // 7×7 with two small stamps is under 30% inked.
  assert.match(
    reason(7, [
      { shape: 'domino', ink: 'blue', row: 0, col: 0, rotation: 0 },
      { shape: 'domino', ink: 'yellow', row: 0, col: 1, rotation: 0 },
    ]),
    /at least 30%/
  );
});

test('titles only from the word lists', () => {
  assert.equal(printTitle('Quiet', 'Harbour'), 'Quiet Harbour');
  assert.equal(printTitle('quiet', 'Harbour'), null);
  assert.equal(printTitle('Rude', 'Harbour'), null);
  assert.ok(TITLE_ADJECTIVES.length >= 30 && TITLE_NOUNS.length >= 30);
  assert.equal(new Set(TITLE_ADJECTIVES).size, TITLE_ADJECTIVES.length);
  assert.equal(new Set(TITLE_NOUNS).size, TITLE_NOUNS.length);
});

test('a community puzzle is solvable by construction', () => {
  const puzzle = buildCommunityPuzzle('pabc123', 5, good);
  assert.ok(puzzle);
  assert.equal(puzzle.tray.length, 3);
  const full = { date: '2026-12-01', number: 0, size: 5, ...puzzle };
  assert.deepEqual(verifySolve(full, puzzle.solution), { ok: true });
  assert.deepEqual(
    buildCommunityPuzzle('pabc123', 5, good),
    puzzle,
    'deterministic per print id'
  );
  assert.equal(buildCommunityPuzzle('x', 5, good.slice(0, 1)), null);
});

test('untrusted stamp input is checked', () => {
  assert.deepEqual(parseShopStamps(good), good);
  assert.equal(parseShopStamps('nope'), null);
  assert.equal(parseShopStamps([{ ...blueP, shape: 'hexagon' }]), null);
  assert.equal(parseShopStamps([{ ...blueP, rotation: 5 }]), null);
  assert.equal(parseShopStamps([{ ...blueP, row: 1.5 }]), null);
  assert.equal(parseShopStamps(new Array(7).fill(blueP)), null);
});

test('Community Sunday: upvotes, then solves, then earliest', () => {
  assert.equal(pickSunday([]), null);
  assert.equal(
    pickSunday([
      { printId: 'a', upvotes: 3, solves: 10, createdAt: 1 },
      { printId: 'b', upvotes: 5, solves: 0, createdAt: 2 },
    ]),
    'b'
  );
  assert.equal(
    pickSunday([
      { printId: 'a', upvotes: 5, solves: 2, createdAt: 1 },
      { printId: 'b', upvotes: 5, solves: 9, createdAt: 2 },
    ]),
    'b'
  );
  assert.equal(
    pickSunday([
      { printId: 'late', upvotes: 5, solves: 9, createdAt: 9 },
      { printId: 'early', upvotes: 5, solves: 9, createdAt: 1 },
    ]),
    'early'
  );
  assert.ok(communityScore(2, 0) > communityScore(1, 999));
});

test('ISO weeks', () => {
  assert.equal(isoWeek('2026-12-07'), '2026-W50');
  assert.equal(isoWeek('2026-12-13'), '2026-W50');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  assert.equal(isoWeek('2027-01-04'), '2027-W01');
  assert.equal(isoWeek('2024-12-30'), '2025-W01');
});
