// The Print Shop: design a print with the same press, title it from word pickers, and post it
// (as yourself, only when you press the button). Your placements become the solution.

import { navigateTo, showLoginPrompt, showToast } from '@devvit/web/client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ShopInfoResponse, ShopStamp } from '../../shared/api';
import {
  checkPrint,
  MAX_SHOP_STAMPS,
  SHOP_SIZES,
  TITLE_ADJECTIVES,
  TITLE_NOUNS,
} from '../../shared/community';
import { INKS, type Ink } from '../../shared/ink';
import { SHAPE_IDS, type ShapeId } from '../../shared/shapes';
import { api, ApiError } from '../lib/api';
import { thunk, tick } from '../lib/sound';
import { Controls } from '../play/Controls';
import { useTrayDrag } from '../play/drag';
import { Paper } from '../play/Paper';
import { usePlay, type PlayCommand } from '../play/usePlay';
import { ChevronIcon } from '../ui/Icons';
import { INK_HEX, INK_NAME, SHAPE_NAME } from '../ui/inks';
import { StampFace } from '../ui/StampFace';
import { Wordmark } from '../ui/Wordmark';

type Props = {
  info: ShopInfoResponse | null;
  colourBlind: boolean;
  headerTools: ReactNode;
  onPosted: () => void;
};

const randomIndex = (n: number) => Math.floor(Math.random() * n);

const WordPicker = ({
  label,
  words,
  index,
  onChange,
}: {
  label: string;
  words: string[];
  index: number;
  onChange: (i: number) => void;
}) => (
  <div
    className="flex flex-1 items-center gap-1 rounded-xl bg-[#fbf8f2] p-1 ring-1 ring-paper-edge"
    role="group"
    aria-label={label}
  >
    <button
      type="button"
      aria-label={`Previous ${label}`}
      onClick={() => onChange((index - 1 + words.length) % words.length)}
      className="flex h-11 w-9 items-center justify-center rounded-lg"
    >
      <ChevronIcon dir="left" />
    </button>
    <span
      className="min-w-0 flex-1 truncate text-center text-[16px] font-extrabold"
      aria-live="polite"
    >
      {words[index]}
    </span>
    <button
      type="button"
      aria-label={`Next ${label}`}
      onClick={() => onChange((index + 1) % words.length)}
      className="flex h-11 w-9 items-center justify-center rounded-lg"
    >
      <ChevronIcon />
    </button>
  </div>
);

