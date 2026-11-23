// Stand-in for `@devvit/web/server` in the preview harness. Only what Overprint uses.
// Every outward action (posting, commenting, flair, subscribing) is written to the outbox
// so the harness toolbar can show exactly what would have happened on Reddit.

import { redis } from './fake-redis.ts';
import {
  logOutbox,
  newId,
  previewState,
  SUBREDDIT,
  type FakePost,
} from './state.ts';

export { redis };

const currentPost = (): FakePost | undefined => {
  const { postId } = previewState().request;
  return postId ? previewState().posts.get(postId) : undefined;
};

export const context = {
  get userId() {
    return previewState().request.user?.id;
  },
  get username() {
    return previewState().request.user?.name;
  },
  get postId() {
    return currentPost()?.id;
  },
  get postData() {
    return currentPost()?.postData;
  },
  subredditId: SUBREDDIT.id,
  subredditName: SUBREDDIT.name,
  appName: 'overprint-colors',
  appSlug: 'overprint-colors',
  appVersion: '0.0.0-preview',
  loid: undefined,
  commentId: undefined,
  snoovatar: undefined,
};

type FakeComment = {
  id: string;
  body: string;
  permalink: string;
  distinguish: (sticky?: boolean) => Promise<void>;
};

const makeComment = (
  postId: string,
  text: string,
  who: string
): FakeComment => {
  const id = newId('t1_');
  const post = previewState().posts.get(postId);
  return {
    id,
    body: text,
    permalink: `${post?.permalink ?? ''}${id.slice(3)}/`,
    distinguish: async (sticky?: boolean) => {
      logOutbox(
        'comment.distinguish',
        `${id} sticky=${String(sticky ?? false)} (as ${who})`
      );
    },
  };
};

const postObject = (post: FakePost) => ({
  id: post.id,
  title: post.title,
  permalink: post.permalink,
  url: `https://www.reddit.com${post.permalink}`,
  authorName: post.authorName,
  get score() {
    return post.score;
  },
  createdAt: new Date(post.createdAt),
  addComment: async (opts: { text: string; runAs?: 'USER' | 'APP' }) => {
    const who =
      opts.runAs === 'USER' ? `u/${context.username ?? '?'}` : 'the app';
    logOutbox('comment', `on ${post.id} as ${who}: ${opts.text}`);
    return makeComment(post.id, opts.text, who);
  },
  delete: async () => {
    previewState().posts.delete(post.id);
    logOutbox('post.delete', post.id);
  },
  setPostData: async (data: Record<string, unknown>) => {
    post.postData = data;
  },
});

export const reddit = {
  async submitCustomPost(opts: {
    title: string;
    postData?: Record<string, unknown>;
    runAs?: 'USER' | 'APP';
    entry?: string;
    userGeneratedContent?: { text: string };
  }) {
    const id = newId('t3_');
    const author =
      opts.runAs === 'USER'
        ? (context.username ?? 'unknown')
        : 'overprint-colors';
    const post: FakePost = {
      id,
      title: opts.title,
      permalink: `/r/${SUBREDDIT.name}/comments/${id.slice(3)}/`,
      authorName: author,
      postData: opts.postData,
      score: 1,
      createdAt: Date.now(),
      entry: opts.entry ?? 'default',
    };
    previewState().posts.set(id, post);
    logOutbox(
      'post',
      `"${opts.title}" as ${opts.runAs === 'USER' ? `u/${author}` : 'the app'}` +
        (opts.userGeneratedContent
          ? ` (UGC: ${opts.userGeneratedContent.text})`
          : '')
    );
    return postObject(post);
  },
  async getPostById(id: string) {
    const post = previewState().posts.get(id);
    if (!post) throw new Error(`No such post ${id}`);
    return postObject(post);
  },
  async submitComment(opts: {
    id: string;
    text: string;
    runAs?: 'USER' | 'APP';
  }) {
    const who =
      opts.runAs === 'USER' ? `u/${context.username ?? '?'}` : 'the app';
    logOutbox('comment', `reply to ${opts.id} as ${who}:\n${opts.text}`);
    const postId = opts.id.startsWith('t3_') ? opts.id : (context.postId ?? '');
    return makeComment(postId, opts.text, who);
  },
  async setUserFlair(opts: { username: string; text?: string }) {
    logOutbox('flair', `u/${opts.username} → "${opts.text ?? ''}"`);
  },
  async subscribeToCurrentSubreddit() {
    if (previewState().subscribeNeedsApproval) {
      logOutbox('subscribe', 'refused: app not approved (simulated)');
      throw new Error('permission not granted for [SUBSCRIBE_TO_SUBREDDIT]');
    }
    logOutbox(
      'subscribe',
      `u/${context.username ?? '?'} joined r/${SUBREDDIT.name}`
    );
  },
  async getCurrentUsername() {
    return context.username;
  },
  async getCurrentUser() {
    const user = previewState().request.user;
    return user ? { id: user.id, username: user.name } : undefined;
  },
};

export const scheduler = {
  async runJob(job: { name: string }) {
    logOutbox('scheduler.runJob', job.name);
    return newId('job_');
  },
  async cancelJob(id: string) {
    logOutbox('scheduler.cancelJob', id);
  },
  async listJobs() {
    return [];
  },
};

export const createServer = (): never => {
  throw new Error('createServer is not used in the preview harness');
};
export const getServerPort = (): number => 0;
