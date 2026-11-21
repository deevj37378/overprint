// Stand-in for `@devvit/web/client` in the preview harness.
// Context comes from the `op_ctx` cookie the harness sets; effects are sent to the harness
// shell (when inside its iframe) or handled in-page (when a page is opened on its own).

import type * as Real from '@devvit/web/client';

type Effect =
  | { type: 'navigate'; url: string }
  | { type: 'expand'; entry: string }
  | { type: 'exit' }
  | { type: 'toast'; text: string }
  | { type: 'form'; id: string; form: unknown }
  | { type: 'share'; text: string }
  | { type: 'login' };

const readContext = (): Record<string, unknown> => {
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith('op_ctx='));
  if (!match) return {};
  try {
    const parsed: unknown = JSON.parse(
      decodeURIComponent(match.slice('op_ctx='.length))
    );
    return typeof parsed === 'object' && parsed !== null ? { ...parsed } : {};
  } catch {
    return {};
  }
};

const raw = readContext();
const str = (key: string): string | undefined => {
  const value = raw[key];
  return typeof value === 'string' ? value : undefined;
};
const postData = raw.postData;

export const context = {
  postId: str('postId'),
  postData:
    typeof postData === 'object' && postData !== null ? postData : undefined,
  userId: str('userId'),
  username: str('username'),
  subredditName: str('subredditName'),
  subredditId: str('subredditId'),
  appName: 'overprint-colors',
  appSlug: 'overprint-colors',
  appVersion: '0.0.0-preview',
  loid: undefined,
  commentId: undefined,
  snoovatar: undefined,
  client: undefined,
  postAuthorId: undefined,
};

const inShell = window.parent !== window;

const toastInPage = (text: string) => {
  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1f1a17;color:#f4efe6;' +
    'padding:10px 16px;border-radius:999px;font:600 14px system-ui;z-index:99999;max-width:90vw';
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
};

const pendingForms = new Map<
  string,
  (values: Record<string, unknown> | null) => void
>();
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const data = event.data;
  if (typeof data !== 'object' || data === null || !('opFormResult' in data))
    return;
  const id = 'id' in data && typeof data.id === 'string' ? data.id : '';
  const values =
    'values' in data && typeof data.values === 'object' ? data.values : null;
  pendingForms.get(id)?.(
    values && typeof values === 'object' ? { ...values } : null
  );
  pendingForms.delete(id);
});

const send = (effect: Effect) => {
  if (inShell) {
    window.parent.postMessage({ opEffect: effect }, '*');
    return;
  }
  if (effect.type === 'expand')
    location.href = `/src/client/${entryFile(effect.entry)}`;
  else if (effect.type === 'exit') location.href = '/src/client/splash.html';
  else if (effect.type === 'toast') toastInPage(effect.text);
  else if (effect.type === 'navigate') toastInPage(`Would open ${effect.url}`);
  else if (effect.type === 'share') toastInPage(`Share sheet: ${effect.text}`);
  else if (effect.type === 'login')
    toastInPage('Would show the Reddit log-in prompt');
};

const ENTRIES: Record<string, string> = {
  default: 'splash.html',
  game: 'game.html',
  shop: 'shop.html',
  gallery: 'gallery.html',
};
const entryFile = (entry: string): string => ENTRIES[entry] ?? `${entry}.html`;

export const navigateTo: typeof Real.navigateTo = (url) => {
  send({ type: 'navigate', url: typeof url === 'string' ? url : url.url });
};

export const navigateToPost: typeof Real.navigateToPost = (postId) => {
  send({ type: 'navigate', url: `post ${postId}` });
};

export const requestExpandedMode: typeof Real.requestExpandedMode = (
  _event,
  entry
) => {
  send({ type: 'expand', entry });
};

export const exitExpandedMode: typeof Real.exitExpandedMode = () => {
  send({ type: 'exit' });
};

export const getWebViewMode: typeof Real.getWebViewMode = () =>
  location.pathname.endsWith('/splash.html') ? 'inline' : 'expanded';

export const addWebViewModeListener: typeof Real.addWebViewModeListener =
  () => {};
export const removeWebViewModeListener: typeof Real.removeWebViewModeListener =
  () => {};

export const showToast = (toast: string | { text: string }): void => {
  send({ type: 'toast', text: typeof toast === 'string' ? toast : toast.text });
};

export const showShareSheet: typeof Real.showShareSheet = async (opts) => {
  send({ type: 'share', text: opts.text ?? opts.data ?? '' });
};

export const getShareData: typeof Real.getShareData = () => undefined;

export const showLoginPrompt: typeof Real.showLoginPrompt = () => {
  send({ type: 'login' });
};

export const canRunAsUser: typeof Real.canRunAsUser = async () => true;

/** Forms are drawn by the harness shell; on a standalone page they resolve as cancelled. */
export const showForm = (
  form: unknown
): Promise<
  | { action: 'CANCELED' }
  | { action: 'SUBMITTED'; values: Record<string, unknown> }
> => {
  if (!inShell) return Promise.resolve({ action: 'CANCELED' });
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    pendingForms.set(id, (values) =>
      resolve(values ? { action: 'SUBMITTED', values } : { action: 'CANCELED' })
    );
    send({ type: 'form', id, form });
  });
};
