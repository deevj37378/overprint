// The play loop as a pure reducer, shared by the game, the tutorial and the Print Shop.
//
//   pick a stamp → tap a cell (ghost appears) → tap the same cell again or "Stamp" (press)
//   tap a placed stamp → it lifts back into your hand
//   drag the ghost → it follows (never a lift) · drag a placed stamp → it moves (one lift)
//
// Lifts (for scoring) = lifting a placed stamp + moving one by drag + each undo + each clear of
// a non-empty sheet.

import { isSolved } from './puzzle.ts';
import {
  rotate,
  shapeCells,
  SHAPES,
  fitsOnSheet,
  type Rotation,
} from './shapes.ts';
import {
  applyPlacements,
  type Placement,
  type Sheet,
  type Stamp,
} from './sheet.ts';

export type Cell = { readonly row: number; readonly col: number };

export type Hand = { readonly stampId: string; readonly rotation: Rotation };

/** Where the held stamp would land, and which cell the player tapped to put it there. */
export type Ghost = { readonly anchor: Cell; readonly tap: Cell };

export type PlayState = {
  readonly size: number;
  readonly tray: readonly Stamp[];
  readonly target: Sheet | null;
  readonly placed: readonly Placement[];
  readonly hand: Hand | null;
  readonly ghost: Ghost | null;
  /** Snapshots of `placed` before each committed change, for undo. */
  readonly history: readonly (readonly Placement[])[];
  readonly lifts: number;
  readonly startedAt: number | null;
  readonly solvedAt: number | null;
  /** Bumped on every press, so the UI can play the press animation on the right stamp. */
  readonly lastPressed: string | null;
};

export type PlayAction =
  | { type: 'pick'; stampId: string; at: number }
  | { type: 'rotate' }
  | { type: 'tapCell'; row: number; col: number; at: number }
  | { type: 'press'; at: number }
  | { type: 'drop' }
  | { type: 'moveGhost'; dRow: number; dCol: number }
  /** Drag the ghost so its anchor sits at (row, col), clamped onto the paper. `grab` is the
   *  shape cell under the finger; it becomes the ghost's tap cell. */
  | { type: 'dragGhost'; row: number; col: number; grab: Cell }
  /** Drag a pressed stamp to a new anchor (clamped). One lift; undo puts it back. */
  | {
      type: 'movePlaced';
      stampId: string;
      row: number;
      col: number;
      at: number;
    }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'restart' }
  | { type: 'setTray'; tray: readonly Stamp[] };

export const initialPlay = (
  size: number,
  tray: readonly Stamp[],
  target: Sheet | null
): PlayState => ({
  size,
  tray,
  target,
  placed: [],
  hand: null,
  ghost: null,
  history: [],
  lifts: 0,
  startedAt: null,
  solvedAt: null,
  lastPressed: null,
});

const nextRotation = (r: Rotation): Rotation =>
  r === 0 ? 1 : r === 1 ? 2 : r === 2 ? 3 : 0;

const stampById = (state: PlayState, stampId: string): Stamp | undefined =>
  state.tray.find((s) => s.id === stampId);

export const handCells = (state: PlayState): readonly Cell[] => {
  if (!state.hand) return [];
  const stamp = stampById(state, state.hand.stampId);
  return stamp ? shapeCells(stamp.shape, state.hand.rotation) : [];
};

/** The cells a ghost covers, in sheet coordinates. */
export const ghostCells = (state: PlayState): Cell[] => {
  if (!state.ghost) return [];
  const { anchor } = state.ghost;
  return handCells(state).map((c) => ({
    row: anchor.row + c.row,
    col: anchor.col + c.col,
  }));
};

/**
 * Anchor so the stamp covers the tapped cell and stays on the paper. Prefers putting the
 * stamp's own anchor cell on the tap (so it lands where you point), then the nearest fit.
 */
export const fitAnchor = (
  size: number,
  cells: readonly Cell[],
  tap: Cell
): Cell | null => {
  for (const cell of cells) {
    const anchor = { row: tap.row - cell.row, col: tap.col - cell.col };
    if (fitsOnSheet(size, cells, anchor.row, anchor.col)) return anchor;
  }
  return null;
};

