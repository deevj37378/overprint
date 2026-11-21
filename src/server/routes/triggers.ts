import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostDeleteRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { redis } from '@devvit/web/server';
import { utcDateOf } from '../../shared/daily';
import { parsePostData, puzzleKey } from '../../shared/postdata';
import { nowMs } from '../core/clock';
import { createDailyPost } from '../core/daily';
import { keys } from '../core/keys';
import { removeWallFrame } from '../core/wall';
import { forgetCommunityPrint } from '../core/community';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  const date = utcDateOf(nowMs());
  try {
    const result = await createDailyPost(date);
    console.log(`Install (${input.type}): daily for ${date} ${result.status}`);
  } catch (error) {
    console.error('Install: could not create the first daily', error);
  }
  return c.json<TriggerResponse>({}, 200);
});

/** Data hygiene: when a post is deleted, delete the keys that belong to it. */
triggers.post('/on-post-delete', async (c) => {
  const input = await c.req.json<OnPostDeleteRequest>();
  const postId = input.postId;
  try {
    const raw = await redis.get(keys.post(postId));
    const data = raw ? parsePostData(JSON.parse(raw)) : null;
    await redis.del(keys.post(postId), keys.sticky(postId));
    if (data) {
      const pkey = puzzleKey(data);
      if (data.kind === 'daily') {
        // Only release the date if this post was the daily for it.
        if ((await redis.get(keys.daily(data.date))) === postId) {
          await redis.del(keys.daily(data.date));
          await removeWallFrame(data.date);
        }
      } else {
        await redis.del(keys.leaderboard(pkey), keys.stats(pkey));
        if (data.printId) await forgetCommunityPrint(data.printId);
      }
    }
  } catch (error) {
    console.error(`on-post-delete ${postId}`, error);
  }
  return c.json<TriggerResponse>({}, 200);
});
