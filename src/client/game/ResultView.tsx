// The one end screen: the pulled print, your numbers, streak, emoji grid, leaderboard, and
// three separate, explicit choices (share, join, gallery). Nothing here happens automatically.

import {
  requestExpandedMode,
  showLoginPrompt,
  showToast,
} from '@devvit/web/client';
import { useEffect, useState, type ReactNode } from 'react';
import type {
  LeaderboardResponse,
  MeResponse,
  PuzzleView,
  SolveResult,
} from '../../shared/api';
import { formatShortDate, puzzleLabel } from '../../shared/labels';
import { api, ApiError } from '../lib/api';
import { formatClock } from '../play/usePlay';
import { PrintSheet } from '../ui/PrintSheet';
import { Wordmark } from '../ui/Wordmark';
import { ShareSheet } from './ShareSheet';

type Props = {
  puzzle: PuzzleView;
  me: MeResponse;
  result: SolveResult | null;
  submitError: string | null;
  colourBlind: boolean;
  headerTools?: ReactNode;
  onRetrySubmit: () => void;
  onReplay: () => void;
};

const Tile = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) => (
  <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl bg-[#fbf8f2] px-2 py-2.5 ring-1 ring-paper-edge">
    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
      {label}
    </span>
    <span className="num mt-0.5 text-[22px] leading-none">{value}</span>
    {sub && (
      <span className="mt-1 text-center text-[11px] leading-tight text-muted">
        {sub}
      </span>
    )}
  </div>
);

const CleanMark = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute right-[6%] bottom-[8%] rotate-[-14deg] rounded-md border-[3px] border-riso-pink px-2 py-0.5 text-center font-extrabold uppercase leading-none tracking-[0.12em] text-riso-pink mix-blend-multiply"
    style={{ fontSize: 'clamp(12px, 4.5vw, 20px)' }}
  >
    ✦ Clean
    <br />
    <span className="text-[0.6em] tracking-[0.2em]">print</span>
  </div>
);

