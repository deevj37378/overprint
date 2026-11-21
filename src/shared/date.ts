// UTC calendar helpers for 'YYYY-MM-DD' strings. Never uses the device's local time zone.

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const WEEKDAYS: readonly Weekday[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

const DAY_MS = 86_400_000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 (UTC) for a valid 'YYYY-MM-DD'. Throws otherwise. */
export const parseIsoDate = (date: string): number => {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${date}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`Not a real calendar date: "${date}"`);
  }
  return ms / DAY_MS;
};

export const isoDateFromDayNumber = (dayNumber: number): string =>
  new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string =>
  isoDateFromDayNumber(parseIsoDate(date) + days);

export const daysBetween = (from: string, to: string): number =>
  parseIsoDate(to) - parseIsoDate(from);

export const weekdayOf = (date: string): Weekday => {
  const index = new Date(parseIsoDate(date) * DAY_MS).getUTCDay();
  const weekday = WEEKDAYS[index];
  if (weekday === undefined) throw new RangeError(`Bad weekday index ${index}`);
  return weekday;
};

/** ISO-8601 week, e.g. '2026-W49' (weeks start Monday; week 1 contains the first Thursday). */
export const isoWeek = (date: string): string => {
  const day = parseIsoDate(date);
  const weekday = (new Date(day * DAY_MS).getUTCDay() + 6) % 7; // Mon = 0
  const thursday = day - weekday + 3;
  const year = new Date(thursday * DAY_MS).getUTCFullYear();
  const firstThursdayDay = parseIsoDate(`${year}-01-04`);
  const firstWeekday =
    (new Date(firstThursdayDay * DAY_MS).getUTCDay() + 6) % 7;
  const week1Monday = firstThursdayDay - firstWeekday;
  const week = Math.floor((thursday - 3 - week1Monday) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
};
