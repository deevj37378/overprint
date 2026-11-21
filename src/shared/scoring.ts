// Scoring. Lower is better: time plus a fixed penalty per lift.

/** Each lift (or undo) costs 10 seconds on the leaderboard. */
export const LIFT_PENALTY_MS = 10_000;

/** Solves can't plausibly be faster than this per stamp pressed (4 taps at ~150 ms each). */
export const MIN_MS_PER_STAMP = 600;

/** Anything longer than a day is clamped (the clock stops counting). */
export const MAX_TIME_MS = 24 * 60 * 60 * 1000;

export const solveScore = (timeMs: number, lifts: number): number =>
  Math.round(timeMs) + lifts * LIFT_PENALTY_MS;

export const isClean = (lifts: number): boolean => lifts === 0;

/**
 * Sanitise a client-reported time. The server also knows when this player first picked up a
 * stamp (`serverElapsedMs`, null if unknown), and never accepts a time longer than that
 * (+2 s slack) or shorter than a plausible minimum.
 */
export const sanitiseTime = (
  reportedMs: number,
  stampsPlaced: number,
  serverElapsedMs: number | null
): number => {
  const floor = Math.max(1, stampsPlaced) * MIN_MS_PER_STAMP;
  let ms = Number.isFinite(reportedMs) ? Math.round(reportedMs) : MAX_TIME_MS;
  if (serverElapsedMs !== null) ms = Math.min(ms, serverElapsedMs + 2000);
  return Math.min(Math.max(ms, floor), MAX_TIME_MS);
};

export const sanitiseLifts = (lifts: number): number =>
  Number.isInteger(lifts) && lifts >= 0 ? Math.min(lifts, 9999) : 0;

/**
 * "Faster than N% of printers today". `rank` is 0-based among `total` solvers (ascending score).
 * Null when you're the only solver so far.
 */
export const percentile = (rank: number, total: number): number | null => {
  if (total <= 1) return null;
  return Math.round(((total - 1 - rank) / (total - 1)) * 100);
};
