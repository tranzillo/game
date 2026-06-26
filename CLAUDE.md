# Claude orientation — read this first

This is a long-running hobby project: the design and prototype of a single-player, browser-based, asymmetric, turn-based, roguelike deckbuilder card game played against an AI opponent. The user collaborates on this in short sessions across many days/weeks.

**Before responding to anything substantive, read the docs.** This file orients you to the *collaboration*; the other docs orient you to the *design and the build*. The authority order has changed as the project matured:

- **`REBUILD_PLAN.md` is now the build contract and the most authoritative doc.** Its §25–§34 are the *locked design surfaces* — they were worked through in conversation as direct corrections to prototype-era assumptions, and where they conflict with anything older, they win. Read it in full.
- **`DECISIONS.md`** (newest at top) is the append-only log; the entries from 2026-05 onward track the real build.
- **`DESIGN.md`** is the large living design document — still the source of truth for the *design space* (color identities, mechanics, open questions), but it predates the rebuild and mixes locked decisions with AI elaboration. Treat it as reference, not contract, where it conflicts with `REBUILD_PLAN.md`.
- **`STATUS.md`** audits implementation-vs-design (note: some of it predates the current rebuild — verify against the code).
- **`PROTOTYPE.md`** describes the *original* vanilla-JS v0 increment plan and is now historical; the rebuild superseded it.

## Project state

- **The game is a real, working TypeScript/React/Zustand/Framer Motion app** under active development — not docs-only, not a prototype-in-planning. `npm test` (500+ tests), `npm run typecheck`, and `npm run build` are all green as of 2026-06-26.
- **History:** the original single-file vanilla-JS prototype (archived under `archive/v0-prototype/`) validated the loop; a first straight port failed and was reverted (branch `archive/2026-05-25-failed-port`); the current `main` is a clean from-scratch rebuild on the architecture locked in `REBUILD_PLAN.md` §18–§23.
- **Build progress:** the rebuild proceeds in feature-phases A–N (`REBUILD_PLAN.md` §24). Phases A–G are committed (Phase G was the architecture-validation vertical slice); a large body of Phase H–L work (combat, triggers/deathwish, multi-location encounters, win conditions, overworld/run loop, AI play, Red/Green/Blue content, the unified timeline UI) is built and green but currently **uncommitted** in the working tree.
- **Most recent locked design** (mid-June 2026, see `DECISIONS.md` + `REBUILD_PLAN.md` §34): the *one-world-two-zooms* UI model (overworld node and encounter location are one object at two zoom levels; the timeline is one persistent L-frame chip travelling Future→Present→Past) and the *single run-scoped retreating enemy summoner* (damageable wherever present, retreats to survive, cornered only at its exit — no special "boss board"). The multi-summoner / multi-zone layer is designed but not yet built.

## How the user prefers to work

- **Conversation over documentation.** The user enjoys talking through ideas at length and does not want preemptive doc-writing during the conversation. Patch the docs only when the user confirms an idea is ready to be captured, or at the natural close of a substantial discussion.
- **Play back ideas before capturing them.** When the user shares a new mechanic or concept, your first move is to reflect it back in your own words so the user can confirm or correct your understanding. Then flag implications, ask follow-up questions, and *only then* discuss whether/how to write it down.
- **Flag implications proactively.** The user values when you notice consequences, tensions, or design-space-openings the user didn't explicitly call out. Don't just acknowledge — *think with them*.
- **Ask sharp follow-ups.** When the user's idea has gaps or ambiguities, list specific questions rather than guessing. The user often answers in batches across messages.
- **Honor "let me sleep on it."** The user sometimes ends sessions mid-thought. Capture state quickly so the next session can pick up.
- **Stat names are locked in as Force / Tempo / Insight / Resolve / Spite** (Red / Green / Blue / White / Black). Earlier doc passes used D&D placeholders STR / DEX / INT / FAITH / VIT — those have been retired. The current names are abstract-evocative and carry color flavor directly into the stat label. The user may occasionally slip and use D&D names because of years of conditioning; treat those as the equivalent canonical name and gently use the canonical version in your reply.
- **The user thinks in MTG references.** Magic: The Gathering is a fluent shared vocabulary. Slay the Spire too. Use these freely as shorthand. But also note: the user has explicitly *rejected* MTG-style stack/priority/response interaction and MTG-style color-as-deck-commitment. The MTG references are about phases, zones, and card-type vocabulary — not about play flow.

## Key design principles to internalize

These are the things that most often get lost in translation. Read `DESIGN.md` for the full picture; these are the concentrated essentials:

