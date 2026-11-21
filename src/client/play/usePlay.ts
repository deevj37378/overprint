import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  initialPlay,
  playReducer,
  type PlayAction,
  type PlayState,
} from '../../shared/play';
import type { Sheet, Stamp } from '../../shared/sheet';

/** Actions without timestamps; the hook stamps them with the current time. */
export type PlayCommand =
  | { type: 'pick'; stampId: string }
  | { type: 'rotate' }
  | { type: 'tapCell'; row: number; col: number }
  | { type: 'press' }
  | { type: 'drop' }
  | { type: 'moveGhost'; dRow: number; dCol: number }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'restart' }
  | { type: 'setTray'; tray: readonly Stamp[] };

const withTime = (command: PlayCommand): PlayAction => {
  const at = Date.now();
  switch (command.type) {
    case 'pick':
      return { ...command, at };
    case 'tapCell':
      return { ...command, at };
    case 'press':
      return { ...command, at };
    default:
      return command;
  }
};

export const usePlay = (
  size: number,
  tray: readonly Stamp[],
  target: Sheet | null
) => {
  const [state, dispatchAction] = useReducer(playReducer, undefined, () =>
    initialPlay(size, tray, target)
  );
  const dispatch = useCallback(
    (command: PlayCommand) => dispatchAction(withTime(command)),
    []
  );
  return { state, dispatch };
};

/** A clock that ticks while a round is running. */
export const useNow = (state: PlayState, intervalMs = 250): number => {
  const [now, setNow] = useState(() => Date.now());
  const running = state.startedAt !== null && state.solvedAt === null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [running, intervalMs]);
  return running ? now : (state.solvedAt ?? now);
};

export const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};
