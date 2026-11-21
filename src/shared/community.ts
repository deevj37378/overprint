// Print Shop rules: validating a player-made print, titling it from word pickers (no free text),
// turning it into a playable puzzle, and choosing Community Sunday.

import type { ShopStamp } from './api.ts';
import { INKS } from './ink.ts';
import { mulberry32, shuffle } from './prng.ts';
import { MAX_INKED_FRACTION, MIN_INKED_FRACTION } from './puzzle.ts';
import { ROTATIONS, SHAPE_IDS } from './shapes.ts';
import {
  applyPlacements,
  countInked,
  countMixed,
  sheetsEqual,
  type Placement,
  type Sheet,
  type Stamp,
} from './sheet.ts';

export const SHOP_SIZES: readonly number[] = [5, 6, 7];
export const MIN_SHOP_STAMPS = 2;
export const MAX_SHOP_STAMPS = 6;
export const DAILY_POST_LIMIT = 3;

/** Curated, family-friendly title words. Titles are `[adjective] [noun]`. */
export const TITLE_ADJECTIVES = [
  'Quiet',
  'Loud',
  'Sunny',
  'Sleepy',
  'Brave',
  'Gentle',
  'Lucky',
  'Fizzy',
  'Velvet',
  'Paper',
  'Midnight',
  'Morning',
  'Rainy',
  'Golden',
  'Tiny',
  'Giant',
  'Secret',
  'Electric',
  'Cosy',
  'Wild',
  'Silver',
  'Salty',
  'Sweet',
  'Spicy',
  'Frosty',
  'Breezy',
  'Busy',
  'Dizzy',
  'Hidden',
  'Happy',
  'Curious',
  'Peppy',
  'Mellow',
  'Bouncy',
  'Neon',
  'Dusty',
  'Glassy',
  'Patchwork',
  'Wobbly',
  'Lazy',
];

export const TITLE_NOUNS = [
  'Harbour',
  'Lemon',
  'Garden',
  'Comet',
  'Teapot',
  'Lantern',
  'Meadow',
  'Rocket',
  'Pebble',
  'Kite',
  'Fox',
  'Owl',
  'Cactus',
  'Ferry',
  'Bakery',
  'Island',
  'Mountain',
  'Postcard',
  'Robot',
  'Tulip',
  'Window',
  'Lighthouse',
  'Pancake',
  'Orchard',
  'Bicycle',
  'Cloud',
  'Whale',
  'Market',
  'Library',
  'Moth',
  'Parade',
  'Radio',
  'Sunset',
  'Puddle',
  'Accordion',
  'Daisy',
  'Tram',
  'Waffle',
  'Beetle',
  'Quilt',
];

export const printTitle = (adjective: string, noun: string): string | null =>
  TITLE_ADJECTIVES.includes(adjective) && TITLE_NOUNS.includes(noun)
    ? `${adjective} ${noun}`
    : null;

export type PrintCheck =
  | { ok: true; target: Sheet; mixed: number; inkedFraction: number }
  | {
      ok: false;
      reason: string;
      target: Sheet | null;
      mixed: number;
      inkedFraction: number;
    };

/** Minimum mixed cells for a community print: 1 with two stamps, else 2. */
export const minMixedFor = (stampCount: number): number =>
  stampCount <= 2 ? 1 : 2;

const toTray = (
  stamps: readonly ShopStamp[]
): { tray: Stamp[]; placements: Placement[] } => ({
  tray: stamps.map((s, i) => ({ id: `e${i}`, shape: s.shape, ink: s.ink })),
  placements: stamps.map((s, i) => ({
    stampId: `e${i}`,
    row: s.row,
    col: s.col,
    rotation: s.rotation,
  })),
});

const isShopStamp = (value: unknown): value is ShopStamp => {
  if (typeof value !== 'object' || value === null) return false;
  const shape: unknown = Reflect.get(value, 'shape');
  const ink: unknown = Reflect.get(value, 'ink');
  const row: unknown = Reflect.get(value, 'row');
  const col: unknown = Reflect.get(value, 'col');
  const rotation: unknown = Reflect.get(value, 'rotation');
  return (
    SHAPE_IDS.some((id) => id === shape) &&
    INKS.some((i) => i === ink) &&
    typeof row === 'number' &&
    Number.isInteger(row) &&
    typeof col === 'number' &&
    Number.isInteger(col) &&
    ROTATIONS.some((r) => r === rotation)
  );
};

/** Parse untrusted stamps from a request body. */
export const parseShopStamps = (value: unknown): ShopStamp[] | null => {
  if (!Array.isArray(value) || value.length > MAX_SHOP_STAMPS) return null;
  const stamps = value.filter(isShopStamp);
  return stamps.length === value.length ? stamps : null;
};

