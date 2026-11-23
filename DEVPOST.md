# Devpost submission: Overprint

## Form fields (paste these)

| Field | Value |
|---|---|
| Project name | Overprint |
| Tagline | A daily riso-print puzzle: layer coloured ink stamps so their overlaps recreate today's print. |
| App listing | https://developers.reddit.com/apps/overprint-colors |
| Test subreddit | https://www.reddit.com/r/SUBREDDIT/ (public, under 200 members) |
| Demo post | link to the latest daily post in that subreddit |
| Repository | https://github.com/deevj37378/overprint |
| Video | YouTube/Vimeo link (public, under 1 minute). Optional, but add it before Dec 8. |
| Built with | devvit, devvit-web, react, typescript, vite, tailwindcss, hono, redis |

### Testing instructions (paste into the description or the testing field)

1. Open the demo post. The feed card shows today's proof and how many people printed it.
   Tap **Play**.
2. First time only, a 20-second tutorial teaches the press. Skip it any time.
3. Tap a stamp in the tray, then tap the paper to place it (or drag it there). Drag the dashed
   preview to adjust, tap it again (or **Stamp**) to press. Overlapping inks mix:
   blue + yellow = green, blue + pink = violet, yellow + pink = orange.
4. Match the small proof card exactly. Tap or drag a pressed stamp to fix mistakes; Undo works.
5. The result card shows time, lifts, streak, percentile and the day's leaderboard.
   **Share to comments** posts a spoiler-free emoji grid under the pinned comment.
6. **Print Shop** (link under the Play button on the feed card, or on the result card): design your own print, name it, post it.
   The best community print of the week becomes Sunday's daily.
7. **Gallery Wall** (next to Print Shop): every daily of the month hangs as a framed print with its solve count.

Difficulty follows the week: Monday 5×5 with two stamps, up to 7×7 with five stamps and a decoy
on the weekend. A new print is posted automatically at 00:00 UTC.

## Tagline

A daily riso-print puzzle: layer coloured ink stamps so their overlaps recreate today's print.

## Inspiration

Risograph printing is all about overprinting: each colour goes down as its own see-through layer,
slightly off-register, and the overlaps make new colours. Blue over yellow becomes green. We wanted
a daily puzzle where that physical "aha" is the whole mechanic. It needed to be readable at a
glance in a feed, finishable in a couple of minutes, and small enough to share as a row of emoji.

## What it does

- **A new print every day at 00:00 UTC, the same for everyone.** Tap a stamp, tap the paper, tap
  again to press. Inks mix where they overlap, and you match the small proof card exactly.
- **Difficulty follows the week:** Monday is 5×5 with two stamps; Saturday and Sunday are 7×7 with
  five stamps plus a decoy.
- **The feed post is a live preview.** It shows today's proof, how many people have printed it,
  your streak and a Play button. It renders straight from the post data, so there's no spinner
  in the feed.
- **One result card:** time, lifts, percentile, a ✦ clean-print stamp, your 🔥 streak, the day's
  leaderboard, and an emoji grid with no spoilers.
- **Reddit-native sharing:** *Share to comments* shows the exact comment, then posts it from your
  account under the app's pinned "Share your print here 👇". The comment thread becomes the day's
  wall of results.
- **The Print Shop:** players design their own prints with the same press and name them with word
  pickers (for example "Quiet Harbour"). Posting creates a puzzle post from their account. It's
  solvable by construction, because the placements *are* the solution.
- **Community Sunday:** the week's most-upvoted community print becomes Sunday's daily, credited to
  its maker, who gets Featured Printer flair.
- **The Gallery Wall:** each month's dailies hang as framed prints with their solve counts. Missed
  days stay as blank frames, so the subreddit ends the month with a poster it made together.
- **Streak flair, a first-play tutorial, colour-blind patterns, keyboard play, synthesised sounds
  (muted by default), and Devvit Journeys analytics.**

## How we built it

- **Devvit Web**, with React 19, Tailwind 4 and Vite on the client and Hono on the server. There
  are four entry points: the inline splash, plus game, shop and gallery.
