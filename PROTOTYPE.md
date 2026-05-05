# Prototype

This document defines the prototyping increments — what is in each version, what is intentionally cut, and why. The design space (`DESIGN.md`) is much larger than what any prototype implements. This file is the contract that prevents scope creep.

> **Status:** v0 scope agreed 2026-04-29. Build session not yet started.

## Why prototype increments at all

The full design is rich enough that trying to express it in one shot is the surest way to never ship anything. Each increment must:

1. **Add a small number of mechanics**, ideally one or two, on top of the previous increment.
2. **Answer a specific question** about whether the design *feels* the way it should on paper.
3. **Be playable end-to-end** — every increment is something a person could click through and have an experience, however bare-bones.
4. **Take one or two short focused sessions to build**, not a marathon.

Each increment's section below states what's in, what's deferred, and what we're actually trying to learn.

---

## v0 — One encounter, one stat, deterministic order

The smallest playable encounter that tests the central loop: round-based simultaneous commits, reveal-and-resolve, combat damage, summoner HP, deck cycling.

### What v0 includes

**Battlefield:**
- A single location. No map, no overworld, no neutral encounters.
- Slot profile: 2x2 creature grid, 1 structure slot, 1 action slot.
- No terrain stats. No location rules text. Featureless arena.

**Stats:**
- One stat only: **STR**.
- STR is used for combat damage, per-side per-location presence totals, and cost-paying.
- No DEX, VIT, INT, FAITH, or perception in v0.

**Phases (round-based, simultaneous, both sides):**
1. **Upkeep** — passive triggers fire (none in v0; phase exists as a sequencing anchor).
2. **Draw** — each side draws up to a fixed hand size of 5. If the deck runs out mid-draw, **shuffle the discard pile back into the deck and continue**.
3. **Main** — both sides commit cards from hand to slots simultaneously. Cards are visible immediately on play (no fog of war).
4. **Combat** — creatures attack in **fixed left-to-right order per side**. Damage applies per attack. Creatures at 0 durability go to graveyard immediately. Summoner damage from unblocked attackers reduces summoner HP.
5. **Cleanup** — discard the entire hand to the discard pile. Resolved actions go to the discard pile. Played-and-resolved permanents stay in their slots.

**Zones:**
- **Deck** — draw pile, starts shuffled.
- **Hand** — visible to the player; AI hand is hidden.
- **Slots on the location** — creature, structure, action.
- **Discard pile** — resolved actions and end-of-turn-discarded hand cards; reshuffles into the deck when the deck runs out.
- **Graveyard** — destroyed creatures. Nothing recycles in v0 because there's only one encounter.

