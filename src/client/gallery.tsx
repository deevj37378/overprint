import './index.css';

import { navigateTo } from '@devvit/web/client';
import { memo, StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { GalleryResponse, WallFrame } from '../shared/api';
import { formatMonth, puzzleLabel } from '../shared/labels';
import { Inking, Jammed } from './ui/Status';
import { api, ApiError } from './lib/api';
import { usePrefs } from './lib/prefs';
import { ChevronIcon } from './ui/Icons';
import { PrintSheet } from './ui/PrintSheet';
import { Wordmark } from './ui/Wordmark';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayOf = (month: string, day: number) =>
  WEEKDAYS[
    new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, day)
    ).getUTCDay()
  ] ?? '';

/** One framed print. Memoised: the wall re-renders only when the month changes. */
const Frame = memo(function Frame({
  frame,
  day,
  month,
  isFuture,
  colourBlind,
}: {
  frame: WallFrame | null;
  day: number;
  month: string;
  isFuture: boolean;
  colourBlind: boolean;
}) {
  const caption = `${weekdayOf(month, day)} ${day}`;
  if (!frame) {
    return (
      <li
        className="flex list-none flex-col gap-1"
        aria-label={`${caption}: ${isFuture ? 'not printed yet' : 'no print'}`}
      >
        <div
          className={`flex aspect-square items-center justify-center rounded-[6px] border-2 border-dashed ${
            isFuture ? 'border-paper-edge/50' : 'border-paper-edge'
          }`}
        >
          <span
            className={`num text-[18px] ${isFuture ? 'text-paper-edge' : 'text-muted/60'}`}
          >
            {day}
          </span>
        </div>
        <p className="text-center text-[11px] text-muted/70">
          {isFuture ? caption : 'no print'}
        </p>
      </li>
    );
  }
  const label = `${puzzleLabel(frame.number)}, ${caption}, ${frame.maker ? `printed by u/${frame.maker}` : 'by Overprint'}, ${frame.solves} solved`;
  return (
    <li className="list-none">
      <button
        type="button"
        aria-label={`${label}. Open this post.`}
        disabled={!frame.url}
        onClick={() => frame.url && navigateTo(frame.url)}
        className="group flex w-full flex-col gap-1 text-left"
      >
        <div
          className={`relative rounded-[6px] bg-[#fbf8f2] p-[6%] shadow-[0_8px_14px_-10px_rgba(60,40,20,0.6)] ring-1 transition-transform group-active:scale-95 ${
            frame.isToday ? 'ring-2 ring-ink' : 'ring-paper-edge'
          }`}
        >
          <PrintSheet
            size={frame.size}
            sheet={frame.target}
            misregister
            colourBlind={colourBlind}
            label=""
          />
          {frame.isToday && (
            <span className="absolute -top-2 -right-1.5 rotate-[5deg] rounded-sm bg-riso-yellow px-1 text-[9px] font-extrabold uppercase tracking-[0.12em] mix-blend-multiply">
              today
            </span>
          )}
          {frame.maker && (
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-riso-pink px-1.5 text-[9px] font-extrabold text-white mix-blend-multiply">
              🎨
            </span>
          )}
        </div>
        <p className="flex items-baseline justify-between gap-1 text-[11px] leading-tight">
          <span className="num font-bold">{puzzleLabel(frame.number)}</span>
          <span className="num text-muted">✓{frame.solves}</span>
        </p>
        <p className="-mt-1 truncate text-[11px] leading-tight text-muted">
          {frame.maker ? `u/${frame.maker}` : caption}
        </p>
      </button>
    </li>
  );
});

export const Gallery = () => {
  const { prefs } = usePrefs();
  const [wall, setWall] = useState<GalleryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (month?: string) => {
    try {
      setWall(await api.gallery(month));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the wall.');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error)
    return <Jammed message={error} onRetry={() => void load(wall?.month)} />;
  if (!wall) return <Inking text="Hanging the prints…" />;

  const index = wall.months.indexOf(wall.month);
  const prev = index > 0 ? wall.months[index - 1] : undefined;
  const next =
    index >= 0 && index < wall.months.length - 1
      ? wall.months[index + 1]
      : undefined;
  const printed = wall.days.filter((d) => d !== null);
  const solves = printed.reduce((sum, d) => sum + d.solves, 0);
  const isCurrent = wall.month === wall.today.slice(0, 7);
  const todayDay = Number(wall.today.slice(8, 10));

  return (
    <div className="paper-grain min-h-dvh bg-paper text-ink">
      <main className="mx-auto flex w-full max-w-[920px] flex-col gap-4 px-4 pt-4 pb-10">
        <header className="flex flex-col items-center gap-1 text-center">
          <Wordmark className="text-[36px]" text="Gallery Wall" />
          <p className="text-[14px] text-muted">
            One print a day. A poster this community made together.
          </p>
        </header>

        <nav
          className="flex items-center justify-between rounded-full bg-paper-deep/70 p-1"
          aria-label="Month"
        >
          <button
            type="button"
            aria-label={
              prev
                ? `Previous month, ${formatMonth(prev)}`
                : 'No earlier months'
            }
            disabled={!prev}
            onClick={() => prev && void load(prev)}
            className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"
          >
            <ChevronIcon dir="left" />
          </button>
          <h2 className="text-[17px] font-extrabold" aria-live="polite">
            {formatMonth(wall.month)}
          </h2>
          <button
            type="button"
            aria-label={
              next ? `Next month, ${formatMonth(next)}` : 'No later months'
            }
            disabled={!next}
            onClick={() => next && void load(next)}
            className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"
          >
            <ChevronIcon />
          </button>
        </nav>

        <p className="text-center text-[13px] font-semibold text-muted num">
          {printed.length} {printed.length === 1 ? 'print' : 'prints'} ·{' '}
          {solves} {solves === 1 ? 'solve' : 'solves'}
        </p>

        <ol
          className="m-0 grid grid-cols-3 gap-x-3 gap-y-4 p-0 sm:grid-cols-5 lg:grid-cols-7"
          aria-label={`Prints for ${formatMonth(wall.month)}`}
        >
          {wall.days.map((frame, i) => (
            <Frame
              key={`${wall.month}-${i}`}
              frame={frame}
              day={i + 1}
              month={wall.month}
              isFuture={
                isCurrent
                  ? i + 1 > todayDay
                  : wall.month > wall.today.slice(0, 7)
              }
              colourBlind={prefs.colourBlind}
            />
          ))}
        </ol>
        <p className="text-center text-[13px] text-muted">
          Tap a print to open its post and play it from the archive.
        </p>
      </main>
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Gallery />
    </StrictMode>
  );
}
