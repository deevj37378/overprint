import { useEffect, useRef } from 'react';
import { mixColour } from '../../shared/ink';
import {
  currentSheet,
  ghostCells,
  placedAt,
  type PlayState,
} from '../../shared/play';
import { shapeCells } from '../../shared/shapes';
import { COLOUR_LABEL, INK_NAME, SHAPE_NAME } from '../ui/inks';
import { PrintSheet, type BloomView, type GhostView } from '../ui/PrintSheet';
import type { PlayCommand } from './usePlay';

type Props = {
  state: PlayState;
  dispatch: (command: PlayCommand) => void;
  colourBlind: boolean;
  className?: string;
  label?: string;
};

/** The paper you stamp on: current print, ghost preview and the press animation. */
export const Paper = ({
  state,
  dispatch,
  colourBlind,
  className = '',
  label = 'Your paper',
}: Props) => {
  const sheet = currentSheet(state);
  const handStamp = state.hand
    ? state.tray.find((s) => s.id === state.hand?.stampId)
    : undefined;
  const ghost: GhostView | null =
    handStamp && state.ghost
      ? { cells: ghostCells(state), ink: handStamp.ink }
      : null;

  // Press feedback: bloom + squash on the stamp just pressed (keyed so it plays once per press),
  // and a small board thump.
  const boardRef = useRef<HTMLDivElement>(null);
  const pressedKey = state.lastPressed
    ? `${state.lastPressed}-${state.history.length}`
    : null;
  const pressedPlacement = state.placed.find(
    (p) => p.stampId === state.lastPressed
  );
  const pressedStamp = state.tray.find((s) => s.id === state.lastPressed);
  const bloom: BloomView | null =
    pressedKey && pressedPlacement && pressedStamp
      ? {
          key: pressedKey,
          ink: pressedStamp.ink,
          cells: shapeCells(pressedStamp.shape, pressedPlacement.rotation).map(
            (c) => ({
              row: pressedPlacement.row + c.row,
              col: pressedPlacement.col + c.col,
            })
          ),
        }
      : null;
  useEffect(() => {
    if (
      !pressedKey ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    boardRef.current?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(0.985, 0.975)' },
        { transform: 'scale(1)' },
      ],
      { duration: 220, easing: 'ease-out' }
    );
  }, [pressedKey]);

  const ghostSet = new Set(ghostCells(state).map((c) => `${c.row}-${c.col}`));

  return (
    <div ref={boardRef} className={className}>
      <PrintSheet
        size={state.size}
        sheet={sheet}
        colourBlind={colourBlind}
        ghost={ghost}
        bloom={bloom}
        grid
        label={label}
        className="rounded-[6px] shadow-[0_1px_0_#fff_inset,0_10px_24px_-14px_rgba(60,40,20,0.55),0_0_0_1px_#d9cdb8]"
        onCellTap={(row, col) => dispatch({ type: 'tapCell', row, col })}
        cellLabel={(row, col, set) => {
          const colour = COLOUR_LABEL[mixColour(set)];
          const where = `Row ${row + 1}, column ${col + 1}, ${colour}`;
          if (state.hand && handStamp) {
            if (
              ghostSet.has(`${row}-${col}`) &&
              state.ghost?.tap.row === row &&
              state.ghost.tap.col === col
            ) {
              return `${where}. Tap again to press the ${INK_NAME[handStamp.ink]} stamp here.`;
            }
            return `${where}. Place the ${INK_NAME[handStamp.ink]} ${SHAPE_NAME[handStamp.shape]} here.`;
          }
          const top = placedAt(state, row, col);
          if (top) {
            const stamp = state.tray.find((s) => s.id === top.stampId);
            return stamp
              ? `${where}. Tap to lift the ${INK_NAME[stamp.ink]} ${SHAPE_NAME[stamp.shape]}.`
              : where;
          }
          return where;
        }}
      />
    </div>
  );
};
