# Decisions

Append-only log of meaningful choices and the reasoning behind them. Newest at the top. Don't edit past entries — add a new entry that supersedes them.

Format:

```
## YYYY-MM-DD — Short title
**Decision:** what we decided
**Why:** the reasoning
**Alternatives considered:** what else was on the table
**Supersedes:** (optional) link to a prior decision this replaces
```

---

## 2026-04-29 — Stats are vocabularies, not deck identities

**Decision:** Stats (and their associated colloquial colors) are mechanical *vocabularies of effect*, not deck-construction identities. The player cannot pre-commit to a "color." Decks are emergent multi-color blends built run-by-run from neutral encounter rewards.

**Why:** The game is a roguelike deckbuilder where the player accumulates cards opportunistically through a run. There is no class-locked card pool. The system must work — and be fun — at any stat distribution. Treating stats as factions creates commitment-trap design patterns (a single Red card in an INT deck would be dead weight) that break the roguelike loop. Reframing stats as *axes the card pool varies along* removes that trap and makes cross-stat synergy a primary design goal rather than a tradeoff.

**Implications:**
- No stat can be a pure commitment trap. Single off-color cards must contribute meaningfully.
- STR and DEX are connective-tissue stats appearing across all flavors ("gold and silver"), gluing decks together economically.
- The *colors* (Red/Green/Blue/White/Black) are colloquial labels for stat flavors, not enforced deck-construction rules.
- Card design discipline now includes: "does this card contribute meaningfully when spliced into a foreign-flavor deck?"

**Alternatives considered:** MTG-style color identity with hard or soft commitment. Rejected — violates the roguelike loop where the player can't choose their pool.

## 2026-04-29 — Card types and combat-vs-non-combat permanents

**Decision (cluster):**

1. **Three slot types per location:** creatures, structures, spells. Each holds its corresponding card type.
2. **Creatures have printed durability (HP)** as a separate value, not derived from any stat. Every creature has durability, regardless of whether it has any other stats.
3. **Combat-as-violence is decoupled from existence-as-attackable.** A creature with no STR exists in a slot, has durability, can be targeted by combat damage, and is destroyed when durability reaches 0 — but does *not* deal damage itself. Force-less creatures are a deliberate design space (utility creatures, Insight/Faith stat-printers, etc.).
4. **Structures have no durability and are not in the combat damage system.** They are destroyed only by specific effects ("destroy a structure"). Structure-removal is a designed, color-flavored capability rather than a side effect of combat. Structures persist on the map across encounters (supply lines).
5. **Spells are events.** Default behavior: played in any phase, resolve at end of phase, exit to graveyard. Subtype: *persistent spells* override the exit rule (see separate decision).
6. **Spell-slot occupancy is a real strategic resource** because persistent spells stay in their slot across turns.
7. **Equipment** attaches to creatures rather than occupying a slot. Detailed rules deferred to Pass 2.

**Why:** The conflation of "engages in combat" and "exists on the battlefield" was preventing legitimate utility-creature designs. Separating them gives a clean rule (every creature has HP, not every creature has STR) and unlocks a whole tier of cards (the weak utility creature that prints stats and triggers effects but doesn't fight). Excluding structures from combat targeting means structure-removal becomes a distinct color-pie capability rather than an automatic combat side-effect — which preserves design space for structures as long-game investments.

**Alternatives considered:**
- *Structures as combat targets with their own HP.* Rejected — would conflate structure-removal with combat-removal and erase a clean color-pie axis.
- *Creature HP derived from VIT.* Rejected previously; reaffirmed here. (Original rejection: would force every creature to print 1 VIT or be DOA.)
- *Universal combat-style removal of all card types.* Rejected — kills the meaningful distinction between persistent (structures) and volatile (creatures) permanents.

## 2026-04-29 — Persistent spells: Prayer, Curse, Counterspell

**Decision (cluster):** Three named persistent-spell archetypes are core to the design. Each occupies its spell slot across multiple turns rather than resolving and exiting at end of phase.

1. **Prayer (White / FAITH):** played by you into your own slot. Has a `pray N` channel cost. Each turn, FAITH-printing creatures on your side at this location automatically contribute 1 per FAITH point to channel progress. Damage to a contributing creature interrupts that creature's contribution this turn (but not other creatures' contributions). Resolves when remaining cost = 0 *and* the printed timing trigger fires that turn. Effects are above the curve for one-shot spells; the multi-turn channel is the cost-justification. Multiple prayers at one location each receive the full local Faith contribution per turn (Faith is presence, not a consumable).
2. **Curse (Black / VIT):** played by you into your own slot. *On reveal, migrates to the opposing side's spell slot* at the same location, where it persists as a debuff. If enemy slots are full at migration, the curse fails to migrate and stays in the caster's slot — the caster is stuck with their own debuff. Slow Curses (low DEX) reveal *after* enemy spells have resolved and exited, finding empty slots more reliably; fast Curses are *worse*. This is the rare mechanic where low DEX is strictly desirable.
3. **Counterspell (Blue / INT):** working name. On resolve, all spells currently in spell slots at this location are sent to the graveyard (Counterspell exempts itself). Hard counter to Prayers and Curses regardless of how long they've been channeling. DEX order matters for one-shot spells (fast spells resolve before counterspell catches them) but not for persistent spells (always in the slot when counterspell fires).

