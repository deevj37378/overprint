import { context, reddit } from '@devvit/web/server';
import type { Streak } from '../../shared/api';
import { flairText } from '../../shared/streak';
import { getUser, setUserFields } from './users';

/** Set the streak flair as the app when it changes. Failures are quiet (flair is a nicety). */
export const refreshFlair = async (
  who: { userId: string; username: string },
  streak: Streak
): Promise<void> => {
  try {
    const user = await getUser(who.userId);
    const text = flairText(streak.current, user.featured);
    if (!text || text === user.flair) return;
    await reddit.setUserFlair({
      subredditName: context.subredditName,
      username: who.username,
      text,
    });
    await setUserFields(who.userId, { flair: text });
  } catch (error) {
    console.error('Could not set flair', error);
  }
};
