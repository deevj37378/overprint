import { Hono, type Context as HonoContext } from 'hono';
import { context, reddit, redis } from '@devvit/web/server';
import type {
  ErrorResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  MeResponse,
  Prefs,
  PrefsResponse,
  PuzzleResponse,
  GalleryResponse,
  ShareResponse,
  ShopInfoResponse,
  ShopPostResponse,
  SolveRequest,
  SplashResponse,
  StartResponse,
  SubscribeResponse,
} from '../../shared/api';
import { utcDateOf } from '../../shared/daily';
import { nowMs } from '../core/clock';
import { keys, userDataExpiry } from '../core/keys';
import {
  currentPostData,
  loadPuzzleFor,
  type LoadedPuzzle,
} from '../core/puzzles';
import {
  getSolve,
  markStarted,
  recordSolve,
  storedResult,
  type Who,
} from '../core/solves';
import { readStreak } from '../core/streaks';
import { getUser, setUserFields } from '../core/users';
import { puzzleKey } from '../../shared/postdata';
import { shareCommentText } from '../../shared/share';
import { DAILY_POST_LIMIT, parseShopStamps } from '../../shared/community';
import { postCommunityPrint, postedToday } from '../core/community';
import { readWall } from '../core/wall';
import { decodeTarget } from '../../shared/postdata';
import { isCommentId, isPostId } from '../core/ids';

export const api = new Hono();

const fail = (
  c: HonoContext,
  status: 400 | 404 | 409 | 429 | 500,
  message: string,
  code?: string
) =>
  c.json<ErrorResponse>(
    code ? { status: 'error', message, code } : { status: 'error', message },
    status
  );

/** The logged-in player, or null when logged out. */
export const currentPlayer = async (): Promise<Who> => {
  const { userId } = context;
  if (!userId) return null;
  const username =
    context.username ?? (await reddit.getCurrentUsername()) ?? 'printer';
  return { userId, username };
};

const loadCurrent = async (): Promise<LoadedPuzzle | null> => {
  const data = await currentPostData();
  return data ? loadPuzzleFor(data) : null;
};

api.get('/puzzle', async (c) => {
  try {
    const loaded = await loadCurrent();
    if (!loaded)
      return fail(c, 404, 'This post has no print attached.', 'no-puzzle');
    return c.json<PuzzleResponse>({ status: 'ok', puzzle: loaded.view });
  } catch (error) {
    console.error('GET /api/puzzle', error);
    return fail(c, 500, 'The press jammed loading this print. Try again.');
  }
});

api.get('/me', async (c) => {
  try {
    const who = await currentPlayer();
    const data = await currentPostData();
    if (!who) {
      return c.json<MeResponse>({
        status: 'ok',
        loggedIn: false,
        username: null,
        solve: null,
        streak: null,
        prefs: { tutorialDone: false, colourBlind: false },
        subscribed: false,
      });
    }
    const [user, solve, streak] = await Promise.all([
      getUser(who.userId),
      data ? getSolve(puzzleKey(data), who.userId) : Promise.resolve(null),
      readStreak(who.userId, nowMs()),
    ]);
    return c.json<MeResponse>({
      status: 'ok',
      loggedIn: true,
      username: who.username,
      solve: solve
        ? { timeMs: solve.timeMs, lifts: solve.lifts, clean: solve.clean }
        : null,
      streak,
      prefs: { tutorialDone: user.tutorialDone, colourBlind: user.colourBlind },
      subscribed: user.subscribed,
    });
  } catch (error) {
    console.error('GET /api/me', error);
    return fail(c, 500, 'Could not load your printer profile.');
  }
});

api.get('/splash', async (c) => {
  try {
    const data = await currentPostData();
    const who = await currentPlayer();
    const pkey = data ? puzzleKey(data) : utcDateOf(nowMs());
    const [solves, solve, streak] = await Promise.all([
      redis.hGet(keys.stats(pkey), 'solves'),
      who ? getSolve(pkey, who.userId) : Promise.resolve(null),
      who ? readStreak(who.userId, nowMs()) : Promise.resolve(null),
    ]);
    return c.json<SplashResponse>({
      status: 'ok',
      printedToday: Number(solves ?? '0') || 0,
      loggedIn: who !== null,
      streak,
      solve: solve
        ? { timeMs: solve.timeMs, lifts: solve.lifts, clean: solve.clean }
        : null,
    });
  } catch (error) {
    console.error('GET /api/splash', error);
    return fail(c, 500, 'Could not load today’s numbers.');
  }
});

