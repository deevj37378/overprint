# Overprint: Claude Code prompts

Paste these into Claude Code **one at a time**, in order, from inside the project folder.
Wait until each one is finished, check it yourself in the playtest post, then move on.
Each prompt is one commit, so anything that goes wrong can be reverted on its own.

| # | Prompt | Target date |
|---|---|---|
| 0 | Project setup and ground rules | Nov 23–24 |
| 1 | Puzzle engine (pure logic + tests) | Nov 24–25 |
| 2 | Game screen and riso look | Nov 25–27 |
| 3 | Server, daily post and feed view | Nov 28–29 |
| 4 | Result card, streaks, leaderboard, sharing | Nov 30–Dec 1 |
| 5 | Onboarding, accessibility, sound, Journeys | Dec 2 |
| 6 | Print Shop (player-made prints) | Dec 3–4 |
| 7 | Gallery Wall and archive | Dec 5 |
| 8 | Polish and rules compliance pass | Dec 6 |
| 9 | Launch kit (README, subreddit, Devpost text) | Dec 7 |

**Dec 1:** turn the daily scheduler on in your real demo subreddit, so it has a week of real daily posts by judging time.
**Dec 8 (IST evening):** submit on Devpost, with a day of buffer before the 7:30 am IST Dec 9 cutoff.

---

## Prompt 0: project setup and ground rules

```
We're building "Overprint", a daily puzzle game for Reddit's Game of the Day hackathon on Devvit Web.
This folder is the Devvit React template (React 19 + Vite + Tailwind 4 + Hono server).

Read these first, fully: OVERPRINT.md (the design spec, our single source of truth), AGENTS.md (Devvit's
template rules), devvit.json, package.json, and everything in src/. Use the devvit-mcp tools to look up any
Devvit API you are not sure about. Never guess Devvit APIs, and never use @devvit/public-api or "blocks" code.

Then do setup only, no game features yet:
1. Create CLAUDE.md in the project root with our standing rules:
   - OVERPRINT.md is the spec; ask me before deviating from it.
   - Devvit Web only. Check APIs via devvit-mcp. Every new menu item, form, trigger, scheduler task or
     permission must also be registered in devvit.json.
   - Tap-only interaction. No drag, swipe, long-press or scroll-jacking. The inline splash must stay tiny and fast.
   - No network calls to outside domains; fonts and sounds are bundled or generated locally.
   - Never run `devvit publish` or `npm run launch`. Uploading (`npm run deploy`) only when I ask.
   - Posting, commenting or subscribing as the user happens only from an explicit button press, never
     automatically, never required for play, never bundled with another action.
   - Shared game logic lives in src/shared and is pure and unit-tested (node:test, `npm run test:unit`).
   - Before each commit, run `npm run test:types`, `npm run lint` and `npm run test:unit`, and fix what fails.
   - One commit per prompt, with a clear message; push after each commit.
   - Code style from AGENTS.md: type aliases, named exports, no type casts.
2. Remove the template's demo counter and example form (keep the file structure, entry points and the
   "create post" menu item working). Rename the menu item to "Post today's print".
3. Set up git if it isn't already: a sensible .gitignore, an initial commit. Create a public GitHub repo
   named "overprint" with `gh` and push to it.
4. Run `npm run build` to confirm it builds, and tell me the exact command to start a playtest.

At the end, tell me in plain words what you changed and what I should check by hand.
```

---

## Prompt 1: puzzle engine

