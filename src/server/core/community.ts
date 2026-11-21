// Community prints (Print Shop) and Community Sunday.

import { reddit, redis } from '@devvit/web/server';
import type { ShopPostResponse, ShopStamp } from '../../shared/api';
import {
  buildCommunityPuzzle,
  checkPrint,
  communityScore,
  DAILY_POST_LIMIT,
  pickSunday,
  printTitle,
  type SundayCandidate,
} from '../../shared/community';
import { addDays, isoWeek, weekdayOf } from '../../shared/date';
import { utcDateOf } from '../../shared/labels';
import { encodeTarget, type OverprintPostData } from '../../shared/postdata';
import { nowMs } from './clock';
import { postStickyComment } from './daily';
import { refreshFlair } from './flair';
import { isPostId } from './ids';
import { keys } from './keys';
import { getStoredPrint, type StoredPrint } from './puzzles';
import { readStreak } from './streaks';
import { setUserFields } from './users';

const WEEK_TTL_S = 21 * 24 * 60 * 60;

export const postedToday = async (userId: string): Promise<number> =>
  Number(
    (await redis.get(keys.shopLimit(userId, utcDateOf(nowMs())))) ?? '0'
  ) || 0;

const newPrintId = (): string =>
  `p${nowMs().toString(36)}${Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')}`;

export const postCommunityPrint = async (
  who: { userId: string; username: string },
  size: number,
  stamps: ShopStamp[],
  adjective: string,
  noun: string
): Promise<ShopPostResponse> => {
  const name = printTitle(adjective, noun);
  if (!name)
    return { status: 'rejected', reason: 'Pick a title from the word lists.' };
  const check = checkPrint(size, stamps);
  if (!check.ok) return { status: 'rejected', reason: check.reason };

  // At most 3 posted prints per player per UTC day (counted before posting).
  const today = utcDateOf(nowMs());
  const limitKey = keys.shopLimit(who.userId, today);
  const count = await redis.incrBy(limitKey, 1);
  await redis.expire(limitKey, 2 * 24 * 60 * 60);
  if (count > DAILY_POST_LIMIT) {
    await redis.incrBy(limitKey, -1);
    return {
      status: 'rejected',
      reason: `That's ${DAILY_POST_LIMIT} prints today. The press reopens tomorrow.`,
    };
  }

  const printId = newPrintId();
  const puzzle = buildCommunityPuzzle(printId, size, stamps);
  if (!puzzle) {
    await redis.incrBy(limitKey, -1);
    return {
      status: 'rejected',
      reason: 'That print can’t be played. Try a different layout.',
    };
  }
  const title = `${name} · printed by u/${who.username}`;
  const data: OverprintPostData = {
    kind: 'community',
    date: today,
    number: null,
    size,
    target: encodeTarget(puzzle.target),
    title: name,
    maker: who.username,
    printId,
  };
  const stored: StoredPrint = {
    id: printId,
    size,
    tray: puzzle.tray,
    target: puzzle.target,
    solution: puzzle.solution,
    title: name,
    maker: who.username,
    makerId: who.userId,
    postId: null,
    permalink: null,
    createdAt: nowMs(),
    date: today,
  };
  await redis.set(keys.print(printId), JSON.stringify(stored));

  try {
    const post = await reddit.submitCustomPost({
      title,
      entry: 'default',
      postData: data,
      runAs: 'USER',
      userGeneratedContent: {
        text: `${name}: an Overprint puzzle printed by u/${who.username}.`,
      },
      textFallback: {
        text: `${title}. Open this post in the Reddit app or on new Reddit to play.`,
      },
    });
    stored.postId = post.id;
    stored.permalink = post.permalink;
    await redis.set(keys.print(printId), JSON.stringify(stored));
    await redis.set(keys.post(post.id), JSON.stringify(data));
    const week = keys.printsWeek(isoWeek(today));
    await redis.zAdd(week, { member: printId, score: 0 });
    await redis.expire(week, WEEK_TTL_S);
    await postStickyComment(post.id);
    return {
      status: 'ok',
      postId: post.id,
      url: `https://www.reddit.com${post.permalink}`,
      title,
    };
  } catch (error) {
    await redis.del(keys.print(printId));
    await redis.incrBy(limitKey, -1);
    throw error;
  }
};

const upvotesOf = async (print: StoredPrint): Promise<number> => {
  if (!print.postId || !isPostId(print.postId)) return 0;
  try {
    return (await reddit.getPostById(print.postId)).score;
  } catch {
    return 0;
  }
};

const solvesOf = async (printId: string): Promise<number> =>
  Number((await redis.hGet(keys.stats(`print-${printId}`), 'solves')) ?? '0') ||
  0;

/** Keep a print's weekly ranking fresh (called after each solve of it). */
export const refreshCommunityScore = async (printId: string): Promise<void> => {
  const print = await getStoredPrint(printId);
  if (!print) return;
  const score = communityScore(await upvotesOf(print), await solvesOf(printId));
  await redis.zAdd(keys.printsWeek(isoWeek(print.date)), {
    member: printId,
    score,
  });
};

/**
 * Saturday's job picks the best community print of the past 7 days to be Sunday's daily
 * (credited to its maker, who gets Featured Printer flair). No prints → the generator runs.
 */
export const pickCommunitySunday = async (
  date: string
): Promise<string | null> => {
  if (weekdayOf(date) !== 'sat') return null;
  const sunday = addDays(date, 1);
  if (await redis.get(keys.sunday(sunday))) return null;
  const since = nowMs() - 7 * 24 * 60 * 60 * 1000;
  const ids = new Set<string>();
  for (const week of [isoWeek(date), isoWeek(addDays(date, -7))]) {
    for (const m of await redis.zRange(keys.printsWeek(week), 0, -1))
      ids.add(m.member);
  }
  const candidates: (SundayCandidate & { print: StoredPrint })[] = [];
  for (const id of ids) {
    const print = await getStoredPrint(id);
    if (!print || !print.postId || print.createdAt < since) continue;
    candidates.push({
      printId: id,
      upvotes: await upvotesOf(print),
      solves: await solvesOf(id),
      createdAt: print.createdAt,
      print,
    });
  }
  const winner = pickSunday(candidates);
  const chosen = candidates.find((c) => c.printId === winner);
  if (!winner || !chosen) return null;
  await redis.set(keys.sunday(sunday), winner);
  await setUserFields(chosen.print.makerId, { featured: true });
  await refreshFlair(
    { userId: chosen.print.makerId, username: chosen.print.maker },
    await readStreak(chosen.print.makerId, nowMs())
  );
  console.log(
    `Community Sunday ${sunday}: ${winner} by u/${chosen.print.maker}`
  );
  return winner;
};

/** Data hygiene when a community post is deleted. */
export const forgetCommunityPrint = async (printId: string): Promise<void> => {
  const print = await getStoredPrint(printId);
  await redis.del(keys.print(printId));
  if (print) await redis.zRem(keys.printsWeek(isoWeek(print.date)), [printId]);
};
