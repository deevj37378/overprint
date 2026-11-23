// The riso renderer: each ink is its own layer, multiplied onto warm paper with a hair of
// misregistration, so overlaps make real overprint colours. Used for the paper, the proof
// card, thumbnails and the gallery (with `lite` to skip the texture filters).

import { useId, type ReactNode } from 'react';
import {
  hasInk,
  INKS,
  mixColour,
  type Ink,
  type InkSet,
} from '../../shared/ink';
import type { Sheet } from '../../shared/sheet';
import { COLOUR_LABEL, INK_DEEP, INK_HEX, MISREGISTER } from './inks';

const U = 100; // viewBox units per cell

export type GhostView = {
  cells: readonly { row: number; col: number }[];
  ink: Ink;
};

export type BloomView = {
  key: string;
  cells: readonly { row: number; col: number }[];
  ink: Ink;
};

type Props = {
  size: number;
  sheet: Sheet;
  /** Skip the rough-edge/speckle filter (thumbnails). */
  lite?: boolean;
  /** Offset each ink a hair, like a loose drum. Defaults to on unless `lite`. */
  misregister?: boolean;
  colourBlind?: boolean;
  ghost?: GhostView | null;
  /** A stamp being dragged: drawn raised off the paper with a shadow. */
  lifted?: GhostView | null;
  bloom?: BloomView | null;
  grid?: boolean;
  /** Interactive cells (the play paper). */
  onCellTap?: (row: number, col: number) => void;
  cellLabel?: (row: number, col: number, set: InkSet) => string;
  className?: string;
  label: string;
  children?: ReactNode;
};

const cellsWithInk = (sheet: Sheet, ink: Ink) => {
  const out: { row: number; col: number }[] = [];
  sheet.forEach((line, row) =>
    line.forEach((set, col) => {
      if (hasInk(set, ink)) out.push({ row, col });
    })
  );
  return out;
};

/** Outline segments around a set of cells (edges not shared with another cell in the set). */
const outline = (cells: readonly { row: number; col: number }[]): string => {
  const has = (r: number, c: number) =>
    cells.some((x) => x.row === r && x.col === c);
  const parts: string[] = [];
  for (const { row, col } of cells) {
    const x = col * U;
    const y = row * U;
    if (!has(row - 1, col)) parts.push(`M${x} ${y}h${U}`);
    if (!has(row + 1, col)) parts.push(`M${x} ${y + U}h${U}`);
    if (!has(row, col - 1)) parts.push(`M${x} ${y}v${U}`);
    if (!has(row, col + 1)) parts.push(`M${x + U} ${y}v${U}`);
  }
  return parts.join('');
};

const PATTERN: Record<Ink, ReactNode> = {
  // Blue = dots, Pink = diagonal lines, Yellow = horizontal lines (OVERPRINT.md)
  blue: <circle cx="10" cy="10" r="4.2" />,
  pink: <path d="M-5 5 L5 -5 M0 20 L20 0 M15 25 L25 15" strokeWidth="4" />,
  yellow: <path d="M0 10 H20" strokeWidth="4.5" />,
};

