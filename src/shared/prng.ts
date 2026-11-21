// Seeded, deterministic randomness. Same seed → same sequence on every device.

import { parseIsoDate } from './date.ts';

export type Rng = () => number;

/** mulberry32: a tiny, fast 32-bit PRNG. Returns floats in [0, 1). */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** FNV-1a 32-bit string hash. */
const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** murmur3 finaliser: spreads the bits of a 32-bit integer. */
const mix32 = (value: number): number => {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** Seed for a UTC date string 'YYYY-MM-DD'. Throws on a malformed date. */
export const dateToSeed = (date: string): number => {
  parseIsoDate(date);
  return mix32(fnv1a(date));
};

/** A fresh seed for retry number `attempt` (0 returns a mix of the base seed). */
export const deriveSeed = (seed: number, attempt: number): number =>
  mix32((seed ^ Math.imul(attempt + 1, 0x9e3779b9)) >>> 0);

/** Integer in [0, n). */
export const randInt = (rng: Rng, n: number): number => Math.floor(rng() * n);

/** Integer in [min, max], inclusive. */
export const randRange = (rng: Rng, min: number, max: number): number =>
  min + randInt(rng, max - min + 1);

export const pick = <T>(rng: Rng, items: readonly T[]): T => {
  const item = items[randInt(rng, items.length)];
  if (item === undefined)
    throw new RangeError('Cannot pick from an empty list');
  return item;
};

/** Fisher–Yates shuffle into a new array. */
export const shuffle = <T>(rng: Rng, items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
};
