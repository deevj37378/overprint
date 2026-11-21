import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixColour } from './ink.ts';
import {
  applyPlacements,
  countInked,
  countMixed,
  sheetToEmoji,
  type Stamp,
} from './sheet.ts';

const tray: Stamp[] = [
  { id: 'a', shape: 'i3', ink: 'blue' },
  { id: 'b', shape: 'i3', ink: 'yellow' },
  { id: 'c', shape: 'domino', ink: 'blue' },
];

test('overlapping stamps mix ink (the tutorial print)', () => {
  const result = applyPlacements(3, tray, [
    { stampId: 'a', row: 1, col: 0, rotation: 0 }, // blue bar across the middle
    { stampId: 'b', row: 0, col: 1, rotation: 1 }, // yellow bar down the middle
  ]);
  assert.ok(result.ok);
  const colours = result.sheet.map((line) => line.map(mixColour));
  assert.deepEqual(colours, [
    ['empty', 'yellow', 'empty'],
    ['blue', 'green', 'blue'],
    ['empty', 'yellow', 'empty'],
  ]);
  assert.equal(countInked(result.sheet), 5);
  assert.equal(countMixed(result.sheet), 1);
  assert.equal(sheetToEmoji(result.sheet), '⬜🟨⬜\n🟦🟩🟦\n⬜🟨⬜');
});

test('same ink overlapping stays the same colour', () => {
  const result = applyPlacements(3, tray, [
    { stampId: 'a', row: 0, col: 0, rotation: 0 },
    { stampId: 'c', row: 0, col: 1, rotation: 0 },
  ]);
  assert.ok(result.ok);
  assert.deepEqual(result.sheet[0]?.map(mixColour), ['blue', 'blue', 'blue']);
});

test('bounds: stamps must sit fully on the paper', () => {
  const offRight = applyPlacements(3, tray, [
    { stampId: 'a', row: 0, col: 1, rotation: 0 },
  ]);
  assert.deepEqual(offRight, {
    ok: false,
    error: 'out-of-bounds',
    stampId: 'a',
  });
  const offBottom = applyPlacements(3, tray, [
    { stampId: 'a', row: 1, col: 0, rotation: 1 },
  ]);
  assert.equal(offBottom.ok, false);
  const negative = applyPlacements(3, tray, [
    { stampId: 'c', row: -1, col: 0, rotation: 0 },
  ]);
  assert.equal(negative.ok, false);
});

test('unknown and reused stamps are rejected', () => {
  assert.deepEqual(
    applyPlacements(3, tray, [{ stampId: 'zzz', row: 0, col: 0, rotation: 0 }]),
    {
      ok: false,
      error: 'unknown-stamp',
      stampId: 'zzz',
    }
  );
  assert.deepEqual(
    applyPlacements(3, tray, [
      { stampId: 'c', row: 0, col: 0, rotation: 0 },
      { stampId: 'c', row: 2, col: 0, rotation: 0 },
    ]),
    { ok: false, error: 'duplicate-stamp', stampId: 'c' }
  );
});

test('no placements gives blank paper', () => {
  const result = applyPlacements(5, tray, []);
  assert.ok(result.ok);
  assert.equal(countInked(result.sheet), 0);
  assert.equal(result.sheet.length, 5);
});
