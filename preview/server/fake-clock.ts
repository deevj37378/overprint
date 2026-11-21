// Replaces src/server/core/clock.ts in the preview harness: same time of day, fake date.
import { previewState } from './state.ts';

const DAY_MS = 86_400_000;

export const nowMs = (): number => {
  const { fakeDate } = previewState();
  if (!fakeDate) return Date.now();
  return Date.parse(`${fakeDate}T00:00:00Z`) + (Date.now() % DAY_MS);
};
