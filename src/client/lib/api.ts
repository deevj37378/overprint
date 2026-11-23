// Typed calls to our own server (/api/*). Same-origin only: no outside network calls.

import type {
  ErrorResponse,
  GalleryResponse,
  LeaderboardResponse,
  MeResponse,
  Prefs,
  PrefsResponse,
  PuzzleResponse,
  ShareResponse,
  ShopInfoResponse,
  ShopPostRequest,
  ShopPostResponse,
  SolveRequest,
  SolveResult,
  SplashResponse,
  SubscribeResponse,
} from '../../shared/api';

export class ApiError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

type Ok =
  { status: 'ok' } | { status: 'rejected' } | { status: 'needs-approval' };

const request = async <T extends Ok>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(
      'No connection. Check your signal and try again.',
      'offline'
    );
  }
  const body: T | ErrorResponse = await res.json().catch((): ErrorResponse => ({
    status: 'error',
    message: `The press jammed (${res.status}).`,
  }));
  if (body.status === 'error') throw new ApiError(body.message, body.code);
  return body;
};

const post = <T extends Ok>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  puzzle: () => request<PuzzleResponse>('/api/puzzle'),
  me: () => request<MeResponse>('/api/me'),
  splash: () => request<SplashResponse>('/api/splash'),
  start: () => post<{ status: 'ok' }>('/api/start', {}),
  solve: (body: SolveRequest) => post<SolveResult>('/api/solve', body),
  result: () => request<SolveResult>('/api/result'),
  leaderboard: () => request<LeaderboardResponse>('/api/leaderboard'),
  share: () => post<ShareResponse>('/api/share', {}),
  subscribe: () => post<SubscribeResponse>('/api/subscribe', {}),
  prefs: (prefs: Partial<Prefs>) => post<PrefsResponse>('/api/prefs', prefs),
  shopInfo: () => request<ShopInfoResponse>('/api/shop'),
  shopPost: (body: ShopPostRequest) =>
    post<ShopPostResponse>('/api/shop/post', body),
  gallery: (month?: string) =>
    request<GalleryResponse>(
      `/api/gallery${month ? `?month=${encodeURIComponent(month)}` : ''}`
    ),
};
