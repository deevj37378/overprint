# Overprint build progress

Resume rule: read this file and OVERPRINT.md, then continue from the first phase that
is not ✅.

## Phases

| Phase | What | Status |
|---|---|---|
| 0 | Housekeeping: Dependabot, no-repeat prints | ✅ (PR closing blocked, see Known issues) |
| A | Local preview harness (`npm run preview:local`) | ✅ |
| 2 | Game screen and riso look | ✅ |
| 3 | Server, daily post, scheduler, sticky, splash | ✅ |
| 4 | Result card, streaks, leaderboard, flair, share, subscribe | ✅ |
| 5 | Tutorial, colour-blind mode, keyboard, sound, Journeys | ✅ |
| 6 | Print Shop and Community Sunday | ✅ |
| 7 | Gallery Wall and archive | ✅ |
| 8 | Polish and compliance pass (reviewer + judge) | ✅ |
| 9 | Launch kit (README, SUBREDDIT, icon/banner, DEVPOST) | ⏳ |

## What each phase built

### Phase 0
- Removed `.github/dependabot.yml`.
- Generator never repeats the first-choice print of the same weekday in the previous 52 weeks
  (`generatePrint` in `src/shared/puzzle.ts`). Costs ~130 ms on a cold Sunday, a few ms warm.

### Phase A
- `npm run preview:local` → http://localhost:5199/preview/ (shell with device frames + controls).
- Runs the REAL Hono app (`src/server/app.ts`) inside Vite; `@devvit/web/server`,
  `@devvit/web/client` and `@devvit/analytics/server/reddit` are aliased to in-memory fakes in
  `preview/` (see `preview/vite.config.ts`). `src/server/core/clock.ts` is swapped for a fake clock.
  Production code has no preview branches; the only seams are `app.ts` (exported app) and `clock.ts`.
- Outbox panel shows every post/comment/flair/subscribe/Journey call that would hit Reddit.
- `node tools/shoot.mjs jobs.json` drives local Chrome over CDP for screenshots and taps.

### Phase 2
- `src/shared/play.ts`: pure tap-only reducer (pick, ghost, press, lift, undo, clear, keyboard
  ghost moves, timing, solve detection) + `play.test.ts`. `src/shared/daily.ts`: launch date,
  numbering, "Preview" labels, post titles.
- `src/client/ui/PrintSheet.tsx`: riso renderer (one multiplied SVG layer per ink, misregistration,
  rough-edge + speckle filter, colour-blind patterns, ghost, press bloom). `StampFace`, `Wordmark`, icons.
- `src/client/play/*`: Paper, Tray (wooden rubber stamps), Controls, hints, `usePlay` hook.
- `src/client/game/GameScreen.tsx`: layout (phone stacked; ≥1024px two columns), keyboard, print-run
  win animation. Fonts: Bricolage Grotesque + DM Mono via @fontsource (bundled).

### Phase 3
- Server (`src/server`): `core/` (keys, puzzles cache, idempotent `createDailyPost` with sticky
  "Share your print here 👇" comment, solves, streaks, flair, wall frames, users) and routes:
  `GET /api/puzzle|me|splash|leaderboard`, `POST /api/start|solve|share|subscribe|prefs`,
  menu `post-create` + `post-for-date` (form `postForDate`), scheduler `daily-post` (cron 0 0 * * *),
  triggers `onAppInstall` (creates today's daily) and `onPostDelete` (cleans the post's keys).
- The server never trusts the client: re-verifies placements, takes the time from `/api/start`
  (first pick-up) + 2 s slack, and only the first solve counts. Solution never leaves the server.
- Pre-launch: dates before 2026-12-01 are served as "Preview" (number null), never throwing.
- Splash (`splash.tsx`) renders from post data instantly (title, number, preview), then fetches
  `/api/splash` for "N printed today", streak and your result. No engine code in the client bundles.
- Harness test helpers: "Add 6 fake players", "Mark me solved", "First-ever play".
- (The streak/flair/share/subscribe server code landed here because `recordSolve` needs it;
  the result card UI is Phase 4.)

### Phase 4
- `ResultView`: one end screen with the pulled print (✦ CLEAN stamp when clean), time / lifts /
  streak tiles, percentile line, emoji share grid, top-10 leaderboard + your rank, and three separate
  buttons: Share to comments (opens `ShareSheet` showing the exact text and account first), Join the
  print shop (hidden once joined), See the Gallery Wall. "Print it again" replays (not counted).
- `GET /api/result` rebuilds the card for players reopening a solved post. Streak maths in
  `src/shared/streak.ts` with tests (no plays, today/yesterday, New Year, gaps, same day twice).
- Gallery entry point registered (placeholder page until Phase 7).

### Phase 5
- Tutorial (`game/Tutorial.tsx`): 3×3 practice (blue bar across, yellow bar down → green), hints
  follow the player's actual state, wrong placements get a nudge, Skip anytime. Shown once:
  `tutorialDone` in Redis (logged in) + localStorage (logged out). "?" → `HelpSheet` legend with
  real multiplied ink swatches, four rules, "Replay the tutorial".
- Colour-blind patterns toggle (dots / diagonals / horizontal lines), remembered per user.
- Sound (`lib/sound.ts`): Web Audio thunk / tick / ka-chunk, muted by default, header toggle,
  suspended on `visibilitychange`.