**Cards:**
- A starting deck of ~8 cards per side, mostly identical for player and AI in v0 (both decks are the same; we're testing the loop, not the asymmetry).
- Card mix (working draft): 2–3 free-cost STR-printing creatures, 2 mid-cost combat creatures, 1 structure that grants "+2 STR to creatures here," 1–2 one-shot actions ("deal 2 damage to a creature here").
- All actions are one-shot in v0 — no Prayer, no Curse, no Counterspell.
- Card costs use only `≥ X STR` requirements. No comparative costs, no compounds, no `≤` inequalities.

**Combat:**
- Creatures attack one space directly in front of them.
- If no enemy creature is in front, attack passes through to the enemy summoner.
- Damage equals attacker's STR.
- No VIT (no damage reduction), no DEX (no initiative — fixed left-to-right order).
- Damage on creatures persists across rounds within the encounter; creatures shuffle back to deck at encounter end (which v0 only sees once, at game over).

**Win/loss:**
- Each side starts with summoner HP (working number: 20).
- First side to drop to 0 HP loses.

**AI:**
- Dumbest-possible: pick a random legal card from hand, play at a random legal slot/position, repeat until no legal play remains. No hints, no scoring, no strategy.

**Tech:**
- Plain HTML/CSS/JS in a single file, no framework.
- Static-hostable (open `index.html` in a browser).
- DOM-based rendering. Cards as `<div>` elements with CSS transitions for movement.
- No drag-and-drop in v0 — click-to-select-then-click-to-place is fine.
- Estimated size: ~300–500 lines.

### What v0 explicitly does NOT include

These are real design features documented in `DESIGN.md` but deliberately deferred:

- Map / overworld / multi-location encounters / variable adjacency
- Fog of war / face-down cards / reveal triggers
- DEX / dex-ordered combat / initiative / side priority
- VIT / damage reduction
- INT / draw economy modifiers
- FAITH / hand size modulation / card retention
- Persistent actions (Prayer, Curse, Counterspell)
- Equipment
- Ammo / ranged combat / front-back row distinction / cleave / friendly fire
- Comparative costs (vs. opponent)
- Effect scopes (everything is implicitly "here")
- Zombification / graveyard recursion
- Activation actions
- Conditional stat printing
- Random-target effects (no card in v0 has a target requiring choice)
- AI play hints / scoring / deck stratification
- Neutral encounter rewards / deck augmentation between encounters
- Player and AI deck differences (both decks are identical in v0)
- Color identity / multi-stat cards
- Boss-specific mechanics

### What v0 is meant to answer

The questions a v0 playtest should answer:

1. **Does the round-based simultaneous-commit loop feel good?** Both sides committing cards in main and revealing together is the most distinctive mechanical choice in the whole design. If it doesn't feel right at v0 with one stat, it won't feel right at v3 with five stats.
2. **Does deck cycling produce the pacing we want?** With an 8-card deck and a 5-card hand, the player will redraw their deck every couple of turns. Is that too fast? Too slow? We need real numbers to tune.
3. **Does the slot model feel like a real strategic resource?** Even with just 4 creature slots, 1 structure, 1 action, are players feeling slot pressure? Filling slots with permanents and running out of room is supposed to be a thing.
4. **Does end-of-turn full-hand discard feel right or punitive?** This is a strong feeling-decision (Hearthstone-style). Watching it live tells us whether FAITH retention is going to be a much bigger deal than we think, or a smaller one.
5. **Does combat resolution feel legible?** Even with fixed left-to-right ordering, creatures attacking and resolving in a deterministic visible sequence — is the player able to predict and plan?
6. **What state shape does the prototype actually need?** This determines the framework choice for v1. If we end up with 200 lines of state-juggling, maybe vanilla JS is fine. If it's 1000 lines and getting tangled, we'll know it's time for Svelte / React / whatever.

### What v0 is NOT meant to answer

- Whether the AI is fun (it's not, it's random; that's fine for v0)
- Whether the multi-location battlefield works (we don't have one yet)
- Whether the persistent actions are balanced (we don't have any yet)
- Whether the map / supply lines / fog of war / cross-encounter persistence all work (zero of these are present)
- Whether decks of mixed colors feel right (only one stat exists)

---

## v1 — Add DEX, fog of war, one persistent action

The first increment that meaningfully tests the *distinctive* mechanics of the design. v0 is a generic small card game; v1 is the first version that feels like *this* game.

### What v1 adds on top of v0

- **DEX as a second stat.** Combat resolves in DEX-descending order (with v0's left-to-right as the primary tiebreak; the full four-level hierarchy from `DECISIONS.md` can wait until later). Cards may print DEX values.
- **Face-down play and reveal.** Cards committed in main are face-down until end of phase, then flip and resolve in DEX order. This introduces "is revealed" as a distinct event from "enters play" and lets us start designing on-reveal triggers.
- **One persistent action archetype.** Pick one — probably **Counterspell** because it's the simplest mechanically (clears a slot on resolve, no channel mechanic, no migration mechanic). This tests whether persistent actions integrate cleanly with the queue. Prayer and Curse can wait until v2 or v3.
- **Slot occupancy as visible state.** The action slot now visibly holds persistent actions across turns.
- **A handful more cards** — probably 14–16 in the deck, with at least 3 DEX-printing creatures and one Counterspell.

### What v1 is meant to answer

- Does DEX-ordered reveal-and-combat make positioning and stat-investment feel like real decisions?
- Does fog of war + reveal triggers create the "oh god" moments we want?
- Does the action slot as a contested resource pull its weight?
- Does Counterspell feel like it has the right power level?

### What v1 still doesn't have

Everything from v0's "explicitly NOT included" list except for the items above. Specifically still not in: map, multi-location, VIT, INT, FAITH, equipment, ammo, ranged, comparative costs, scopes, multiple persistent actions, AI hints.

---

## v2 — Multi-location battlefield, variable adjacency UI

The version that tests the **biggest-known UX risk**: rendering 1–N location columns side-by-side, each with their own slot grid, in a way that's playable.

### What v2 adds on top of v1

- **Multiple locations on the battlefield**, 2–3 in a single encounter.
- **Variable adjacency UI** — locations rendered as columns, with a clear sense of "this column is left-right-adjacent to that column" for cross-location effects.
- **Local stat totals per location, per side**, visibly displayed.
- **Effect scopes** — the first cards with `here` (default, implicit) vs. `at all your locations` (explicit) so the scope rule actually matters.
- **A second persistent action** — probably Prayer, since it interacts with FAITH (which v2 may need to introduce). Or hold FAITH and Prayer until v3 if that's too much.

### What v2 is meant to answer

- **The single biggest UX risk in the whole design:** is the variable-adjacency battlefield actually playable on a normal screen? With 2 locations? With 3? With 5?
- Does cross-location targeting and scope vocabulary feel right at the card level?
- Does the simultaneous play across multiple locations feel coherent or scattered?

---

## v3 and beyond — sketch only

Increments past v2 are sketched here so we have a sense of the path, but each one will get its own concrete spec when we approach it.

- **v3:** Overworld map with hand-authored neutral and contested nodes. Encounter triggered by overworld movement. Player traverses a minimum-viable map (~6–8 nodes) from start to a single boss node. AI doesn't yet spread; AI cards are placed at nodes by the level designer, not generated. **First neutral-encounter implementations** — 3-5 hand-authored neutral-puzzle archetypes (siren, forge, wishing well, etc.) appear at neutral nodes; the unified hostile/neutral encounter framework (see DESIGN.md) becomes the actual encounter engine. Neutral cards live as third-party permanents on the board; engagement-cost rule active; AI in-encounter contesting of neutrals via adjacency rule.
- **v4:** AI summoner spreads from the boss node each overworld turn. Real spread-and-supply-line behavior. Difficulty curves emerge from the simulation rather than hand-authored placements.
- **v5:** Persistence across encounters. Player structures stay on the map. Supply-line scope effects start to mean something.
- **v6:** Full stat list (add INT, FAITH, VIT). Card pool grows substantially. Color identities start to feel distinct.
- **v7:** Equipment. Activation actions. Conditional stat printing. The full action subtype taxonomy (Prayer / Curse / Counterspell / Maneuver / Tactic).
- **v8:** Ammo and ranged combat. Front-back row distinction in combat resolution.
- **v9+:** Comparative costs, zombification, terrain destruction, full color affinity matrix, neutral encounter content, deck construction between encounters.

This ladder is provisional. Real playtest will tell us what actually wants to come next vs. what can wait. The discipline is: **resist adding mechanics from later increments early.** Each increment is a contract.

---

## Open questions about v0 specifically

These need quick answers before building, but are tunable:

- **Starting summoner HP.** Working assumption: 20. Could be 10 or 30; we'll tune.
- **Hand size.** Working assumption: 5. Could be 4 or 6.
- **Deck size.** Working assumption: ~8. Could be 6 or 12.
- **Combat damage to summoner when no creature is in front.** Working assumption: yes, attack passes through to summoner. Confirm.
- **Tie-breaking when both sides reach 0 HP simultaneously.** Working assumption: player wins ties (slight player favoritism, common pattern).
- **Whether v0 is one round per click or one phase per click.** Probably phase-by-phase to make the loop visible. Could even add a "step" button to advance one phase at a time for debugging.

These can be tuned during the build itself; the build doesn't wait on them.

---

## Build process notes

When we sit down to build v0:

1. **Single HTML file.** `index.html` with embedded `<style>` and `<script>` tags. No build step. Open in browser to play.
2. **State as a plain JS object.** No reactivity framework yet — direct DOM manipulation. The point is to *feel* the state-shape, so we know what we need from a framework in v1.
3. **Render after every state change.** Simple full-redraw rather than diffing. It's slow but legible at v0 scale.
4. **Log everything to console.** Phase transitions, card plays, combat resolution. We'll learn from watching the log even before the UI is polished.
5. **Iterate during build.** Don't try to spec every detail before coding. Build the simplest version, play it, fix what's broken, then add the next thing.

Estimated total build time for a clean v0: one focused session, possibly two if combat resolution gets tricky.
