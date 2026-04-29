# Design

This is a living document. It will be messy and contradictory at times — that's fine. The goal is to capture ideas as they come up so we can spot patterns, tensions, and gaps. We refine over many sessions.

When something is uncertain, write it down anyway and flag it under "Open Questions."

> **Pass status:** Pass 1 (high-level model) complete as of 2026-04-26, amended through 2026-04-29 with stats-as-resources, scope-of-effects, AI architecture, durability/violence distinction, color identities, persistent-spell mechanics (Prayer, Curse, Counterspell), relocate-on-reveal class, comparative costs, and zombification rule. Sections marked _Pass 2_ are intentionally deferred until the high-level model is validated by a vertical-slice prototype.

---

## Concept

A single-player, browser-based, asymmetric, turn-based, roguelike deckbuilder. Each run, the player traverses an interconnected overworld map from a starting node to an exit node, where a boss-summoner waits. Movement triggers card-game encounters whose battlefield is literally the shape of the map around the player: the player's current node's adjacent nodes become the "locations" on the battle board. Structures the player builds at locations persist on the map across encounters, forming "supply lines" that buff future encounters along that route. The boss is also a summoner who, from the opposite end of the map, spreads cards outward toward the player every overworld turn — so the map is being filled by both sides simultaneously, and the geometry of the run is the geometry of the conflict.

## Design Pillars

These are the load-bearing ideas. Any future design decision should be tested against them: if a proposed change weakens a pillar, that's a signal to look harder.

1. **The map *is* the battlefield.** Overworld geometry directly shapes each encounter. Adjacent nodes become battle locations; routing decisions are tactical decisions.
2. **Symmetric roles, asymmetric agency.** Player and boss are both summoners playing under the same card-game rules. Their asymmetry is in *how they move* (player as a pawn through neutral ground; boss as a spreading wave from the exit) and in *what supports them* (player gains power from neutral encounter rewards; boss gains power from designer-tuned head-start tempo).
3. **The map is the difficulty curve.** Encounter difficulty is emergent from the simulation — turns of unopposed AI build-up + supply-line resources flowing back to the boss. We do not script difficulty per encounter; it falls out of position on the map.
4. **Fog of war is mechanical, not flavor.** Cards play, accumulate state, and gain triggers face-down on nodes the player isn't present at. They flip face-up when the player establishes presence at that location. "Enters play" and "is revealed" are distinct events; cards can have triggers tied to either.
5. **No interaction, but timing matters.** There is no MTG-style priority/response chain. Both sides commit cards face-down to a *play queue*; cards flip and resolve in queue order. Within a turn, however, *which phase* a spell is committed in matters, because spells resolve at the end of the phase they were played in.
6. **Tempo tension across the run.** Playing slowly lets the AI keep building, fattening every future encounter. Playing fast — destroying committed AI permanents — frees up the AI's hand for reinforcements. Neither rushing nor stalling is dominant; the player must engage *thoughtfully*.
7. **Removal is itself a tradeoff.** Killing a stat-bearing permanent damages the opponent's economy at that location, but also frees a slot they may use better next round. There is no purely-good attack: every kill makes a hole the opponent can fill.
8. **Effects are scoped, by default local.** Card effects apply at the location of the effect-source unless their text explicitly extends scope ("supply line," "all your locations," "everywhere"). Wider scope is a premium, printed property — the difference between "this location" and "supply line" can be the difference between a single-encounter card and a run-defining card. Locations themselves are local-only by definition: their terrain text and stat lines apply *only* at that location.
9. **Persistence as the run's memory.** Player structures and locations persist on the map for the rest of the run. Routes the player takes leave durable consequences; routes they don't take let AI structures keep buffing the boss.

## Core Innovation

The single most distinctive mechanic in this design is the **map-as-battlefield + supply-line** pairing.

When the player triggers an encounter at node N, the battle board is constructed from N's adjacent nodes — each becomes a *location* on the battlefield with its own slot grid (creature slots, structure slots, spell-queue size). Any cards (player's *or* AI's) already at those adjacent nodes are present on the battlefield, face-down for AI cards until revealed.

Structures the player plays at a location stay there *after* the encounter ends. The next time the player passes near that node, those structures are still in play, contributing to that location's slots and effects. Resources from structures flow along the network: a structure on a far node can feed a current encounter through the chain of nodes back to the player.

The same is true in reverse for the AI: their structures along the unchosen branches of the map continue to feed the boss. So path choice is a tradeoff between *safest route to the boss* and *route that severs the most AI supply*.

## Asymmetry

The player and the boss serve **the same role** (summoner) under **the same card-game rules**, but with different shapes of agency:

| Aspect | Player | AI / Boss |
|---|---|---|
| Movement on the overworld | Moves a pawn from start node toward exit node, one node per overworld turn | Does not move. Plays cards from the exit node and any node it controls, spreading outward each overworld turn |
| Where it can play cards | At nodes adjacent to its pawn's current node | At nodes adjacent to any node it already controls |
| Source of run-power growth | Neutral encounter rewards at unoccupied nodes (deck additions, transformations, evolutions, stat bumps) | Designer-tuned deck composition + head-start tempo (more turns of unopposed build-up the closer to the exit) |
| Information visible | Sees the map, sees own cards, sees only revealed AI cards | (TBD; assumed to be a fair simulation under fixed AI rules — see Open Questions) |
| Win condition | Reduce boss HP to 0 via unblocked combat damage at the exit-node encounter | Reduce player HP to 0 via unblocked combat damage |

The asymmetry is *structural*, not *rules-based*. Both sides play the same card game; their experiences differ because their movement rules and power-growth rules differ.

## Stats & Resources (high-level)

The economy of the entire game collapses into a single mental model: **what stats are present where, and how much does each side want each stat to be high or low at each place.**

### Stats are vocabularies, not deck identities

The player cannot preassemble a deck around a chosen stat or color. Each run begins with a starting deck, and new cards are added by neutral encounter rewards more or less opportunistically. The player may end up STR-heavy because they got lucky (or chose well) with rewards, but they may also end up with a 60% STR / 25% VIT / 15% INT mixture because that's what the run gave them. **The system has to work — and be fun — at all those mixtures.**

This means stats are not factions. They are *axes the card pool varies along.* A card prints whatever stats and effects make it itself, and decks are emergent combinations of those vocabularies. Cross-stat synergy is the design goal, not a tradeoff.

Three concrete consequences:

- **No stat can be a pure commitment trap.** A single STR card in an otherwise INT deck must not be dead weight.
- **STR and DEX are connective tissue.** They appear across cards of all flavors, gluing decks together economically. That's why they are "gold and silver" — universal currency, not faction markers.
- **Stat identity is about *flavor of effects*, not *deck identity*.** A STR card and a VIT card sitting next to each other shouldn't fight; they should combine in a way that's interesting.