```
Build the Overprint puzzle engine in src/shared, following the "Core rules", "Difficulty by weekday",
"Puzzle generator" and "Scoring" sections of OVERPRINT.md exactly. Pure TypeScript, no React, no Devvit
imports, so both the client and the server can use it.

Include:
- Types: Ink ('blue' | 'pink' | 'yellow'), InkSet, Shape, Stamp (id, shape, ink), Placement
  (stampId, row, col, rotation), Puzzle, Sheet (the grid of InkSets).
- A seeded PRNG (mulberry32 or similar) and a dateToSeed('YYYY-MM-DD') helper.
- Shape definitions for the stamp pool and rotate(shape, quarterTurns), normalised so that rotated shapes
  anchor at their top-left filled cell.
- applyPlacements(size, tray, placements) → Sheet, with bounds checking.
- mixColour(inkSet) → a colour name (blue, pink, yellow, green, orange, purple, black, empty), plus
  toEmoji(inkSet) using 🟦🟥🟨🟩🟧🟪🟫⬜.
- generateDailyPuzzle(date, launchDate) with the weekday difficulty table, decoys on Sat/Sun, and all the
  rejection rules from the spec (retry with a derived seed; never loop forever, so cap the attempts).
- isSolved(puzzle, placements) and verifySolve(puzzle, placements) for the server
  (bounds, overlap with the tray, each stamp used at most once).
- targetToEmojiGrid(puzzle) for sharing.

Tests (node:test, in src/shared/*.test.ts):
- Mixing table correctness, rotation (4 turns = identity), bounds.
- The same date always gives the same puzzle; different dates give different ones.
- Generate every day from 2026-12-01 to 2027-11-30: each one meets its weekday rules, its stored solution
  verifies, no stamp is invisible, and generation is fast (log the slowest day).
- verifySolve rejects tampered placements (off-grid, a stamp used twice, a wrong stamp id).

Also print 7 sample puzzles (one per weekday) as emoji grids in the terminal, so I can eyeball the
difficulty curve. Commit when the tests pass.
```

---

## Prompt 2: game screen and the riso look

```
Build the expanded game view (src/client/game.html / game.tsx) for Overprint, following "Interaction",
"Visual identity" and "Scoring" in OVERPRINT.md. For now, load today's puzzle by calling the shared
generator directly on the client (we'll move it behind the server in the next prompt).

Layout, mobile first at 390×844: the target "proof" card at the top (smaller), the paper in the middle
(large), and the tray of stamps plus the controls (rotate, undo, clear, ?) at the bottom. During play
there is nothing else on screen. It must also look right at 768 and 1440 wide.

Behaviour: tap a stamp to pick it up → tap a cell for a ghost preview → tap again or "Stamp" to press it.
Tap a placed stamp to lift it. Track time (starting at the first pick-up) and lifts. Detect a solve with
isSolved and show a temporary "Solved!" state (the real result card comes in prompt 4).

Look and feel (this matters a lot for judging; it must not look like a generic AI app):
- Warm paper with an inline SVG grain, the three riso inks, each ink as its own layer with
  mix-blend-mode: multiply, and a 1px misregistration offset per ink.
- Stamps in the tray look like rubber stamps: an inked face, a slight shadow, and lift on pick-up.
- Pressing animation: squash + ink bloom. Win animation: the sheet slides out of the press.
  Respect prefers-reduced-motion.
- Bundle the fonts locally (@fontsource, OFL). Big tap targets (44px min). Clear focus states.

Keep game state in a small reducer or hook that's easy to test. Add unit tests for the state logic
(pick-up, place, lift, undo, clear, lift counting). Then playtest: give me the URL and tell me exactly
what to tap to try a full solve on my phone and on desktop. Commit.
```

---

## Prompt 3: server, daily post and the feed view

