import { context, redis } from '@devvit/web/server';
import type { PuzzleView } from '../../shared/api';
import {
  dailyPrint,
  dailyPostTitle,
  utcDateOf,
  type DailyPrint,
} from '../../shared/daily';
import {
  encodeTarget,
  parsePostData,
  puzzleKey,
  type OverprintPostData,
} from '../../shared/postdata';
import type { Puzzle } from '../../shared/puzzle';
import { nowMs } from './clock';
import { keys } from './keys';

/** The daily print for a date, cached in Redis (generation can take ~100 ms cold). */
export const getDailyPrint = async (date: string): Promise<DailyPrint> => {
  const cached = await redis.get(keys.puzzle(date));
  if (cached) {
    const parsed: DailyPrint = JSON.parse(cached);
    if (parsed.date === date) return parsed;
  }
  const print = dailyPrint(date);
  await redis.set(keys.puzzle(date), JSON.stringify(print));
  return print;
};

export const dailyPostData = (print: DailyPrint): OverprintPostData => ({
  kind: 'daily',
  date: print.date,
  number: print.number,
  size: print.size,
  target: encodeTarget(print.target),
  title: dailyPostTitle(print.date, print.number),
  maker: null,
  printId: null,
});

/** Post data for the current request's post: from the Devvit context, else from Redis. */
export const currentPostData = async (): Promise<OverprintPostData | null> => {
  const fromContext = parsePostData(context.postData);
  if (fromContext) return fromContext;
  const { postId } = context;
  if (!postId) return null;
  const stored = await redis.get(keys.post(postId));
  return stored ? parsePostData(JSON.parse(stored)) : null;
};

export type LoadedPuzzle = {
  data: OverprintPostData;
  pkey: string;
  /** Full puzzle including the solution: server-side only. */
  puzzle: Puzzle;
  view: PuzzleView;
};

/** A stored community print (Print Shop). */
export type StoredPrint = {
  id: string;
  size: number;
  tray: Puzzle['tray'];
  target: Puzzle['target'];
  solution: Puzzle['solution'];
  title: string;
  maker: string;
  makerId: string;
  postId: string | null;
  permalink: string | null;
  createdAt: number;
  date: string;
};

export const getStoredPrint = async (
  printId: string
): Promise<StoredPrint | null> => {
  const raw = await redis.get(keys.print(printId));
  if (!raw) return null;
  const parsed: StoredPrint = JSON.parse(raw);
  return parsed;
};

/** Load the puzzle a post plays, including the solution (for verification). */
export const loadPuzzleFor = async (
  data: OverprintPostData
): Promise<LoadedPuzzle | null> => {
  const today = utcDateOf(nowMs());
  const pkey = puzzleKey(data);
  let puzzle: Puzzle;
  let maker = data.maker;
  if (data.printId) {
    const print = await getStoredPrint(data.printId);
    if (!print) return null;
    puzzle = {
      date: data.date,
      number: data.number ?? 0,
      size: print.size,
      tray: print.tray,
      target: print.target,
      solution: print.solution,
    };
    maker = print.maker;
  } else {
    const print = await getDailyPrint(data.date);
    puzzle = { ...print, number: print.number ?? 0 };
  }
  const isDaily = data.kind === 'daily';
  return {
    data,
    pkey,
    puzzle,
    view: {
      key: pkey,
      kind: data.kind,
      date: data.date,
      number: data.number,
      size: puzzle.size,
      tray: [...puzzle.tray],
      target: puzzle.target.map((line) => [...line]),
      title: data.title,
      maker,
      isToday: isDaily && data.date === today,
      isArchive: isDaily && data.date < today,
    },
  };
};
