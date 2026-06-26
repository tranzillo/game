# Game (working title)

A browser-based, single-player, asymmetric, turn-based roguelike deckbuilder played against an AI opponent. The overworld map *is* the battlefield; player and enemy summoner play the same card rules; five stats (Force / Tempo / Insight / Resolve / Spite) triple-duty as combat math, economy, and local cost-gating. Runs entirely in the browser — no backend, no install.

## Status

In active development. The original vanilla-JS prototype (archived under `archive/v0-prototype/`) validated the core loop; the current `main` is a clean rebuild on a TypeScript/React/Zustand/Framer Motion architecture, proceeding through feature-phases A–N (see `REBUILD_PLAN.md` §24).

## Tech stack

TypeScript · React · Zustand · Framer Motion · Vite · Vitest. The engine (`src/engine/`) is pure game logic with no React/DOM/timer dependencies; the Zustand store (`src/store/`) wraps it; React (`src/ui/`) reads state and renders. The engine never imports the UI.

```
npm install
npm run dev        # dev server
npm test           # headless engine tests (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build
```

## Docs

- `REBUILD_PLAN.md` — **the authoritative build contract.** §1–§24 cover the player experience, encounter/overworld model, architecture, and phase plan; §25–§34 are the locked design surfaces.
- `DESIGN.md` — large living design document; source of truth for the *design space* (color identities, mechanics, open questions). Predates the rebuild — reference, not contract, where it conflicts with `REBUILD_PLAN.md`.
- `DECISIONS.md` — append-only log of decisions and reasoning (newest at top).
- `CLAUDE.md` — orientation for AI collaboration sessions.
- `STATUS.md`, `ARCHITECTURE_LESSONS.md`, `DESIGN_LESSONS.md`, `CARD_DESIGN.md` — supporting docs.
- `PROTOTYPE.md` — historical; the original vanilla-JS increment ladder, superseded by the rebuild.