```
Wire up the server side and the daily loop, following "Daily loop and Reddit integration" and
"Redis keys" in OVERPRINT.md. Check every Devvit API via devvit-mcp first: submitCustomPost, postData,
redis, the scheduler, comments and stickying, and context.postId.

Server (Hono, src/server):
- GET /api/puzzle → today's puzzle for this post (by post data: daily date or community print). Send the
  tray, target, size, number and date, but NOT the solution. Cache in Redis.
- POST /api/solve → { placements, timeMs, lifts }. Re-verify on the server with verifySolve. Only the
  first solve per user per day counts. Store the solve, update stats:{date}, and return the stored result.
- GET /api/me → username (or logged-out), whether today is solved, the stored result.
- The "Post today's print" moderator menu item and a scheduler task (cron "0 0 * * *", UTC) that both create
  the daily post titled "Overprint #N · Mon 1 Dec", store post:{postId}, then post and sticky
  "Share your print here 👇" as the app. Make it idempotent: never create two dailies for the same date.
- A setting or constant for LAUNCH_DATE (puzzle #1). Use 2026-12-01.

Client:
- The game view loads its puzzle from /api/puzzle and submits to /api/solve; remove the client-side generation.
- The inline splash (splash.html): title, puzzle #, date, a small preview of the target, "N printed today",
  and one Play button that calls requestExpandedMode into the game entry point. If already solved, show the
  result line and "Come back tomorrow". Keep it tiny: no game code, no heavy deps, and it must load in under
  1 second.
- Proper loading, error and logged-out states (logged-out users can still play; their solve just isn't stored).

Tests for the date and number helpers and the idempotency logic. Playtest: tell me how to create a daily
post from the mod menu and what to check. Commit.
```

---

## Prompt 4: result card, streaks, leaderboard and sharing

```
Build the end-of-game experience from "Daily loop and Reddit integration" in OVERPRINT.md.

- Streaks: the bitfield approach in the spec (streak:{userId}:{year}, day index from the post's UTC date,
  handling the jump across years, old posts never affect today). Current and best streak. Unit-test the
  streak maths: no plays, today vs yesterday, Jan 1, gaps, the same day twice.
- Leaderboard: lb:{date} zset, scored by time with a penalty per lift (pick a formula, write it in OVERPRINT.md).
  Top 10 + my rank + percentile.
- Flair: set streak flair as the app when the streak changes ("🖨 N-day streak", "✦ Master Printer" at 30).
  Check the flair API via devvit-mcp and handle failures quietly.
- Result card (ONE screen): time, lifts, the ✦ clean badge, percentile, streak, the emoji grid, and three
  separate buttons:
  1. "Share to comments": submits a comment AS THE USER (runAs 'USER') replying to the post's sticky comment.
     Show exactly what will be posted before sending. Add the SUBMIT_COMMENT permission in devvit.json.
  2. "Join the print shop": subscribes the user (SUBSCRIBE_TO_SUBREDDIT); hidden if already subscribed.
  3. "See the Gallery Wall" (it can be a placeholder until prompt 7).
- The splash shows the streak, and the result line if already solved.

None of these actions can be required to keep playing, and none can be bundled together. Playtest the full
loop: solve → result → share → streak. Tell me what to check. Commit.
```

---

## Prompt 5: onboarding, accessibility, sound and Journeys

```
Follow "Onboarding", the accessibility and sound parts of "Visual identity", and "Analytics: Devvit Journeys"
in OVERPRINT.md.

- First-ever play: the 3×3 tutorial print with one contextual hint per step, stored per user so it only shows
  once (Redis for logged-in users, localStorage as a fallback for logged-out ones). Skippable.
  "?" reopens the ink-mixing legend.
- Colour-blind mode toggle (patterns per ink), remembered per user. Check contrast and screen-reader labels on
  every control. Keyboard support on desktop (arrow keys move the ghost, R rotates, Enter stamps).
- Sound with Web Audio (no files): stamp thunk, win ka-chunk. Muted until the user turns it on; auto-mute on
  visibilitychange; a visible mute toggle.
- Journeys via @devvit/analytics: App.Ready, Journey.Start on Play, Journey.Progress, Journey.Interaction
  (rotate/undo/hint), Journey.End with win and score. Set permissions.journeys in devvit.json. Fire on
  committed actions only (click or touchend), never on view. No PII.

Playtest as if you were a judge who has never seen the game: list every place where someone might get stuck,
and fix them. Commit.
```

---

## Prompt 6: Print Shop (player-made prints)

