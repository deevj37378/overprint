import { currentSheet, type PlayState } from '../../shared/play';

/** How many squares of the paper don't match the proof yet. */
export const differingCells = (state: PlayState): number => {
  if (!state.target) return 0;
  const sheet = currentSheet(state);
  let n = 0;
  state.target.forEach((line, r) =>
    line.forEach((set, c) => {
      if (sheet[r]?.[c] !== set) n++;
    })
  );
  return n;
};

export const hintFor = (state: PlayState): string => {
  if (state.solvedAt !== null) return '';
  if (state.hand && state.ghost)
    return 'Tap the same square again — or Stamp — to press it';
  if (state.hand) return 'Now tap the paper where it should go';
  if (state.placed.length === 0) return 'Tap a stamp to pick it up';
  const off = differingCells(state);
  if (off > 0) {
    return `${off} ${off === 1 ? 'square differs' : 'squares differ'} from the proof · tap a print to lift it`;
  }
  return 'Tap a printed stamp to lift it back up';
};
