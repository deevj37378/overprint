// Drag to move stamps, for the expanded views only (the inline splash stays tap-only).
// Pointer Events with pointer capture: one code path for mouse and touch. Everything a drag
// does can also be done with taps, and a press that moves less than DRAG_THRESHOLD_PX is a tap.

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Ink } from '../../shared/ink';
import { clampAnchor, type Cell } from '../../shared/play';
import { shapeCells, type Rotation, type ShapeId } from '../../shared/shapes';
import { tick } from '../lib/sound';
import { StampFace } from '../ui/StampFace';

export const DRAG_THRESHOLD_PX = 8;

/** A soft tick (when sound is on) and a tiny buzz on each cell snap. */
export const snapFeedback = (): void => {
  tick();
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(5);
  } catch {
    // Some browsers throw when vibration is blocked; the tick is enough.
  }
};

export const movedPastThreshold = (
  x0: number,
  y0: number,
  x: number,
  y: number
): boolean => Math.hypot(x - x0, y - y0) >= DRAG_THRESHOLD_PX;

/** The paper cell under a point (may be off the paper), and whether the point is on it. */
export const cellAtPoint = (
  el: Element,
  size: number,
  x: number,
  y: number
): { cell: Cell; inside: boolean } => {
  const r = el.getBoundingClientRect();
  const cell = {
    row: Math.floor(((y - r.top) / r.height) * size),
    col: Math.floor(((x - r.left) / r.width) * size),
  };
  const inside = x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  return { cell, inside };
};

export const sameCell = (a: Cell | null, b: Cell | null): boolean =>
  a !== null && b !== null && a.row === b.row && a.col === b.col;

/** The shape cell closest to the middle of the shape: where a tray stamp is held. */
export const middleCell = (cells: readonly Cell[]): Cell => {
  const rows = cells.map((c) => c.row);
  const cols = cells.map((c) => c.col);
  const mid = {
    row: (Math.min(...rows) + Math.max(...rows)) / 2,
    col: (Math.min(...cols) + Math.max(...cols)) / 2,
  };
  let best = cells[0] ?? { row: 0, col: 0 };
  let bestDistance = Infinity;
  for (const c of cells) {
    const d = (c.row - mid.row) ** 2 + (c.col - mid.col) ** 2;
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  return best;
};

// ---- the paper as a drop target ----------------------------------------------------------

type PaperTarget = { el: HTMLElement; size: number };
let paper: PaperTarget | null = null;

/** The play paper registers itself so the tray can drop onto it. One paper per page. */
export const registerPaper = (target: PaperTarget): (() => void) => {
  paper = target;
  return () => {
    if (paper === target) paper = null;
  };
};

// ---- where a stamp dragged from the tray would land (drawn by the paper) -----------------

export type TrayHover = {
  shape: ShapeId;
  ink: Ink;
  rotation: Rotation;
  anchor: Cell;
};

let hover: TrayHover | null = null;
const hoverListeners = new Set<() => void>();
const setHover = (next: TrayHover | null) => {
  if (hover === next) return;
  hover = next;
  hoverListeners.forEach((l) => l());
};
const subscribeHover = (listener: () => void) => {
  hoverListeners.add(listener);
  return () => {
    hoverListeners.delete(listener);
  };
};
const getHover = () => hover;

export const useTrayHover = (): TrayHover | null =>
  useSyncExternalStore(subscribeHover, getHover, getHover);

// ---- dragging a stamp out of the tray ----------------------------------------------------

export type TrayItem = {
  key: string;
  shape: ShapeId;
  ink: Ink;
  rotation: Rotation;
};

type TraySession = {
  pointerId: number;
  item: TrayItem;
  x0: number;
  y0: number;
  started: boolean;
  grab: Cell;
  anchor: Cell | null;
};

type Float = { item: TrayItem; x: number; y: number; over: boolean };

/**
 * Press a tray stamp and drag it onto the paper. Releasing over the paper calls `onDrop` with
 * the (clamped) anchor and the grabbed shape cell; releasing anywhere else cancels.
 * Call `consumeClick()` first thing in the button's onClick: it is true right after a drag.
 */
export const useTrayDrag = (
  onDrop: (item: TrayItem, anchor: Cell, grab: Cell) => void
) => {
  const session = useRef<TraySession | null>(null);
  const suppressClick = useRef(false);
  const [float, setFloat] = useState<Float | null>(null);

  useEffect(
    () => () => {
      if (session.current?.started) setHover(null);
    },
    []
  );

  const end = () => {
    session.current = null;
    setHover(null);
    setFloat(null);
  };

  const bind = (item: TrayItem) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      suppressClick.current = false;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const cells = shapeCells(item.shape, item.rotation);
      session.current = {
        pointerId: e.pointerId,
        item,
        x0: e.clientX,
        y0: e.clientY,
        started: false,
        grab: middleCell(cells),
        anchor: null,
      };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = session.current;
      if (!s || s.pointerId !== e.pointerId) return;
      if (!s.started) {
        if (!movedPastThreshold(s.x0, s.y0, e.clientX, e.clientY)) return;
        s.started = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // The pointer may already be gone; pointerup/cancel still end the drag.
        }
      }
      e.preventDefault();
      let anchor: Cell | null = null;
      if (paper) {
        const { cell, inside } = cellAtPoint(
          paper.el,
          paper.size,
          e.clientX,
          e.clientY
        );
        if (inside) {
          anchor = clampAnchor(
            paper.size,
            shapeCells(s.item.shape, s.item.rotation),
            { row: cell.row - s.grab.row, col: cell.col - s.grab.col }
          );
        }
      }
      if (!sameCell(anchor, s.anchor)) {
        if (anchor) snapFeedback();
        s.anchor = anchor;
        setHover(
          anchor
            ? {
                shape: s.item.shape,
                ink: s.item.ink,
                rotation: s.item.rotation,
                anchor,
              }
            : null
        );
      }
      setFloat({
        item: s.item,
        x: e.clientX,
        y: e.clientY,
        over: anchor !== null,
      });
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const s = session.current;
      if (!s || s.pointerId !== e.pointerId) return;
      if (s.started) {
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 500);
        if (s.anchor) onDrop(s.item, s.anchor, s.grab);
      }
      end();
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
      if (session.current?.pointerId === e.pointerId) end();
    },
  });

  const consumeClick = (): boolean => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  const floating: ReactNode = float
    ? createPortal(
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed z-50 flex h-[60px] w-[60px] items-center justify-center rounded-[10px] border-2 border-ink bg-[#fbf8f2] shadow-[0_14px_22px_-8px_rgba(40,25,10,0.5)] ${
            float.over ? 'opacity-60' : 'opacity-95'
          }`}
          style={{
            left: float.x,
            top: float.y,
            transform: 'translate(-50%, -110%) rotate(-4deg)',
          }}
        >
          <StampFace
            shape={float.item.shape}
            ink={float.item.ink}
            rotation={float.item.rotation}
            size={40}
          />
        </div>,
        document.body
      )
    : null;

  return { bind, consumeClick, floating };
};