/**
 * The nearest anchor to `want` that keeps every cell on the paper (each axis clamped on its
 * own), or null if the shape can never fit.
 */
export const clampAnchor = (
  size: number,
  cells: readonly Cell[],
  want: Cell
): Cell | null => {
  if (cells.length === 0) return null;
  const rows = cells.map((c) => c.row);
  const cols = cells.map((c) => c.col);
  // `+ 0` turns -0 into 0 so equality checks stay simple.
  const lo = { row: -Math.min(...rows) + 0, col: -Math.min(...cols) + 0 };
  const hi = {
    row: size - 1 - Math.max(...rows),
    col: size - 1 - Math.max(...cols),
  };
  if (lo.row > hi.row || lo.col > hi.col) return null;
  return {
    row: Math.min(hi.row, Math.max(lo.row, want.row)),
    col: Math.min(hi.col, Math.max(lo.col, want.col)),
  };
};

/** The cells a placed stamp covers, in sheet coordinates. */
export const placementCells = (
  state: PlayState,
  placement: Placement
): Cell[] => {
  const stamp = stampById(state, placement.stampId);
  if (!stamp) return [];
  return shapeCells(stamp.shape, placement.rotation).map((c) => ({
    row: placement.row + c.row,
    col: placement.col + c.col,
  }));
};

/** Which placed stamp is on top at a cell (the most recently pressed one). */
export const placedAt = (
  state: PlayState,
  row: number,
  col: number
): Placement | undefined => {
  for (let i = state.placed.length - 1; i >= 0; i--) {
    const placement = state.placed[i];
    if (!placement) continue;
    const stamp = stampById(state, placement.stampId);
    if (!stamp) continue;
    const covers = shapeCells(stamp.shape, placement.rotation).some(
      (c) => placement.row + c.row === row && placement.col + c.col === col
    );
    if (covers) return placement;
  }
  return undefined;
};

export const isPlaced = (state: PlayState, stampId: string): boolean =>
  state.placed.some((p) => p.stampId === stampId);

/** The paper as it looks right now (pressed stamps only). */
export const currentSheet = (state: PlayState): Sheet => {
  const result = applyPlacements(state.size, state.tray, state.placed);
  if (result.ok) return result.sheet;
  return Array.from({ length: state.size }, () =>
    Array.from({ length: state.size }, () => 0)
  );
};

const withGhostAt = (state: PlayState, tap: Cell): PlayState => {
  const anchor = fitAnchor(state.size, handCells(state), tap);
  return anchor ? { ...state, ghost: { anchor, tap } } : state;
};

const commit = (state: PlayState, placed: readonly Placement[]): PlayState => ({
  ...state,
  history: [...state.history, state.placed],
  placed,
});

const lift = (
  state: PlayState,
  placement: Placement,
  tap: Cell | null,
  at: number
): PlayState => {
  const lifted = commit(
    state,
    state.placed.filter((p) => p !== placement)
  );
  return {
    ...lifted,
    hand: { stampId: placement.stampId, rotation: placement.rotation },
    ghost: {
      anchor: { row: placement.row, col: placement.col },
      tap: tap ?? { row: placement.row, col: placement.col },
    },
    lifts: state.lifts + 1,
    startedAt: state.startedAt ?? at,
  };
};

/** After a stamp lands: remember it for the press animation and check for a solve. */
const landed = (
  next: PlayState,
  placement: Placement,
  at: number
): PlayState => {
  const solved =
    next.target !== null &&
    isSolved(
      {
        date: '',
        number: 0,
        size: next.size,
        tray: next.tray,
        target: next.target,
        solution: [],
      },
      next.placed
    );
  return {
    ...next,
    lastPressed: placement.stampId,
    solvedAt: solved ? at : null,
  };
};

const press = (state: PlayState, at: number): PlayState => {
  if (!state.hand || !state.ghost) return state;
  const placement: Placement = {
    stampId: state.hand.stampId,
    row: state.ghost.anchor.row,
    col: state.ghost.anchor.col,
    rotation: state.hand.rotation,
  };
  const next = commit({ ...state, hand: null, ghost: null }, [
    ...state.placed,
    placement,
  ]);
  return landed(next, placement, at);
};

