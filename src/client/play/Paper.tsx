import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { mixColour } from '../../shared/ink';
import {
  clampAnchor,
  currentSheet,
  fitAnchor,
  ghostCells,
  handCells,
  placedAt,
  placementCells,
  type Cell,
  type Ghost,
  type PlayState,
} from '../../shared/play';
import { shapeCells } from '../../shared/shapes';
import { COLOUR_LABEL, INK_NAME, SHAPE_NAME } from '../ui/inks';
import { PrintSheet, type BloomView, type GhostView } from '../ui/PrintSheet';
import {
  cellAtPoint,
  movedPastThreshold,
  registerPaper,
  sameCell,
  snapFeedback,
  useTrayHover,
} from './drag';
import type { PlayCommand } from './usePlay';

type Props = {
  state: PlayState;
  dispatch: (command: PlayCommand) => void;
  colourBlind: boolean;
  className?: string;
  label?: string;
};

/** A press on the paper that may turn into a drag once it moves 8px. */
type Session = {
  pointerId: number;
  x0: number;
  y0: number;
  started: boolean;
  /** The shape cell under the finger, kept under it while dragging. */
  grab: Cell;
  /** The anchor the stamp sits at right now (clamped). */
  anchor: Cell;
} & (
  | { kind: 'ghost'; origin: Ghost | null }
  | { kind: 'placed'; stampId: string; cells: readonly Cell[] }
);

/** A pressed stamp lifted off the paper mid-drag. */
type Lifted = { stampId: string; anchor: Cell };

const minus = (a: Cell, b: Cell): Cell => ({
  row: a.row - b.row,
  col: a.col - b.col,
});

/** The paper you stamp on: current print, ghost preview, drags and the press animation. */
export const Paper = ({
  state,
  dispatch,
  colourBlind,
  className = '',
  label = 'Your paper',
}: Props) => {
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const session = useRef<Session | null>(null);
  const suppressClick = useRef(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const trayHover = useTrayHover();

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    return registerPaper({ el, size: state.size });
  }, [state.size]);

  // While a pressed stamp is lifted, draw the paper without it.
  const shown: PlayState = lifted
    ? {
        ...state,
        placed: state.placed.filter((p) => p.stampId !== lifted.stampId),
      }
    : state;
  const sheet = currentSheet(shown);
  const handStamp = state.hand
    ? state.tray.find((s) => s.id === state.hand?.stampId)
    : undefined;
  const liftedStamp = lifted
    ? state.tray.find((s) => s.id === lifted.stampId)
    : undefined;
  const liftedPlacement = lifted
    ? state.placed.find((p) => p.stampId === lifted.stampId)
    : undefined;
  const liftedView: GhostView | null =
    lifted && liftedStamp && liftedPlacement
      ? {
          ink: liftedStamp.ink,
          cells: placementCells(state, {
            ...liftedPlacement,
            ...lifted.anchor,
          }),
        }
      : null;
  const ghost: GhostView | null = trayHover
    ? {
        ink: trayHover.ink,
        cells: shapeCells(trayHover.shape, trayHover.rotation).map((c) => ({
          row: trayHover.anchor.row + c.row,
          col: trayHover.anchor.col + c.col,
        })),
      }
    : handStamp && state.ghost
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
    pressedKey && pressedPlacement && pressedStamp && !lifted
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

  // ---- drag -------------------------------------------------------------------------------

  const pointCell = (e: PointerEvent<HTMLElement>): Cell | null => {
    const el = surfaceRef.current;
    return el ? cellAtPoint(el, state.size, e.clientX, e.clientY).cell : null;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    session.current = null;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (state.solvedAt !== null) return;
    const cell = pointCell(e);
    if (!cell) return;
    const base = {
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      started: false,
    };
    if (state.hand) {
      // Drag the ghost (or, pressing beside it, bring it under the finger and drag that).
      const onGhost = state.ghost && ghostSet.has(`${cell.row}-${cell.col}`);
      const anchor =
        onGhost && state.ghost
          ? state.ghost.anchor
          : fitAnchor(state.size, handCells(state), cell);
      if (!anchor) return;
      session.current = {
        ...base,
        kind: 'ghost',
        origin: state.ghost,
        grab: minus(cell, anchor),
        anchor,
      };
      return;
    }
    const top = placedAt(state, cell.row, cell.col);
    const stamp = top && state.tray.find((s) => s.id === top.stampId);
    if (!top || !stamp) return;
    const anchor = { row: top.row, col: top.col };
    session.current = {
      ...base,
      kind: 'placed',
      stampId: top.stampId,
      cells: shapeCells(stamp.shape, top.rotation),
      grab: minus(cell, anchor),
      anchor,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = session.current;
    if (!s || s.pointerId !== e.pointerId) return;
    if (!s.started) {
      if (!movedPastThreshold(s.x0, s.y0, e.clientX, e.clientY)) return;
      s.started = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer already released; pointerup/cancel will tidy up.
      }
      if (s.kind === 'placed')
        setLifted({ stampId: s.stampId, anchor: s.anchor });
    }
    e.preventDefault();
    const cell = pointCell(e);
    if (!cell) return;
    const cells = s.kind === 'placed' ? s.cells : handCells(state);
    const anchor = clampAnchor(state.size, cells, minus(cell, s.grab));
    if (!anchor || sameCell(anchor, s.anchor)) {
      // First move of a ghost dragged from beside it: show it under the finger.
      if (
        s.kind === 'ghost' &&
        anchor &&
        !sameCell(anchor, state.ghost?.anchor ?? null)
      )
        dispatch({ type: 'dragGhost', ...anchor, grab: s.grab });
      return;
    }
    s.anchor = anchor;
    snapFeedback();
    if (s.kind === 'ghost')
      dispatch({ type: 'dragGhost', ...anchor, grab: s.grab });
    else setLifted({ stampId: s.stampId, anchor });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = session.current;
    if (!s || s.pointerId !== e.pointerId) return;
    session.current = null;
    if (!s.started) return; // a tap: the cell's own click handles it, exactly as before
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 500);
    if (s.kind === 'placed') {
      dispatch({ type: 'movePlaced', stampId: s.stampId, ...s.anchor });
      setLifted(null);
    }
  };

  const onPointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const s = session.current;
    if (!s || s.pointerId !== e.pointerId) return;
    session.current = null;
    if (!s.started) return;
    if (s.kind === 'placed') {
      setLifted(null); // the stamp drops back where it was
    } else if (s.origin) {
      dispatch({
        type: 'dragGhost',
        ...s.origin.anchor,
        grab: minus(s.origin.tap, s.origin.anchor),
      });
    }
  };

  return (
    <div ref={boardRef} className={className}>
      <div
        ref={surfaceRef}
        className="drag-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={(e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <PrintSheet
          size={state.size}
          sheet={sheet}
          colourBlind={colourBlind}
          ghost={ghost}
          lifted={liftedView}
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
    </div>
  );
};
