import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { utcDateOf } from '../../shared/daily';
import { nowMs } from '../core/clock';
import { createDailyPost, type DailyPostResult } from '../core/daily';

export const menu = new Hono();

export const dailyPostResponse = (
  result: DailyPostResult,
  date: string
): UiResponse => {
  if (result.status === 'busy') {
    return {
      showToast: `The press is already printing ${date}. Try again in a minute.`,
    };
  }
  return {
    showToast: {
      text:
        result.status === 'created'
          ? `Printed the daily for ${date}.`
          : `${date} was already posted, opening it.`,
      appearance: 'success',
    },
    navigateTo: result.url,
  };
};

/** Moderator: "Post today's print". Idempotent: opens the existing post if there is one. */
menu.post('/post-create', async (c) => {
  const date = utcDateOf(nowMs());
  try {
    return c.json<UiResponse>(
      dailyPostResponse(await createDailyPost(date), date),
      200
    );
  } catch (error) {
    console.error(`Error creating the daily for ${date}`, error);
    return c.json<UiResponse>(
      { showToast: 'Could not create the post. Check the logs.' },
      400
    );
  }
});

/** Moderator: "Post a print for a date…" opens a date form (for testing every weekday). */
menu.post('/post-for-date', async (c) => {
  const today = utcDateOf(nowMs());
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'postForDate',
        form: {
          title: 'Post a print for a date',
          description:
            'Creates the daily post for any UTC date (one per date). Dates before launch day are posted as "Preview".',
          acceptLabel: 'Print it',
          fields: [
            {
              type: 'string',
              name: 'date',
              label: 'Date (YYYY-MM-DD, UTC)',
              defaultValue: today,
              required: true,
            },
          ],
        },
      },
    },
    200
  );
});