export const ResultView = ({
  puzzle,
  me,
  result: initial,
  submitError,
  colourBlind,
  headerTools,
  onRetrySubmit,
  onReplay,
}: Props) => {
  const [result, setResult] = useState<SolveResult | null>(initial);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(initial?.shared ?? false);
  const [subscribed, setSubscribed] = useState(me.subscribed);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!initial && me.solve) {
      api
        .result()
        .then((r) => {
          setResult(r);
          setShared(r.shared);
        })
        .catch(() => {});
    }
    api
      .leaderboard()
      .then(setBoard)
      .catch(() => {});
  }, [initial, me.solve]);

  const summary = result ?? me.solve;
  const label =
    puzzle.kind === 'community'
      ? puzzle.title
      : `${puzzleLabel(puzzle.number)} · ${formatShortDate(puzzle.date)}`;
  const isDaily = puzzle.kind === 'daily';

  const join = async () => {
    setJoining(true);
    try {
      await api.subscribe();
      setSubscribed(true);
      showToast({ text: 'Welcome to the print shop!', appearance: 'success' });
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : 'Could not join right now.'
      );
    } finally {
      setJoining(false);
    }
  };

  let rankLine: ReactNode = null;
  if (result && result.loggedIn && result.percentile === 100) {
    rankLine = <>fastest so far!</>;
  } else if (result && result.loggedIn && result.percentile !== null) {
    rankLine = <>faster than {result.percentile}% of printers</>;
  } else if (result && result.loggedIn && result.total <= 1) {
    rankLine = <>first printer {isDaily ? 'today' : 'here'}!</>;
  } else if (result && !result.loggedIn && result.percentile !== null) {
    rankLine = <>would beat {result.percentile}% · log in to rank</>;
  }

  return (
    <div className="paper-grain min-h-dvh bg-paper text-ink">
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-1 lg:px-6 lg:pt-4">
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-muted">
          <span className="text-ink">{label}</span>
          {puzzle.maker ? <> · printed by u/{puzzle.maker}</> : null}
        </p>
        <div className="flex items-center">{headerTools}</div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pt-2 pb-8">
        <section className="slide-up flex flex-col items-center gap-1 text-center">
          <Wordmark
            className="text-[40px]"
            text={summary?.clean ? 'Clean print!' : 'Printed!'}
          />
          {result && !result.counted && result.loggedIn && (
            <p className="text-[13px] font-semibold text-muted">
              {me.solve
                ? 'Your first print of this one is the one that counts.'
                : 'Replay · not counted'}
            </p>
          )}
          {puzzle.isArchive && (
            <p className="text-[13px] text-muted">
              From the archive · doesn’t affect your streak
            </p>
          )}
        </section>

        <section
          className="slide-up relative mx-auto w-[min(78vw,300px)] rotate-[-1.5deg] rounded-[8px] bg-[#fbf8f2] p-2.5 shadow-[0_18px_30px_-18px_rgba(60,40,20,0.7)] ring-1 ring-paper-edge"
          style={{ animationDelay: '80ms' }}
        >
          <PrintSheet
            size={puzzle.size}
            sheet={puzzle.target}
            colourBlind={colourBlind}
            label="Your finished print"
          />
          {summary?.clean && <CleanMark />}
        </section>

        {submitError && (
          <div className="rounded-xl bg-riso-pink/15 p-3 text-center">
            <p className="text-[15px] font-semibold">{submitError}</p>
            <button
              type="button"
              onClick={onRetrySubmit}
              className="mt-2 font-bold underline"
            >
              Try saving again
            </button>
          </div>
        )}

        {summary && (
          <section
            className="slide-up flex gap-2"
            style={{ animationDelay: '160ms' }}
          >
            <Tile
              label="Time"
              value={formatClock(summary.timeMs)}
              sub={rankLine}
            />
            <Tile
              label="Lifts"
              value={summary.lifts}
              sub={summary.clean ? '✦ clean print' : 'fewer is better'}
            />
            {isDaily && result?.streak ? (
              <Tile
                label="Streak"
                value={<>🔥{result.streak.current}</>}
                sub={<>best {result.streak.best}</>}
              />
            ) : isDaily && me.streak ? (
              <Tile
                label="Streak"
                value={<>🔥{me.streak.current}</>}
                sub={<>best {me.streak.best}</>}
              />
            ) : null}
          </section>
        )}

        {!me.loggedIn && (
          <button
            type="button"
            onClick={() => showLoginPrompt()}
            className="rounded-xl border-2 border-dashed border-ink/40 px-3 py-2.5 text-[14px] font-semibold"
          >
            Log in to keep a streak and get on the leaderboard
          </button>
        )}

        <section
          className="slide-up flex flex-col gap-2"
          style={{ animationDelay: '240ms' }}
        >
          {me.loggedIn && result?.canShare && (
            <button
              type="button"
              data-testid="share"
              disabled={shared}
              onClick={() => setSharing(true)}
              className="min-h-12 rounded-full bg-ink px-5 text-[16px] font-extrabold text-paper shadow-[0_4px_0_#000] active:translate-y-[3px] active:shadow-[0_1px_0_#000] disabled:bg-paper-deep disabled:text-muted disabled:shadow-none"
            >
              {shared ? 'Shared to comments ✓' : 'Share to comments'}
            </button>
          )}
          <div className="flex gap-2">
            {me.loggedIn && !subscribed && (
              <button
                type="button"
                data-testid="join"
                disabled={joining}
                onClick={() => void join()}
                className="min-h-12 flex-1 rounded-full border-2 border-ink bg-[#fbf8f2] px-3 text-[15px] font-bold active:scale-[0.98]"
              >
                {joining ? 'Joining…' : 'Join the print shop'}
              </button>
            )}
            <button
              type="button"
              data-testid="gallery"
              onClick={(e) => requestExpandedMode(e.nativeEvent, 'gallery')}
              className="min-h-12 flex-1 rounded-full border-2 border-ink bg-[#fbf8f2] px-3 text-[15px] font-bold active:scale-[0.98]"
            >
              See the Gallery Wall
            </button>
          </div>
        </section>

        <button
          type="button"
          data-testid="shop"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'shop')}
          className="flex items-center gap-3 rounded-xl bg-riso-yellow/50 px-3 py-2.5 text-left ring-1 ring-paper-edge active:scale-[0.99]"
        >
          <span className="text-[26px]" aria-hidden="true">
            🎨
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-extrabold">
              Make your own print
            </span>
            <span className="block text-[13px] text-muted">
              The best one this week becomes Community Sunday.
            </span>
          </span>
        </button>

        {result?.emojiGrid && (
          <section
            className="flex items-center gap-3 rounded-xl bg-[#fbf8f2] p-3 ring-1 ring-paper-edge"
            aria-label="Your share grid"
          >
            <pre
              className="m-0 shrink-0 font-sans text-[11px] leading-[1.1]"
              aria-hidden="true"
            >
              {result.emojiGrid}
            </pre>
            <p className="text-[13px] leading-snug text-muted">
              Your share grid shows the print, never your moves, so nobody gets
              spoiled.
            </p>
          </section>
        )}

        <section
          aria-labelledby="lb-title"
          className="rounded-xl bg-[#fbf8f2] p-3 ring-1 ring-paper-edge"
        >
          <h2
            id="lb-title"
            className="mb-2 flex items-baseline justify-between text-[15px] font-extrabold"
          >
            {isDaily ? 'Today’s pressroom' : 'Pressroom'}
            {board && (
              <span className="text-[12px] font-semibold text-muted">
                {board.total} printed
              </span>
            )}
          </h2>
          {!board ? (
            <p className="text-[13px] text-muted">Loading…</p>
          ) : board.top.length === 0 ? (
            <p className="text-[13px] text-muted">
              No prints yet. Yours could be first.
            </p>
          ) : (
            <ol className="m-0 list-none p-0">
              {[
                ...board.top,
                ...(board.you && board.you.rank > board.top.length
                  ? [board.you]
                  : []),
              ].map((e) => (
                <li
                  key={`${e.rank}-${e.username}`}
                  className={`flex items-center gap-2 border-t border-paper-edge/70 py-1.5 text-[14px] first:border-t-0 ${
                    e.you ? 'font-extrabold' : ''
                  }`}
                >
                  <span className="num w-7 text-muted">{e.rank}</span>
                  <span className="min-w-0 flex-1 truncate">
                    u/{e.username}
                    {e.you ? ' (you)' : ''}
                  </span>
                  <span className="num">{formatClock(e.timeMs)}</span>
                  <span className="num w-12 text-right text-muted">
                    {e.clean ? '✦' : `↑${e.lifts}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <button
          type="button"
          onClick={onReplay}
          className="mx-auto text-[14px] font-semibold text-muted underline"
        >
          Print it again (just for fun, not counted)
        </button>
      </main>

      {sharing && result && (
        <ShareSheet
          text={result.shareText}
          username={me.username ?? ''}
          onClose={() => setSharing(false)}
          onShared={() => {
            setShared(true);
            setSharing(false);
          }}
        />
      )}
    </div>
  );
};
