// Stand-in for `@devvit/analytics/server/reddit` in the preview harness: logs each Journey event.
import { logOutbox, newId } from './state.ts';

const receipt = {
  receipt: {
    status: 'JOURNEY_RECEIPT_DENIED_PLAYTEST',
    message: 'preview harness',
  },
};

export const telemetry = {
  async startJourney() {
    const journeyId = newId('journey_');
    logOutbox('journey', `Journey.Start ${journeyId}`);
    return { journeyId, ...receipt };
  },
  async journeyProgress(request: { journeyId: string; progress: number }) {
    logOutbox('journey', `Journey.Progress ${request.progress.toFixed(2)}`);
    return receipt;
  },
  async journeyInteraction(request: {
    action: string;
    actionDetails?: string;
  }) {
    logOutbox(
      'journey',
      `Journey.Interaction ${request.action} ${request.actionDetails ?? ''}`
    );
    return receipt;
  },
  async endJourney(request: {
    complete: boolean;
    game?: { win: boolean; score: number };
  }) {
    logOutbox(
      'journey',
      `Journey.End complete=${String(request.complete)} ${JSON.stringify(request.game ?? {})}`
    );
    return receipt;
  },
  async appReady() {
    logOutbox('journey', 'App.Ready');
    return receipt;
  },
};
