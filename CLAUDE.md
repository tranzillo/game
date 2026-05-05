# Claude orientation — read this first

This is a long-running hobby project: the design and prototype of a single-player, browser-based, asymmetric, turn-based, roguelike deckbuilder card game played against an AI opponent. The user collaborates on this in short sessions across many days/weeks.

**Before responding to anything substantive, read `DESIGN.md`, `DECISIONS.md`, and `PROTOTYPE.md` in full.** They are the source of truth for the project. This file orients you to the *collaboration*; those files orient you to the *design and the build plan*.

## Project state

- **Pass 1 (high-level model) is complete** as of 2026-04-29 and substantially expanded that day with twelve additional decisions covering action queue mechanics, ammo/ranged combat, equipment, conditional stat printing, color-identity sharpening, and more. The docs are large but coherent.
- **v0 prototype scope is agreed** as of 2026-04-29 (see `PROTOTYPE.md`). Build session has not started.
- **No code exists yet.** No JS framework chosen. No package.json. The repo is currently docs only.
- **The next concrete deliverable** is the v0 build per `PROTOTYPE.md` — one playable encounter, one location, one stat (Force), ~8-card deck, dumbest-possible AI, single HTML file.

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
- **`PROTOTYPE.md`** specifies the build increments. v0 scope is a contract — do not pull mechanics from later increments into v0 without an explicit user decision to widen scope.
- **Open Questions in `DESIGN.md`** are tagged *(high)* / *(medium)* / *(low)* by priority for upcoming card design and prototyping. Use these tags to steer conversation toward the high-value gaps when the user asks "what should we work on?"
- **Pass status:** Pass 1 (high-level model) is complete. Pass 2 covers detailed mechanics (turn structure phase-by-phase, card anatomy, board/zones, combat resolution, AI opponent tuning). Pass 2 is intentionally deferred until after a vertical-slice prototype.

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
- **Don't push toward implementation prematurely.** The user has been clear that design conversation is fun and valuable. Mention the prototype as an option but don't pressure.
- **Don't commit to git on the user's behalf.** The user handles commits and pushes manually. You can stage files (write/edit them) but never run `git commit` or `git push` without an explicit request.
- **Don't try to be exhaustive in a single response.** The user prefers focused, targeted responses with sharp follow-up questions over comprehensive walls.

## Project paths and conventions

- Repo root: `C:\Users\kappa\Documents\Projects\game\` (Windows paths; bash shell uses forward slashes)
- Platform: Windows 11, Claude Code in VS Code
- The user can also work from another machine after pushing to GitHub. The docs are designed to be self-contained enough that a fresh Claude session reading `CLAUDE.md` → `DESIGN.md` → `DECISIONS.md` can pick up work coherently.

Welcome to the project. Read the design docs, and let the user steer what we work on next.
