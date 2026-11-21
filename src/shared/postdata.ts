// Post data attached to every Overprint post (≤2 KB). The inline splash renders straight from
// it, so the feed view never waits on the network for the title, number or preview.

import type { PuzzleKind } from './api.ts';
import { EMPTY, type InkSet } from './ink.ts';
import type { Sheet } from './sheet.ts';

export type OverprintPostData = {
  kind: PuzzleKind;
  date: string;
  number: number | null;
  size: number;
  /** Target as one digit (0–7 ink-set bitmask) per cell, row by row. */
  target: string;
  title: string;
  maker: string | null;
  printId: string | null;
};

const INK_SETS: readonly InkSet[] = [0, 1, 2, 3, 4, 5, 6, 7];

export const encodeTarget = (sheet: Sheet): string =>
  sheet.map((line) => line.join('')).join('');

export const decodeTarget = (text: string, size: number): Sheet =>
  Array.from({ length: size }, (_, row) =>
    Array.from(
      { length: size },
      (_, col) => INK_SETS[Number(text[row * size + col])] ?? EMPTY
    )
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read untrusted post data back into our shape, or null if it isn't one of ours. */
export const parsePostData = (value: unknown): OverprintPostData | null => {
  if (!isRecord(value)) return null;
  const { kind, date, number, size, target, title, maker, printId } = value;
  if (kind !== 'daily' && kind !== 'community') return null;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return null;
  if (typeof size !== 'number' || size < 3 || size > 9) return null;
  if (
    typeof target !== 'string' ||
    !/^[0-7]+$/.test(target) ||
    target.length !== size * size
  ) {
    return null;
  }
  return {
    kind,
    date,
    number: typeof number === 'number' ? number : null,
    size,
    target,
    title: typeof title === 'string' ? title : 'Overprint',
    maker: typeof maker === 'string' ? maker : null,
    printId: typeof printId === 'string' ? printId : null,
  };
};

/** Storage key for a post's puzzle: the date for dailies, `print-{id}` for community prints. */
export const puzzleKey = (
  data: Pick<OverprintPostData, 'kind' | 'date' | 'printId'>
): string =>
  data.kind === 'community' && data.printId
    ? `print-${data.printId}`
    : data.date;
