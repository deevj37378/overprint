import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyPostTitle,
  dailyPrint,
  formatMonth,
  formatShortDate,
  LAUNCH_DATE,
  puzzleLabel,
  puzzleNumber,
  utcDateOf,
} from './daily.ts';
import { generateDailyPuzzle } from './puzzle.ts';

test('puzzle numbers start at 1 on launch day; earlier dates are previews', () => {
  assert.equal(LAUNCH_DATE, '2026-12-01');
  assert.equal(puzzleNumber('2026-12-01'), 1);
  assert.equal(puzzleNumber('2026-12-31'), 31);
  assert.equal(puzzleNumber('2027-12-01'), 366);
  assert.equal(puzzleNumber('2026-11-30'), null);
  assert.equal(puzzleLabel(null), 'Preview');
  assert.equal(puzzleLabel(7), '#7');
});

test('titles match the spec format', () => {
  assert.equal(formatShortDate('2026-12-01'), 'Tue 1 Dec');
  assert.equal(dailyPostTitle('2026-12-07', 7), 'Overprint #7 · Mon 7 Dec');
  assert.equal(
    dailyPostTitle('2026-11-22', null),
    'Overprint Preview · Sun 22 Nov'
  );
  assert.equal(formatMonth('2026-12'), 'December 2026');
});

test('utcDateOf uses UTC, not local time', () => {
  assert.equal(utcDateOf(Date.UTC(2026, 11, 1, 23, 59, 59)), '2026-12-01');
  assert.equal(utcDateOf(Date.UTC(2026, 11, 2, 0, 0, 0)), '2026-12-02');
});

test('dailyPrint never throws before launch and matches the generator after', () => {
  const preview = dailyPrint('2026-11-22');
  assert.equal(preview.number, null);
  assert.ok(preview.tray.length > 0);
  const launched = dailyPrint('2026-12-09');
  assert.deepEqual(launched, generateDailyPuzzle('2026-12-09', LAUNCH_DATE));
});
