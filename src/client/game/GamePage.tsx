import { showLoginPrompt } from '@devvit/web/client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { MeResponse, PuzzleView, SolveResult } from '../../shared/api';
import type { PlayState } from '../../shared/play';
import { api, ApiError } from '../lib/api';
import type { PlayCommand } from '../play/usePlay';
import { Inking, Jammed } from '../ui/Status';
import { GameScreen } from './GameScreen';
import { toGamePuzzle } from './puzzleAdapter';
import { ResultView } from './ResultView';

type Loaded = { puzzle: PuzzleView; me: MeResponse };

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'playing' }
  | { kind: 'submitting'; state: PlayState }
  | { kind: 'result'; result: SolveResult | null; submitError: string | null };

type Props = {
  colourBlind: boolean;
  headerTools?: ReactNode;
  onLoaded?: (loaded: Loaded) => void;
  onCommand?: (command: PlayCommand, state: PlayState) => void;
  onPressed?: (state: PlayState) => void;
  onSolvedLocally?: (state: PlayState) => void;
  onResult?: (result: SolveResult) => void;
  /** Rendered instead of the puzzle before play (e.g. the first-time tutorial). */
  intro?: (loaded: Loaded, done: () => void) => ReactNode;
};

export const GamePage = ({
  colourBlind,
  headerTools,
  onLoaded,
  onCommand,
  onPressed,
  onSolvedLocally,
  onResult,
  intro,
}: Props) => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [replay, setReplay] = useState(0);
  const [introDone, setIntroDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const [puzzle, me] = await Promise.all([api.puzzle(), api.me()]);
      const next = { puzzle: puzzle.puzzle, me };
      setLoaded(next);
      onLoaded?.(next);
      setPhase(
        me.solve
          ? { kind: 'result', result: null, submitError: null }
          : { kind: 'playing' }
      );
    } catch (error) {
      setPhase({
        kind: 'error',
        message:
          error instanceof ApiError ? error.message : 'The press jammed.',
      });
    }
  }, [onLoaded]);

  useEffect(() => {
    // Async load: every setState happens after the awaited fetches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const retry = () => {
    setPhase({ kind: 'loading' });
    void load();
  };

  const submit = useCallback(
    async (state: PlayState) => {
      setPhase({ kind: 'submitting', state });
      try {
        const result = await api.solve({
          placements: state.placed,
          timeMs: (state.solvedAt ?? 0) - (state.startedAt ?? 0),
          lifts: state.lifts,
        });
        onResult?.(result);
        setPhase({ kind: 'result', result, submitError: null });
      } catch (error) {
        setPhase({
          kind: 'result',
          result: null,
          submitError:
            error instanceof ApiError
              ? error.message
              : 'Could not save your print.',
        });
      }
    },
    [onResult]
  );

  if (phase.kind === 'loading') return <Inking />;
  if (phase.kind === 'error' || !loaded) {
    return (
      <Jammed
        message={phase.kind === 'error' ? phase.message : 'The press jammed.'}
        onRetry={retry}
      />
    );
  }
  if (intro && !introDone && phase.kind === 'playing') {
    return <>{intro(loaded, () => setIntroDone(true))}</>;
  }
  if (phase.kind === 'submitting')
    return <Inking text="Pulling your print off the press…" />;
  if (phase.kind === 'result') {
    return (
      <ResultView
        puzzle={loaded.puzzle}
        me={loaded.me}
        result={phase.result}
        submitError={phase.submitError}
        colourBlind={colourBlind}
        headerTools={headerTools}
        onRetrySubmit={() => setPhase({ kind: 'playing' })}
        onReplay={() => {
          setReplay((n) => n + 1);
          setPhase({ kind: 'playing' });
        }}
      />
    );
  }

  const { puzzle, me } = loaded;
  const banner = puzzle.isArchive ? (
    <p className="mb-2 rounded-lg bg-riso-yellow/60 px-3 py-1.5 text-center text-[13px] font-semibold">
      From the archive · doesn’t affect your streak
    </p>
  ) : !me.loggedIn ? (
    <p className="mb-2 text-center text-[13px] text-muted">
      Playing logged out ·{' '}
      <button
        type="button"
        className="font-semibold underline"
        onClick={() => showLoginPrompt()}
      >
        log in to keep your streak
      </button>
    </p>
  ) : null;

  return (
    <GameScreen
      key={replay}
      puzzle={toGamePuzzle(puzzle)}
      colourBlind={colourBlind}
      headerTools={headerTools}
      banner={banner}
      onCommand={(command, state) => {
        if (command.type === 'pick' && state.startedAt === null)
          void api.start().catch(() => {});
        onCommand?.(command, state);
      }}
      {...(onPressed ? { onPressed } : {})}
      onSolved={(state) => {
        onSolvedLocally?.(state);
        void submit(state);
      }}
    />
  );
};
