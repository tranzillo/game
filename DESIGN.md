# Design

This is a living document. It will be messy and contradictory at times — that's fine. The goal is to capture ideas as they come up so we can spot patterns, tensions, and gaps. We refine over many sessions.

When something is uncertain, write it down anyway and flag it under "Open Questions."

> **Pass status:** Pass 1 (high-level model) complete as of 2026-04-26, amended substantially through 2026-04-29. The 2026-04-29 amendments cover: stats-as-resources, scope-of-effects, AI architecture, durability/violence distinction, color identities, persistent actions (Prayer, Curse, Counterspell), comparative costs, zombification, the *Spell* card type renamed *Action* with per-color flavor subtypes, double cost-check (cast and resolve), ephemeral face-down state, stealth mechanics + DEX-spent principle, slot-as-scarce-resource framing, equipment as slotless modifier card type, attack patterns (cleave as pattern, not keyword), Red's identity as the *now* color, Blue/White's cost-shape distinction, the no-on-resolve-targeting pillar (effects pick at random from legal candidates), the action queue model + permanents-positional vs actions-temporal distinction, actions resolve to discard pile (cycling on deck-empty) with exile as premium one-shot keyword, the DEX ordering hierarchy (DEX → location → position → side priority via local DEX total + alternating fallback), White's second mechanical idea (healing + divine shield protection), Blue's two-archetype control suite (Counterspell + Stifle), Curse design discipline (static board auras or player-direct effects), front-row vs back-row combat semantics with front row as a blocker for the back row, ranged combat with ammo as the first consumable resource, equipment as modifier vs replacement (the "sets" class, e.g., bow sets ranged power), and the *activation actions* design class (actions that interact with permanents, replacing the "activated abilities on creatures" idea). See DECISIONS.md for full reasoning. Sections marked _Pass 2_ are intentionally deferred until the high-level model is validated by a vertical-slice prototype.

---

## Concept

A single-player, browser-based, asymmetric, turn-based, roguelike deckbuilder. Each run, the player traverses an interconnected overworld map from a starting node to an exit node, where a boss-summoner waits. Movement triggers card-game encounters whose battlefield is literally the shape of the map around the player: the player's current node's adjacent nodes become the "locations" on the battle board. Structures the player builds at locations persist on the map across encounters, forming "supply lines" that buff future encounters along that route. The boss is also a summoner who, from the opposite end of the map, spreads cards outward toward the player every overworld turn — so the map is being filled by both sides simultaneously, and the geometry of the run is the geometry of the conflict.

## Design Pillars

These are the load-bearing ideas. Any future design decision should be tested against them: if a proposed change weakens a pillar, that's a signal to look harder.

1. **The map *is* the battlefield.** Overworld geometry directly shapes each encounter. Adjacent nodes become battle locations; routing decisions are tactical decisions.
2. **Symmetric roles, asymmetric agency.** Player and boss are both summoners playing under the same card-game rules. Their asymmetry is in *how they move* (player as a pawn through neutral ground; boss as a spreading wave from the exit) and in *what supports them* (player gains power from neutral encounter rewards; boss gains power from designer-tuned head-start tempo).
3. **The map is the difficulty curve.** Encounter difficulty is emergent from the simulation — turns of unopposed AI build-up + supply-line resources flowing back to the boss. We do not script difficulty per encounter; it falls out of position on the map.
4. **Fog of war is mechanical, not flavor.** Cards play, accumulate state, and gain triggers face-down on nodes the player isn't present at. They flip face-up when the player establishes presence at that location. "Enters play" and "is revealed" are distinct events; cards can have triggers tied to either.
5. **No interaction, but timing matters.** There is no MTG-style priority/response chain. Both sides commit cards face-down to a *play queue*; cards flip and resolve in queue order. Within a turn, however, *which phase* an action is committed in matters, because actions resolve at the end of the phase they were played in.
6. **Tempo tension across the run.** Playing slowly lets the AI keep building, fattening every future encounter. Playing fast — destroying committed AI permanents — frees up the AI's hand for reinforcements. Neither rushing nor stalling is dominant; the player must engage *thoughtfully*.
7. **Removal is itself a tradeoff.** Killing a stat-bearing permanent damages the opponent's economy at that location, but also frees a slot they may use better next round. There is no purely-good attack: every kill makes a hole the opponent can fill.
8. **Effects are scoped, by default local.** Card effects apply at the location of the effect-source unless their text explicitly extends scope ("supply line," "all your locations," "everywhere"). Wider scope is a premium, printed property — the difference between "this location" and "supply line" can be the difference between a single-encounter card and a run-defining card. Locations themselves are local-only by definition: their terrain text and stat lines apply *only* at that location.
9. **Persistence as the run's memory.** Player structures and locations persist on the map for the rest of the run. Routes the player takes leave durable consequences; routes they don't take let AI structures keep buffing the boss.
10. **No on-resolve targeting; effects pick at random from legal candidates.** Card text narrows the candidate pool ("a friendly creature," "a creature here," "the front-most enemy") but never asks the player to choose at resolve time. When more than one card meets the printed condition, the actual recipient is **random**. The strategic skill is *setting up* a board state where exactly one card qualifies — or accepting random outcomes when it doesn't. Specificity is a printed cost: broad effects are cheaper but less reliable; narrow effects are more expensive but predictable. (Play-time placement decisions — which slot a creature occupies, which permanent equipment attaches to — are not "targeting" and remain player choices.)

## Core Innovation

The single most distinctive mechanic in this design is the **map-as-battlefield + supply-line** pairing.

When the player triggers an encounter at node N, the battle board is constructed from N's adjacent nodes — each becomes a *location* on the battlefield with its own slot grid (creature slots, structure slots, action slots). Any cards (player's *or* AI's) already at those adjacent nodes are present on the battlefield, face-down for AI cards until revealed.

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
- **Dexterity (DEX)** — initiative / order of reveal and attack within a phase. Higher DEX acts first; negative DEX is a legal printing. The full ordering hierarchy is in *DEX ordering and combat sequence*. Second most common stat; often called "green" colloquially.
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

Comparative-cost components are evaluated at the **resolve-time** cost check (see *Cost-check happens twice*, below), when the opponent's stats are visible. The cast-time check uses only the caster's visible state; comparative components against hidden enemy state pass at cast and bind at resolve.

#### Cost-payment is a presence check, not a consumption

Paying a card's cost does **not** consume the contributing stats. Stats persist as long as the contributing permanents (and terrain) remain in play. Multiple cards played at the same location can satisfy the same stat presence repeatedly — the stat is not depleted by each play. This is consistent with stats being *presence*, not *resource pools*.

#### Cost-check happens twice: at cast and at resolve

A card's cost requirements are checked at two moments:

- **At cast** — when the player commits the card to its slot. Uses whatever stats are face-up to the caster at that moment. Catches the obvious "I don't have an INT mage at this location" failure at the time of input. Comparative-vs-opponent components against hidden enemy state pass at cast.
- **At resolve** — when the action actually resolves. For an immediate (no-timing-trigger) action, that's the end of the cast phase. For a delayed-timing action, it can be several phases later. Cost requirements are re-evaluated against the current stat state; if conditions changed (your stat-printer was killed, an opponent's comparative stats moved), the action **fizzles**.

The resolve-time check is the binding one. A consequence: combat damage that lands between cast and resolve can disrupt enemy queued actions — killing an INT mage in combat can fizzle a Blue spell that was queued earlier. This is a real form of pre-resolution disruption that does not violate Pillar 5 (no in-phase response chain), because fizzling resolves *between* phases, not *within* one.

The longer the gap between cast and resolve, the more exposed the action is. Designers can tune power-vs-exposure per card by setting the timing trigger.

### No mana, no separate resource currency

What you have already played *is* your resource pool — and it is local to each location. Resource-card-style "lands" do not exist as a separate type. Their role is filled by free-cost cards (creatures and structures with no cost requirement) that print small amounts of stat — typically STR — to bootstrap the location's economy. Structures with non-trivial scope ("here," "supply line," etc.) are how the player builds run-wide engines.

### Slots are the actual scarce resource

Stat presence is unlimited in principle — once placed, a stat-printing permanent contributes its presence indefinitely, can be spent against many cost requirements simultaneously, and persists until something destroys it. What constrains play is not stat presence but the count of available **slots** at a location: creature slots, structure slots, and action slots are all bounded.

This produces a real tension: filling slots with permanents is how you generate stats, but a fully-filled board means leftover stat presence with no outlet. How colors handle this differs structurally:

- **Action-leaning colors (Blue, White)** cycle through action slots — actions resolve and exit, freeing the slot continuously. Their slot economy is fluid.
- **Combat-leaning colors (Red, Black, partly Green)** fill creature and structure slots with permanents that *stay*. They generate stats efficiently but face slot-cap pressure mid-encounter — leftover stat presence with no remaining slot to spend it on.

