// Vite plugin that turns the dev server into a local Reddit stand-in:
// - /api/* and /internal/* run the REAL Hono app (src/server/app.ts) against in-memory fakes
// - /__preview/* drives the harness (fake date, user, post, menu items, scheduler, outbox)
// - @devvit/* imports are swapped for fakes, and src/server/core/clock.ts for a fake clock.

import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import {
  FAKE_USERS,
  logOutbox,
  previewState,
  resetPreviewState,
  SUBREDDIT,
  type FakeUser,
} from './state.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const fake = (file: string) => path.resolve(here, file);
const MODERATOR = FAKE_USERS[0];

type HonoApp = { fetch: (request: Request) => Response | Promise<Response> };

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const cookies = (req: IncomingMessage): Map<string, string> => {
  const out = new Map<string, string>();
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name) out.set(name, decodeURIComponent(rest.join('=')));
  }
  return out;
};

const userFrom = (jar: Map<string, string>): FakeUser | null => {
  const id = jar.get('op_user');
  if (id === 'out') return null;
  return FAKE_USERS.find((u) => u.id === id) ?? MODERATOR ?? null;
};

const latestPostId = (): string | null => {
  const posts = [...previewState().posts.values()].sort(
    (a, b) => b.createdAt - a.createdAt
  );
  return posts[0]?.id ?? null;
};

const postFrom = (jar: Map<string, string>): string | null => {
  const id = jar.get('op_post');
  return id && previewState().posts.has(id) ? id : latestPostId();
};

/** The client-side Devvit context for the current harness selection, as a cookie. */
const clientContextCookie = (
  user: FakeUser | null,
  postId: string | null
): string => {
  const post = postId ? previewState().posts.get(postId) : undefined;
  const value = JSON.stringify({
    postId: post?.id,
    postData: post?.postData,
    userId: user?.id,
    username: user?.name,
    subredditName: SUBREDDIT.name,
    subredditId: SUBREDDIT.id,
  });
  return `op_ctx=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
};

const loadApp = async (server: ViteDevServer): Promise<HonoApp> => {
  const mod: { app?: HonoApp } =
    await server.ssrLoadModule('/src/server/app.ts');
  if (!mod.app) throw new Error('src/server/app.ts must export `app`');
  return mod.app;
};

const callApp = async (
  server: ViteDevServer,
  method: string,
  url: string,
  body: string | Buffer | undefined,
  as: { user: FakeUser | null; postId: string | null }
): Promise<Response> => {
  previewState().request = as;
  const app = await loadApp(server);
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : new Uint8Array(body);
  }
  return app.fetch(new Request(`http://preview.local${url}`, init));
};

const sendJson = (
  res: ServerResponse,
  status: number,
  value: unknown,
  extraCookie?: string
) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  if (extraCookie) res.setHeader('set-cookie', extraCookie);
  res.end(JSON.stringify(value));
};

/** Menu items, forms and scheduler tasks, read live from devvit.json. */
const devvitConfig = (): unknown =>
  JSON.parse(readFileSync(path.join(root, 'devvit.json'), 'utf8'));

const ACTIONS = [
  { id: 'seed', label: 'Add 6 fake players' },
  { id: 'solve', label: 'Mark me solved' },
  { id: 'first-play', label: 'First-ever play' },
  { id: 'unapproved', label: 'Toggle: Join needs approval' },
];

const SEED_NAMES = [
  'ink_blot',
  'misregistered',
  'halftone_hal',
  'duotone_dee',
  'pressroom_pat',
  'kraft_paper',
];

type PuzzleModule = {
  currentPostData: () => Promise<unknown>;
  loadPuzzleFor: (
    data: unknown
  ) => Promise<{ puzzle: { solution: unknown[] } } | null>;
};

/** Solve the current post's puzzle as someone, through the real /api/solve. */
const solveAs = async (
  server: ViteDevServer,
  user: FakeUser,
  postId: string | null,
  timeMs: number,
  lifts: number
) => {
  previewState().request = { user, postId };
  const mod: Partial<PuzzleModule> = await server.ssrLoadModule(
    '/src/server/core/puzzles.ts'
  );
  if (!mod.currentPostData || !mod.loadPuzzleFor) return;
  const data = await mod.currentPostData();
  if (!data) return;
  const loaded = await mod.loadPuzzleFor(data);
  if (!loaded) return;
  // No /api/start for fake players, so the server takes their reported time (within limits).
  await callApp(
    server,
    'POST',
    '/api/solve',
    JSON.stringify({ placements: loaded.puzzle.solution, timeMs, lifts }),
    {
      user,
      postId,
    }
  );
};

const runAction = async (
  server: ViteDevServer,
  id: string,
  jar: Map<string, string>
) => {
  const postId = postFrom(jar);
  const me = userFrom(jar);
  if (id === 'seed') {
    for (const [i, name] of SEED_NAMES.entries()) {
      await solveAs(
        server,
        { id: `t2_seed${i}`, name },
        postId,
        25_000 + i * 17_000,
        i % 3
      );
    }
  } else if (id === 'unapproved') {
    const state = previewState();
    state.subscribeNeedsApproval = !state.subscribeNeedsApproval;
    logOutbox(
      'subscribe',
      state.subscribeNeedsApproval
        ? 'simulating an unapproved app: Join will fall back to the subreddit'
        : 'simulating an approved app: Join subscribes'
    );
  } else if (id === 'solve' && me) {
    await solveAs(server, me, postId, 48_000, 1);
  } else if (id === 'first-play' && me) {
    previewState().redis.delete(`user:${me.id}`);
  }
};

