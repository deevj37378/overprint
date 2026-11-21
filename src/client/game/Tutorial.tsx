// First-ever play: a 3×3 practice print. Blue bar across, yellow bar down, see the green.
// One short hint per step; hints follow what the player actually does. Skippable.

import { useEffect } from 'react';
import { applyPlacements, type Stamp } from '../../shared/sheet';
import { isPlaced, type PlayState } from '../../shared/play';
import { Controls } from '../play/Controls';
import { Paper } from '../play/Paper';
import { Tray } from '../play/Tray';
import { usePlay, type PlayCommand } from '../play/usePlay';
import { PrintSheet } from '../ui/PrintSheet';
import { Wordmark } from '../ui/Wordmark';

const TRAY: Stamp[] = [
  { id: 'blue', shape: 'i3', ink: 'blue' },
  { id: 'yellow', shape: 'i3', ink: 'yellow' },
];

const solved = applyPlacements(3, TRAY, [
  { stampId: 'blue', row: 1, col: 0, rotation: 0 },
  { stampId: 'yellow', row: 0, col: 1, rotation: 1 },
]);
const TARGET = solved.ok ? solved.sheet : [];

type Step = { hint: string; highlight: string | null };

const stepFor = (s: PlayState): Step => {
  if (s.solvedAt !== null)
    return { hint: 'Overlaps mix — that cell turned green.', highlight: null };
  const blue = s.placed.find((p) => p.stampId === 'blue');
  if (blue && (blue.row !== 1 || blue.rotation % 2 !== 0) && !s.hand) {
    return {
      hint: 'Not quite. Tap the blue bar on the paper to lift it.',
      highlight: null,
    };
  }
  const held = s.hand?.stampId ?? null;
  if (held === 'blue') {
    if (s.hand && s.hand.rotation % 2 === 1)
      return { hint: 'Turn it back across with Rotate.', highlight: null };
    return s.ghost
      ? { hint: 'Tap the same square again to press it.', highlight: null }
      : { hint: 'Now tap the middle row of the paper.', highlight: null };
  }
  if (held === 'yellow') {
    if (s.hand && s.hand.rotation % 2 === 0)
      return { hint: 'Turn it upright with Rotate.', highlight: null };
    return s.ghost
      ? { hint: 'Tap again to press it down.', highlight: null }
      : { hint: 'Tap the middle column.', highlight: null };
  }
  if (!isPlaced(s, 'blue'))
    return { hint: 'Tap the blue stamp to pick it up.', highlight: 'blue' };
  return { hint: 'Now pick up the yellow stamp.', highlight: 'yellow' };
};

type Props = {
  colourBlind: boolean;
  onDone: (skipped: boolean) => void;
  onCommand?: (command: PlayCommand, state: PlayState) => void;
};

export const Tutorial = ({ colourBlind, onDone, onCommand }: Props) => {
  const { state, dispatch: raw } = usePlay(3, TRAY, TARGET);
  const dispatch = (command: PlayCommand) => {
    raw(command);
    onCommand?.(command, state);
  };
  const step = stepFor(state);

  useEffect(() => {
    if (state.solvedAt === null) return;
    const id = setTimeout(() => onDone(false), 2200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.solvedAt]);

  return (
    <div className="paper-grain flex min-h-dvh flex-col bg-paper text-ink">
      <header className="flex items-center justify-between px-4 pt-3">
        <Wordmark className="text-[26px]" />
        <button
          type="button"
          onClick={() => onDone(true)}
          className="min-h-11 rounded-full px-3 text-[14px] font-bold text-muted underline"
        >
          Skip
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-4 px-4 pt-3 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-[64px] shrink-0 rounded-md bg-[#fbf8f2] p-1 ring-1 ring-paper-edge">
            <PrintSheet
              size={3}
              sheet={TARGET}
              colourBlind={colourBlind}
              label="Practice proof"
            />
          </div>
          <p className="text-[15px] font-semibold leading-snug">
            Practice print. Make your paper match the proof.
          </p>
        </div>
        <Paper
          state={state}
          dispatch={dispatch}
          colourBlind={colourBlind}
          label="Practice paper"
          className="mx-auto w-full max-w-[300px]"
        />
        <p
          className="slide-up min-h-12 rounded-xl bg-riso-yellow/70 px-3 py-2.5 text-center text-[16px] font-extrabold mix-blend-multiply"
          key={step.hint}
          aria-live="polite"
        >
          {step.hint}
        </p>
        <div className="mt-auto flex flex-col gap-3">
          <Tray state={state} dispatch={dispatch} highlight={step.highlight} />
          <Controls state={state} dispatch={dispatch} />
        </div>
      </main>
    </div>
  );
};
