import { redis } from '@devvit/web/server';
import type { SolveResult, SolveSummary, Streak } from '../../shared/api';
import { parsePlacements, verifySolve } from '../../shared/puzzle';
import {
  isClean,
  percentile,
  sanitiseLifts,
  sanitiseTime,
  solveScore,
} from '../../shared/scoring';
import { emojiGrid, shareCommentText } from '../../shared/share';
import { nowMs } from './clock';
import { keys, userDataExpiry } from './keys';
import type { LoadedPuzzle } from './puzzles';
import { countWallSolve } from './wall';
import { recordStreakDay, readStreak, streakDayFor } from './streaks';
import { refreshFlair } from './flair';

export type SolveRecord = SolveSummary & {
  at: number;
  username: string;
  score: number;
};

export type Who = { userId: string; username: string } | null;

export const getSolve = async (
  pkey: string,
  userId: string
): Promise<SolveRecord | null> => {
  const raw = await redis.get(keys.solve(pkey, userId));
  if (!raw) return null;
  const record: SolveRecord = JSON.parse(raw);
  return record;
};

/** Remember when this player first picked up a stamp, for the server-side time check. */
export const markStarted = async (
  pkey: string,
  userId: string
): Promise<void> => {
  const key = keys.start(pkey, userId);
  await redis.set(key, String(nowMs()), {
    nx: true,
    expiration: userDataExpiry(nowMs()),
  });
};

const rankOf = async (pkey: string, userId: string | null, score: number) => {
  const total = await redis.zCard(keys.leaderboard(pkey));
  const rank = userId
    ? ((await redis.zRank(keys.leaderboard(pkey), userId)) ?? null)
    : // Logged out: where this score would land, without storing it.
      (
        await redis.zRange(keys.leaderboard(pkey), 0, score - 1, {
          by: 'score',
        })
      ).length;
  const count = userId ? total : total + 1;
  return {
    rank,
    total: count,
    percentile: rank === null ? null : percentile(rank, count),
  };
};

export type SolveOutcome =
  { ok: true; result: SolveResult } | { ok: false; message: string };

export const recordSolve = async (
  loaded: LoadedPuzzle,
  who: Who,
  body: { placements: unknown; timeMs: unknown; lifts: unknown }
): Promise<SolveOutcome> => {
  const verdict = verifySolve(loaded.puzzle, body.placements);
  if (!verdict.ok)
    return {
      ok: false,
      message: `That print doesn't match the proof (${verdict.error}).`,
    };
  const placements = parsePlacements(body.placements) ?? [];
  const { pkey, puzzle, view } = loaded;

  let started: number | null = null;
  if (who) {
    const raw = await redis.get(keys.start(pkey, who.userId));
    started = raw ? Number(raw) : null;
  }
  const lifts = sanitiseLifts(typeof body.lifts === 'number' ? body.lifts : 0);
  const timeMs = sanitiseTime(
    typeof body.timeMs === 'number' ? body.timeMs : Number.NaN,
    placements.length,
    started === null ? null : nowMs() - started
  );

  const existing = who ? await getSolve(pkey, who.userId) : null;
  let record: SolveRecord = existing ?? {
    timeMs,
    lifts,
    clean: isClean(lifts),
    score: solveScore(timeMs, lifts),
    at: nowMs(),
    username: who?.username ?? '',
  };

  let counted = false;
  let streak: Streak | null = null;
  let streakCounted = false;

  if (who && !existing) {
    const key = keys.solve(pkey, who.userId);
    await redis.set(key, JSON.stringify(record), {
      nx: true,
      expiration: userDataExpiry(nowMs()),
    });
    const stored = await getSolve(pkey, who.userId);
    counted = stored?.at === record.at;
    if (stored) record = stored;
    if (counted) {
      await redis.zAdd(keys.leaderboard(pkey), {
        member: who.userId,
        score: record.score,
      });
      await redis.expire(keys.leaderboard(pkey), 90 * 24 * 60 * 60);
      await redis.hIncrBy(keys.stats(pkey), 'solves', 1);
      await redis.hIncrBy(keys.stats(pkey), 'totalTimeMs', record.timeMs);
      if (view.kind === 'daily') await countWallSolve(view.date);
      const day = streakDayFor(view, nowMs());
      if (day) {
        await recordStreakDay(who.userId, day);
        streakCounted = true;
      }
    }
  }
  if (who) {
    streak = await readStreak(who.userId, nowMs());
    if (counted) await refreshFlair(who, streak);
  }

  const place = await rankOf(pkey, who?.userId ?? null, record.score);
  const shared = who
    ? (await redis.get(keys.shared(pkey, who.userId))) !== undefined
    : false;

  return {
    ok: true,
    result: {
      status: 'ok',
      timeMs: record.timeMs,
      lifts: record.lifts,
      clean: record.clean,
      score: record.score,
      loggedIn: who !== null,
      counted,
      rank: place.rank,
      total: place.total,
      percentile: place.percentile,
      streak,
      streakCounted,
      emojiGrid: emojiGrid(puzzle.target),
      shareText: shareCommentText({
        title: view.title,
        target: puzzle.target,
        timeMs: record.timeMs,
        lifts: record.lifts,
        streak: view.kind === 'daily' ? streak : null,
      }),
      shared,
      canShare: who !== null,
    },
  };
};