- **A pure, deterministic engine** in `src/shared`. A mulberry32 generator seeded by the UTC date
  places random polyomino stamps, then rejects layouts with an invisible stamp, too few mixed
  squares, too much or too little ink, duplicate stamps, or a repeat of the same weekday's print in
  the last year. A unit test generates every day of a full year and checks every rule.
- **The riso look is real compositing.** Each ink is its own SVG layer with `mix-blend-mode:
  multiply` and about 1 px of misregistration. A turbulence and displacement filter gives the
  rough edges and speckle, and the paper grain is inline SVG noise. Nothing is fetched.
- **The server never trusts the client.** It regenerates each puzzle, re-verifies every submitted
  placement, clamps times to what it observed since the first pick-up, and counts only first
  solves. Redis holds the leaderboard sorted sets, streak bitfields, solves, community prints and
  the gallery wall. Per-user data expires after 90 days.
- **A local preview harness** (`npm run preview:local`) runs the real server code against
  in-memory fakes of Devvit's Redis, Reddit API, scheduler and Journeys. A control panel fakes the
  date, the player and the post, and an outbox lists everything that would have been posted to
  Reddit. That let us test every weekday, pre-launch previews, Community Sunday and logged-out play
  without uploading.

## Challenges we ran into

- **Difficulty rules that fight each other.** At least 30% of the sheet must be inked, and Sunday
  needs at least seven mixed squares, from five stamps on a 7×7 sheet. Purely random placement met
  that about 0.4% of the time. We steer later stamps toward existing ink of a different colour, and
  every rejection rule still applies afterwards.
- **Fair scores without trusting the browser.** We used a server-side start time, verification of
  the actual placements, and a first-solve-only rule.
- **Making a 7×7 board, a tray of six stamps and the controls fit a 320 px-wide phone** with tap
  targets that still work.

## Accomplishments that we're proud of

- The overprint colours are real, not painted swatches. The renderer composites the inks exactly
  the way a riso drum does.
- Every Reddit action (post, comment, subscribe) is a separate, explicit tap behind a confirmation
  that shows exactly what will be posted.
- The whole game runs and can be tested locally with the real server logic.

## What we learned

Daily games live or die on the first ten seconds in the feed. Rendering the proof straight from the
post data, with no network wait, made the feed card feel like part of the subreddit rather than a
loading box.

## What's next

- Weekly themes for the Print Shop ("only blue and pink", "use a decoy").
- A monthly gallery poster that the subreddit can download and print.
- Seasonal inks: a fourth fluorescent colour for special days.

## 50-second video script

| Time | Shot | Voice-over / on-screen text |
|---|---|---|
| 0:00–0:05 | Reddit feed, scroll stops on the Overprint card (proof preview, "312 printed today", Play) | "Every day, one print. Same for everyone." |
| 0:05–0:12 | Tap Play → the game: proof card, paper, wooden stamp tray | "Your job: recreate the proof with ink stamps." |
| 0:12–0:20 | Pick the blue bar, ghost appears, tap again, squash and ink bloom. Then yellow on top: the overlap turns green | "Inks are see-through. Blue on yellow makes green." |
| 0:20–0:27 | A quick run: rotate, press, lift one stamp, press again; the hint says "2 squares differ" | "Tap to place, tap to press, tap to lift. Fewer lifts, cleaner print." |
| 0:27–0:33 | Final press → the sheet slides out of the press → result card with the ✦ CLEAN stamp, streak 🔥 and percentile | "Print run! Clean, and faster than 72% of printers today." |
| 0:33–0:38 | Share sheet showing the exact comment → the comment appears under the pinned "Share your print here 👇" | "Share to the comments, on your terms, with no spoilers." |
| 0:38–0:45 | Print Shop: press three stamps, shuffle the title to "Quiet Harbour", Post | "Then make your own. The best print of the week becomes Community Sunday." |
| 0:45–0:50 | Gallery Wall: a month of framed prints, one blank frame. End card: Overprint wordmark, "r/[your demo subreddit]" | "One print a day. A poster we make together. Overprint." |

Shot notes: record at 390×844 on a phone (or the preview harness's phone frame) with sound on for
the stamp thunk and the win ka-chunk. Use a populated day: run "Add 6 fake players" in the harness,
or record on day 3 or later of the real subreddit.
