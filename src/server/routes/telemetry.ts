// Devvit Journeys: the client telemetry helper posts here; we forward to the telemetry plugin.
// No PII: action names are fixed strings chosen by the client code, never user content.

import { Hono } from 'hono';
import { telemetry } from '@devvit/analytics/server/reddit';

export const telemetryRoutes = new Hono();

const ACTIONS = new Set([
  'rotate',
  'undo',
  'clear',
  'hint',
  'tutorial_skip',
  'tutorial_done',
  'play',
]);
const unspecified = {
  receipt: { status: 'JOURNEY_RECEIPT_UNSPECIFIED', message: 'not sent' },
};

const read = async (c: {
  req: { json: () => Promise<unknown> };
}): Promise<Record<string, unknown>> => {
  const body = await c.req.json().catch(() => ({}));
  return typeof body === 'object' && body !== null ? { ...body } : {};
};
const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.slice(0, 64) : undefined;

const safely = async <T>(work: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    console.error('telemetry', error);
    return fallback;
  }
};

telemetryRoutes.post('/journey/start', async (c) =>
  c.json(
    await safely(() => telemetry.startJourney(), {
      journeyId: '',
      ...unspecified,
    })
  )
);

telemetryRoutes.post('/journey/app-ready', async (c) =>
  c.json(await safely(() => telemetry.appReady(), unspecified))
);

telemetryRoutes.post('/journey/progress', async (c) => {
  const body = await read(c);
  const journeyId = str(body.journeyId);
  const progress =
    typeof body.progress === 'number'
      ? Math.min(1, Math.max(0, body.progress))
      : null;
  if (!journeyId || progress === null) return c.json(unspecified);
  return c.json(
    await safely(
      () => telemetry.journeyProgress({ journeyId, progress }),
      unspecified
    )
  );
});

telemetryRoutes.post('/journey/interaction', async (c) => {
  const body = await read(c);
  const journeyId = str(body.journeyId);
  const action = str(body.action);
  if (!journeyId || !action || !ACTIONS.has(action)) return c.json(unspecified);
  const actionDetails = str(body.actionDetails) ?? '';
  return c.json(
    await safely(
      () => telemetry.journeyInteraction({ journeyId, action, actionDetails }),
      unspecified
    )
  );
});

telemetryRoutes.post('/journey/end', async (c) => {
  const body = await read(c);
  const journeyId = str(body.journeyId);
  if (!journeyId) return c.json(unspecified);
  const game =
    typeof body.game === 'object' && body.game !== null ? body.game : null;
  const win =
    game && 'win' in game && typeof game.win === 'boolean' ? game.win : false;
  const score =
    game && 'score' in game && typeof game.score === 'number'
      ? Math.round(game.score)
      : 0;
  return c.json(
    await safely(
      () =>
        telemetry.endJourney({
          journeyId,
          complete: body.complete === true,
          game: { win, score },
        }),
      unspecified
    )
  );
});
