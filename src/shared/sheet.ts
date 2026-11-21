// Sheets (the paper grid), stamps and placements.

import {
  addInk,
  EMPTY,
  inkCount,
  toEmoji,
  type Ink,
  type InkSet,
} from './ink.ts';
import {
  fitsOnSheet,
  ROTATIONS,
  shapeCells,
  type Rotation,
  type ShapeId,
} from './shapes.ts';

/** Rows of cells, top row first. sheet[row][col]. */
export type Sheet = readonly (readonly InkSet[])[];

export type Stamp = {
  readonly id: string;
  readonly shape: ShapeId;
  readonly ink: Ink;
};

/** A stamp pressed on the sheet: its anchor (top-left filled cell) lands on (row, col). */
export type Placement = {
  readonly stampId: string;
  readonly row: number;
  readonly col: number;
  readonly rotation: Rotation;
};

export type PlacementError =
  'unknown-stamp' | 'duplicate-stamp' | 'bad-rotation' | 'out-of-bounds';

export type ApplyResult =
  | { ok: true; sheet: Sheet }
  | { ok: false; error: PlacementError; stampId: string };

export const emptySheet = (size: number): InkSet[][] =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY));

/**
 * Press every placement onto a blank size×size sheet.
 * Fails if a stamp id is not in the tray, a stamp is used twice, a rotation is invalid,
 * or any part of a stamp falls off the paper.
 */
export const applyPlacements = (
  size: number,
  tray: readonly Stamp[],
  placements: readonly Placement[]
): ApplyResult => {
  const sheet = emptySheet(size);
  const used = new Set<string>();

  for (const placement of placements) {
    const { stampId } = placement;
    const stamp = tray.find((s) => s.id === stampId);
    if (!stamp) return { ok: false, error: 'unknown-stamp', stampId };
    if (used.has(stampId))
      return { ok: false, error: 'duplicate-stamp', stampId };
    used.add(stampId);
    if (!ROTATIONS.includes(placement.rotation)) {
      return { ok: false, error: 'bad-rotation', stampId };
    }

    const cells = shapeCells(stamp.shape, placement.rotation);
    if (!fitsOnSheet(size, cells, placement.row, placement.col)) {
      return { ok: false, error: 'out-of-bounds', stampId };
    }

    for (const cell of cells) {
      const line = sheet[placement.row + cell.row];
      const col = placement.col + cell.col;
      const current = line?.[col];
      if (line === undefined || current === undefined) {
        return { ok: false, error: 'out-of-bounds', stampId };
      }
      line[col] = addInk(current, stamp.ink);
    }
  }

  return { ok: true, sheet };
};

export const sheetsEqual = (a: Sheet, b: Sheet): boolean =>
  a.length === b.length &&
  a.every((line, r) => {
    const other = b[r];
    return (
      other !== undefined &&
      line.length === other.length &&
      line.every((set, c) => set === other[c])
    );
  });

export const countCells = (
  sheet: Sheet,
  test: (set: InkSet) => boolean
): number => sheet.reduce((sum, line) => sum + line.filter(test).length, 0);

export const countInked = (sheet: Sheet): number =>
  countCells(sheet, (set) => set !== EMPTY);

export const countMixed = (sheet: Sheet): number =>
  countCells(sheet, (set) => inkCount(set) >= 2);

export const sheetToEmoji = (sheet: Sheet): string =>
  sheet.map((line) => line.map(toEmoji).join('')).join('\n');
