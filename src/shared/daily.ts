// Daily-puzzle helpers: launch day, numbering, labels and post titles. All dates are UTC.

import { daysBetween, parseIsoDate, weekdayOf } from './date.ts';
import { generatePrint, type Print } from './puzzle.ts';

/** Puzzle #1. Dates before this are served as "Preview" puzzles (for testing before launch). */
export const LAUNCH_DATE = '2026-12-01';

export const utcDateOf = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 10);

/** Puzzle number for a date, or null before launch (a preview). */
export const puzzleNumber = (
  date: string,
  launchDate: string = LAUNCH_DATE
): number | null => {
  const n = daysBetween(launchDate, date) + 1;
  return n >= 1 ? n : null;
};

const WEEKDAY_LABEL = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 'Mon 1 Dec' */
export const formatShortDate = (date: string): string => {
  parseIsoDate(date);
  const month = MONTHS[Number(date.slice(5, 7)) - 1] ?? '';
  return `${WEEKDAY_LABEL[weekdayOf(date)]} ${Number(date.slice(8, 10))} ${month}`;
};

/** 'December 2026' for 'YYYY-MM' */
export const formatMonth = (month: string): string =>
  `${MONTHS_LONG[Number(month.slice(5, 7)) - 1] ?? ''} ${month.slice(0, 4)}`;

/** '#12' or 'Preview' */
export const puzzleLabel = (number: number | null): string =>
  number === null ? 'Preview' : `#${number}`;

/** 'Overprint #12 · Mon 1 Dec' or 'Overprint Preview · Sun 22 Nov' */
export const dailyPostTitle = (date: string, number: number | null): string =>
  `Overprint ${puzzleLabel(number)} · ${formatShortDate(date)}`;

export type DailyPrint = Print & { number: number | null };

/** The generated daily for a date; never throws for pre-launch dates. */
export const dailyPrint = (
  date: string,
  launchDate: string = LAUNCH_DATE
): DailyPrint => ({
  ...generatePrint(date),
  number: puzzleNumber(date, launchDate),
});
