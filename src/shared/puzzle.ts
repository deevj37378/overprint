// The daily puzzle: weekday difficulty, deterministic generation and solve verification.

import { daysBetween, weekdayOf, type Weekday } from './date.ts';
import { INKS, type Ink } from './ink.ts';
import {
  dateToSeed,
  deriveSeed,
  mulberry32,
  pick,
  randRange,
  shuffle,
  type Rng,
} from './prng.ts';
import {
  fitsOnSheet,
  ROTATIONS,
  SHAPE_IDS,
  shapeBounds,
  shapeCells,
  type Rotation,
  type ShapeId,
} from './shapes.ts';
import {
  applyPlacements,
  countInked,
  countMixed,
  sheetsEqual,
  sheetToEmoji,
  type PlacementError,
  type Placement,
  type Sheet,
  type Stamp,
} from './sheet.ts';

export type Puzzle = {
  readonly date: string;
  /** Days since launch day; launch day is #1. */
  readonly number: number;
  readonly size: number;
  /** The stamps the generator used (shuffled), plus a decoy on Sat/Sun. */
  readonly tray: readonly Stamp[];
  readonly target: Sheet;
  readonly solution: readonly Placement[];
};

export type DayRules = {
  readonly size: number;
  readonly stamps: number;
  readonly decoy: boolean;
  readonly minMixed: number;
};

/** OVERPRINT.md, "Difficulty by weekday" (UTC date of the post). */
export const DIFFICULTY: Record<Weekday, DayRules> = {
  mon: { size: 5, stamps: 2, decoy: false, minMixed: 1 },
  tue: { size: 5, stamps: 3, decoy: false, minMixed: 2 },
  wed: { size: 6, stamps: 3, decoy: false, minMixed: 3 },
  thu: { size: 6, stamps: 4, decoy: false, minMixed: 4 },
  fri: { size: 6, stamps: 4, decoy: false, minMixed: 5 },
  sat: { size: 7, stamps: 5, decoy: true, minMixed: 6 },
  sun: { size: 7, stamps: 5, decoy: true, minMixed: 7 },
};

export const MIN_INKED_FRACTION = 0.3;
export const MAX_INKED_FRACTION = 0.85;

/**
 * Hard cap on retries so generation can never loop forever. Sundays (7×7, 5 stamps, 7 mixed
 * cells, 30% inked) are the tightest: they need ~1–2k attempts on average and every day
 * through 2031 succeeds well under this cap (see tests). Each attempt costs a few µs.
 */
export const MAX_ATTEMPTS = 50_000;

export const rulesFor = (date: string): DayRules => DIFFICULTY[weekdayOf(date)];

type Draft = {
  readonly shape: ShapeId;
  readonly ink: Ink;
  readonly rotation: Rotation;
  readonly row: number;
  readonly col: number;
};

const sameStamp = (
  a: { shape: ShapeId; ink: Ink },
  b: { shape: ShapeId; ink: Ink }
) => a.shape === b.shape && a.ink === b.ink;

/**
 * How often a stamp after the first aims to overlap a different ink already on the paper.
 * Purely random placement rarely meets the weekend mixed-cell minimums, so we steer some
 * stamps onto existing ink. All the spec's rejection rules still apply afterwards.
 */
const OVERLAP_BIAS = 0.75;

/** A random shape, ink and rotation, at a position that keeps the whole stamp on the paper. */
const draftStamp = (
  rng: Rng,
  size: number,
  earlier: readonly Draft[]
): Draft => {
  const shape = pick(rng, SHAPE_IDS);
  const ink = pick(rng, INKS);
  const rotation = pick(rng, ROTATIONS);
  const cells = shapeCells(shape, rotation);

  if (earlier.length > 0 && rng() < OVERLAP_BIAS) {
    const otherInk = earlier
      .filter((d) => d.ink !== ink)
      .flatMap((d) =>
        shapeCells(d.shape, d.rotation).map((c) => ({
          row: d.row + c.row,
          col: d.col + c.col,
        }))
      );
    if (otherInk.length > 0) {
      const onto = pick(rng, otherInk);
      const via = pick(rng, cells);
      const row = onto.row - via.row;
      const col = onto.col - via.col;
      if (fitsOnSheet(size, cells, row, col))
        return { shape, ink, rotation, row, col };
    }
  }

  const bounds = shapeBounds(cells);
  const row = randRange(rng, -bounds.minRow, size - 1 - bounds.maxRow);
  const col = randRange(rng, -bounds.minCol, size - 1 - bounds.maxCol);
  return { shape, ink, rotation, row, col };
};

/** True if some cell gets this stamp's ink from this stamp alone. */
const everyStampVisible = (size: number, drafts: readonly Draft[]): boolean => {
  // coverage[(row * size + col) * 3 + inkIndex] = how many stamps put that ink there
  const coverage = new Array<number>(size * size * INKS.length).fill(0);
  const slot = (row: number, col: number, ink: Ink) =>
    (row * size + col) * INKS.length + INKS.indexOf(ink);
  const cellsOf = (d: Draft) =>
    shapeCells(d.shape, d.rotation).map((c) =>
      slot(d.row + c.row, d.col + c.col, d.ink)
    );

  for (const draft of drafts) {
    for (const i of cellsOf(draft)) coverage[i] = (coverage[i] ?? 0) + 1;
  }
  return drafts.every((draft) => cellsOf(draft).some((i) => coverage[i] === 1));
};

type Attempt = {
  readonly tray: Stamp[];
  readonly target: Sheet;
  readonly solution: Placement[];
};