export const playReducer = (
  state: PlayState,
  action: PlayAction
): PlayState => {
  if (
    state.solvedAt !== null &&
    action.type !== 'restart' &&
    action.type !== 'setTray'
  ) {
    return state;
  }
  switch (action.type) {
    case 'pick': {
      if (!stampById(state, action.stampId)) return state;
      if (state.hand?.stampId === action.stampId)
        return { ...state, hand: null, ghost: null };
      const placement = state.placed.find((p) => p.stampId === action.stampId);
      if (placement) return lift(state, placement, null, action.at);
      return {
        ...state,
        hand: { stampId: action.stampId, rotation: 0 },
        ghost: null,
        startedAt: state.startedAt ?? action.at,
      };
    }
    case 'rotate': {
      if (!state.hand) return state;
      const turned = {
        ...state,
        hand: { ...state.hand, rotation: nextRotation(state.hand.rotation) },
      };
      return state.ghost ? withGhostAt(turned, state.ghost.tap) : turned;
    }
    case 'tapCell': {
      const tap = { row: action.row, col: action.col };
      if (state.hand) {
        if (
          state.ghost &&
          state.ghost.tap.row === tap.row &&
          state.ghost.tap.col === tap.col
        ) {
          return press(state, action.at);
        }
        return withGhostAt(state, tap);
      }
      const placement = placedAt(state, tap.row, tap.col);
      return placement ? lift(state, placement, tap, action.at) : state;
    }
    case 'press':
      return press(state, action.at);
    case 'drop':
      return { ...state, hand: null, ghost: null };
    case 'moveGhost': {
      if (!state.hand) return state;
      const from = state.ghost?.anchor ?? {
        row: Math.floor(state.size / 2),
        col: Math.floor(state.size / 2),
      };
      const anchor = {
        row: from.row + action.dRow,
        col: from.col + action.dCol,
      };
      if (!state.ghost) return withGhostAt(state, from);
      if (!fitsOnSheet(state.size, handCells(state), anchor.row, anchor.col))
        return state;
      return { ...state, ghost: { anchor, tap: anchor } };
    }
    case 'dragGhost': {
      if (!state.hand) return state;
      const anchor = clampAnchor(state.size, handCells(state), {
        row: action.row,
        col: action.col,
      });
      if (!anchor) return state;
      return {
        ...state,
        ghost: {
          anchor,
          tap: {
            row: anchor.row + action.grab.row,
            col: anchor.col + action.grab.col,
          },
        },
      };
    }
    case 'movePlaced': {
      const placement = state.placed.find((p) => p.stampId === action.stampId);
      const stamp = stampById(state, action.stampId);
      if (!placement || !stamp) return state;
      const anchor = clampAnchor(
        state.size,
        shapeCells(stamp.shape, placement.rotation),
        { row: action.row, col: action.col }
      );
      if (!anchor) return state;
      if (anchor.row === placement.row && anchor.col === placement.col)
        return state;
      const moved: Placement = { ...placement, ...anchor };
      const next = commit(state, [
        ...state.placed.filter((p) => p !== placement),
        moved,
      ]);
      return landed(
        {
          ...next,
          lifts: state.lifts + 1,
          startedAt: state.startedAt ?? action.at,
        },
        moved,
        action.at
      );
    }
    case 'undo': {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return {
        ...state,
        placed: previous,
        history: state.history.slice(0, -1),
        hand: null,
        ghost: null,
        lifts: state.lifts + 1,
      };
    }
    case 'clear': {
      if (state.placed.length === 0)
        return { ...state, hand: null, ghost: null };
      return {
        ...commit(state, []),
        hand: null,
        ghost: null,
        lifts: state.lifts + 1,
      };
    }
    case 'restart':
      return initialPlay(state.size, state.tray, state.target);
    case 'setTray':
      return { ...state, tray: action.tray };
  }
};

/** Elapsed play time in ms (from the first pick-up), frozen once solved. */
export const elapsedMs = (state: PlayState, now: number): number =>
  state.startedAt === null ? 0 : (state.solvedAt ?? now) - state.startedAt;

/** The base (unrotated) shape for drawing a stamp in the tray. */
export const stampShape = (stamp: Stamp, rotation: Rotation = 0) =>
  rotation === 0 ? SHAPES[stamp.shape] : rotate(SHAPES[stamp.shape], rotation);
