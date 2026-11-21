# Overprint build progress

Resume rule: read this file and OVERPRINT.md, then continue from the first phase that
is not ✅.

## Phases

| Phase | What | Status |
|---|---|---|
| 0 | Housekeeping: Dependabot, no-repeat prints | ✅ (PR closing blocked, see Known issues) |
| A | Local preview harness (`npm run preview:local`) | ✅ |
| 2 | Game screen and riso look | ⏳ |
| 3 | Server, daily post, scheduler, sticky, splash | ⏳ |
| 4 | Result card, streaks, leaderboard, flair, share, subscribe | ⏳ |
| 5 | Tutorial, colour-blind mode, keyboard, sound, Journeys | ⏳ |
| 6 | Print Shop and Community Sunday | ⏳ |
| 7 | Gallery Wall and archive | ⏳ |
| 8 | Polish and compliance pass (reviewer + judge) | ⏳ |
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

## Decisions

- **devvit-mcp was unreachable** (connection timeout) for this whole run. Every Devvit API was checked
  against the installed type definitions in `node_modules/@devvit/*` (v0.15.4) and the devvit.json
  schema in `node_modules/@devvit/shared-types/schemas/config-file.v1.json`.
- Kept the spec's 30% minimum coverage and mixed-cell minimums unchanged (prints are compact as a result).

## Known issues / for the user

- Closing the 9 open Dependabot PRs with `gh pr close` was blocked by the session's permission
  classifier. Run: `for n in 1 2 3 4 5 6 7 8 9; do gh pr close $n --comment "Pinning dependencies during the hackathon."; done`