**Equipment** (see *Card Types & Slots*) is the slotless release valve that resolves this tension: equipment doesn't take a slot, it modifies an existing permanent, so it remains playable even when all permanent slots are filled. Equipment skews toward combat colors precisely because they are the colors that hit slot-cap most acutely.

### Tuning constraint: stat values stay low

Because stats are scarce by intent, and because terrain stats are removable only by rare premium effects, location terrain values should be modest. A 3-INT location is enough to dominate global draw economy for the encounters that include it, and most of the time neither side will be able to remove it. Terrain provides a local boost; permanent stat-printing carries the long game.

### Terrain destruction is rare, partial, and premium

Terrain is *not* literally indestructible. A small number of premium card effects can **destroy a location's terrain** — wiping its stat line and/or its rules text. This is uncommon and valuable; most cards cannot do it. The effect-class is a deliberate design space, not the default.

Critically, **terrain destruction does not affect the location's card-slot profile**. The grid shape, slot counts for creatures, structures, and actions are *structurally* part of the battlefield and cannot be removed by any effect — they're how the location is even rendered as a play space. You can wipe a shrine's "+2 FAITH here" stat line and its "creatures here gain +1 STR" rules text, but its 2x2 creature grid and 1 structure slot remain. The location persists as a featureless arena.

Terrain destruction may be partial (stats only, or rules text only) or full (both), depending on the printed effect.

## Card Types & Slots

Each location has three distinct slot types — creature, structure, and action — each holding a corresponding card type. A fourth card type, **equipment**, occupies no slot of its own; it attaches to an existing permanent. The four card types differ in how they interact with combat damage, the graveyard, and the slot economy.

### Creatures

- Occupy creature slots (a per-location grid; default 2x2, but variable per location). The grid splits into a **front row** and a **back row** with distinct combat semantics — see *Front row, back row, melee, and ranged*.
- Have **durability (HP)** — a separately printed value, not derived from any stat.
- Are **attackable by combat damage** in dex-ordered combat resolution. When durability reaches 0, the creature is destroyed and goes to the graveyard.
- May or may not have STR; without STR they exist but do not deal damage themselves (see *Durability is universal; combat-as-violence is not*).
- Contribute their printed stats to the per-side per-location stat totals while in play.
- At the end of the encounter, surviving creatures and graveyard creatures shuffle back into the deck (see graveyard rules).
- **Position is a player decision at play time.** When committing a creature to a location, the player chooses its slot (front-row vs back-row, column). Position determines combat behavior — front row auto-attacks (typically melee); back row is inactive unless it has a ranged attack pattern.

### Structures

- Occupy structure slots (a per-location count; varies by location).
- Have **no durability and are not attackable by combat damage**. The dex-ordered combat system does not target them.
- Are destroyed only by **specific effects that target structures** ("destroy a structure" / "wipe all structures here" / etc.). This makes structure-removal a designed, color-flavored capability rather than a side effect of combat.
- Contribute their printed stats to the per-side per-location stat totals while in play.
- **Persist on the map across encounters** (this is the supply-line mechanic). Player structures the player has built remain at their location for the rest of the run unless explicitly destroyed.
- Themed analogously to MTG artifacts.

### Actions

*Action* is the umbrella card type that covers all non-permanent plays. ("Action" replaces the earlier name *Spell*, which read too magical to fit Prayers, Curses, Green movement, and Red combat tactics.) Each color has a flavor subtype:

- **Spell** (Blue) — magical effects: counterspell, direct damage, perception, queue manipulation.
- **Prayer** (White) — channeled invocations.
- **Curse** (Black) — persistent debuffs that migrate to the opponent's slot on reveal.
- **Maneuver** (Green, placeholder name) — movement, stealth, repositioning.
- **Tactic** (Red, placeholder name) — combat-buffs and impulse effects.

Subtype names for Green and Red are working placeholders pending finalization (see Open Questions).

Mechanically:

- Occupy **action slots** (a per-location count; default working assumption is 1, with variable per-location values; see Open Questions).
- Are **events**, not persistent objects. They have no durability.
- Default behavior: played in any phase, resolve at end of that phase, then go to the **discard pile** (not the graveyard — see *Action resolution and the discard pile*, below).
- An action occupies its slot from the moment it is committed (face-down) until it resolves and exits. While it occupies the slot, no other action can be played into that slot.
- **Persistent action subtypes** (Prayer, Curse, the working-named "Counterspell" — see *Persistent Actions*, below) override the "leave at end of phase" rule and remain in the action slot across turns until they resolve or are removed.

#### Action slots are a queue, not positioned slots

Actions are not placed into specific slots by the player. They enter the location's action queue in the order they are committed: first action played here goes into slot 1, second into slot 2, etc. When an action resolves and exits, persistent actions in higher slots **shift up** to fill the gap.

This is the defining contrast with creature and structure slots:

| Card type | Player decision at play time | Why |
|---|---|---|
| Creature | which slot in the grid (front/back, column) | Position is a combat resource — front row attacks, back row protected |
| Structure | which slot in the grid | Same — physical space |
| Equipment | which legal host to attach to | Attachment is a placement-equivalent |
| Action | none — just queued in play order | Actions abstract *time*, not *space* |

**Permanents occupy physical space; actions occupy time.** Permanent positions are chosen by the player and matter for combat geometry; actions queue up and matter for timing. A migrating Curse goes to whichever enemy slot is first available — no random selection needed, queue-determinate.

#### Action resolution and the discard pile

Resolved actions go to the **discard pile**, not the graveyard. The discard pile reshuffles into the deck when the deck runs out, so actions cycle back into the player's hand over the course of an encounter.

This is the distinction between actions and permanents:

- **Actions are tactical, repeated tools.** A Counterspell, a damage Spell, a stealth Maneuver — these are designed to be cast multiple times across an encounter. Discard → reshuffle → draw → cast again.
- **Permanents are committed investments.** Creatures and structures, once destroyed, stay in the graveyard for the encounter. Creatures reshuffle into the deck *between* encounters; structures may persist on the map. Their cycle is slower than actions'.

Spell-focused win paths (Blue's direct damage, White's repeat-Prayer attrition) depend on this cycling. Without it, total spell damage per encounter is capped by deck composition. The cycling is naturally gated by other mechanics — stat presence requirements, slot occupancy, FAITH retention across cleanup, vulnerability of stat-printers — so the recycle doesn't bypass existing controls; it lets tools refresh.

A "premium one-shot" effect can override the discard cycle by printing **"exiled when this resolves"** — sending the card to the exile zone instead, where it cannot be recycled. This is the keyword space for the rare powerful effects that should be played once per encounter.

#### Activation actions: actions whose value depends on permanents in play

A signature design class within the action vocabulary: actions that **interact with the player's existing permanents at the location**. The action does nothing without the right kind of permanent on the board. This replaces the design space of "activated abilities printed on creatures" — instead of a creature carrying its own activatable text, an action card from your hand triggers an effect on creatures already in play.

Canonical examples:

- **Volley** (Green / Red): your ranged-pattern back-row creatures here fire (off-cycle, outside the combat phase). Cost: stat presence + ammo per shot.
- **Charge** (Red): a friendly front-row creature here attacks (off-cycle melee). Cost: STR presence.
- **Inspire** (White): friendly creatures here gain +X STR through their next combat. Cost: FAITH presence.
- **Drain** (Black): a friendly creature here takes 1 damage; opposing summoner takes 2. Cost: VIT presence.

Why this design class is genuinely satisfying:

- **The permanent IS the cost-prerequisite.** Cost-payment is stat-presence + the *right kind of permanent on the board*. The permanent provides implicit context the action needs.
- **Card economy gates everything.** No new resource types (no "mana per color"). The cost is a card from hand + the action slot + the stat presence.
- **Splash-friendly across colors.** A Red Charge can activate any color's front-row creature; a Green Volley can fire any color's ranged-pattern back-row creature. The action specifies the *kind* of permanent it needs, not a color match.
- **Setup matters.** A deck full of activation actions with no compatible permanents is dead in your hand. Board state determines playability — which is the kind of strategic constraint the design wants.
- **The action queue is the natural sequencer.** Multiple activation actions in the same phase resolve in DEX order via existing rules. No special "activated ability stack" needed.

The design rule that follows: **creatures are passive contributors; actions activate them.** Reserve creature card text for passive contributions (stats, attack patterns, on-reveal / on-damage / on-death triggers). Active effects belong on action cards, not creature cards. When tempted to print an "activated ability" on a permanent, the right move is almost always to print an action card that does that thing instead.

The class needs a short label for design discipline (working name: *activation actions*; alternatives include *triggered actions*, *permanent-dependent actions* — see Open Questions).

### Equipment

Equipment is the **modifier** card type. The other types do things or make things happen; equipment changes *how* an existing permanent does its thing.

