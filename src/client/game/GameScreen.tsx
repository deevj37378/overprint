import { useEffect, useRef, type ReactNode } from 'react';
import type { PlayState } from '../../shared/play';
import type { Sheet, Stamp } from '../../shared/sheet';
import { Controls } from '../play/Controls';
import { hintFor } from '../play/hints';
import { Paper } from '../play/Paper';
import { Tray } from '../play/Tray';
import {
  formatClock,
  useNow,
  usePlay,
  type PlayCommand,
} from '../play/usePlay';
import { PrintSheet } from '../ui/PrintSheet';
import { Wordmark } from '../ui/Wordmark';

export type GamePuzzle = {
  size: number;
  tray: readonly Stamp[];
  target: Sheet;
  /** '#12' or 'Preview' */
  label: string;
  /** 'Mon 7 Dec' */
  dateLabel: string;
  maker: string | null;
};

type Props = {
  puzzle: GamePuzzle;
  colourBlind: boolean;
  /** Header buttons (help, sound, colour-blind) rendered by the page. */
  headerTools?: ReactNode;
  /** A line above the paper (e.g. the archive notice). */
  banner?: ReactNode;
  onSolved: (state: PlayState) => void;
  onCommand?: (command: PlayCommand, state: PlayState) => void;
  /** After each stamp is pressed onto the paper. */
  onPressed?: (state: PlayState) => void;
};

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export const GameScreen = ({
  puzzle,
  colourBlind,
  headerTools,
  banner,
  onSolved,
  onCommand,
  onPressed,
}: Props) => {
  const { state, dispatch: rawDispatch } = usePlay(
    puzzle.size,
    puzzle.tray,
    puzzle.target
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const dispatch = (command: PlayCommand) => {
    rawDispatch(command);
    onCommand?.(command, stateRef.current);
  };
  const now = useNow(state);
  const running = state.solvedAt !== null;

  const pressKey = state.lastPressed
    ? `${state.lastPressed}-${state.history.length}`
    : null;
  useEffect(() => {
    if (pressKey) onPressed?.(stateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressKey]);

  // Solve → "print run" → hand over to the result screen.
  useEffect(() => {
    if (state.solvedAt === null) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const id = setTimeout(() => onSolved(state), reduced ? 250 : 1250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.solvedAt]);

  // Desktop keyboard: arrows move the ghost, R rotates, Enter/Space stamps, 1–6 pick, U undo, Esc drop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const inCell =
        target instanceof HTMLElement && target.dataset.cell !== undefined;
      const move = KEY_MOVES[event.key];
      const s = stateRef.current;
      if (move && s.hand) {
        event.preventDefault();
        dispatch({ type: 'moveGhost', dRow: move[0], dCol: move[1] });
      } else if (event.key === 'r' || event.key === 'R') {
        dispatch({ type: 'rotate' });
      } else if (
        (event.key === 'Enter' || event.key === ' ') &&
        s.ghost &&
        !inCell
      ) {
        event.preventDefault();
        dispatch({ type: 'press' });
      } else if (event.key === 'Escape') {
        dispatch({ type: 'drop' });
      } else if (
        event.key === 'u' ||
        event.key === 'U' ||
        event.key === 'Backspace'
      ) {
        dispatch({ type: 'undo' });
      } else if (/^[1-9]$/.test(event.key)) {
        const stamp = s.tray[Number(event.key) - 1];
        if (stamp) dispatch({ type: 'pick', stampId: stamp.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = hintFor(state);
  const elapsed = state.startedAt === null ? 0 : now - state.startedAt;

  return (
    <div className="paper-grain flex h-dvh flex-col overflow-hidden bg-paper text-ink lg:h-auto lg:min-h-dvh lg:overflow-visible">
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-1 lg:px-6 lg:pt-4">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <span className="hidden lg:block">
            <Wordmark className="text-2xl" />
          </span>
          <p className="truncate text-[13px] font-semibold text-muted">
            <span className="text-ink">{puzzle.label}</span> ·{' '}
            {puzzle.dateLabel}
            {puzzle.maker ? <> · printed by u/{puzzle.maker}</> : null}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[15px]" aria-live="off">
          <span className="num" aria-label={`Time ${formatClock(elapsed)}`}>
            {formatClock(elapsed)}
          </span>
          <span className="num text-muted" aria-label={`${state.lifts} lifts`}>
            ↑{state.lifts}
          </span>
        </div>
        <div className="flex items-center">{headerTools}</div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 flex-col gap-2.5 px-3 pb-[max(10px,env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:content-start lg:gap-x-8 lg:gap-y-5 lg:px-6 lg:pt-4">
        <section className="flex shrink-0 items-center gap-3 lg:order-2 lg:flex-col lg:items-stretch lg:gap-4">
          <div className="relative shrink-0 rounded-[10px] bg-[#fbf8f2] px-1.5 pt-[18px] pb-1.5 shadow-[0_1px_0_#d6cab5,0_8px_16px_-12px_rgba(60,40,20,0.5)] ring-1 ring-paper-edge lg:px-3 lg:pt-7 lg:pb-3">
            {/* The tag sits in the card's top margin, never over the print. */}
            <span className="absolute top-[3px] left-1.5 rotate-[-3deg] rounded-sm bg-riso-pink px-1.5 text-[10px] leading-[13px] font-extrabold uppercase tracking-[0.14em] text-ink lg:top-1.5 lg:left-3 lg:text-[11px] lg:leading-4">
              Proof
            </span>
            <PrintSheet
              size={puzzle.size}
              sheet={puzzle.target}
              colourBlind={colourBlind}
              label="Target print to match"
              className="w-[clamp(84px,17dvh,138px)] max-[359px]:w-[clamp(72px,15dvh,110px)] lg:w-full"
            />
          </div>
          <div className="min-w-0 flex-1 lg:flex-none">
            <p className="text-[15px] font-extrabold leading-tight lg:text-lg">
              Match the proof.
            </p>
            <p className="text-[13px] leading-snug text-muted">
              {puzzle.tray.length} stamps · {puzzle.size}×{puzzle.size} paper.
              Overlapping inks mix.
            </p>
            <p className="mt-2 hidden text-[13px] text-muted lg:block">
              Keys: 1–{puzzle.tray.length} pick · arrows move · R rotate · Enter
              stamp · U undo
            </p>
          </div>
        </section>

        <section className="relative flex min-h-0 flex-1 flex-col lg:order-1 lg:row-span-2 lg:flex-none">
          {banner}
          {/* Phone/tablet: the paper is the largest square that fits the space left over. */}
          <div className="flex min-h-0 flex-1 items-center [container-type:size] lg:block lg:flex-none lg:[container-type:normal]">
            <div className="relative mx-auto aspect-square w-[min(100cqw,100cqh)] overflow-hidden rounded-[8px] p-0.5 lg:w-full lg:max-w-[560px]">
              <div className={running ? 'print-run' : ''}>
                <Paper
                  state={state}
                  dispatch={dispatch}
                  colourBlind={colourBlind}
                />
              </div>
              {running && (
                <div
                  aria-hidden="true"
                  className="roller pointer-events-none absolute inset-x-0 top-0 h-3 rounded-full bg-gradient-to-b from-[#3a302a] to-[#120d0a] opacity-80"
                />
              )}
            </div>
          </div>
        </section>

        <section className="flex shrink-0 flex-col gap-2 lg:order-3 lg:col-start-2 lg:gap-3">
          <p
            className="min-h-5 text-center text-[13px] font-semibold text-muted"
            aria-live="polite"
          >
            {running ? 'Printed! Pulling the sheet…' : hint}
          </p>
          <Tray state={state} dispatch={dispatch} />
          <Controls state={state} dispatch={dispatch} />
        </section>
      </main>
    </div>
  );
};
