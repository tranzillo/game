# Design lessons

Meta-principles for working within the game's design space. These guide individual encounter and card design and are derived from real iteration with the user across multiple sessions.

The biggest meta-lesson, holding the rest together:

> **Interesting design lives in the interaction between simple mechanics and tight conditions** — not in elaborate card text. Small adjustments to timing, board state requirements, or trigger conditions can dramatically reshape player decisions. *Generic mechanics + sharp conditions > elaborate cards + diffuse triggers.*

The rest of this doc unpacks specific principles.

## 1. Couple temporary effects to permanent outcomes

In-encounter buffs, debuffs, healing, and damage all reset when cards leave play (creatures revert to printed Durability when they leave a pile). They have *no run-impact alone*. They matter only when they trigger a *permanent* outcome.

**Permanent outcomes that matter at any encounter, especially neutrals:**

1. Card acquisitions (Recruit, Convert, Reroute, Stealswap, Research, Raise)
2. Card removals (deck-thin)
3. Permanent stat upgrades on specific cards
4. Permanent location/terrain modifications
5. Summoner-Durability changes (persists across encounters)

**Diagnostic test** when sketching any effect: *on its own, does this impact the run?* If no, it needs to couple to a permanent outcome — or it's design-irrelevant. Healing in isolation is irrelevant; healing that triggers a Convert mark on overheal is meaningful.

## 2. Timing is load-bearing

A trigger fires at a specific moment. The relevant board state must exist at that moment for the trigger to be meaningful.

