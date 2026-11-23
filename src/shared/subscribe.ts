// "Join the print shop": subscribing as the user needs the app to be approved by Reddit. In
// playtest and unapproved installs, reddit.subscribeToCurrentSubreddit() fails with
// "permission not granted for [SUBSCRIBE_TO_SUBREDDIT]". We still try it first, and when that is
// the reason, the client opens the subreddit so the player can tap Reddit's own Join button.

export type SubscribeFailure = 'needs-approval' | 'failed';

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error;
    return typeof message === 'string' ? message : '';
  }
  return '';
};

/** Why a subscribe call failed: missing approval (fall back to Reddit's Join) or anything else. */
export const subscribeFailure = (error: unknown): SubscribeFailure => {
  const message = messageOf(error);
  return /SUBSCRIBE_TO_SUBREDDIT/i.test(message) ||
    /permission not granted/i.test(message)
    ? 'needs-approval'
    : 'failed';
};

export const subredditUrl = (name: string): string =>
  `https://www.reddit.com/r/${encodeURIComponent(name)}/`;
