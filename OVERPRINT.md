# Overprint: game design spec

The single source of truth for what we are building.
If code and this file disagree, ask before changing either.

## The hackathon (constraints that shape everything)

- Reddit "Game of the Day" hackathon on Devpost. Deadline **Tue Dec 8, 2026, 6:00 pm PT** (Wed Dec 9, 7:30 am IST).
- Must run on **Devvit Web** as an interactive post. Judges play a demo post in a public test subreddit (<200 members).
- Upload with `devvit upload`. **Never run `devvit publish` / `npm run launch`** during the hackathon.
- Judged equally on: Delightful UX, Polish, Reddit-y (community-minded, not *about* Reddit), Daily Content.
- They mark down: obvious AI-looking UI, clones, generic components, text walls, anything not running on Reddit.
- Devvit rules: no Reddit/Snoo branding or mascot in the game; posting/commenting/subscribing as the user only on an explicit button press, never required to keep playing, never bundled with another action; prefer limited input (pickers, emoji) over free text; README.md in repo root.
- No outside network calls (HTTP fetch needs approval). Everything (puzzles, art, fonts, sounds) is generated or bundled locally.

## One-line pitch

A daily riso-print puzzle: layer coloured ink stamps so their overlaps recreate today's print.

## Core rules

- **Paper:** a square grid (5×5 to 7×7).
- **Inks:** three, like a risograph: **Blue**, **Pink**, **Yellow**.
- **Overlap mixes ink.** A cell's colour is the *set* of inks covering it:
  - one ink → that ink
  - Blue + Yellow → Green · Pink + Yellow → Orange · Blue + Pink → Purple
  - all three → Ink-black (very dark brown)
  - the same ink twice adds nothing (sets, not counts)
- **Stamps:** polyomino shapes (domino, I3, L3, I4, L4, T4, S4, O4, P5, plus-sign). Each stamp in the tray has a fixed shape **and** a fixed ink.
- **Today's tray** is exactly the stamps the generator used (shuffled), plus **one decoy stamp on Saturday and Sunday**.
- **Goal:** make the paper match the target print exactly. Any arrangement that matches wins; the solution doesn't have to be unique.
- **Rotation:** stamps can rotate 90° (tap the rotate button). No mirroring.
- Stamps must sit fully on the paper.

## Interaction (tap first; drag in expanded views)

1. Tap a stamp in the tray to pick it up (it lifts with a little shadow).
2. Tap the rotate button to turn it (optional).
3. Tap a cell on the paper: a ghost preview appears anchored there. Tap the same cell again (or "Stamp") to press it down. Tapping a different cell moves the ghost.
4. Tap a placed stamp to lift it back into your hand.
5. "Undo" and "Clear" are always available.
- **The inline (feed) view (splash) is tap-only**, a Reddit requirement: buttons only, no drag, swipe, pinch or long-press.
- **Expanded views (game, tutorial, Print Shop) may also use drag**, on the paper and tray only. Everything drag does must still be possible with taps. A press that moves under 8px is a tap.
  - Drag the ghost: it follows the finger cell by cell (the grabbed cell stays under it). Release leaves the ghost there, not pressed. Never a lift.
  - Drag a pressed stamp (the top one where stamps overlap): it lifts with a shadow and presses down again on release. Counts as 1 lift; Undo puts it back in one step.
  - Drag a stamp from the tray (or a shape from the Print Shop palette) onto the paper: releasing over the paper shows the ghost there; releasing elsewhere cancels.
  - Stamps always stay fully on the paper (clamped to the nearest valid spot). A soft tick per cell when sound is on, and a 5 ms vibration where supported.
  - `touch-action: none` on the paper and tray only, so a drag never scrolls the page and pinch-zoom still works elsewhere.

## Difficulty by weekday (UTC date of the post)