1. **The map *is* the battlefield.** When the player triggers an encounter, adjacent overworld nodes become locations on the battle board. The shape of the encounter changes based on where the player is.
2. **Symmetric roles, asymmetric agency.** Player and boss are both summoners playing the same card-game rules. Differences are in *movement* (player as pawn, boss as spreading wave from exit) and *power growth* (player from neutral encounter rewards, boss from designer-tuned head-start tempo).
3. **No interaction, but timing matters.** Both sides commit cards face-down to a *play queue*; cards flip and resolve in Tempo order at end of phase. There is no MTG-style stack/response chain.
4. **Stats are vocabularies, not deck identities.** The player can't pre-commit to a "color." Decks are emergent multi-color blends. Cross-stat synergy is a primary design goal, not a tradeoff.
5. **Stats live on permanents and on terrain.** Per-location per-side stat totals sum from both sources. Combat removes only the volatile portion (permanents). Terrain is a permanent local floor.
6. **Stats triple-duty:** combat math (Force/Tempo/Spite) + global economy (Insight → draw, Resolve → hand size) + local cost-paying (every card has a stat-presence cost requirement at its location).
7. **Costs include comparative-vs-opponent inequalities** (e.g., "more Force here than your opponent"), not just absolute thresholds.
8. **Effects default-local; wider scope is a printed premium.** "Here" is the default scope; "supply line" / "everywhere" cost card text to extend.
9. **Three persistent-spell archetypes:** Prayer (White, multi-turn channel), Curse (Black, migrates to enemy slot on reveal), Counterspell (Blue, clears all spells in slots at this location).
10. **AI is a heuristic system, not a search-based or learned one.** Intelligence is split across three places: designer-authored deck composition (the biggest lever), per-card play hints (metadata), and a small global scoring function. The AI cheats transparently; difficulty comes from cheating, not from cleverness.
11. **Encounters are unified.** There is **one** encounter system — every overworld move triggers a multi-location simultaneous-commit encounter. Within that encounter, locations may be hostile (AI present), neutral (a pre-authored on-board puzzle), or empty, possibly mixed across the encounter's locations. **Neutral encounters are not menus** — they are puzzles solved by committing player cards to the neutral location during the encounter. Per Pillar 10 (no on-resolve targeting), the reward-selection mechanic *itself* is positional: the player's commits are the targeting. The AI consumes neutral encounters by spreading into them on overworld turns (denying rewards to the player), and can also contest neutrals mid-encounter by playing cards in (racing or muddying the puzzle). See *Encounters: unified hostile/neutral framework* in DESIGN.md for the full model.

## Working with the documents

- **`DESIGN.md`** is the living design document. It is the source of truth for the *current* state of design. When you patch it, preserve coherence — the doc should read start-to-finish without contradictions.
- **`DECISIONS.md`** is append-only. New entries go at the *top* (newest first). Each entry includes Decision / Why / Alternatives / Revisit-when. Don't edit past entries — supersede them with a new entry if needed.
- **`REBUILD_PLAN.md`** is the authoritative build contract. §1–§24 capture the player experience, encounter/overworld model, architecture, and the A–N phase plan; §25–§34 are the *locked design surfaces* (the binding contract for the engine). Patch it only with the user's literal, confirmed words — its capture discipline is "no AI synthesis or fill-in."
- **`PROTOTYPE.md`** is historical: it specified the original vanilla-JS v0→v9 increment ladder, now superseded by the rebuild. Don't treat its v0 scope as a live contract.
- **Open Questions in `DESIGN.md`** are tagged *(high)* / *(medium)* / *(low)* by priority for upcoming card design and prototyping. Use these tags to steer conversation toward the high-value gaps when the user asks "what should we work on?"
- **Pass status (design passes in `DESIGN.md`):** Pass 1 (high-level model) is complete; Pass 2 (detailed mechanics) tags remain throughout `DESIGN.md` as deferred design-space markers. Note these design "passes" are orthogonal to the *build* phases — the rebuild (`REBUILD_PLAN.md` §24, phases A–N) is well underway and has implemented much of what `DESIGN.md` still tags "Pass 2." When `DESIGN.md` and `REBUILD_PLAN.md` disagree, `REBUILD_PLAN.md` is the contract.

## When the user shares a new design idea

A repeatable pattern that's served the collaboration well:

1. **Play it back.** "Here's what I think you said: ..." Confirm or correct.
2. **Flag implications.** Point out consequences, tensions, design-space-openings the user didn't explicitly call out.
3. **List follow-up questions.** Be specific. The user often answers them in batches.
4. **Surface things to flag.** Anything that *might* be a problem later. Even if it's not blocking, it's useful for the user to know it's noticed.
5. **Propose what to write into the docs** — but don't write yet. Wait for the user's go.
6. **When the user confirms, patch carefully.** Surgical edits, not rewrites. Update DECISIONS.md if the change is a real decision.

## Things to avoid

- **Don't write planning docs** unless the user explicitly asks. The user works from conversation, not intermediate files. (DESIGN.md and DECISIONS.md are exceptions; CLAUDE.md is this file.)
- **Don't push toward implementation prematurely.** The user has been clear that design conversation is fun and valuable. The code exists and is active, but design conversation still comes first — surface build work as an option without pressuring toward it.
- **Don't commit to git on the user's behalf.** The user handles commits and pushes manually. You can stage files (write/edit them) but never run `git commit` or `git push` without an explicit request.
- **Don't try to be exhaustive in a single response.** The user prefers focused, targeted responses with sharp follow-up questions over comprehensive walls.

## Project paths and conventions

- Repo root: `C:\Users\kappa\Documents\Projects\game\` (Windows paths; bash shell uses forward slashes)
- Platform: Windows 11, Claude Code in VS Code
- The user can also work from another machine after pushing to GitHub. The docs are designed to be self-contained enough that a fresh Claude session reading `CLAUDE.md` → `REBUILD_PLAN.md` → `DECISIONS.md` (→ `DESIGN.md` for design-space depth) can pick up work coherently.
- **Tech stack:** TypeScript + React + Zustand + Framer Motion + Vite + Vitest. Engine is pure (`engine/`), the store wraps it (`store/`), React reads it (`ui/`); the engine never imports UI. Scripts: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`. See `REBUILD_PLAN.md` §23 for the directory layout and `ARCHITECTURE_LESSONS.md` for the load-bearing implementation principles.

Welcome to the project. Read the docs, and let the user steer what we work on next.
