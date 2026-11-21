import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentStreak,
  dayBit,
  decodeYear,
  flairText,
  streakDay,
} from './streak.ts';

const playedOn = (...dates: string[]) => {
  const set = new Set(dates);
  return (date: string) => set.has(date);
};

test('no plays → no streak', () => {
  assert.equal(currentStreak(playedOn(), '2026-12-10'), 0);
});

test('today counts; if today is not played yet, yesterday keeps the streak alive', () => {
  assert.equal(currentStreak(playedOn('2026-12-10'), '2026-12-10'), 1);
  assert.equal(currentStreak(playedOn('2026-12-09'), '2026-12-10'), 1);
  assert.equal(
    currentStreak(
      playedOn('2026-12-08', '2026-12-09', '2026-12-10'),
      '2026-12-10'
    ),
    3
  );
  assert.equal(
    currentStreak(playedOn('2026-12-08', '2026-12-09'), '2026-12-10'),
    2
  );
});

test('a gap breaks the streak', () => {
  assert.equal(
    currentStreak(
      playedOn('2026-12-07', '2026-12-09', '2026-12-10'),
      '2026-12-10'
    ),
    2
  );
  assert.equal(
    currentStreak(playedOn('2026-12-07', '2026-12-08'), '2026-12-10'),
    0
  );
});

test('streaks run across New Year', () => {
  assert.equal(
    currentStreak(
      playedOn('2026-12-30', '2026-12-31', '2027-01-01'),
      '2027-01-01'
    ),
    3
  );
  assert.deepEqual(dayBit('2027-01-01'), { year: 2027, index: 0 });
  assert.deepEqual(
    dayBit('2028-12-31'),
    { year: 2028, index: 365 },
    'leap year'
  );
});

test('the same day twice is still one day', () => {
  assert.equal(
    currentStreak(playedOn('2026-12-10', '2026-12-10'), '2026-12-10'),
    1
  );
});

test('decodeYear reads MSB-first u32 chunks', () => {
  // bit 0 and bit 33 set
  const chunks = [2 ** 31, 2 ** 30];
  assert.deepEqual(
    [...decodeYear(chunks)].sort((a, b) => a - b),
    [0, 33]
  );
  assert.equal(decodeYear([0, 0]).size, 0);
  assert.equal(decodeYear([2 ** 32 - 1]).size, 32);
});

test('streak day: today counts, archive does not, short grace after midnight', () => {
  const at = (iso: string) => Date.parse(iso);
  assert.equal(
    streakDay('2026-12-10', at('2026-12-10T12:00:00Z')),
    '2026-12-10'
  );
  assert.equal(
    streakDay('2026-12-09', at('2026-12-10T00:05:00Z')),
    '2026-12-09'
  );
  assert.equal(streakDay('2026-12-09', at('2026-12-10T01:00:00Z')), null);
  assert.equal(streakDay('2026-12-01', at('2026-12-10T12:00:00Z')), null);
  assert.equal(
    streakDay('2026-12-11', at('2026-12-10T12:00:00Z')),
    null,
    'future posts never count'
  );
});

test('flair text', () => {
  assert.equal(flairText(0, false), '');
  assert.equal(flairText(7, false), '🖨 7-day streak');
  assert.equal(flairText(30, false), '✦ Master Printer');
  assert.equal(flairText(3, true), '🖨 3-day streak · 🎨 Featured Printer');
});
