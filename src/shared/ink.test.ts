import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addInk,
  EMPTY,
  inkSetOf,
  inksOf,
  isMixed,
  mixColour,
  toEmoji,
  type Ink,
} from './ink.ts';

test('mixing table matches the spec', () => {
  const cases: [Ink[], string, string][] = [
    [[], 'empty', '⬜'],
    [['blue'], 'blue', '🟦'],
    [['pink'], 'pink', '🟥'],
    [['yellow'], 'yellow', '🟨'],
    [['blue', 'yellow'], 'green', '🟩'],
    [['pink', 'yellow'], 'orange', '🟧'],
    [['blue', 'pink'], 'purple', '🟪'],
    [['blue', 'pink', 'yellow'], 'black', '🟫'],
  ];
  for (const [inks, colour, emoji] of cases) {
    const set = inkSetOf(inks);
    assert.equal(mixColour(set), colour, inks.join('+'));
    assert.equal(toEmoji(set), emoji, inks.join('+'));
  }
});

test('mixing is order-independent', () => {
  assert.equal(inkSetOf(['yellow', 'blue']), inkSetOf(['blue', 'yellow']));
  assert.equal(
    inkSetOf(['yellow', 'pink', 'blue']),
    inkSetOf(['blue', 'pink', 'yellow'])
  );
});

test('the same ink twice adds nothing (sets, not counts)', () => {
  const once = addInk(EMPTY, 'pink');
  assert.equal(addInk(once, 'pink'), once);
  assert.equal(
    mixColour(inkSetOf(['blue', 'blue', 'yellow', 'yellow'])),
    'green'
  );
});

test('inksOf and isMixed', () => {
  assert.deepEqual(inksOf(inkSetOf(['yellow', 'blue'])), ['blue', 'yellow']);
  assert.equal(isMixed(inkSetOf(['blue'])), false);
  assert.equal(isMixed(inkSetOf(['blue', 'pink'])), true);
});
