// The exact comment "Share to comments" posts. No placements, just the result and the print.

import type { Streak } from './api.ts';
import { toEmoji } from './ink.ts';
import type { Sheet } from './sheet.ts';

const clock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const emojiGrid = (target: Sheet): string =>
  target.map((line) => line.map(toEmoji).join('')).join('\n');

export const shareCommentText = (opts: {
  title: string;
  target: Sheet;
  timeMs: number;
  lifts: number;
  streak: Streak | null;
}): string => {
  const clean = opts.lifts === 0;
  const lines = [
    `**${opts.title}**`,
    '',
    // Two trailing spaces keep each grid row on its own line in Reddit markdown.
    ...emojiGrid(opts.target)
      .split('\n')
      .map((row) => `${row}  `),
    '',
    `⏱ ${clock(opts.timeMs)} · ${opts.lifts} ${opts.lifts === 1 ? 'lift' : 'lifts'}${clean ? ' · ✦ clean print' : ''}`,
  ];
  if (opts.streak && opts.streak.current > 1)
    lines.push('', `🔥 ${opts.streak.current}-day streak`);
  return lines.join('\n');
};