- Equipment occupies no slot of its own.
- It attaches to a permanent (creature OR structure) — the card text specifies which host type.
- It modifies the host (changes attack pattern, adds stats, adds keywords, adds utility effects).
- When the host permanent leaves play, attached equipment leaves with it. Equipment is not separately destroyable by combat damage.
- Equipment can be destroyed by specific effects that print equipment-removal — parallel to structure-removal. This is a designed, color-flavored capability rather than a side effect of combat.

**Equipment as the slotless release valve.** Because equipment takes no slot, it remains playable even when a location's permanent slots are all filled. This makes equipment the primary outlet for excess stat presence in combat-heavy decks (see *Slots are the actual scarce resource*). It also gives encounters a natural mid-late arc: build → fill → equip.

**Creature equipment vs. structure equipment.** Different host types support different design space:

- **Creature equipment** (e.g., a sword) modifies combat behavior — changes attack pattern, adds combat keywords, raises combat stats.
- **Structure equipment** (e.g., an "intruder alarm" that prevents face-down cards entering stealth) provides utility, aura, or conditional effects local to the structure's location. Structures still do *not* enter combat regardless of any equipment attached — equipment cannot weaponize a structure into the dex-ordered combat system.

**Equipment as modifier vs. equipment as replacement.** Equipment effects come in two mechanical classes:

- **Modifier equipment** (the default class) *adds* to the host's existing capabilities — adds STR, adds an attack-pattern variant, grants a keyword. The creature's underlying stats still apply, with the equipment layered on top.
- **Replacement equipment** (the "sets" class) *overrides* an aspect of the host. The canonical example is ranged equipment that sets the wielder's ranged power explicitly: an archer with a bow uses the bow's printed damage value, not the creature's STR. Buffs to the creature's STR no longer scale the ranged attack — the bow is the attack. Replacement equipment is the design space for "the weapon defines the wielder" effects.

The two classes interact differently with Tactics buffs and other stat-scaling: modifier equipment passes buffs through; replacement equipment makes buffs irrelevant for the replaced aspect.

Several details (per-permanent equipment cap, color identity per equipment archetype, color-neutral equipment, equipment + zombification interaction, equipment-removal color-pie) are tracked under Open Questions.

### Action-slot occupancy as a real strategic resource

Because persistent actions stay in their slot across turns, the action slot is itself a strategic resource. A 1-action-slot location occupied by a 4-turn Prayer means no other action can be played at that location until the Prayer resolves or is removed. This is a real cost; it makes the *choice to commit a persistent action* meaningful, and it makes effects that *clear action slots* (see *Counterspell*, below) genuinely powerful.

Persistent actions also worsen the slot-cap pressure described in *Slots are the actual scarce resource*: a location with its lone action slot occupied by a multi-turn Prayer can play no further actions there. White and Black, both of which lean on persistent actions, have structural reasons to value equipment as a complementary release valve.

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

### Attack patterns (high-level)

Combat targeting is determined by per-card **attack patterns**, not by global rules.

- The **default** attack pattern: a creature deals damage to one space directly in front of it. (This implies a directional grid — Pass 2 will pin down the geometry.)
- Cards may print **custom attack patterns**: multi-target, AOE, ranged-into-back-row, side-hitting.
- **Cleave is not a separate keyword.** It is an attack pattern that happens to include same-side spaces. The same primitive that gives Red an AOE-into-wide-opponents answer also produces Red's friendly-fire / self-cleaning behavior.
- This unification means "anti-wide" tooling and "anti-ally" tooling for Red are the same design surface, viewed from different directions.

Detailed combat geometry — front-row vs. back-row, melee vs. ranged, "in front" semantics in a 2x2 grid, how patterns interact with face-down creatures and equipment-modified attack patterns — is **Pass 2** detail.

### Front row, back row, melee, and ranged (high-level)

The 2x2 creature grid splits into a **front row** and a **back row** with distinct combat semantics:

- **Front-row creatures** auto-attack each combat phase using their attack pattern — typically melee, hitting the space directly in front.
- **Front row as a blocker.** When the opposing front row is empty (in the relevant column or position — Pass 2 detail), front-row attackers can reach the opposing back row directly. So bodies in the front row matter not just for their own attacks but as a *protective wall* for the back row.
- **Back-row creatures are inactive in combat by default.** They contribute stats and may have on-reveal / on-damage / on-death triggers, but they do not auto-attack unless they have a **ranged** attack pattern (printed on the creature, or granted by equipment).
- **Back-row ranged creatures** auto-fire each combat phase given a printed/granted ranged pattern and available ammo at the location.

### Ranged combat and ammo

Ranged combat is the second non-melee damage subsystem (alongside Blue spell damage). Both bypass thorns; they differ in how they're produced.

**Ranged attack rules:**

- A ranged attack pattern lets a back-row creature attack across rows or locations (specifics per printed pattern).
- **Ranged attacks bypass thorns.** Thorns retaliate against melee engagement; ranged attackers are not engaged in melee, so no retaliation triggers. This is one of the structural answers to the Open Question of how to cleanly kill Black creatures.
- **Ranged attacks are not blocked by front-row creatures.** They shoot over.
- **Ranged attacks consume ammo.** Each ranged attack costs 1 ammo from the firing creature's location stockpile (working assumption: 1 per shot is the global rule; specific cards may print higher ammo costs).

**Ammo as a consumable resource:**

- **Ammo is a location-level stockpile.** Unlike stats (presence, not consumed) or slots (physical, not consumed), ammo is the first explicitly *consumable* resource in the game.
- **Ammo is generated by infrastructure.** Creatures with "on reveal: add 1 ammo to this location's stockpile," structures with "on upkeep, +1 ammo here," terrain with printed ammo-generation effects. There is no "natural" ammo regeneration — every ammo point is paid for by a card or terrain.
- **Ammo is owned by the side, per location** (a player has their stockpile here, the AI has theirs). Each side fires from its own pool.
- **Out of ammo = no ranged attack.** A ranged creature without ammo at the location simply doesn't fire that combat phase. Its other contributions (stats, triggers) continue.
- **Ammo distribution within a side** when multiple ranged creatures share a pool: fastest-DEX fires first and consumes; slower archers may end up dry that turn.

**Two flavors of ranged combatant:**

- **Printed-ranged creatures** (e.g., a rock slinger): the creature prints its own ranged attack pattern and uses its STR as damage. Buffable by Tactics — a buffed rock slinger throws harder rocks.
- **Equipment-armed creatures** (e.g., an archer with a bow): equipment prints the ranged pattern and **sets the wielder's ranged power explicitly**, overriding the creature's own STR. The bow IS the attack. (See *Equipment-sets-power* under Equipment.) Tactics buffs to the wielder's STR don't change the bow's printed damage.

**Color attribution (working):**

- **Green**: signature ranged. Archery, slinging — fits Green's *speed and precision* identity. DEX-fast archers fire first when multiple ranged creatures share an ammo pool.
- **Red**: brute ranged. Catapults, throwers, big rocks — fits Red's *now-color* impulse and high-STR creature shape. Red's printed-ranged creatures scale on STR-buffs.
- **Black**: probably not native ranged (engagement is its weapon). Black instead gets *anti-ranged* effects — destroy ammo stockpiles, force engagement, neutralize back-row threats by reaching them.
- **Blue**: stays in spell-damage lane.
- **White**: probably no native ranged.

### DEX ordering and combat sequence (high-level)

Within a phase, the order in which creatures act (revealing, attacking, triggering) and actions resolve is determined by a deterministic four-level hierarchy. **No randomness** at this layer — random selection only enters at effect-resolution targeting (Pillar 10), not at combat ordering.

1. **DEX descending.** Higher DEX always acts first. Negative DEX is a legal printing (e.g., Black curses with "creatures here have DEX -1") — it pushes a creature behind DEX-0 baseline.
2. **Within a DEX tier: per location, in battlefield order** (left-to-right across rendered locations). One location's qualifying creatures resolve fully before the next location's begin.
3. **Within a location, within a DEX tier: by position.** Front-to-back, left-to-right within each side's grid.
4. **Side priority** — when both sides have qualifying creatures within the same location and DEX tier, the side with the **higher local DEX total** (summed across permanents and terrain at that location) resolves first. If local DEX totals are tied, **priority alternates per overworld turn**: whichever side did not have priority last turn gets it this turn.

For action slots specifically, slot order tiebreaks DEX ties (slot 1 reveals before slot 2 within the same DEX tier). The shift-up behavior of the action queue (see *Action slots are a queue*) means slot 1 is always packed first.

Implications:

