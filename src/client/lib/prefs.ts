// Player preferences: remembered on the server for logged-in players, in localStorage otherwise.

import { useCallback, useState } from 'react';
import type { Prefs } from '../../shared/api';
import { api } from './api';

const KEY = 'overprint.prefs';

const readLocal = (): Prefs => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const obj = typeof parsed === 'object' && parsed !== null ? parsed : {};
    return {
      tutorialDone: 'tutorialDone' in obj && obj.tutorialDone === true,
      colourBlind: 'colourBlind' in obj && obj.colourBlind === true,
    };
  } catch {
    return { tutorialDone: false, colourBlind: false };
  }
};

const writeLocal = (prefs: Prefs) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable in some webviews; prefs then last for the session.
  }
};

export const usePrefs = () => {
  const [prefs, setPrefs] = useState<Prefs>(readLocal);

  /** Merge in what the server remembers (logged in): either source saying "done" wins. */
  const adoptServer = useCallback((server: Prefs, loggedIn: boolean) => {
    if (!loggedIn) return;
    setPrefs((local) => {
      const merged = {
        tutorialDone: local.tutorialDone || server.tutorialDone,
        colourBlind: server.colourBlind,
      };
      writeLocal(merged);
      return merged;
    });
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writeLocal(next);
      return next;
    });
    void api.prefs(patch).catch(() => {});
  }, []);

  return { prefs, adoptServer, update };
};
