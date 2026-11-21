// Devvit Journeys analytics. Fire-and-forget, only from committed actions (taps), never on view.
// Action names are fixed strings; nothing personal is ever sent.

import { telemetry } from '@devvit/analytics/client/reddit';

const quietly = (work: () => Promise<unknown>) => {
  void work().catch(() => {});
};

export type JourneyAction =
  | 'rotate'
  | 'undo'
  | 'clear'
  | 'hint'
  | 'tutorial_skip'
  | 'tutorial_done'
  | 'play';

let readySent = false;

export const journeys = {
  /** App.Ready: the game is interactive. Once per page. */
  ready: () => {
    if (readySent) return;
    readySent = true;
    quietly(() => telemetry.appReady());
  },
  /** Journey.Start: the player pressed Play (or started a round without one). */
  start: () => quietly(() => telemetry.startJourney()),
  ensureStarted: () => {
    if (!telemetry.getActiveJourneyId())
      quietly(() => telemetry.startJourney());
  },
  progress: (fraction: number) =>
    quietly(() =>
      telemetry.progress({ progress: Math.min(1, Math.max(0, fraction)) })
    ),
  interaction: (action: JourneyAction) =>
    quietly(() => telemetry.interaction({ action })),
  /** Journey.End. `score`: 1000 minus the leaderboard score in seconds (higher is better). */
  end: (win: boolean, leaderboardScoreMs: number) =>
    quietly(() =>
      telemetry.endJourney({
        complete: win,
        game: {
          win,
          score: Math.max(0, 1000 - Math.round(leaderboardScoreMs / 1000)),
        },
      })
    ),
};