- **Most encounters with low DEX investment are still fully deterministic.** With both sides at all-DEX-0, side priority is decided by local DEX total (likely both 0) → alternating-by-turn → spatial order. Players can plan precisely.
- **Green doubly rewards investment.** DEX printed on a creature wins individual initiative; DEX accumulated locally swings side priority within a tier.
- **The variable-adjacency battlefield UI is mechanically anchored.** "Left-to-right" needs a chosen order of rendered locations. The order is no longer just visual — it determines combat sequence.
- **Sometimes going first is a disadvantage.** Combat sequence is asymmetric per turn, so the player can't always rely on early or late strikes — alternating priority makes the same plan play differently across turns.

## Fog of War & Reveal

Fog of war does real mechanical work here, not just flavor.

### Two kinds of face-down

Two distinct face-down states exist in the game, and they behave differently:

- **In-encounter face-down (ephemeral).** During a phase's input window, cards the player has just committed to slots are face-down and "pending" — they have not yet entered the game and contribute nothing yet. At end of the phase, all pending face-down cards enter and flip face-up simultaneously, triggering any "enters play" and "is revealed" effects. Within an encounter, **cards do not stay face-down across phases** under normal play: cards flip at the end of any phase they are face-down in.
- **Inter-encounter face-down (active).** AI cards on uncontested overworld nodes are face-down to the player, but they are *active* in the AI's bookkeeping: they contribute their stats to the AI's per-location and global totals, accumulate upkeep triggers, and gain buffs from supply lines every overworld turn. They flip face-up to the player when the player establishes presence at that node and reveals them.

In both cases, **face-down cards contribute their printed stats to per-side totals** — fog-of-war hides identity from the *opposing* side, not from the owner. The "contribute stats" rule applies whether a card is face-down to the player on a far node, or stealth-flipped face-down mid-encounter.

### Reveal triggers

Two kinds of triggers fire on entry:

- **Enters play** — fires when the card resolves into play (face-down or face-up).
- **Is revealed / enters combat** — fires when the card flips face-up.

Cards may be designed against either trigger, which gives the AI's "head start" cards meaningful design space (e.g., creatures that have been silently accumulating buffs for many turns vs. creatures that surprise the player on reveal) and which is also what makes Green's stealth/re-flip mechanic work.

A future **perception** stat is intended as the dial for partial info: cards or effects that let the player peek at face-down cards in the play queue. (See Open Questions.)

### Stealth and re-flip

Several Maneuver (Green) effects can flip a face-up card back to face-down. Per the "cards flip at end of any phase if they are face-down" rule, a stealthed card re-reveals at the end of the phase it was stealthed in — so stealth's main mechanical jobs are:

- **Re-trigger on-reveal effects.** Stealth a creature with a powerful "is revealed" ability so that it fires twice this phase: once on its initial reveal, once on its post-stealth re-reveal. This is Green's primary offensive use of the primitive.
- **Skip combat for the stealthed creature.** A face-down creature does *not* participate in combat — no attack, no block, no target (working assumption). Defensively stealth a friendly creature during the combat phase to take it out of harm's way; offensively stealth an enemy creature to blank its attack. This is the game's analog to MTG fog + phasing, with the additional upside that re-reveal can re-trigger ETB effects (which MTG phasing deliberately suppressed). The trade-off for the defensive use: a face-down friendly cannot block, leaving the rest of the line more exposed.

Stealth does **not** fizzle queued actions, because face-down cards still contribute stats. Stealth is a *combat* disruption tool, not an *economic* disruption tool.

Whether Green's end-of-phase re-flip resolution is **iterative** (any face-down card after on-reveal triggers fire keeps flipping until none remain) or **atomic** (a single re-flip pass, no further chains) is left as an Open Question — the combo space is exciting but balance-sensitive.

### DEX-spent principle

A creature that has already used its DEX initiative this turn — by acting in DEX order during combat or by revealing in DEX order at end of a phase — does *not* reclaim that initiative on a re-flip. Stealth-driven re-reveals drop to the back of the DEX order. The principle: **a creature's initiative is spent once per turn**, and stealth does not refund it.

This principle is likely to generalize beyond stealth. Any future mechanic that "re-uses" a creature within a turn (untap/ready, second-attack, recurring activations) should obey it as well. "Initiative is spent once per turn" is load-bearing for the whole speed system.

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
  - *What we're not taking:* MTG's interactive priority/stack with response chains. Our equivalent is a *play queue*: face-down commits that flip and resolve in order, with no in-phase responses. We also discard the entire hand at end of turn (Hearthstone-like), and creatures shuffle back into the deck after an encounter ends (graveyard is intra-encounter only for creatures; actions resolve to graveyard within an encounter).
- **Hearthstone:** end-of-turn hand discard, hard slot limits on the battlefield as a real strategic constraint.
- **Into the Breach:** information-rich turns, threat-telegraphing, combat that's largely deterministic once positioning is committed. Worth borrowing the discipline of "the player should be able to reason about outcomes precisely."

## Color Identities

Each stat anchors a *flavor of effect* — colloquially called a "color" — that runs through cards printing that stat. **Colors are not deck commitments** (see *Stats are vocabularies, not deck identities*); they are mechanical vocabularies that mix freely. A real deck is almost always a multi-color blend.

Each color is defined as much by what it *does not* do as by what it does. Asymmetric tradeoffs across the five colors are what makes deck blends interesting.

### Red — STR — the *now* color

- **Identity:** Red is the color of immediate, local, intense pressure. Red does not invest in the long game; every Red play is for the encounter at hand.
- **Creatures:** high STR, often with **conditional bonuses keyed off board state**. The signature pattern: "+X STR while alone at this location." A lone Red champion is a tower of stats; the moment another creature arrives, the bonus collapses. **Brute ranged archetype**: catapults, throwers, big-rock-flingers — printed-ranged back-row creatures that use STR as ranged damage and scale on Tactics buffs (a buffed thrower throws harder).
- **Actions (Tactics, placeholder name):** combat-buffs and impulse effects. Red actions resolve immediately or by end-of-turn / end-of-phase, never across turns. Red has no signature persistent-action archetype. Red actions do not deal damage themselves; they amplify creatures already on the board. Includes **Charge**-style activation actions (off-cycle melee bonus attacks) and brute Volley variants.
- **Structures:** "here"-scoped only. They occupy a structure slot and persist on the map normally, but their text contributes nothing to supply lines or other locations.
- **Equipment:** Red weapons modify creature attack patterns. Equipment is especially load-bearing for Red because the lone-champion shape hits slot-cap early.
- **Attack patterns:** Red gets multi-target / AOE patterns and same-side-hitting (cleave) patterns — these are both the anti-wide answer *and* the friendly-fire mechanism.
- **Win path:** combat damage to summoner HP, dealt by STR creatures, spiked by conditional-bonus printing and amplified by Red Tactics.

**Structural weakness — answered.** Red has no persistent actions, no wide presence, and no supply-line scaling. Friendly-fire damages splashed allies, so Red can't easily fix these weaknesses by splashing — protective creatures from other colors get killed by the splasher's own attack patterns. **Red is locked into purer tempo strategies by mechanics, not by rules.** The trade-off is that Red gets *conditional stat printing as a tempo lever* and intense local impulse effects.

#### Conditional stat printing (new mechanic class)

Red opens a design space where a card's stat printings depend on board state. "+5 STR while alone at this location" is the canonical example: while the condition holds, the conditional stat counts as real Red presence — paying costs, contributing to combat, satisfying comparative inequalities. The moment the condition breaks, the conditional stats vanish and the location's Red presence collapses.

This is a *temporary local resource spike* — distinct from Blue/White's *residual global persistent* effects (hand size, draw count). Red's bonuses are local, intense, and effectively spent the moment the condition collapses.

The cleave self-cleaning behavior is the recovery mechanism: a lone Red champion with a cleave attack pattern periodically clears your own board, restoring the alone-condition.

#### Red's anti-synergies and conditional Black-synergy

Red's friendly-fire creates **anti-synergy with most other colors**:

- **Blue:** cleave kills your INT mages, fizzling queued Blue actions at resolve.
- **White:** cleave damages your Faith creatures, interrupting their Prayer-channel contribution this turn.
- **Black thorns:** Red attacks into Black creatures eat thorns retaliation, punishing Red attackers.

And **conditional synergy with the death-feeder subset of Black**: cleave-killed friendlies feed Black's graveyard recursion, sacrifice payoffs, and "creatures dying" triggers. So Red+Black is a card-level negotiation, not a flat affinity — some Black cards work brilliantly with Red, others actively punish it. This kind of mixed within-pair interaction is richer than a simple "color X loves color Y" affinity model.

### Green — DEX — the color of speed, position, and disruption