export const PrintSheet = ({
  size,
  sheet,
  lite = false,
  misregister = !lite,
  colourBlind = false,
  ghost = null,
  lifted = null,
  bloom = null,
  grid = false,
  onCellTap,
  cellLabel,
  className = '',
  label,
  children,
}: Props) => {
  const uid = useId().replace(/:/g, '');
  const span = size * U;
  const interactive = onCellTap !== undefined;

  return (
    <div
      className={`relative aspect-square select-none ${className}`}
      role={interactive ? 'grid' : 'img'}
      aria-label={label}
    >
      <div
        className="absolute inset-0 bg-paper paper-grain"
        aria-hidden="true"
      />
      {grid && (
        <svg
          viewBox={`0 0 ${span} ${span}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d={Array.from({ length: size - 1 }, (_, i) => {
              const p = (i + 1) * U;
              return `M${p} 0V${span}M0 ${p}H${span}`;
            }).join('')}
            stroke="#b9ab94"
            strokeWidth="1.4"
            strokeDasharray="2 6"
            fill="none"
          />
        </svg>
      )}

      {INKS.map((ink) => {
        const cells = cellsWithInk(sheet, ink);
        const m = MISREGISTER[ink];
        return (
          <svg
            key={ink}
            viewBox={`0 0 ${span} ${span}`}
            className="absolute inset-0 h-full w-full"
            style={{
              mixBlendMode: 'multiply',
              transform: misregister
                ? `translate(${m.x}px, ${m.y}px)`
                : undefined,
            }}
            aria-hidden="true"
          >
            {!lite && (
              <defs>
                <filter
                  id={`ink-${uid}-${ink}`}
                  x="-5%"
                  y="-5%"
                  width="110%"
                  height="110%"
                >
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.09"
                    numOctaves="2"
                    seed={ink === 'blue' ? 3 : ink === 'pink' ? 7 : 11}
                    result="noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="5"
                    result="rough"
                  />
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.55"
                    numOctaves="1"
                    result="speck"
                  />
                  <feColorMatrix
                    in="speck"
                    values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.55"
                    result="speckAlpha"
                  />
                  <feComposite in="rough" in2="speckAlpha" operator="in" />
                </filter>
              </defs>
            )}
            {colourBlind && (
              <defs>
                <pattern
                  id={`pat-${uid}-${ink}`}
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                  fill="rgba(20,12,8,0.55)"
                  stroke="rgba(20,12,8,0.55)"
                >
                  {PATTERN[ink]}
                </pattern>
              </defs>
            )}
            <g
              fill={INK_HEX[ink]}
              filter={lite ? undefined : `url(#ink-${uid}-${ink})`}
              opacity={0.94}
            >
              {cells.map(({ row, col }) => (
                <rect
                  key={`${row}-${col}`}
                  x={col * U - 0.5}
                  y={row * U - 0.5}
                  width={U + 1}
                  height={U + 1}
                />
              ))}
            </g>
            {colourBlind && (
              <g fill={`url(#pat-${uid}-${ink})`}>
                {cells.map(({ row, col }) => (
                  <rect
                    key={`${row}-${col}`}
                    x={col * U}
                    y={row * U}
                    width={U}
                    height={U}
                  />
                ))}
              </g>
            )}
          </svg>
        );
      })}

      {bloom && (
        <svg
          key={bloom.key}
          viewBox={`0 0 ${span} ${span}`}
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <g
            className="ink-bloom"
            fill={INK_HEX[bloom.ink]}
            style={{ mixBlendMode: 'multiply' }}
          >
            {bloom.cells.map(({ row, col }) => (
              <rect
                key={`${row}-${col}`}
                x={col * U - 8}
                y={row * U - 8}
                width={U + 16}
                height={U + 16}
                rx="30"
              />
            ))}
          </g>
          <g
            className="press-squash"
            fill="none"
            stroke={INK_DEEP[bloom.ink]}
            strokeWidth="6"
          >
            <path d={outline(bloom.cells)} />
          </g>
        </svg>
      )}

      {ghost && ghost.cells.length > 0 && (
        <svg
          viewBox={`0 0 ${span} ${span}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <g className="ghost-pulse">
            <g fill={INK_HEX[ghost.ink]} opacity="0.38">
              {ghost.cells.map(({ row, col }) => (
                <rect
                  key={`${row}-${col}`}
                  x={col * U}
                  y={row * U}
                  width={U}
                  height={U}
                />
              ))}
            </g>
            <path
              d={outline(ghost.cells)}
              fill="none"
              stroke={INK_DEEP[ghost.ink]}
              strokeWidth="7"
              strokeDasharray="16 10"
              strokeLinecap="round"
            />
          </g>
        </svg>
      )}

      {lifted && lifted.cells.length > 0 && (
        <svg
          viewBox={`0 0 ${span} ${span}`}
          className="stamp-lifted pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <g fill={INK_HEX[lifted.ink]} opacity="0.88">
            {lifted.cells.map(({ row, col }) => (
              <rect
                key={`${row}-${col}`}
                x={col * U}
                y={row * U}
                width={U}
                height={U}
              />
            ))}
          </g>
          <path
            d={outline(lifted.cells)}
            fill="none"
            stroke={INK_DEEP[lifted.ink]}
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      )}

      {interactive && (
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
          }}
        >
          {sheet.map((line, row) =>
            line.map((set, col) => (
              <button
                key={`${row}-${col}`}
                type="button"
                role="gridcell"
                data-cell={`${row}-${col}`}
                aria-label={
                  cellLabel?.(row, col, set) ??
                  `Row ${row + 1}, column ${col + 1}, ${COLOUR_LABEL[mixColour(set)]}`
                }
                className="m-0 h-full w-full border-0 bg-transparent p-0 focus-visible:outline-offset-[-3px]"
                onClick={() => onCellTap(row, col)}
              />
            ))
          )}
        </div>
      )}
      {children}
    </div>
  );
};
