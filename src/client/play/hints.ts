import type { PlayState } from '../../shared/play';

export const hintFor = (state: PlayState): string => {
  if (state.solvedAt !== null) return '';
  if (state.hand && state.ghost)
    return 'Tap the same square again — or Stamp — to press it';
  if (state.hand) return 'Now tap the paper where it should go';
  if (state.placed.length === 0) return 'Tap a stamp to pick it up';
  return 'Tap a printed stamp to lift it back up';
};
