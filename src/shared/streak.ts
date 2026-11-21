// Streak maths over one bit per day: streak:{userId}:{year}, bit = day of year (0-based),
// keyed by the post's UTC date, never the device clock.

import { addDays, parseIsoDate } from './date.ts';
import { utcDateOf } from './labels.ts';

export type DayBit = { year: number; index: number };

/** Bits per chunk when reading a year's bitfield. */
export const CHUNK_BITS = 32;
export const CHUNKS_PER_YEAR = 12; // 12 × 32 = 384 ≥ 366

export const dayBit = (date: string): DayBit => {
  const year = Number(date.slice(0, 4));
  return { year, index: parseIsoDate(date) - parseIsoDate(`${year}-01-01`) };
};

/** Days played in a year, from `u32` chunks read most-significant-bit first. */
export const decodeYear = (chunks: readonly number[]): Set<number> => {
  const days = new Set<number>();
  chunks.forEach((chunk, c) => {
    for (let bit = 0; bit < CHUNK_BITS; bit++) {
      if (Math.floor(chunk / 2 ** (CHUNK_BITS - 1 - bit)) % 2 === 1)
        days.add(c * CHUNK_BITS + bit);
    }
  });
  return days;
};

/**
 * Current streak ending today, or yesterday if today isn't played yet (a streak stays alive
 * until the day is over). `played` answers for any date.
 */
export const currentStreak = (
  played: (date: string) => boolean,
  today: string,
  maxDays = 800
): number => {
  let day = played(today) ? today : addDays(today, -1);
  let count = 0;
  while (count < maxDays && played(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
};

/** Grace after midnight UTC during which yesterday's daily still counts (mid-game rollover). */
export const ROLLOVER_GRACE_MS = 15 * 60_000;

/**
 * Which day a solve of a daily dated `postDate` counts for, or null if it doesn't count
 * (archive). Today's daily always counts; yesterday's counts for a short grace after midnight.
 */
export const streakDay = (postDate: string, nowMs: number): string | null => {
  const today = utcDateOf(nowMs);
  if (postDate === today) return today;
  if (
    postDate === addDays(today, -1) &&
    nowMs - Date.parse(`${today}T00:00:00Z`) < ROLLOVER_GRACE_MS
  ) {
    return postDate;
  }
  return null;
};

export const flairText = (current: number, featured: boolean): string => {
  const parts: string[] = [];
  if (current >= 30) parts.push('✦ Master Printer');
  else if (current >= 1) parts.push(`🖨 ${current}-day streak`);
  if (featured) parts.push('🎨 Featured Printer');
  return parts.join(' · ');
};
