// The "?" sheet: the ink-mixing legend and the four rules, in as few words as possible.

import { useEffect, useRef } from 'react';
import type { Ink } from '../../shared/ink';
import { inkSetOf } from '../../shared/ink';
import { CloseIcon } from './Icons';
import { PrintSheet } from './PrintSheet';

type Props = {
  colourBlind: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
};

const MIXES: { inks: Ink[]; name: string }[] = [
  { inks: ['blue', 'yellow'], name: 'green' },
  { inks: ['pink', 'yellow'], name: 'orange' },
  { inks: ['blue', 'pink'], name: 'purple' },
  { inks: ['blue', 'pink', 'yellow'], name: 'ink black' },
];

/** Two (or three) real ink cells overlapping, drawn by the same riso renderer as the game. */
const Mix = ({ inks, colourBlind }: { inks: Ink[]; colourBlind: boolean }) => {
  const sheet = [inks.map((ink) => inkSetOf([ink])).concat([inkSetOf(inks)])];
  const width = sheet[0]?.length ?? 1;
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {inks.map((ink, i) => (
        <span key={ink} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[13px] font-bold text-muted">+</span>}
          <PrintSheet
            size={1}
            sheet={[[inkSetOf([ink])]]}
            lite
            colourBlind={colourBlind}
            label=""
            className="w-7 rounded-[3px]"
          />
        </span>
      ))}
      <span className="text-[13px] font-bold text-muted">=</span>
      <PrintSheet
        size={1}
        sheet={[[sheet[0]?.[width - 1] ?? 0]]}
        lite
        colourBlind={colourBlind}
        label=""
        className="w-7 rounded-[3px]"
      />
    </div>
  );
};

export const HelpSheet = ({
  colourBlind,
  onClose,
  onReplayTutorial,
}: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="help-title"
      className="m-auto mb-0 w-full max-w-[480px] rounded-t-2xl bg-paper p-0 text-ink backdrop:bg-ink/40 sm:mb-auto sm:rounded-2xl"
    >
      <div className="paper-grain flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <h2
            id="help-title"
            className="text-[20px] font-extrabold leading-tight"
          >
            How the press works
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
            className="-mt-1 -mr-1 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <CloseIcon />
          </button>
        </div>

        <ul
          className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-0"
          aria-label="Ink mixing"
        >
          {MIXES.map((m) => (
            <li key={m.name} className="flex list-none flex-col gap-1">
              <Mix inks={m.inks} colourBlind={colourBlind} />
              <span className="text-[13px] font-semibold">
                {m.inks.join(' + ')} = {m.name}
              </span>
            </li>
          ))}
        </ul>

        <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[15px] leading-snug">
          <li>
            <b>1.</b> Tap a stamp, tap the paper, tap again to press.
          </li>
          <li>
            <b>2.</b> Overlaps mix. The same ink twice adds nothing.
          </li>
          <li>
            <b>3.</b> Match the proof exactly. Tap a printed stamp to lift it.
          </li>
          <li>
            <b>4.</b> Fewer lifts make a cleaner print ✦.
          </li>
        </ol>
        {colourBlind && (
          <p className="text-[13px] text-muted">
            Patterns: blue = dots, pink = diagonal lines, yellow = horizontal
            lines.
          </p>
        )}
        <div className="flex gap-2">
          {onReplayTutorial && (
            <button
              type="button"
              onClick={() => {
                dialog.current?.close();
                onReplayTutorial();
              }}
              className="min-h-12 flex-1 rounded-full border-2 border-ink bg-[#fbf8f2] font-bold"
            >
              Replay the tutorial
            </button>
          )}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-12 flex-1 rounded-full bg-ink font-extrabold text-paper"
          >
            Got it
          </button>
        </div>
      </div>
    </dialog>
  );
};
