// Print one sample puzzle per weekday as emoji, to eyeball the difficulty curve.
// Usage: npm run samples [-- YYYY-MM-DD]   (the date should be a Monday; default 2026-12-07)

import { addDays, weekdayOf } from '../src/shared/date.ts';
import { inkSetOf, toEmoji } from '../src/shared/ink.ts';
import {
  generateDailyPuzzle,
  rulesFor,
  targetToEmojiGrid,
} from '../src/shared/puzzle.ts';
import { countInked, countMixed } from '../src/shared/sheet.ts';

const LAUNCH = '2026-12-01';
const monday = process.argv[2] ?? '2026-12-07';

for (let i = 0; i < 7; i++) {
  const date = addDays(monday, i);
  const puzzle = generateDailyPuzzle(date, LAUNCH);
  const rules = rulesFor(date);
  const cells = puzzle.size * puzzle.size;
  const used = new Set(puzzle.solution.map((p) => p.stampId));
  const tray = puzzle.tray
    .map(
      (s) =>
        `${toEmoji(inkSetOf([s.ink]))}${s.shape}${used.has(s.id) ? '' : '(decoy)'}`
    )
    .join(' ');

  console.log(
    `\n#${puzzle.number} · ${weekdayOf(date).toUpperCase()} ${date} · ` +
      `${puzzle.size}×${puzzle.size} · ${rules.stamps} stamps${rules.decoy ? ' + decoy' : ''}`
  );
  console.log(
    `mixed ${countMixed(puzzle.target)} (min ${rules.minMixed}) · ` +
      `inked ${Math.round((countInked(puzzle.target) / cells) * 100)}%`
  );
  console.log(`tray: ${tray}`);
  console.log(targetToEmojiGrid(puzzle));
}
