import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentSheet,
  elapsedMs,
  fitAnchor,
  ghostCells,
  initialPlay,
  playReducer,
  type PlayAction,
  type PlayState,
} from './play.ts';
import { mixColour } from './ink.ts';
import { applyPlacements, type Stamp } from './sheet.ts';
import { SHAPES } from './shapes.ts';

const tray: Stamp[] = [
  { id: 'b', shape: 'i3', ink: 'blue' },
  { id: 'y', shape: 'i3', ink: 'yellow' },
];
const solution = applyPlacements(3, tray, [
  { stampId: 'b', row: 1, col: 0, rotation: 0 },
  { stampId: 'y', row: 0, col: 1, rotation: 1 },
]);
assert.ok(solution.ok);
const target = solution.sheet;

const run = (
  actions: PlayAction[],
  start: PlayState = initialPlay(3, tray, target)
) => actions.reduce(playReducer, start);

test('pick up a stamp, tap for a ghost, tap again to press', () => {
  let s = run([{ type: 'pick', stampId: 'b', at: 1000 }]);
  assert.deepEqual(s.hand, { stampId: 'b', rotation: 0 });
  assert.equal(s.startedAt, 1000);
  s = playReducer(s, { type: 'tapCell', row: 1, col: 0, at: 1100 });
  assert.deepEqual(s.ghost, {
    anchor: { row: 1, col: 0 },
    tap: { row: 1, col: 0 },
  });
  assert.equal(s.placed.length, 0, 'ghost only, not pressed yet');
  s = playReducer(s, { type: 'tapCell', row: 1, col: 0, at: 1200 });
  assert.deepEqual(s.placed, [{ stampId: 'b', row: 1, col: 0, rotation: 0 }]);
  assert.equal(s.hand, null);
  assert.equal(s.ghost, null);
  assert.equal(s.lastPressed, 'b');
});

test('tapping a different cell moves the ghost; Stamp presses it', () => {
  const s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'tapCell', row: 0, col: 0, at: 0 },
    { type: 'tapCell', row: 2, col: 0, at: 0 },
  ]);
  assert.deepEqual(s.ghost?.anchor, { row: 2, col: 0 });
  const pressed = playReducer(s, { type: 'press', at: 0 });
  assert.deepEqual(pressed.placed[0], {
    stampId: 'b',
    row: 2,
    col: 0,
    rotation: 0,
  });
});

test('the ghost shifts to stay on the paper but still covers the tapped cell', () => {
  const s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'tapCell', row: 0, col: 2, at: 0 },
  ]);
  assert.deepEqual(s.ghost?.anchor, { row: 0, col: 0 });
  assert.ok(ghostCells(s).some((c) => c.row === 0 && c.col === 2));
  assert.equal(
    fitAnchor(3, SHAPES.i4, { row: 0, col: 0 }),
    null,
    'I4 never fits a 3×3'
  );
});

test('rotation turns the held stamp and re-fits the ghost', () => {
  const s = run([
    { type: 'pick', stampId: 'y', at: 0 },
    { type: 'tapCell', row: 0, col: 1, at: 0 },
    { type: 'rotate' },
  ]);
  assert.equal(s.hand?.rotation, 1);
  assert.deepEqual(
    ghostCells(s).map((c) => `${c.row},${c.col}`),
    ['0,1', '1,1', '2,1']
  );
  assert.equal(
    run([{ type: 'rotate' }]).hand,
    null,
    'rotate with empty hand does nothing'
  );
});

test('a full solve stops the clock and locks the board', () => {
  const s = run([
    { type: 'pick', stampId: 'b', at: 1000 },
    { type: 'tapCell', row: 1, col: 0, at: 2000 },
    { type: 'press', at: 3000 },
    { type: 'pick', stampId: 'y', at: 4000 },
    { type: 'rotate' },
    { type: 'tapCell', row: 0, col: 1, at: 5000 },
    { type: 'press', at: 9000 },
  ]);
  assert.equal(s.solvedAt, 9000);
  assert.equal(elapsedMs(s, 99_999), 8000);
  assert.equal(s.lifts, 0);
  assert.equal(mixColour(currentSheet(s)[1]?.[1] ?? 0), 'green');
  assert.equal(playReducer(s, { type: 'clear' }), s, 'locked after solving');
});