### Summoners have HP only

The player and the boss are summoners with HP. They have no stats themselves. All combat numbers, all card-cost requirements, and all economic modifiers come from the cards and locations *in play*.

### Stats live on permanents and on terrain

Stat presence at a location has two sources:

- **Terrain** — printed on the location itself; a permanent local floor unaffected by combat.
- **Permanents** — creatures and structures the side has in play at that location; volatile, removable.

Both sources sum into the per-side stat totals at that location. Combat can only reduce the volatile portion; terrain stays. Per the scope rule (Pillar 8), terrain stats apply *only* at that location.

### The stat list (working set — names are D&D-style placeholders pending theme work)

Names below are **placeholder labels inherited from D&D**. They commit too strongly to a fantasy/physical register and obfuscate the abstract themes the game wants to host. Final naming will follow once theme work is further along; the leading candidates are abstract-evocative names in the spirit of MTG colors (e.g., *Force* / *Edge* / *Bulwark* / *Insight* / *Resolve*). For the prototype, current names are fine.

- **Strength (STR)** — combat damage dealt. The most common stat; appears across all flavors. Often called "red" colloquially.
- **Dexterity (DEX)** — initiative / order of reveal and attack within a phase. Higher DEX acts first. Second most common; often called "green" colloquially.
- **Vitality (VIT)** — armor / damage reduction on incoming attacks. *Does not* set creature HP — HP (durability) is a separately printed value. Often called "black" colloquially.
- **Intelligence (INT)** — modifies cards drawn per turn (globally, summed across all the side's locations). Often called "blue" colloquially.
- **Faith (FAITH)** — modifies hand size kept after cleanup-phase discard (globally, summed across all the side's locations). Often called "white" colloquially.
- **Perception** — implied by the fog-of-war design; expected to gate effects that peek at face-down cards in the play queue. Currently held as a likely sixth stat, but possibly absorbed into Insight depending on color design.

STR and DEX are workhorse currencies — most cards print some STR and occasionally DEX, so they are broadly available across all card flavors and serve as universal cheap cost-payers ("gold and silver"). INT, VIT, FAITH are scarce, themed, high-impact: 2 FAITH at a location is a meaningful achievement.

### Durability is universal; combat-as-violence is not

Every creature on the battlefield exists in a world where a STR-bearing enemy can deal damage to it, and that damage has to interact with *something*. So **every creature has a printed durability (HP)**, regardless of its other stats.

But a creature having durability does **not** imply the creature deals damage back, has any STR at all, or even *could* engage in violence as a thematic concept. Force-less creatures exist as a deliberate design space: a scholar with no STR who occupies a creature slot, generates Insight, and dies if a hostile creature gets through to it. A relic-keeper that produces Faith but contributes zero combat threat. A herald that triggers a powerful effect on reveal and is otherwise inert.

Two ideas were being conflated and are now separated:

- **"Engages in violent combat"** — the card has STR; it deals damage; it is a combat threat.
- **"Exists in the battlefield as an attackable thing"** — the card has durability; it occupies a creature slot; it can be destroyed by combat damage.

Most creatures are both. The design intentionally allows the second-without-the-first.

A consequence: **decks with no path to dealing damage cannot win.** Combat damage and spell damage are the two ways to reduce summoner HP. A pure-utility deck with no STR creatures and no damage spells has no win condition. This is a known constraint, equivalent to deck construction in any card game; it self-enforces during play.

### Stats triple as combat, economy, and cost

Each stat that exists on a card does three jobs:

1. **Combat math** — STR is damage; DEX is order; VIT is reduction.
2. **Global economy modifier** — INT total (across all the side's locations) increases that side's draw count for the turn. FAITH total (across all the side's locations) increases that side's kept hand size at cleanup. Both are summed globally; this rewards spreading wide across many locations.
3. **Local cost-paying** — every card has a cost expressed as a stat-presence requirement at the location where it is played. Costs may be inequalities in either direction: ≥ X (need at least X), ≤ Y (need *no more than* Y), or compound. This means cards can be designed to play *only* in stat-poor or stat-imbalanced locations — a real mechanical home for off-archetype designs.

Triple-duty applies to stats that *exist on a card*. A card that prints no INT does not contribute to draw economy; that does not mean every card must print INT.

#### Comparative costs (opponent-relative)

In addition to absolute inequalities, costs may be **comparative against the opponent's stat presence at the same location**. Examples:

- "Requires more STR here than your opponent."
- "Requires less FAITH here than your opponent."
- "Requires equal INT."
- Compounds: "Requires more STR AND less FAITH than your opponent."

Comparative costs do significant design work:

- They create *rivalry-themed* cards. Dominance and underdog become real card identities.
- They make the opponent's stat presence informational beyond combat math — enemy stats can enable or disable *your* plays.
- They open desperate-power design space: "less STR than your opponent" cards are only playable when you are losing the local stat war, which is thematically and mechanically self-balancing.
- They give a strategic reason to *not* over-stack stats — over-accumulation can lock you out of certain plays.

Working assumption: **comparative-cost checks happen at end-of-phase reveal**, when both sides' totals are visible. If a card's comparative cost isn't met at resolution, the card fizzles. This avoids the fog-of-war problem of needing to know hidden enemy stats at play time. (Open Question: confirm in Pass 2.)

#### Cost-payment is a presence check, not a consumption

Paying a card's cost does **not** consume the contributing stats. Stats persist as long as the contributing permanents (and terrain) remain in play. Multiple cards played at the same location can satisfy the same stat presence repeatedly — the stat is not depleted by each play. This is consistent with stats being *presence*, not *resource pools*.

### No mana, no separate resource currency

What you have already played *is* your resource pool — and it is local to each location. Resource-card-style "lands" do not exist as a separate type. Their role is filled by free-cost cards (creatures and structures with no cost requirement) that print small amounts of stat — typically STR — to bootstrap the location's economy. Structures with non-trivial scope ("here," "supply line," etc.) are how the player builds run-wide engines.

### Tuning constraint: stat values stay low

Because stats are scarce by intent, and because terrain stats are removable only by rare premium effects, location terrain values should be modest. A 3-INT location is enough to dominate global draw economy for the encounters that include it, and most of the time neither side will be able to remove it. Terrain provides a local boost; permanent stat-printing carries the long game.

### Terrain destruction is rare, partial, and premium

Terrain is *not* literally indestructible. A small number of premium card effects can **destroy a location's terrain** — wiping its stat line and/or its rules text. This is uncommon and valuable; most cards cannot do it. The effect-class is a deliberate design space, not the default.

Critically, **terrain destruction does not affect the location's card-slot profile**. The grid shape, slot counts for creatures, structures, and spells are *structurally* part of the battlefield and cannot be removed by any effect — they're how the location is even rendered as a play space. You can wipe a shrine's "+2 FAITH here" stat line and its "creatures here gain +1 STR" rules text, but its 2x2 creature grid and 1 structure slot remain. The location persists as a featureless arena.

Terrain destruction may be partial (stats only, or rules text only) or full (both), depending on the printed effect.

## Card Types & Slots

Each location has three distinct slot types, each holding a corresponding card type. These types differ in how they interact with combat damage and the graveyard.

### Creatures

- Occupy creature slots (a per-location grid; default 2x2, but variable per location).
- Have **durability (HP)** — a separately printed value, not derived from any stat.
- Are **attackable by combat damage** in dex-ordered combat resolution. When durability reaches 0, the creature is destroyed and goes to the graveyard.
- May or may not have STR; without STR they exist but do not deal damage themselves (see *Durability is universal; combat-as-violence is not*).
- Contribute their printed stats to the per-side per-location stat totals while in play.
- At the end of the encounter, surviving creatures and graveyard creatures shuffle back into the deck (see graveyard rules).

### Structures

- Occupy structure slots (a per-location count; varies by location).
- Have **no durability and are not attackable by combat damage**. The dex-ordered combat system does not target them.
- Are destroyed only by **specific effects that target structures** ("destroy a structure" / "wipe all structures here" / etc.). This makes structure-removal a designed, color-flavored capability rather than a side effect of combat.
- Contribute their printed stats to the per-side per-location stat totals while in play.
- **Persist on the map across encounters** (this is the supply-line mechanic). Player structures the player has built remain at their location for the rest of the run unless explicitly destroyed.
- Themed analogously to MTG artifacts.

### Spells

- Occupy spell slots (a per-location count; default working assumption is 1, with variable per-location values; see Open Questions).
- Are **events**, not persistent objects. They have no durability.
- Default behavior: played in any phase, resolve at end of that phase, then go to the graveyard.
- A spell occupies its slot from the moment it is committed (face-down) until it resolves and exits. While it occupies the slot, no other spell can be played into that slot.
- **Persistent spell subtypes** exist that override the "leave at end of phase" rule and remain in the spell slot across turns (see *Persistent Spells*, below).

### Equipment (sketch — Pass 2 detail)

- Equipment cards do not occupy creature slots. They attach to a creature already in play.
- Detailed rules — slot impact, multi-equip, what happens to equipment when the equipped creature dies, stat contributions — are deferred to Pass 2.

### Spell-slot occupancy as a real strategic resource

Because persistent spells stay in their slot across turns, the spell slot is itself a strategic resource. A 1-spell-slot location occupied by a 4-turn Prayer means no other spell can be played at that location until the Prayer resolves or is removed. This is a real cost; it makes the *choice to commit a persistent spell* meaningful, and it makes effects that *clear spell slots* (see *Counterspell*, below) genuinely powerful.

## The Run Loop

A run consists of repeated **overworld turns**, each of which is one full beat of the simulation:

1. **Player overworld turn:**
   - The player chooses an adjacent node to advance toward.
   - If the chosen node and/or other adjacent nodes are *contested* (AI cards present), an **encounter** begins. The battlefield is constructed from those adjacent nodes.
   - If the destination is *neutral* (no AI presence), the player resolves a **neutral encounter** — a random event that may alter the deck (add/remove/transform/evolve cards), modify stats, or offer a reward gated by a card-played-here requirement (e.g. "play X faith here this turn for option A").

2. **AI overworld turn:**
   - The AI takes one mini-turn at *each node it controls*. A mini-turn means: draw, play cards face-down on adjacent nodes (including playing resource-cards, structures, creatures), end. Nodes nearer the exit have had more mini-turns of build-up than nodes far from the exit.
   - The AI's deck is finite. As it commits permanents to the map, its hand thins. As the player destroys those permanents, capacity returns to the AI for reinforcements during contested encounters.

3. The cycle repeats until either the player reaches and defeats the boss, or the player's HP reaches 0.

### Encounter resolution (high-level)

When the player triggers an encounter:

- The battlefield consists of one location per adjacent node (could be 1–N locations).
- Any AI cards already at those nodes are present, face-down. Any player structures from prior encounters along supply lines are present and active.
- Both sides play the standard card-game phase sequence (upkeep / draw / main / combat / cleanup) until the player has cleared all contested nodes of enemy threats, or the player loses.
- **Reveal trigger:** when the player puts a permanent into play at a location, all face-down cards at that location flip face-up at the end of that phase. Flipping triggers any "is revealed" abilities.
- **Win condition (encounter):** clear all contested adjacent nodes of enemies. The player must clear *all* contested adjacents to advance — no stealthing past.
- **Loss condition (run):** player HP reaches 0.

A more detailed turn structure (phases, the play queue, combat resolution, slot grids, stats) is deferred to **Pass 2**.

## Fog of War & Reveal

Fog of war does real mechanical work here, not just flavor.

- AI cards on uncontested nodes are **face-down** but **active**: they accumulate upkeep triggers, gain buffs from supply lines, and contribute to that node's state every overworld turn.
- The player has only partial information: they can see *that* something is on a node (card backs visible), but not *what*.
- When the player establishes presence at a location (puts a permanent into play there), the location's face-down cards flip at the end of that phase.
- Two kinds of triggers exist:
  - **Enters play** — fires when the card resolves into play (face-down or face-up).
  - **Is revealed / enters combat** — fires when the card flips face-up.
- Cards may be designed against either trigger, which gives the AI's "head start" cards meaningful design space (e.g., creatures that have been silently accumulating buffs for many turns vs. creatures that surprise the player on reveal).
- A future **perception** stat is intended as the dial for partial info: cards or effects that let the player peek at face-down cards in the play queue. (See Open Questions.)

## The AI Opponent

The AI is one shared **summoner** controlling a single, finite, designer-tuned deck. It plays from the exit node and any node it has spread to.

### Spread mechanics

- On each AI overworld turn, the AI takes a mini-turn at every node it controls. A mini-turn: draws cards, plays legally onto adjacent nodes (resource-cards, structures, creatures), ends.
- Nodes the AI reached earlier have had more mini-turns of build-up. So power-per-node = (turns of unopposed build-up) × (resources flowing in via supply line back to the boss).
- This produces an *automatic difficulty curve*: nodes near the exit are deep, well-resourced, supplied; nodes near the player's start are shallow, recently-spread, resource-poor.

### Hand thinning and reinforcements

- The AI's deck is finite. As it commits permanents to the map, its hand and deck thin.
- Early in the run, the AI's deck is mostly committed to far nodes. Few cards are held back, so encounters near the player's start contain fewer in-encounter surprises.
- As the player destroys committed AI permanents, capacity returns to the AI's hand. Lategame encounters draw from a refilled hand of meaningful threats.
- This produces a second emergent property: **the player creates the AI's mid-late game power spike** by clearing committed cards. Playing slowly lets the AI build; playing fast frees up its hand. This tempo tension is a design pillar.

### Graveyard handling

The AI follows the same graveyard rules as the player. (See `DECISIONS.md` for the provisional decision and the alternatives we considered.)

### Boss

The boss mirrors the player: a summoner with HP, not a creature on the battlefield. The player takes damage from unblocked combat damage; so does the boss. To defeat the boss, the player must reach the exit-node encounter and deal enough unblocked combat damage through the boss's defenders to reduce its HP to 0 — the same way the boss wins by reducing the player's HP to 0. There is no special "boss system" — the win condition uses the same combat damage mechanics that govern every encounter. Boss-specific mechanics (special phases, unique cards, scripted behaviors at the exit-node encounter) are deferred to **Pass 2**.

## Player Experience Goals

What we want the player to feel:

- **The strategist's pleasure of routing.** Path choice through the map is a real, fraught decision with durable consequences.
- **Earned competence.** Power growth comes from neutral encounter choices and from the supply lines you successfully build and defend. The deck at run's end reflects the run's choices.
- **The thrill of reveal.** Lifting fog at a contested location should produce real "oh god" moments, but never feel arbitrary — the player should be able to predict roughly how dangerous a node is from how long the AI has held it.
- **Tempo dilemma.** Every encounter, the player should feel the pull of "rush past" vs. "clear thoroughly," and neither should be dominant.

## Inspirations & References

- **Slay the Spire:** roguelike run structure, overworld map of nodes between start and boss, neutral encounter rewards augmenting a starting deck, deckbuilding via run choices.
  - *What we're not taking:* per-encounter combat is not StS-style turn-based duels with an isolated enemy. The encounter is a multi-location spatial battle whose shape comes from the map.
- **Magic: The Gathering:** phase structure (upkeep / draw / main / combat / cleanup), zones (deck / hand / graveyard / exile, with the addition of "discard" and an end-of-turn discard step), permanent vs. spell distinction, color/theme identity tied to strategy archetype, resource cards as "lands."
  - *What we're not taking:* MTG's interactive priority/stack with response chains. Our equivalent is a *play queue*: face-down commits that flip and resolve in order, with no in-phase responses. We also discard the entire hand at end of turn (Hearthstone-like), and creatures shuffle back into the deck after an encounter ends (graveyard is intra-encounter only for creatures; spells resolve to graveyard within an encounter).
- **Hearthstone:** end-of-turn hand discard, hard slot limits on the battlefield as a real strategic constraint.
- **Into the Breach:** information-rich turns, threat-telegraphing, combat that's largely deterministic once positioning is committed. Worth borrowing the discipline of "the player should be able to reason about outcomes precisely."

## Color Identities

Each stat anchors a *flavor of effect* — colloquially called a "color" — that runs through cards printing that stat. **Colors are not deck commitments** (see *Stats are vocabularies, not deck identities*); they are mechanical vocabularies that mix freely. A real deck is almost always a multi-color blend.

Each color is defined as much by what it *does not* do as by what it does. Asymmetric tradeoffs across the five colors are what makes deck blends interesting.

### Red — STR — the color of immediate threat

- **Identity:** the color every other color must engage with. Red exists, attacks, and forces other cards to react to its existence.
- **Creatures:** high STR, often modest in other stats. Combat-aggressive bodies. Most common color of creature in the pool.
- **Spells:** **buff combat stats** of allies. Red spells *do not deal damage themselves*; they amplify creatures already on the board.
- **Doesn't do:** spell-driven damage; deep utility; subtle disruption.
- **Win path:** combat damage to summoner HP, dealt by STR creatures.
- **Open question:** what is Red's structural weakness? Likely candidates: weak Insight/Faith distribution (poor card economy), poor structure synergy (weaker long-game scaling), poor cross-color cost compatibility. To be pinned down so card design has tension.

### Green — DEX — the color of speed, position, and disruption

- **Identity:** the tempo and rearrangement color. Acts first, moves things, manipulates *how* and *where* combat happens.
- **Creatures:** high DEX, often fragile (low durability or low VIT). Glass cannons that act before they can be killed.
- **Spells:** positional disruption (move a creature between slots or locations), reveal-order manipulation, stealth (re-flip an already-revealed card to face-down so it can re-trigger on its next reveal), combat-modal buffs that aren't pure damage (e.g., "double-strike: this creature attacks a second time at -1 DEX this turn").
- **Doesn't do:** durable defense, heavy combat sustain, pure damage piling.
- **Win path:** combat damage via fast strikes that kill before being killed; positioning that opens lethal lanes.

### Blue — INT — the color of cancellation, perception, and indirect damage

- **Identity:** the color of *making things not happen*. Insight is not just knowledge; it is the power to remove things from the equation.
- **Creatures:** intentionally weak on the board — low STR, modest durability — but print INT to fuel the spell economy and global draw count.
- **Spells:** **deal direct damage** (often scaling with INT presence), **counter or cancel spells** (see *Counterspell*), reveal face-down cards, manipulate the play queue / reveal order.
- **Doesn't do:** strong combat creatures; persistent on-board threat; durable structures.
- **Win path:** spell damage to summoner HP; out-of-combat reduction of opposing threats.
- **Note:** Blue creatures' weakness is structural and intentional. A Blue-leaning deck must run enough of another color to defend its soft creatures, or race the opponent before its creatures get cleared.

### White — FAITH — the color of belief and channeled intervention

- **Identity:** belief in things outside one's control; reliance on intervention from beyond. The slow inevitability color.
- **Creatures:** intentionally weak on the board, like Blue. Print FAITH to enable persistent channeled spells (*Prayer*, below) and to grow global hand size.
- **Spells:** primarily **Prayers** (see below) — persistent, channeled, powerful conditional effects whose cost is paid over multiple turns by Faith creatures present at the location.
- **Distinction from Blue:** Blue uses perception of reality to influence reality directly. White asks for outside intervention and waits for it to resolve. Blue acts; White prays.
- **Doesn't do:** fast tempo, on-board combat presence, immediate threat.
- **Win path:** outlasting the AI's deck-thin in attrition; the occasional dramatic Prayer payoff.
- **Open question:** what does White do *besides* Prayer? Healing (Faith-themed)? Damage prevention? Adjacent-creature buffs? Risk: if every White card is "weak creature + Prayer enabler," White becomes monotonous. White needs a second mechanical idea.

### Black — VIT — the color of costly engagement

- **Identity:** every interaction with Black is transactional. Black creatures *want to be hit*; engagement is their weapon.
- **Creatures:** high VIT (damage reduction), decent durability, often modest STR. Tank-shaped. Often bring **thorns** (retaliate when struck, gated on VIT) or **taunt** (redirect attacks). Hard to remove cleanly.
- **Spells:** **Curses** (see below) — persistent debuffs that migrate to the enemy's spell slot on reveal. Drain effects (cost summoner HP for benefit). Reanimate (return creatures from graveyard with stat clamping; see *Zombification*). Sacrifice-for-effect.
- **Structures:** Black is structure-friendly. Anti-creature defenses, graveyard-scaling structures, supply-line-extending fortifications.
- **Doesn't do:** fast tempo, heavy raw spell damage. Black is **deliberately slow**, and slowness is *good* for Curses (see below).
- **Win path:** indirect — outlast and grind, accumulate graveyard value, drain via Curses and retaliation. Pair with Red for direct damage paths.
- **Open question:** how do other colors *cleanly kill* Black creatures? If hitting Black is always punished, optimal play would be to ignore it. There must be answers (likely: Blue spell damage bypasses combat-triggered thorns; Green movement displaces; exile-class effects bypass graveyard recursion). To be pinned down so the meta is balanced.

### Cross-color affinity (emergent, not hard-coded)

Color affinities emerge from mechanical compatibility, not from explicit deck-construction rules:

- **Black + Red** is naturally strong. Zombification clamps non-STR/non-VIT stats to 0, so Red creatures recovered from the graveyard retain most of their value while Blue/White/Green creatures come back as shadows. Black wants to live on the board fighting; Red wants to fight; they're aligned.
- **Blue + White** is naturally strong. Both are weak on the board and rely on spells; their creatures complement each other as utility-printers. Blue counter-magic and White Prayer share spell-slot economy.
- **Red + Green** is the natural aggressor pair — fast and hard, positional and lethal.
- These are not enforced; players whose runs draw mixed cards will find emergent synergies in any blend.

## Persistent Spells

A *persistent spell* is a spell subtype that occupies its spell slot **across multiple turns**, rather than resolving and exiting at end of phase like a normal spell. Three persistent-spell archetypes have been designed:

### Prayer (White / FAITH)

- **Played** like any spell, into a spell slot at a location.
- **Does not** leave the spell slot on resolution. It **stays** until either fully resolved (channel complete) or removed.
- **Has a printed `pray N` cost** — the channel-progress counter, initially N.
- **Each turn, every FAITH-printing creature on the same side at the same location automatically contributes 1 to the prayer's progress** per FAITH point. (e.g., 4 FAITH at the location reduces remaining cost by 4 that turn.) Contribution is automatic; channeling is not a choice.
- **Has a printed timing trigger** — "on upkeep," "after cleanup," "at end of main." This is *when* the prayer can resolve.
- **Resolves** when remaining cost reaches 0 *and* the timing trigger fires that turn. On resolve, the prayer's effect happens and the prayer goes to graveyard.
- **A creature that took damage this turn does not contribute its FAITH to channeling this turn.** (Damage interrupts channeling — only for the damaged creature, not all Faith creatures at the location.)
- **Spell-slot occupancy:** the prayer occupies the slot the entire time it is channeling. Other spells cannot be played into that slot.
- **Multiple prayers at the same location:** if a location has multiple spell slots and multiple prayers are channeling, *each* prayer receives the full local Faith contribution per turn (Faith is presence, not a consumable).
- **Effects:** powerful, normally above the curve for one-shot spells — conditional removal, "summon a random card from your deck into play here," large board effects. The multi-turn channel is the cost-justification.
- **Vulnerable to:** combat damage to the channeling creatures (interrupts that turn), Counterspell (kills the prayer outright).

### Curse (Black / VIT)

- **Played** by you into your own spell slot at a location.
- **On reveal:** the curse **migrates** from your spell slot to the *opposing* side's spell slot at the same location. From then on it occupies their slot and applies its persistent debuff each turn.
- **Migration can fail:** if the opposing side's spell slots at that location are all full at the moment of migration, the curse cannot move and **stays in your own slot** — you are stuck with your own debuff.
- **Speed inversion:** because spells reveal in DEX order and slots clear as spells resolve, **slow curses (low DEX) reveal *after* enemy spell-slot cards have resolved and exited**, finding empty slots more reliably. **Fast curses are *worse*** because they reveal early when enemy slots are still full. This is the rare mechanic in the game where low DEX is *strictly desirable*.
- **Removed by:** Counterspell (Blue), specific anti-curse effects, encounter end (open question — see Open Questions).
- **Effect type:** persistent debuffs — deal damage each turn, reduce stats, prevent plays, etc.

### Counterspell (Blue / INT)

- A signature Blue spell. Working name; final naming Pass 2.
- **On resolve:** all spells currently in spell slots at this location are sent to the graveyard. (Counterspell exempts itself.)
- This includes persistent spells (Prayers, Curses) regardless of how long they've been channeling — a Prayer 1-cost away from resolving still dies. A Curse that migrated 3 turns ago still dies.
- **Timing:** Counterspell is itself a spell that resolves in DEX order. If counterspell reveals first this phase, it nukes everything pending at the location. If it reveals late, one-shot spells with higher DEX have already resolved and left the slot — they're safe. But persistent spells in slots are killed regardless of when counterspell fires this turn, because they're *currently in the slot*.
- **Hard counter to persistent-spell strategies.** Black's Curses and White's Prayers must play around Blue presence; if Blue has counterspell available, persistent spells are vulnerable.
- **Curse vs. counterspell timing:** if both are played the same turn at the same location, DEX order resolves it. If counterspell reveals first, the curse dies before migration. If the curse reveals first and migrates, counterspell (now in Blue's own slot) still resolves and clears the migrated curse.
- **Cost:** likely high INT (specifics Pass 2). Itself prints minimal stats.

### Spell-slot economy as a meta-system

Persistent spells turn the spell slot into a *contested resource over time*. Three colors have distinctive plays in this economy:

- White wants to *occupy its own slots* with Prayers (committed multi-turn channels).
- Black wants to *occupy enemy slots* with Curses (transferred multi-turn debuffs).
- Blue wants to *clear all slots* with Counterspell (denial of both above).

This three-way tension shapes deck design and play decisions whenever spell slots are involved.

## Relocate-on-Reveal Mechanic Class

Several effects in the game cause cards to *change location or side at the moment of reveal*. This is a coherent mechanic class worth naming explicitly so future card design has a vocabulary for it.

The general rule: **on reveal, this card may relocate** before its other effects resolve. Variations:

- **Where it can go:** same location's other slot / adjacent location / enemy side / specific slot type.
- **Failure cases:** target slot full, no legal destination, etc. — and what happens then (stays put / fizzles / different fallback).
- **Side controlling the destination:** your side / enemy side / neutral.

Two confirmed instances:

- **Green: shift / move.** Reposition your own card to a different slot or location. Used for tactical repositioning before combat resolves.
- **Black: curse migration.** Transfer your spell to the enemy's spell slot.

Future effects in this class might include creature transposition, spell handoff, or "play this at an adjacent location instead." Pass 2 will name and tighten the keyword vocabulary; for now, "shift" (Green) and "migrate" (Black, curse-specific) are the working terms.

Open questions: when does relocation resolve relative to other on-reveal triggers? Can a relocated card *also* fire its other on-reveal effects, or is relocation the entire reveal effect? What if a creature is moved while combat is mid-resolution? Pass 2.

## Zombification (Black recursion gating)

Black's graveyard recursion needs a balance constraint, because uncontrolled recursion would let any color's expensive creatures be replayed cheaply.

**Rule:** when a creature returns to play from the graveyard via a Black "raise" / "resurrect" / equivalent effect, **all stats other than STR and VIT clamp to 0** for the duration of that play. Such creatures are themed as **zombies**.

Consequences:

- **Prevents Black from being a free splash for any other color's economy.** A raised Blue spellcaster doesn't generate INT anymore; it can't fuel further Blue spells. Black has to live off STR and VIT.
- **Forces Black's recursion to be combat-focused.** Brought-back creatures contribute to combat (STR survives, VIT survives) but not to the spell economy.
- **Reinforces the Black + Red affinity.** Red creatures (typically high STR, low everything else) come back from the grave with most of their value intact. Blue/White/Green creatures come back as shadows.
- **Theme and rule agree.** Zombies are physical and tough; not smart, pious, or fast.

Working assumption: **zombification is an in-encounter status, not a permanent card state.** Once the encounter ends and creatures shuffle back into the deck, raised creatures revert to their printed stats. Otherwise a Black-heavy deck would worsen across a run from its own raise effects. (Open Question: confirm in Pass 2.)

A Pass 2 question is the keyword name — `raise`, `zombify`, `resurrect`, etc. — and whether multiple raise effects stack zombification differently.

## AI Architecture (high-level)

The AI opponent is buildable with conventional, well-understood techniques — no machine learning, no tree search, no novel research. The reason it is buildable is not that we will write a clever AI; the reason is that the design has already eliminated the things that make game AI hard.

### What this design has already removed

The AI does not need to:

- **React to opponent plays.** Pillar 5: no interaction. Both sides commit to the play queue blind. The AI never has to read or counter the player's move within a phase.
- **Search response chains.** No MTG-style stack of triggered effects. Combat is deterministic given a revealed board (Pillar 4 + dex-ordered resolution). There is no minimax over player counter-plays.
- **Plan multi-turn hand management.** End-of-turn discard means the AI's hand does not persist as a strategic asset across rounds. It plays from what it has each round.
- **Choose attackers and blockers.** Combat targeting is positional and determined by dex initiative. The AI never picks who attacks whom.
- **Bluff or read hidden information.** Neither side acts on what the other is holding. Strategic depth comes from positioning committed cards, not from hand-information warfare.

What's left is a much narrower problem: **given my hand and the current map state, where do I play each card I'm willing to play this turn?**

### The intelligence is split across three places

The AI is not one monolithic brain. It is the sum of three deliberately separated systems:

1. **Designer-authored deck composition.** This is where most of the difficulty curve lives. The AI's deck is not random; it is curated by run-stage and node-distance-from-boss. Far-from-exit nodes draw from a stratum of small/weak threats; close-to-exit nodes draw from a stratum of punishing cards. The AI has earlier access to higher-rarity versions of shared cards than the player can practically build toward. **This is invisible cheating, and it is the strongest tool we have.** It is also the lowest-engineering-cost lever — adjusting deck composition is data, not code.

2. **Card-level play hints.** Every AI-playable card carries metadata that a heuristic uses to pick where to play it: *prefer contested nodes*, *prefer high-STR locations*, *prefer nodes adjacent to the player*, *avoid playing in supply-line range of these cards (anti-synergy)*, *prefer fresh nodes for spread*, etc. New cards just print new hints. This is data, not new code.

3. **A small global heuristic that ties it together.** For each card-in-hand × each legal location, the AI computes a score from the metadata-driven hints plus a few situational bonuses ("the player is two nodes away — favor defensive plays", "this node is at stat saturation — devalue stat-stick cards here"). It greedily picks the best card-target pair, pays its costs, and repeats until it cannot or chooses not to play more this mini-turn. Expected size: low hundreds of lines.

There is no big rule tree. There is no AI brain to reason about. There are *card hints* (data) and a *small scoring function* (code), and the difficulty comes mostly from the **deck composition** the designer authored.

### Card pool: shared with player-only and AI-only flags

The AI plays a curated subset of the same card pool the player plays from, plus a small number of AI-only cards.

- **Shared pool (~80–90% of cards).** Most cards are designed to be playable by both sides. A card has metadata flags: `playerOk` and `aiOk`. Most cards have both.
- **Player-only cards (~10–15%).** Cards whose effects depend on player-only context — "look at the top 3 cards of your deck and put them in any order," modal effects requiring nuanced choice, deep multi-turn payoff cards. Tagged `playerOk: true, aiOk: false`.
- **AI-only cards (~5–10%).** Boss signature cards, monster-flavored effects ("every turn the player isn't here, this gets +1/+1"), AI-side inevitabilities that read better as enemy content than player content. Tagged `playerOk: false, aiOk: true`.

This preserves the symmetry that makes the design elegant — when the player attacks an AI creature, it is mostly a creature they recognize from their own card pool — while leaving room for genuinely AI-flavored content and avoiding the trap of giving the AI cards a heuristic cannot use meaningfully.

### Card design discipline: AI-evaluability as a constraint

Every card we design is evaluated against four questions:

1. **Player decision dependence:** Does using this card well require human-only judgment? If yes → player-only flag, or rework.
2. **Local evaluability:** Can a heuristic decide where to play this from local map state alone? If yes → shared-pool friendly.
3. **Target legibility:** If the card has targets, is "the right target" obvious from observable state? If yes → easy heuristic hint.
4. **Multi-turn planning:** Does the card pay off only with setup the AI cannot strategically pursue? If yes → AI-only equivalent, or accept sub-optimal AI play, or player-only.

This is a known design discipline, not a research problem. Most cards will pass. The ones that do not, we identify early and tag consciously.

### Where the AI does need real care

Three places where simple scoring is insufficient and we will spend more design effort:

- **Reinforcement decisions during contested encounters.** "Send threats now vs. save for later" is a pacing decision that's hard to encode in flat scoring. Likely solution: a per-card "reinforcement priority" score plus a small situational layer that tracks how much of the AI's hand has already been committed this encounter.
- **Supply-line investment vs. spread aggression.** The AI must balance building far-node infrastructure (scaling the boss) against spreading toward the player (threatening them sooner). This wants an explicit "AI strategy" knob — aggressive / balanced / fortify — that the designer sets per run difficulty.
- **Avoiding obviously dumb plays.** Heuristic AIs sometimes produce moves that score well but look stupid to a human ("never play a 0-cost stat-stick at a slot you'd rather save for a real threat," "never overcommit at stat-saturated nodes"). These are sanity-check rules layered on top, found and patched during playtest.

### The genre fits this approach

The AI does not need to be smart — it needs to be *interestingly threatening*. Slay the Spire, XCOM, Into the Breach: none of these have clever AIs. They have *visible, deterministic-or-semi-deterministic threats with legible intentions*, and the design challenge is in the player's responses. This game sits comfortably in that tradition. The AI's transparent cheating (curated decks, head-start tempo, exit-node home-field stat lines) provides the difficulty; the heuristic provides the credibility.

### Implementation sequencing (when we get there)

When we eventually build the AI, the order is:

1. **Dumbest possible AI first.** Random legal play, random legal location, repeat. Make an encounter playable end-to-end.
2. **Add deck stratification.** Curate the AI's card pool by run-stage and node-distance. This alone produces most of the difficulty curve.
3. **Add card-level play hints**, one card at a time. Each card you design comes with metadata.
4. **Add the global scoring function.** Tie the hints together with situational awareness.
5. **Iterate from playtest.** Most "AI improvements" are emergent from playing the game and noticing where behavior breaks immersion.

Most of the work is content authoring (cards with good hints, decks with good curves), not algorithm engineering. The AI will be only as good as the cards and the metadata we give it — which means card design discipline is the real bottleneck, not AI sophistication.

---

## Sections deferred to Pass 2

These are intentionally not yet written. They want a separate, careful pass *after* the high-level model is validated by a prototype, because precision is wasted if the high-level model needs revising.

- **Turn Structure (detailed):** phase order, what each phase resolves, the play-queue mechanics, when in a phase a spell is "committed" vs. "resolves."
- **Cards:** anatomy of a card, card effect grammar, exact stat-printing conventions, rarity tiers. (Type taxonomy is high-level-resolved: creature / structure / spell + equipment-as-attachment.)
- **Board / Zones:** slot grids per location, the 2x2 creature grid (front-row melee / back-row ranged), structure slots, spell-queue size, location-effect slot.
- **Resources & Economy (detailed):** card-level cost grammar, ammunition (and any other secondary resources), supply-line resource flow rules in detail, exact tuning of stat values and terrain values. (High-level model now in main doc.)
- **Combat:** front-row vs. back-row resolution, melee vs. ranged, ammo consumption, support-creature targeting (front/behind/adjacent/this-location/other-location/etc.), order of operations.
- **AI Opponent (detailed):** spread-rate tuning, draw-per-overworld-turn budget, exact deck stratification by node-distance, reinforcement-priority scoring details, boss-specific mechanics. (High-level architecture now in main doc.)
- **Stats (detailed):** what each stat does in and out of combat, how stats gate effects.

---

## Open Questions

Things we've raised but not pinned down. Items are tagged *(high)* / *(medium)* / *(low)* by priority for upcoming card design and prototyping.

### Color identities — gaps to pin down

- *(high)* **Red's structural weakness.** Every other color has a clear weakness; what is Red's? Likely candidates: weak Insight/Faith distribution (poor card economy), weak structure / supply-line scaling, poor cross-color cost compatibility. Card design needs a stated weakness so it has tension to play around.
- *(high)* **White's identity beyond Prayer.** Without a second mechanical idea, every White card risks being "weak creature + Prayer enabler." Candidates: healing (Faith-themed), damage prevention, adjacent-creature defensive buffs, "creatures here cannot be targeted" effects.
- *(high)* **How other colors *cleanly kill* Black creatures.** If hitting Black is always punished (thorns, taunt, graveyard recursion), the optimal play is to ignore it. There must be answers — likely: Blue spell damage bypasses combat-triggered thorns, Green movement displaces, exile-class effects bypass graveyard recursion. To be pinned down explicitly.
- *(medium)* **What DEX (Green) cost-pays for.** Faith pays for Prayers; Insight pays for Counterspells. What kind of card costs Dex? Likely: speed-priority effects, queue-order manipulation, movement effects (Green's mobility kit gated on its own stat), surprise reveals.
- *(medium)* **Perception's relationship to Insight.** Currently held as a likely sixth stat for fog-of-war manipulation, but possibly absorbed into Insight. Decide as Blue's design space firms up.

### Mechanics

- *(high)* **Equipment.** Confirmed as a card type that attaches to creatures rather than occupying a slot. Detailed rules — multi-equip, what happens when the equipped creature dies, whether equipment contributes stats to the location while attached, color identity — are entirely undefined.
- *(high)* **Healing.** Confirmed as Faith-themed. Heals creatures or summoner or both? How much? Can it exceed max durability? Big lever for White's defensive identity.
- *(high)* **What a card's "color" formally *is*.** A card with STR 2 and INT 1 is what color? Red? Red-Blue? "Mostly Red"? Either: (a) color is derived from printed stats (most cards are multi-colored), or (b) cards have a separate primary-color flag independent of stats. Affects AI play hints and card-design vocabulary.
- *(medium)* **Force-less creatures and combat math.** Force-less creatures occupy slots and are attackable. Are they entirely passive in combat, or do they "block" in some way? Does damage assignment force STR creatures to attack non-combatants by position rules? What does a 0-STR creature do during combat? — assumed: just sits there, takes damage when targeted.
- *(medium)* **Damage rule edge cases.** Is damage tracked as marked counters or as current-HP subtraction? Can damage exceed HP? Does VIT apply to *all* damage or only combat damage? (Blue's spell damage — should it bypass VIT?) Does damage carry across rounds within an encounter? — assumed: yes, until creature shuffles back to deck at encounter end.
- *(medium)* **Removal doctrine.** Which colors get cheap removal, conditional removal, no removal? Removal is the biggest balance lever in any card game; this needs a stated philosophy before too many cards are designed.
- *(medium)* **Activated abilities.** Mentioned in passing. What activates them — a phase action, a stat cost, a once-per-turn rule? Common (every creature has one) or rare (signature creatures only)?
- *(medium)* **Cost-grammar expressivity.** Confirmed: ≥, ≤, =, compound conjunctions (AND), comparative-vs-opponent. Also legal: scaled costs ("1 INT per card in your hand"), totals across multiple stats ("≥4 of any combat stat")? Pass 2.
- *(medium)* **Comparative-cost timing.** Working assumption: comparative costs check at end-of-phase reveal. Confirm; if a card's comparative cost isn't met at reveal, the card fizzles. Pass 2.
- *(medium)* **Per-encounter post-victory state.** Do destroyed enemy *structures* on a contested node go to AI graveyard, or are they removed from the map? What about *neutral* structures the player builds? Persistence rules need explicit enumeration.
- *(medium)* **AI's first-card problem & opening tempo.** AI plays under same stat-cost rules. Its first play on a fresh node depends on terrain baselines and free-cost cards. Tuning is a central balance knob.
- *(low)* **What "transform" vs. "evolve" mean precisely.** Working definitions: transform = turn this card into a different specific card; evolve = card transforms into a different specific card on meeting a printed criterion. Upgrade = numeric improvement of the same card.
- *(low)* **Boss-specific design.** Boss is a summoner with HP defeated by normal combat damage. Are there boss-only mechanics, phases, or special cards?
- *(low)* **Multiple encounters per overworld turn.** Assumed: one encounter per player overworld turn; advancing is the act that starts the encounter and ends the turn. Confirm.
- *(low)* **Reveal granularity in detail.** When a player permanent enters at a location, all face-down *resolved* cards there flip. Do face-down cards still in this turn's *play queue* also reveal, or only resolved permanents?

### Persistent spells — open mechanics

- *(high)* **Curse persistence across encounters.** A Curse on a location at encounter end — does it persist to next encounter? Probably yes (persistent spells live in the slot). But spell slots between encounters need explicit rules.
- *(high)* **Curse removal options.** Confirmed: Counterspell removes them. Specific anti-curse cards? Duration-based (lasts N turns)? Something else? Affects how punishing curses can safely be.
- *(medium)* **Prayer persistence across encounters.** A mid-channel Prayer when the player wins and leaves — persists or disposed? Probably disposed (channel is creature-driven and the player departs); confirm.
- *(medium)* **Spell slot resets between encounters.** What happens to spell slots at locations the player leaves? At locations the AI controls but player has departed?
- *(medium)* **Curse failure-on-full retention.** Confirmed: curse stays in caster's slot if enemy slots are full. Does it then *behave as a debuff against the caster*, or does it sit inert? Probably the former — the failed migration is the *worst case* of playing a curse.
- *(medium)* **Counterspell scope.** Default-local under Pillar 8 means counterspell hits this location's spell slots only. Variant for a higher-cost `everywhere`-scoped counterspell? Pass 2.

### Relocate-on-reveal mechanic class

- *(medium)* **When relocation resolves relative to other on-reveal triggers.** Pass 2.
- *(medium)* **Whether a relocated card can also fire its other on-reveal effects, or relocation is the entire reveal effect.** Pass 2.
- *(medium)* **Failure cases.** What happens if the destination slot is illegal (full, wrong type, no legal destination)? Pass 2.
- *(low)* **Mid-combat relocation.** What if a creature is moved while combat is mid-resolution? Pass 2.

### Zombification

- *(medium)* **Persistence of zombification across encounters.** Working assumption: in-encounter status only; reverts when creature reshuffles into deck at encounter end. Confirm.
- *(medium)* **Stacking with multiple raise effects.** Pass 2.
- *(low)* **Keyword name.** `raise` / `zombify` / `resurrect` / something else. Pass 2.

### AI

- *(medium)* **AI graveyard handling.** Provisionally: AI follows player rules (recycle to deck between encounters). Alternatives in `DECISIONS.md`. Revisit after first playable encounter.
- *(medium)* **AI deck stratification specifics.** Confirmed: AI deck is curated by run-stage and node-distance-from-boss. Specific stratification (how many tiers, which cards per tier) is Pass 2 tuning.
- *(medium)* **AI cards-drawn-per-mini-turn.** Central tuning knob.
- *(medium)* **Card play hint vocabulary.** Working set: prefer-contested, prefer-near-boss, prefer-near-player, prefer-fresh-spread, anti-synergy avoidance, stat-saturation-aware, plus persistent-spell-aware (e.g., curse-prefers-late-reveal). Full schema to be defined alongside first batch of card designs.
- *(medium)* **Global "AI strategy" stance knob.** Aggressive / balanced / fortify, set per run difficulty.

### Run / overworld

- *(medium)* **Map generation.** Procedural? Hand-authored? Seeded? Width and depth?
- *(medium)* **Highly-connected nodes as a tradeoff.** Confirmed in spirit. Tuning of slot counts per location, and whether some nodes have more slots than others, is Pass 2.
- *(medium)* **Neutral encounter design space.** Stat-based gated rewards are the clearest archetype. What other shapes do neutral encounters take?
- *(medium)* **Run length.** How many overworld turns from start to boss in a typical run?

### Cards & stats

- *(high)* **Stat naming.** Current names (STR/DEX/VIT/INT/FAITH) are D&D placeholders. Final naming is downstream of theme work. Leading direction: abstract-evocative (Force / Edge / Bulwark / Insight / Resolve, or similar).
- *(medium)* **Default spell-slot count per location.** Working assumption: 1 spell slot is default, with rare 2-slot variants. Confirm.
- *(medium)* **Effect scope vocabulary.** Working keywords: `here` (default, often implicit), `this location`, `adjacent locations`, `supply line`, `all your locations`, `everywhere`. Plus possible directional/relational terms. Full list to be locked in Pass 2.
- *(medium)* **Terrain destruction effect class.** Confirmed: rare premium effects can destroy a location's stat line and/or rules text (but never its slot profile). Open: how rare, what colors own it, whether destruction is reversible, whether partial destruction (stats-only or text-only) is a separate effect.

### UX / prototype

- *(high)* **Variable-adjacency battlefield UI.** A node may have 1–N adjacent nodes. The battlefield must render N location columns side-by-side, each with a slot grid. *This is the single biggest unknown to de-risk in the prototype.*
- *(medium)* **Drag-and-drop affordances.** How does the player target a specific slot at a specific location? Does the play queue have a visible representation?
- *(medium)* **Fog of war presentation.** Card backs on uncontested nodes — how visible from the overworld vs. only at battlefield render time?

### Framework / engineering

- *(medium)* **JS framework choice.** Deferred until vertical-slice prototype reveals real state-management requirements.
- *(low)* **Static-host target.** GitHub Pages? Custom domain? Pass 2.