/** Same quality rules as the daily generator, with friendly reasons. */
export const checkPrint = (
  size: number,
  stamps: readonly ShopStamp[]
): PrintCheck => {
  const none = { target: null, mixed: 0, inkedFraction: 0 };
  if (!SHOP_SIZES.some((s) => s === size))
    return { ok: false, reason: 'Pick a 5×5, 6×6 or 7×7 sheet.', ...none };
  const { tray, placements } = toTray(stamps);
  const applied = applyPlacements(size, tray, placements);
  if (!applied.ok)
    return {
      ok: false,
      reason: 'Every stamp must sit fully on the paper.',
      ...none,
    };
  // Measure the paper first, so the live stats are right even while the print isn't valid yet.
  const target = applied.sheet;
  const mixed = countMixed(target);
  const inkedFraction = countInked(target) / (size * size);
  const fail = (reason: string): PrintCheck => ({
    ok: false,
    reason,
    target,
    mixed,
    inkedFraction,
  });
  if (stamps.length < MIN_SHOP_STAMPS)
    return fail(`Press at least ${MIN_SHOP_STAMPS} stamps.`);
  if (stamps.length > MAX_SHOP_STAMPS)
    return fail(`Use at most ${MAX_SHOP_STAMPS} stamps.`);

  for (let i = 0; i < stamps.length; i++) {
    for (let j = i + 1; j < stamps.length; j++) {
      const a = stamps[i];
      const b = stamps[j];
      if (a && b && a.shape === b.shape && a.ink === b.ink) {
        return fail(
          'Two stamps are the same shape and ink. Swap one for a different ink.'
        );
      }
    }
  }
  for (let i = 0; i < placements.length; i++) {
    const without = placements.filter((_, k) => k !== i);
    const result = applyPlacements(size, tray, without);
    if (result.ok && sheetsEqual(result.sheet, target)) {
      return fail(
        'One stamp is completely hidden under the same ink. Move it so it shows.'
      );
    }
  }
  const minMixed = minMixedFor(stamps.length);
  if (mixed < minMixed) {
    return fail(
      `Overlap different inks: at least ${minMixed} mixed ${minMixed === 1 ? 'square' : 'squares'} (now ${mixed}).`
    );
  }
  const pct = Math.round(inkedFraction * 100);
  if (inkedFraction < MIN_INKED_FRACTION) {
    return fail(
      `Ink at least ${Math.round(MIN_INKED_FRACTION * 100)}% of the paper (now ${pct}%).`
    );
  }
  if (inkedFraction > MAX_INKED_FRACTION) {
    return fail(
      `Leave some paper showing: at most ${Math.round(MAX_INKED_FRACTION * 100)}% inked (now ${pct}%).`
    );
  }
  return { ok: true, target, mixed, inkedFraction };
};

export type CommunityPuzzle = {
  tray: Stamp[];
  solution: Placement[];
  target: Sheet;
};

/** A playable puzzle from a valid print: shuffled tray (seeded by the print id) and the solution. */
export const buildCommunityPuzzle = (
  printId: string,
  size: number,
  stamps: readonly ShopStamp[]
): CommunityPuzzle | null => {
  const check = checkPrint(size, stamps);
  if (!check.ok) return null;
  const rng = mulberry32(hash(printId));
  const order = shuffle(
    rng,
    stamps.map((_, i) => i)
  );
  const tray: Stamp[] = [];
  const solution: Placement[] = [];
  order.forEach((index, position) => {
    const s = stamps[index];
    if (!s) return;
    const id = `s${position + 1}`;
    tray.push({ id, shape: s.shape, ink: s.ink });
    solution.push({
      stampId: id,
      row: s.row,
      col: s.col,
      rotation: s.rotation,
    });
  });
  return { tray, solution, target: check.target };
};

const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

export type SundayCandidate = {
  printId: string;
  upvotes: number;
  solves: number;
  createdAt: number;
};

/** Ranking score kept in prints:week:{isoWeek}. Upvotes first, solves break ties. */
export const communityScore = (upvotes: number, solves: number): number =>
  upvotes * 1000 + Math.min(solves, 999);

/** Highest upvotes, then most solves, then the earliest. Null when there are none. */
export const pickSunday = (
  candidates: readonly SundayCandidate[]
): string | null => {
  const sorted = [...candidates].sort(
    (a, b) =>
      b.upvotes - a.upvotes || b.solves - a.solves || a.createdAt - b.createdAt
  );
  return sorted[0]?.printId ?? null;
};
