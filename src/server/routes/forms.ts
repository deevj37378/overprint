import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { parseIsoDate } from '../../shared/date';
import { createDailyPost } from '../core/daily';
import { dailyPostResponse } from './menu';

export const forms = new Hono();

forms.post('/post-for-date', async (c) => {
  const body: unknown = await c.req.json().catch(() => ({}));
  const raw =
    typeof body === 'object' && body !== null && 'date' in body
      ? body.date
      : '';
  const date = typeof raw === 'string' ? raw.trim() : '';
  try {
    parseIsoDate(date);
  } catch {
    return c.json<UiResponse>(
      { showToast: `“${date}” isn’t a date. Use YYYY-MM-DD.` },
      200
    );
  }
  try {
    return c.json<UiResponse>(
      dailyPostResponse(await createDailyPost(date), date),
      200
    );
  } catch (error) {
    console.error(`Error creating the daily for ${date}`, error);
    return c.json<UiResponse>(
      { showToast: 'Could not create the post. Check the logs.' },
      200
    );
  }
});
