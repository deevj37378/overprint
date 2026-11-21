// A rubber stamp as it sits in the tray: a wooden block with the inked rubber face showing
// the stamp's shape (in its current rotation).

import {
  SHAPES,
  rotate,
  shapeBounds,
  type Rotation,
  type ShapeId,
} from '../../shared/shapes';
import type { Ink } from '../../shared/ink';
import { INK_DEEP, INK_HEX } from './inks';

type Props = {
  shape: ShapeId;
  ink: Ink;
  rotation?: Rotation;
  /** Face size in px (the longer side of the 4×4 box the shape is drawn in). */
  size?: number;
};

export const StampFace = ({ shape, ink, rotation = 0, size = 44 }: Props) => {
  const cells = rotate(SHAPES[shape], rotation);
  const b = shapeBounds(cells);
  const w = b.maxCol - b.minCol + 1;
  const h = b.maxRow - b.minRow + 1;
  const box = 3;
  const unit = 10;
  const offX = ((box - w) * unit) / 2 - b.minCol * unit;
  const offY = ((box - h) * unit) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-2 -2 ${box * unit + 4} ${box * unit + 4}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <g transform={`translate(${offX} ${offY})`}>
        {cells.map((c) => (
          <rect
            key={`${c.row}-${c.col}`}
            x={c.col * unit + 0.6}
            y={c.row * unit + 0.6}
            width={unit - 1.2}
            height={unit - 1.2}
            rx="1.6"
            fill={INK_HEX[ink]}
            stroke={INK_DEEP[ink]}
            strokeWidth="0.8"
          />
        ))}
      </g>
    </svg>
  );
};
