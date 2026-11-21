// The generated daily print for a date (re-exports the label helpers for convenience).

import { puzzleNumber, LAUNCH_DATE } from './labels.ts';
import { generatePrint, type Print } from './puzzle.ts';

export * from './labels.ts';

export type DailyPrint = Print & { number: number | null };

/** The generated daily for a date; never throws for pre-launch dates. */
export const dailyPrint = (
  date: string,
  launchDate: string = LAUNCH_DATE
): DailyPrint => ({
  ...generatePrint(date),
  number: puzzleNumber(date, launchDate),
});