- Keyboard: 1–9 pick, arrows move ghost, R rotate, Enter/Space stamp, U/Backspace undo, Esc drop.
- Journeys: client `@devvit/analytics/client/reddit` → `/api/telemetry/journey/*` (server forwards
  to `telemetry`, allow-listed action names, no PII). App.Ready on load, Journey.Start on Play
  (splash) or first pick, Progress per press, Interaction rotate/undo/clear/hint/tutorial, End with
  `{win, score}` (score = 1000 − leaderboard seconds). `permissions.journeys: true`.
- Judge pass fixes: hint line counts squares that still differ from the proof once you've printed.

### Phase 6
- `src/shared/community.ts` (+ tests): `checkPrint` reuses the generator's quality rules (on paper,
  no identical stamps, no invisible stamp, mixed cells, 30–85% inked) with friendly reasons;
  curated title word lists; `buildCommunityPuzzle` (seeded shuffle; placements are the solution);
  `pickSunday`; `isoWeek` in date.ts.
- `shop` entry point (`shop.tsx`, `shop/ShopScreen.tsx`): size picker, ink + 10-shape palette,
  same paper/controls, live validation, word-picker title + shuffle, confirm sheet that says exactly
  what will be posted and as whom. `POST /api/shop/post` submits AS THE USER (`runAs: 'USER'`,
  `userGeneratedContent`), max 3 per user per UTC day; app adds the sticky share comment.
- `print:{id}`, `prints:week:{isoWeek}` (score = upvotes×1000 + solves, refreshed on each solve).
  Saturday's scheduler run picks Sunday's daily (`sunday:{date}`), the maker gets
  "🎨 Featured Printer" flair. Shop is linked from the splash and the result card.

### Phase 7
- `wall:{YYYY-MM}` hash: field `DD` = frame (date, number, maker, size, target, url), `DD:solves`
  counter (incremented on each counted solve), `DD:post`; `wall:months` zset. Frames are hung when a
  daily is created and removed if that post is deleted.
- `GET /api/gallery?month=` and the `gallery` entry point: month poster (3 / 5 / 7 columns), framed
  lite riso thumbnails with #, maker and ✓solves, today ringed, blank dashed frames for days with no
  print, month switcher, memoised frames. Tapping a frame `navigateTo`s its post.
- Old dailies show "From the archive · doesn't affect your streak" and never touch the streak.

### Phase 8
Reviewer pass (Devvit rules, checked against installed types/schema since devvit-mcp was down):
- User actions: share / join / post each sit behind their own explicit button (+ a confirm sheet for
  share and post), never automatic, never required, never bundled. Logged-out players can play.
- No Snoo/Reddit branding or orange; no free-text input for players (word pickers only).
- Data: `onPostDelete` cleans post keys; per-user daily keys + leaderboards expire at 90 days; user
  profile hash 1 year after last write; streak bitfields 2 years. (No account-delete trigger exists
  in Devvit 0.15.4.)
- Contrast: "PROOF" tag text now ink on pink (white was 3.1:1).
- Edge cases: failed solve save keeps your board and retries the same placements; deleted community
  print shows a message without a useless retry; double-tap share is idempotent server-side;
  midnight rollover has a 15-minute grace; 7×7 on 320px fits (stamps shrink below 360px).
- Removed dead code. No client console logging.
Judge pass (60 s on a phone): splash → Play → 30-second tutorial (skippable) → daily → print run →
result. Added the "N squares differ" hint (Phase 5) so nobody stalls on a near-miss.
Splash payload: ~85 KB gz JS+CSS (React + renderer), fonts are local woff2 with swap, no game code.

## Decisions

- **devvit-mcp was unreachable** (connection timeout) for this whole run. Every Devvit API was checked
  against the installed type definitions in `node_modules/@devvit/*` (v0.15.4) and the devvit.json
  schema in `node_modules/@devvit/shared-types/schemas/config-file.v1.json`.
- Lifts also count each Clear of a non-empty sheet (spec counts lifts + undos; clear is a mass lift).
- Ghost placement: the tapped cell is always covered; if the stamp's anchor would fall off the paper
  the ghost shifts to the nearest fitting position that still covers the tapped cell.
- Leaderboard score = time in ms + 10 000 per lift (lower is better). Written in OVERPRINT.md.
- Streak grace: yesterday's daily still counts for 15 minutes after midnight UTC (mid-game rollover).
- "Join the print shop" can't read real subscription state (that API needs Reddit approval as user),
  so we remember that the user joined through the app and hide the button after that.
- Devvit 0.15.4 has no account-deletion trigger; per-user daily keys expire after 90 days, and
  leaderboards (which hold user ids) expire after 90 days too. Noted in Known issues.
- Community prints must be "valid" like dailies: min mixed squares = 1 (two stamps) or 2 (3+).
- Community Sunday candidates: prints created in the last 7 days with a live post; ties broken by
  solves, then the earliest.
- Kept the spec's 30% minimum coverage and mixed-cell minimums unchanged (prints are compact as a result).

## Known issues / for the user

- Lighthouse wasn't run here (no Lighthouse in this environment). Run it on the playtest post:
  Chrome DevTools → Lighthouse → Mobile → Performance, on the post's iframe URL, or
  `npx lighthouse <url> --preset=perf --form-factor=mobile`.

- Closing the 9 open Dependabot PRs with `gh pr close` was blocked by the session's permission
  classifier. Run: `for n in 1 2 3 4 5 6 7 8 9; do gh pr close $n --comment "Pinning dependencies during the hackathon."; done`