api.post('/start', async (c) => {
  const who = await currentPlayer();
  const data = await currentPostData();
  if (who && data) await markStarted(puzzleKey(data), who.userId);
  return c.json<StartResponse>({ status: 'ok' });
});

api.post('/solve', async (c) => {
  let body: SolveRequest;
  try {
    body = await c.req.json<SolveRequest>();
  } catch {
    return fail(c, 400, 'Malformed solve.');
  }
  try {
    const loaded = await loadCurrent();
    if (!loaded)
      return fail(c, 404, 'This post has no print attached.', 'no-puzzle');
    const who = await currentPlayer();
    const outcome = await recordSolve(loaded, who, body);
    if (!outcome.ok) return fail(c, 400, outcome.message, 'mismatch');
    return c.json(outcome.result);
  } catch (error) {
    console.error('POST /api/solve', error);
    return fail(c, 500, 'The press jammed saving your print. Try again.');
  }
});

api.get('/result', async (c) => {
  try {
    const loaded = await loadCurrent();
    if (!loaded) return fail(c, 404, 'No print here.');
    const result = await storedResult(loaded, await currentPlayer());
    if (!result)
      return fail(c, 404, 'You haven’t printed this one yet.', 'not-solved');
    return c.json(result);
  } catch (error) {
    console.error('GET /api/result', error);
    return fail(c, 500, 'Could not load your result.');
  }
});

api.get('/leaderboard', async (c) => {
  try {
    const data = await currentPostData();
    if (!data) return fail(c, 404, 'No print here.');
    const pkey = puzzleKey(data);
    const who = await currentPlayer();
    const lb = keys.leaderboard(pkey);
    const [top, total] = await Promise.all([
      redis.zRange(lb, 0, 9),
      redis.zCard(lb),
    ]);
    const entry = async (
      userId: string,
      rank: number
    ): Promise<LeaderboardEntry | null> => {
      const solve = await getSolve(pkey, userId);
      if (!solve) return null;
      return {
        rank: rank + 1,
        username: solve.username,
        timeMs: solve.timeMs,
        lifts: solve.lifts,
        clean: solve.clean,
        you: userId === who?.userId,
      };
    };
    const entries = (
      await Promise.all(top.map((m, i) => entry(m.member, i)))
    ).filter((e): e is LeaderboardEntry => e !== null);
    let you: LeaderboardEntry | null = null;
    if (who) {
      const rank = await redis.zRank(lb, who.userId);
      if (rank !== undefined) you = await entry(who.userId, rank);
    }
    return c.json<LeaderboardResponse>({
      status: 'ok',
      top: entries,
      you,
      total,
    });
  } catch (error) {
    console.error('GET /api/leaderboard', error);
    return fail(c, 500, 'Could not load the leaderboard.');
  }
});

/** Share to comments: posts AS THE USER, only from an explicit button press. */
api.post('/share', async (c) => {
  try {
    const who = await currentPlayer();
    if (!who) return fail(c, 400, 'Log in to share your print.', 'logged-out');
    const loaded = await loadCurrent();
    if (!loaded) return fail(c, 404, 'No print here.');
    const solve = await getSolve(loaded.pkey, who.userId);
    if (!solve) return fail(c, 409, 'Solve the print first.', 'not-solved');

    // One share per player per print; double taps land here too.
    const sharedKey = keys.shared(loaded.pkey, who.userId);
    await redis.set(sharedKey, `pending:${nowMs()}`, {
      nx: true,
      expiration: userDataExpiry(nowMs()),
    });
    const mark = await redis.get(sharedKey);
    if (mark && !mark.startsWith('pending:')) {
      return c.json<ShareResponse>({ status: 'ok', alreadyShared: true });
    }

    const { postId } = context;
    const stickyId = postId ? await redis.get(keys.sticky(postId)) : undefined;
    const target = stickyId ?? postId;
    if (!target || !(isCommentId(target) || isPostId(target))) {
      await redis.del(sharedKey);
      return fail(c, 404, 'Could not find where to post.');
    }
    const streak =
      loaded.view.kind === 'daily'
        ? await readStreak(who.userId, nowMs())
        : null;
    const text = shareCommentText({
      title: loaded.view.title,
      target: loaded.puzzle.target,
      timeMs: solve.timeMs,
      lifts: solve.lifts,
      streak,
    });
    try {
      const comment = await reddit.submitComment({
        id: target,
        text,
        runAs: 'USER',
      });
      await redis.set(sharedKey, comment.id, {
        expiration: userDataExpiry(nowMs()),
      });
    } catch (error) {
      await redis.del(sharedKey);
      throw error;
    }
    return c.json<ShareResponse>({ status: 'ok', alreadyShared: false });
  } catch (error) {
    console.error('POST /api/share', error);
    return fail(c, 500, 'Could not post your comment. Nothing was posted.');
  }
});