test('tapping a placed stamp lifts it into your hand and counts a lift', () => {
  let s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'tapCell', row: 1, col: 0, at: 0 },
    { type: 'press', at: 0 },
    { type: 'tapCell', row: 1, col: 2, at: 0 },
  ]);
  assert.equal(s.placed.length, 0);
  assert.deepEqual(s.hand, { stampId: 'b', rotation: 0 });
  assert.equal(s.lifts, 1);
  // Its ghost stays where it was, so tapping the same cell puts it straight back.
  s = playReducer(s, { type: 'tapCell', row: 1, col: 2, at: 0 });
  assert.deepEqual(s.placed, [{ stampId: 'b', row: 1, col: 0, rotation: 0 }]);
});

test('picking a placed stamp in the tray also lifts it', () => {
  const s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'tapCell', row: 0, col: 0, at: 0 },
    { type: 'press', at: 0 },
    { type: 'pick', stampId: 'b', at: 0 },
  ]);
  assert.equal(s.placed.length, 0);
  assert.equal(s.lifts, 1);
});

test('picking the held stamp again puts it down without a lift', () => {
  const s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'pick', stampId: 'b', at: 0 },
  ]);
  assert.equal(s.hand, null);
  assert.equal(s.lifts, 0);
});

test('undo restores the previous sheet and counts as a lift', () => {
  let s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'tapCell', row: 0, col: 0, at: 0 },
    { type: 'press', at: 0 },
    { type: 'pick', stampId: 'y', at: 0 },
    { type: 'tapCell', row: 2, col: 0, at: 0 },
    { type: 'press', at: 0 },
  ]);
  assert.equal(s.placed.length, 2);
  s = playReducer(s, { type: 'undo' });
  assert.deepEqual(
    s.placed.map((p) => p.stampId),
    ['b']
  );
  assert.equal(s.lifts, 1);
  s = playReducer(playReducer(s, { type: 'undo' }), { type: 'undo' });
  assert.equal(s.placed.length, 0);
  assert.equal(s.lifts, 2, 'undo with no history is free');
});

test('undo after a lift puts the stamp back on the paper', () => {
  const s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'tapCell', row: 0, col: 0, at: 0 },
    { type: 'press', at: 0 },
    { type: 'tapCell', row: 0, col: 0, at: 0 },
    { type: 'undo' },
  ]);
  assert.equal(s.placed.length, 1);
  assert.equal(s.hand, null);
  assert.equal(s.lifts, 2);
});

test('clear empties the sheet as one lift, and can be undone', () => {
  let s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'tapCell', row: 0, col: 0, at: 0 },
    { type: 'press', at: 0 },
    { type: 'clear' },
  ]);
  assert.equal(s.placed.length, 0);
  assert.equal(s.lifts, 1);
  assert.equal(
    playReducer(s, { type: 'clear' }).lifts,
    1,
    'clearing blank paper is free'
  );
  s = playReducer(s, { type: 'undo' });
  assert.equal(s.placed.length, 1);
});

test('keyboard ghost movement stays on the paper', () => {
  let s = run([
    { type: 'pick', stampId: 'b', at: 0 },
    { type: 'moveGhost', dRow: 0, dCol: 1 },
  ]);
  assert.ok(s.ghost, 'first arrow shows the ghost');
  s = playReducer(s, { type: 'moveGhost', dRow: 0, dCol: 1 });
  assert.equal(s.ghost?.anchor.col, 0, 'I3 on a 3×3 cannot move right');
  s = playReducer(s, { type: 'moveGhost', dRow: 1, dCol: 0 });
  assert.equal(s.ghost?.anchor.row, 2);
});

test('unknown stamps and empty taps are ignored', () => {
  const start = initialPlay(3, tray, target);
  assert.equal(
    playReducer(start, { type: 'pick', stampId: 'nope', at: 0 }),
    start
  );
  assert.equal(
    playReducer(start, { type: 'tapCell', row: 1, col: 1, at: 0 }),
    start
  );
  assert.equal(elapsedMs(start, 5000), 0);
});