| Day | Grid | Stamps | Decoy | Minimum mixed cells |
|---|---|---|---|---|
| Mon | 5×5 | 2 | no | 1 |
| Tue | 5×5 | 3 | no | 2 |
| Wed | 6×6 | 3 | no | 3 |
| Thu | 6×6 | 4 | no | 4 |
| Fri | 6×6 | 4 | no | 5 |
| Sat | 7×7 | 5 | yes | 6 |
| Sun | 7×7 | 5 | yes | 7, or the week's **Community Print** (see Print Shop) |

## Puzzle generator (pure, deterministic, shared by client and server)

- Seeded PRNG (e.g. mulberry32) seeded from the UTC date string `YYYY-MM-DD`, so every player gets the same print.
- Place N random stamps (random shape, ink, rotation, position), then reject and retry (with a derived seed) if:
  - any stamp has zero visible effect (completely hidden by same-ink coverage),
  - the number of mixed cells is below the weekday minimum,
  - fewer than 30% or more than 85% of the cells are inked,
  - two stamps are identical in shape **and** ink (confusing).
- The output is `{ date, number, size, tray: Stamp[], target: InkSet[][], solution: Placement[] }`.
- `number` is the puzzle number: days since launch day (#1 is the first daily post).
- Pure functions in `src/shared/`, unit-tested over a full year of dates.

## Scoring

- **Time:** from the first stamp pick-up to the solve.
- **Lifts:** how many times you picked a placed stamp back up or dragged it somewhere new, plus undos. Fewer is better.
- **Clean print ✦:** solved with zero lifts.
- The server **re-verifies** every solve: it regenerates the day's target and checks the submitted placements. Never trust a client "I won".
- Only the first solve of a day counts for the leaderboard and the streak. Replays are allowed, just not counted.
- **Leaderboard score** = solve time in ms + 10,000 ms per lift (lower is better; a lift costs 10 seconds).
  The server clamps the reported time to what it observed since the first pick-up (+2 s).

## Daily loop and Reddit integration

- **Daily post:** a scheduler job at 00:00 UTC creates "Overprint #N · Mon 1 Dec" in the subreddit. A moderator menu item "Post today's print" does the same by hand, for setup and testing.
- **Sticky comment:** right after creating the post, the app account posts and stickies "Share your print here 👇". Players' share comments reply to it (this follows Devvit rules for score sharing).
- **Inline view (splash, in the feed):** title, date, puzzle #, a small preview of today's target, how many people have printed today, your streak, and one **Play** button that opens the expanded view. If you already solved it: your result and "Come back tomorrow". It must load in under 1 second with no heavy dependencies.
- **Expanded view (game):** the paper, the target "proof" card, the tray, and the controls. Nothing else on screen during play.
- **Result card** (one end screen, no more):
  - time, lifts, the ✦ clean badge, your percentile ("faster than 72% of printers today")
  - streak (🔥 current / best)
  - an emoji grid of the target (🟦🟥🟨🟩🟧🟪🟫⬜), no spoilers of the placements
  - buttons, each a separate explicit choice: **Share to comments** (posts as the user, replying to the sticky), **Join the print shop** (subscribe; hidden if already subscribed), **See the Gallery Wall**
- **Streaks:** one bit per day in Redis (`streak:{userId}:{year}` bitfield), keyed by the post's UTC date, not the device clock. Same approach as Reddit's own r/syllo recipe.
- **Leaderboard:** a sorted set per day (score built from time and lifts). Show the top 10 plus your rank.
- **User flair:** streak flair set by the app, e.g. "🖨 7-day streak", and "✦ Master Printer" at 30 days. Updated when the streak changes.
- **Logged-out users:** can play the daily, but get no streak or leaderboard. Show a gentle "log in to keep your streak" line, never a wall.
- **Old posts:** stay playable forever (the archive) but don't change today's streak.

## Print Shop (player-made puzzles; the "Reddit-y" core)

- An editor entry point: choose a grid size, place 2–6 stamps from the full pool, and see the resulting print live.
- Title it with word pickers, not free text: `[adjective] [noun]` from curated lists (e.g. "Quiet Harbour", "Loud Lemon").
- **Post my print:** an explicit button that submits a custom post **as the user** (`runAs: 'USER'`, with `userGeneratedContent` set). The post plays exactly like a daily, credited "printed by u/name".
- A print is solvable by construction, because its placements *are* the solution.
- **Community Sunday:** the Saturday scheduler job picks the highest-scoring community print from the past 7 days (upvotes, tie-break by solves) to become Sunday's daily, credited to its maker. If there are none, the generator runs as normal.
- The creator gets "🎨 Featured Printer" flair when their print is chosen.

## Gallery Wall (the collective artifact)

- One wall per month. Each day's daily print hangs as a framed thumbnail with its #, its maker (Overprint or u/name), and how many people solved it.
- Days nobody played show a blank frame. By the end of the month the subreddit has a poster everyone made together.
- Reachable from the result card and from the splash ("Gallery").

## Visual identity: "Riso"

- **Paper:** warm off-white (#F4EFE6) with a subtle grain (inline SVG noise, no image fetch).
- **Inks** (classic riso colours): Blue #0078BF, Fluorescent Pink #FF48B0, Yellow #FFE800.
- **Overprint rendering:** draw each ink as its own layer with `mix-blend-mode: multiply` on the paper, so overlaps produce real overprint colours. Add a 1px misregistration offset per ink for charm.
- **Type:** one bold grotesk for headings and a monospace for numbers, bundled locally (OFL fonts via @fontsource or files in `/public`). No Google Fonts or CDNs.
- **Motion:** the stamp presses down with a squash and a soft ink bloom; the win plays a "print run" where the sheet slides out of the press. Respect `prefers-reduced-motion`.
- **Sound:** a soft stamp thunk and a press "ka-chunk" on win, made with Web Audio (no files needed). Muted by default until the user taps the sound toggle; auto-mute on `visibilitychange`.
- **Accessibility:** a colour-blind mode adds a pattern per ink (Blue = dots, Pink = diagonal lines, Yellow = horizontal lines). Minimum 4.5:1 text contrast, tap targets of at least 44px, and all controls labelled for screen readers.
- No Snoo, no Reddit orange, no karma jokes. It should look like a print shop, not like Reddit.
- Mobile first: design at 390×844, then check 768 and 1440.

## Onboarding (show, don't tell)

- The first-ever play starts with a 3-tap tutorial print on a 3×3 sheet: blue bar, yellow bar, see the green. One line of contextual hint per step, no text wall.
- Hints are short and disappear after the action ("Tap a stamp", "Now tap the paper", "Overlaps mix — that cell turned green").
- A "?" button reopens the ink-mixing legend at any time.

## Analytics: Devvit Journeys

- `permissions.journeys: true` in `devvit.json`.
- `App.Ready` when the game is interactive · `Journey.Start` on pressing Play · `Journey.Progress` as stamps placed ÷ tray size · `Journey.Interaction` for rotate / undo / hint · `Journey.End` with `{ complete, game: { win, score } }`.
- No PII in action fields. (Events only flow after Reddit approves the app; instrument anyway, since judges look for it.)

## Data hygiene (Devvit rules)

- Handle `PostDelete` (delete that post's Redis keys) and account-deletion triggers (remove the user's `t2_` ID from all keys).
- Set Redis key expiry on per-user daily data (90 days).

## Redis keys (initial plan)

- `puzzle:{date}` → generated puzzle JSON (cache)
- `post:{postId}` → `{ kind: 'daily' | 'community', date, printId? }`
- `solve:{date}:{userId}` → `{ timeMs, lifts, clean, at }`
- `lb:{date}` → zset of userId by score
- `stats:{date}` → hash `{ solves, totalTimeMs }`
- `streak:{userId}:{year}` → bitfield
- `print:{printId}` → community print JSON · `prints:week:{isoWeek}` → zset of printId by score
- `wall:{YYYY-MM}` → hash day → `{ number, maker, solves }`
