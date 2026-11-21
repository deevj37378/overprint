// Every Redis key in one place (see "Redis keys" in OVERPRINT.md).
// `pkey` is a puzzle key: the UTC date for dailies, `print-{id}` for community prints.

export const keys = {
  puzzle: (date: string) => `puzzle:${date}`,
  daily: (date: string) => `daily:${date}`,
  post: (postId: string) => `post:${postId}`,
  sticky: (postId: string) => `sticky:${postId}`,
  solve: (pkey: string, userId: string) => `solve:${pkey}:${userId}`,
  start: (pkey: string, userId: string) => `start:${pkey}:${userId}`,
  shared: (pkey: string, userId: string) => `shared:${pkey}:${userId}`,
  leaderboard: (pkey: string) => `lb:${pkey}`,
  stats: (pkey: string) => `stats:${pkey}`,
  streak: (userId: string, year: number) => `streak:${userId}:${year}`,
  user: (userId: string) => `user:${userId}`,
  print: (printId: string) => `print:${printId}`,
  printsWeek: (isoWeek: string) => `prints:week:${isoWeek}`,
  shopLimit: (userId: string, date: string) => `shoplimit:${userId}:${date}`,
  sunday: (date: string) => `sunday:${date}`,
  wall: (month: string) => `wall:${month}`,
  wallMonths: () => 'wall:months',
};

/** Per-user daily data expires after 90 days (Devvit data-hygiene rule). */
export const USER_DATA_TTL_S = 90 * 24 * 60 * 60;
export const userDataExpiry = (nowMs: number): Date =>
  new Date(nowMs + USER_DATA_TTL_S * 1000);
