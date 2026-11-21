import type { PuzzleView } from '../../shared/api';
import { formatShortDate, puzzleLabel } from '../../shared/labels';
import type { GamePuzzle } from './GameScreen';

export const toGamePuzzle = (p: PuzzleView): GamePuzzle => ({
  size: p.size,
  tray: p.tray,
  target: p.target,
  label: p.kind === 'community' ? p.title : puzzleLabel(p.number),
  dateLabel:
    p.kind === 'community' ? 'Community print' : formatShortDate(p.date),
  maker: p.maker,
});