- **Identity:** the tempo and rearrangement color. Green is fundamentally the color of "one window per turn" — its effects manipulate *when* and *where* things happen, not *how much*.
- **Creatures:** high DEX, often fragile (low durability or low VIT). Glass cannons that act before they can be killed. **Signature ranged archetype**: precision archers and slingers that print ranged attack patterns and live in the back row. DEX advantage at ranged combat compounds: when multiple ranged creatures share a location's ammo pool, the fastest fires first.
- **Actions (Maneuvers, placeholder name):** positional disruption (move a creature between slots or locations), reveal-order manipulation, stealth (re-flip an already-revealed card to face-down — see *Stealth and re-flip*), combat-modal buffs that aren't pure damage (e.g., "double-strike: this creature attacks a second time at -1 DEX this turn"), and **Volley**-style activation actions (off-cycle ranged firing — see *Activation actions*).
- **Doesn't do:** durable defense, heavy combat sustain, pure damage piling.
- **Win path:** combat damage via fast strikes that kill before being killed; positioning that opens lethal lanes; ranged poke from defended back-row archers.

#### Green effects don't double up on the same card

A signature Green design constraint: **Green's effects do not double up on the same card across multiple flips in a single turn.**

- **Boolean keyword grants don't double up.** A Green on-reveal that grants *double strike*, fired twice via stealth + re-flip, leaves the creature with double strike — the second grant does nothing new.
- **Numeric grants stack** — but Green's numerics are tuned modest. A Green "+1 STR on reveal" fired twice grants +2 STR. The compounding is real, but capped by what Green is willing to print.

The combo ceiling for flip-spam without cross-color support is therefore bounded. The **biggest combo upside comes from cross-color combinations** — pairing a Green flip primitive with a non-Green stackable payload (Red's "+2 STR on reveal" stacking with itself, Blue's "deal X damage on reveal" stacking, etc.). The trade-off is real: cross-color combos cost an additional color's stat presence to enable.

This rule unifies with the **DEX-spent principle**: Green is the color of one window per turn. Its effects don't refund initiative, don't compound on a single card, don't pile. Green manipulates timing and positioning; it is not a value-piling color on its own. Together, "DEX-spent" and "no doubling on a card" are one idea expressed at two scales.

### Blue — INT — the color of cancellation, perception, and indirect damage

- **Identity:** the color of *making things not happen*. Insight is not just knowledge; it is the power to remove things from the equation.
- **Creatures:** intentionally weak on the board — low STR, modest durability — but print INT to fuel the action economy and global draw count.
- **Actions (Spells):** **deal direct damage** (often scaling with INT presence), **counter or cancel actions** (see *Counterspell*), reveal face-down cards, manipulate the play queue / reveal order.
- **Doesn't do:** strong combat creatures; persistent on-board threat; durable structures.
- **Win path:** spell damage to summoner HP; out-of-combat reduction of opposing threats.

#### Blue's cost-shape: front-loaded and brittle

Blue's signature cost shape is **front-loaded**. Spells require heavy INT presence at cast time — typically a Blue mage with high INT must already be at the location. The mage *is* Blue's spell economy at that location: kill the mage, lose access to all Blue spells there.

Combined with the **double cost-check** rule (cast and resolve), this produces a brittle profile. A Blue spell queued in main phase but timed to resolve later is exposed through combat. If the mage dies between cast and resolve, the queued spell **fizzles**. A single combat hit on the mage can shut down a whole strategy.

A Blue-leaning deck must run enough other-color creatures to defend its soft mages, or race the opponent before its mages get cleared.

#### Blue's two control archetypes: Counterspell and Stifle

Blue's denial suite splits into two distinct tools, each with a different attack angle:

- **Counterspell** *removes actions from slots.* It's race-dependent against one-shot actions: if Counterspell reveals first this phase, queued one-shots haven't resolved yet and get nuked; if it reveals late, faster actions have already resolved and exited. But it **always works against persistent actions** (Prayer, Curse) regardless of when it fires this turn, because they're still in the slot when Counterspell hits. Counterspell is the *high-risk single hit* — the high-INT cost and timing dependency are the price of guaranteed slot-clearing of persistent threats.
- **Stifle** *prevents reveals and clogs slots.* Stifle does not destroy queued actions. Its effect is "no actions reveal this turn" — face-down cards stay face-down, slots stay clogged, and no further actions can be played into those slots while the effect persists. Actions that would have fired this turn miss their timing window; they will eventually flip in a later phase, but specific timing triggers ("during this turn's main phase") will have passed and those actions fizzle per the resolve-time cost-check. Symmetric — affects both sides — so the caster takes the same delay penalty.

