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