const Editor = ({
  size,
  info,
  colourBlind,
  onPosted,
}: {
  size: number;
  info: ShopInfoResponse | null;
  colourBlind: boolean;
  onPosted: () => void;
}) => {
  const { state, dispatch: raw } = usePlay(size, [], null);
  const [ink, setInk] = useState<Ink>('blue');
  const [adjective, setAdjective] = useState(() =>
    randomIndex(TITLE_ADJECTIVES.length)
  );
  const [noun, setNoun] = useState(() => randomIndex(TITLE_NOUNS.length));
  const [confirming, setConfirming] = useState(false);
  const nextId = useRef(0);

  const dispatch = (command: PlayCommand) => {
    raw(command);
    if (command.type === 'rotate') tick();
  };

  // Press sound when a stamp lands.
  const pressKey = state.lastPressed
    ? `${state.lastPressed}-${state.history.length}`
    : null;
  useEffect(() => {
    if (pressKey) thunk();
  }, [pressKey]);

  const stamps: ShopStamp[] = useMemo(
    () =>
      state.placed.flatMap((p) => {
        const stamp = state.tray.find((s) => s.id === p.stampId);
        return stamp
          ? [
              {
                shape: stamp.shape,
                ink: stamp.ink,
                row: p.row,
                col: p.col,
                rotation: p.rotation,
              },
            ]
          : [];
      }),
    [state.placed, state.tray]
  );
  const check = checkPrint(size, stamps);

  const pickShape = (shape: ShapeId): boolean => {
    if (state.placed.length >= MAX_SHOP_STAMPS) {
      showToast(
        `Six stamps is the most a print can hold. Lift one to swap it.`
      );
      return false;
    }
    const id = `e${nextId.current++}`;
    raw({ type: 'setTray', tray: [...state.tray, { id, shape, ink }] });
    raw({ type: 'pick', stampId: id });
    tick();
    return true;
  };

  // Drag a shape from the palette onto the paper: it lands there as the ghost.
  const drag = useTrayDrag((item, anchor, grab) => {
    const shape = SHAPE_IDS.find((id) => id === item.key);
    if (shape && pickShape(shape)) raw({ type: 'dragGhost', ...anchor, grab });
  });

  const held = state.hand
    ? state.tray.find((s) => s.id === state.hand?.stampId)
    : undefined;
  const title = `${TITLE_ADJECTIVES[adjective] ?? ''} ${TITLE_NOUNS[noun] ?? ''}`;
  const remaining = info
    ? Math.max(0, info.dailyLimit - info.postedToday)
    : null;

  return (
    <>
      <Paper
        state={state}
        dispatch={dispatch}
        colourBlind={colourBlind}
        label="Your print"
        className="mx-auto w-[min(100%,max(208px,calc(100dvh_-_404px)),420px)]"
      />

      <p
        className={`rounded-xl px-3 py-1.5 text-center text-[13px] leading-snug font-semibold ${
          check.ok ? 'bg-[#cfe9d3]' : 'bg-paper-deep'
        }`}
        aria-live="polite"
      >
        {state.hand
          ? `Tap the paper to place the ${INK_NAME[held?.ink ?? ink].toLowerCase()} ${SHAPE_NAME[held?.shape ?? 'i3']}, tap again to press.`
          : check.ok
            ? '✓ Ready to print. Give it a name below.'
            : check.reason}
      </p>
      <p className="-mt-1 text-center text-[11px] text-muted num">
        {stamps.length}/{MAX_SHOP_STAMPS} stamps · {check.mixed} mixed ·{' '}
        {Math.round(check.inkedFraction * 100)}% inked
      </p>

      <section aria-label="Pick a stamp" className="flex flex-col gap-1.5">
        <div
          className="flex items-center justify-center gap-2"
          role="radiogroup"
          aria-label="Ink"
        >
          {INKS.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={ink === i}
              aria-label={`${INK_NAME[i]} ink`}
              onClick={() => setInk(i)}
              className={`flex h-11 min-w-[88px] items-center justify-center gap-2 rounded-full border-2 px-3 text-[14px] font-bold ${
                ink === i
                  ? 'border-ink bg-[#fbf8f2]'
                  : 'border-transparent bg-paper-deep/60'
              }`}
            >
              <span
                className="h-4 w-4 rounded-full mix-blend-multiply"
                style={{ background: INK_HEX[i] }}
              />
              {INK_NAME[i]}
            </button>
          ))}
        </div>
        <div className="drag-surface grid grid-cols-5 gap-1.5">
          {SHAPE_IDS.map((shape) => (
            <button
              key={shape}
              type="button"
              data-testid={`shape-${shape}`}
              aria-label={`Pick up a ${INK_NAME[ink].toLowerCase()} ${SHAPE_NAME[shape]} stamp`}
              {...drag.bind({ key: shape, shape, ink, rotation: 0 })}
              onClick={() => {
                if (drag.consumeClick()) return;
                pickShape(shape);
              }}
              className={`flex h-12 items-center justify-center rounded-xl border-2 bg-[#fbf8f2] active:scale-95 ${
                held?.shape === shape && held.ink === ink
                  ? 'border-ink'
                  : 'border-paper-edge'
              }`}
            >
              <StampFace shape={shape} ink={ink} size={30} />
            </button>
          ))}
          {drag.floating}
        </div>
      </section>

      <Controls state={state} dispatch={dispatch} />

      <section aria-label="Title" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-extrabold">Name your print</h2>
          <button
            type="button"
            className="min-h-11 px-2 text-[14px] font-bold underline"
            onClick={() => {
              setAdjective(randomIndex(TITLE_ADJECTIVES.length));
              setNoun(randomIndex(TITLE_NOUNS.length));
            }}
          >
            🎲 Shuffle
          </button>
        </div>
        <div className="flex gap-2">
          <WordPicker
            label="adjective"
            words={TITLE_ADJECTIVES}
            index={adjective}
            onChange={setAdjective}
          />
          <WordPicker
            label="noun"
            words={TITLE_NOUNS}
            index={noun}
            onChange={setNoun}
          />
        </div>
      </section>

      {info && !info.loggedIn ? (
        <button
          type="button"
          onClick={() => showLoginPrompt()}
          className="min-h-12 rounded-full border-2 border-ink bg-[#fbf8f2] text-[16px] font-extrabold"
        >
          Log in to post your print
        </button>
      ) : (
        <button
          type="button"
          data-testid="post-print"
          disabled={!check.ok || remaining === 0}
          onClick={() => setConfirming(true)}
          className="min-h-12 rounded-full bg-ink text-[17px] font-extrabold text-paper shadow-[0_4px_0_#000] active:translate-y-[3px] active:shadow-[0_1px_0_#000] disabled:bg-paper-deep disabled:text-muted disabled:shadow-none"
        >
          Post my print
        </button>
      )}
      {remaining !== null && info?.loggedIn && (
        <p className="-mt-2 text-center text-[12px] text-muted">
          {remaining === 0
            ? 'You’ve posted 3 prints today. Back tomorrow!'
            : `${remaining} of ${info.dailyLimit} posts left today`}
        </p>
      )}

      <p className="text-center text-[13px] leading-snug text-muted">
        Make a print for everyone to solve: press 2–6 stamps, overlapping inks
        mix. Your placements are the solution, so every print is solvable.
      </p>

      {confirming && (
        <ConfirmPost
          title={title}
          username={info?.username ?? ''}
          size={size}
          stamps={stamps}
          adjective={TITLE_ADJECTIVES[adjective] ?? ''}
          noun={TITLE_NOUNS[noun] ?? ''}
          onClose={() => setConfirming(false)}
          onPosted={onPosted}
        />
      )}
    </>
  );
};

