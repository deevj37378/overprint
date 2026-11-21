# Overprint: standing rules for Claude

Overprint is a daily riso-print puzzle for Reddit's Game of the Day hackathon, built on Devvit Web.
Also follow AGENTS.md (Devvit's template rules). Where the two overlap, this file is stricter.

## Spec

- `OVERPRINT.md` is the design spec and single source of truth. Ask before deviating from it, and
  ask before changing it. If code and spec disagree, ask which one is right.

## Platform

- Devvit Web only. Never use `@devvit/public-api` or "blocks" code, even if examples suggest it.
- Check Devvit APIs with the devvit-mcp tools. Never guess an API. If devvit-mcp is unavailable,
  check the installed type definitions in `node_modules/@devvit/*` and say so.
- Every new menu item, form, trigger, scheduler task or permission must also be registered in
  `devvit.json`.

## Interaction and performance

- Tap-only interaction. No drag, swipe, pinch, long-press or scroll-jacking.
- The inline splash (`splash.html`) must stay tiny and fast. Keep heavy dependencies in `game.html`.

## Network and assets

- No network calls to outside domains. Fonts and sounds are bundled or generated locally
  (no Google Fonts, no CDNs, no remote images).
- No Snoo, Reddit branding or Reddit orange in the game.

## Reddit actions

- Posting, commenting or subscribing as the user happens only from an explicit button press.
  Never automatic, never required for play, never bundled with another action.

## Deploying

- Never run `devvit publish` or `npm run launch`.
- Upload (`npm run deploy`) only when the user asks.

## Code

- Shared game logic lives in `src/shared`. It is pure (no I/O, no Devvit imports) and unit-tested
  with `node:test` (`npm run test:unit`, files named `*.test.ts`).
- Code style from AGENTS.md: type aliases (not interfaces), named exports (no default exports),
  no type casts (`as`, `!` non-null assertions, `<T>` casts).

## Workflow

- Before each commit, run `npm run test:types`, `npm run lint` and `npm run test:unit`, and fix
  whatever fails.
- One commit per prompt, with a clear message. Push after each commit.
