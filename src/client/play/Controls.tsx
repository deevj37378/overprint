import type { ReactNode } from 'react';
import type { PlayState } from '../../shared/play';
import { ClearIcon, RotateIcon, StampIcon, UndoIcon } from '../ui/Icons';
import type { PlayCommand } from './usePlay';

type Props = {
  state: PlayState;
  dispatch: (command: PlayCommand) => void;
  onInteraction?: (action: 'rotate' | 'undo' | 'clear') => void;
};

const ToolButton = ({
  label,
  icon,
  onClick,
  disabled,
  primary = false,
  testId,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
  testId: string;
}) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    disabled={disabled}
    className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 text-[13px] font-semibold transition-[transform,opacity,background-color] active:scale-95 disabled:opacity-35 ${
      primary
        ? 'border-ink bg-ink text-paper disabled:bg-transparent disabled:text-ink'
        : 'border-ink/80 bg-[#fbf8f2] text-ink'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export const Controls = ({ state, dispatch, onInteraction }: Props) => {
  const locked = state.solvedAt !== null;
  return (
    <div
      className="flex w-full gap-2"
      role="toolbar"
      aria-label="Stamp controls"
    >
      <ToolButton
        testId="rotate"
        label="Rotate"
        icon={<RotateIcon />}
        disabled={locked || !state.hand}
        onClick={() => {
          dispatch({ type: 'rotate' });
          onInteraction?.('rotate');
        }}
      />
      <ToolButton
        testId="press"
        label="Stamp"
        primary
        icon={<StampIcon />}
        disabled={locked || !state.ghost}
        onClick={() => dispatch({ type: 'press' })}
      />
      <ToolButton
        testId="undo"
        label="Undo"
        icon={<UndoIcon />}
        disabled={locked || state.history.length === 0}
        onClick={() => {
          dispatch({ type: 'undo' });
          onInteraction?.('undo');
        }}
      />
      <ToolButton
        testId="clear"
        label="Clear"
        icon={<ClearIcon />}
        disabled={locked || state.placed.length === 0}
        onClick={() => {
          dispatch({ type: 'clear' });
          onInteraction?.('clear');
        }}
      />
    </div>
  );
};
