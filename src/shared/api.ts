// Request/response contracts between the client and the server. Types only.

import type { Sheet, Stamp } from './sheet.ts';
import type { ShapeId, Rotation } from './shapes.ts';
import type { Ink } from './ink.ts';

export type PuzzleKind = 'daily' | 'community';

export type ErrorResponse = { status: 'error'; message: string; code?: string };

/** What the client needs to play: never includes the solution. */
export type PuzzleView = {
  /** Storage key: the UTC date for dailies, `print-{id}` for community prints. */
  key: string;
  kind: PuzzleKind;
  date: string;
  /** Puzzle number, or null for pre-launch previews and community prints. */
  number: number | null;
  size: number;
  tray: Stamp[];
  target: Sheet;
  title: string;
  /** Who printed it: a username for community prints, null for the house generator. */
  maker: string | null;
  /** A daily whose date is today (UTC): solving it counts for the streak. */
  isToday: boolean;
  /** An older daily: playable, but it doesn't change today's streak. */
  isArchive: boolean;
};

export type PuzzleResponse = { status: 'ok'; puzzle: PuzzleView };

export type Prefs = { tutorialDone: boolean; colourBlind: boolean };

export type Streak = { current: number; best: number };

export type SolveSummary = { timeMs: number; lifts: number; clean: boolean };

export type MeResponse = {
  status: 'ok';
  loggedIn: boolean;
  username: string | null;
  /** This user's counted solve of this post's puzzle, if any. */
  solve: SolveSummary | null;
  streak: Streak | null;
  prefs: Prefs;
  /** Joined the subreddit through the app (we can't read real subscription state). */
  subscribed: boolean;
};

export type StartResponse = { status: 'ok' };

export type SolveRequest = {
  placements: unknown;
  timeMs: number;
  lifts: number;
};

export type SolveResult = {
  status: 'ok';
  timeMs: number;
  lifts: number;
  clean: boolean;
  score: number;
  loggedIn: boolean;
  /** True when this was the user's first solve of this puzzle (the one that counts). */
  counted: boolean;
  rank: number | null;
  total: number;
  /** "Faster than N% of printers today"; null when you're the only one so far. */
  percentile: number | null;
  streak: Streak | null;
  /** Whether this solve advanced today's streak. */
  streakCounted: boolean;
  emojiGrid: string;
  /** The exact comment text "Share to comments" would post. */
  shareText: string;
  shared: boolean;
  canShare: boolean;
};

export type SplashResponse = {
  status: 'ok';
  printedToday: number;
  loggedIn: boolean;
  streak: Streak | null;
  solve: SolveSummary | null;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  timeMs: number;
  lifts: number;
  clean: boolean;
  you: boolean;
};

export type LeaderboardResponse = {
  status: 'ok';
  top: LeaderboardEntry[];
  you: LeaderboardEntry | null;
  total: number;
};

export type ShareResponse = { status: 'ok'; alreadyShared: boolean };
/** `needs-approval`: the app can't subscribe users yet (playtest / unapproved), so the client
 *  opens the subreddit for Reddit's own Join button. The player is not marked as joined. */
export type SubscribeResponse =
  | { status: 'ok' }
  | { status: 'needs-approval'; subreddit: string; url: string };
export type PrefsResponse = { status: 'ok'; prefs: Prefs };

/** A stamp the player placed in the Print Shop editor. */
export type ShopStamp = {
  shape: ShapeId;
  ink: Ink;
  row: number;
  col: number;
  rotation: Rotation;
};

export type ShopPostRequest = {
  size: number;
  stamps: ShopStamp[];
  adjective: string;
  noun: string;
};

export type ShopPostResponse =
  | { status: 'ok'; postId: string; url: string; title: string }
  | { status: 'rejected'; reason: string };

export type ShopInfoResponse = {
  status: 'ok';
  loggedIn: boolean;
  username: string | null;
  postedToday: number;
  dailyLimit: number;
};

export type WallFrame = {
  day: number;
  date: string;
  number: number | null;
  maker: string | null;
  solves: number;
  size: number;
  target: Sheet;
  url: string | null;
  isToday: boolean;
};

export type GalleryResponse = {
  status: 'ok';
  month: string;
  today: string;
  /** Months with at least one frame, oldest first (always includes the current month). */
  months: string[];
  /** One entry per day of the month; null = no print that day (yet). */
  days: (WallFrame | null)[];
};