const harnessState = (jar: Map<string, string>) => {
  const state = previewState();
  return {
    actions: ACTIONS,
    config: devvitConfig(),
    fakeDate: state.fakeDate,
    realDate: new Date().toISOString().slice(0, 10),
    users: FAKE_USERS,
    userId: userFrom(jar)?.id ?? 'out',
    postId: postFrom(jar),
    posts: [...state.posts.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => ({
        id: p.id,
        title: p.title,
        author: p.authorName,
        postData: p.postData,
      })),
    outbox: state.outbox.slice(0, 60),
  };
};

type Hook = (server: ViteDevServer) => Promise<void>;

const handleHarness = async (
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  onReset: Hook
) => {
  const jar = cookies(req);
  const raw = (await readBody(req)).toString('utf8');
  const body: Record<string, unknown> = raw ? JSON.parse(raw) : {};

  if (route === '/state' && req.method === 'POST') {
    const state = previewState();
    if (typeof body.fakeDate === 'string')
      state.fakeDate = body.fakeDate || null;
    const userId =
      typeof body.userId === 'string' ? body.userId : jar.get('op_user');
    const postId =
      typeof body.postId === 'string' ? body.postId : postFrom(jar);
    if (userId) jar.set('op_user', userId);
    if (postId) jar.set('op_post', postId);
    const cookieList = [
      `op_user=${encodeURIComponent(userId ?? MODERATOR?.id ?? '')}; Path=/; SameSite=Lax`,
      `op_post=${encodeURIComponent(postId ?? '')}; Path=/; SameSite=Lax`,
      clientContextCookie(userFrom(jar), postFrom(jar)),
    ];
    res.setHeader('set-cookie', cookieList);
    return sendJson(res, 200, harnessState(jar));
  }
  if (route === '/state') return sendJson(res, 200, harnessState(jar));

  if (route === '/action') {
    await runAction(server, String(body.id ?? ''), jar);
    return sendJson(res, 200, harnessState(jar));
  }

  if (route === '/reset') {
    resetPreviewState();
    await onReset(server);
    return sendJson(
      res,
      200,
      harnessState(jar),
      clientContextCookie(userFrom(jar), latestPostId())
    );
  }

  // Run a menu item, form submit or scheduler task exactly as Reddit would call it.
  if (route === '/internal') {
    const endpoint = String(body.endpoint ?? '');
    const asModerator = { user: MODERATOR ?? null, postId: postFrom(jar) };
    const response = await callApp(
      server,
      'POST',
      endpoint,
      JSON.stringify(body.payload ?? {}),
      asModerator
    );
    const text = await response.text();
    return sendJson(
      res,
      response.status,
      { status: response.status, body: text ? JSON.parse(text) : null },
      clientContextCookie(userFrom(jar), latestPostId())
    );
  }

  return sendJson(res, 404, { error: `Unknown harness route ${route}` });
};

/** Create today's daily post on a fresh harness, as the moderator menu item would. */
const seedPosts: Hook = async (server) => {
  if (previewState().posts.size > 0) return;
  try {
    await callApp(server, 'POST', '/internal/menu/post-create', '{}', {
      user: MODERATOR ?? null,
      postId: null,
    });
  } catch (error) {
    console.error('[preview] could not seed the first post', error);
  }
};

export const overprintPreview = (): Plugin => ({
  name: 'overprint-preview',
  enforce: 'pre',
  resolveId(source, importer) {
    if (
      importer &&
      importer.startsWith(path.join(root, 'src/server')) &&
      /(^|\/)clock(\.ts)?$/.test(source)
    ) {
      return fake('fake-clock.ts');
    }
    return null;
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? '/';
      const pathname = url.split('?')[0] ?? '/';
      if (pathname === '/' || pathname === '/index.html') {
        res.statusCode = 302;
        res.setHeader('location', '/preview/');
        res.end();
        return;
      }
      const run = async () => {
        await seedPosts(server);
        const jar = cookies(req);
        if (pathname.startsWith('/__preview/')) {
          await handleHarness(
            server,
            req,
            res,
            pathname.slice('/__preview'.length),
            seedPosts
          );
          return;
        }
        if (pathname.startsWith('/api/') || pathname.startsWith('/internal/')) {
          const body = await readBody(req);
          const response = await callApp(
            server,
            req.method ?? 'GET',
            url,
            body,
            {
              user: userFrom(jar),
              postId: postFrom(jar),
            }
          );
          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }
        if (pathname.endsWith('.html')) {
          res.setHeader(
            'set-cookie',
            clientContextCookie(userFrom(jar), postFrom(jar))
          );
        }
        next();
      };
      run().catch((error: unknown) => {
        console.error('[preview]', error);
        sendJson(res, 500, { status: 'error', message: String(error) });
      });
    });
  },
});
