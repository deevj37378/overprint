import { redis } from '@devvit/web/server';
import type { PuzzleView, Streak } from '../../shared/api';
import { utcDateOf } from '../../shared/daily';
import {
  CHUNKS_PER_YEAR,
  currentStreak,
  dayBit,
  decodeYear,
  streakDay,
} from '../../shared/streak';
import { keys } from './keys';
import { getUser, setUserFields } from './users';

/** The day a solve of this puzzle counts for, or null (archive, community print). */
export const streakDayFor = (view: PuzzleView, now: number): string | null =>
  view.kind === 'daily' ? streakDay(view.date, now) : null;

const readYear = async (userId: string, year: number): Promise<Set<number>> => {
  const key = keys.streak(userId, year);
  const chunks: number[] = [];
  for (let c = 0; c < CHUNKS_PER_YEAR; c += 3) {
    const values = await redis.bitfield(
      key,
      'get',
      'u32',
      `#${c}`,
      'get',
      'u32',
      `#${c + 1}`,
      'get',
      'u32',
      `#${c + 2}`
    );
    chunks.push(...values);
  }
  return decodeYear(chunks);
};

export const readStreak = async (
  userId: string,
  now: number
): Promise<Streak> => {
  const today = utcDateOf(now);
  const year = Number(today.slice(0, 4));
  const years = new Map<number, Set<number>>([
    [year, await readYear(userId, year)],
    [year - 1, await readYear(userId, year - 1)],
  ]);
  const played = (date: string) => {
    const bit = dayBit(date);
    return years.get(bit.year)?.has(bit.index) ?? false;
  };
  // Streaks longer than ~a year need the year before last too.
  let current = currentStreak(played, today, 400);
  if (current >= 365) {
    years.set(year - 2, await readYear(userId, year - 2));
    current = currentStreak(played, today, 800);
  }
  const user = await getUser(userId);
  const best = Math.max(user.best, current);
  if (best !== user.best) await setUserFields(userId, { best });
  return { current, best };
};

export const recordStreakDay = async (
  userId: string,
  date: string
): Promise<void> => {
  const bit = dayBit(date);
  const key = keys.streak(userId, bit.year);
  await redis.bitfield(key, 'set', 'u1', bit.index, 1);
  // Keep a year's bits for two years (enough for streaks across New Year), then let them go.
  await redis.expire(key, 2 * 365 * 24 * 60 * 60);
};
