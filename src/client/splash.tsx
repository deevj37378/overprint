import './index.css';

import {
  context,
  requestExpandedMode,
  showLoginPrompt,
} from '@devvit/web/client';
import {
  StrictMode,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { SplashResponse } from '../shared/api';
import { formatShortDate, puzzleLabel } from '../shared/labels';
import { decodeTarget, parsePostData } from '../shared/postdata';
import { PrintSheet } from './ui/PrintSheet';
import { Wordmark } from './ui/Wordmark';

// Everything visible on first paint comes from the post data: no network wait.
const data = parsePostData(context.postData);
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const Stat = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-paper-deep/80 px-2.5 py-1 text-[13px] font-semibold">
    {children}
  </span>
);

export const Splash = () => {
  const [info, setInfo] = useState<SplashResponse | null>(null);

  useEffect(() => {
    fetch('/api/splash')
      .then((res) => res.json())
      .then((body: SplashResponse | { status: 'error' }) => {
        if (body.status === 'ok') setInfo(body);
      })
      .catch(() => {});
  }, []);

  const open = (event: MouseEvent, entry: string) =>
    requestExpandedMode(event.nativeEvent, entry);
  const solved = info?.solve ?? null;
  const label = data
    ? data.kind === 'community'
      ? 'Community print'
      : `${puzzleLabel(data.number)} · ${formatShortDate(data.date)}`
    : 'Daily riso puzzle';

  return (
    <main className="paper-grain flex h-dvh min-h-[300px] flex-col items-center justify-between gap-2 overflow-hidden bg-paper px-5 pt-4 pb-4 text-ink">
      <header className="flex w-full items-center justify-between gap-3">
        <Wordmark className="text-[30px]" />
        <span className="num shrink-0 rounded-md border-2 border-ink px-2 py-0.5 text-[13px]">
          {label}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center py-1">
        {data ? (
          <div className="relative h-full max-h-[200px] rotate-[-2deg] rounded-[8px] bg-[#fbf8f2] p-2 shadow-[0_14px_24px_-16px_rgba(60,40,20,0.65)] ring-1 ring-paper-edge">
            <span className="absolute -top-2 -right-2 z-10 rotate-[6deg] rounded-sm bg-riso-yellow px-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] mix-blend-multiply">
              today
            </span>
            <PrintSheet
              size={data.size}
              sheet={decodeTarget(data.target, data.size)}
              lite
              label={`Today's print to recreate, ${data.size} by ${data.size}`}
              className="h-full max-h-[184px]"
            />
          </div>
        ) : (
          <p className="max-w-[260px] text-center text-[15px] text-muted">
            Layer coloured ink stamps so their overlaps recreate the print.
          </p>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-2.5">
        {data?.maker && (
          <p className="text-[13px] text-muted">printed by u/{data.maker}</p>
        )}
        <div
          className="flex flex-wrap items-center justify-center gap-1.5"
          aria-live="polite"
        >
          <Stat>
            {info && info.printedToday === 0 ? (
              <>
                🖨 Be the first printer{' '}
                {data?.kind === 'community' ? 'here' : 'today'}
              </>
            ) : (
              <>
                🖨 <span className="num">{info ? info.printedToday : '–'}</span>{' '}
                printed {data?.kind === 'community' ? 'so far' : 'today'}
              </>
            )}
          </Stat>
          {info?.streak && info.streak.current > 0 && (
            <Stat>
              🔥 <span className="num">{info.streak.current}</span>-day streak
            </Stat>
          )}
        </div>

        {solved ? (
          <>
            <p className="text-center text-[15px] font-semibold">
              Printed in <span className="num">{clock(solved.timeMs)}</span> ·{' '}
              <span className="num">{solved.lifts}</span>{' '}
              {solved.lifts === 1 ? 'lift' : 'lifts'}
              {solved.clean ? ' · ✦ clean' : ''}
            </p>
            <button
              type="button"
              onClick={(e) => open(e, 'game')}
              className="min-h-12 w-full max-w-[320px] rounded-full border-2 border-ink bg-[#fbf8f2] px-6 text-[16px] font-extrabold active:scale-[0.98]"
            >
              See your result
            </button>
            <p className="text-[13px] text-muted">
              {data?.kind === 'community'
                ? 'Nice printing.'
                : 'Come back tomorrow for a new print.'}
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => open(e, 'game')}
            className="min-h-12 w-full max-w-[320px] rounded-full bg-ink px-6 text-[17px] font-extrabold text-paper shadow-[0_4px_0_#000] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#000]"
          >
            Play
          </button>
        )}
        {info && !info.loggedIn && (
          <button
            type="button"
            onClick={() => showLoginPrompt()}
            className="text-[13px] font-semibold text-muted underline"
          >
            Log in to keep your streak
          </button>
        )}
      </div>
    </main>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Splash />
    </StrictMode>
  );
}