const ConfirmPost = ({
  title,
  username,
  size,
  stamps,
  adjective,
  noun,
  onClose,
  onPosted,
}: {
  title: string;
  username: string;
  size: number;
  stamps: ShopStamp[];
  adjective: string;
  noun: string;
  onClose: () => void;
  onPosted: () => void;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const post = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.shopPost({ size, stamps, adjective, noun });
      if (res.status === 'ok') {
        setPosted(res.url);
        onPosted();
      } else {
        setMessage(res.reason);
      }
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'Could not post. Nothing was posted.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="post-title"
      className="m-auto mb-0 w-full max-w-[480px] rounded-t-2xl bg-paper p-0 text-ink backdrop:bg-ink/40 sm:mb-auto sm:rounded-2xl"
    >
      <div className="paper-grain flex flex-col gap-3 p-5">
        {posted ? (
          <>
            <h2 id="post-title" className="text-[20px] font-extrabold">
              Printed! 🎉
            </h2>
            <p className="text-[15px]">
              “{title}” is live. Anyone can play it, and it has its own
              leaderboard.
            </p>
            <button
              type="button"
              onClick={() => navigateTo(posted)}
              className="min-h-12 rounded-full bg-ink font-extrabold text-paper"
            >
              Open my print
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="min-h-11 font-bold underline"
            >
              Make another
            </button>
          </>
        ) : (
          <>
            <h2 id="post-title" className="text-[20px] font-extrabold">
              Post “{title}” as u/{username}?
            </h2>
            <p className="text-[14px] text-muted">
              This creates a new post in this community, from your account,
              titled “{title} · printed by u/{username}”. It plays like a daily,
              and the best print of the week can become Community Sunday.
            </p>
            {message && (
              <p className="text-[14px] font-semibold text-[#a3195b]">
                {message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="min-h-12 flex-1 rounded-full border-2 border-ink bg-[#fbf8f2] font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="post-confirm"
                disabled={busy}
                onClick={() => void post()}
                className="min-h-12 flex-[1.4] rounded-full bg-ink font-extrabold text-paper disabled:opacity-60"
              >
                {busy ? 'Posting…' : 'Post it'}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
};

export const ShopScreen = ({
  info,
  colourBlind,
  headerTools,
  onPosted,
}: Props) => {
  const [size, setSize] = useState(6);
  const [generation, setGeneration] = useState(0);
  return (
    <div className="paper-grain min-h-dvh bg-paper text-ink">
      <header className="flex items-center gap-2 px-4 pt-2">
        <Wordmark className="text-[26px]" text="Print Shop" />
        <span className="flex-1" />
        {headerTools}
      </header>
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-2 px-4 pt-2 pb-8">
        <div
          className="flex gap-1.5 rounded-full bg-paper-deep/70 p-1"
          role="radiogroup"
          aria-label="Paper size"
        >
          {SHOP_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={size === s}
              onClick={() => {
                setSize(s);
                setGeneration((g) => g + 1);
              }}
              className={`min-h-11 flex-1 rounded-full text-[14px] font-bold num ${size === s ? 'bg-ink text-paper' : ''}`}
            >
              {s}×{s}
            </button>
          ))}
        </div>
        <Editor
          key={`${size}-${generation}`}
          size={size}
          info={info}
          colourBlind={colourBlind}
          onPosted={onPosted}
        />
      </main>
    </div>
  );
};