Counterspell answers persistent strategies; Stifle answers timing-locked plays (which is ironically much of Blue's own pattern — the firestorm-on-upkeep example). Stifle in a mirror match hurts the caster too, so timing is everything: deploy Stifle on a turn you have nothing critical queued.

Together, the two tools cover the full spell-denial space: remove (Counterspell), or delay-and-clog (Stifle).

### White — FAITH — the color of belief and channeled intervention

- **Identity:** belief in things outside one's control; reliance on intervention from beyond. The slow inevitability color.
- **Creatures:** intentionally weak on the board, like Blue. Print FAITH to enable persistent channeled actions (*Prayer*, below) and to enable card retention across cleanup (see *Faith is retention, not volume*, below).
- **Actions (Prayers):** primarily **Prayers** — persistent, channeled, powerful conditional effects whose cost is paid over multiple turns by Faith creatures present at the location.
- **Distinction from Blue:** Blue uses perception of reality to influence reality directly. White asks for outside intervention and waits for it to resolve. Blue acts; White prays.
- **Doesn't do:** fast tempo, on-board combat presence, immediate threat.
- **Win path:** outlasting the AI's deck-thin in attrition; the occasional dramatic Prayer payoff.

#### White's cost-shape: deferred and channel-paid

White's signature cost shape is the **opposite of Blue's**. Prayers have **no stat-presence requirement to cast** — you can drop a Prayer into a slot at any location, anytime, with zero board presence. The "cost" is the channel: the printed `pray N` value is paid out gradually by Faith creatures arriving at (or already present at) the location.

Combined with the **double cost-check** rule, this produces a **resilient** profile that contrasts sharply with Blue:

- **Damage to a Faith creature** pauses that creature's contribution to channeling *this turn* — but the Prayer is not lost, the deck is not lost, the strategy stalls. Chip damage delays White; it does not break it.
- Where Blue is *tempo-fragile* (one mage death = total disruption), White is *tempo-resilient* (damage delays, doesn't break).
- Prayers can also be **speculatively pre-positioned**: drop a Prayer at a location with no Faith present, then later move Faith into range to begin channeling. Blue cannot do that — Blue is *cast or don't*.

#### Faith is retention, not volume

FAITH grows the global kept hand size after cleanup-phase discard. The deeper truth: FAITH's real value is **keeping the right card for the right phase**, not winning by sheer card mass. End-of-turn discard creates a structural problem for any timing-locked action — by the time you'd want to cast it, you've discarded the card. FAITH-driven retention is what lets timing-locked plays survive cleanup.

This is also the structural reason for **Blue+White affinity**: end-of-turn discard structurally punishes Blue's natural play pattern (timing-locked spells get discarded). FAITH retention solves this. The two colors are not just "spell-leaning together" — they are *mechanically complementary across the cleanup phase*.

#### White's second mechanical idea: healing and protective intervention

Beyond Prayer, White's signature themes are **healing, restoration, and divine intervention** — patching the seams that channeling exposes.

- **Healing** restores creature durability. Faith creatures damaged in combat (which would normally pause their channel contribution this turn) can be healed back to full, restoring the channel. Healing also serves White's win path: outlast the opponent's deck thinning.
- **Divine shield** is a cheap pray-1 protective effect. The card resolves quickly (only one Faith point of channel needed) and grants a **single-instance damage absorber** that pops the next time damage is applied. The pattern: drop a divine shield first to protect your Faith creature, then commit a bigger Prayer behind it. The divine shield deflects the channel-cancellation hit; the bigger Prayer keeps progressing.
- **White is the color that patches its own seams.** Where Blue is structurally brittle (mage death = strategy collapse), White prints the exact tools to repair the damage that would interrupt it. Two structural identities, two different relationships to vulnerability.

Healing and divine shield share a design property: their effects are most powerful when their target is unambiguous. Per the no-targeting pillar, a divine shield resolves on a random qualifying creature unless the player has set up the board so only one creature qualifies. White's tempo therefore rewards thin-board moments — protect what you're channeling on, not the whole party.

### Black — VIT — the color of costly engagement

- **Identity:** every interaction with Black is transactional. Black creatures *want to be hit*; engagement is their weapon.
- **Creatures:** high VIT (damage reduction), decent durability, often modest STR. Tank-shaped. Often bring **thorns** (retaliate when struck, gated on VIT) or **taunt** (redirect attacks). Hard to remove cleanly.
- **Actions (Curses):** **Curses** (see below) — persistent debuffs that migrate to the enemy's action slot on reveal. Drain effects (cost summoner HP for benefit). Reanimate (return creatures from graveyard with stat clamping; see *Zombification*). Sacrifice-for-effect.
- **Structures:** Black is structure-friendly. Anti-creature defenses, graveyard-scaling structures, supply-line-extending fortifications. Also the natural home for **anti-ranged** effects — destroy ammo stockpiles, force engagement, neutralize back-row threats. Black's "engagement is its weapon" theme pulls naturally toward "stop ranged from staying at range."
- **Doesn't do:** fast tempo, heavy raw spell damage, native ranged combat. Black is **deliberately slow**, and slowness is *good* for Curses (see below).
- **Win path:** indirect — outlast and grind, accumulate graveyard value, drain via Curses and retaliation. Pair with Red for direct damage paths.
- **Open question:** how do other colors *cleanly kill* Black creatures? If hitting Black is always punished, optimal play would be to ignore it. There must be answers (likely: Blue spell damage bypasses combat-triggered thorns; Green movement displaces; exile-class effects bypass graveyard recursion). To be pinned down so the meta is balanced. (See Open Questions.)
- **Open question (new):** **tall-vs-wide tension.** Recent design conversations frame Black as "wide" in contrast to Red's lone-champion "tall." But the existing Black profile (high VIT, tanky individuals, hard to remove) reads as tall-tank. The likely resolution: Black is *wide via persistence* — same creatures cycling through the graveyard over many turns — rather than many cheap chump creatures at once. To be sharpened. (See Open Questions.)

#### Black's mixed synergy with Red

Red's friendly-fire / cleave attack patterns kill Red's own creatures — and Black's **death-feeder** cards (graveyard recursion, sacrifice payoffs, "creatures dying" triggers) work brilliantly with that. Black's **thorns** retaliation, by contrast, hurts Red attackers. So Red+Black produces *card-level* synergy *and* anti-synergy at the same time, depending on which Black cards are present. (See Red's *Anti-synergies and conditional Black-synergy*.)

### Cross-color affinity (emergent, not hard-coded)

Color affinities emerge from mechanical compatibility, not from explicit deck-construction rules:

- **Black + Red** is naturally strong. Zombification clamps non-STR/non-VIT stats to 0, so Red creatures recovered from the graveyard retain most of their value while Blue/White/Green creatures come back as shadows. Black wants to live on the board fighting; Red wants to fight; they're aligned.
- **Blue + White** is naturally strong. Both are weak on the board and rely on actions; their creatures complement each other as utility-printers. Blue counter-magic and White Prayer share action-slot economy.
- **Red + Green** is the natural aggressor pair — fast and hard, positional and lethal.
- These are not enforced; players whose runs draw mixed cards will find emergent synergies in any blend.

## Persistent Actions

A *persistent action* is an action subtype that occupies its action slot **across multiple turns**, rather than resolving and exiting at end of phase like a normal action. Three persistent-action archetypes have been designed:

### Prayer (White / FAITH)

- **Played** like any action, into an action slot at a location.
- **Does not** leave the action slot on resolution. It **stays** until either fully resolved (channel complete) or removed.
- **Has a printed `pray N` cost** — the channel-progress counter, initially N.
- **Each turn, every FAITH-printing creature on the same side at the same location automatically contributes 1 to the prayer's progress** per FAITH point. (e.g., 4 FAITH at the location reduces remaining cost by 4 that turn.) Contribution is automatic; channeling is not a choice.
- **Has a printed timing trigger** — "on upkeep," "after cleanup," "at end of main." This is *when* the prayer can resolve.
- **Resolves** when remaining cost reaches 0 *and* the timing trigger fires that turn. On resolve, the prayer's effect happens and the prayer goes to graveyard.
- **A creature that took damage this turn does not contribute its FAITH to channeling this turn.** (Damage interrupts channeling — only for the damaged creature, not all Faith creatures at the location.)
- **Action-slot occupancy:** the prayer occupies the slot the entire time it is channeling. Other actions cannot be played into that slot.
- **Multiple prayers at the same location:** if a location has multiple action slots and multiple prayers are channeling, *each* prayer receives the full local Faith contribution per turn (Faith is presence, not a consumable).
- **Cost-shape note:** Prayers have **no stat-presence requirement to cast** (see *White's cost-shape* under Color Identities). The channel cost is the cost. This is why a Prayer can be speculatively pre-positioned at a location with no Faith yet present.
- **Effects:** powerful, normally above the curve for one-shot actions — conditional removal, "summon a random card from your deck into play here," large board effects. The multi-turn channel is the cost-justification.
- **Vulnerable to:** combat damage to the channeling creatures (interrupts that turn), Counterspell (kills the prayer outright).

### Curse (Black / VIT)

- **Played** by you into your own action slot at a location.
- **On reveal:** the curse **migrates** from your action slot to the *opposing* side's action slot at the same location. From then on it occupies their slot and applies its persistent debuff each turn.
- **Migration can fail:** if the opposing side's action slots at that location are all full at the moment of migration, the curse cannot move and **stays in your own slot** — you are stuck with your own debuff.
- **Speed inversion:** because actions reveal in DEX order and slots clear as actions resolve, **slow curses (low DEX) reveal *after* enemy action-slot cards have resolved and exited**, finding empty slots more reliably. **Fast curses are *worse*** because they reveal early when enemy slots are still full. This is the rare mechanic in the game where low DEX is *strictly desirable*.
- **Removed by:** Counterspell (Blue), specific anti-curse effects, encounter end (open question — see Open Questions).

#### Curse effect design discipline

Curse effects split cleanly into two design lanes that both sidestep the random-targeting issue:

- **Static board auras.** Effects that apply to *all* qualifying creatures at the location simultaneously — "friendly creatures here have -1 STR," "creatures here have DEX -1." Static effects have no triggered "pick a target" moment; they just modify the whole qualifying set. They also stack cleanly: two -1 STR auras sum to -2 STR.
- **Player-direct effects.** Effects that target the opposing summoner directly — hand disruption ("during upkeep, the opposing summoner discards a card"), draw modifiers, summoner-HP drains. The summoner is always a unique legal target, so no random selection is needed. This is a fresh design space distinct from board interaction: Black attacks the *player*, not the *board*, across many turns of attrition.

By contrast, **triggered single-target effects on the board** ("during upkeep, deal 1 damage to a creature here") would require a fresh random roll each tick, which feels unsatisfying for a multi-turn debuff. The design discipline is to avoid this class of curse effect.

### Counterspell (Blue / INT)

- A signature Blue action of the *Spell* subtype. Working name; final naming Pass 2.
- **On resolve:** all actions currently in action slots at this location are sent to the graveyard. (Counterspell exempts itself.)
- This includes persistent actions (Prayers, Curses) regardless of how long they've been channeling — a Prayer 1-cost away from resolving still dies. A Curse that migrated 3 turns ago still dies.
- **Timing:** Counterspell is itself an action that resolves in DEX order. If counterspell reveals first this phase, it nukes everything pending at the location. If it reveals late, one-shot actions with higher DEX have already resolved and left the slot — they're safe. But persistent actions in slots are killed regardless of when counterspell fires this turn, because they're *currently in the slot*.
- **Hard counter to persistent-action strategies.** Black's Curses and White's Prayers must play around Blue presence; if Blue has counterspell available, persistent actions are vulnerable.
- **Curse vs. counterspell timing:** if both are played the same turn at the same location, DEX order resolves it. If counterspell reveals first, the curse dies before migration. If the curse reveals first and migrates, counterspell (now in Blue's own slot) still resolves and clears the migrated curse.
- **Cost:** likely high INT (specifics Pass 2). Itself prints minimal stats. As a Blue spell, subject to Blue's front-loaded cost-shape — needs an INT mage at the location to cast.

### Action-slot economy as a meta-system

Persistent actions turn the action slot into a *contested resource over time*. Three colors have distinctive plays in this economy:

- White wants to *occupy its own slots* with Prayers (committed multi-turn channels).
- Black wants to *occupy enemy slots* with Curses (transferred multi-turn debuffs).
- Blue wants to *clear all slots* with Counterspell (denial of both above).

This three-way tension shapes deck design and play decisions whenever action slots are involved.

Persistent actions also worsen the slot-cap pressure described in *Slots are the actual scarce resource*: White's and Black's preferred plays clog action slots for many turns, leaving fewer slots for one-shot follow-ups. **Equipment** is a complementary release valve here — it provides slotless plays even when the action slot is committed.

## Relocate-on-Reveal Mechanic Class

Several effects in the game cause cards to *change location or side at the moment of reveal*. This is a coherent mechanic class worth naming explicitly so future card design has a vocabulary for it.

The general rule: **on reveal, this card may relocate** before its other effects resolve. Variations:

- **Where it can go:** same location's other slot / adjacent location / enemy side / specific slot type.
- **Failure cases:** target slot full, no legal destination, etc. — and what happens then (stays put / fizzles / different fallback).
- **Side controlling the destination:** your side / enemy side / neutral.

Two confirmed instances:

- **Green: shift / move.** Reposition your own card to a different slot or location. Used for tactical repositioning before combat resolves.
- **Black: curse migration.** Transfer your action to the enemy's action slot.

Future effects in this class might include creature transposition, action handoff, or "play this at an adjacent location instead." Pass 2 will name and tighten the keyword vocabulary; for now, "shift" (Green) and "migrate" (Black, curse-specific) are the working terms.

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

- **Turn Structure (detailed):** phase order, what each phase resolves, the play-queue mechanics, when in a phase an action is "committed" vs. "resolves."
- **Cards:** anatomy of a card, card effect grammar, exact stat-printing conventions, rarity tiers. (Type taxonomy is high-level-resolved: creature / structure / action / equipment.)
- **Board / Zones:** slot grids per location, the 2x2 creature grid (front-row melee / back-row ranged), structure slots, action slots, location-effect slot.
- **Resources & Economy (detailed):** card-level cost grammar, ammunition (and any other secondary resources), supply-line resource flow rules in detail, exact tuning of stat values and terrain values. (High-level model now in main doc.)
- **Combat:** front-row vs. back-row resolution, melee vs. ranged, ammo consumption, support-creature targeting (front/behind/adjacent/this-location/other-location/etc.), order of operations.
- **AI Opponent (detailed):** spread-rate tuning, draw-per-overworld-turn budget, exact deck stratification by node-distance, reinforcement-priority scoring details, boss-specific mechanics. (High-level architecture now in main doc.)
- **Stats (detailed):** what each stat does in and out of combat, how stats gate effects.

---

## Open Questions

Things we've raised but not pinned down. Items are tagged *(high)* / *(medium)* / *(low)* by priority for upcoming card design and prototyping.

### Color identities — gaps to pin down

- *(high)* **How other colors *cleanly kill* Black creatures.** If hitting Black is always punished (thorns, taunt, graveyard recursion), the optimal play is to ignore it. There must be answers — likely: Blue spell damage bypasses combat-triggered thorns, Green movement displaces, exile-class effects bypass graveyard recursion. To be pinned down explicitly.
- *(high)* **Black: tall-tank vs wide-flood.** The current Black profile (high VIT, tanky individuals, hard to remove) reads as tall, but recent design conversations frame Black as the "wide" complement to Red's lone champion. The likely resolution: Black is *wide via persistence* — same creatures cycling through life-and-death over many turns rather than many cheap chump creatures at once. Sharpen which it is, or whether both archetypes coexist.
- *(medium)* **Perception's relationship to Insight.** Currently held as a likely sixth stat for fog-of-war manipulation, but possibly absorbed into Insight. Decide as Blue's design space firms up.
- *(medium)* **Red action timing.** Red's "now / impulse" identity says actions resolve immediately or by end-of-turn / end-of-phase. Is this a *hard rule* (Red actions cannot print delayed timing triggers) or a *strong default* (delayed-timing Red exists but is rare)? Affects card-design vocabulary.
- *(medium)* **Conditional stat printing on global stats.** Red's signature "+5 STR while alone" is local. If a card prints "+1 INT while alone," does the conditional INT contribute to global draw? The mechanics say yes (INT is global), but the flavor of "lonely scholar" reads oddly. Mostly a card-design discipline question.
- *(medium)* **Anti-synergy intensity for Red splash.** Is splashing Red into Blue/White *actively painful* (cleave reliably kills the splashed mages and Faith creatures) or *just costly* (slightly worse than other splashes)? Tuning question for cleave damage values, but worth picking the principle now.
- *(medium)* **Healing scope and limits.** Healing is now confirmed as White's restoration tool. Heals creature durability — but how much per cast? Can heals exceed printed durability (overheal as a temporary buffer)? Does healing also touch summoner HP, or strictly creatures?
- *(medium)* **Divine shield specifics.** Pray-1 protective bubble pops on first damage. Does it absorb the *full* damage instance regardless of size, or a fixed amount with overflow passing through? Does the shield persist across phases / turns until popped, or only until end of the turn it resolved on?

### Mechanics

- *(high)* **Healing.** Confirmed as Faith-themed. Heals creatures or summoner or both? How much? Can it exceed max durability? Big lever for White's defensive identity.
- *(high)* **What a card's "color" formally *is*.** A card with STR 2 and INT 1 is what color? Red? Red-Blue? "Mostly Red"? Either: (a) color is derived from printed stats (most cards are multi-colored), or (b) cards have a separate primary-color flag independent of stats. Affects AI play hints and card-design vocabulary.
- *(medium)* **Force-less creatures and combat math.** Force-less creatures occupy slots and are attackable. Are they entirely passive in combat, or do they "block" in some way? Does damage assignment force STR creatures to attack non-combatants by position rules? What does a 0-STR creature do during combat? — assumed: just sits there, takes damage when targeted.
- *(medium)* **Damage rule edge cases.** Is damage tracked as marked counters or as current-HP subtraction? Can damage exceed HP? Does VIT apply to *all* damage or only combat damage? (Blue's spell damage — should it bypass VIT?) Does damage carry across rounds within an encounter? — assumed: yes, until creature shuffles back to deck at encounter end.
- *(medium)* **Removal doctrine.** Which colors get cheap removal, conditional removal, no removal? Removal is the biggest balance lever in any card game; this needs a stated philosophy before too many cards are designed. Equipment-removal and ammo-stockpile-removal are related questions — same colors as structure-removal, or different?
- *(medium)* **Cost-grammar expressivity.** Confirmed: ≥, ≤, =, compound conjunctions (AND), comparative-vs-opponent. Also legal: scaled costs ("1 INT per card in your hand"), totals across multiple stats ("≥4 of any combat stat")? Pass 2.
- *(medium)* **Per-encounter post-victory state.** Do destroyed enemy *structures* on a contested node go to AI graveyard, or are they removed from the map? What about *neutral* structures the player builds? Persistence rules need explicit enumeration.
- *(medium)* **AI's first-card problem & opening tempo.** AI plays under same stat-cost rules. Its first play on a fresh node depends on terrain baselines and free-cost cards. Tuning is a central balance knob.
- *(low)* **What "transform" vs. "evolve" mean precisely.** Working definitions: transform = turn this card into a different specific card; evolve = card transforms into a different specific card on meeting a printed criterion. Upgrade = numeric improvement of the same card.
- *(low)* **Boss-specific design.** Boss is a summoner with HP defeated by normal combat damage. Are there boss-only mechanics, phases, or special cards?
- *(low)* **Multiple encounters per overworld turn.** Assumed: one encounter per player overworld turn; advancing is the act that starts the encounter and ends the turn. Confirm.
- *(low)* **Reveal granularity in detail.** When a player permanent enters at a location, all face-down *resolved* cards there flip. Do face-down cards still in this turn's *play queue* also reveal, or only resolved permanents?

### Equipment — open mechanics

- *(high)* **Per-permanent equipment cap.** Can a single host wear arbitrary equipment, or is there a fixed limit (one weapon, one armor, etc.)? The release-valve framing argues for "many" — more outlet is better.
- *(medium)* **Color-neutral equipment.** Is some equipment uncolored, providing bridging cards for cross-color decks, or does every piece have a color identity?
- *(medium)* **Equipment stat printings.** Does equipment with printed stats contribute to per-side per-location stat totals while attached? A "Holy Sword" printing +1 FAITH — does it grow the global hand size?
- *(medium)* **Equipment + zombification.** When a Black raise effect brings a creature back from the graveyard, does the original creature's equipment come back with it? Working assumption: no — equipment died with host and is not part of the deck.
- *(medium)* **Multi-equip conflicts.** If two pieces of equipment grant different attack patterns to the same creature, do they stack, override, or require the player to choose between?
- *(medium)* **Equipment AI heuristic targeting.** Equipment requires choosing a host. The AI heuristic must select a target. For most equipment the obvious heuristic is "attach to the strongest / most relevant host," but some equipment may have nuanced ideal hosts. To be tracked under AI-evaluability discipline.

### Combat & attack patterns — open mechanics

- *(high)* **Grid orientation.** A 2x2 creature grid faces an opposing 2x2 across the encounter? Front rows opposite each other, back rows behind?
- *(high)* **"In front" definition.** What does "the space in front of" mean in a 2x2 grid? Same column / opposite row? Wider? Affects every default attack pattern.
- *(high)* **Cleave targeting.** Friendlies-only (intolerant tyrant theme), friendlies-and-enemies (true splash, doubles as anti-wide answer), or asymmetric? The both-version provides Red's anti-wide answer; the friendlies-only version reinforces Red's pure-tempo identity.
- *(high)* **Front-row blocking semantics.** When the opposing front row is "empty," front-row attackers can reach back row. Does "empty" mean *the entire opposing front row* must be empty (full-row), or *the specific column* (column-only)? My read: column-only — a body in FL protects only the BL behind it, not BR. Confirm.
- *(medium)* **Face-down cards in combat.** Working assumption: face-down creatures cannot attack, cannot block, and cannot be targeted by attacks. The "stealth as smoke screen" defensive use depends on this. Confirm before card pool development hardens.
- *(medium)* **Mixed melee + ranged on one creature.** Can a creature have both a melee pattern AND a ranged pattern, used contextually based on position? An archer in the front row presumably defaults to melee (or can't attack at all if their printed pattern is ranged-only); confirm the rule.
- *(medium)* **Front-row ranged attackers.** Generally ranged is a back-row activity. Is a ranged-pattern creature in the front row simply nonfunctional for ranged purposes (must be repositioned), or is there a different rule?

### Ranged combat & ammo — open mechanics

- *(high)* **Ammo refresh cadence.** Working assumption: typical ammo-generation prints "+1 per upkeep" or similar low-rate, meaning a single ranged creature fires roughly once per turn if alone. Confirm typical generation rate range; tuning lever for ranged tempo.
- *(high)* **Ammo persistence across encounters.** Does a location's ammo stockpile persist on the map between encounters (rewarding pre-built supply lines) or reset at encounter end (each encounter starts at zero)? Affects how investable ammo-generation structures are.
- *(medium)* **Ranged target conditions.** Per Pillar 10, ranged attacks pick at random from legal candidates. Default "an enemy creature here," or back-row-specific patterns ("an enemy back-row creature here"), or column/positional patterns? Worth scoping the working set of printable ranged target conditions.
- *(medium)* **Ammo distribution among multiple ranged creatures.** Working assumption: fastest-DEX fires first, consuming 1 ammo; subsequent ranged creatures fire in DEX order until ammo runs out; slower archers may end up dry that turn. Confirm.
- *(medium)* **Ammo cost as global rule vs printed.** Working assumption: every ranged attack consumes 1 ammo (global rule). Some cards may print higher costs ("ranged: consumes 2 ammo") for premium effects. Confirm the global default.
- *(medium)* **Ammo-stockpile destruction.** A new resource implies new removal. Black is the natural home (anti-ranged theme). What's the printed effect grammar? "Destroy 2 ammo at this location"?

### Activation actions — open mechanics

- *(high)* **Naming the design class.** *Activation actions*, *triggered actions*, *permanent-dependent actions* — pick a canonical label so card-design discipline has a shared vocabulary.
- *(medium)* **Off-cycle attack timing.** When Volley resolves in main phase, do the triggered ranged attacks happen *at Volley's resolve* (mini-combat, on-damage triggers fire normally) or queue for next combat? Working assumption: at Volley's resolve, same end-of-phase resolution.
- *(medium)* **Multiple activations per turn.** Could a player play Volley in main and Volley again in cleanup (or in different phases) for two off-cycle ranged firings? Working assumption: yes, if action slot is free and ammo permits. Real burst potential.

### DEX ordering & combat sequence — open mechanics

- *(medium)* **Side-priority synthesis.** Working rule: local DEX total at the location wins side priority within a DEX tier; if tied, alternates per overworld turn. Confirm this is the intended synthesis or if a different mix.
- *(medium)* **Initial alternating state.** When an encounter opens, which side has alternating-priority — player or AI?
- *(medium)* **Battlefield location ordering.** "Left-to-right across rendered locations" is the working idea, but how is the initial left-to-right order determined when the battlefield is built from N arbitrary adjacent overworld nodes? Probably a UI-rendering choice locked at battlefield construction.
- *(medium)* **Alternating granularity confirmation.** Working assumption: priority alternates per overworld turn (locked for the full phase sequence within a turn). Per encounter or per phase are alternatives.

### Targeting & resolution rule grammar — open mechanics

- *(high)* **Target-condition vocabulary.** Card text needs a small canonical set of legal-candidate forms. Working set: "a creature," "a friendly creature here," "the front-most friendly creature here," "all enemies here," "the most damaged creature here," "the opposing summoner." Pin the formal grammar so card design has a shared language.
- *(medium)* **Tie-handling within "the most/least X" filters.** "The most-damaged creature here" usually picks one; if two are tied at the same damage, the random rule presumably picks among them. Confirm.
- *(medium)* **Exile zone specifics.** Confirmed: actions can print "exiled when this resolves" to opt out of the discard cycle. Other uses for exile? "Removed from game until encounter end" effects? "Cannot be raised" exile for graveyard hate against Black? Pin down the exile zone's full role.

### Stealth and re-flip — open mechanics

- *(medium)* **Iterative vs atomic re-reveal.** When stealth at end-of-phase causes a creature to flip back face-up, does that re-reveal trigger fresh on-reveal effects that could in turn cause more stealth (iterative chain), or is the re-reveal a single atomic event (no further iteration)? The combo space is exciting but balance-sensitive — leaving open for now.
- *(medium)* **Multi-phase stealth.** Could a card print "deep stealth" overriding the end-of-phase auto-flip, leaving a creature face-down across phases? Currently the rule says no. Worth deciding whether this is a hard rule or a design space we want to leave open with a rare keyword.

### Persistent actions — open mechanics

- *(high)* **Curse persistence across encounters.** A Curse on a location at encounter end — does it persist to next encounter? Probably yes (persistent actions live in the slot). But action slots between encounters need explicit rules.
- *(high)* **Curse removal options.** Confirmed: Counterspell removes them. Specific anti-curse cards? Duration-based (lasts N turns)? Something else? Affects how punishing curses can safely be.
- *(medium)* **Prayer persistence across encounters.** A mid-channel Prayer when the player wins and leaves — persists or disposed? Probably disposed (channel is creature-driven and the player departs); confirm.
- *(medium)* **Action slot resets between encounters.** What happens to action slots at locations the player leaves? At locations the AI controls but player has departed?
- *(medium)* **Curse failure-on-full retention.** Confirmed: curse stays in caster's slot if enemy slots are full. Does it then *behave as a debuff against the caster*, or does it sit inert? Probably the former — the failed migration is the *worst case* of playing a curse.
- *(medium)* **Counterspell scope.** Default-local under Pillar 8 means counterspell hits this location's action slots only. Variant for a higher-cost `everywhere`-scoped counterspell? Pass 2.

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
- *(medium)* **Card play hint vocabulary.** Working set: prefer-contested, prefer-near-boss, prefer-near-player, prefer-fresh-spread, anti-synergy avoidance, stat-saturation-aware, plus persistent-action-aware (e.g., curse-prefers-late-reveal). Full schema to be defined alongside first batch of card designs.
- *(medium)* **Global "AI strategy" stance knob.** Aggressive / balanced / fortify, set per run difficulty.

### Run / overworld

- *(medium)* **Map generation.** Procedural? Hand-authored? Seeded? Width and depth?
- *(medium)* **Highly-connected nodes as a tradeoff.** Confirmed in spirit. Tuning of slot counts per location, and whether some nodes have more slots than others, is Pass 2.
- *(medium)* **Neutral encounter design space.** Stat-based gated rewards are the clearest archetype. What other shapes do neutral encounters take?
- *(medium)* **Run length.** How many overworld turns from start to boss in a typical run?

### Cards & stats

- *(high)* **Stat naming.** Current names (STR/DEX/VIT/INT/FAITH) are D&D placeholders. Final naming is downstream of theme work. Leading direction: abstract-evocative (Force / Edge / Bulwark / Insight / Resolve, or similar).
- *(high)* **Action subtype names per color.** Spell (Blue), Prayer (White), Curse (Black) are settled. **Maneuver** (Green) and **Tactic** (Red) are working placeholders. Final naming pending.
- *(medium)* **Default action-slot count per location.** Working assumption: 1 action slot is default, with rare 2-slot variants. Confirm.
- *(medium)* **Effect scope vocabulary.** Working keywords: `here` (default, often implicit), `this location`, `adjacent locations`, `supply line`, `all your locations`, `everywhere`. Plus possible directional/relational terms. Full list to be locked in Pass 2.
- *(medium)* **Terrain destruction effect class.** Confirmed: rare premium effects can destroy a location's stat line and/or rules text (but never its slot profile). Open: how rare, what colors own it, whether destruction is reversible, whether partial destruction (stats-only or text-only) is a separate effect.

### UX / prototype

- *(high)* **Variable-adjacency battlefield UI.** A node may have 1–N adjacent nodes. The battlefield must render N location columns side-by-side, each with a slot grid. *This is the single biggest unknown to de-risk in the prototype.*
- *(medium)* **Drag-and-drop affordances.** How does the player target a specific slot at a specific location? Does the play queue have a visible representation?
- *(medium)* **Fog of war presentation.** Card backs on uncontested nodes — how visible from the overworld vs. only at battlefield render time?

### Framework / engineering

- *(medium)* **JS framework choice.** Deferred until vertical-slice prototype reveals real state-management requirements.
- *(low)* **Static-host target.** GitHub Pages? Custom domain? Pass 2.
