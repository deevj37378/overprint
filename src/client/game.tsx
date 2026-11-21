import './index.css';

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  dailyPrint,
  formatShortDate,
  puzzleLabel,
  utcDateOf,
} from '../shared/daily';
import { GameScreen, type GamePuzzle } from './game/GameScreen';
import { formatClock } from './play/usePlay';

// Phase 2: the puzzle is generated on the client. Phase 3 moves it behind the server.
const today = utcDateOf(Date.now());
const print = dailyPrint(today);
const puzzle: GamePuzzle = {
  size: print.size,
  tray: print.tray,
  target: print.target,
  label: puzzleLabel(print.number),
  dateLabel: formatShortDate(today),
  maker: null,
};

export const App = () => {
  const [result, setResult] = useState<{
    timeMs: number;
    lifts: number;
  } | null>(null);
  if (result) {
    return (
      <main className="paper-grain flex min-h-dvh flex-col items-center justify-center gap-2 bg-paper p-6 text-center">
        <p className="text-4xl font-extrabold">Printed!</p>
        <p className="num text-lg">
          {formatClock(result.timeMs)} · {result.lifts} lifts{' '}
          {result.lifts === 0 ? '· ✦ clean print' : ''}
        </p>
      </main>
    );
  }
  return (
    <GameScreen
      puzzle={puzzle}
      colourBlind={false}
      onSolved={(state) =>
        setResult({
          timeMs: (state.solvedAt ?? 0) - (state.startedAt ?? 0),
          lifts: state.lifts,
        })
      }
    />
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
