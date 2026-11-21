// Polyomino stamp shapes and rotation.
//
// A shape is a list of cells relative to its anchor. Shapes are always normalised so the
// anchor is the top-left filled cell (first filled cell in row-major order) at (0, 0).
// Other cells may therefore have negative columns (e.g. a T pointing up).

export type Cell = { readonly row: number; readonly col: number };

export type Shape = readonly Cell[];

export type ShapeId =
  'domino' | 'i3' | 'l3' | 'i4' | 'l4' | 't4' | 's4' | 'o4' | 'p5' | 'plus';

export type Rotation = 0 | 1 | 2 | 3;

export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

const byRowMajor = (a: Cell, b: Cell): number => a.row - b.row || a.col - b.col;

export const normalise = (cells: readonly Cell[]): Shape => {
  const sorted = [...cells].sort(byRowMajor);
  const anchor = sorted[0];
  if (!anchor) return [];
  // `+ 0` turns -0 into 0 so equality checks stay simple.
  return sorted.map((cell) => ({
    row: cell.row - anchor.row + 0,
    col: cell.col - anchor.col + 0,
  }));
};

/** Draw a shape as rows of '#' and '.', top-left first. Handy for definitions and tests. */
const fromPicture = (rows: readonly string[]): Shape => {
  const cells: Cell[] = [];
  rows.forEach((line, row) => {
    [...line].forEach((char, col) => {
      if (char === '#') cells.push({ row, col });
    });
  });
  return normalise(cells);
};

export const SHAPES: Record<ShapeId, Shape> = {
  domino: fromPicture(['##']),
  i3: fromPicture(['###']),
  l3: fromPicture(['#.', '##']),
  i4: fromPicture(['####']),
  l4: fromPicture(['#.', '#.', '##']),
  t4: fromPicture(['###', '.#.']),
  s4: fromPicture(['.##', '##.']),
  o4: fromPicture(['##', '##']),
  p5: fromPicture(['##', '##', '#.']),
  plus: fromPicture(['.#.', '###', '.#.']),
};

export const SHAPE_IDS: readonly ShapeId[] = [
  'domino',
  'i3',
  'l3',
  'i4',
  'l4',
  't4',
  's4',
  'o4',
  'p5',
  'plus',
];

/** Rotate clockwise by `quarterTurns` (any integer, negative = anticlockwise). */
export const rotate = (shape: Shape, quarterTurns: number): Shape => {
  const turns = ((quarterTurns % 4) + 4) % 4;
  let cells: readonly Cell[] = shape;
  for (let i = 0; i < turns; i++) {
    // Clockwise on screen (rows grow downward): (row, col) → (col, -row).
    cells = cells.map(({ row, col }) => ({ row: col, col: -row }));
  }
  return normalise(cells);
};

export const shapeCells = (id: ShapeId, rotation: Rotation): Shape =>
  rotate(SHAPES[id], rotation);

export const shapesEqual = (a: Shape, b: Shape): boolean => {
  if (a.length !== b.length) return false;
  const na = normalise(a);
  const nb = normalise(b);
  return na.every((cell, i) => {
    const other = nb[i];
    return (
      other !== undefined && cell.row === other.row && cell.col === other.col
    );
  });
};

export type Bounds = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

export const shapeBounds = (shape: Shape): Bounds => ({
  minRow: Math.min(...shape.map((c) => c.row)),
  maxRow: Math.max(...shape.map((c) => c.row)),
  minCol: Math.min(...shape.map((c) => c.col)),
  maxCol: Math.max(...shape.map((c) => c.col)),
});

/** Is the shape, anchored at (row, col), fully on a size×size sheet? */
export const fitsOnSheet = (
  size: number,
  shape: Shape,
  row: number,
  col: number
): boolean =>
  Number.isInteger(row) &&
  Number.isInteger(col) &&
  shape.every((cell) => {
    const r = row + cell.row;
    const c = col + cell.col;
    return r >= 0 && r < size && c >= 0 && c < size;
  });