The three archetypes form a **three-way spell-slot tension**: White wants to occupy its own slots (Prayer), Black wants to occupy enemy slots (Curse), Blue wants to clear all slots (Counterspell).

**Why:** Persistent spells turn the spell slot into a strategic resource over time. They give White a unique cost-justification mechanic (channeling) that lets it print powerful effects without flooding the game with one-shot bombs. They give Black a non-combat way to project pressure (curses tick every turn from inside the enemy's slots). They give Blue a meaningful counter-play role (counterspell is a hard answer to both). The three colors' interaction in the spell economy creates rich strategic decisions across deck design and play timing. The slow-is-good inversion for Curses is mechanically distinctive and gives Black a real reason to print low DEX.

**Alternatives considered:**
- *No persistent spells; all spells one-shot.* Rejected — flattens spell design and removes the most distinctive tools for White and Black.
- *Persistent spells as a separate card type, not a spell subtype.* Rejected — adds taxonomy complexity without payoff; the slot occupancy rule does the work.
- *Counterspell as a stack-style interrupt during the play queue.* Rejected — violates Pillar 5 (no in-phase response chains). Counterspell is a normal spell that resolves in DEX order; its power comes from clearing slots, not from interrupting plays.

**Revisit when:** playtest reveals balance issues. Most likely pressure points: Counterspell too oppressive (mitigation: rarity, INT cost), Prayer channel-time too long to feel rewarding (mitigation: tune cost values down), Curse migration-failure rule too punishing (mitigation: failed-migration alternatives).

## 2026-04-29 — Comparative costs (opponent-relative)

**Decision:** Card costs may be expressed as comparative inequalities against the opponent's stat presence at the same location. Examples: "requires more STR here than your opponent," "requires less FAITH here than your opponent," compounds.

**Why:** Comparative costs add a strategic axis that absolute-only inequality costs miss. They enable rivalry-themed cards, underdog-power cards (only playable when losing the local stat war — self-balancing), make enemy stats informationally relevant beyond combat math, and discourage uncritical stat over-stacking.

**Working assumption (Open Question to confirm):** Comparative-cost checks happen at end-of-phase reveal, when both sides' totals are visible. If a card's comparative cost isn't met at reveal, the card fizzles. This avoids the fog-of-war problem of needing to know hidden enemy stats at play time.

**Alternatives considered:** Costs only allow absolute inequalities (≥ X, ≤ Y, = X). Rejected as strictly less expressive, with no offsetting design benefit.

## 2026-04-29 — Zombification (Black recursion gating)

**Decision:** When a creature returns to play from the graveyard via a Black "raise" / "resurrect" / equivalent effect, all stats other than STR and VIT clamp to 0 for the duration of that play. Such creatures are themed as **zombies**.

**Why:** Uncontrolled graveyard recursion would let any color's expensive creatures be replayed cheaply, breaking the resource-cost system. Clamping non-STR/non-VIT stats prevents Black from being a free splash for any other color's economy (raised Blue spellcasters can't fuel further Blue spells). It forces Black recursion to be combat-focused, reinforces the Black + Red affinity (Red creatures keep most of their value when raised; Blue/White/Green creatures come back as shadows), and aligns rule with theme (zombies are physical and tough, not smart, pious, or fast).

**Working assumption (Open Question to confirm):** zombification is an in-encounter status, not a permanent card state. Once the encounter ends and creatures shuffle back into the deck, raised creatures revert to printed stats. Otherwise a Black-heavy deck would worsen across a run from its own raise effects.

**Alternatives considered:**
- *No clamping; raised creatures return at full stats.* Rejected — breaks resource economy.
- *Raised creatures return at half-stats or with -1/-1.* Rejected — rule is harder to remember and doesn't produce the clean color-affinity pattern.
- *Zombification permanent across the run.* Held as Pass-2 question, but disfavored — would actively punish Black-heavy strategies as the run progresses.

## 2026-04-28 — AI architecture: heuristic + curated deck + shared card pool with player-only/AI-only flags

**Decision (cluster):**

1. **The AI is a heuristic system, not a search-based or learned system.** No MCTS, no neural nets, no minimax. Conventional scripted/scored play.
2. **Intelligence is split across three places:** designer-authored deck composition (the biggest lever, and pure data), card-level play hints (metadata on each card), and a small global scoring function (low hundreds of LOC) that picks card-target pairs by greedy score.
3. **Card pool is shared between player and AI**, with `playerOk` / `aiOk` flags on each card. Most cards (~80–90%) are shared. Player-only cards (~10–15%) handle effects that need human judgment. AI-only cards (~5–10%) handle boss/monster-flavored content that does not read as player content.
4. **Card design carries an explicit AI-evaluability discipline.** Every card is checked against four questions (player-decision-dependence, local-evaluability, target-legibility, multi-turn-planning) and tagged accordingly.
5. **Difficulty comes from transparent cheating, not clever play.** The AI is allowed earlier access to higher-rarity versions of shared cards, curated draw order, and head-start tempo. The AI is a *force-of-nature* opponent, not a peer player.

**Why:** The design has already eliminated the things that make game AI hard — no in-phase response chains, deterministic combat, no multi-turn hand planning, no attacker/blocker selection, no hand-information warfare. What's left ("given my hand and the map state, where do I play each card") is heuristically solvable. The shared-pool-with-flags model preserves the elegance of "symmetric roles, asymmetric agency" without forcing every player card to be AI-evaluable. Splitting intelligence across deck composition, per-card metadata, and a small scoring function keeps the engineering work small and shifts the burden to content authoring (which is where it belongs in this genre).

**Alternatives considered:**
- *Custom AI deck (separate card pool entirely).* Easier to AI, but breaks shared vocabulary between sides and feels like two different games. Rejected.
- *Fully-shared card pool with no flags.* Maximally elegant, but forces every card design to be AI-playable, which throttles player-side design space. Rejected.
- *Search-based AI (MCTS / lookahead).* Tractable for this game's branching factor but overkill for a hobby project, and produces behavior that is hard for the player to *read*. Game design wants legible AI habits; search-based AI works against that. Rejected for the foreseeable future.
- *RL / trained AI.* Wrong tool for hobby scale and wrong tool for legibility. Rejected.

**Revisit when:** playtest reveals the AI feels dumb in specific, repeatable ways. Most likely fixes are (a) more sanity-check rules layered on the heuristic, (b) richer per-card hints, (c) better deck stratification — in that order. Search-based augmentation is held in reserve and almost certainly will not be needed.

## 2026-04-27 — Stats-as-resources, scoped effects, summoners have HP only

**Decision (cluster):** Adopting a unified resource model and scope rule that replaces an MTG-mana-style economy:

1. **Summoners (player and boss) have HP only.** No personal stats.
2. **Stats live on permanents and on location terrain.** Per-location per-side stat totals are summed from both sources. Both contribute to all uses of the stat.
3. **Reading A — baseline integration.** Terrain stats and permanent stats sum together for *all* purposes: cost-paying, combat math, and global economy modifiers.
4. **Stats triple-duty:** combat math (STR/DEX/VIT), global economy modifiers (INT → draw, FAITH → hand size), and local cost-paying (every card has a stat-presence requirement at the location it's played).
5. **Costs may be inequalities in either direction:** ≥, ≤, =, possibly compound. Cards can require *low* stat presence as well as high.
6. **No separate resource currency.** "Lands" do not exist as a card type. Free-cost cards that print small amounts of stat fill that role.
7. **VIT is damage reduction, not HP.** Creature HP is a separately printed value.
8. **Scope of effects is local by default.** Card effects apply at the source's location unless the card text explicitly extends scope (`supply line`, `all your locations`, `everywhere`, etc.). Locations themselves are local-only by definition.
9. **Terrain is destructible only by rare premium effects, and only partially.** No combat or normal effect destroys location terrain. A small number of premium card effects can wipe a location's stat line and/or rules text. **Card-slot profile (the grid shape and slot counts) is never destructible** — it is structurally part of the battlefield. Terrain destruction is a designed escape valve, not the default; it produces a featureless-arena version of the location while preserving how the space is rendered.

**Why:** This collapses the entire game economy into one mental model — *what stats are present where, and how much does each side want each stat to be high or low at each place* — which does combat, deckbuilding, cost-paying, draw economy, and hand size simultaneously. It encodes the supply-line pillar mechanically (a far structure with `supply line`-scoped INT really is feeding your draw economy) instead of treating supply lines as flavor. It rewards positional commitment, makes locations feel meaningfully different, and creates rich emergent tension: every removal makes a hole; every kill of a stat-bearing permanent damages the opponent's economy *and* opens space for them to play something bigger next round.

**Alternatives considered:**
- *Reading B (baseline-only-for-cost-paying).* Terrain enables plays but doesn't count toward global economy. Would have made cards the sole economic engine. Rejected because Reading A creates more strategic counter-play (terrain is locally dominant but only matters in encounters that include the location, so it self-limits without needing a special rule).
- *MTG-style separate resource cards.* Rejected — having both "resource cards" and "stat-printing cards" would have duplicated systems. Free-cost stat-printers do the job with a single card type.
- *VIT = +1 max HP.* Rejected — would require every creature print at least 1 VIT or be DOA, awkward.

**Revisit when:** prototype reveals tuning issues. Likeliest pressure points: terrain stat values are too strong (because unremovable), or the inequality cost system creates unworkable card-design overhead.

## 2026-04-26 — Provisional: AI graveyard follows player rules

**Decision:** For the prototype, the AI's graveyard works the same as the player's: the graveyard is per-encounter; at encounter end, the graveyard recycles back into the AI's deck.

**Why:** Cleanest, most consistent rule. Matches the user's instinct ("AI plays the same card game"). The genuine concerns — pointless lategame turns playing weak chaff vs. AI running out of meaningful threats — are empirically answerable from a playtest, not from first principles. We don't yet know how often AI permanents die, how long encounters last, or how many cards the AI draws per overworld turn, so optimizing this rule before having a prototype would be guessing.

**Alternatives considered:**
- *Model A — Graveyard gone forever (per-run).* AI deck strictly thins across the run. "Attrition" feel. Risk: lategame AI is too weak if the player has destroyed too much.
- *Model C — Tiered graveyard.* Cheap cards die in the graveyard; designer-tagged "lategame-eligible" cards recycle. Solves both failure modes but adds tagging overhead.
- *Model D — Two-tier deck.* Structurally split: cheap finite cards used for spread, rarer recycling cards for lategame threats. Maps cleanly to the desired difficulty shape but adds deck-composition complexity.

**Revisit when:** the first playable encounter exists. Specifically, watch for: (a) does the AI play obviously junk turns? (b) does the AI run out of meaningful threats before the boss is reached? Either symptom is a signal to revisit toward Model C or D.

## 2026-04-26 — Defer JS framework choice

**Decision:** No framework chosen yet. Will revisit after a vertical-slice prototype (one card type, one player action, one AI response) is working.

**Why:** Picking a framework before we can describe one full turn of the game biases the design toward whatever the framework makes easy. Better to learn the real shape of the state model from a tiny working prototype, then choose the tool that fits.

**Alternatives considered:** Pick Svelte / React / Vue / vanilla up front. Rejected for now — premature.

## 2026-04-26 — Browser-native, DOM-rendered, static-hostable

**Decision:** The game runs entirely in the browser as static HTML/JS/CSS. Cards are rendered as DOM elements with CSS transitions and HTML5 drag-and-drop. No canvas/WebGL, no backend.

**Why:** Single-player turn-based game with no real-time pressure — DOM is more than fast enough, and DOM is dramatically easier to style, animate, and inspect than canvas. Static hosting means the game can live at a domain name with zero server cost.

**Alternatives considered:** Canvas/WebGL (overkill, harder tooling), Electron/desktop (rejected — accessibility-by-URL is a stated goal).

## 2026-04-26 — Hobby cadence, design-first

**Decision:** Document the concept in `DESIGN.md` before writing code. Keep `DECISIONS.md` as the durable memory across sessions.

**Why:** Project is a long-running hobby across many short sessions. Without written context, each session re-litigates earlier choices. The docs are the handoff between sessions.
