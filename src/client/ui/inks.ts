import type { ColourName, Ink } from '../../shared/ink';

export const INK_HEX: Record<Ink, string> = {
  blue: '#0078BF',
  pink: '#FF48B0',
  yellow: '#FFE800',
};

/** Darker partner of each ink, for outlines, patterns and text on light paper. */
export const INK_DEEP: Record<Ink, string> = {
  blue: '#005a8f',
  pink: '#c42a83',
  yellow: '#a08f00',
};

/** 1px misregistration per ink, like a slightly loose drum. */
export const MISREGISTER: Record<Ink, { x: number; y: number }> = {
  blue: { x: -0.8, y: 0.4 },
  pink: { x: 0.8, y: -0.4 },
  yellow: { x: 0.2, y: 0.9 },
};

export const INK_NAME: Record<Ink, string> = {
  blue: 'Blue',
  pink: 'Pink',
  yellow: 'Yellow',
};

export const COLOUR_LABEL: Record<ColourName, string> = {
  empty: 'blank',
  blue: 'blue',
  pink: 'pink',
  yellow: 'yellow',
  green: 'green',
  orange: 'orange',
  purple: 'purple',
  black: 'ink black',
};

/** How each mix actually looks with multiply on this paper (for legends and thumbnails). */
export const COLOUR_HEX: Record<ColourName, string> = {
  empty: '#F4EFE6',
  blue: '#0078BF',
  pink: '#FF48B0',
  yellow: '#FFE800',
  green: '#1E8A3C',
  orange: '#FF5A1F',
  purple: '#3B2D8F',
  black: '#2A1E14',
};

export const SHAPE_NAME: Record<string, string> = {
  domino: 'domino',
  i3: 'short bar',
  l3: 'small corner',
  i4: 'long bar',
  l4: 'L',
  t4: 'T',
  s4: 'S',
  o4: 'square',
  p5: 'P',
  plus: 'plus',
};
