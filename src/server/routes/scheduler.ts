import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { utcDateOf } from '../../shared/daily';
import { nowMs } from '../core/clock';
import { createDailyPost } from '../core/daily';
import { pickCommunitySunday } from '../core/community';

export const scheduler = new Hono();

/** Cron "0 0 * * *" (UTC): post today's daily. On Saturdays, also choose Sunday's community print. */
scheduler.post('/daily-post', async (c) => {
  const date = utcDateOf(nowMs());
  try {
    const result = await createDailyPost(date);
    console.log(`daily-post ${date}: ${result.status}`);
  } catch (error) {
    console.error(`daily-post ${date} failed`, error);
  }
  try {
    await pickCommunitySunday(date);
  } catch (error) {
    console.error('Community Sunday pick failed', error);
  }
  return c.json<TaskResponse>({}, 200);
});