- A heal at upkeep whiffs (the player hasn't committed yet).
- An end-of-main trigger lands after commits flip up.
- An end-of-combat trigger sees post-combat state (some dead, some surviving).
- An end-of-cleanup trigger sees the final state of the turn.

**Phase boundaries are real design surfaces.** End-of-combat vs end-of-cleanup is one phase apart but creates meaningfully different decision moments.

**Trigger position relative to consequence-resolution is a power-balance gate.** A trigger that fires *during* an event ("when X resolves here") sees pre-consequence state. A trigger that fires *after* the event has landed ("end of cleanup, if X happened this turn") sees post-consequence state. Same condition text, completely different encounter shape — the late trigger naturally filters the trigger-pool to events whose consequences haven't broken the gating board state.

*Worked example:* a structure with "while your side here is full and an opposing action resolved here, copy the action to your hand."

- *Trigger fires on resolution:* the side-full check happens before the action's consequences land. AI casts a damage spell here → side is still full at the resolution moment → copy fires → spell then clears your creatures, but you already got the copy. Damage spells get copied freely.
- *Trigger fires at end of cleanup:* the side-full check happens after the spell has resolved and damaged the board. Damage spell cleared your creatures → side no longer full → no copy. Only opposing actions whose consequences leave your side intact (buffs, persistent actions, non-damage utility) get copied.

The end-of-cleanup version is the design — the trigger position *is* the power gate. Moving the trigger one phase earlier removes the gating entirely.

## 3. Conflicting trigger conditions create the choice space

The single most important principle for interesting encounters: **independent additive effects produce flat encounters that read as menus.** Effects whose conditions *conflict* force real decisions.

Worked examples (all in `DESIGN.md → puzzle archetype matrix`):

- **Smith's Workshop:** Apprentice triggers at end of combat *if alive*; Forge triggers at end of cleanup *if exactly one creature is here*. Apprentice's survival enables one trigger but disables the other. Killing the Apprentice does the reverse. Threading both is a narrow window.
- **Forest Glade:** Trail Marker applies Reroute marks *post-combat*. Creatures that died during combat aren't "here" to be marked. This protects chump chaff and forces thinning onto valuable survivors.
- **Cursed Ground:** Hungry Crypt triggers if *exactly one* creature died on the relevant side. Punishes over-engagement — player must restrain from clearing the board.

**The pattern:** same cards with tighter conditions reshape the encounter without adding elements. Sharp conditions > more cards.

## 4. Generic mechanics + sharp conditions > elaborate cards

Don't reach for elaborate card text. The system is dynamic enough that simple cards at the right phase boundary create rich decision trees. Two generic Force-2 attackers + a single passive trigger create more interesting play than custom abilities + multiple loose triggers. The "design" lives in *how simple effects interact with the timing structure*, not in the printed text.

## 5. Summoner Durability is the run-cost lever at neutral encounters

In-encounter combat damage on creatures resets, so neutral encounters can't lean on creature damage as a cost. **Summoner Durability is what persists across the run** — letting neutrals attack unblocked is real run impact. That pressure makes blocking choices meaningful at neutral encounters.

## 6. Chump blocking is a design space

Low-Durability chaff dying in combat (before post-combat triggers fire) is *free defense* — chaff dies, doesn't get marked or buffed, returns to deck normally. Encounters can implicitly protect chaff by placing triggers post-combat, forcing valuable cards into the trigger zone instead.

This is the pattern for **forcing deck-thin onto valuable targets** — small chaff can't be thinned because it dies before the thinning trigger fires. Deck-thin becomes a real cost rather than a cheap chaff cycle.

## 7. Hand state shapes the encounter

"What if the player only has high-value blockers in hand?" creates emergent dilemmas. Different runs experience the same encounter differently based on what was drawn. **Encounters with state-dependent right answers are deep; encounters with single optimal plays are flat.**

## 9. "Should we print this?" — encounter cards must work as player cards

Any card that prints (creature, structure, equipment, action) can end up in a player's deck via acquisition mechanics. So the design discipline for *any* card sketched in a neutral encounter is: **would I want this as a player-accessible card?**

If the answer is no — the effect is too encounter-specific, too narrow, too powerful for general play, or otherwise unsuitable for the player's deck — the effect shouldn't be a card. It should be **location text** on that specific node instead.

Location text is where context-bound and overpowered effects can live without entering the general card pool. The pending dual-state war/peace location text idea (held as Pass 2 / v3+ in DESIGN.md) sharpens this further: locations get *two* text states, allowing very different encounter shapes at the same node.

**Diagnostic when sketching a structure (or any card) for a neutral encounter:** can a player meaningfully play this card in their own deck via the normal flow? If no, reframe as location text.

A worked counter-example: *Hungry Crypt* (sketched in Cursed Ground): "if exactly one creature on your side died this turn, raise it as a Brute." On a player card, this is either useless (player creatures dying triggers an enemy-side raise — bad for the player) or too narrow (the "exactly one" condition is encounter-specific). Should be location text, not a structure card.

**Two failure modes of "shouldn't print":**

1. **Undesirable as a player card.** The effect adds bad-value cards to the player's deck or triggers negatively from the player's perspective. A player would never voluntarily run this card. *Worked example:* a structure that adds a generic Goblin Recruit token to your deck on trigger — adding low-value creatures to your deck is among the worst plays in a deckbuilder. The card is dead-on-arrival as a player card.
2. **Infinite-acquisition loop.** The effect generates a card / token / persistent action when triggered, *and* the player can self-trigger it in their own deck. Unbounded copies of the reward. *Worked examples:* a structure that grants a piece of equipment when destroyed (player attacks own structure for infinite equipment); a structure that grants a Quest each turn its condition is met (player satisfies the condition every turn for stacked Quests). Acquisition rewards that the player can self-trigger turn into "trigger this as many times as possible to add as many copies as possible to your deck" — a slippery slope to avoid.

Both failures → **reframe as location text.** The clean shapes for acquisition rewards in encounters: take a *unique opposing card* into the player's deck (Recruit / Convert / Stealswap targeting an actual encounter creature), permanent stat upgrades on cards already in the player's deck, or deck-thin on existing player cards. Don't generate generic tokens or new card copies as rewards.

## 8. Default behaviors implied; only exceptions printed

Card text shouldn't repeat the default. Defaults aren't printed; only departures are.

- **Costs:** default `≥1` of the relevant stat; print only `≤`, comparative, scaled, or compound.
- **Scope:** default `here`; print only `supply line`, `all your locations`, etc.
- **Side:** default `your side`; print only `the other side` or cross-side cases.
- **Resolution destination:** default discard pile for actions; print only `graveyard`, `exile`, etc.

**The discipline:** card text encodes the *exceptions*, not the defaults.

---

## Working notes for collaboration

These are about *how I work on this project*, not the design itself.

- **Don't extrapolate.** Capture only what the user explicitly stated or confirmed in conversation. If a section feels thin, it stays thin — that's accurate.
- **Don't cite past extrapolations as binding rules.** If I made an inference in a prior session and wrote it into the doc, it's still an inference. When the user proposes something that conflicts with a past inference, treat the user's new proposal as the data point, not the inference.
- **Don't lock things in the docs without explicit collaboration.** Sketches I propose in conversation aren't locked. Adding a sketch to DESIGN.md / CARD_DESIGN.md / DECISIONS.md without the user's sign-off is the same failure pattern as padding — it creates content the user has to clean up. When in doubt, propose in conversation, then commit only after the user confirms.
- **The diagnostic for a proposed mechanic:** does it create *condition tension* (real choices via conflicting conditions) or just additive options (menus)? If it's a menu, redesign with sharper conditions.
- **The diagnostic for a card text addition:** does this encode an exception to a default behavior, or am I re-deriving the default? If the latter, cut it.
- **The diagnostic for a printable card:** would a player want this in their deck via the normal acquisition flow? If no, reframe as location text or a non-card mechanic.
- **Check the actual rules text of keywords before sketching.** Don't lean on a remembered or invented version of a keyword. Recruit, Convert, Lurk, Stealswap, Reroute, etc. each have specific definitions in DESIGN.md — grep them before using them. *Common errors I've made:* using "Recruit" as "acquire on death" (Recruit actually moves an *in-play* creature from the other side to yours — dead creatures are not legal targets); using Lurk as "stays face-down, ambushes" (Lurk actually stays face-up and briefly stealths *reactively* when an enemy flips up at the location, doubling its flip-up trigger); restating universal rules as keyword-specific text (e.g., "while face-down, untargetable" is the base game rule, not a Lurk clause). Multi-slot creatures are Recruit-resistant by default (the destination footprint usually fails to align). One grep avoids a sketch-iteration loop.
- **Don't crutch on Ruins-class structures.** A "Ruins" — pre-placed standing structure on the player's side at a location, doesn't shuffle into piles, persists at the node — is a real but *occasional* class. The framing is tempting because it lets puzzle effects sit "on the player's side" without acquiring them through the normal flow, which feels like it sidesteps the printability problem. It doesn't: if the effect would go infinite or undesirable as a printed card, the Ruins framing is just hiding location text behind a card-shape. Default to other-side structures or location text for puzzle effects; reach for Ruins-class only when the design genuinely needs a player-side persistent the player didn't bring.
