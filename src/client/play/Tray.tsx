import { isPlaced, type PlayState } from '../../shared/play';
import { INK_NAME, SHAPE_NAME } from '../ui/inks';
import { StampFace } from '../ui/StampFace';
import { useTrayDrag } from './drag';
import type { PlayCommand } from './usePlay';

type Props = {
  state: PlayState;
  dispatch: (command: PlayCommand) => void;
  highlight?: string | null;
};

/** The stamp rack. Each stamp is a little wooden block with an inked rubber face. */
export const Tray = ({ state, dispatch, highlight = null }: Props) => {
  // Drag a stamp onto the paper: it lands as the ghost (pick it up first if it isn't in hand;
  // a stamp already on the paper is lifted, like tapping it).
  const drag = useTrayDrag((item, anchor, grab) => {
    if (state.solvedAt !== null) return;
    if (state.hand?.stampId !== item.key)
      dispatch({ type: 'pick', stampId: item.key });
    dispatch({ type: 'dragGhost', ...anchor, grab });
  });
  return (
    <div
      role="group"
      aria-label="Stamp tray"
      className="drag-surface flex flex-wrap justify-center gap-2 max-[359px]:gap-1.5"
    >
      {state.tray.map((stamp, index) => {
        const held = state.hand?.stampId === stamp.id;
        const placement = state.placed.find((p) => p.stampId === stamp.id);
        const placed = isPlaced(state, stamp.id);
        const rotation = held && state.hand ? state.hand.rotation : 0;
        const name = `${INK_NAME[stamp.ink]} ${SHAPE_NAME[stamp.shape]}`;
        return (
          <button
            key={stamp.id}
            type="button"
            data-testid={`stamp-${stamp.id}`}
            aria-pressed={held}
            aria-label={`${name} stamp${placed ? ', on the paper — tap to lift' : held ? ', in your hand' : ''}. Key ${index + 1}.`}
            {...drag.bind({
              key: stamp.id,
              shape: stamp.shape,
              ink: stamp.ink,
              rotation: placement?.rotation ?? rotation,
            })}
            onClick={() => {
              if (drag.consumeClick()) return;
              dispatch({ type: 'pick', stampId: stamp.id });
            }}
            className={`stamp-lift group relative flex h-[64px] w-[54px] max-[359px]:h-[58px] max-[359px]:w-[44px] flex-col items-center rounded-[10px] border-0 bg-transparent p-0 ${
              held ? '-translate-y-2' : ''
            } ${highlight === stamp.id ? 'animate-bounce' : ''}`}
          >
            {/* wooden block */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-1 top-0 h-[18px] rounded-t-[8px] rounded-b-[3px] bg-gradient-to-b from-[#d7ac7c] to-wood shadow-[inset_0_-2px_0_var(--color-wood-dark)] transition-opacity ${
                placed ? 'opacity-40' : ''
              }`}
            >
              <span className="absolute left-1/2 top-[3px] h-[5px] w-4 -translate-x-1/2 rounded-full bg-wood-dark/40" />
            </span>
            {/* rubber face */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 bottom-0 top-[15px] flex items-center justify-center rounded-[9px] border-2 bg-[#fbf8f2] transition-all ${
                held
                  ? 'border-ink shadow-[0_10px_16px_-6px_rgba(40,25,10,0.45)]'
                  : 'border-paper-edge shadow-[0_2px_0_#d6cab5]'
              } ${placed ? 'opacity-35 grayscale-[40%]' : ''}`}
            >
              <StampFace
                shape={stamp.shape}
                ink={stamp.ink}
                rotation={rotation}
                size={36}
              />
            </span>
            {placed && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 py-[1px] text-[10px] font-semibold text-paper"
              >
                on
              </span>
            )}
          </button>
        );
      })}
      {drag.floating}
    </div>
  );
};
