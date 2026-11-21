// Inks and ink mixing. A cell's colour is the *set* of inks covering it.
// InkSet is a bitmask so it serialises compactly: blue = 1, pink = 2, yellow = 4.

export type Ink = 'blue' | 'pink' | 'yellow';

export type InkSet = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ColourName =
  | 'empty'
  | 'blue'
  | 'pink'
  | 'yellow'
  | 'green'
  | 'orange'
  | 'purple'
  | 'black';

export const INKS: readonly Ink[] = ['blue', 'pink', 'yellow'];

export const EMPTY: InkSet = 0;

const INK_BIT: Record<Ink, InkSet> = { blue: 1, pink: 2, yellow: 4 };

const ALL_SETS: readonly InkSet[] = [0, 1, 2, 3, 4, 5, 6, 7];

const COLOUR: Record<InkSet, ColourName> = {
  0: 'empty',
  1: 'blue',
  2: 'pink',
  3: 'purple', // blue + pink
  4: 'yellow',
  5: 'green', // blue + yellow
  6: 'orange', // pink + yellow
  7: 'black', // all three
};

const EMOJI: Record<ColourName, string> = {
  empty: '⬜',
  blue: '🟦',
  pink: '🟥',
  yellow: '🟨',
  green: '🟩',
  orange: '🟧',
  purple: '🟪',
  black: '🟫',
};

const toInkSet = (bits: number): InkSet => {
  const set = ALL_SETS[bits];
  if (set === undefined) throw new RangeError(`Not an ink set: ${bits}`);
  return set;
};

export const inkBit = (ink: Ink): InkSet => INK_BIT[ink];

export const addInk = (set: InkSet, ink: Ink): InkSet =>
  toInkSet(set | INK_BIT[ink]);

export const hasInk = (set: InkSet, ink: Ink): boolean =>
  (set & INK_BIT[ink]) !== 0;

export const inkSetOf = (inks: readonly Ink[]): InkSet =>
  inks.reduce<InkSet>((set, ink) => addInk(set, ink), EMPTY);

export const inksOf = (set: InkSet): Ink[] =>
  INKS.filter((ink) => hasInk(set, ink));

export const inkCount = (set: InkSet): number => inksOf(set).length;

export const isMixed = (set: InkSet): boolean => inkCount(set) >= 2;

export const mixColour = (set: InkSet): ColourName => COLOUR[set];

export const toEmoji = (set: InkSet): string => EMOJI[COLOUR[set]];
