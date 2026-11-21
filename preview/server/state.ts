// Process-wide state for the preview harness. Lives on globalThis so it survives
// Vite reloading the server modules on every edit.

export type FakePost = {
  id: string;
  title: string;
  permalink: string;
  authorName: string;
  postData: Record<string, unknown> | undefined;
  score: number;
  createdAt: number;
  entry: string;
};

export type OutboxItem = {
  at: number;
  kind: string;
  detail: string;
};

export type FakeUser = { id: string; name: string };

export type RedisEntry =
  | { kind: 'string'; value: string; expiresAt: number | null }
  | { kind: 'hash'; value: Map<string, string>; expiresAt: number | null }
  | { kind: 'zset'; value: Map<string, number>; expiresAt: number | null }
  | { kind: 'bits'; value: Map<number, number>; expiresAt: number | null };

export type PreviewState = {
  redis: Map<string, RedisEntry>;
  posts: Map<string, FakePost>;
  outbox: OutboxItem[];
  /** 'YYYY-MM-DD' the fake clock reports, or null for the real date. */
  fakeDate: string | null;
  /** Who is making the current request, and from which post. */
  request: { user: FakeUser | null; postId: string | null };
  nextId: number;
};

declare global {
  var __overprintPreview: PreviewState | undefined;
}

const fresh = (): PreviewState => ({
  redis: new Map(),
  posts: new Map(),
  outbox: [],
  fakeDate: null,
  request: { user: null, postId: null },
  nextId: 1,
});

export const previewState = (): PreviewState => {
  globalThis.__overprintPreview ??= fresh();
  return globalThis.__overprintPreview;
};

export const resetPreviewState = (): void => {
  const keepDate = globalThis.__overprintPreview?.fakeDate ?? null;
  globalThis.__overprintPreview = { ...fresh(), fakeDate: keepDate };
};

export const logOutbox = (kind: string, detail: string): void => {
  const state = previewState();
  state.outbox.unshift({ at: Date.now(), kind, detail });
  state.outbox.length = Math.min(state.outbox.length, 200);
  console.log(`[preview] ${kind}: ${detail}`);
};

export const newId = (prefix: string): string => {
  const state = previewState();
  return `${prefix}${(state.nextId++).toString(36)}`;
};

export const FAKE_USERS: FakeUser[] = [
  { id: 't2_preview1', name: 'riso_rookie' },
  { id: 't2_preview2', name: 'second_printer' },
];

export const SUBREDDIT = { id: 't5_preview', name: 'overprint_preview' };
