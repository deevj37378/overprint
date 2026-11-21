import { redis } from '@devvit/web/server';
import type { Prefs } from '../../shared/api';
import { keys } from './keys';

export type UserRecord = Prefs & {
  best: number;
  subscribed: boolean;
  featured: boolean;
  flair: string;
};

export const getUser = async (userId: string): Promise<UserRecord> => {
  const h = await redis.hGetAll(keys.user(userId));
  return {
    tutorialDone: h.tutorialDone === '1',
    colourBlind: h.colourBlind === '1',
    best: Number(h.best ?? '0') || 0,
    subscribed: h.subscribed === '1',
    featured: h.featured === '1',
    flair: h.flair ?? '',
  };
};

export const setUserFields = async (
  userId: string,
  fields: Partial<
    Record<'tutorialDone' | 'colourBlind' | 'subscribed' | 'featured', boolean>
  > &
    Partial<{ best: number; flair: string }>
): Promise<void> => {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === 'boolean') out[name] = value ? '1' : '0';
    else if (value !== undefined) out[name] = String(value);
  }
  if (Object.keys(out).length > 0) {
    await redis.hSet(keys.user(userId), out);
    // Profiles fade out after a year without activity (data minimisation).
    await redis.expire(keys.user(userId), 365 * 24 * 60 * 60);
  }
};
