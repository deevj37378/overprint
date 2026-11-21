import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitsOnSheet,
  normalise,
  rotate,
  SHAPE_IDS,
  SHAPES,
  shapesEqual,
} from './shapes.ts';

const SIZES = {
  domino: 2,
  i3: 3,
  l3: 3,
  i4: 4,
  l4: 4,
  t4: 4,
  s4: 4,
  o4: 4,
  p5: 5,
  plus: 5,
};

test('every shape in the pool has the right number of cells', () => {
  for (const id of SHAPE_IDS) assert.equal(SHAPES[id].length, SIZES[id], id);
  assert.equal(SHAPE_IDS.length, Object.keys(SHAPES).length);
});

test('shapes are anchored at their top-left filled cell', () => {
  for (const id of SHAPE_IDS) {
    for (let turns = 0; turns < 4; turns++) {
      const shape = rotate(SHAPES[id], turns);
      assert.deepEqual(shape[0], { row: 0, col: 0 }, `${id} r${turns}`);
      assert.ok(
        shape.every((c) => c.row >= 0),
        `${id} r${turns} has no cells above anchor`
      );
      assert.ok(
        shape.every((c) => c.row > 0 || c.col >= 0),
        `${id} r${turns} has no cells left of anchor on its row`
      );
    }
  }
});

test('four quarter turns are the identity', () => {
  for (const id of SHAPE_IDS) {
    assert.deepEqual(rotate(SHAPES[id], 4), SHAPES[id], id);
    assert.deepEqual(
      rotate(rotate(rotate(rotate(SHAPES[id], 1), 1), 1), 1),
      SHAPES[id],
      id
    );
    assert.deepEqual(rotate(SHAPES[id], -1), rotate(SHAPES[id], 3), id);
  }
});

test('rotation turns clockwise', () => {
  // ### horizontal → vertical
  assert.deepEqual(rotate(SHAPES.i3, 1), [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
  ]);
  // #.      ##
  // ##  →   #.
  assert.deepEqual(rotate(SHAPES.l3, 1), [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
  ]);
  // T pointing down, turned twice, points up: anchor is the top nub, so cells go left.
  assert.deepEqual(rotate(SHAPES.t4, 2), [
    { row: 0, col: 0 },
    { row: 1, col: -1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ]);
});

test('symmetric shapes and rotation counts', () => {
  const distinct = (id: keyof typeof SHAPES) => {
    const seen: ReturnType<typeof rotate>[] = [];
    for (let t = 0; t < 4; t++) {
      const s = rotate(SHAPES[id], t);
      if (!seen.some((o) => shapesEqual(o, s))) seen.push(s);
    }
    return seen.length;
  };
  assert.equal(distinct('o4'), 1);
  assert.equal(distinct('plus'), 1);
  assert.equal(distinct('i4'), 2);
  assert.equal(distinct('s4'), 2);
  assert.equal(distinct('l4'), 4);
  assert.equal(distinct('p5'), 4);
});

test('normalise is idempotent and handles -0', () => {
  const shape = normalise([
    { row: 3, col: 5 },
    { row: 2, col: 7 },
  ]);
  assert.deepEqual(shape, [
    { row: 0, col: 0 },
    { row: 1, col: -2 },
  ]);
  assert.deepEqual(normalise(shape), shape);
  assert.ok(Object.is(rotate(SHAPES.domino, 1)[0]?.col, 0));
});

test('fitsOnSheet checks every cell against the edges', () => {
  const i4 = SHAPES.i4;
  assert.equal(fitsOnSheet(5, i4, 0, 0), true);
  assert.equal(fitsOnSheet(5, i4, 4, 1), true);
  assert.equal(fitsOnSheet(5, i4, 0, 2), false); // runs off the right edge
  assert.equal(fitsOnSheet(5, i4, 5, 0), false); // below the sheet
  assert.equal(fitsOnSheet(5, i4, -1, 0), false); // above the sheet
  const tUp = rotate(SHAPES.t4, 2);
  assert.equal(fitsOnSheet(5, tUp, 0, 0), false); // left arm at col -1
  assert.equal(fitsOnSheet(5, tUp, 0, 1), true);
  assert.equal(fitsOnSheet(5, i4, 0.5, 0), false); // non-integer
});
