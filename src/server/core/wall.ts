// The Gallery Wall: one hash per month. Field `DD` holds the frame, `DD:solves` its solve count.

import { redis } from '@devvit/web/server';
import type { OverprintPostData } from '../../shared/postdata';
import { keys } from './keys';

export type StoredFrame = {
  date: string;
  number: number | null;
  maker: string | null;
  size: number;
  target: string;
  url: string;
};

const monthOf = (date: string) => date.slice(0, 7);
const dayOf = (date: string) => date.slice(8, 10);

export const addWallFrame = async (
  data: OverprintPostData,
  postId: string,
  url: string
): Promise<void> => {
  if (data.kind !== 'daily') return;
  const frame: StoredFrame = {
    date: data.date,
    number: data.number,
    maker: data.maker,
    size: data.size,
    target: data.target,
    url,
  };
  const month = monthOf(data.date);
  await redis.hSet(keys.wall(month), {
    [dayOf(data.date)]: JSON.stringify(frame),
    [`${dayOf(data.date)}:post`]: postId,
  });
  await redis.zAdd(keys.wallMonths(), {
    member: month,
    score: Number(month.replace('-', '')),
  });
};

export const countWallSolve = async (date: string): Promise<void> => {
  await redis.hIncrBy(keys.wall(monthOf(date)), `${dayOf(date)}:solves`, 1);
};

export const removeWallFrame = async (date: string): Promise<void> => {
  const day = dayOf(date);
  await redis.hDel(keys.wall(monthOf(date)), [
    day,
    `${day}:post`,
    `${day}:solves`,
  ]);
};

const daysInMonth = (month: string): number => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2000, m ?? 1, 0)).getUTCDate();
};

export type WallMonth = {
  months: string[];
  days: (StoredFrame & { solves: number; day: number })[];
  length: number;
};

/** All frames hung in a month, plus the list of months that have any. */
export const readWall = async (
  month: string,
  currentMonth: string
): Promise<WallMonth> => {
  const [hash, months] = await Promise.all([
    redis.hGetAll(keys.wall(month)),
    redis.zRange(keys.wallMonths(), 0, -1),
  ]);
  const list = new Set(months.map((m) => m.member));
  list.add(currentMonth);
  const days: WallMonth['days'] = [];
  for (const [field, value] of Object.entries(hash)) {
    if (!/^\d{2}$/.test(field)) continue;
    try {
      const frame: StoredFrame = JSON.parse(value);
      days.push({
        ...frame,
        day: Number(field),
        solves: Number(hash[`${field}:solves`] ?? '0') || 0,
      });
    } catch {
      // A damaged frame just shows as blank.
    }
  }
  return { months: [...list].sort(), days, length: daysInMonth(month) };
};
