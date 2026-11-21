import type { ReactNode } from 'react';
import type { MeResponse, PuzzleView, SolveResult } from '../../shared/api';
import { formatClock } from '../play/usePlay';

type Props = {
  puzzle: PuzzleView;
  me: MeResponse;
  result: SolveResult | null;
  submitError: string | null;
  colourBlind: boolean;
  headerTools?: ReactNode;
  onRetrySubmit: () => void;
  onReplay: () => void;
};

/** Phase 3 placeholder; the full result card arrives in Phase 4. */
export const ResultView = ({ me, result, submitError, onReplay }: Props) => {
  const summary = result ?? me.solve;
  return (
    <main className="paper-grain flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper p-6 text-center">
      <p className="text-4xl font-extrabold">Printed!</p>
      {summary && (
        <p className="num text-lg">
          {formatClock(summary.timeMs)} · {summary.lifts} lifts{' '}
          {summary.clean ? '· ✦ clean print' : ''}
        </p>
      )}
      {submitError && (
        <p className="text-[15px] font-semibold">{submitError}</p>
      )}
      <button
        type="button"
        onClick={onReplay}
        className="min-h-12 rounded-full border-2 border-ink px-5 font-bold"
      >
        Play again (not counted)
      </button>
    </main>
  );
};