const tryGenerate = (rng: Rng, rules: DayRules): Attempt | null => {
  const { size } = rules;
  const drafts: Draft[] = [];
  for (let i = 0; i < rules.stamps; i++)
    drafts.push(draftStamp(rng, size, drafts));

  // Two stamps identical in shape and ink are confusing.
  for (let i = 0; i < drafts.length; i++) {
    for (let j = i + 1; j < drafts.length; j++) {
      const a = drafts[i];
      const b = drafts[j];
      if (a && b && sameStamp(a, b)) return null;
    }
  }

  if (!everyStampVisible(size, drafts)) return null;

  // Lay the stamps down with temporary ids to get the target print.
  const draftStamps = drafts.map((d, i) => ({
    id: `d${i}`,
    shape: d.shape,
    ink: d.ink,
  }));
  const draftPlacements = drafts.map((d, i) => ({
    stampId: `d${i}`,
    row: d.row,
    col: d.col,
    rotation: d.rotation,
  }));
  const applied = applyPlacements(size, draftStamps, draftPlacements);
  if (!applied.ok) return null;
  const target = applied.sheet;

  if (countMixed(target) < rules.minMixed) return null;
  const inked = countInked(target) / (size * size);
  if (inked < MIN_INKED_FRACTION || inked > MAX_INKED_FRACTION) return null;

  // Decoy: any shape/ink combination not already in the tray.
  const pool = drafts.map((d, i) => ({
    shape: d.shape,
    ink: d.ink,
    solutionIndex: i,
  }));
  if (rules.decoy) {
    const unused = SHAPE_IDS.flatMap((shape) =>
      INKS.map((ink) => ({ shape, ink, solutionIndex: -1 }))
    ).filter((combo) => !pool.some((p) => sameStamp(p, combo)));
    pool.push(pick(rng, unused));
  }

  // Shuffle, then number the tray so ids don't reveal the decoy or the stamp order.
  const shuffled = shuffle(rng, pool);
  const tray: Stamp[] = shuffled.map((p, i) => ({
    id: `s${i + 1}`,
    shape: p.shape,
    ink: p.ink,
  }));
  const solution: Placement[] = [];
  shuffled.forEach((p, i) => {
    const draft = drafts[p.solutionIndex];
    if (!draft) return;
    solution.push({
      stampId: `s${i + 1}`,
      row: draft.row,
      col: draft.col,
      rotation: draft.rotation,
    });
  });

  return { tray, target, solution };
};

/**
 * The puzzle for a UTC date 'YYYY-MM-DD'. Deterministic: same date → same puzzle everywhere.
 * `launchDate` is the date of puzzle #1. Throws if `date` is before launch, or (in theory)
 * if no valid puzzle is found within MAX_ATTEMPTS.
 */
export const generateDailyPuzzle = (
  date: string,
  launchDate: string
): Puzzle => {
  const number = daysBetween(launchDate, date) + 1;
  if (number < 1) {
    throw new RangeError(`${date} is before launch day ${launchDate}`);
  }
  const rules = rulesFor(date);
  const seed = dateToSeed(date);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = tryGenerate(mulberry32(deriveSeed(seed, attempt)), rules);
    if (result) return { date, number, size: rules.size, ...result };
  }
  throw new Error(`No valid puzzle for ${date} after ${MAX_ATTEMPTS} attempts`);
};

/** Does this arrangement reproduce the target? Any matching arrangement wins. */
export const isSolved = (
  puzzle: Puzzle,
  placements: readonly Placement[]
): boolean => {
  const applied = applyPlacements(puzzle.size, puzzle.tray, placements);
  return applied.ok && sheetsEqual(applied.sheet, puzzle.target);
};

export type VerifyError = PlacementError | 'malformed' | 'mismatch';

export type VerifyResult = { ok: true } | { ok: false; error: VerifyError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRotation = (value: unknown): Rotation | null =>
  value === 0 || value === 1 || value === 2 || value === 3 ? value : null;

/** Parse untrusted JSON into placements, or null if it isn't shaped like them. */
export const parsePlacements = (input: unknown): Placement[] | null => {
  if (!Array.isArray(input)) return null;
  const placements: Placement[] = [];
  for (const item of input) {
    if (!isRecord(item)) return null;
    const { stampId, row, col } = item;
    const rotation = toRotation(item.rotation);
    if (
      typeof stampId !== 'string' ||
      typeof row !== 'number' ||
      typeof col !== 'number' ||
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      rotation === null
    ) {
      return null;
    }
    placements.push({ stampId, row, col, rotation });
  }
  return placements;
};

/**
 * Server-side check of a submitted solve. Takes the raw request body value, so nothing
 * from the client is trusted: shape, stamp ids, single use, bounds and the final print.
 * `puzzle` must be regenerated on the server, never taken from the client.
 */
export const verifySolve = (puzzle: Puzzle, input: unknown): VerifyResult => {
  const placements = parsePlacements(input);
  if (!placements || placements.length > puzzle.tray.length) {
    return { ok: false, error: 'malformed' };
  }
  const applied = applyPlacements(puzzle.size, puzzle.tray, placements);
  if (!applied.ok) return { ok: false, error: applied.error };
  if (!sheetsEqual(applied.sheet, puzzle.target))
    return { ok: false, error: 'mismatch' };
  return { ok: true };
};

/** The target as emoji rows (🟦🟥🟨🟩🟧🟪🟫⬜), for sharing. No placements are revealed. */
export const targetToEmojiGrid = (puzzle: Puzzle): string =>
  sheetToEmoji(puzzle.target);