/** Join the print shop: subscribes the user, only from an explicit button press. */
api.post('/subscribe', async (c) => {
  try {
    const who = await currentPlayer();
    if (!who) return fail(c, 400, 'Log in to join.', 'logged-out');
    await reddit.subscribeToCurrentSubreddit();
    await setUserFields(who.userId, { subscribed: true });
    return c.json<SubscribeResponse>({ status: 'ok' });
  } catch (error) {
    console.error('POST /api/subscribe', error);
    return fail(c, 500, 'Could not join right now.');
  }
});

api.post('/prefs', async (c) => {
  const who = await currentPlayer();
  const body: Partial<Prefs> | null = await c.req
    .json<Partial<Prefs>>()
    .catch(() => null);
  if (!body) return fail(c, 400, 'Malformed preferences.');
  const prefs: Partial<Prefs> = {};
  if (typeof body.tutorialDone === 'boolean')
    prefs.tutorialDone = body.tutorialDone;
  if (typeof body.colourBlind === 'boolean')
    prefs.colourBlind = body.colourBlind;
  if (!who) {
    return c.json<PrefsResponse>({
      status: 'ok',
      prefs: {
        tutorialDone: prefs.tutorialDone ?? false,
        colourBlind: prefs.colourBlind ?? false,
      },
    });
  }
  await setUserFields(who.userId, prefs);
  const user = await getUser(who.userId);
  return c.json<PrefsResponse>({
    status: 'ok',
    prefs: { tutorialDone: user.tutorialDone, colourBlind: user.colourBlind },
  });
});

api.get('/shop', async (c) => {
  const who = await currentPlayer();
  return c.json<ShopInfoResponse>({
    status: 'ok',
    loggedIn: who !== null,
    username: who?.username ?? null,
    postedToday: who ? await postedToday(who.userId) : 0,
    dailyLimit: DAILY_POST_LIMIT,
  });
});

/** Post my print: submits a post AS THE USER, only from an explicit button press. */
api.post('/shop/post', async (c) => {
  try {
    const who = await currentPlayer();
    if (!who) return fail(c, 400, 'Log in to post your print.', 'logged-out');
    const body: unknown = await c.req.json().catch(() => null);
    const get = (key: string): unknown =>
      typeof body === 'object' && body !== null
        ? Reflect.get(body, key)
        : undefined;
    const size = get('size');
    const stamps = parseShopStamps(get('stamps'));
    const adjective = get('adjective');
    const noun = get('noun');
    if (
      typeof size !== 'number' ||
      !stamps ||
      typeof adjective !== 'string' ||
      typeof noun !== 'string'
    ) {
      return c.json<ShopPostResponse>({
        status: 'rejected',
        reason: 'That print didn’t arrive in one piece. Try again.',
      });
    }
    return c.json<ShopPostResponse>(
      await postCommunityPrint(who, size, stamps, adjective, noun)
    );
  } catch (error) {
    console.error('POST /api/shop/post', error);
    return fail(
      c,
      500,
      'The press jammed posting your print. Nothing was posted.'
    );
  }
});

api.get('/gallery', async (c) => {
  try {
    const today = utcDateOf(nowMs());
    const requested = c.req.query('month') ?? '';
    const month = /^\d{4}-\d{2}$/.test(requested)
      ? requested
      : today.slice(0, 7);
    const wall = await readWall(month, today.slice(0, 7));
    const days: GalleryResponse['days'] = Array.from(
      { length: wall.length },
      () => null
    );
    for (const frame of wall.days) {
      if (frame.day < 1 || frame.day > wall.length) continue;
      days[frame.day - 1] = {
        day: frame.day,
        date: frame.date,
        number: frame.number,
        maker: frame.maker,
        solves: frame.solves,
        size: frame.size,
        target: decodeTarget(frame.target, frame.size),
        url: frame.url,
        isToday: frame.date === today,
      };
    }
    return c.json<GalleryResponse>({
      status: 'ok',
      month,
      today,
      months: wall.months,
      days,
    });
  } catch (error) {
    console.error('GET /api/gallery', error);
    return fail(c, 500, 'Could not load the Gallery Wall.');
  }
});
