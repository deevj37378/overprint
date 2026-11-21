import { reddit, redis } from '@devvit/web/server';
import { decideClaim, pendingClaim } from '../../shared/claim';
import { encodeTarget, type OverprintPostData } from '../../shared/postdata';
import { dailyPostTitle, puzzleNumber } from '../../shared/daily';
import { nowMs } from './clock';
import { isPostId } from './ids';
import { keys } from './keys';
import { dailyPostData, getDailyPrint, getStoredPrint } from './puzzles';
import { addWallFrame } from './wall';

export const STICKY_TEXT = 'Share your print here 👇';

export type DailyPostResult =
  | { status: 'created'; postId: string; url: string }
  | { status: 'exists'; postId: string; url: string }
  | { status: 'busy' };

const postUrl = async (postId: string): Promise<string> => {
  try {
    if (!isPostId(postId)) throw new Error(`Not a post id: ${postId}`);
    const post = await reddit.getPostById(postId);
    return `https://www.reddit.com${post.permalink}`;
  } catch {
    return `https://www.reddit.com/comments/${postId.replace(/^t3_/, '')}`;
  }
};

/** Post data for a date's daily: the generator's print, or the week's Community Sunday pick. */
const postDataForDate = async (date: string): Promise<OverprintPostData> => {
  const sundayPick = await redis.get(keys.sunday(date));
  if (sundayPick) {
    const print = await getStoredPrint(sundayPick);
    if (print) {
      const number = puzzleNumber(date);
      return {
        kind: 'daily',
        date,
        number,
        size: print.size,
        target: encodeTarget(print.target),
        title: `${dailyPostTitle(date, number)} · Community Print`,
        maker: print.maker,
        printId: print.id,
      };
    }
  }
  return dailyPostData(await getDailyPrint(date));
};

/** Post the app's sticky "share here" comment. Failures are logged, never fatal. */
export const postStickyComment = async (postId: string): Promise<void> => {
  try {
    if (!isPostId(postId)) throw new Error(`Not a post id: ${postId}`);
    const post = await reddit.getPostById(postId);
    const comment = await post.addComment({ text: STICKY_TEXT });
    await comment.distinguish(true);
    await redis.set(keys.sticky(postId), comment.id);
  } catch (error) {
    console.error(`Could not post the sticky comment on ${postId}`, error);
  }
};

/**
 * Create the daily post for a UTC date, exactly once. Safe to call from the scheduler, the
 * moderator menu and the install trigger at the same time.
 */
export const createDailyPost = async (
  date: string
): Promise<DailyPostResult> => {
  const claimKey = keys.daily(date);
  const decision = decideClaim(await redis.get(claimKey), nowMs());
  if (decision.action === 'exists') {
    return {
      status: 'exists',
      postId: decision.postId,
      url: await postUrl(decision.postId),
    };
  }
  if (decision.action === 'wait') return { status: 'busy' };

  // Take the claim. A fresh claim uses NX so two callers can't both win.
  // (The return value of SET NX isn't documented, so read the key back to see who won.)
  const claim = pendingClaim(nowMs());
  const current = await redis.get(claimKey);
  if (current) await redis.set(claimKey, claim);
  else await redis.set(claimKey, claim, { nx: true });
  if ((await redis.get(claimKey)) !== claim) return { status: 'busy' };

  try {
    const data = await postDataForDate(date);
    const post = await reddit.submitCustomPost({
      title: data.title,
      entry: 'default',
      postData: data,
      textFallback: {
        text: `${data.title}: today's riso-print puzzle. Open this post in the Reddit app or on new Reddit to play.`,
      },
    });
    await redis.set(claimKey, post.id);
    await redis.set(keys.post(post.id), JSON.stringify(data));
    await postStickyComment(post.id);
    await addWallFrame(
      data,
      post.id,
      `https://www.reddit.com${post.permalink}`
    );
    return {
      status: 'created',
      postId: post.id,
      url: `https://www.reddit.com${post.permalink}`,
    };
  } catch (error) {
    await redis.del(claimKey);
    throw error;
  }
};