```
Build the Print Shop from OVERPRINT.md: a new "shop" entry point (register it in devvit.json) reachable from
the splash and the result card.

- Editor: pick a grid size (5, 6 or 7), place 2–6 stamps from the full pool (any shape, any ink, rotate),
  and see the print live. Tap-only, reusing the game's components and look.
- Validation: reuse the generator's quality rules (no invisible stamp, enough mixed cells, coverage limits).
  Show a friendly reason when a print isn't allowed yet.
- Title from two word pickers ([adjective] [noun]) with curated, family-friendly lists. No free text.
- "Post my print": an explicit button that submits a custom post AS THE USER (runAs 'USER', with
  userGeneratedContent set, and the SUBMIT_POST permission). The post plays exactly like a daily, credited
  "printed by u/name", with its own leaderboard.
- Store print:{printId}, add it to prints:week:{isoWeek}, and keep its score updated from upvotes and solves.
- Community Sunday: the Saturday scheduler job picks the top community print of the week for Sunday's daily;
  if there are none, Sunday falls back to the generator. Give the maker "🎨 Featured Printer" flair.
- Limit each user to 3 posted prints per day.

Tests for print validation and Sunday selection. Playtest posting a print and solving it from another
account if you can (or tell me how to). Commit.
```

---

## Prompt 7: Gallery Wall and archive

```
Build the Gallery Wall from OVERPRINT.md as a "gallery" entry point.

- wall:{YYYY-MM}: when each daily is created, add its frame; update its solve count as solves come in.
- The wall view: a month grid of framed prints (rendered from each day's target with the same riso renderer,
  small), each showing its #, its maker, and how many solved it. A blank frame for days nobody played.
  Month switcher. It must stay smooth with 31 frames on a phone.
- Tapping a frame opens that day's post (navigateTo) so people can play old prints.
- On old posts, the game says "From the archive: doesn't affect your streak".
- Link the wall from the splash and the result card.

Commit after playtesting on mobile width.
```

---

## Prompt 8: polish and rules compliance pass

```
Do a full polish and compliance pass, like a strict Reddit reviewer would. Fix everything you find.

- Read the Devvit rules (devvit-mcp) and check us against every one: user actions, branding, data deletion,
  logged-out users, text input, README.
- Triggers: PostDelete deletes that post's keys; account deletion removes the user's ID from every key.
  Add 90-day expiry to per-user daily keys.
- Performance: splash under 1s, Lighthouse mobile score above 80 on the splash (tell me how to run it, or run
  it yourself if you can). Lazy-load anything heavy in the game.
- Inline view: no scroll traps, works in the feed at every width, only taps.
- Edge cases: midnight UTC rollover mid-game, double-tapping Share, network errors, a logged-out user,
  a 7×7 board on a 320px-wide phone, a deleted community print.
- Visual consistency: spacing, type scale, colours, motion. Nothing should look like an unstyled default
  component.
- Remove dead code, console logs and template leftovers.

Give me a short list of what you fixed and anything you couldn't. Commit.
```

---

## Prompt 9: launch kit

```
Prepare everything for submission. Do not run `devvit publish`.

1. README.md in the root (a Devvit requirement, and judges read it): what Overprint is, how to play (with the
   ink-mixing legend), the daily loop, the Print Shop, the Gallery Wall, Reddit features used (scheduler,
   Redis, user actions, flair, Journeys), and how to run it locally.
2. A file SUBREDDIT.md with ready-to-paste text: the subreddit description, sidebar rules, a pinned
   "How to play Overprint" post, and post flair names (Daily, Community Print, Feedback, Bug).
3. Subreddit icon (256×256) and banner (1920×384) PNGs in the riso style, generated from SVG with a script.
4. DEVPOST.md: a Devpost description (inspiration, what it does, how we built it, challenges,
   accomplishments, what's next) that's honest and specific, plus a 50-second video script with shot list.
5. Run the full checks, then `npm run deploy` (upload only) and give me the app listing URL format I need.
6. A final checklist for me: make the subreddit public (or install dr-admin-approve), confirm the daily posts
   exist, confirm a fresh account can play end-to-end, fill in the Devvit feedback survey.

Commit.
```
