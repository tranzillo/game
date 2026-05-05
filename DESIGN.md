# Design

This is a living document. It will be messy and contradictory at times — that's fine. The goal is to capture ideas as they come up so we can spot patterns, tensions, and gaps. We refine over many sessions.

When something is uncertain, write it down anyway and flag it under "Open Questions."

> **Pass status:** Pass 1 (high-level model) complete as of 2026-04-26, amended substantially through 2026-05-05. The 2026-05-05 amendments lock: (a) the **Stealswap** mechanic with full rules (cost-shape = swap card itself, universal whiff rule, high-threat-printing as cost-balancer, Pillar-10 setup as win condition, deck-thinning-via-whiff as a real strategy); (b) **Blue's three action-acquisition vectors** — Spellbook (equipment), Forbidden Library (structure), Archeological Expedition (persistent action) — expressing Blue's *copy* verb across three card-type vectors with distinct conditions/scope/destinations. The vector pattern is now established as a generalizable design framework: each color's verb fans across multiple printable vectors. Earlier 2026-04-29 amendments still apply. The 2026-04-29 amendments cover: stats-as-resources, scope-of-effects, AI architecture, durability/violence distinction, color identities, persistent actions (Prayer, Curse, Counterspell), comparative costs, zombification, the *Spell* card type renamed *Action* with per-color flavor subtypes, double cost-check (cast and resolve), ephemeral face-down state, stealth mechanics + Tempo-spent principle, slot-as-scarce-resource framing, equipment as slotless modifier card type, attack patterns (cleave as pattern, not keyword), Red's identity as the *now* color, Blue/White's cost-shape distinction, the no-on-resolve-targeting pillar (effects pick at random from legal candidates), the action queue model + permanents-positional vs actions-temporal distinction, actions resolve to discard pile (cycling on deck-empty) with exile as premium one-shot keyword, the Tempo ordering hierarchy (Tempo → location → position → side priority via local Tempo total + alternating fallback), White's second mechanical idea (healing + divine shield protection), Blue's two-archetype control suite (Counterspell + Stifle), Curse design discipline (static board auras or player-direct effects), front-row vs back-row combat semantics with front row as a blocker for the back row, ranged combat with ammo as the first consumable resource, equipment as modifier vs replacement (the "sets" class, e.g., bow sets ranged power), and the *activation actions* design class (actions that interact with permanents, replacing the "activated abilities on creatures" idea). See DECISIONS.md for full reasoning. Sections marked _Pass 2_ are intentionally deferred until the high-level model is validated by a vertical-slice prototype.

---

## Concept

A single-player, browser-based, asymmetric, turn-based, roguelike deckbuilder. Each run, the player traverses an interconnected overworld map from a starting node to an exit node, where a boss-summoner waits. Movement triggers card-game encounters whose battlefield is literally the shape of the map around the player: the player's current node's adjacent nodes become the "locations" on the battle board. Structures the player builds at locations persist on the map across encounters, forming "supply lines" that buff future encounters along that route. The boss is also a summoner who, from the opposite end of the map, spreads cards outward toward the player every overworld turn — so the map is being filled by both sides simultaneously, and the geometry of the run is the geometry of the conflict.

## Design Pillars

These are the load-bearing ideas. Any future design decision should be tested against them: if a proposed change weakens a pillar, that's a signal to look harder.

1. **The map *is* the battlefield.** Overworld geometry directly shapes each encounter. Adjacent nodes become battle locations; routing decisions are tactical decisions.
2. **Symmetric roles, asymmetric agency.** Player and boss are both summoners playing under the same card-game rules. Their asymmetry is in *how they move* (player as a pawn through neutral ground; boss as a spreading wave from the exit) and in *what supports them* (player gains power from neutral encounter rewards; boss gains power from designer-tuned head-start tempo).
3. **The map is the difficulty curve.** Encounter difficulty is emergent from the simulation — turns of unopposed AI build-up + supply-line resources flowing back to the boss. We do not script difficulty per encounter; it falls out of position on the map.
4. **Fog of war is mechanical, not flavor.** A face-down card on the battlefield is inert (no stats, no combat, no triggers, not a legal target) regardless of how it got there. Encounter-arrival, just-committed cards, and stealthed cards all share one face-down rule. AI cards on uncontested overworld nodes are face-up real game state, hidden only by the UI; on player arrival they flip face-down via the universal stealth rule and flip back up at end of round 1 upkeep. The only entry/reveal trigger keyword is **flip-up**, which fires every time a card transitions face-down → face-up — meaning AI overworld cards get their flip-ups fired both on overworld placement and again on encounter-start reveal.
5. **No interaction, but timing matters.** There is no MTG-style priority/response chain. Both sides commit cards face-down to a *play queue*; cards flip and resolve in queue order. Within a turn, however, *which phase* an action is committed in matters, because actions resolve at the end of the phase they were played in. Specific cards can grant *recon* — a privileged sub-phase that lets the privileged player commit one card after seeing the opponent's commits land (slot occupancy and stat changes, not card identities). Recon is a sanctioned exception to simultaneity, gated by card cost; it does not create response chains or open new priority passes. (See *Recon (privileged commit window)*.)
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
| Source of run-power growth | Neutral encounter rewards (deck additions, removals, transformations, evolutions, stat bumps) earned by engaging with on-board neutral puzzles during encounters — see *Encounters: unified hostile/neutral framework* | Designer-tuned deck composition + head-start tempo (more turns of unopposed build-up the closer to the exit) + consumed neutrals along its spread path (denying rewards to the player) |
| Information visible | Sees the map, sees own cards, sees only revealed AI cards | (TBD; assumed to be a fair simulation under fixed AI rules — see Open Questions) |
| Win condition | Reduce boss Durability to 0 via unblocked combat damage at the exit-node encounter | Reduce player Durability to 0 via unblocked combat damage |

The asymmetry is *structural*, not *rules-based*. Both sides play the same card game; their experiences differ because their movement rules and power-growth rules differ.

## Stats & Resources (high-level)

The economy of the entire game collapses into a single mental model: **what stats are present where, and how much does each side want each stat to be high or low at each place.**

### Stats are vocabularies, not deck identities

The player cannot preassemble a deck around a chosen stat or color. Each run begins with a starting deck, and new cards are added by neutral encounter rewards more or less opportunistically. The player may end up Force-heavy because they got lucky (or chose well) with rewards, but they may also end up with a 60% Force / 25% Spite / 15% Insight mixture because that's what the run gave them. **The system has to work — and be fun — at all those mixtures.**

This means stats are not factions. They are *axes the card pool varies along.* A card prints whatever stats and effects make it itself, and decks are emergent combinations of those vocabularies. Cross-stat synergy is the design goal, not a tradeoff.

Three concrete consequences:

- **No stat can be a pure commitment trap.** A single Force card in an otherwise Insight deck must not be dead weight.
- **Force and Tempo are connective tissue.** They appear across cards of all flavors, gluing decks together economically. That's why they are "gold and silver" — universal currency, not faction markers.
- **Stat identity is about *flavor of effects*, not *deck identity*.** A Force card and a Spite card sitting next to each other shouldn't fight; they should combine in a way that's interesting.

### Summoners have Durability only

The player and the boss are summoners with Durability. They have no stats themselves. All combat numbers, all card-cost requirements, and all economic modifiers come from the cards and locations *in play*.

### Stats live on permanents and on terrain

Stat presence at a location has two sources:

- **Terrain** — printed on the location itself; a permanent local floor unaffected by combat.
- **Permanents** — creatures and structures the side has in play at that location; volatile, removable.

Both sources sum into the per-side stat totals at that location. Combat can only reduce the volatile portion; terrain stays. Per the scope rule (Pillar 8), terrain stats apply *only* at that location.

### The stat list (working set — names are D&D-style placeholders pending theme work)

The five stat names are **Force, Tempo, Insight, Resolve, Spite** — abstract-evocative names that carry the color flavor directly into the stat label. (Earlier doc passes used D&D placeholders STR / DEX / INT / FAITH / VIT; those have been retired in favor of the current names.)

- **Force** — combat damage dealt. The most common stat; appears across all flavors. Often called "red" colloquially.
- **Tempo** — initiative / order of reveal and attack within a phase. Higher Tempo acts first; negative Tempo is a legal printing. The full ordering hierarchy is in *Tempo ordering and combat sequence*. Second most common stat; often called "green" colloquially.
- **Spite** — armor / damage reduction on incoming attacks. *Does not* set creature Durability — Durability is a separately printed value. Often called "black" colloquially.
- **Insight** — modifies cards drawn per turn (globally, summed across all the side's locations). Often called "blue" colloquially.
- **Resolve** — modifies hand size kept after cleanup-phase discard (globally, summed across all the side's locations). Often called "white" colloquially.
- **Perception** — implied by the fog-of-war design; expected to gate effects that peek at face-down cards in the play queue. Currently held as a likely sixth stat, but possibly absorbed into Insight depending on color design.

Force and Tempo are workhorse currencies — most cards print some Force and occasionally Tempo, so they are broadly available across all card flavors and serve as universal cheap cost-payers ("gold and silver"). Insight, Spite, Resolve are scarce, themed, high-impact: 2 Resolve at a location is a meaningful achievement.

### Durability is universal; combat-as-violence is not

Every creature on the battlefield exists in a world where a Force-bearing enemy can deal damage to it, and that damage has to interact with *something*. So **every creature has a printed Durability**, regardless of its other stats.

But a creature having durability does **not** imply the creature deals damage back, has any Force at all, or even *could* engage in violence as a thematic concept. Force-less creatures exist as a deliberate design space: a scholar with no Force who occupies a creature slot, generates Insight, and dies if a hostile creature gets through to it. A relic-keeper that produces Resolve but contributes zero combat threat. A herald that triggers a powerful effect on reveal and is otherwise inert.

Two ideas were being conflated and are now separated:

- **"Engages in violent combat"** — the card has Force; it deals damage; it is a combat threat.
- **"Exists in the battlefield as an attackable thing"** — the card has durability; it occupies a creature slot; it can be destroyed by combat damage.

Most creatures are both. The design intentionally allows the second-without-the-first.

A consequence: **decks with no path to dealing damage cannot win.** Combat damage and spell damage are the two ways to reduce summoner Durability. A pure-utility deck with no Force creatures and no damage spells has no win condition. This is a known constraint, equivalent to deck construction in any card game; it self-enforces during play.

### Stats triple as combat, economy, and cost

Each stat that exists on a card does three jobs:

1. **Combat math** — Force is damage; Tempo is order; Spite is reduction.
2. **Global economy modifier** — Insight total (across all the side's locations) increases that side's draw count for the turn. Resolve total (across all the side's locations) increases that side's kept hand size at cleanup. Both are summed globally; this rewards spreading wide across many locations.
3. **Local cost-paying** — every card has a cost expressed as a stat-presence requirement at the location where it is played. Costs may be inequalities in either direction: ≥ X (need at least X), ≤ Y (need *no more than* Y), or compound. This means cards can be designed to play *only* in stat-poor or stat-imbalanced locations — a real mechanical home for off-archetype designs.

Triple-duty applies to stats that *exist on a card*. A card that prints no Insight does not contribute to draw economy; that does not mean every card must print Insight.

#### Comparative costs (opponent-relative)

In addition to absolute inequalities, costs may be **comparative against the opponent's stat presence at the same location**. Examples:

- "Requires more Force here than your opponent."
- "Requires less Resolve here than your opponent."
- "Requires equal Insight."
- Compounds: "Requires more Force AND less Resolve than your opponent."

Comparative costs do significant design work:

- They create *rivalry-themed* cards. Dominance and underdog become real card identities.
- They make the opponent's stat presence informational beyond combat math — enemy stats can enable or disable *your* plays.
- They open desperate-power design space: "less Force than your opponent" cards are only playable when you are losing the local stat war, which is thematically and mechanically self-balancing.
- They give a strategic reason to *not* over-stack stats — over-accumulation can lock you out of certain plays.

Comparative-cost components are evaluated at the **resolve-time** cost check (see *Cost-check happens twice*, below), when the opponent's stats are visible. The cast-time check uses only the caster's visible state; comparative components against hidden enemy state pass at cast and bind at resolve.

#### Cost-payment is a presence check, not a consumption

Paying a card's cost does **not** consume the contributing stats. Stats persist as long as the contributing permanents (and terrain) remain in play. Multiple cards played at the same location can satisfy the same stat presence repeatedly — the stat is not depleted by each play. This is consistent with stats being *presence*, not *resource pools*.

#### Cost-check happens twice: at cast and at resolve

A card's cost requirements are checked at two moments:

- **At cast** — when the player commits the card to its slot. Uses whatever stats are face-up to the caster at that moment. Catches the obvious "I don't have an Insight mage at this location" failure at the time of input. Comparative-vs-opponent components against hidden enemy state pass at cast.
- **At resolve** — when the action actually resolves. For an immediate (no-timing-trigger) action, that's the end of the cast phase. For a delayed-timing action, it can be several phases later. Cost requirements are re-evaluated against the current stat state; if conditions changed (your stat-printer was killed, an opponent's comparative stats moved), the action **fizzles**.

The resolve-time check is the binding one. A consequence: combat damage that lands between cast and resolve can disrupt enemy queued actions — killing an Insight mage in combat can fizzle a Blue spell that was queued earlier. This is a real form of pre-resolution disruption that does not violate Pillar 5 (no in-phase response chain), because fizzling resolves *between* phases, not *within* one.

The longer the gap between cast and resolve, the more exposed the action is. Designers can tune power-vs-exposure per card by setting the timing trigger.

### No mana, no separate resource currency

What you have already played *is* your resource pool — and it is local to each location. Resource-card-style "lands" do not exist as a separate type. Their role is filled by free-cost cards (creatures and structures with no cost requirement) that print small amounts of stat — typically Force — to bootstrap the location's economy. Structures with non-trivial scope ("here," "supply line," etc.) are how the player builds run-wide engines.

### Slots are the actual scarce resource

Stat presence is unlimited in principle — once placed, a stat-printing permanent contributes its presence indefinitely, can be spent against many cost requirements simultaneously, and persists until something destroys it. What constrains play is not stat presence but the count of available **slots** at a location: creature slots, structure slots, and action slots are all bounded.

This produces a real tension: filling slots with permanents is how you generate stats, but a fully-filled board means leftover stat presence with no outlet. How colors handle this differs structurally:

- **Action-leaning colors (Blue, White)** cycle through action slots — actions resolve and exit, freeing the slot continuously. Their slot economy is fluid.
- **Combat-leaning colors (Red, Black, partly Green)** fill creature and structure slots with permanents that *stay*. They generate stats efficiently but face slot-cap pressure mid-encounter — leftover stat presence with no remaining slot to spend it on.

**Equipment** (see *Card Types & Slots*) is the slotless release valve that resolves this tension: equipment doesn't take a slot, it modifies an existing permanent, so it remains playable even when all permanent slots are filled. Equipment skews toward combat colors precisely because they are the colors that hit slot-cap most acutely.

### Tuning constraint: stat values stay low

Because stats are scarce by intent, and because terrain stats are removable only by rare premium effects, location terrain values should be modest. A 3-Insight location is enough to dominate global draw economy for the encounters that include it, and most of the time neither side will be able to remove it. Terrain provides a local boost; permanent stat-printing carries the long game.

### Terrain destruction is rare, partial, and premium

Terrain is *not* literally indestructible. A small number of premium card effects can **destroy a location's terrain** — wiping its stat line and/or its rules text. This is uncommon and valuable; most cards cannot do it. The effect-class is a deliberate design space, not the default.

Critically, **terrain destruction does not affect the location's card-slot profile**. The grid shape, slot counts for creatures, structures, and actions are *structurally* part of the battlefield and cannot be removed by any effect — they're how the location is even rendered as a play space. You can wipe a shrine's "+2 Resolve here" stat line and its "creatures here gain +1 Force" rules text, but its 2x2 creature grid and 1 structure slot remain. The location persists as a featureless arena.

Terrain destruction may be partial (stats only, or rules text only) or full (both), depending on the printed effect.

## Card Types & Slots

Each location has three distinct slot types — creature, structure, and action — each holding a corresponding card type. A fourth card type, **equipment**, occupies no slot of its own; it attaches to an existing permanent. The four card types differ in how they interact with combat damage, the graveyard, and the slot economy.

### Creatures

- Occupy creature slots (a per-location grid; default 2x2, but variable per location). The grid splits into a **front row** and a **back row** with distinct combat semantics — see *Front row, back row, melee, and ranged*.
- Have **Durability** — a separately printed value, not derived from any stat.
- Are **attackable by combat damage** in dex-ordered combat resolution. When durability reaches 0, the creature is destroyed and goes to the graveyard.
- May or may not have Force; without Force they exist but do not deal damage themselves (see *Durability is universal; combat-as-violence is not*).
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

Spell-focused win paths (Blue's direct damage, White's repeat-Prayer attrition) depend on this cycling. Without it, total spell damage per encounter is capped by deck composition. The cycling is naturally gated by other mechanics — stat presence requirements, slot occupancy, Resolve retention across cleanup, vulnerability of stat-printers — so the recycle doesn't bypass existing controls; it lets tools refresh.

A "premium one-shot" effect can override the discard cycle by printing **"exiled when this resolves"** — sending the card to the exile zone instead, where it cannot be recycled. This is the keyword space for the rare powerful effects that should be played once per encounter.

#### Action destinations: discard, graveyard, exile (deck-thinning levers)

Most actions go to the discard pile on resolve (the default — they cycle back via reshuffle). When a card needs *not* to cycle back, the design has three levers, each with different recovery characteristics:

| Destination | Cycles back via reshuffle? | Recoverable by graveyard recursion? | Use case |
|---|---|---|---|
| **Discard pile** | Yes | No (graveyard ≠ discard) | Default. Most actions. |
| **Graveyard** | No | Yes — graveyard-recursion mechanics can pull it back | Counterspell-targeted actions, token-creators, recursion-displaced actions |
| **Exile** | No | No — permanently out for the encounter | Premium one-shots; printed `exiled when this resolves` |

**The deeper design rule: watch out for 1-card decks.** Any action that *thins the deck while staying playable* risks becoming a one-card-deck loop. Before printing any action that could be a deck-thinner, the design asks **which lever applies**:

- If the card is *meant* to cycle (a recurring damage spell, a refreshable Pray-N), the discard pile is right.
- If the card creates board-state on resolve (token-creators, persistent effects), the graveyard prevents infinite spam while preserving optional recovery.
- If the card is a one-time game-ending payoff, exile is right.
- If the card itself is a recursion mechanic, swap-displacement is right (see below).

**Specific applications captured so far:**

- **Counterspell-targeted actions** go to the graveyard (existing rule). Counterspell itself also goes to the graveyard.
- **Token-creating actions** go to the graveyard on resolve. A token-generator that cycled through discard would spam permanents indefinitely.
- **Recursion is a swap-displacement.** A card that recurs an action from the graveyard back to your hand: the recurring action **enters the graveyard in the recurred action's place**. Net: one action moved out, one moved in. Bounds recursion loops to a one-time switcheroo rather than an unbounded accumulator.
- **Premium one-shots** (high-impact game-ending effects) print `exiled when this resolves`.

The lever framework is **vocabulary**, not a universal rule applied to all recursion. Some recursion mechanics may be designed to genuinely bypass swap-displacement (e.g., a premium White Pray-action that resurrects a friendly creature without displacing — paying the cost in stat-presence). Each card chooses its lever explicitly. See DECISIONS.md for full reasoning.

#### Activation actions: actions whose value depends on permanents in play

A signature design class within the action vocabulary: actions that **interact with the player's existing permanents at the location**. The action does nothing without the right kind of permanent on the board. This replaces the design space of "activated abilities printed on creatures" — instead of a creature carrying its own activatable text, an action card from your hand triggers an effect on creatures already in play.

Canonical examples:

- **Volley** (Green / Red): your ranged-pattern back-row creatures here fire (off-cycle, outside the combat phase). Cost: stat presence + ammo per shot.
- **Charge** (Red): a friendly front-row creature here attacks (off-cycle melee). Cost: Force presence.
- **Inspire** (White): friendly creatures here gain +X Force through their next combat. Cost: Resolve presence.
- **Drain** (Black): a friendly creature here takes 1 damage; opposing summoner takes 2. Cost: Spite presence.

Why this design class is genuinely satisfying:

- **The permanent IS the cost-prerequisite.** Cost-payment is stat-presence + the *right kind of permanent on the board*. The permanent provides implicit context the action needs.
- **Card economy gates everything.** No new resource types (no "mana per color"). The cost is a card from hand + the action slot + the stat presence.
- **Splash-friendly across colors.** A Red Charge can activate any color's front-row creature; a Green Volley can fire any color's ranged-pattern back-row creature. The action specifies the *kind* of permanent it needs, not a color match.
- **Setup matters.** A deck full of activation actions with no compatible permanents is dead in your hand. Board state determines playability — which is the kind of strategic constraint the design wants.
- **The action queue is the natural sequencer.** Multiple activation actions in the same phase resolve in Tempo order via existing rules. No special "activated ability stack" needed.

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

- **Modifier equipment** (the default class) *adds* to the host's existing capabilities — adds Force, adds an attack-pattern variant, grants a keyword. The creature's underlying stats still apply, with the equipment layered on top.
- **Replacement equipment** (the "sets" class) *overrides* an aspect of the host. The canonical example is ranged equipment that sets the wielder's ranged power explicitly: an archer with a bow uses the bow's printed damage value, not the creature's Force. Buffs to the creature's Force no longer scale the ranged attack — the bow is the attack. Replacement equipment is the design space for "the weapon defines the wielder" effects.

The two classes interact differently with Tactics buffs and other stat-scaling: modifier equipment passes buffs through; replacement equipment makes buffs irrelevant for the replaced aspect.

Several details (per-permanent equipment cap, color identity per equipment archetype, color-neutral equipment, equipment + zombification interaction, equipment-removal color-pie) are tracked under Open Questions.

### Action-slot occupancy as a real strategic resource

Because persistent actions stay in their slot across turns, the action slot is itself a strategic resource. A 1-action-slot location occupied by a 4-turn Prayer means no other action can be played at that location until the Prayer resolves or is removed. This is a real cost; it makes the *choice to commit a persistent action* meaningful, and it makes effects that *clear action slots* (see *Counterspell*, below) genuinely powerful.

Persistent actions also worsen the slot-cap pressure described in *Slots are the actual scarce resource*: a location with its lone action slot occupied by a multi-turn Prayer can play no further actions there. White and Black, both of which lean on persistent actions, have structural reasons to value equipment as a complementary release valve.

## Tokens (card-generated permanents)

A **token** is a permanent generated mid-encounter by another card's effect, rather than played from the hand. Tokens behave on the battlefield like any other permanent — they occupy slots, contribute stats, can be destroyed by combat or effects — but they have **no representation in any zone outside the battlefield**. They aren't in any deck, hand, discard, graveyard, or exile. When destroyed (or otherwise removed), they cease to exist.

### Properties

- **Generated, not drawn.** Tokens come from card text ("on reveal: create a Sandbag token at fl"). They cannot be played from a hand because they aren't *in* a hand to begin with — they don't exist until generated.
- **No deck/hand/discard presence.** A token never enters any pile. It exists only on the battlefield.
- **No graveyard on destruction.** When a token is destroyed, it just disappears. No raise/recursion can bring it back, no death-pile mechanic counts it toward graveyard size.
- **They count as creatures (or structures) while in play.** A creature token contributes its printed stats, takes combat damage, can be targeted by effects targeting creatures, and triggers death-effects on other cards when destroyed (e.g., "when a friendly creature dies, draw a card" *does* fire when a token dies). Tokens are first-class permanents while in play; the only thing different is their origin and disappearance.
- **They occupy slots.** A token-creating effect that has no legal slot to spawn into fizzles (or the token simply isn't created). Slot scarcity bounds token spam naturally.

### Why tokens are a useful design space

Tokens solve a real problem: how to make creature-generation effects feel meaningful without flooding a deck with extra cards. Without tokens, "create a creature" effects either:

- Pull a card from the deck (depletes the deck weirdly)
- Pull from graveyard (recursion — already Black's space)
- Create real cards somewhere (where? hand-flooding is bad)

Tokens cleanly sidestep all of these: a created creature lives on the battlefield directly, with no deck implications. This gives weak-early colors a path to *board presence* without losing their identity (still printing minimal Force or Spite, just doubling presence via summoned tokens).

### Color flavor of token creation

Each color has a natural relationship to tokens:

- **Green:** *engineers and scouts deploying constructions.* Living creatures whose effects produce inanimate or semi-living tokens (sandbags, traps, scout markers). The creator is a real person; the tokens are what they construct.
- **Blue:** *summoned copies / mirror images.* A weak Blue creature whose effect creates a token version of itself or another creature. Doubling, shimmering duplicates.
- **White:** *summoned guardians / spirits.* Tokens created by Prayer resolutions, healing effects, or "bring forth a defender" actions. Often defensive, often with high Spite or specific protective abilities.
- **Red:** *raw bodies / berserker spawns.* Cheap Force-printing tokens generated by combat triggers — "when this kills a creature, create a Berserker token here." Tokens scale Red's tempo lead.
- **Black:** *less natural* — Black already does graveyard recursion, which fills a similar deployment niche. Tokens from Black might be *cursed spawns* or *plague tokens* tied to enemy-side effects.

### Token cost principle

A token-creator's cost should equal what it would cost to play each spawned token *as a real card from hand*. The savings of a token-creator are **cards drawn (one card from hand instead of N) and tempo (all tokens arrive in one turn)**, not stat efficiency.

Example: if Mage costs free / prints 1 Insight / has Durability 1, then a Mirror Image (a creature whose token-spawn duplicates itself with the same stats) should cost the equivalent of *two* Mages — i.e., ≥1 Insight cost and prints 1 Insight itself, plus the spawned token also prints 1 Insight. Two slots filled, 2 Insight presence, 2 Durability total durability — same totals as playing two Mages over two turns. The Mirror Image card just compresses that into one turn at the cost of 1 card instead of 2.

If a token-creator's cost is *less than* the equivalent N-creatures it produces, it generates raw stat advantage and breaks balance. If it's *more*, it's never worth playing. Match the cost to the equivalent.

The same rule applies more loosely to tokens with reduced stats: a Combat Engineer that spawns a 0-Force Sandbag is *trading* — the Sandbag's slot is *occupied without printing damage*, so the Engineer's slot is providing the only combat value. That's a defensive tradeoff (slots-as-walls instead of slots-as-attackers), not a stat-efficiency win.

### Token cards (sketches, none committed yet)

A few illustrative working drafts:

- **Combat Engineer** (Green creature, free, Force 1, Tempo 0, Durability 2). On reveal: create one Sandbag token at an empty front-row slot at this location.
- **Sandbag** (token, no cost — only generated). Force 0, Tempo 0, Durability 1. *"Constructed defenses. Blocks attacks but cannot fight back."*
- **Mirror Image** (Blue creature, ≥1 Insight cost, Force 0, Tempo 0, Insight 1, Durability 1). On reveal: create a token copy of this creature at an adjacent empty slot. Both copies print 1 Insight each. *(Cost equals 2× a Mage's stat-efficiency; the saving is one card from hand and one turn of tempo.)*
- **Mirror Image (token)** (token, no cost). Force 0, Tempo 0, Insight 1, Durability 1. Identical to Mirror Image's printed creature stats but cannot itself spawn another copy.
- **Vanguard Scout** (Green creature, free, Force 1, Tempo 2, Durability 1). On reveal: create a Vanguard token at an adjacent empty front-row slot. *(Vanguard token: Force 1, Tempo 0, Durability 1 — slower copy. Cost-balanced because the token is weaker than the original.)*

### Token structures

Tokens are not limited to creatures. **Token structures** are a parallel subclass: they occupy the structure slot, behave like real structures while in play (immune to combat damage, destroyable only by structure-removal effects), but have the same lifecycle constraints as token creatures — they don't enter any pile, and they don't persist across encounters.

The intuition behind token structures: real structures are a long-term map-shaping investment (they persist on the map across encounters, forming the supply-line mechanic). Token structures fill a shorter-term niche — **tactical filler when the structure slot would otherwise be empty**, especially earlier in a run when the player's deck doesn't yet have strong structure cards.

**Lifecycle:**
- **Created** mid-encounter by a card effect (typically an on-reveal trigger on a creature, or an action's effect).
- **Persist** within the current encounter as long as not destroyed.
- **Destroyed** by structure-destruction effects (same as real structures), at which point the token simply ceases to exist (no graveyard, no exile).
- **End of encounter:** all token structures clean up automatically. They do *not* persist on the map between encounters. This is the structural difference from real structures and the cost that justifies their easier deployment.

**Why token structures are weaker than real structures:**
- They print modest local effects, not run-defining global ones.
- They're encounter-bounded, so they can't contribute to supply lines across the map.
- They don't take up a card slot in your deck — they're generated from a creature or action.

A creature that spawns a token structure is essentially trading "one card-effect token-structure now" against "the long-term durability of a real structure." Both are valid plays; the choice depends on whether the player has a real structure available *and* values long-term over short-term local benefit.

**Color flavor of token-structure creators:**

- **Green:** *Trench, sandbag emplacement, observation post.* Combat-defensive structures. *"Trench: creatures here gain +1 Spite this encounter."* Pairs with Green's Combat Engineer creature pattern.
- **White:** *Chapel, shrine, prayer pillar.* Resolve-bootstrapping structures. *"Chapel: this location grants +1 Resolve while in play."* Gives White early-game Resolve presence without requiring Acolyte draws.
- **Red:** *Bonfire, watchtower, war banner (token version).* Combat-aggressive. *"Bonfire: creatures here gain +1 Force at end of upkeep this encounter"* (note: this is a *token* watchtower; the real Banner of War is more powerful and persists).
- **Blue:** *Observatory, scrying pool.* Information / draw. *"Observatory: at the start of each turn, look at the top card of your deck."* Gives Blue a way to deploy mild scry without spending a card slot on it.
- **Black:** *Cairn, shrine of the dead.* Persistence-flavored. *"Cairn: when a creature dies here, you may add it to your graveyard"* (mostly trivial since dying creatures already go to graveyard, but pairs with rules where some destruction sends to exile).

These flavors give each color a way to project a weak local effect *immediately* without needing to draw a real structure — useful in early encounters when the deck hasn't yet acquired strong cards.

### Token actions

Token actions are the third subclass: card effects can spawn a one-shot or persistent action directly into a side's action slot, without that action ever being a real card in any pile. This is unusual compared to MTG (where actions go to the graveyard on resolve and can't be tokens), but it fits cleanly in this game because actions occupy slots like creatures and structures do.

**Lifecycle:**
- A creature or other effect spawns a token action into a target action slot. The slot must be empty at spawn time, otherwise the spawn fizzles.
- The token action enters the slot **face-up** (not face-down), since it didn't go through a normal commit window.
- The token action resolves at end of phase, like any other action in a slot.
- On resolve, the token ceases to exist (no graveyard, no discard, no exile). Same disappearance rule as token creatures and structures.

**Why this works mechanically:**
- The action slot has the same scarce-resource semantics whether the action came from hand or was generated. So balance is preserved by slot occupancy.
- The token action follows Tempo-ordered resolution alongside committed-from-hand actions. A token Counterspell with Tempo 2 still resolves before a non-token Spark with Tempo 1.
- Persistent token actions (e.g., a token Curse) work the same as a normal Curse: they migrate on reveal, occupy the enemy slot, tick each turn until removed. When eventually destroyed by Counterspell or fizzling, they cease to exist (no graveyard).

**Color flavor of token-action creators:**

- **Blue:** *Channeler / Echo Mage.* A Blue creature whose on-reveal spawns a token Spark (1 Insight-cost spell, 2 damage to a random enemy creature). Cost-balanced as Mage + Spark equivalent.
- **Red:** *Berserker / Warcry.* A Red creature whose on-reveal spawns a token combat-buff action ("+1 Force to all friendly creatures here this combat"). Cheap aggressive token tactic.
- **Black:** *Witch / Hexer.* A Black creature whose on-reveal spawns a token Curse that migrates to the enemy slot. Note: the migrate is the token's own on-reveal, which fires when the token is generated (face-up) — so token Curses migrate immediately on creation, slightly different from hand-played Curses that migrate at end of phase. (Pass 2 detail to confirm.)
- **White:** *Cleric / Invocation.* A White creature whose on-reveal spawns a small Pray-1 prayer in your action slot — a free quick prayer that resolves the same turn if Resolve is present.
- **Green:** *Trickster.* A Green creature whose on-reveal spawns a token "stealth a friendly creature this turn" effect. Manipulates fog of war without spending a card.

**Cost balance:** same rule as token creatures. A token-action-spawning creature costs what playing the action *plus* the creature would cost. The savings are *cards drawn* (one card from hand instead of two) and *tempo* (both effects arrive in one turn). The token action is *not* free value.

### Open questions about tokens

- **Death triggers vs tokens.** Confirmed: tokens count as creatures for "when a friendly creature dies" triggers. But do *graveyard-count* effects (e.g., a card that says "this gets +1 Force for each creature in your graveyard") count tokens? Probably no — tokens aren't in a graveyard, ever. To pin down in Pass 2.
- **Tokens and Black recursion.** Can a Black raise effect target a token in any way? Almost certainly no — tokens never enter the graveyard, so there's nothing to raise.
- **Stealing tokens via stealswap.** Can Black's stealswap move a token to its side? Probably yes (it's a creature in play), and the token survives the encounter on the new side just like a real swapped creature. But ownership questions are subtle — does the original creator's "creates" still apply? Pass 2.

## Evolution (in-encounter card transformation)

A creature with an **evolve** trigger can transform mid-encounter into a different specific card when a printed condition is met. This is distinct from between-encounter card augmentation (see *transform* and *upgrade* in Open Questions); evolution happens *during* an encounter on the battlefield.

### General rule

A card may print: *"When [condition], this creature becomes [other card name]."* When the condition is met, the original card is replaced in its slot by the named card. The new card enters with its printed stats (not the original's stats), keeps its position in the slot grid, and any equipment attached to the slot stays attached. Damage on the original is *not* carried over — the new card enters at full Durability. The original card is gone for the rest of the encounter (does it go to graveyard, or just cease to exist? Pass 2 to confirm; probably ceases to exist, since the creature is *the same entity, transformed*, not destroyed).

Conditions can be anything observable about board state: *"if this has survived 3 upkeeps,"* *"if this has dealt 5 damage,"* *"if there are no other friendly creatures here,"* *"if your graveyard has 5 or more creatures."*

### Why evolution is a distinct mechanic class

We already have several "card changes" mechanics:
- **Zombification** (Black raise) — changes stats on play, lasts one encounter.
- **Equipment** — modifies a creature's behavior while attached.
- **Buffs/debuffs** — temporary stat modifications.

Evolution is different from all of these: it **replaces the card itself with a different card.** Not a stat tweak; a wholesale identity swap. The Mad Prince *becomes* the Mad King — those are different cards, with different stat lines, different effects, different art.

This makes evolution a tool for **gated power-tier increases**. A card that's weak by default but becomes strong under specific conditions rewards player skill (or persistence, or sacrifice) without needing to print the strong version directly.

### Canonical example: Mad Prince

> **Mad Prince** — creature, free cost, Force 0, Tempo 0, Durability 2.
> *"During upkeep, this creature takes 1 damage. If this has survived 3 upkeeps, it transforms into the Mad King."*

> **Mad King** — generated by evolution only, not playable from hand. Force 3, Tempo 1, Spite 2, Durability 5. *"At end of upkeep, all friendly creatures here gain +1 Force until end of turn."*

The Mad Prince *will* die in 2 turns by default — that's the natural outcome. To get the payoff (Mad King), the player must keep the Prince alive across 3 upkeeps despite its self-damage. That requires:

- **Healing** (White) — restore the damage before it kills the Prince.
- **Divine shield** (White) — absorb the upkeep damage instances.
- **Stealth** (Green re-flip) — face-down creatures don't take upkeep damage (probable rule; Pass 2 detail). The Prince hides.
- **Spite-based damage reduction** — equipment or aura that reduces incoming damage to 0 turns the upkeep tick into nothing.

So Mad Prince is a *cross-color combo card* — it's most rewarding when the deck has White or Green or Black (Vit) tools to keep it alive. It rewards having tools to *protect what you've invested in*.

The flavor: the prince is a tortured, unstable figure self-destructing under his own madness. If shielded long enough, the storm passes and he becomes the wise king he was meant to be.

### Color flavor of evolution

Each color has natural evolution archetypes:

- **Red:** combat-pumping evolutions. *"If this has dealt 5 damage, it becomes [stronger version]."* Berserkers becoming champions through bloodshed.
- **Green:** survival evolutions. *"If this has not taken damage for 3 turns, it becomes [stronger version]."* Scouts becoming masters through the discipline of patience.
- **Blue:** knowledge-gated evolutions. *"If you have drawn 5 cards this encounter, this becomes [stronger version]."* Apprentices becoming archmages through study.
- **White:** faith-gated evolutions. *"If a Prayer has resolved at this location, this becomes [stronger version]."* Acolytes becoming priests through witnessing miracles.
- **Black:** sacrifice-gated evolutions. *"If 3 friendly creatures have died here, this becomes [stronger version]." Necromancers becoming liches through accumulated death.

### Open questions about evolution

- **Does the evolved card go to graveyard or deck at encounter end?** Probably *deck* — the player's deck-state stays consistent (an evolved Mad King doesn't permanently replace a Mad Prince in the deck). The next encounter draws a fresh Mad Prince. Worth confirming.
- **Can the evolution trigger apply to *enemy* creatures?** "If this has survived 3 turns under enemy control, it transforms..." — probably yes, mechanically. Some evolutions might intentionally trigger off the opponent (a Black-flavored "your reanimated zombie evolves into a lich after 3 turns").
- **Multiple evolution stages?** Could a card have a chain (Mad Prince → Mad King → Mad God)? Probably yes, but rare. Pass 2.
- **Interaction with stealswap.** If the Mad Prince is stolen by Black before its evolution triggers, does it evolve under the new owner's control? Probably yes — the trigger is on the card, not the owner.

## Multi-slot Cards

A card may occupy *more than one slot* at its location. This is a fundamental cost lever: a multi-slot card pays its slot footprint as part of its cost, and gets correspondingly more value (stats, durability, effect text) than a single-slot card.

### Footprint shapes

In a 2x2 creature grid, a 2-slot creature can occupy:

- **Row spanner:** front row (fl + fr) or back row (bl + br). Wide presence.
- **Column spanner:** left column (fl + bl) or right column (fr + br). Tall presence.

Three-slot creatures (L-shapes or rows) and four-slot creatures (entire grid) are conceptually possible but **v1 design caps at 2-slot footprints.** Larger creatures are rare exotics for later increments.

For structures, multi-slot means occupying both structure slots at the location (a single huge structure replacing what would otherwise be two smaller ones).

For actions, multi-slot means requiring two action slots to be empty when committed (and consuming both during resolution). Actions can't be multi-slot in v1's one-action-slot-per-location norm; this becomes meaningful in locations with 2+ action slots.

### Combat implications for multi-slot creatures

A multi-slot creature *is hit by every attacker whose target column it occupies*. So:

- **Row-spanner in front row** (fl+fr): both player columns hit it. It takes both attackers' damage in a turn.
- **Column-spanner in fl+bl**: only one column hits it directly (the front-row hit landing on it; back-row hit also landing on it if column attacks reach back). The damage is column-localized.

This means **row-spanners need disproportionate Durability to survive** — they're getting hit twice per round at minimum. A 2-slot Behemoth with Force 4 / Durability 8 takes potentially 4-8 damage per turn from front-row attackers; without Spite or healing, it dies in 1-2 rounds.

Column-spanners are more survivable per Durability-budget but project narrower threat — they only block one column's attack pattern.

### Cost balance

A multi-slot card costs roughly **the slot count × single-slot card value** — same logic as token-creator costs. A 2-slot creature should be roughly twice as good as a 1-slot creature in raw stat-budget (higher Durability, higher Force, possibly with text). The savings: one card from hand instead of two, one turn of tempo. Just like tokens.

But a 2-slot creature also *consumes 2 of your 4 creature slots*, so your maximum creature count at that location is now 2 (the multi-slot creature plus one single-slot). That's a real opportunity cost.

### Color flavor

Multi-slot cards are not equally natural across colors:

- **Red:** **giants, ogres, behemoths.** Slow, big, brutal. Multi-slot creatures with high Force and high Durability fit Red's "bigger is better" lone-champion philosophy. A 2-slot Champion variant — column-spanning, immune to shove (since their back row is already them) — would be peak Red.
- **White:** **cathedrals, fortresses, sprawling sanctuaries.** White's civic flavor (now living in Blue+White Bureaucracy) lands here. A multi-slot Cathedral consuming both structure slots, projecting strong global effects.
- **Black:** **abominations, undead horrors.** Multi-slot zombies that absorb damage with high Spite. Column-spanners with thorns retaliation in both rows.
- **Green:** *less natural.* Green is fast and small. Maybe rare elite specialists (a 2-slot ranger with a pet/companion as token).
- **Blue:** *less natural physically, but possible as concept-creatures.* A multi-slot Observatory structure. A "summoned construct" creature. Multi-slot Blue is *cerebral*, not physical.

### Interactions with existing mechanics

- **Shove (Red) vs multi-slot creatures.** A column-spanner can't be shoved to back row because their back row is already them. Row-spanners can be shoved if both back-row slots are empty (and the spanner becomes a back-row spanner). This is a structural answer to "what does Red do against giants" — *you can't push them around easily*.
- **Stealth (Green) on multi-slot creatures.** A 2-slot stealthed creature is taking up 2 slots while contributing nothing visible. Big tempo investment. Probably very rare effects.
- **Stealswap (Black) of multi-slot creatures.** Can a 2-slot creature be stolen via stealswap? It would need both slots on the other side to be empty for the swap to land. Most of the time this fizzles (slot-occupancy unlikely to align). When it lands it's enormous value.
- **Movement of multi-slot creatures.** A row-spanner moving down — both destination slots must be empty. This makes movement of multi-slot creatures rarely achievable. Pass 2 detail.
- **Equipment on multi-slot creatures.** One equipment per host? Two? Treating them as one entity (one equipment slot) keeps things simple.
- **Multi-slot in non-2x2 grids.** Some locations have non-square creature grids (1x2, 2x1, 3x3, etc., per earlier design notes). A 2-slot row-spanner can't fit in a 1x2-deep location. Some locations *exclude* multi-slot creatures — that's a real design lever for varying location identities.

### Why multi-slot cards are worth the design complexity

Multi-slot cards add a **second axis to slot economy**. Today, slot count is a fixed budget (4 creature slots, etc.). With multi-slot cards, **slot count is a per-card variable cost**, and the player must decide: do I want one big creature here, or two small ones?

This pairs beautifully with the existing cycling-creatures pattern: a 2-slot row-spanner *eliminates* the cycling option (no spare slot to rotate through) but provides a large durable threat. A column-spanner preserves cycling on one side while controlling the other column entirely.

It also opens *negotiation between colors*: Red prints multi-slot creatures (big bodies); Black prints multi-slot anti-engagement (thornsy abominations); White prints multi-slot structures (sprawling buildings). Other colors interact with multi-slot via tools that *exploit* the two-slot footprint (Green's column-bypass, Blue's spell damage that doesn't care about Durability buffer, etc.).

Held as Pass 2 design space — implementation requires UI work (rendering a card spanning two cells) and rules detail (movement, equipment, etc.). But the design space is real and substantial.

## Targeting Specificity (a card-design principle)

Card effects vary in how precisely they select their target. The two endpoints:

- **Generic targets** ("a random enemy creature here") always have something legal to hit (assuming the slot has anything). The *what* is decided by the random selector at resolve time.
- **Specific targets** ("a creature with ≤1 Durability here", "the front-row creature in this column", "an enemy creature with ≥3 Force") may have no legal target, in which case the card fizzles. When they do hit, they hit *exactly* what the card was designed for.

### Counter-intuitive cost relationship

In games where the player chooses targets at resolve time (MTG), specificity is a **constraint** — printed restrictions limit what the player can target, so specific-target cards cost *less* than generic ones with equivalent effects. ("Shock: deal 2 to a creature" costs less than "Lightning Bolt: deal 3 to any target.")

In *this* game, per Pillar 10, **the player does not choose targets at resolve time.** The random selector picks among legal candidates. So specificity inverts:

- **Generic-target effects** are reliable but unaimed — you fire and the card lands somewhere among legal targets.
- **Specific-target effects** require the player to *shape the board* so that something legal exists. The skill cost is paid in player setup, not in stat-presence cost.

**Cost implication:** specific-target cards cost *less* than generic-target cards with equivalent effects, not more — the difficulty of using them is a setup tax, not a play-cost. A "deal 2 to a creature with ≤1 Durability" card should cost less than "deal 2 to a random enemy creature," because the first card is *only useful* when the player has set up a wounded enemy. The setup is the cost.

### Movement is the primary setup tool

**Specific-target cards rely on movement to become playable.** A "kill the wounded creature" card is dead until something is wounded. Combat damage produces wounded creatures; movement positions creatures into combat. So the richer the movement system, the more usable specific-target cards become.

Position-targeted effects ("deal 2 to the creature in front of yours") *literally rely on positioning* to determine what they hit. Movement of either side reshapes who's "in front." So position-targeted cards are *most powerful* when the player has the most movement options.

This is one of the strongest arguments for **movement being available in multiple phases.** Each additional commit window where a creature can move is another decision point where the player can set up a specific-target card to land where they want it. Conversely: a game with main-only movement makes specific-target cards much harder to fire reliably, which forces them to be *cheaper* to compensate, which forces specific cards to be *weaker*. Multi-phase movement raises the ceiling on specific-target card design.

### Practical implications for card design

- **Generic-target cards** are baseline — most action cards default here.
- **Specific-target cards** are a premium design space that rewards player skill. They earn their printed power level by demanding board setup.
- **Position-targeted cards** are a subset of specific-target where the position itself is the condition. They especially benefit from rich movement options.
- **Targeting conditions are themselves a color-flavored axis.** Blue's perception lets cards target by *information* ("a creature you've revealed this turn"). White's faith lets cards target by *belief* ("a creature you have prayed for"). Green's positioning lets cards target by *space* ("the creature at fl"). Red's directness lets cards target by *threat* ("the creature with the highest Force"). Black's transactional engagement lets cards target by *damage state* ("a creature that took damage this turn").

This is held as a Pass 2 design space — exact cost calibration and per-color targeting vocabularies to be developed alongside specific cards.

## Hand Mechanics (positional setup, modifiers, and Resolve retention)

The hand zone is currently passive in v1: cards arrive via draw, sit until played, and are discarded at cleanup. Pass 2 design opens up the hand as an *active zone* with three interconnected mechanics: per-card hand modifiers, hand-positional targeting, and Resolve-driven retention via player-controlled hand ordering.

### Hand state can be modified

Today, a card's stats are determined entirely by its card def + in-play modifiers. Pass 2 design extends this: **cards can carry per-instance modifiers while in hand**, applied when they enter play.

- A Red action like *Sharpen* could grant "+1 Force to the leftmost creature in your hand." That creature, when played, enters with Force +1 included in its presence contribution.
- A Black action like *Sap* could apply -1 Force to the leftmost enemy creature in their hand. The opponent's next play comes in pre-debuffed.

This adds a new state-tracking concept: each card instance has a base printed stat block and a modifier set that applies *at zone-entry-into-play*. Buffs persist with the card across hand → play; debuffs likewise. Once the card is played, the modifier merges into the in-play state and behaves normally.

**Why this is worth opening up:**
- It gives Red a non-combat buff direction (prepare your next play, not just buff what's on board).
- It gives Black an *intrusive disruption* path that's signature-Black: reaching into the opponent's plans before they even materialize. Where curses tick from inside enemy slots, hand-debuffs reach all the way back into the deck-to-hand pipeline.
- It opens cross-color combos (e.g., White heals before play, Green grants speed-on-deploy, etc.).

**Concerns to flag:**
- Hand-debuff effects targeting opponent hand cards are *very* strong. Need to be gated by Resolve/Insight premium costs or rare-effect constraints. Otherwise any Black deck consistently wrecks all opponents.
- Tracking per-instance modifiers in hand requires real state-shape work in the engine. Pass 2 detail.

### Hand reordering as a Pillar-10-compatible mechanic

Today, hand cards have no order — they're just a list. Pass 2 introduces **player-controlled hand order** as a first-class state.

The motivation: Resolve retention needs a rule for *which* cards survive cleanup. Naive options:

- **Random discard:** keep N cards randomly, discard the rest. Frustrating — the player might lose their best card to a coin flip.
- **Player chooses at cleanup:** straightforward, but violates Pillar 10 (no targeting at resolve time).

The clean fix: **the player can rearrange their hand throughout the turn. At cleanup, the leftmost N cards (where N = Resolve committed) are kept, the rest are discarded.** This isn't "targeting at resolve" — it's *positional setup* maintained as a standing decision throughout the turn. By the time cleanup fires, the order is already locked.

This is the same Pillar 10 inversion that makes movement valuable: **specificity is a positional setup task, not a resolve-time choice.** Hand reordering is positional setup *in the hand zone*, complementary to creature movement *on the board*.

The UX implication: the hand needs to support drag-and-drop reordering, with a visible highlight on the leftmost N cards equal to current Resolve (preview of "these will survive cleanup"). The player rearranges at any time during the turn; cleanup snaps the cut.

### Hand-positional targeting

Once hand has order, hand-positional effects become a natural design space. Card text references position-in-hand without violating Pillar 10:

- *"The leftmost creature in your hand gains +1 Force until played."*
- *"The rightmost Insight card in your hand has its cost reduced by 1."*
- *"Your opponent discards the leftmost card from their hand."*
- *"Reveal the leftmost card in opponent's hand."*

This is **hand-positional targeting** — a sister concept to slot-positional targeting. Per-color flavor:

- **Red:** *Buff next-played creature.* Aggressive prep — load up the next big swing.
- **Blue:** *Cost reduction or peek.* Information-driven; Blue knows the future of the deck because of perception.
- **White:** *Heal in-hand reserves.* "The rightmost creature in your hand gains +1 Durability" — patches before deployment. Pairs with healing on board.
- **Black:** *Sap enemy hand stats, force discards.* Intrusive disruption; reaches into the opponent's plans before they manifest. Signature Black: take advantage of what isn't even in play yet.
- **Green:** *Speed boost on draw, hand acceleration.* "The leftmost creature in your hand gains +1 Tempo until played." Fits Green's tempo-manipulation identity.

The combination of **hand reordering + hand-positional effects** gives players effective targeting through hand placement: card text says "leftmost creature," but the player chose which creature is leftmost. **Setup, not targeting.** Same Pillar 10 trick as movement-then-position-targeted-card.

### Why this is worth flagging now

These three mechanics — hand modifiers, hand reordering, hand-positional targeting — all reinforce each other:

- Hand modifiers create reasons to position cards in hand (you want your buffed creature in the slot a card-effect targets).
- Reordering gives the player control over those positions.
- Hand-positional targeting makes those positions matter for card design.

None of them work as well in isolation. As a package, they make the hand zone *strategically active* in a way that complements the board's positional play.

**Held as Pass 2 design space.** Implementation requires hand UI work (drag-to-reorder, modifier display, Resolve-retention highlight), and the per-instance modifier system needs careful engineering. But the design space is real and substantial — capturing it now so the rules and UX can be built coherently when the time comes.

## The Run Loop

A run consists of repeated **overworld turns**, each of which is one full beat of the simulation:

1. **Player overworld turn:**
   - The player chooses an adjacent node to advance toward, triggering an **encounter** built from that node and any other adjacent nodes the simulation pulls in. Every move triggers an encounter — there is no separate "neutral movement" path. Per-location, the encounter may be hostile (AI present), neutral (a pre-authored puzzle waits at the location), empty (nothing happens there), or any combination across locations. The player does not know in advance which is which — locations are face-down to the overworld view until the encounter resolves them.

2. **AI overworld turn:**
   - The AI takes one mini-turn at *each node it controls*. A mini-turn means: draw, play cards face-down on adjacent nodes (including playing resource-cards, structures, creatures), end. Nodes nearer the exit have had more mini-turns of build-up than nodes far from the exit.
   - The AI's deck is finite. As it commits permanents to the map, its hand thins. As the player destroys those permanents, capacity returns to the AI for reinforcements during contested encounters.
   - **The AI's act of playing into a node consumes that node's neutral encounter** — see *Encounters: unified hostile/neutral framework* for the rule. The AI is racing the player to claim or deny neutral rewards.

3. The cycle repeats until either the player reaches and defeats the boss, or the player's Durability reaches 0.

### Run starts: biome-flavored starter pools

A run begins with the player choosing a starting node from a small set of options (working assumption: 3 randomly-presented choices), each tagged with a **biome** that signals a color leaning. The chosen biome grants the player the corresponding color's **starter pool** as their initial deck. Reward acquisition during the run drifts the deck wherever the run goes.

#### Two pools, separately designed

The card pool splits cleanly into two populations:

- **Starter pool.** Small set (~5-7 cards × 5 colors = ~25-35 cards total). Designed weak, simple, on-flavor, no themed-stat printing. Never appears in rewards.
- **Reward pool.** The full design vocabulary — Spark, Counterspell, Provocation, Salvage, vehicles, Forge, healing, Pray-N, curses, recursion, Heralding Spark, etc. Acquired during the run via neutral encounter rewards. Never appears in starting decks.

These are separate design surfaces. Starter design is mostly a tuning exercise (weak, careful); reward design is mostly a creative exercise (full vocabulary, real flavor).

#### Universal starter shape: Force/Tempo only

**Every starter prints Force (mostly) and Tempo (some). No starter prints Insight, Resolve, or Spite.** Per the existing stat doctrine, Force and Tempo are the *silver and gold of the universal economy* — every deck needs them to function. Insight, Resolve, and Spite are scarce, themed, high-impact stats; they belong to the reward pool because acquiring them *is* the act of acquiring color identity.

Consequence: **every starter is combat-shaped.** Regardless of which color the player chose, their opening encounters are about attacking and blocking. Spell economies, healing, recursion, and persistence emerge later via rewards. Color identity is a *promise* the starter makes, not a starting capability.

A starter typically contains:

- **Recruit-class creatures** — free, low Force, ~2 Durability, simple. Body-printers that bootstrap the location's economy.
- **Stat-gated ramp creatures** — mid-cost (≥1 or ≥2 Force here), better stats. Teach cost-as-presence; gated by free-cost recruits already in play.
- *(Possibly)* a small starter action — buff or block. **No damage actions in starters** (direct damage is reward-tier; even 1 damage bypasses combat geometry and commodifies a key Blue mechanic).

#### Per-color starter flavor: small effect, exposes one mechanic

Per-color starter variation is **not stat splashes** — it's **one small thematic effect per card** that previews a mechanic the player will see expanded in rewards. The effect must:

- **Not print Insight, Resolve, or Spite.** Themed-stat printing is reward-tier.
- **Be small and easy to understand.** One mechanic per card, never stacked. This is the tutorial difficulty layer — the player learns the design's vocabulary through tiny low-stakes examples.
- **Express the color thematically** without giving the player the color's *economy* yet.

Confirmed flavor effects per color (working draft for session 2 card design):

- **Red** — "+X Force when alone here." Conditional stat printing seed (the lone-champion DNA). Teaches that Red rewards intensity over coordination.
- **Green** — small movement keyword + "on flip-up: deal 1 damage to an enemy in the back row." Teaches movement as Green's identity *and* gives the player limited back-row interaction (Green's signature — reaching what the front row protects).
- **White** — healing/restoration with **positional targeting** (a friendly creature next-to-or-in-front-of this). Teaches both restoration as White's flavor *and* positional-targeting vocabulary.
- **Black** — "on flip-up: afflict -1 Force on an enemy in the front row here." Teaches debuff-on-position as Black's intrusive disruption identity.
- **Blue** — "on flip-up: draw 1" creature, *or* a starter Blue action with "draw 1." Mostly underwhelming on creatures (drawn cards typically discard at cleanup unless they're actions), but catches actions when it does — and Blue is the action color. Teaches **deck-cycling as Blue's economy identity**: Blue thins its deck faster and sees its key cards more often.

The pattern across the five: **each starter flavor effect doubles as keyword exposure.** By the time the player has played 2-3 encounters with their starter, they've been exposed to 4-5 distinct mechanic-classes (conditional stat printing, movement + back-row interaction, positional targeting, debuff-on-position, deck-cycling) through small, low-stakes examples that establish the vocabulary they'll see flexed in rewards.

#### Red as the tutorial color

Red is **combat undiluted** — the cleanest expression of the core combat loop. The other colors are combat + a small flavor seed. Players who pick Red are learning the cleanest version of the game with the fewest concepts on the table; players who pick other colors are previewing the direction they'll grow into.

This isn't an *easy mode* / *hard mode* split — every color's starter is balanced for the same difficulty curve. It's a *concept density* split: Red teaches by reduction (only one thing to think about: combat); other colors teach by addition (combat + one extra flavor concept).

#### Starter-to-reward ratio is a balance lever

As the player adds reward cards, the ratio shifts. A 10-card starter deck with 1 reward card means the reward shows up 1/10th of draws; with 5 rewards, it's 5/15ths (~33%). This naturally tunes how much each individual reward "matters" as the run progresses. Early-run, each reward is rare and impactful. Mid-run, the deck is reward-heavy and color-flavored. Late-run, the starter pool is nearly drowned out and the deck plays its acquired identity.

**Implications for design:**

- The starter pool size is set with this ratio in mind. ~5-7 starter cards per color is the working assumption; tunable.
- Rewards must feel *better* than starter cards to be visibly impactful when added. The "weak, simple, on-flavor" rule for starters serves this — a reward Mage feels meaningfully different from a starter Apprentice.
- Reward cards aren't required to be more *powerful* than starters in raw stats; they're required to introduce *new mechanics* that starters don't have. A reward Acolyte that prints +1 Resolve and enables Pray-actions is mechanically richer than a starter Initiate, even if their printed stats are similar.

#### Starter pool is the next card-design session

The first dedicated card design session covers the starter pool — all five colors, ~25-35 cards total. This is mostly a *tuning* exercise (weak, simple, one mechanic per card) with the per-color flavor effects above as anchors. After starters are designed, subsequent sessions take colors one at a time and design each color's reward pool, where the full mechanic vocabulary unlocks.

### Encounter resolution (high-level)

When the player triggers an encounter:

- The battlefield consists of one location per adjacent node (could be 1–N locations).
- Each location may have **AI cards** (placed during overworld turns), **neutral encounter cards** (pre-authored puzzles that survived AI consumption), or **nothing** — face-down to the player at encounter start.
- Both sides play the standard card-game phase sequence (upkeep / draw / main / combat / cleanup) until the player has cleared all contested nodes of enemy threats and engaged with neutrals as desired, or the player loses.
- **Universal flip-up at end of round 1 upkeep** reveals all face-down cards at all locations — AI commits, neutral cards, the works. The player sees the full shape of the encounter for the first time, then commits in round 1 main.
- **Win condition (encounter):** clear all contested adjacent nodes of enemies. Neutral encounters do not need to be "won" — the player engages with them only if they want the reward, at the cost of committing resources to that location.
- **Loss condition (run):** player Durability reaches 0.

For the full unified-encounter framework — including how neutral encounters work as on-board puzzles and how AI presence interacts with neutrals — see *Encounters: unified hostile/neutral framework* below.

A more detailed turn structure (phases, the play queue, combat resolution, slot grids, stats) is deferred to **Pass 2**.

### Phase boundary timings — trigger reference

Every phase boundary is a potential trigger timing. Cards may print "at start of X" or "at end of X" for any X in the phase model. This section names every boundary explicitly so card text has a complete vocabulary to reference.

The phases of a round, in order:

1. **Upkeep** — passive triggers fire, recurring effects tick, ammo regenerates if applicable.
2. **Draw** — both sides draw to hand limits.
3. **Main** — both sides commit cards face-down to slots simultaneously. Recon sub-phase fires here for privileged sides if applicable.
4. **Reveal** — face-down commits flip up in Tempo order.
5. **Combat** — combat-declaration (movement chooses blocks and attackers; attack commits resolved) → combat-resolution (damage applied, deaths processed).
6. **Cleanup** — full-hand discard, end-of-turn payoffs.

The named boundary timings, and the kinds of effects that naturally fire at each:

- **Start of upkeep** — recurring upkeep effects. Drains, buffs from supply lines, ammo regen, structure pulses, "at the dawn of each turn" effects. Most "every turn" persistent effects fire here.
- **End of upkeep** — universal flip-up moment for stealthed cards (including the round-1 encounter-arrival reveal). Last-call timing for triggers that need to land before main begins.
- **Start of main** — pre-commit triggers (rare; mostly an analytical anchor). Primarily a rules-clarity boundary rather than a heavily-printed trigger window.
- **End of main** — commit window closes. **Recon sub-phase** fires here for privileged sides; post-commit-but-pre-reveal effects.
- **Start of reveal** — rarely a useful printed timing on its own (flip-up effects fire as part of reveal, not before it).
- **End of reveal** — all flip-ups have resolved. Useful for triggers that need to read the post-reveal board state but fire before combat (e.g., a structure that buffs a creature based on what just flipped up).
- **Start of combat** — pre-declaration triggers. **Coward** fires here. Other start-of-combat possibilities: structures that briefly grant defensive buffs, divine shields that activate, last-second positioning effects.
- **End of combat declaration** — movement is committed; blockers and attackers are now chosen and visible. Movement during combat *is* the means of choosing blocks and attackers — moving a creature into the front row makes it an attacker/blocker; moving one to the back row removes it from combat. Triggers that need to read the committed combat picture (which creatures attack which, which are blocking, which are sitting out) fire here, before damage resolution.
- **End of combat resolution** — damage applied, creatures at 0 Durability go to graveyard. **Deathwish** fires here. Post-damage triggers: cleanup-after-damage effects, "if a creature died this turn" triggers.
- **Start of cleanup** — discard-modifying effects (Resolve retention, last-ditch saves, hand-positional shifting). The final moment before end-of-turn discard fires.
- **End of cleanup** — end-of-turn payoffs. **Cleanup-conditional triggers** fire here (e.g., "if you played exactly 1 card here this turn, gain X"). Symmetric "round closes" effects.

Two design notes about this vocabulary:

1. **Some timings are specifically *for one mechanic class* and aren't broadly useful.** "Start of combat" exists almost entirely for Coward right now. That's fine — naming the timing leaves the design space open for future cards to use it.
2. **Most cards print their triggers at obvious timings** (start of upkeep, on flip-up, end of cleanup). The rare-timing windows (start of main, end of reveal) become useful only when a specific design need arises — they exist for completeness, not because most cards will reference them.

This list is the **trigger vocabulary** for the rest of the doc. When a mechanic specifies "fires at end of cleanup" or "fires at start of combat," it's pointing to one of these named boundaries.

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
- **Ammo distribution within a side** when multiple ranged creatures share a pool: fastest-Tempo fires first and consumes; slower archers may end up dry that turn.

**Two flavors of ranged combatant:**

- **Printed-ranged creatures** (e.g., a rock slinger): the creature prints its own ranged attack pattern and uses its Force as damage. Buffable by Tactics — a buffed rock slinger throws harder rocks.
- **Equipment-armed creatures** (e.g., an archer with a bow): equipment prints the ranged pattern and **sets the wielder's ranged power explicitly**, overriding the creature's own Force. The bow IS the attack. (See *Equipment-sets-power* under Equipment.) Tactics buffs to the wielder's Force don't change the bow's printed damage.

**Color attribution (working):**

- **Green**: signature ranged. Archery, slinging — fits Green's *speed and precision* identity. Tempo-fast archers fire first when multiple ranged creatures share an ammo pool.
- **Red**: brute ranged. Catapults, throwers, big rocks — fits Red's *now-color* impulse and high-Force creature shape. Red's printed-ranged creatures scale on Force-buffs.
- **Black**: probably not native ranged (engagement is its weapon). Black instead gets *anti-ranged* effects — destroy ammo stockpiles, force engagement, neutralize back-row threats by reaching them.
- **Blue**: stays in spell-damage lane.
- **White**: probably no native ranged.

### Tempo ordering and combat sequence (high-level)

Within a phase, the order in which creatures act (revealing, attacking, triggering) and actions resolve is determined by a deterministic four-level hierarchy. **No randomness** at this layer — random selection only enters at effect-resolution targeting (Pillar 10), not at combat ordering.

1. **Tempo descending.** Higher Tempo always acts first. Negative Tempo is a legal printing (e.g., Black curses with "creatures here have Tempo -1") — it pushes a creature behind Tempo-0 baseline.
2. **Within a Tempo tier: per location, in battlefield order** (left-to-right across rendered locations). One location's qualifying creatures resolve fully before the next location's begin.
3. **Within a location, within a Tempo tier: by position.** Front-to-back, left-to-right within each side's grid.
4. **Side priority** — when both sides have qualifying creatures within the same location and Tempo tier, the side with the **higher local Tempo total** (summed across permanents and terrain at that location) resolves first. If local Tempo totals are tied, **priority alternates per overworld turn**: whichever side did not have priority last turn gets it this turn.

For action slots specifically, slot order tiebreaks Tempo ties (slot 1 reveals before slot 2 within the same Tempo tier). The shift-up behavior of the action queue (see *Action slots are a queue*) means slot 1 is always packed first.

Implications:

- **Most encounters with low Tempo investment are still fully deterministic.** With both sides at all-Tempo-0, side priority is decided by local Tempo total (likely both 0) → alternating-by-turn → spatial order. Players can plan precisely.
- **Green doubly rewards investment.** Tempo printed on a creature wins individual initiative; Tempo accumulated locally swings side priority within a tier.
- **The variable-adjacency battlefield UI is mechanically anchored.** "Left-to-right" needs a chosen order of rendered locations. The order is no longer just visual — it determines combat sequence.
- **Sometimes going first is a disadvantage.** Combat sequence is asymmetric per turn, so the player can't always rely on early or late strikes — alternating priority makes the same plan play differently across turns.

### Damage fall-through (universal rule)

**Damage targets only Durability.** Only creatures and summoners have Durability — structures do not (they are destroyed by structure-removal effects, not by damage). So damage resolves against creatures-or-summoners, full stop. Card text never needs to specify *what kind of thing* the damage hits — the damage system handles it.

**The rule: damage looks for a creature at the location it's resolving at; if no valid creature is there, the damage falls through to the opposing summoner.** This is a *universal damage-resolution rule* that applies the same way regardless of source — combat damage from an attacker, spell damage from an action, deathwish damage, all of it.

This unifies what were two parallel systems in earlier doc passes (combat-attackers-fall-through-to-summoner *vs.* spell-with-no-target-fizzles). Both now follow one rule. Cards never need to print "to the summoner" as a special clause — it's implicit in the resolution model. Card text just says "deal X damage [scope]" and the system resolves it.

**Specifics:**

- **Single-target damage.** *"Deal X damage here"* with no creatures present → X damage to the opposing summoner. With creatures present, a random pick from face-up creatures (per Pillar 10).
- **Multi-target damage ("deal X to each").** *"Deal X damage to each enemy creature here"* with no creatures present → X damage to the opposing summoner *once* (not "X damage per nonexistent creature"). One fall-through instance per location, regardless of how many phantom targets the multi-target text would have hit.
- **Scope-extended damage.** Per-location resolution of the fall-through. *"Deal 1 damage at each of your locations"* (Heralding Spark) resolves at each location independently. Locations with creatures → random pick at that location. Locations with no creatures → 1 damage to the opposing summoner from that location. **A scope-effect on an empty board hits the summoner once *per empty location*.**
- **Combat damage from creatures** continues to follow this rule unchanged: an attacker with no creature in front (and no back-row blocker per row rules) swings through to the summoner. The rule is the same for spells; the consistency is what's new in the framing.
- **Effects that aren't damage do *not* fall through.** Buffs, debuffs, stat-reductions, destroys, returns-to-hand, etc. with no valid target simply *fizzle*. The summoner has no stats to buff/debuff and isn't a creature to destroy. The fall-through rule is **damage-specific**, not a general "if no target, hit summoner" rule.

**Card-text language:**

- Always: *"Deal X damage [scope]."* The damage system resolves what it hits.
- Never: *"Deal X damage to a random enemy creature here."* Adding "creature" is redundant — damage already only hits creatures-or-summoners by definition. Adding "to the summoner" as a clause is also redundant — that's the fall-through behavior. Both clutter the text without adding meaning.
- Exception: when a card *explicitly excludes* one of the two valid targets, it should say so. *"Deal X damage to a creature here (does not affect summoner)"* would be a printed restriction. These should be rare; the default fall-through is the standard behavior.

**Why this matters:**

- **Spell decks become real win conditions.** A player who runs out of creatures but still generates Insight (via remaining Mages, structures, persistent effects) can spell-down the opposing summoner without any creatures on the board. The "I'm out of creatures" moment isn't necessarily a loss — it's a transition to a different game shape.
- **Creatures *block* spell damage at their location.** If even one valid creature target is present, the spell hits a creature. The summoner is the *fallback target*. **Creatures defending a location protect their summoner from spell damage *and* combat damage**, both via the same conceptual mechanism.
- **Cleared-board pressure becomes the natural late-encounter shape.** As one side's creatures die out, both combat damage and spell damage start landing on the summoner instead of bouncing off creatures. The damage-flow accelerates exactly when the losing side most needs reinforcements.
- **Card design simplifies.** No card needs to print "if no creatures here, deal damage to the opposing summoner" as flavor text — that's the default behavior. Cards print *what they target*; the fall-through is a rules consequence.

**Open questions for Pass 2:**

- **AOE caps?** "Deal 5 damage to each enemy creature here" with empty board → 5 to summoner per the rule. Could that ever be too strong? Probably not at this card-count scale, but worth noting if a high-damage AOE ever feels ridiculous when board is clear.
- **Friendly-fire fall-through.** "Deal X damage to each creature here" (Red cleave-style with no friend/foe distinction) on an empty board → does it fall through to *both* summoners? Or does friendly-fire damage fizzle on empty? Probably **falls through to both** — the friend-or-foe distinction is in the *target selection*, not in the fall-through rule. Cleave on empty becomes a high-risk both-sides-take-damage spike. Worth playtesting before locking.
- **Heal effects on the summoner.** A symmetric question: "heal X durability to a friendly creature here" with no friendly creatures — does it fall through to the friendly summoner? Probably **yes**, by parity with damage. Healing-fall-through is a useful design lever for White.

## Fog of War & Reveal

Fog of war does real mechanical work here, not just flavor. The whole system is built on **one rule for face-down cards**, applied consistently across in-encounter stealth, just-committed cards, and the encounter-start fog reveal.

### The unified face-down rule

A face-down card on the battlefield is **inert**:

- **No stat presence.** It does not contribute to the local per-side stat line for any stat it prints.
- **No combat participation.** It cannot attack, cannot be attacked, cannot block.
- **Not a legal target.** Effects that pick a card here skip face-down cards. If the only candidate is face-down, the effect fizzles or selects from the remaining face-up pool.
- **Triggers do not fire.** Whatever flip-up or always-on text the card prints is dormant while it is face-down.
- **It still occupies the slot.** A face-down card is in its slot for purposes of slot scarcity. You can't play another card into that slot.

A face-down card flips face-up at the **end of the current phase** in Tempo order (with the four-level ordering hierarchy resolving ties). On flip-up, the card enters the board fully: its stats join the local total, its combat participation begins from the next combat opportunity, and any *flip-up* triggers it prints fire at that moment.

There is no "cards stay face-down across phases" path under normal play. Whatever phase a card finds itself face-down in is the phase it flips up in.

### Stealth (mid-encounter face-down)

**Stealth** is a keyword that returns a face-up card *already in play* to face-down for the rest of the current phase. While stealthed, the card obeys the unified face-down rule above: it stops contributing stats, drops out of combat, becomes untargetable, and its ongoing or trigger-based abilities go dormant. At end of phase, it flips face-up again (subject to the Tempo-spent principle below).

Mechanical uses of stealth:

- **Defensive escape.** Stealth a friendly creature mid-combat to remove it from harm's way for that phase. The trade-off is that a stealthed friendly can't block either — the rest of the line is more exposed.
- **Offensive disruption.** Stealth an enemy creature to blank its attack and to drop the enemy's local stat presence by what it was contributing — potentially enough to fizzle one of their action costs that round.
- **Re-trigger flip-up effects.** Stealth a creature with a strong flip-up effect, then it flips up again at end of phase, firing the effect a second time. This is Green's primary offensive use of the primitive.

Because stealth removes stat presence (not just combat presence), it *can* fizzle queued action costs that depended on the stealthed card's stat contribution. This is a deliberate change from earlier-pass thinking: stealth is now both an economic and a combat disruption tool. The trade-off — only one side's slot occupancy is affected, and only for one phase — keeps the cost contained.

Stealth's color homes are **Green** (predator stillness, vanish-and-reappear) and **Blue** (illusion, misdirection); **Black** is plausible for a "lurk" variant. **Red** and **White** do not stealth — Red presses forward, White stands fast. (See *Color Identities* for full per-color flavor.)

### Encounter-start fog reveal — same rule, different trigger

Fog-of-war on the overworld is unified with stealth via one design move: **all enemy cards at an encounter location gain stealth as the player arrives.** This is a universal rule, not a card effect.

The mechanical sequence at encounter start:

1. The player's pawn moves into a location adjacent to enemy presence (or onto the location itself, depending on the overworld rule for triggering encounters).
2. **At the moment of arrival, every enemy card present at the encounter's locations gains stealth.** They become inert in the unified-face-down sense: no stat presence, no combat, not targetable, no triggers.
3. The encounter begins. **Round 1 upkeep** runs. At end of upkeep — the first phase boundary inside the encounter — the universal stealth flips up. The player sees the enemy's full committed state for the first time.
4. From there, the encounter proceeds normally: round 1 main phase, both sides commit, reveal, combat, cleanup.

This gives the player **one phase of suspense per encounter** (upkeep) before the AI's commitments are revealed. It is a small and consistent moment of tension that doesn't require any special "fog-of-war reveal" rule machinery — the same flip-up-at-end-of-current-phase rule that handles mid-encounter stealth handles encounter-start reveal.

**Some clarifications about how the AI's pre-encounter state interacts with this rule:**

- **AI cards on uncontested overworld nodes are face-up game state.** They contribute their stats, accumulate upkeep buffs, and run their flip-up and ongoing triggers normally — they're real cards in real play, not in any special bookkeeping mode. Fog of war is **purely a UI/presentation layer** that hides those face-up cards from the player.
- **At the moment the player's pawn arrives at an encounter** (the instant before the UI transitions from overworld view to encounter view), the universal stealth rule applies and all those AI cards flip face-down. The unified face-down rule applies: inert, no stats, no combat, no triggers, not targetable.
- **At end of round 1 upkeep**, those stealthed AI cards flip up in Tempo order. **Flip-up triggers fire again** at this moment — that's just what flip-up means. They already fired the *first* time when the AI originally placed each card on the overworld, but flip-up is not a "fires once" event; it fires every time a card transitions from face-down to face-up.
- **What round-1 flip-ups actually do depends on the trigger's target, not on its keyword.** It's not "everything fizzles" or "everything lands." It's per-card:
  - **Self-target / friendly-target flip-ups land fully** — buffs, healing, "this gains +1 Force," "a friendly creature here gains +1 Durability" — because the target (self, friendly creature here) is present.
  - **Token-generation, environmental, and summoner-targeting flip-ups land fully** — the token spawns, the local stat-floor adjusts, the player's summoner takes damage.
  - **Outward-board-targeting flip-ups (random enemy, an enemy creature here) fizzle** because the player has nothing committed yet on round 1.
- **The implication:** the AI's flip-up triggers come in two flavors that play very differently on encounter arrival. *Self/friendly-amplifying* flip-ups are perfect for the boss node — the AI compounds them across many overworld turns, then on encounter arrival they all fire again, stacking buffs. *Outward-aggressive* flip-ups are designed to land mid-encounter via stealth re-trigger, not on round 1; their threat is in the recurring fire, not the initial reveal. Round 1 is a window where the AI's *defensive and self-amplifying* threats land hard, and its outward attacks largely whiff — but a lot depends on what specifically the AI deck has printed and where it placed those cards.

### Reveal triggers

There is exactly one trigger keyword for board entry / reveal events: **flip-up**. It fires every time a card transitions from face-down to face-up. This includes:

- The first flip-up at end of phase after the card was committed face-down.
- Any re-flip after a mid-encounter stealth ends at end of phase.
- The universal flip at end of round 1 upkeep, when AI cards stealthed by the encounter-start arrival rule flip up to the player's view.

There is **no separate "on-enter" trigger** that fires on slot entry but not on later re-flips. Every entry to the board passes through a face-down phase first — even cards generated as tokens enter face-up only because their generator handled the flip already. The only event we trigger on is flip-up.

This is by design. Unifying everything to flip-up:

- **One rule, one timing, one event model.** No splitting of "fires once" vs "fires repeatedly" semantics — every flip-up trigger fires every time, and card design / cost balances accordingly.
- **Stealth's primary mechanical job is automatic.** Stealth flips a card face-down; the next flip-up is just another flip-up. No special "re-trigger" rule.
- **AI cards on the overworld get their flip-up triggers fired *twice*** by default — once when originally placed (during AI overworld turn), once on encounter-start reveal. Plus any further mid-encounter stealth re-flips.

A future **perception** stat is intended as the dial for partial info: cards or effects that let the player peek at face-down cards in the play queue. (See Open Questions.)

### Stealth and re-flip combo space

Stealth's most distinctive use is as a re-trigger primitive on flip-up effects. Examples Green can print:

- *"On flip-up: deal 1 damage to a random enemy here."* Combined with a stealth effect, this card pings twice in a single phase.
- *"On flip-up: a friendly creature here gains +1 Force until end of turn."* Stealth then re-flip stacks the buff (subject to the keyword-doesn't-stack rule for boolean grants — see below).

Whether Green's end-of-phase re-flip resolution is **iterative** (any face-down card after flip-up triggers fire keeps flipping until none remain) or **atomic** (a single re-flip pass, no further iteration) is left as an Open Question — the combo space is exciting but balance-sensitive.

### Tempo-spent principle

A creature that has already used its Tempo initiative this turn — by acting in Tempo order during combat or by revealing in Tempo order at end of a phase — does *not* reclaim that initiative on a re-flip. Stealth-driven re-reveals drop to the back of the Tempo order. The principle: **a creature's initiative is spent once per turn**, and stealth does not refund it.

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

The boss mirrors the player: a summoner with Durability, not a creature on the battlefield. The player takes damage from unblocked combat damage; so does the boss. To defeat the boss, the player must reach the exit-node encounter and deal enough unblocked combat damage through the boss's defenders to reduce its Durability to 0 — the same way the boss wins by reducing the player's Durability to 0. There is no special "boss system" — the win condition uses the same combat damage mechanics that govern every encounter. Boss-specific mechanics (special phases, unique cards, scripted behaviors at the exit-node encounter) are deferred to **Pass 2**.

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

### Color themes (working keyword reference)

Each color has a one-word identity, a thematic keyword cluster (settings, archetypes, attitudes), a signature character that should feel native to its cards, and a structural *gotcha* (the limitation that gives the color its tension):

| Color | Stat | One-word identity | Themes | Signature character | Gotcha |
|---|---|---|---|---|---|
| **Red** | Force | **FORCE** | mountains, caves, grottos, pits, goblins, orcs, trolls, ogres, bullies, cowards, infighting, friendly fire, disorganization | the *anti-faction* — selfish individuals who don't trust each other, succeed only through brute force, often hurt their own side | crowding *kills* Red's bonuses; Red wins solo and loses in groups |
| **Green** | Tempo | **TEMPO** | desert, rebels, guerillas, hit and run, improvisation, Fremen, spies, deception, infiltration, subversion | the *side that refuses to be where the opponent expects* — fast, hidden, repositioning, never engaging head-on | fragile in pitched battle; loses in attrition; only wins through misdirection |
| **Blue** | Insight | **INSIGHT** | sea, meditation, magic, mentalist, scholars, studying, education, hubris | the *brittle mage* — confident in their power, neglectful of their own defense, dependent on weak creatures supporting strong spells | the mage's hubris is what makes them fragile; one combat hit on the Mage shuts down the strategy |
| **White** | Resolve | **RESOLVE** | towns, civilization, clergy, holding on, believing, patience, passivity (with civic flavor accessible through structures: cathedrals, halls, temples) | the *faithful intervener* — channels belief into miracles, patches the seams of allies' vulnerabilities, restores what was lost | slow to act; everything is delayed-cost; pure-White cannot generate pressure |
| **Black** | Spite | **SPITE** | tundras, snow, barren, revenge, thorns, retaliation, undead, skeletons, warlocks, pacts, sacrifice, treason, traitors | the *grudge that doesn't end* — wronged in the past, persistent in revenge, returning from graveyard, making pacts to extend reach | slow, transactional, requires the opponent to engage; ignored, Black can't reach you |

### Why these themes matter for design

The keyword themes shape card-design instincts:

- **Red's "infighting"** justifies why Red printed numbers go down when other Red creatures arrive at the same location. It's a flavor anchor for the lone-champion mechanics, friendly-fire cleave, Battle Driver damaging its own ally.
- **Green's "infiltration"** justifies why stealth re-flip is so central. Green doesn't just move; it *vanishes and reappears*. Cards that re-stealth, that move at unexpected times, that act before the opponent can react — all flow from "you didn't see this coming."
- **Blue's "hubris"** justifies the brittle-mage cost shape. The mage *should* be a target — they're confident and exposed. The flavor explains the mechanic; the mechanic isn't a balance arbitrary.
- **White's "holding on"** justifies persistent channeling, healing, structure-rebuilding. White doesn't *act*; it *endures and restores*.
- **Black's "spite" and "treason"** justifies stealswap (you bought their loyalty), cursing (long-term grudge from afar), and graveyard recursion (the dead don't stay dead). Black is mechanically *active* through *vengeance*, not through aggression.

These keyword anchors are intentionally evocative rather than rigorous. When a card's mechanics and flavor agree, the card feels *right*. When they disagree, the card feels arbitrary. The themes give us a fast check: does this card text fit the color's keyword cluster? If not, either the card belongs in a different color, or it needs reflavoring.

### One distinction worth making explicit

For White: the keyword cluster mixes *religious* themes (clergy, belief, patience) with *civic* themes (towns, civilization). Both fit White's character, but they're mechanically distinct:

- **Religious-White** does *channeling* — Prayer, miracles, intervention from outside. Trust-based. Ineffable.
- **Civic-White** does *enforcement* — taxation, rule-text-modifying, authority bonuses. Process-based. Predictable.

The color's *core* is religious-White (Prayer is its signature mechanic; Resolve is its stat; intervention is its win path). Civic-White flavor is accessible through specific structures (Cathedrals, Halls of Justice, Town Watches) and specific Pray-N effects, but it's not the color's center. Trying to make White be both equally would dilute. Religious-leaning, civic-flavored.

### Red — Force — the *now* color

- **Identity:** Red is the color of immediate, local, intense pressure. Red does not invest in the long game; every Red play is for the encounter at hand.
- **Creatures:** high Force, often with **conditional bonuses keyed off board state**. The signature pattern: "+X Force while alone at this location." A lone Red champion is a tower of stats; the moment another creature arrives, the bonus collapses. **Brute ranged archetype**: catapults, throwers, big-rock-flingers — printed-ranged back-row creatures that use Force as ranged damage and scale on Tactics buffs (a buffed thrower throws harder).
- **Actions (Tactics, placeholder name):** combat-buffs and impulse effects. Red actions resolve immediately or by end-of-turn / end-of-phase, never across turns. Red has no signature persistent-action archetype. Red actions do not deal damage themselves; they amplify creatures already on the board. Includes **Charge**-style activation actions (off-cycle melee bonus attacks) and brute Volley variants.
- **Structures:** "here"-scoped only. They occupy a structure slot and persist on the map normally, but their text contributes nothing to supply lines or other locations.
- **Equipment:** Red weapons modify creature attack patterns. Equipment is especially load-bearing for Red because the lone-champion shape hits slot-cap early.
- **Attack patterns:** Red gets multi-target / AOE patterns and same-side-hitting (cleave) patterns — these are both the anti-wide answer *and* the friendly-fire mechanism.
- **Win path:** combat damage to summoner Durability, dealt by Force creatures, spiked by conditional-bonus printing and amplified by Red Tactics.

**Structural weakness — answered.** Red has no persistent actions, no wide presence, and no supply-line scaling. Friendly-fire damages splashed allies, so Red can't easily fix these weaknesses by splashing — protective creatures from other colors get killed by the splasher's own attack patterns. **Red is locked into purer tempo strategies by mechanics, not by rules.** The trade-off is that Red gets *conditional stat printing as a tempo lever* and intense local impulse effects.

#### Conditional stat printing (new mechanic class)

Red opens a design space where a card's stat printings depend on board state. "+5 Force while alone at this location" is the canonical example: while the condition holds, the conditional stat counts as real Red presence — paying costs, contributing to combat, satisfying comparative inequalities. The moment the condition breaks, the conditional stats vanish and the location's Red presence collapses.

This is a *temporary local resource spike* — distinct from Blue/White's *residual global persistent* effects (hand size, draw count). Red's bonuses are local, intense, and effectively spent the moment the condition collapses.

The cleave self-cleaning behavior is the recovery mechanism: a lone Red champion with a cleave attack pattern periodically clears your own board, restoring the alone-condition.

#### Provocation / Challenger — buff yourself by buffing the enemy

A Red sub-mechanic within conditional stat printing: cards that **scale on enemy presence and *also* hand the enemy a smaller buff in the process.** The flavor: the *Challenger*, the *Berserker*, the *Pit-Fighter* — Red creatures who don't care about coordination, who get stronger as opposition grows, who actively *want* a real fight.

Working keyword: **Challenge** (or *Provocation*). Canonical reading: *"Enemies here gain +1 Force. This creature gains Force equal to the number of enemy creatures here."* The card hands the opponent a small symmetric buff and gains a much larger asymmetric buff for itself, so the math favors Red — but the opponent still gets *something*, and the Red creature is fragile (high Force, low Durability) so the buff-for-stats can collapse if the enemies kill it before its Force scales.

**Why this is on-flavor for Red:**

- It expresses *anti-faction* identity at the card level — a Red Challenger doesn't *care* about helping their allies; their personal glory is the only thing that matters. Why *would* they help their teammates? They want a fight.
- The mechanic is *self-buff-by-buffing-others* — a perfect mechanical expression of "Red rewards intensity over coordination."
- It punishes the enemy for going wide (more creatures = more Red Challenger Force), but rewards them for it too (their stats are up). Internal tension within the Red side and within the encounter.

**Anti-synergy with other Red mechanics:**

- A Red Challenger eats some friendly fire from cleave attackers (cleave hits Red's own creatures, including Challengers).
- Worse: the *enemy* +1 Force buff makes enemy retaliation harder, so cleave attackers eat tougher hits when fighting near a Challenger.
- So a Challenger and a Cleaver are *anti-synergistic in Red* — the player has to choose which Red shape they're committing to. This is on-flavor: Red's internal anti-coordination is so strong that even Red sub-mechanics fight each other.

**Other Provocation flavors as Red prints them:**

- *"Enemies here gain +1 Tempo. This gains Tempo equal to the number of enemy creatures here."* — agile Challenger.
- *"On flip-up: each enemy creature here gains +1 Force. Then this attacks each enemy creature here with the same total Force."* — one big crash; the more enemies, the bigger the swing, but they all hit harder back.
- *"Enemies here have +1 Durability. This has +1 Force for each enemy creature here at start of combat."* — the Champion who *grows the opposition* by sheer presence, then crushes them harder.

**Sub-mechanic within conditional stat printing.** Provocation is a *specific shape* of conditional stat printing that adds a *symmetric enemy buff* clause. Existing Red conditionals (lone-champion, alone-rewards) are passive; Provocation conditionals are *interventional* — they actively change the enemy's stats too, then scale on that change.

#### Exclusionary keyword family: Inert / Brute / Intellect / Pacifist

A small family of mutually-exclusive printed keywords that lock a card to gaining only one specific stat. Used as both a *flavor anchor* (this card is *only* a wall, *only* a brute, *only* a scholar, *only* a healer) and a *balance lever* (cheap utility cards can print these to prevent splash buffs from weaponizing them off-color).

| Keyword | Can only gain | Flavor | Example card concepts |
|---|---|---|---|
| **Inert** | Spite | Walls, parked vehicles, sandbags, fortifications. Doesn't fight, doesn't think, doesn't believe. Sits and soaks; can grow defensive retaliation but nothing else. | Sandbag (existing), unmanned Battering Ram, Bulwark, Trench |
| **Brute** | Force | Mindless aggressors. Fights, but can't be made smarter, faster, or more pious. | Goblin Pyromaniac, ogre, troll, raised zombies (see below) |
| **Intellect** | Insight | Pure scholars / arcane constructs. Won't fight, isn't pious, isn't athletic. | Mage, scrying construct, lorekeeper |
| **Pacifist** | Resolve | Civilian healers, monks, refugees. Patient and faithful but won't take up arms. | Acolyte, Initiate, Healer |

**Mutually exclusive.** A card prints at most one family keyword. A multi-color creature that prints both Force and Insight, for example, is *not* a candidate for either Brute or Intellect — it can grow either of its native stats normally and the keywords don't apply. The family is for *single-stat-locked* identity cards.

**No Tempo version.** Tempo doesn't isolate a flavor the other four do — there's no creature concept that *only* moves fast and has no other identity. Skirmishers and Scouts are Force+Tempo creatures, not Tempo-only; they can grow either stat normally without a keyword. The family is four members, not five.

**Durability is not affected.** None of the family keywords lock a card's Durability. Durability is the physical-durability axis, not the active-capability axis. Inert structures can still be repaired or healed. A Pacifist Acolyte can still gain Durability from a buff. Only the four active stats are touched, and only the one matching the keyword grows.

**The keywords are creature/structure-only.** Actions don't have growable stats in any meaningful sense (they resolve and exit). Equipment may inherit the host's keyword behavior (an Inert wall's attached equipment doesn't grow Force on the wall, etc.) but doesn't print the family keyword itself.

**Inert is the existing keyword reframed.** Earlier in the design, Inert was defined as "cannot gain Force, Tempo, Insight, OR Resolve from any source" — effectively no stat growth at all. The exclusionary-family framing makes Inert symmetric with the other three: each keyword grows *exactly one* stat, and Inert's stat is Spite. This unblocks the design space of **defensive retaliation-flavored obstructions** — thorned walls, spiked sandbags, retaliating fortifications. The previous "no stats grow at all" rule is superseded; see DECISIONS.md.

**Inert-suspending mechanics still apply.** Pilot/Driver/Rider relationships suspend Inert on vehicles for the duration of the bond. The driver's stats flow through; Inert returns when the bond drops. The other three keywords (Brute / Intellect / Pacifist) don't have an established "suspending" mechanic yet — that's open design space. (A *zealot* effect that suspends Pacifist on a friendly creature, animating them to fight? A *trance* effect that suspends Brute on a Brute creature, granting it temporary intellect? Both are speculative; the family doesn't currently print suspensions for the new three keywords.)

**Zombie as a special case of Brute.** Black's raise effect produces a creature that is **a Brute with all printed rules text removed**. A Mage raised as a zombie loses its Intellect keyword, loses its Insight-printing text, gains the Brute keyword, and becomes a Force-only creature. This captures "the dead don't think anymore" mechanically. Three explicit operations: (a) reanimate from graveyard, (b) strip rules text, (c) apply Brute keyword. The raise effect itself is the keyword swap.

**Use as a balance lever.** This is the load-bearing design role. Without these keywords, every cheap utility card has to be balanced against the worst-case splash scenario — a free Acolyte that can be pumped to 4 Force with Red equipment, or a 0-cost Mage that gains Tempo from a Green Maneuver. With the keywords, **the printed identity locks the ceiling**: an Intellect Mage cannot be pumped by Red Tactics; a Pacifist Acolyte cannot gain Force from Salvage; a Brute Goblin Pyromaniac cannot gain Insight from a Blue cost-reducer. **This makes utility cards safe to print cheaply.**

**Why the family matters beyond Inert:** the keyword turns "passive obstruction" / "mindless brute" / "pure scholar" / "civilian healer" into real card-design tools that compose. Any card that wants to be one of these four archetypes prints the keyword and immediately has well-defined behavior: print the relevant stat, occupy the slot, do the obvious thing, and explicitly *not* be weaponizable across colors. Future cards across all five colors can use these keywords without needing custom rules blocks per card.

**Inert-suspending design space (recap).** Pilot is the canonical Inert-suspender — vehicles get their cheap-obstruction status from Inert and their wrecking-ball power from the bond suspending it. Other cards can print their own Inert suspensions (e.g., a White structure that "suspends Inert on adjacent friendly walls" — religious blessing animating the stones). Whether the other three keywords get parallel suspension mechanics is an open question for Pass 2 card design.

#### Vehicles, goblins, and the chaos-pilot synergy (Red's identity anchor)

A **vehicle** is a permanent — printed as a creature or as a creature/structure hybrid — that requires a *driver*: another friendly creature in a specific positional relationship (typically the slot directly behind the vehicle).

**Vehicles use the Inert keyword.** Inert is a member of the exclusionary keyword family (see *Exclusionary keyword family* above) meaning the card cannot gain Force, Tempo, Insight, or Resolve from any source — it can only grow Spite. Its printed Force/Tempo/Insight/Resolve are locked permanently; buffs to those stats don't stick. An Inert vehicle is therefore a passive obstruction — it contributes its printed Durability and Spite, soaks damage, and does nothing offensive or interactive on its own. Walls, sandbag tokens, and other static obstructions also use the Inert keyword; vehicles are one application of it.

**Pilot/Driver/Rider suspends Inert.** When the bond condition is satisfied (a creature in the driver/rider position), Inert is suspended for the duration of the bond. The vehicle gains stats normally, accepts buffs, attacks, and runs its full printed text. Drop the bond → Inert returns. This is the load-bearing mechanism: vehicles get their cheapness from being parked walls, and they get their power from the bond, with no stat-bleed in between.

When a friendly creature occupies the driver position, the vehicle activates:

- The vehicle gains Force equal to the driver's Force (or some printed function thereof).
- The vehicle attacks normally from its slot, using its printed attack pattern (often a wide pattern — cleave, charge, sweep — matching the heavy-impact flavor).
- Some vehicles transfer the driver's other stats (Tempo, Resolve, etc.) for specific purposes; others scale only on Force. Per-card text decides.
- The driver, while driving, is positioned to be attacked or targeted under whatever rules vehicles use for combat geometry (Pass 2 detail — likely the driver becomes shielded by the vehicle in front).

**Driver dies → vehicle parked again.** If the driver dies (or moves out of the bond position), the vehicle is back to default-inert. Same for Green's mounts: rider dies, the mount is now an inert back-row creature with whatever Durability it has left, no special active behavior, occupying its slot until something fills the front-of-it position. This is symmetric: the bond is a *condition* checked continuously, not a one-time activation.

**This is Red's identity anchor.** Red's flavor — chaos, brute force, "throw the goblin in the cockpit and let physics happen" — is mechanically expressed in the vehicle/driver pair. The vehicle alone is a wall (defensive); the vehicle with a driver is a wrecking ball. Red gets to print vehicles cheaply because the activation cost is *another card on the board in a specific position*, which is real tempo investment.

**Goblins as the iconic Red driver.** Goblins are Red's signature creatures: scrappy, individualistic, low-Durability, low-cost, and **mechanically synergistic with vehicles in a way no other color's creatures are.** Two ways this can be expressed in card text:

- A goblin creature can print *piloting* — a passive ability that gives it bonus stats while it occupies a driver position. "While driving a friendly vehicle, this gains +1 Force."
- A vehicle can print conditional bonuses keyed on driver type: "+1 Force while driven by a goblin." This encodes the goblin/vehicle lockup at the *vehicle's* card text, so any vehicle wants a goblin driver but doesn't *require* one.

Both patterns are useful and can coexist. The flavor lockup is the same either way: **goblins are scrapers, scavengers, and pilots — and vehicles need pilots.**

**Salvage (or Scrap): a Red mechanic that buffs vehicles.** Red prints a small ecosystem of vehicle-specific support, paralleling how White prints Pray-buffs for itself. Working name: *Salvage*. Examples:

- **Salvage (action):** "A friendly vehicle here gains +1 Force until end of turn." Cost: ≥1 Force.
- **Salvage Yard (structure):** "While this is in your structure slot, friendly vehicles here have +1 Durability." Cost: ≥2 Force. *Permanent local buff.*
- **Scrap Pile (token-creator action):** "Generate a token Battering Ram at the front-most empty creature slot here." Costs more than a single creature, less than a creature + vehicle separately — token-creator economics apply.
- **Goblin Mechanic (creature):** *"On flip-up: a friendly vehicle here gains +1 Force until end of turn."* A goblin that doubles as a one-shot Salvage trigger when committed.

The mechanic class fits Red because it's **synergy-without-coordination**: nobody is *cooperating*; the goblins are just dumping spare parts onto whatever rolls up. The flavor is Red.

**Vehicle examples (Red-leaning):**

- **Battering Ram** (Red structure-creature). Durability 4, Spite 2, Force 0, Tempo 0. *"While there is a creature in the slot directly behind this, this gains Force equal to that creature's Force. This card attacks with cleave."* Cost: ≥1 Force.
- **War Wagon** (Red creature). Durability 3, Spite 1, Force 0, Tempo 1. *"While there is a creature in the slot directly behind this, this gains Force equal to that creature's Force. When this attacks, the driver also deals damage equal to its Force to the target."* Cost: ≥2 Force. *A damage-doubler that requires positional setup.*
- **Goblin Pyromaniac** (Red creature, goblin). Durability 2, Spite 0, Force 1, Tempo 1. *"While driving a friendly vehicle, this and the driven vehicle gain +1 Force until end of turn."* Cost: free.

**Cross-color vehicle expressions (sketch).** The vehicle mechanic class spans all five colors with distinct flavors:

- **White:** armored vehicles (tanks, fortresses-on-wheels). Driver-as-disciplined-pilot — knights, crusaders. Vehicle text emphasizes defense: "While driven, this has +1 Durability and the driver has divine shield."
- **Green:** living mounts (war-bears, hunting beasts). Mount-as-tempo-amplifier, organic bond, **structurally inverted from Red's vehicle pattern**. The rider is positioned **in front**; the mount is **behind**. The rider does the fighting and takes the hits; the mount provides the speed. Critically, **the mount is *not* a blocker** — back-row mounts don't intercept attacks aimed at the front-row rider. This expresses Green's identity: speed expressed through bonded mobility, not protection through armor. Mount text emphasizes tempo: "While ridden, the rider in front of this gains +1 Tempo." Or: "While ridden, the rider in front of this may take an extra movement action this turn." Per the default-inert rule: if the rider dies, the mount becomes an inert back-row creature (its tempo bonus shuts off until another rider takes the front-of-it slot).
- **Blue:** arcane constructs (golems, animated armor). Driver-as-animator, requires Insight presence. "While there is an Insight-printing creature in the slot behind, this gains Force equal to that creature's Insight and may attack."
- **Black:** necromantic horrors. Driver-as-suppressor — the controller keeps the horror from going feral. "While there is no friendly creature behind, at end of phase this attacks a random creature here." *Black inverts the normal driver relationship: the driver suppresses, doesn't empower.*
- **Red:** the canonical chaos vehicles described above.

This is **the same mechanic class expressing five different things** — the card-type-as-axis principle in action. Each color's vehicle prints differently, has different driver requirements, and supports different in-color creatures as drivers.

**Pass 2 / pre-prototype-v2 work:** the exact rules for vehicle driver geometry (does the driver have to be directly behind? adjacent? same row?), how vehicles interact with movement actions (can a driven vehicle be moved? does it carry the driver?), and how the cleave/AOE patterns on vehicles handle friendly fire when the driver is in the cleave path are all open questions. The mechanic class is captured here as a real design space; the implementation details are deferred.

#### Coward — Red's involuntary stealth keyword

**Coward** is a Red creature keyword. At **start of combat** (a new named trigger window — see below), a Coward creature involuntarily flips face-down, becoming inert per the unified face-down rule. At end of the combat phase, per the existing flip-up-at-end-of-phase rule, the Coward flips back face-up. The whole "cowering" lasts exactly the combat phase that prompted it.

The flavor is direct: Red creatures fail their allies the moment battle is joined. The card looks scary on commit; when the swords actually come out, it turns its back.

Coward is a **flavor-coded version of stealth** — same primitive (face-up → face-down → face-up at end of phase), opposite control surface (the card decides, not the player). This makes it Red-specific in a way Green's voluntary stealth isn't: Red doesn't get to *choose* to disengage; the cowardice is the printed weakness. Two distinct mechanical use cases follow from where the Coward sits:

- **Front-row Coward** is a *negative coordination* effect — the creature looks like a blocker but bails on combat. The hit it would have absorbed lands on the creature behind it instead. This is friendly-fire-adjacent: an anti-coordination effect that costs Red presence to play and punishes Red for committing to a blocking shape. The card-design tension is real — high Durability/Spite printed up front looks attractive, but the Coward keyword makes that defense unreliable.
- **Back-row Coward** is a **flip-up trigger doubler**. The creature flips down at start of combat and flips back up at end of combat, firing its flip-up trigger a second time (the first firing was when originally committed). This is a *deliberate* use of the keyword — pair Coward with a flip-up trigger like "deal 1 damage to a random enemy here" and you get two pings per combat phase, all from the printed keyword, no stealth-card spend required. Red gets a self-stealthing trigger doubler in a way that's locked to back-row positioning.

Per the **Tempo-spent principle**: a back-row Coward's combat initiative is already spent (it had its Tempo moment when first committed; it's now flipping down without acting). The post-combat flip-up triggers fire normally on the second flip-up, but the creature does *not* get a second combat action this turn. Flip-up triggers fire on flip-ups; combat actions are gated by initiative.

**Start of combat as a named trigger window.** Coward introduces a phase-boundary timing we hadn't named before: **start of combat**, the moment after combat-reveal commits are revealed and visible but before damage resolution begins. Coward fires here. This is a new trigger keyword that other mechanics may use (e.g., a structure that activates at start of combat to grant temporary stat boosts, or an effect that reveals additional information at start of combat). It's not a new phase — it's a sub-moment within the existing combat phase, named explicitly so card text can reference it.

#### Red's anti-synergies and conditional Black-synergy

Red's friendly-fire creates **anti-synergy with most other colors**:

- **Blue:** cleave kills your Insight mages, fizzling queued Blue actions at resolve.
- **White:** cleave damages your Resolve creatures, interrupting their Prayer-channel contribution this turn.
- **Black thorns:** Red attacks into Black creatures eat thorns retaliation, punishing Red attackers.

And **conditional synergy with the death-feeder subset of Black**: cleave-killed friendlies feed Black's graveyard recursion, sacrifice payoffs, and "creatures dying" triggers. So Red+Black is a card-level negotiation, not a flat affinity — some Black cards work brilliantly with Red, others actively punish it. This kind of mixed within-pair interaction is richer than a simple "color X loves color Y" affinity model.

### Green — Tempo — the color of speed, position, and disruption

- **Identity:** the tempo and rearrangement color. Green is fundamentally the color of "one window per turn" — its effects manipulate *when* and *where* things happen, not *how much*.
- **Creatures:** high Tempo, often fragile (low durability or low Spite). Glass cannons that act before they can be killed. **Signature ranged archetype**: precision archers and slingers that print ranged attack patterns and live in the back row. Tempo advantage at ranged combat compounds: when multiple ranged creatures share a location's ammo pool, the fastest fires first.
- **Actions (Maneuvers, placeholder name):** positional disruption (move a creature between slots or locations), reveal-order manipulation, stealth (re-flip an already-revealed card to face-down — see *Stealth and re-flip*), combat-modal buffs that aren't pure damage (e.g., "double-strike: this creature attacks a second time at -1 Tempo this turn"), and **Volley**-style activation actions (off-cycle ranged firing — see *Activation actions*).
- **Doesn't do:** durable defense, heavy combat sustain, pure damage piling.
- **Win path:** combat damage via fast strikes that kill before being killed; positioning that opens lethal lanes; ranged poke from defended back-row archers.

#### Green effects don't double up on the same card

A signature Green design constraint: **Green's effects do not double up on the same card across multiple flips in a single turn.**

- **Boolean keyword grants don't double up.** A Green on-reveal that grants *double strike*, fired twice via stealth + re-flip, leaves the creature with double strike — the second grant does nothing new.
- **Numeric grants stack** — but Green's numerics are tuned modest. A Green "+1 Force on reveal" fired twice grants +2 Force. The compounding is real, but capped by what Green is willing to print.

The combo ceiling for flip-spam without cross-color support is therefore bounded. The **biggest combo upside comes from cross-color combinations** — pairing a Green flip primitive with a non-Green stackable payload (Red's "+2 Force on reveal" stacking with itself, Blue's "deal X damage on reveal" stacking, etc.). The trade-off is real: cross-color combos cost an additional color's stat presence to enable.

This rule unifies with the **Tempo-spent principle**: Green is the color of one window per turn. Its effects don't refund initiative, don't compound on a single card, don't pile. Green manipulates timing and positioning; it is not a value-piling color on its own. Together, "Tempo-spent" and "no doubling on a card" are one idea expressed at two scales.

### Blue — Insight — the color of cancellation, perception, and indirect damage

- **Identity:** the color of *making things not happen*. Insight is not just knowledge; it is the power to remove things from the equation. Themed as **the brittle mage** — confident in their power, neglectful of their own defense (see *Color themes*).
- **Creatures:** intentionally weak on the board — low Force, modest durability — but print Insight to fuel the action economy and global draw count. The *flavor* of Blue's fragility is *hubris*: the mage believes their spells will solve every problem and refuses to invest in physical defense. Blue+White affinity isn't just mechanical; it's narrative — the wise scholar who finally accepts they need a guardian.
- **Actions (Spells):** **deal direct damage** (often scaling with Insight presence), **counter or cancel actions** (see *Counterspell*), reveal face-down cards, manipulate the play queue / reveal order.
- **Doesn't do:** strong combat creatures; persistent on-board threat; durable structures.
- **Win path:** spell damage to summoner Durability; out-of-combat reduction of opposing threats.

#### Blue's cost-shape: front-loaded and brittle

Blue's signature cost shape is **front-loaded**. Spells require heavy Insight presence at cast time — typically a Blue mage with high Insight must already be at the location. The mage *is* Blue's spell economy at that location: kill the mage, lose access to all Blue spells there.

Combined with the **double cost-check** rule (cast and resolve), this produces a brittle profile. A Blue spell queued in main phase but timed to resolve later is exposed through combat. If the mage dies between cast and resolve, the queued spell **fizzles**. A single combat hit on the mage can shut down a whole strategy.

A Blue-leaning deck must run enough other-color creatures to defend its soft mages, or race the opponent before its mages get cleared.

#### Blue's three control archetypes: Counterspell, Stifle, and action-disperse

Blue's denial suite splits into three distinct tools, each with a different attack angle:

- **Counterspell** *removes actions from slots.* It's race-dependent against one-shot actions: if Counterspell reveals first this phase, queued one-shots haven't resolved yet and get nuked; if it reveals late, faster actions have already resolved and exited. But it **always works against persistent actions** (Prayer, Curse) regardless of when it fires this turn, because they're still in the slot when Counterspell hits. Counterspell is the *high-risk single hit* — the high-Insight cost and timing dependency are the price of guaranteed slot-clearing of persistent threats.
- **Stifle** *prevents reveals and clogs slots.* Stifle does not destroy queued actions. Its effect is "no actions reveal this turn" — face-down cards stay face-down, slots stay clogged, and no further actions can be played into those slots while the effect persists. Actions that would have fired this turn miss their timing window; they will eventually flip in a later phase, but specific timing triggers ("during this turn's main phase") will have passed and those actions fizzle per the resolve-time cost-check. Symmetric — affects both sides — so the caster takes the same delay penalty.

Counterspell answers persistent strategies; Stifle answers timing-locked plays (which is ironically much of Blue's own pattern — the firestorm-on-upkeep example). Stifle in a mirror match hurts the caster too, so timing is everything: deploy Stifle on a turn you have nothing critical queued.

The third tool — **action-disperse** — *redirects* a queued enemy action to an adjacent location's action slot rather than destroying it. Cheaper than Counterspell, lower-impact, but in the right multi-location situation it can make the action resolve harmlessly or even backfire on the caster (if it hits a friendly creature at the new location). Blue's "redirection" mechanic; pairs with the broader Displace subclass of relocate-on-reveal effects. (See *Displace Mechanics — actions* below.) Multi-location only; useless in v1.

Together, the three tools cover the full spell-denial space: remove (Counterspell), delay-and-clog (Stifle), or redirect-elsewhere (action-disperse).

#### Blue's three action-acquisition vectors

Blue's deckbuilder identity is fundamentally **copying, not stealing**. Blue observes the actions other sides take and produces independent copies for its own deck. Three distinct printable vectors express this verb across card types:

- **Equipment vector** (canonical card: *Spellbook*) — wielder-defended, multi-charge. While in play, each opposing action that resolves at the wielder's location consumes one of the book's pages and adds a copy to your discard pile. When pages are spent the equipment is destroyed; when the wielder dies the book goes to junkyard with the host. Killing or displacing the wielder is the load-bearing counter-play. Wielder mobility (Shove, Disperse, Bodyswap) carries the book between locations — "this location" tracks wherever the wielder currently is.
- **Structure vector** (canonical card: *Forbidden Library*) — one-shot, premium. Copies the next opposing action resolving at this location to your *hand* (immediate use this encounter), then self-destructs. Distinct from the equipment path in trigger (one-shot, not multi-charge), destination (hand, not discard), and form (no wielder).
- **Persistent action vector** (canonical card: *Archeological Expedition*) — patient gamble. Persistent action that occupies an action slot. At end of cleanup, if any action resolved at this location this turn, Expedition resolves: a random action from those resolved is copied to your graveyard, and Expedition itself goes to your graveyard. Copy-to-graveyard means *next-encounter access* — the card joins your deck for future fights via graveyard reshuffle. Visible-in-slot once revealed; opponent can read the threat and route low-value actions through this location to give the player chaff.

**Three deck-building rhythms** from the same Blue verb (*copy*):

- *Equipment:* "use it now" — copies cycle through your discard pile this encounter.
- *Structure:* "single big play" — copy goes to hand, immediate.
- *Persistent action:* "save it for later" — copy joins your deck for next encounter via graveyard reshuffle.

Variation lives in **conditions, scope, and requirements** — not in changing the verb. Blue does not steal; Blue copies. (Specific card costs, charge counts, and trigger details live in `CARD_DESIGN.md`.)

The strategic risk-reward worth flagging: blind action acquisition is a **gamble**. Adding bad cards to your deck is one of the worst things a player can do; opponents can read your acquisition tools (visible Spellbook on a creature, visible Library structure, visible Expedition in the action slot) and deliberately route low-value actions through these locations to give the player chaff. Acquisition tools are *not always good plays* — they pay off only when you can constrain or predict the opponent's valuable actions.

##### The vector pattern as a design framework

The vector pattern generalizes across all five conversion verbs. Each color's verb (Recruit, Reroute, Convert, Stealswap, Research) can be printed across multiple card-type vectors, each with distinct trigger conditions and timing — but all expressing the *same* core verb. Red's Recruit already has both action-form and creature-form (Goblin Recruiter). Black's Stealswap has both creature-form (Nightmare) and action-form variants. Blue's three-vector spread above is the template; future card design for any color should ask: *which card types can express this verb? What conditions, scopes, and destinations differentiate the vectors?*

**Color identity is preserved at the verb level; variety is created at the vector level.** Blue does not steal. Red does not corrupt. Black does not heal. The verb is the principle; the vectors are the printed expressions.

### White — Resolve — the color of belief and channeled intervention

- **Identity:** belief in things outside one's control; reliance on intervention from beyond. The slow inevitability color.
- **Creatures:** intentionally weak on the board, like Blue. Print Resolve to enable persistent channeled actions (*Prayer*, below) and to enable card retention across cleanup (see *Resolve is retention, not volume*, below).
- **Actions (Prayers):** primarily **Prayers** — persistent, channeled, powerful conditional effects whose cost is paid over multiple turns by Resolve creatures present at the location.
- **Distinction from Blue:** Blue uses perception of reality to influence reality directly. White asks for outside intervention and waits for it to resolve. Blue acts; White prays.
- **Doesn't do:** fast tempo, on-board combat presence, immediate threat.
- **Win path:** outlasting the AI's deck-thin in attrition; the occasional dramatic Prayer payoff.

#### White's cost-shape: deferred and channel-paid

White's signature cost shape is the **opposite of Blue's**. Prayers have **no stat-presence requirement to cast** — you can drop a Prayer into a slot at any location, anytime, with zero board presence. The "cost" is the channel: the printed `pray N` value is paid out gradually by Resolve creatures arriving at (or already present at) the location.

Combined with the **double cost-check** rule, this produces a **resilient** profile that contrasts sharply with Blue:

- **Damage to a Resolve creature** pauses that creature's contribution to channeling *this turn* — but the Prayer is not lost, the deck is not lost, the strategy stalls. Chip damage delays White; it does not break it.
- Where Blue is *tempo-fragile* (one mage death = total disruption), White is *tempo-resilient* (damage delays, doesn't break).
- Prayers can also be **speculatively pre-positioned**: drop a Prayer at a location with no Resolve present, then later move Resolve into range to begin channeling. Blue cannot do that — Blue is *cast or don't*.

#### Resolve is retention, not volume

Resolve grows the global kept hand size after cleanup-phase discard. The deeper truth: Resolve's real value is **keeping the right card for the right phase**, not winning by sheer card mass. End-of-turn discard creates a structural problem for any timing-locked action — by the time you'd want to cast it, you've discarded the card. Resolve-driven retention is what lets timing-locked plays survive cleanup.

This is also the structural reason for **Blue+White affinity**: end-of-turn discard structurally punishes Blue's natural play pattern (timing-locked spells get discarded). Resolve retention solves this. The two colors are not just "spell-leaning together" — they are *mechanically complementary across the cleanup phase*.

#### White's second mechanical idea: healing and protective intervention

Beyond Prayer, White's signature themes are **healing, restoration, and divine intervention** — patching the seams that channeling exposes.

- **Healing** restores creature durability. Resolve creatures damaged in combat (which would normally pause their channel contribution this turn) can be healed back to full, restoring the channel. Healing also serves White's win path: outlast the opponent's deck thinning.
- **Divine shield** is a cheap pray-1 protective effect. The card resolves quickly (only one Resolve point of channel needed) and grants a **single-instance damage absorber** that pops the next time damage is applied. The pattern: drop a divine shield first to protect your Resolve creature, then commit a bigger Prayer behind it. The divine shield deflects the channel-cancellation hit; the bigger Prayer keeps progressing.
- **White is the color that patches its own seams.** Where Blue is structurally brittle (mage death = strategy collapse), White prints the exact tools to repair the damage that would interrupt it. Two structural identities, two different relationships to vulnerability.

Healing and divine shield share a design property: their effects are most powerful when their target is unambiguous. Per the no-targeting pillar, a divine shield resolves on a random qualifying creature unless the player has set up the board so only one creature qualifies. White's tempo therefore rewards thin-board moments — protect what you're channeling on, not the whole party.

#### White as the color of rebuilding (structure recovery)

White is also **the color of restoring what was lost.** Specifically: White's signature graveyard interaction is **bringing destroyed structures back into play.** This contrasts sharply with Black's broader graveyard recursion:

- **Black raises creatures** as zombies — degraded and twisted into combat tools. Recovery is *exploitative*: the dead serve.
- **White restores structures** intact, as they were. Recovery is *restorative*: what was lost can be made whole again.

White does *not* generally interact with creature graveyards (no creature reanimation; that's Black's space). White rebuilds *places* — temples, walls, shrines. The flavor is patient, communal, restorative. Mechanically: a Pray-N action that returns a destroyed structure from your graveyard to its location for free, or a creature with on-reveal "if your structure slot is empty, return a structure from your graveyard there." Cost-gated by Resolve presence as usual.

This narrows White's graveyard interaction to a single, distinctive design space — fitting White's identity as patient and selective rather than opportunistic. It also gives White a real long-game payoff: structures destroyed by enemy effects don't stay destroyed forever in a White-leaning deck.

### Black — Spite — the color of costly engagement

- **Identity:** every interaction with Black is transactional. Black creatures *want to be hit*; engagement is their weapon.
- **Creatures:** high Spite (damage reduction), decent durability, often modest Force. Tank-shaped. Often bring **thorns** (retaliate when struck, gated on Spite) or **taunt** (redirect attacks). Hard to remove cleanly.
- **Actions (Curses):** **Curses** (see below) — persistent debuffs that migrate to the enemy's action slot on reveal. Drain effects (cost summoner Durability for benefit). Reanimate (return creatures from graveyard with stat clamping; see *Zombification*). Sacrifice-for-effect.
- **Structures:** Black is structure-friendly. Anti-creature defenses, graveyard-scaling structures, supply-line-extending fortifications. Also the natural home for **anti-ranged** effects — destroy ammo stockpiles, force engagement, neutralize back-row threats. Black's "engagement is its weapon" theme pulls naturally toward "stop ranged from staying at range."
- **Doesn't do:** fast tempo, heavy raw spell damage, native ranged combat. Black is **deliberately slow**, and slowness is *good* for Curses (see below).
- **Win path:** indirect — outlast and grind, accumulate graveyard value, drain via Curses and retaliation. Pair with Red for direct damage paths.
- **Open question:** how do other colors *cleanly kill* Black creatures? If hitting Black is always punished, optimal play would be to ignore it. There must be answers (likely: Blue spell damage bypasses combat-triggered thorns; Green movement displaces; exile-class effects bypass graveyard recursion). To be pinned down so the meta is balanced. (See Open Questions.)
- **Open question (new):** **tall-vs-wide tension.** Recent design conversations frame Black as "wide" in contrast to Red's lone-champion "tall." But the existing Black profile (high Spite, tanky individuals, hard to remove) reads as tall-tank. The likely resolution: Black is *wide via persistence* — same creatures cycling through the graveyard over many turns — rather than many cheap chump creatures at once. To be sharpened. (See Open Questions.)

#### Lurk — Black's reactive face-down keyword

**Lurk** is a Black creature keyword. While in play face-up, the Lurker watches the board: when an enemy creature flips up at this location, the Lurker gains Stealth (involuntary, fires automatically per the printed condition). Per the unified flip-up rule, the Lurker re-flips face-up at end of the same phase — at which point its flip-up trigger fires *with the enemy creature now present at the location to be targeted*.

**This is Black's signature timing fix for board-targeting debuffs.** Affliction-style effects ("an enemy creature here loses 1 Durability," "an enemy creature here loses 1 Force until end of turn," "deal 1 damage to a random enemy here") need a target to land. On round 1 of an encounter, those effects fizzle because the player has nothing committed yet. Lurk solves this: the Lurker waits, doesn't trigger until prey arrives, then strikes. It's the **patient predator** primitive — bides its time, fires at the right moment, lands its damage.

The mechanical sequence:

1. Lurker flips up on initial reveal (e.g., during AI overworld placement). Its flip-up trigger fires *now* — fizzles if no enemies present, lands if enemies are present (mid-encounter case). On round 1 of a new encounter with the player just arriving, this firing typically fizzles — that's expected.
2. Lurker sits face-up, watching.
3. An enemy creature flips up at this location (player commits in main, reveal phase, the enemy flips up).
4. **Lurk triggers:** Lurker gains Stealth, flips face-down for the rest of this phase.
5. End of phase: Lurker flips back up (per the unified flip-up rule). Its flip-up trigger fires *again*, now with the enemy still present at the location. The debuff lands.

**Black's third control surface for face-down state.** Green stealths *voluntarily* (player chooses); Red cowers *automatically* on a fixed timing (start of combat); Black lurks *reactively* on a board condition (enemy creature flips up here). Three different control surfaces, all using the same underlying face-down primitive.

**Per the Tempo-spent principle,** the Lurker's combat initiative was spent on its initial reveal. Lurking and re-flipping doesn't refund it. So Lurk is *specifically* a flip-up trigger doubler with target-availability gating — it does not double the creature's combat actions, only its flip-up trigger firings. This keeps the keyword bounded.

**Flavor:** the Lurker is the predator that doesn't rush, the curse that activates when conditions are met, the hidden danger that becomes deadly only once you've already committed. Patient, conditional, *transactional* — same color flavor as Black's tank-creatures-that-want-to-be-hit, but in the timing dimension instead of the combat dimension. Black creatures *want to be triggered*; engagement and presence-of-prey is their weapon.

**Lurk also opens a structural defense pattern for Black.** A Lurker on the AI's boss node, with a strong flip-up debuff, becomes a *threat the player creates by arriving and committing*. The AI didn't have to time its play — the player's arrival is the trigger. This is on-flavor: Black profits from the opponent's actions.

#### Pull — forcible face-down placement (Black-primary, Blue secondary)

**Pull** is an action effect that **forcibly places a card into a slot face-down**, treating it as if it had been committed normally. The Pull action itself pays whatever cost the action prints. At end of phase, the pulled card flips up per the unified flip-up rule — and **flip-up triggers fire normally on the pulled card** at this moment. *Then*, after flip-up triggers have resolved, the resolve-time cost check happens per the existing double cost-check rule:

- If the card's owner can pay the resolve cost (i.e., they have enough stat presence at this location for whatever the card prints): the card lands and stays in play.
- If they cannot pay: the card goes from face-up directly to graveyard. The body is gone, but **the flip-up triggers already fired** during flip-up.

This sequencing — *flip-up triggers fire, then cost check, then maybe graveyard* — is what makes Pull mechanically rich. The mechanic has three flavors based on what is pulled:

- **Pull from your own hand (Pull-self).** A *cheat play* with a twist: you force a card into a slot outside your normal commit window. The card's flip-up triggers fire even if you can't pay the resolve cost, which means **Pull-self is a flip-up-trigger extraction tool**. Pull a creature with a strong flip-up ability (e.g., "deal 2 damage to a random enemy here") whose body you don't actually want; deliberately set up so you can't pay the resolve cost; **the trigger fires for your benefit, then the card dies to the graveyard for free.** This turns mediocre-body cards with strong flip-ups into single-use spells. Cards normally judged by body+trigger together get a re-evaluation: *what's the trigger worth alone?*

- **Pull from the opposing hand (Pull-enemy).** This is the **gambit** version. The action reaches into the opponent's hand, drags a card into a slot at this location face-down. At flip-up:
  - **The pulled card's flip-up triggers fire** — even if the card subsequently fizzles. So pulling an enemy creature with "on flip-up: deal 1 damage to a random enemy here" causes that damage to land on *the opponent's* allies. You've forced their card to fire its trigger against them.
  - **Then the resolve cost check happens.** If the opponent can pay, the card lands as theirs (you handed them a body they didn't have to commit to). If they can't pay, the card fizzles to graveyard (you've Counterspelled their plan from outside their commit window — but you already got the trigger to fire against them).
  - **Both possibilities have value.** Pulling an enemy card with a self-harm-friendly flip-up (damage to their own allies, their own discard, etc.) is *good for you regardless of whether they pay*. Pulling a card whose flip-up would help them (token generation, summoner damage to *you*) is *bad regardless of whether they pay*. The gambit is reading the trigger as much as reading the cost.

- **Pull into already-full slots.** If the target location's slots are already full at the moment of Pull, the pulled card goes to graveyard immediately *without flipping up* (there's nowhere to put it face-down). This makes Pulling at full enemy locations a **safe Counterspell variant** — guaranteed to kill the pulled card, no flip-up trigger fires. The strategic question becomes: pull from a full slot (safe disposal, no trigger fire) vs. an open slot (risky-or-rewarding trigger extraction).

**Pull-self can backfire too.** If you pull a card from your own hand whose flip-up ability is *bad for you* (e.g., a Provocation creature that buffs the enemy on flip-up, or a Coward that flips down at start of combat), the trigger fires anyway. The mechanic is not always strictly upside; it requires the player to know what their pulled card will do at flip-up.

**Color fit:**

- **Black-primary.** Pull from enemy hand is intrusive disruption — Black's signature *reaching into the opponent's plans before they manifest*. Black already does this with hand-debuffs; Pull is the same primitive at one step further: not just debuffing the opponent's hand, but *causing their cards to play themselves* unfavorably. Names: *Treachery*, *False Allegiance*, *Compulsion*, *Drag*.
- **Blue-secondary.** Pull is also an information-and-queue manipulation primitive. A Blue version reads more as "reveal opponent's leftmost-in-hand card and play it for them here at no cost to them." Blue-Pull is *forcing a play* the opponent didn't choose; same primitive, different flavor. Names: *Compel*, *Suggest*, *Manipulate*.
- **Other colors** don't have a natural fit. Red is too direct, White is too constructive, Green is too tempo-focused.

**Why Pull is mechanically rich:**

1. **It exposes the design-richness of the double cost-check rule.** Pull demonstrates that "cast cost" and "resolve cost" are genuinely different — most cards pay both at the same moment, but Pull lets one party pay cast cost while another pays resolve cost. The rule is no longer a clarity-only rule; it's load-bearing for a real mechanic.
2. **The gambit creates real strategic decisions.** A Black Pull against the opponent is a read on their hand and their stat presence. Wrong reads ramp them; right reads disrupt them.
3. **Asymmetric information matters again.** You don't know exactly what's in their hand, only the position you're pulling from. Hand-positional targeting (already in the design as a Pass 2 idea) becomes the primary lever for Pull — pull the *leftmost* hand card, *the most expensive* hand card, etc.
4. **Slot-fullness becomes meaningful both ways.** Mechanic #1 (the "if full" condition) interacts beautifully: full slots are a *defensive blessing* against incoming Pulls (they fizzle), and a *punishing curse* if you're trying to commit normally (no room for new plays).

**Pass 2 questions:**

- Can the same card be pulled twice in the same encounter? (Probably yes — once it's pulled, paid for, and resolved, it's back in their discard pile and may cycle.)
- If a creature is pulled into a creature slot, does it use the pulling side's slot grid or the opposing side's? (Probably the opposing side's — it's still their card; it just got committed by your action.)
- If a creature is pulled and the opposing side's creature slots are full but your side's aren't, does it whiff or land in your slots? (Probably whiff — Pull is specifically about dragging into the *opponent's* slots; landing in your own slots would be a different mechanic.)

#### Treason — captured as a low-priority Curse-migration variant

**Treason** is a creature keyword (or a tag on specific Curse-flavored cards) where a creature is *played by you* but, at flip-up, **migrates to the opposing side's creature slot** as if it were the opponent's own creature. Mechanically a Curse-migration variant applied to creatures rather than to debuff effects.

The design tension: a Treason creature now *attacks the player* on their next combat. The player has spent a card on a saboteur that helps the opponent in some ways while clogging their slots in others. To work, a Treason creature needs to be *bad enough for the opponent* (low stats, takes a slot, debuffs their allies, eats space) that the player doesn't get sad value. **A clogging traitor (low stats, hurts the enemy passively) is more workable than a fighting traitor (good stats, attacks the player back).**

Captured here as a low-priority capture (probably narrow design space). If we develop it: Black-primary (transactional sabotage flavor), Red-secondary (chaotic disloyalty flavor — Red goblin who turns coat in the heat of battle). The slot-clogging variant is the realistic implementation.

The Pillar 10 question: where does the traitor land in the enemy's slots? Random per the no-on-resolve-targeting rule, presumably — and if the enemy's slots are full at migration time, the migration fails (the Treason creature stays on your side, which is also bad, since now you have a creature you don't want and the opponent paid no cost).

#### Black's mixed synergy with Red

Red's friendly-fire / cleave attack patterns kill Red's own creatures — and Black's **death-feeder** cards (graveyard recursion, sacrifice payoffs, "creatures dying" triggers) work brilliantly with that. Black's **thorns** retaliation, by contrast, hurts Red attackers. So Red+Black produces *card-level* synergy *and* anti-synergy at the same time, depending on which Black cards are present. (See Red's *Anti-synergies and conditional Black-synergy*.)

### Cross-color affinity (emergent, not hard-coded)

Color affinities emerge from mechanical compatibility, not from explicit deck-construction rules:

- **Black + Red** is naturally strong. Zombification clamps non-Force/non-Spite stats to 0, so Red creatures recovered from the graveyard retain most of their value while Blue/White/Green creatures come back as shadows. Black wants to live on the board fighting; Red wants to fight; they're aligned.
- **Blue + White** is naturally strong. Both are weak on the board and rely on actions; their creatures complement each other as utility-printers. Blue counter-magic and White Prayer share action-slot economy.
- **Red + Green** is the natural aggressor pair — fast and hard, positional and lethal.
- These are not enforced; players whose runs draw mixed cards will find emergent synergies in any blend.

### Color combination themes

Beyond *mechanical* compatibility, each pair of colors has a distinct **thematic identity** — a named region of the design space where the two colors' flavors blend into a third character that's neither parent alone. This is *flavor guidance*, not a sixth-color rules system: a card that prints both Insight and Resolve is still mechanically just Blue+White, but it can lean on the *Bureaucracy* identity for naming, art direction, and effect texture.

Ten pair-identities (working sketches; not all equally developed):

| Pair | Identity | Flavor |
|---|---|---|
| Red + Green | **Raiders** | Aggressive guerillas, hit-and-run with brutality. Mountain bandits, marauder warbands. |
| Red + Blue | **War-mages** | Arcane destruction, ego-driven power. Battle-sorcerers, mad scientists, warlock generals. |
| Red + White | **Crusaders** | Righteous violence, conviction-fueled aggression. Holy war, militant clergy, paladin orders. |
| Red + Black | **Hellish** | Demons, devils, hellscape. Punitive fury, vengeance as warfare. The infernal. |
| Green + Blue | **Spies** | Espionage, intelligence operations. Quiet observation, sleeper agents, infiltrators with a plan. |
| Green + White | **Druids** | Patient guerillas, faith-in-the-wild. Pilgrims, hermits, wandering monks, naturalist clergy. |
| Green + Black | **Assassins** | Lethal precision, "kill the king and disappear." Poisoners, shadow guilds, killers-for-hire. |
| Blue + White | **Bureaucracy** | Institutionalized civilization. Insight + faith = the State. Universities, magistrates, organized clergy, courts of law. *(This is where the civic-White flavor actually lives.)* |
| Blue + Black | **Warlocks** | Forbidden knowledge, demonic pacts for power. Dark scholars, soul-bargainers, occultists. |
| White + Black | **Cultists** | Devotion to dark causes, faithful traitors. False prophets, doomsayers, heretics. The fall of the faithful. |

The combination flavor is most legible on *cards that print costs in both stats*. A card requiring "≥1 Insight and ≥1 Resolve here" is canonically Bureaucracy — its name, art, and rules text should reinforce that identity rather than pretending to be pure Blue or pure White.

**Why this matters for design:**
- It gives mixed-stat cards a real flavor home rather than feeling like rule-bent compromises.
- It lets the design space include thematic *factions* without inventing new colors. A Bureaucracy structure (Cathedral) and a Bureaucracy creature (Magistrate) and a Bureaucracy action (Decree) all belong to the same flavor cluster, mechanically gated by Blue+White presence.
- It clarifies the existing color-pie tensions: White's *civic* register lives in the Blue+White overlap, not in pure White. Black's *demonic* register lives in the Red+Black overlap, not pure Black. Pure colors stay focused; the combinations carry the genre fantasy.

This is held as a Pass 2 design space — we'll lean on it when we start printing dual-stat cards. For now, named so the design vocabulary exists.

### Mechanic families across the color spectrum

A pattern that runs through the existing design — much of it implicit until now — is that **a single mechanical genus splits across the five colors via a small set of axes**, with each color getting a structurally distinct expression. The axes are:

- **Card type / vehicle** — the same effect printed on a creature, a structure, an action, a persistent action, or as a token creator behaves differently. A "+1 Force" effect on a structure is permanent local terrain; on an action it's a one-shot impulse; on a persistent action it's a multi-turn channel.
- **Pile / zone targeted** — graveyard, hand, deck (top of deck), board, opposing slot, summoner. Each color reaches into different piles natively.
- **Scope** — *here* (default, free), *another specific location*, *all your locations*, *everywhere*. Wider scope is a printed premium per the existing scope rule.
- **Specificity** — random vs. positional vs. printed-condition. Per the no-on-resolve-targeting pillar (Pillar 10).
- **Direction of effect** — friendly, opposing, symmetric, summoner-direct.

**The design discipline:** when we invent a mechanic, the question is not *"what color does this go in?"* but *"what are this mechanic's expressions in each of the five colors?"* — across the axes above. Sometimes the answer is "all five"; sometimes "three colors get this, two don't, here's why"; sometimes "this is a one-color exclusive (like Counterspell or Prayer)." Either way, it's a *checked* answer, not an oversight.

Examples already present in the design where this pattern has been applied (sometimes implicitly):

- **Recursion (graveyard → elsewhere).** Red recurs *equipment* from graveyard *to hand* via goblin scavengers — flavor-locked to Red's salvage-and-scrap identity. Green recurs *actions* from graveyard *to top of deck* — pulling spells that didn't get to happen (Counterspelled, exiled, otherwise removed) back into the cycling loop, so they re-enter via natural draw. Note Green's recursion is **temporal, not necromantic** — Green doesn't bring back what *died*, Green brings back what *didn't get to happen*. Black recurs *creature cards* from graveyard *to play* directly (raise dead) — the canonical zombification. White recurs *via Pray-channel mechanics* — graveyard contents converted to Resolve or to one-shot effect rather than card return. Blue manipulates *graveyard order* or *excludes cards from cycling* via play-queue / discard-pile interactions. **Same family (graveyard recursion); five different expressions** across card-type, target-pile, and direction.

- **Face-down primitives (stealth, cower, lurk, suppress).** The family contains *two related primitives*, both grounded in the unified face-down rule but with different verbs:
  - **Stealth (primitive):** flip a face-up *in-play* permanent back to face-down. Re-flips up at end of phase. Applies to creatures and structures (anything with a face-up board state to revert).
  - **Suppress (primitive):** prevent a face-down card from flipping up at its normal phase boundary, extending the face-down state across one or more phase transitions. Applies to *anything currently face-down*: just-committed cards in the play queue, stealthed permanents, etc.

  Four colors split these two primitives across four control surfaces:

  - **Green: voluntary Stealth on creatures.** The player chooses. Use case: re-trigger flip-ups, defensive escape from combat.
  - **Red: involuntary Cowardice on creatures (Coward keyword).** The card chooses; auto-flips face-down at start of combat. Front-row use: anti-coordination (refuses to block, exposes creature behind). Back-row use: trigger-doubler (flip down start of combat, flip up end of combat, fires flip-up trigger a second time within one combat phase).
  - **Black: reactive Lurking on creatures (Lurk keyword).** The board condition fires it: when an enemy creature flips up at this location, the Lurker gains Stealth. Use case: gating board-targeting debuffs to land on real targets — a Lurker with "on flip-up: enemy here loses 1 Durability" waits for an enemy to arrive, then re-flips with the target now present. **Black's signature timing fix for affliction-style debuffs.**
  - **Blue: Suppress on the play queue.** Blue extends face-down state past phase boundaries — Stifle is the wide form ("no actions reveal this turn"), and more granular Suppress effects target specific face-down cards. Suppress can apply to any card type because it operates on the face-down state itself, not on what's underneath. **Blue does not Stealth** — it doesn't flip face-up cards down, it keeps face-down cards down.
  - **White: doesn't do either primitive.** White stands fast on principle; hiding and queue-suppression are both contrary to White's constructive, faithful-intervention identity.

  **Four colors, four distinct control surfaces (voluntary creature, involuntary creature, reactive creature, suppress queue), one principled exclusion.** Each color expresses face-down state differently, and Stealth-vs-Suppress is itself a meaningful sub-family axis: Stealth creates new face-down state on permanents; Suppress extends existing face-down state on anything.

- **Cost shape.** White prepays into multi-turn Prayer channels. Blue front-loads at cast time, brittle if mages die. Red impulses (immediate). Green pays at the moment of action (Tempo-spent). Black taxes the opponent (cost-imposing curses, drains). **Same family (cost timing); five different expressions** across temporal direction and target-of-cost.

- **Disruption.** Blue Counterspells (slot-clear actions). Black Curses (migrate to enemy slot). Red friendly-fire (anti-coordination via cleave). Green Stifle / reveal-order manipulation. White doesn't natively disrupt — White's intervention is constructive (heal, shield, intervene) rather than disruptive. **Family expression with one principled gap.**

- **Vehicles.** Red driver-behind (vehicle as wall, vehicle attacks with driver's Force). Green rider-in-front, mount-behind (mount as tempo amplifier, no blocking). Blue arcane-construct (driver as Insight-presence animator). Black necromantic-horror (driver as suppressor — inverted relationship). White armored-fortress (driver as disciplined-pilot). **Family expression with structural inversions** — Red and Green geometries are flipped (driver behind vs. in front), Black inverts the relationship semantics (driver suppresses rather than empowers).

- **Fullness conditions ("if X is full").** A passive condition primitive that triggers effects or restricts plays based on slot/zone *occupancy* — not stat thresholds. Cards reference "while this column is full," "while your structure slot is occupied," "while your back row here is full." Per-color expressions use different fullness vehicles: **Red** rewards filled columns / locations (force-through-numbers, "+X while this column is full" — fragile because cleave still kills your own crammed creatures). **White** rewards filled structure slots ("while your structure slot here is occupied, friendly creatures gain divine shield through next combat"). **Blue** rewards spell-slot occupancy ("while your spell slot here holds a Counterspell or Stifle, friendly creatures gain +1 Tempo" — preparation rewarded). **Green** inverts the family — rewards *empty* zones ("while back row here is empty, gain +1 Tempo" — open space is Green's preference). **Black** reads fullness of a *different pile*: graveyard fullness ("gain +1 Force for each creature in your graveyard"). **Same primitive (read fullness); five vehicles (column / structure slot / spell slot / empty space / graveyard pile); five distinct color flavors.**

- **Distributed stats across locations.** A breaking-of-the-default-local-presence rule: cards print stats that contribute to *other* locations rather than their own. Per the wider-scope-is-a-printed-premium pillar, this is paid in card text. **White (signature home):** "thoughts and prayers" — a card contributes its Resolve at *another* location or distributes evenly across all the side's locations. Religious-White's identity of *patient blessing across the supply line*. **Blue:** distributes Insight through teaching/mentoring — connective, joining locations together. **Black:** distributes Spite across own creatures via sacrifice — costly redistribution. **Green/Red:** mostly don't (Green is here-and-now; Red is here-only-here). Vehicle axis: shows up as actions ("until end of turn, your locations gain +1 Resolve each except this one"), structures ("while this is in your structure slot, friendly creatures at all your locations gain +1 Resolve"), creatures ("contributes 0 Resolve here, but contributes 1 Resolve at each of your other locations"), and as Quest completion conditions ("complete: have ≥1 Resolve at each of your locations"). **Pass 2 / v2+ relevance** since multi-location is needed for the mechanic to matter.

- **Memory-axis triggers ("last turn / this encounter / this run").** A family of triggers that read *history* rather than current state. Cleanup-conditional triggers are *current-turn* memory ("if you played exactly 1 card here this turn"); last-turn triggers are *prior-turn* memory; encounter-scoped and run-scoped are deeper. Per-color expressions: **Blue** loves history-reading triggers ("at start of upkeep, if you played a creature here last turn, draw a card" — information-driven payoffs). **Black** loves rewarding/punishing past actions ("if your opponent played a creature here last turn, that creature loses 1 Durability at start of upkeep" — Black tracks enemy plays for retaliation). **White** loves rewarding sustained presence ("if you played a creature here last turn AND this turn, gain +1 Resolve" — discipline rewarded). **Green** loves rewarding *changing* ("if you didn't play here last turn, gain +1 Tempo" — tempo through misdirection). **Red doesn't care about last turn** — Red is the *now* color, and history is irrelevant. *Same primitive (read history); four colors with distinct expressions; one principled exclusion (Red).* Engineering note: this requires per-side, per-location action history as queryable game state. Modest cost, real implementation work for v2+.

- **Movement restriction ("can't move here / away from here").** A primitive that prevents creatures from entering or leaving a location. Two flavors: *can't move here* (quarantine — defensive zoning) and *can't move away from here* (trap — aggressive lock-in). **Black** does *can't move away* — Curses-as-snares, tar pits, ensnarement. The enemy is committed to dying here. **White** does *can't move here* — consecrated ground, guarded entrances, structural authority. Civic-White expressed as "no entry." **Blue** can do either via spells — flexibility across the family, with information-warding flavor. **Green is principally excluded** — Green is the *movement* color; locking down movement is anti-flavor. **Red mostly doesn't** — Red is the aggressor not the trapper; a few "you started this fight, you're finishing it" effects could exist as exceptions, rare. *Three colors fully in (Black trap, White zoning, Blue flexible), two principally excluded.*

- **Stat reset / set / fix.** Three related primitives that interact with the buff-and-debuff system: *Reset to base values* (one-shot effect that restores printed stats, wiping all accumulated modifications), *Set to X* (specific stat replacement: "set this creature's Force to 5"), and *Fixed-stats zone* (a persistent state where stat modifications simply don't apply). **White** does *Reset* — restoration, healing, undoing the harm Curses have done. Particularly good against Black's slow-grind affliction effects. **Blue** does *Fixed-stats zone* — Blue's "make things not happen" applied to the buff system itself, anti-Provocation, anti-Lurk. The most extreme expression of Blue's denial identity. **All five colors** do *Set X*, distinguished by which stat is set: Black sets enemy Force/Durability low (affliction), White sets friendly Durability to maximum (heal), Red sets this creature's Force to 5 (temporary spike), Blue sets this creature's Insight to 0 (disable), Green sets this creature's Tempo to 5 (speed-burst). Set X is universal because *which* stat distinguishes the color, not the act of setting.

- **Symmetric resource manipulation ("both sides draw / discard / hold X").** Effects that visibly apply to both sides equally but actually favor the side better-equipped to use the new state. Symmetric-on-paper, asymmetric-in-practice. **Blue** does symmetric draw — "both summoners draw 2." Information-flavored; Blue is the side that can use information. **Red** does symmetric discard — "both summoners discard 1." Brute force exchange, raw attrition. **Black** does symmetric retention restriction — "both summoners keep 1 fewer card at cleanup." Cost imposition applied symmetrically. **White** does almost-symmetric-with-an-edge — "both summoners draw 2; you keep all of them, opponent keeps 1." Quiet authority, the small advantage that compounds. **Green is principally excluded** — Green isn't a cards-as-resources manipulator; it cares about timing and positioning, not about hand sizes. *Four colors with distinct flavors, one principled exclusion.*

- **Stat transfer (Drain / steal).** A *zero-sum exchange* primitive: an opposing card loses X of stat S, and your card gains X of the same stat S. Distinct from independent buff/debuff because the totals on each side stay linked. **Black (signature home)** — *Drain* is iconic Black: "an enemy creature here loses 1 Durability; you gain 1 summoner Durability." Transactional engagement. **Red** — *Wound-and-empower*: "deal 1 damage to a creature here; this gains +1 Force." Combat-flavored stealing through attacking. **Blue** — *Mind-theft*: "an enemy creature here loses 1 Insight; this gains 1 Insight." Information-and-stat theft. **Green** — *Hunter's-prize*: "an enemy creature here loses 1 Tempo; this gains 1 Tempo." Tempo-stealing. **White is principally excluded** — White restores rather than transfers; taking from others is contrary to faithful intervention. *Four colors with the family, one principled exclusion (White).* Note this primitive is a sister to the existing afflict and buff primitives — same effect on both sides, just *linked* by zero-sum mechanics.

- **Tribal keywords as a creature-subtype axis.** Already implicit in the design (goblins exist in Red; mages in Blue; clerics in White). **Tribes are creature subtypes, not card colors** — a card may be both Red *and* a Goblin. Per-color core tribes (working sketches): **Red** — Goblins, Orcs, Bandits, Pyromaniacs. **Green** — Hunters, Scouts, Beasts, Rebels. **Blue** — Mages, Scholars, Constructs, Oracles. **White** — Knights, Clerics, Pilgrims, Townsfolk. **Black** — Cultists, Undead, Assassins, Demons. Tribal cards print **lord-style buffs** ("all friendly Goblins here gain +1 Force"), **tribal triggers** ("on flip-up: a friendly Hunter here gains +1 Tempo"), and **tribal restrictions** ("Cleric-only structure: only Clerics may be played here"). Cross-color tribal cards become a deckbuilding lever for hybrid identities — a *Demon Knight* is a White+Black card with a tribal payoff in both colors; a *Goblin Cultist* is Red+Black. Tribal axis maps onto the existing color-combination identity table: Demons live in Hellish (Red+Black) and Cultists in Hellish too; Knights live in Crusaders (Red+White); Spies and Scouts live in Spies (Green+Blue). **Tribal keywords are the *creature-subtype* axis of the family grid** — alongside the existing card-type, target-pile, scope, specificity, and direction axes.

**This is not just an organizing principle for documentation; it's a card-design tool.** When Red gets a new mechanic, the question "what's this mechanic's parallel in Green / Blue / White / Black?" produces deliberate cross-color symmetry where appropriate, and deliberate cross-color asymmetry where the colors' identities require it. Both are valid outcomes; the discipline is to think it through rather than print Red's mechanic and stop.

**Held as Pass 2 design tool.** Existing per-color sections continue to read as the primary description of each color's mechanics. This section is a meta-principle for organizing the cross-color view, plus a checklist for spotting design gaps. A future doc reorganization could elevate "mechanic families" to the primary structure (with per-color sections becoming summaries); for now, both views coexist.

## Locations as a design space

**Locations are not cards.** Each overworld node is a location — when an encounter triggers, the battle board is constructed from the player's adjacent nodes, each becoming a location with its own slot grid. Locations cannot be obtained, drafted, or deckbuilt. But they are not just visual scenery — locations carry **substantial design weight** through two elements:

1. **A biome / theme** — color-flavored aesthetic identity (forest, mountain, ruins, cathedral, swamp, library, etc.). The biome is purely aesthetic — it gives the location its visual character and color-flavor identity but **does not, on its own, contribute stats or rules effects.**
2. **Location text** — a rules effect that applies passively to all cards and plays at this location, both sides equally. **This is the only mechanical lever a location has.**

A location with a biome but no printed text contributes nothing mechanically — it's a flavor location with character but no rules effect. **Locations don't have implicit stat baselines.** If a location is going to push numbers around, it does so through *interesting* text — text that gates the stat contribution on a game action or a board condition, not a flat printed number. *"While there is a structure here, this location contributes +1 Resolve to its owner"* is meaningful location text. *"This location prints +1 Force"* would be boring stats-as-flat-floor and wouldn't be worth printing — if a Red biome wants to push Force, it does so through dynamic, conditional, or reactive text that creates interesting decisions, not a static number.

### Why location text matters

- **Symmetric and free.** Both sides operate under the same location text. There's no card cost; it's just *what this place is*. Locations are the only effects in the game that are guaranteed to apply equally to both players.
- **Always benefits one strategy more than another.** A location text like "creatures here stealth after flipping" is symmetric in rule but asymmetric in outcome — the side with stronger flip-up triggers benefits more. This *symmetric-rule-with-asymmetric-effect* pattern is the same one driving symmetric resource manipulation and phase manipulation. **Locations are the *purest* expression of that pattern**, since they're free and persistent rather than card-gated and one-shot.
- **A pressure-release valve for design.** Effects too weak to justify a card cost can live as location text — they're free, so the bar is "is it interesting enough to be a place?" rather than "is it worth a slot and a stat-presence cost?" Effects too strong for a card *also* live well as location text *because they're symmetric* — both sides equally affected, so the pressure normalizes against the rule rather than against one player.
- **A roguelike axis.** The overworld map is procedurally generated mixing biomes and locations. A run through Green forest biomes plays differently from a run through Black swamp biomes — not because the AI plays differently (the AI logic is the same) but because the **passive rules of the encounter board change**. This adds run-to-run variance that isn't card-pool-driven.
- **Persistent across encounters.** Locations don't change between encounters at the same node. The forest where you fought the boss's outpost is the same forest you fight the secondary forces in. **Location knowledge accumulates** — players learn what the local rules of each biome are and route accordingly.

### Flavor locations vs strategic locations

A useful distinction:

- **Flavor locations** have a biome theme and no printed text. They're aesthetic zones — they color the run visually but do nothing mechanically. Most overworld nodes are flavor locations: the simple Mountain, Forest, Library, Cathedral, Swamp. These give the run a *visible color identity* on the map without adding rules complexity to encounters there.
- **Strategic locations** print location text. The text can be light (a small triggered effect) or heavy (a rule that fundamentally reshapes how encounters work here). Strategic locations are scarcer on the map; they create memorable encounter shapes and run-defining strategic decisions.

The map-generation rule (Pass 2 / v3+) likely places strategic locations at *meaningful* nodes — branching points, late-route nodes near the boss, neutral-encounter nodes — while filling the bulk of the map with flavor locations.

### Per-color biomes and the kinds of strategic text that fit them

Each color has a set of biomes that fit its theme. The biome is aesthetic; the strategic text printed on top is what makes the location mechanically distinctive. Per-color flavors of strategic text:

- **Red — mountain, cave, grotto, pit.** Strategic-Red locations amplify combat, force position commitments, reward going alone. Combat-heavy locations whose text fires at start-of-combat or rewards lone champions.
- **Green — forest, plain, river, hunt-ground.** Strategic-Green locations disrupt positioning, reward movement, hide cards. Self-emptying locations, stealth-on-flip locations, mover-friendly text.
- **Blue — sea, library, shrine, observatory.** Strategic-Blue locations restrict actions, manipulate reveal order, gate spell costs. Action-restriction text, reveal-reordering text.
- **White — cathedral, town, hall, temple.** Strategic-White locations enforce structure-based plays, reward retention, slow the pace of encounters. Race-condition locations rewarding committed structures, locations that grant divine-shield-equivalent protections.
- **Black — swamp, crypt, ruin, plague-pit.** Strategic-Black locations compound attrition, gate movement, accumulate ticks. Time-bomb locations, destroy-on-flip locations, movement-restriction (can't move away).

Cross-color biomes also exist (a *Crusader Cathedral* is a Red+White location; a *Cursed Marsh* is Green+Black). Map generation can mix and match.

### Canonical strategic location-text effects

The following effects are captured as the working library of strategic-location text. Each shapes the encounter in a structurally distinct way; many overlap with card-level mechanics but live more naturally at the location level because they're symmetric and zone-wide.

**Self-emptying locations:**

- *"When a creature flips in the front row here, move it away."* The front row never fills. Combat geometry breaks; the location can't be properly contested for direct attacks. Wide-board strategies eventually corner this location by filling everywhere else. **The rule scales with map complexity:** with 1 location it's *non-functional* (no other location to move creatures to — the rule simply fails to apply, becoming a no-op); with 2-3 locations it's mildly disruptive; with 5+ it's severe. **This is forward-compatible by design** — single-location prototypes can include this location text harmlessly, and it activates as a feature when multi-location lands. Color-flavor: Green (windswept plain) or Blue (illusory ground).

  **Counterplay:** Green can move creatures *into* this location after they've flipped up elsewhere. Movement isn't a flip-up event — it's a separate action — so the moved creature lands here intact. Green's mobility specifically circumvents the location's restriction, turning the "uninhabitable front row" into a Green safe-zone. White's sacrificial plays (martyrs, dispersal) also have a reason to send creatures here — for the deathwish trigger before the move-away kicks in.

- *"After a card flips here, return it to hand."* No permanent presence at this location. **Flip-up triggers fire each time before bouncing**, so the location is a re-trigger machine — same flip-up creature plays again next turn, fires its trigger again. The location becomes a *trigger war* rather than a presence battle. Color-flavor: Blue (dream-zone) or Green (bramble that rejects inhabitation).

  **Counterplay:** Same as front-row-rejection. Green can *move* a creature into this location after it has flipped up at another location — movement isn't a flip-up, so the bounce trigger doesn't fire. Green can hold ground here. White's dispersal-flavored plays can deliberately use the bounce as a cycling tool (play here for the trigger, bounce back to hand, play again next turn for the trigger again).

**Multiplying / amplifying locations:**

- *"When a structure flips here, create a token copy."* Doubles structure investment. Heavy incentive to commit structures here. Token copy is canonically Inert (just stat-stick durability, no triggers fire from the copy). Color-flavor: Green (replication), Blue (mirror), or White (consecrated). *Note: token-creator economics that would normally apply to cards are dissolved by location-symmetry — both sides are equally encouraged to commit structures here, so the location escalates the encounter without giving either player a unique advantage.*

- *"The highest-Force creature here gains +1 Force at start of upkeep."* Tall-rewarding. Big creatures get bigger. Wide strategies are blunted. Tie-breaking: all creatures tied at the highest Force gain the buff (since location text is symmetric and zone-wide, no random selection needed). Color-flavor: Red (mountain — the strongest stand tallest) or Black (king-of-the-hill).

- *"Cards here have double durability."* Everything is harder to kill. Encounters here are slow grinds. Whoever has higher Spite or stronger durability benefits more — Black tanks and White-healed creatures dominate. Color-flavor: Black (clinging plague-pit), White (sanctified cathedral), or Red (mountain stronghold).

- *"Creatures here stealth after flipping."* Every creature that flips up immediately stealths, then re-flips at end of phase, **firing its flip-up trigger twice**. Free trigger doubler for everyone, location-wide. Symmetric but heavily favors whoever has stronger flip-up triggers. Color-flavor: Green (forest cover) or Blue (illusory plain).

**Action-restriction locations:**

- *"You can't play actions here on consecutive turns."* Forces alternating commit patterns. Action-dense decks (Blue-heavy) suffer most. Forces commits to spread across other locations. Color-flavor: White (zone of contemplation) or Red (no time for spells, just fights).

- *"In each upkeep, pull a random card from each side's hand into play here face-down."* Both sides have a random card auto-committed to this location. The Pull mechanic applied as zone rule — flip-up triggers fire, then resolve cost-check applies, then card lands or graveyards. **Massively chaotic.** Encounter shape becomes partly randomized. Color-flavor: Black (compulsion ground), Red (chaos arena), or Blue (compulsion through illusion).

**Time-bomb / pacing locations:**

- *"After turn 5, all creatures at this location take 1 damage at start of upkeep."* The volcano rumbles. Pressure to *not* turtle here forever. Color-flavor: Red (volcanic), Black (poisonous miasma seeping in).

- *"After turn 3, a token Demon is created here for the side with fewer creatures."* The cult ritual completes. Color-flavor: Black (cult ground).

- *"After turn 4, this location's terrain stats double."* The ley line awakens. Color-flavor: Blue (arcane convergence) or Green (sacred grove blooming).

**Trigger-extraction / sacrificial locations:**

- *"When a card flips here, destroy it."* Forces flip-up triggers and deathwish triggers. Token-creator cards become primary plays here (the source dies; the token survives). Cards with strong flip-up + weak body suddenly become flagship plays. Color-flavor: Black (lethal ground) or Red (slaughterhouse).

  **Counterplay is structurally different per color, making this location surprisingly play-rich:**

  - **Token-generator decks (Red, Green) positively value this location.** Per the existing token rules, tokens enter face-up and skip the face-down phase entirely. So at a destroy-on-flip location: a creature whose flip-up trigger generates a token fires the trigger, the token spawns face-up (no flip-up event for the token), the *generator* gets destroyed (it flipped up, that's what triggered the destruction). **The token survives.** The location effectively converts token-generator cards into single-use spells that leave a permanent on the board. Combat Engineer plays here die to the trigger but leave their Sandbag token; Goblin Mechanic dies but its created vehicle/token persists.
  - **Green stealth at this location is a removal tool.** Once an enemy creature is *at* this location face-up, Green can stealth it. Stealth flips it face-down; end of phase, it flips up again — and destroy-on-flip triggers, killing the creature. **Green stealth becomes a location-gated removal spell.** Stealth normally has no killing power; here, it does. (Getting the enemy *to* this location in the first place takes work — opponents won't commit there willingly. Movement-based combos with Green's positional disruption are how this lands.)
  - **Green can also move *itself* in.** Movement isn't a flip-up event, so Green creatures committing elsewhere first and moving here arrive intact. Green's mobility specifically circumvents the destruction trigger — Green creatures can establish presence at this location while everyone else's plays die on arrival.
  - **White's enemy-dispersal mechanic interacts oddly here.** White moves *enemies* to lanes where they can't block — typically into the back row of a different column. White's dispersal *flavor* is "we move you out of our way, off to that field over there." If a White player disperses an enemy into a destroy-on-flip location, the enemy **does not die from movement** (movement isn't a flip-up). So White's dispersal *protects* the enemy creature here rather than destroying it. **White wouldn't normally want to disperse enemies here**, but it's mechanically funny and flavorful — the white knight moves the orc aside, into the kill-zone, and the orc just stands there safely.
  - **Black mostly avoids this location.** Black relies on creature-bodies for its tank-and-thorns engine, and destroy-on-flip kills bodies on arrival. Black might use the location for graveyard-recursion combos (creatures die fast, Black's graveyard fills, raise dead works overtime), but it's a costly path.

  **The general pattern:** restriction locations are **counterplay-rich for colors with positional flexibility (Green movement, Green stealth) or token-generator design (Red, Green)**, oddly-flavored-but-not-aligned for colors with sideways tools (White dispersal-as-protection-of-enemy), and net-negative for colors that rely on creature-body presence (Black). **Same applies to bounce locations and front-row-rejection locations** — restriction locations create asymmetric counterplay rather than flat-disadvantage zones.

- *"The first card you play here is destroyed."* Sacrificial threshold. Encourages a throwaway first play (or a card whose flip-up trigger is the real value). Color-flavor: Black (offering altar).

- *"The first card you play here gains +2 Force."* Sacrificial gift. Rewards committing your *biggest* card first. Color-flavor: Red (proving ground) or White (consecration).

**Race-condition locations:**

- *"First side to fill the front row here gains +2 Force at this location until end of encounter."* Tempo race. Aggressive commits rewarded; once won, the location is *spoiled* for the loser. Color-flavor: Red (battlefield), Green (race to position).

- *"First side with a full structure slot here gains +1 to all stats at this location until end of encounter."* Structure-building race. Color-flavor: White (building the temple) or Black (claiming the ruin).

**Distribution / propagation locations:**

- *"After a card flips here, give +1 Force to a random card in the same side's hand."* Spreads value to future plays. Color-flavor: Blue (transmission) or White (blessing reserves).

- *"After a card flips here, give -1 Hp to a random card in the opposing side's deck."* Slow-grind attrition into the deck. Engineering note: requires per-card-instance modifier system in deck (Pass 2 cost). Color-flavor: Black (corruption seeping into supply lines).

### Locations don't synergize with most card effects

Locations are not creatures or structures. They cannot be buffed, debuffed, equipped, attacked, or moved. They are not legal targets for any card effect *except* the destruction/restoration mechanic family (see below). They aren't in any zone. **The location text just runs**, every turn, until the encounter ends. Cards that "destroy a structure at this location" do not affect the location itself.

### Destroying and restoring location text

**Destroying a location means clearing its printed text.** The biome remains (a Red mountain is still a mountain — you can't physically erase it from the map), the implicit stat baseline remains (the +1 Force from the mountain biome still applies), but the *strategic text* that made the location interesting is **gone for the rest of the encounter**. The location decays from strategic to flavor — same biome, same baseline, no special rules.

This makes location-destruction a real mechanic family with per-color expressions:

- **Red (signature destroyer).** *Eruption*, *Avalanche*, *Wildfire*. Red destroys the interesting text of a strategic location, normalizing the encounter. Fits Red's "we don't play with the rules; we *break* them." Cost: probably high stat-presence + an action card.
- **Green (destroyer-replacer).** *Overgrowth*, *Reclamation*. Green erases civilization's text (cathedrals, libraries, ruins) by overwhelming them with nature — and replaces it with Green-flavored text, like a Forest's text printed in place of the prior text. Color-flavor: nature reclaims civilization.
- **Black (destroyer-corruptor).** *Curse the Land*, *Plague*. Black destroys *and replaces* with Black-flavored text — corruption rewriting the rules. Or pure-destruction, leaving flavor-only.
- **White (restorer and protector).** White has *two* primitives in this family, both on-flavor for faithful preservation:
  - **Restoration** (one-shot action). *Sanctify*, *Restoration*. Re-prints text that has been cleared. White can restore a destroyed strategic location to its original text, or more aggressively, *replace* a Black-corrupted location's text with the original. After-the-fact recovery.
  - **Prevention** (structure-ability). *Sanctuary*, *Ward*. A White structure that, while in play here, prevents this location's text from being destroyed. *"While this is in play here, the location text at this location cannot be destroyed."* Before-the-fact ward. The standing defense rather than the cleanup tool. Different costs, different deck-building decisions: prevention is proactive, restoration is reactive. White prints both; the player chooses based on which threat is anticipated.
- **Blue (suspender, not destroyer).** Blue doesn't destroy ground-truth; Blue *suspends*. *"Until end of turn, the location text at this location does not apply."* Suspended text returns at end of turn. Different primitive: temporary disablement, not permanent erasure.

**Whether destruction is reversible by the *opponent's* White restoration is an open question.** Probably yes — White's identity is restoration regardless of whose destruction it reverses. So Black corrupts a White cathedral; opposing White's restoration card brings the original text back. **Cross-color land warfare** becomes a real strategic dimension: locations can be flipped between flavors over the course of an encounter, with each side investing actions to claim/clean the ground.

**Pass 2 / v5+ open questions on this:**
- Does location-text destruction persist *across encounters* on the overworld, or only for the current encounter? Probably persists, since locations are part of the overworld map state — if you Eruption a strategic location, that node stays a flavor location for the rest of the run unless restored.
- Does Green's destroyer-replacer pattern overprint *Green* text or generic forest text? Probably generic forest — the destroyer doesn't get to print custom text, just replace with their color's biome default.
- Are there *neutral* destruction effects (e.g., from neutral encounters that pre-destroy specific locations on the map)? Probably yes, as run-shape variance.

### Graceful degradation in single-location prototypes

**Many strategic location texts depend on multi-location geometry.** Front-row-rejection moves creatures *to another location* — with one location, there's no destination, so the rule is non-functional. Distribution-style location text ("after a flip here, give X to a card at another location") similarly no-ops with one location. **This is a design feature, not a bug.** It means location text is *forward-compatible*:

- v0/v1 prototypes (single-location encounters) can include strategic locations whose text depends on multi-location geometry — the text just doesn't activate. The location still has its biome theme and stat baseline; the strategic text is silent until v2+ multi-location lands.
- The location-text design space *naturally* graceful-degrades. No need to gate location-text-printing behind v2+.
- The *richness* of strategic locations scales with the map. Single-location plays them as flavor locations; multi-location activates their full effect.

### Held as Pass 2 / v3+

Most location-text mechanics are deferred until v2-v3 prototypes have multi-location encounters running. The framework is captured here so when biomes start mattering, the design space is ready to print into. Specific location-text effects above are working drafts — refinement and balancing happens once the game is actually multi-location and players can route between biomes.

## Encounters: unified hostile/neutral framework

**Every player overworld move triggers an encounter.** There is no separate "neutral movement" path where the player walks onto an empty node and gets a menu of rewards. Whatever happens at the destination — combat with the AI, engagement with a neutral puzzle, nothing at all, or any combination across the encounter's locations — happens through the **same multi-location, simultaneous-commit, Tempo-ordered system** the rest of the game uses.

This is the single most-load-bearing design unification in the project: **Pillar 10 (no on-resolve targeting) applies uniformly to the whole game.** The reward-selection mechanic is no longer a Slay-the-Spire-style menu where the player picks from a list. It is the same position-and-commit puzzle that combat is.

### What's at each location

When an encounter triggers, each location can be in one of three states (or a mix during play):

- **Hostile** — the AI has cards present, placed during the AI's overworld mini-turns.
- **Neutral** — a pre-authored neutral encounter (one or more **neutral cards**) is present at the location. Neutral cards are not in any deck; they're authored *into the location* by map generation, similar to how strategic location text is authored.
- **Empty** — nothing is present.

A single encounter can have any combination across its locations: 2 hostile + 1 neutral, 3 neutral + 0 hostile, 1 hostile + 2 empty, etc. **The player does not know the distribution in advance** — locations are face-down to the overworld view and resolve only when the encounter starts.

### Encounter-start reveal applies to neutral cards too

The universal-stealth flip-up rule (see *Fog of War & Reveal*) applies uniformly to every face-down card on the encounter board, regardless of side:

1. Player arrives → all face-down state at all locations is "stealthed" for the player's view.
2. Round 1 upkeep runs → at end of upkeep, everything flips up in Tempo order.
3. AI cards reveal their identities. Neutral cards reveal *what kind of puzzle this location is*. Player commits in round 1 main with full information about the encounter shape — but only after upkeep, so flip-up triggers (including those on neutral cards) have already fired.

### Engagement is the cost of reward

**Neutral encounters do not pay out for free.** The puzzle is structured so that *only by committing player resources to the neutral location* does the player extract the reward. A neutral card may print things like:

- *"At end of cleanup, this removes itself and one other creature here from the game."* — Reward: deck-thin, but only if the player committed a creature to this location.
- *"At start of upkeep, a friendly creature here gains +1 Force permanently."* — Reward: stat-bump on a chosen creature, but only if a friendly creature is at this location to receive it.
- *"When this is destroyed, draw 3 cards."* — Reward: card flow, but only if the player invests Force/Tempo to actually kill it.

**No commit = no reward.** A player who skips a neutral location during the encounter walks away with nothing from it.

This creates the puzzle's central tension: **the player has limited hand cards and limited slots, and an encounter may have multiple neutrals plus hostile combat**, all demanding resources at once. With 2-3 neutral encounters in the same multi-location encounter, the player must choose which to engage with based on what they drew, which combat they need to fight, and which rewards their run actually wants. **Stretched-thin-by-choice is the puzzle.**

### AI consumption of neutral encounters (overworld)

When the AI takes its overworld mini-turn at a node, the act of playing into that node **consumes any neutral encounter that was authored there.** The neutral cards are removed; the location becomes a hostile location with AI presence. The neutral reward is gone — and the player will never see it.

This is the single most-important tempo pressure in the run: **every neutral encounter the AI eats is a permanent reward loss.** The player cannot delay forever; routing must consider not just "how do I survive the boss" but "which rewards can I claim before the AI eats them."

Implications:

- The AI's spread heuristic should *prioritize* spreading into high-value neutral encounters, especially when the player is far away. The AI is racing the player to the rewards.
- Routing decisions become *tactical*, not just strategic — the player picks the path through neutrals their deck can solve, before the AI eats them.
- A neutral encounter the player ignored persists at the node. It can be reclaimed on a return visit if the AI hasn't eaten it.

### AI presence at a neutral location *during* an encounter

The overworld consumption rule (above) fires only on the AI's overworld turn. **During an encounter that's already underway**, the AI may still play cards into a neutral location, by mirroring the same adjacency rule used on the overworld:

- **If the AI has presence at any other location in the same encounter,** then any neutral location in that encounter is a legal play target for the AI's own commits during the encounter's main phases.
- **The AI does not start the encounter with cards at a neutral location** — if it had, the overworld consumption rule would already have stripped the neutral nature, and the location would not be neutral at encounter start.
- **The neutral cards are not removed by AI in-encounter commits.** The encounter-time consumption rule is different from the overworld consumption rule. The siren still resolves at end of cleanup; an AI Recruit committed to the siren's location during round 1 main just sits next to the siren.

This creates a *contested neutral* dimension: the AI can move in to **race or deny the reward**:

- **Racing:** the AI commits to a neutral location to share in / contest the reward. If the siren picks "another creature here" at random, an AI creature at the location is just as likely to be picked as a player creature — the player gets random partial reward at best.
- **Denying:** the AI floods the neutral location to make the puzzle harder for the player. Slot pressure, stat dilution, anti-coordination plays. Some neutral cards' triggers become impossible to claim cleanly with the AI muddying the water.

### Neutral cards are a third party on the board

Neutral cards belong to *neither* player. Some specifics that fall out:

- **Stat presence:** neutral cards do **not** contribute to either side's per-side per-location stat totals. They sit on the board as "neutral entities" — visually distinguishable from player and AI cards, mechanically neither.
- **Targetability:** neutral cards *are* legal targets for both sides' effects (Pull, Counterspell, damage spells, dispersal, etc.). The player can blow up the siren before it triggers if they have the right answer. The AI can do the same. But neutral cards are typically **printed with high Durability** so they're hard to destroy — the puzzle is meant to be engaged with, not bypassed.
- **Neutral-target text:** when a neutral card prints "another creature here," the implicit pool is **non-neutral creatures only** (player + AI creatures), not other neutral cards. A siren never accidentally consumes a sister-siren at the same location. (Per-card text may explicitly include neutral cards if a designer wants — the rule is a default, not absolute.)
- **Combat:** neutral creatures with printed Force *do* attack — at whom is determined by the card text (typically attacks the nearest enemy on either side, or per its printed pattern). Most neutral encounter cards have Force 0 and exist as puzzle elements rather than combatants, but the option is open.
- **Deathwish, flip-up, and other triggered abilities** all work on neutral cards normally — they're just permanents with no owner.

### The neutral-encounter puzzle archetype matrix

The full design space for neutral encounters is **(reward type) × (puzzle shape) × (biome / color flavor)**. A few canonical archetypes to anchor the vocabulary — these are sketches, not card-finalized prints:

- **Siren (Blue, coastal/Insight)** — *Deck-thin reward.* Print: *"Durability 4. At end of cleanup, this removes itself and one other non-neutral creature here from the game."* Player commits a card to the location to feed it; siren removes itself + that card at cleanup. Smart play: dump a dead-card draw for permanent removal. AI-contested play: the AI parks a creature here to dilute the random pick. Counter-counter: the player commits *two* cards here to bias the random toward their unwanted card.
- **Wishing Well (White, civic/Resolve)** — *Summoner heal reward.* Print: *"Durability 5. At end of cleanup, if a friendly creature is here, restore 2 Durability to that creature's owning summoner. Then this loses 1 Durability."* Player commits a creature; well heals their summoner; well slowly degrades over multiple encounters until destroyed. Ferry creatures here over multiple visits for sustained healing.
- **Forge (Red, mountain/Force)** — *Stat-bump reward.* Print: *"Durability 6. At start of upkeep, the highest-Force friendly creature here gains +1 Force permanently. Then this loses 1 Durability."* Player commits a creature, ideally their biggest, to absorb the buff. Persists across encounters as long as Durability holds.
- **Bramble Patch (Green, forest/Tempo)** — *Card-evolve reward.* Print: *"Durability 4. At end of cleanup, if a friendly creature is here, that creature's card permanently gains +1 Tempo. Then this is destroyed."* One-shot evolve, only to a Tempo-friendly target.
- **Cursed Altar (Black, swamp/Spite)** — *Sacrifice-for-power reward.* Print: *"Durability 3. At end of cleanup, if a friendly creature is here, that creature is removed from the game. Then add a Demon card to your deck. Then this is destroyed."* Player offers a sacrifice for a deck-add. Strong pull for runs that have a creature they want to graduate out of the deck.

Per-biome, per-color, per-reward-type can be mixed. A *Cathedral Forge* (White+Red) is plausible — a stat-bump puzzle with a Resolve flavor (channels rather than instant). A *Cursed Bramble* (Green+Black) is a corrupted evolve that adds AND removes a card.

**Authoring volume:** the v3+ release probably wants 30-50 distinct neutral encounter archetypes, growing over time. They're individually small content units (a few stats + one rule) and parallelize well across design sessions.

### Cross-location synergy via the unified encounter

Because the encounter is a single multi-location simultaneous board, neutral and hostile locations interact in tactically rich ways:

- **Disperse-to-neutral.** Use White's enemy-dispersal mechanic to push a hostile AI creature *into* a neutral encounter where it gets consumed by the puzzle. Effectively free removal.
- **Dump-bad-card-at-neutral.** Drew a card you don't want this encounter? Commit it to the siren or cursed altar — it gets removed from the deck, smoothing future hands. Two-birds: you address combat at the other locations and improve your deck simultaneously.
- **Ferry-creature-to-neutral.** v3+ cross-location movement (when added) lets the player move a creature to a healing or buff neutral after combat. Use combat to position, then move.
- **Pull-to-neutral.** Pull a card from the AI's hand into a neutral encounter location. Force the AI's card to land in a kill-zone where it gets consumed.
- **Token-feed-the-neutral.** Token-generator cards spawn permanents at the neutral's location that the puzzle eats — sacrificial tokens specifically to feed neutrals without losing real cards.
- **Engagement-rate trade-off.** If the player is overwhelmed by hostile combat at one location, they can let a neutral go un-engaged this encounter and come back next visit (if the AI hasn't eaten it).

### Why this design unification is the structural backbone

This framework retroactively sharpens several existing design pillars:

- **Pillar 10 (no on-resolve targeting)** becomes universal. There is no remaining mode of play where the player picks from a list. Everything is position-and-commit.
- **Pillar 4 (fog of war is mechanical)** gets a richer expression. The unknown at each location is now *kind* of presence (hostile / neutral / empty), not just *identity* of cards.
- **Pillar 6 (tempo tension across the run)** becomes immediate and visible. Every neutral the AI eats is a lost reward. Routing has continuous, quantifiable stakes.
- **Pillar 1 (the map *is* the battlefield)** becomes more literal. Every location is *something* — a puzzle, a fight, or empty — not just an empty grid waiting for cards.
- **The mechanic-families work pays off again.** Lurk, Coward, Pull, deathwish, vehicles, stealth, dispersal — every keyword has a natural neutral-encounter expression. Neutrals are *new design space that uses old mechanics*, multiplying the value of every keyword we've already designed.

### AI retreat (encounter-end condition for non-boss hostile encounters)

**Most encounters end by AI retreat, not by reducing a summoner to 0.** The AI is a faction spreading across the map, not a single-summoner opponent (until the boss). When the AI's forces at a contested location are *effectively spent and can no longer threaten anything*, the encounter ends — the player is declared the encounter-victor, the location becomes neutralized, the player advances.

The retreat-end condition handles a real problem: without it, an AI with no creatures and a hand of unplayable actions (e.g., spells that need Insight presence the AI no longer has) would make empty turns *forever*, dragging the encounter out indefinitely with no path to summoner damage and no concession mechanism. Some win condition has to fire.

**Retreat condition (working heuristic):** the AI retreats when it has no plays available and is making no progress for several consecutive turns. Concrete signals to combine:

- **No creatures in play** at any of the encounter's locations.
- **No payable cards in hand** (the AI's hand-cards all fail their cost-check at every location given current presence).
- **No realistic path to recovering** in the foreseeable future (heuristic: empty deck or near-empty deck with no compatible cost-enablers).
- Sustained over **2-3 consecutive turns of zero plays** to avoid premature retreat from a brief lull.

The exact thresholds tune via playtesting. The principle: *if the AI is in an unrecoverable position and the player is still making progress (or even just stalling without losing ground), the encounter is over*.

**Critical exception: the boss-encounter at the exit.** The boss *is* a summoner with Durability, not a faction-with-spreading-forces. **Retreat does not apply at the boss node.** The boss never gives up. The win condition there is the original one: summoner Durability to 0. You fight to the kill.

This sharpens the asymmetry between non-boss and boss encounters:

- **Non-boss hostile encounters end by AI retreat** when forces are spent. No summoner damage required. Fast, decisive — the player wins by *clearing the threat*, not by killing a summoner.
- **The boss encounter ends by summoner damage.** No retreat option. The player must reduce the boss to 0. Slower, climactic — the player wins by *finishing the kill*.

**Implications:**

- **Spell decks force retreat faster.** If the retreat condition is "no creatures + no payable cards", spell decks that pressure both the AI's creature board *and* its action economy can grind out faster wins. Blue's queue manipulation (Counterspell, Stifle) accelerates retreat by depleting the AI's playable hand.
- **Player-summoner damage from spell fall-through is *less* important in non-boss encounters.** Per the damage fall-through rule, a Spark fired into an empty AI location hits the AI's *summoner* — but the AI has no summoner-as-creature at non-boss nodes. **Working interpretation:** at non-boss encounters, summoner-damage spells deal damage to the *AI's overall faction durability* (a per-encounter or per-run pool), or simply *count toward forcing the retreat condition* without an explicit Durability tally. Pass 2 detail to pin down. **At the boss-encounter, spell fall-through hits the boss-summoner's Durability normally.**
- **Player retreat?** Working assumption: **no**. The player is the attacker who initiated the encounter. They commit and either win (force AI retreat or kill the boss) or lose (Durability to 0). The asymmetry is intentional: the AI is a faction that can withdraw; the player is a pawn with a destination.
- **Structures left behind on AI retreat.** Working assumption: AI structures vanish on retreat (the faction took them). Open question — could they remain as captured neutral terrain instead? Probably cleaner if they vanish and the location reverts to neutral-or-empty for next time.

**Implemented in v3 (2026-05-02).** Originally scheduled for v4, but the first v3 playtest produced the stall scenario the design predicted (AI deck cycled into unpayable cards, only a structure remained, no path to encounter end). v3 implements the rule as an **end-of-turn evaluation** that captures both halves of the retreat trigger:

- **No living presence:** zero AI creatures committed at any encounter location. **Structures are not living presence** — they're infrastructure (per the design definition: structures are by-design excluded from combat, occupy a separate slot type, are not living beings). A faction with only buildings has effectively been beaten.
- **No reinforcements this turn:** captured implicitly by checking at end-of-cleanup. By that moment, the AI's main-phase placement opportunity is over and combat has resolved. If there are zero AI creatures at this moment, the AI had its full turn and managed no living presence on the board.

When both conditions are true at end of cleanup (and the encounter is non-boss), retreat fires: the encounter ends as a player clear, any remaining AI structures vanish (the faction withdrew with them). Boss encounter exempt (boss has Durability and never retreats — clear via summoner damage).

The mid-turn variant (checking after every creature death) was tried first and rejected: it could prematurely end an encounter when the AI was about to reinforce next turn. End-of-turn evaluation is the right grain — give the AI a full turn to bring in living forces; if it failed, retreat.

### Held as Pass 2 / v3+

Implementation is deferred to v3 prototype work alongside the overworld map and AI spread mechanics. v2 is multi-location encounters without neutrals. v3 introduces the overworld map (with hand-authored neutrals at start), the AI spread engine, and the AI retreat encounter-end rule for non-boss hostile encounters. The framework, archetype matrix, and rules clarifications are captured here so the design space is ready to author into when the prototype gets there.

**Open questions for Pass 2:**

- *Map-generation algorithm.* How are neutral encounter archetypes distributed across the map? Random per-biome from a pool? Curated routes? Some mix? Probably hand-authored seeds in v3, procedural generation in v4+.
- *Reward scaling with map depth.* High-value neutrals near the boss, low-value near the start? Or roll dice per node? Per the difficulty-curve principle, deeper-route neutrals should pay out more *and* be harder to access (more contested by AI).
- *Persistence detail.* When the player ignores a neutral, does it remain *exactly* as it was, or does its state degrade somehow (e.g., a Forge that loses 1 Durability per overworld turn even if untouched, simulating natural decay)? Probably persists as-is — keep the rule simple.
- *Neutral cards in tutorial mode.* The first run probably needs a controlled introduction to neutral archetypes so players aren't overwhelmed by random puzzles. Pass 2.
- *Multi-card neutral encounters.* A single neutral encounter might be *multiple* cards at the location (a siren AND a treasure chest, locked together by rules text). Or always one card per location? Open. Working assumption: one card per neutral encounter, multiple neutrals can coexist at *different* locations within the same encounter.
- *Boss-encounter neutrals.* Does the boss node have a neutral encounter component? Probably yes — *the throne room* might have a neutral element (the throne, a ritual circle, etc.) that the boss fight orbits around. Pass 2.

## Persistent Actions

A *persistent action* is an action subtype that occupies its action slot **across multiple turns**, rather than resolving and exiting at end of phase like a normal action. Three persistent-action archetypes have been designed:

### Prayer (White / Resolve)

- **Played** like any action, into an action slot at a location.
- **Does not** leave the action slot on resolution. It **stays** until either fully resolved (channel complete) or removed.
- **Has a printed `pray N` cost** — the channel-progress counter, initially N.
- **Each turn, every Resolve-printing creature on the same side at the same location automatically contributes 1 to the prayer's progress** per Resolve point. (e.g., 4 Resolve at the location reduces remaining cost by 4 that turn.) Contribution is automatic; channeling is not a choice.
- **Has a printed timing trigger** — "on upkeep," "after cleanup," "at end of main." This is *when* the prayer can resolve.
- **Resolves** when remaining cost reaches 0 *and* the timing trigger fires that turn. On resolve, the prayer's effect happens and the prayer goes to graveyard.
- **A creature that took damage this turn does not contribute its Resolve to channeling this turn.** (Damage interrupts channeling — only for the damaged creature, not all Resolve creatures at the location.)
- **Action-slot occupancy:** the prayer occupies the slot the entire time it is channeling. Other actions cannot be played into that slot.
- **Multiple prayers at the same location:** if a location has multiple action slots and multiple prayers are channeling, *each* prayer receives the full local Resolve contribution per turn (Resolve is presence, not a consumable).
- **Cost-shape note:** Prayers have **no stat-presence requirement to cast** (see *White's cost-shape* under Color Identities). The channel cost is the cost. This is why a Prayer can be speculatively pre-positioned at a location with no Resolve yet present.
- **Effects:** powerful, normally above the curve for one-shot actions — conditional removal, "summon a random card from your deck into play here," large board effects. The multi-turn channel is the cost-justification.
- **Vulnerable to:** combat damage to the channeling creatures (interrupts that turn), Counterspell (kills the prayer outright).

### Curse (Black / Spite)

- **Played** by you into your own action slot at a location.
- **On reveal:** the curse **migrates** from your action slot to the *opposing* side's action slot at the same location. From then on it occupies their slot and applies its persistent debuff each turn.
- **Migration can fail:** if the opposing side's action slots at that location are all full at the moment of migration, the curse cannot move and **stays in your own slot** — you are stuck with your own debuff.
- **Speed inversion:** because actions reveal in Tempo order and slots clear as actions resolve, **slow curses (low Tempo) reveal *after* enemy action-slot cards have resolved and exited**, finding empty slots more reliably. **Fast curses are *worse*** because they reveal early when enemy slots are still full. This is the rare mechanic in the game where low Tempo is *strictly desirable*.
- **Removed by:** Counterspell (Blue), specific anti-curse effects, encounter end (open question — see Open Questions).

#### Curse effect design discipline

Curse effects split cleanly into two design lanes that both sidestep the random-targeting issue:

- **Static board auras.** Effects that apply to *all* qualifying creatures at the location simultaneously — "friendly creatures here have -1 Force," "creatures here have Tempo -1." Static effects have no triggered "pick a target" moment; they just modify the whole qualifying set. They also stack cleanly: two -1 Force auras sum to -2 Force.
- **Player-direct effects.** Effects that target the opposing summoner directly — hand disruption ("during upkeep, the opposing summoner discards a card"), draw modifiers, summoner-Durability drains. The summoner is always a unique legal target, so no random selection is needed. This is a fresh design space distinct from board interaction: Black attacks the *player*, not the *board*, across many turns of attrition.

By contrast, **triggered single-target effects on the board** ("during upkeep, deal 1 damage to a creature here") would require a fresh random roll each tick, which feels unsatisfying for a multi-turn debuff. The design discipline is to avoid this class of curse effect.

### Counterspell (Blue / Insight)

- A signature Blue action of the *Spell* subtype. Working name; final naming Pass 2.
- **On resolve:** all actions currently in action slots at this location are sent to the graveyard. (Counterspell exempts itself.)
- This includes persistent actions (Prayers, Curses) regardless of how long they've been channeling — a Prayer 1-cost away from resolving still dies. A Curse that migrated 3 turns ago still dies.
- **Timing:** Counterspell is itself an action that resolves in Tempo order. If counterspell reveals first this phase, it nukes everything pending at the location. If it reveals late, one-shot actions with higher Tempo have already resolved and left the slot — they're safe. But persistent actions in slots are killed regardless of when counterspell fires this turn, because they're *currently in the slot*.
- **Hard counter to persistent-action strategies.** Black's Curses and White's Prayers must play around Blue presence; if Blue has counterspell available, persistent actions are vulnerable.
- **Curse vs. counterspell timing:** if both are played the same turn at the same location, Tempo order resolves it. If counterspell reveals first, the curse dies before migration. If the curse reveals first and migrates, counterspell (now in Blue's own slot) still resolves and clears the migrated curse.
- **Cost:** likely high Insight (specifics Pass 2). Itself prints minimal stats. As a Blue spell, subject to Blue's front-loaded cost-shape — needs an Insight mage at the location to cast.

### Quest (White-primary, all colors get a flavor)

A **Quest** is a fourth persistent-action archetype: a card that occupies its action slot for many turns, **does nothing visibly until its completion condition is met,** then fires a large payoff and exits the slot.

- **Played** like any action, into your own action slot at a location. Pays a small commit-cost.
- **Sits in the slot doing nothing** until its printed completion condition is met.
- **Has a printed completion condition** — a board-state, history, or accumulation predicate the player works toward across multiple turns. Examples: *"Complete: play 3 creatures here this run."* / *"Complete: deal 5 damage to the opposing summoner this encounter."* / *"Complete: have ≥6 Insight presence here at end of any phase."* / *"Complete: a friendly creature is the only creature at this location at end of any turn."*
- **On completion**, the Quest's payoff fires (typically large — bigger than a one-shot's effect, smaller than a fully-channeled Prayer's effect) and the Quest exits to graveyard.
- **If never completed,** the Quest sits forever (or until removed by Counterspell). Sunk cost: the slot was occupied without payoff.
- **Vulnerable to:** Counterspell (kills any persistent action), opposing plays that prevent the completion condition, encounter end (open question — does it survive into the next encounter? probably yes for *run-scoped* completion conditions, no for *encounter-scoped* ones).

**White is the primary home.** Quests are inherently *patient* and *faithful* — you commit early, wait for conditions, get rewarded later. This is *Religious-White* almost by definition. White's existing identity as the contemplative, faithful color maps directly: a Crusade is a Quest, a Pilgrimage is a Quest, a Vow is a Quest. White's deck-building strategy of *play your slow stuff early so it pays off late* fits Quests perfectly. Most printed Quests will be White.

**Other colors get distinct Quest flavors via the family axes:**

- **Black (Pact-Quests):** Quests where the cost continues *until* completion. *"Pay 1 Durability at start of upkeep until you have drained 4 from the opposing summoner. Complete: deal payoff."* Costly engagement, transactional, Black-flavored. The longer it takes you to complete, the more it costs.
- **Green (Hunt-Quests):** short-completion-window Quests with tempo-aligned conditions. *"Complete: a friendly creature has moved through 3 different locations this encounter."* Fast Quests, modest payoffs, fit Green's tempo identity.
- **Red (rare):** Red is the *now* color and doesn't naturally invest in waiting. A few Red Quests with *very short, immediate-completion* conditions exist as the exception. *"Complete: deal 3 damage in one combat phase. Reward: this encounter only."* Red Quests are typically encounter-scoped, not run-scoped.
- **Blue (rare):** Quests rewarding sustained denial. *"Complete: counter 2 enemy actions this encounter."* Slow accumulation of cancellation rewards, fitting Blue's denial identity but unusual for the *now*-pace of Blue's spell economy.

**Quests in the action-slot economy:** they are the *patient* counterpart to Curses' *aggressive* and Prayers' *channeled*. White can choose between Prayer (active channel: every turn moves toward resolution) and Quest (passive condition: wait for the right moment). Both clog the action slot for many turns; Quests differ in that they don't *do* anything in the meantime — no upkeep tick, no drain, no contribution. They sit and wait.

**This makes Quests structurally distinct as a third persistent archetype** (Counterspell is *not* persistent — it's a one-shot Spell-subtype action that resolves and exits the slot in Tempo order on its turn; the Counterspell-as-anti-persistent role doesn't make it itself persistent):

| Archetype | Color | Persistent? | Slot occupancy | Per-turn behavior | Resolution trigger |
|---|---|---|---|---|---|
| Prayer | White | Yes | Own slot | Channels (Resolve ticks reduce cost) | Cost reaches 0 + timing trigger |
| Curse | Black | Yes | Enemy slot (after migration) | Ticks debuff every turn | Removed (Counterspell, encounter end) |
| Quest | White-primary | Yes | Own slot | None (waits for condition) | Completion condition met |
| Counterspell | Blue | No (one-shot) | None | N/A | Tempo-ordered reveal — kills persistent actions in slots |

The action-slot economy gets richer with Quests:

- **White wants to occupy its own slots** with Prayers (active channels) *and* Quests (patient waiting). White's signature move is multi-slot commitment of slow plays.
- **Black wants to occupy enemy slots** with Curses (transferred debuffs).
- **Blue wants to clear all slots** with Counterspell.
- **Green wants to bypass slot occupancy** via tempo — Hunt-Quests fire so fast they barely register as slot occupancy.

### Action-slot economy as a meta-system

Persistent actions turn the action slot into a *contested resource over time*. Four archetypes shape deck design and play decisions whenever action slots are involved (see the Quest table above for the full taxonomy):

- **White** occupies its own slots with Prayers and Quests (multi-turn channels and patient waiting payoffs).
- **Black** occupies enemy slots with Curses (transferred multi-turn debuffs).
- **Blue** clears all slots with Counterspell (denial of all of the above).
- **Green** bypasses slot pressure with Hunt-Quests (fast-completion Quests that fire and exit before they meaningfully clog).

Persistent actions also worsen the slot-cap pressure described in *Slots are the actual scarce resource*: White's and Black's preferred plays clog action slots for many turns, leaving fewer slots for one-shot follow-ups. **Equipment** is a complementary release valve here — it provides slotless plays even when the action slot is committed.

## Color home phases and the phase-doubling mechanic

A pattern that has been implicit across the design: **each color has a *home phase* where its identity is most expressed.** The home phase is not a rules constraint — every color acts in every phase — but a flavor-and-design organizing principle. When designing a card for color X, the question "does this card express X's identity at *its home phase*?" sharpens both flavor and balance.

### Per-color home phases

| Color | Home phase | Why |
|---|---|---|
| **Red** | Combat | Red *is* the combat color. Force, attack patterns, friendly-fire, conditional-stat-printing all find their meaning in combat. Red's tactics buffs, Coward triggers, and Provocation/Challenger payoffs all fire at start of combat or during combat resolution. |
| **Green** | Main | Green *is* the commit color. Tempo, positioning, movement, and reveal-order manipulation all live in main. Green's Hunt-Quests complete during main, Green's stealth fires in response to flip-up at end of main, Green's tempo cards reward fast commits. |
| **Blue** | Draw | Blue *is* the cards-and-information color. Insight-driven draw, deck manipulation, peek effects, hand-positional triggers, and queue-suppression all root in draw. Blue's spells are economically gated by Insight presence at draw time. |
| **Black** | Upkeep | Black *is* the slow-grind color. Curses tick at upkeep, drains drain at upkeep, Lurk's reactive triggers run through upkeep, attrition compounds at upkeep. Black's whole engine is "tick, tick, tick" across many upkeeps. |
| **White** | Cleanup | White *is* the patient-discipline color. End-of-turn payoffs, cleanup-conditional triggers, Resolve retention, Quest completion checks, and hand-reordering all fire at cleanup. White's identity is "the reward at the end of the turn, after everyone else has spent themselves." |

### Why this matters

This isn't a new rule — it's a **diagnostic principle for design coherence**:

1. **A card's text is on-flavor when it interacts most strongly with its color's home phase.** A Red card with a cleanup-conditional trigger is unusual (probably cross-color or off-flavor); a Red card with a start-of-combat trigger is on-flavor.
2. **Cross-color cards become legible.** A White+Red Crusader card might fire its triggers at *both* combat *and* cleanup — a structural sign that it's genuinely dual-color, not a White card painted Red or vice versa.
3. **It explains existing decisions retroactively.** Curses tick at upkeep (Black's home phase). Tactics buffs fire in combat (Red's home). Quests complete at cleanup (White's home). Resolve retention happens at cleanup (White's home). Counterspell resolves in Tempo order during reveal (Blue's home is *adjacent* to reveal — draw → main → reveal — and Blue's spells live across all three).
4. **It surfaces design gaps.** "Does Red have a card that does something interesting at draw?" Probably not, by the home-phase principle — and that's an *acceptable* answer (Red doesn't need to operate at every phase). "Does Black have a card that does something interesting at combat?" — yes, the thorns/taunt mechanics fire there, but Black's *primary* engine is upkeep ticks.

### The phase-doubling mechanic

The strongest expression of the home-phase principle: **a card or effect that causes its color's home phase to fire twice in the same turn.** Each color gets a flagship phase-doubler, and the mechanic is a substantial design-space anchor for each color's flavor.

Per-color phase-doublers:

- **Red — Double combat.** *"This turn, the combat phase happens twice."* The turn becomes upkeep → draw → main → reveal → **combat-1** (declaration → resolution) → **combat-2** (declaration → resolution) → cleanup. Red's whole game is combat; doubling combat doubles Red's expressive moment.
- **Green — Double main.** *"This turn, the main phase happens twice."* The turn becomes upkeep → draw → **main-1** → **reveal-1** → **main-2** → **reveal-2** → combat → cleanup. Green commits twice with full information about the first commit's reveal, gaining a tempo advantage no other color gets.
- **Black — Double upkeep.** *"This turn, the upkeep phase happens twice."* The turn becomes **upkeep-1** → **upkeep-2** → draw → main → reveal → combat → cleanup. Curses tick twice. Drains drain twice. Black's slow-grind engine compresses into half the time for one turn.
- **Blue — Double draw.** *"This turn, the draw phase happens twice."* The turn becomes upkeep → **draw-1** → **draw-2** → main → reveal → combat → cleanup. Doubled card flow into the hand, doubled Insight-driven draw if applicable. **You genuinely have more cards available to play this turn** — both the quantity and the quality go up. Resolve retention only caps hand size at *end-of-turn* cleanup, not within the turn, so within-turn play is meaningfully expanded. End-of-turn discard cuts the leftover hand back to retention, but anything you played during main is already on the board.
- **White — Double cleanup.** *"This turn, the cleanup phase happens twice."* The turn becomes upkeep → draw → main → reveal → combat → **cleanup-1** → **cleanup-2**. **The value is entirely in trigger-doubling, not in discard-doubling.** Discard runs both times, but the player retains the same N cards each time, so cleanup-2's discard step is a no-op (no excess past retention). The doubled value is in: cleanup-conditional triggers fire twice (a "+X if you played exactly 1 card here this turn" payoff fires at cleanup-1 *and* cleanup-2); Quest completion checks happen twice, with cleanup-2 re-evaluating with any state changes from cleanup-1's effects; hand-positional cleanup triggers fire twice (potentially with different leftmost cards if cleanup-1's effects shifted hand state). White's home phase is the *trigger boundary*, and doubling it doubles every payoff tied to that boundary.

### Per-phase implications of doubling

Each doubling has rules implications worth naming explicitly:

**Double combat (Red):**
- Tempo initiative is **already spent** for creatures that fought in combat-1 (per the Tempo-spent principle). They fight again in combat-2 but at the back of Tempo order, or by whatever extra-combat ordering rule we define.
- Creatures that died in combat-1 are gone for combat-2.
- **Movement window between combat-1 and combat-2** is needed — players need to be able to redirect attackers/blockers given combat-1's outcome.
- **No new commits between the combats** — there's no main phase between them, so combat-2 fights with the same revealed cards.

**Double main (Green):**
- Cards committed in main-1 reveal at end of main-1 (per the existing reveal-at-end-of-phase rule), so their flip-up triggers fire and stats contribute *before* main-2's commit window.
- The player commits in main-2 with full information about main-1's reveal.
- This is genuinely double-commit — substantially more cards land per turn than any other color's doubling.

**Double upkeep (Black):**
- All upkeep effects fire twice. Curses tick twice (-2 Force per turn instead of -1 from a single tick). Drains drain twice. Ammo regen doubles. Structures with upkeep pulses fire twice.
- The round-1 universal flip-up still happens *once* — it fires at end of upkeep, and even if upkeep happens twice, the universal stealth flip-up was specifically tied to the first upkeep of the encounter, not "every upkeep." (This is a Pass-2 detail to confirm.)

**Double draw (Blue):**
- 2× the cards drawn this turn. With Insight-driven draw, this can stack — Insight presence × 2 phases.
- Both quantity *and* quality go up. Resolve retention only caps hand size at end-of-turn cleanup, not within the turn — so within-turn play is meaningfully expanded by the second draw. Cards you commit during main are already on the board by cleanup; the leftover hand cuts back to retention as normal.

**Double cleanup (White):**
- **End-of-cleanup triggers fire twice.** This is where the value lives. Cleanup-conditional payoffs ("+X if you played exactly 1 card here this turn") fire on cleanup-1 *and* cleanup-2.
- **Quest completion checks happen twice.** A Quest that just completed during cleanup-1 fires its payoff; cleanup-2 re-evaluates with the new state — completion conditions newly met after cleanup-1's effects fire on the second pass.
- **Hand-positional cleanup triggers re-fire.** Cards reading "at cleanup, leftmost in hand gains X" check twice with potentially different leftmost cards (since cleanup-1's effects may have shifted hand state).
- **Discard is effectively a no-op on the second pass.** Cleanup-1 already retained the player's N cards. Cleanup-2 retains again — no excess to discard. The discard mechanic doesn't double-down; only the *triggers tied to the cleanup boundary* get the doubled value.

### Symmetric application is the default

**Phase manipulation defaults to symmetric.** Both sides' combat phases happen twice. Both sides' upkeeps are skipped. Both sides' draws double. The mechanic affects the *turn structure*, which is shared by both players in any given round, not just one player.

The asymmetric advantage falls out naturally from the *color identity of the manipulator*, not from the rule. When Red doubles combat: the rule applies to both sides, but Red's combat-flavored creatures and triggers benefit more from doubled combat than the opponent's mage decks do. When Black skips upkeep: Black sacrifices its own Curse ticks for one turn but denies the opponent's upkeep effects too, and Black's deck shape (designed for slow-grind attrition) is built to *amortize* the lost tick across many turns of payoff while the opponent's deck shape is harder-hit.

**This is the same pattern as symmetric resource manipulation** (see *Symmetric resource manipulation* in the mechanic-families section): the rule is symmetric, the *practical advantage* is asymmetric because the colors using these effects are the ones built to benefit. White's swap-draw-and-cleanup (see *Phase-bending* below) is the most identity-locked example — both sides discard before drawing, but White's Resolve retention means White retains a meaningful hand and the opponent retains nearly nothing.

**Asymmetric variants are printed-premium.** A card that says "your *opponent's* upkeep is skipped next turn" exists in the design space, but at a higher cost than the symmetric version because there's no self-cost balancing the disruption. These are rare prints (a Curse-flavored Black variant, a Counterspell-flavored Blue variant) used as flagship targeted-disruption cards.

### Cost-balancing the phase-doubling mechanic

This is a hugely powerful effect — doubling a phase is essentially *another partial turn* for both sides, weighted toward the color whose home phase is being doubled. Cost has to match:

- **Quest-style completion conditions are the natural home.** Don't print "double combat this turn" as a one-shot action; print a *Crusade of Wrath* Quest that completes on a hard condition, with the payoff being "double combat this turn." Cost is *time-and-setup*, not just stat presence. White's Quests are the natural delivery vehicle even for non-White doublers — a Red card might *grant* a Red-doubling Quest, etc.
- **Once-per-encounter restriction caps the abuse.** Phase-doublers might be once-per-encounter or once-per-run effects.
- **Asymmetric versions cost extra** as printed-premium variants of the default-symmetric form.

### Phase-doubling as the flagship of home-phase identity

The phase-doubling mechanic is *the strongest expression* of the home-phase principle. Each color gets a flagship card — five total — that says "more of *my* phase." This:

1. Locks the home-phase concept into mechanically meaningful design space.
2. Gives each color a top-of-curve mythic-feeling card built around its identity.
3. Creates cross-color combos worth designing around (a Black+White card that doubles upkeep *and* cleanup; a Red+Green card that doubles main *and* combat — proper aggressive tempo).

**Pass 2 / v2+ work:** the rules implications (Tempo-spent across combats, no new commits between combats, etc.) need finalization before phase-doublers can be printed cleanly. The principle and the per-color card-class are captured here; the engine work waits until prototypes need it.

### Phase-bending — rearrange the phase order

A sister mechanic to phase-doubling, but operating differently. **Phase-doubling adds a phase; phase-bending rearranges the existing phase order.** Same total phases per turn, different sequence. Phase-benders are typically **one-turn-only** disruptions, used as tactical rule-breaking rather than sustained advantage. Like phase-doubling, **phase-bending defaults to symmetric** — the turn structure shifts for both sides, and the asymmetric benefit falls out from which color's identity benefits most from the new order.

Per-color phase-benders:

- **White — Swap draw and cleanup.** *"This turn, the cleanup phase happens before the draw phase."* The turn becomes: upkeep → **cleanup** → main → reveal → combat → **draw**. Both sides discard before drawing. **The asymmetric advantage falls to White via Resolve retention** — White retains Resolve-many cards in cleanup-first, opponent retains Resolve-many cards (typically 1-2 for non-White decks). Both sides go into main with their *retained* hands only, then refill at end-of-turn draw.

  **Per-color severity gradient:**
  - **White:** big advantage. High retention means White keeps a meaningful hand through the early cleanup.
  - **Blue:** mild disadvantage. Actions are commit-flexible — many can be queued during upkeep before the early cleanup fires. Blue's deck shape lets it *adapt* to the rearranged turn by dumping playable actions before they get discarded. Blue's information-and-spell identity is the natural counter.
  - **Red / Green / Black:** severe disadvantage. Their commits are creature-heavy and structure-heavy, committed in main. They can't dump everything into upkeep. They lose their hand to the early cleanup with no recourse.

  **The most identity-locked phase-bender in the design** — White's discipline-and-retention identity is *literally* expressed by the rule, and the punishment falls hardest on the deck shapes White is most pressured by (creature-heavy aggro). Blue is the natural counterplay color (action-dump pre-cleanup), which fits the existing Blue+White affinity. Names: *Vow of Silence*, *Day of Reckoning*, *The Faithful Wait*.

- **Blue — Swap main and combat.** *"This turn, the combat phase happens before the main phase."* The turn becomes: upkeep → draw → **combat** → reveal → **main** → cleanup. Combat fires *before* either side's main commits this turn — you fight with last turn's revealed permanents only, then commit fresh. Blue's information-and-disruption identity is the asymmetric edge: Blue plays *around* the opponent's expected turn structure. **Blue is also the natural home for the most varied phase-benders** — generic swaps, generic reverses — because Blue's flavor is *making the normal turn not happen*.

- **Green — Reverse Tempo order in a phase.** *"This turn, reveals at this location resolve in Tempo-ascending order."* Slowest first, fastest last. **Green-flavored coup de grâce** — Green's normal high-Tempo advantage inverts, but only at the location Green chooses. Green's ability to *control where this rule applies* (via the location-bound version) is the asymmetric edge. Reverse-Tempo also makes Curses (which favor low-Tempo for migration) suddenly run first — useful cross-color combo material with Black.

- **Black — Skip upkeep.** *"Next turn, the upkeep phase doesn't happen."* Both sides' Curse ticks, drains, upkeep buffs, ammo regen all skip. Black sacrifices its own engine for one turn to deny the opponent's upkeep effects too. **The asymmetric advantage falls to Black via attrition deck shape** — Black's deck is built to amortize the lost tick across many turns of grind, while the opponent's *non-grind* deck just loses the upkeep payoffs without compensating gains. Black eats the cost more cheaply than the opponent does.

- **Red is principally excluded.** Red doesn't *play with the rules*; Red just fights harder. Bending the phase order is too clever for Red. Red's expression in this space is the *home-phase doubling* (double combat) — additive, not rearranging.

**Why phase-bending is mechanically rich:**

- Each phase-bender disrupts the standard turn structure in a way that benefits its home color while costing the user something too. **Self-disruption is part of the cost** — symmetric application means the bender also lives with the rearranged turn. The bender's deck must be shaped to favor the new order.
- They make the **phase order itself** a strategic resource, not just a fixed scaffold.
- The *symmetric-with-asymmetric-effect* pattern (same as symmetric resource manipulation) is most strongly expressed here: the rule is symmetric on paper, but each phase-bender's home color has a deck shape that *consumes* the disruption better than the opponent's deck does.

**Asymmetric phase-benders as printed-premium variants.** A Black card that says "*your opponent's* upkeep is skipped next turn" exists as a higher-cost, more-aggressive variant. A Blue card that says "*your opponent's* main and combat are swapped" likewise. These are flagship targeted-disruption cards, costed above the symmetric versions because there's no self-cost.

**Phase-bending vs phase-doubling:** complementary primitives. Phase-doublers *add* to the structure; phase-benders *rearrange* it. Each color gets one of each: Red doubles combat (no bend), White swaps draw/cleanup (no double — White's cleanup-double is the doubler), Blue doubles draw + bends main/combat, Black doubles upkeep + bends/skips upkeep, Green doubles main + bends Tempo. Both expressions root in home-phase identity.

**A card that combines both** ("this turn, combat happens twice and main happens before reveal") would be a genuine mythic — probably exists at most as one printed card across the whole color pie, if at all.

## Deck Manipulation (per-color design space)

Deck thinness amplifies everything in this game. With small decks and reshuffle-on-empty discard cycling, drawing the *right* card at the *right* time is critical — and drawing the wrong one (Spark turn 1 with no Mage; Champion turn 1 with no Force) wastes a turn. Deck manipulation is the design space that addresses this, and each color has a natural flavor for it.

The fundamental observation: **all five colors have conditional cards that are bad to draw early.** Spark needs Insight in play. Champion needs ≥3 Force in play. Prayer needs Resolve creatures. Counterspell needs an opposing target. So *every* color benefits from being able to control draw order. What distinguishes them is **how** they manipulate the deck.

### Color flavors

- **Blue (Insight = perception):** *scry / surveil / look at top of deck.* Pure information gathering. "Look at the top N cards of your deck and rearrange them." You see the future and adjust. Most canonical, most flexible. Low-cost, high-frequency cards.
- **White (Resolve = belief):** *tutor by category.* "The next Resolve-printing creature in your deck is drawn now." More miraculous, less flexible. Tutoring by stat or card type rather than peeking. Pairs with the channeled-Prayer identity — you're asking and receiving.
- **Green (Dex = speed):** *draw-and-immediately-play / accelerated draw.* "Draw a card; if it's a creature, you may play it immediately for free this turn." Tempo manipulation rather than information manipulation. Green doesn't see the future; it acts on it before others can react.
- **Red (Force = directness):** *brute-force exchange.* "Discard a card; draw two." "Discard your hand; draw a fresh hand." Less elegant but quintessentially Red. No subtlety, just *more* cards. Risk-and-reward.
- **Black (Vit = persistence):** *return from graveyard to top of deck.* "Move a creature card from your graveyard to the top of your deck." Reincarnation rather than tutoring. The dead come back through the deck rather than directly into play (which Black already has via raise). This is *plan B* recursion — slower, sneakier, harder to interrupt because the card returns through the normal draw cycle.

### Why deck manipulation matters

Without manipulation tools, deck variance dominates outcomes — and players feel it as bad luck rather than skill. With manipulation, drawing the wrong card becomes *something the player can fix*, which makes the game feel skill-rewarding and less variance-locked.

In the v1 prototype's playthrough findings, the **single biggest source of frustration was drawing Spark before Mage**. Adding even one Blue scry-style card (a "Librarian" that lets you put a hand card on top of the deck) would meaningfully smooth Blue's curve. The same is true for every other color's conditional cards.

This is held as a *Pass 2 design space* — we'll add deck-manipulation cards as colors get more developed in the prototype. For now, named here so the design space is ready when needed.

### Open questions

- **Should deck manipulation be common (every color has multiple cheap tools) or rare (each color has one signature manipulator)?** Probably the latter — common deck manipulation defangs deckbuilding. Rare manipulation makes it a real card-design lever.
- **Does deck-manipulation interact with the AI architecture?** AI hints will need to think about deck manipulation too: "this creature should be top-decked when AI draws Spark next." That's a real engineering complication. Pass 2.
- **Cross-color deck manipulation?** A Blue card that lets you tutor for a *Resolve creature* — this is a Blue+White affinity card. Mix-in tutoring across colors is a fertile design space.

## Recon (privileged commit window)

A card or effect can grant the player a **recon sub-phase** — a single private commit window that fires *after* both sides have committed face-down in main, but *before* the reveal phase. During recon, the privileged player commits cards into slots while everything is still face-down. The opponent does *not* get a corresponding window; the asymmetry is the entire point.

### Phase sequence with recon

Without recon (default): main phase ends → reveal → combat-reveal → combat-resolve → cleanup.

With recon: main phase ends → **recon sub-phase** (privileged player commits, face-down) → reveal → combat-reveal → combat-resolve → cleanup.

Recon is a single sub-phase per turn, regardless of how many recon-granting cards are active. Multiple recon-eligible cards all commit *together* in this one window — there's no recon-of-recon, no chaining, no recursive priority. The window opens once, fills with whatever recon-eligible commits the player makes, then closes and reveal fires.

### What information the recon player has

**This is the critical clarification:** the recon player sees only **slot occupancy and card type**, not card content.

- **Slot occupancy** — they see which slots the opponent committed into (the slot is visibly occupied).
- **Card type** — which slot was filled tells them whether a creature, structure, or action was committed.
- *That's it.*

What the recon player does **not** see, and what does **not** apply:

- **Card identities** — all face-down cards remain hidden.
- **Stat contributions from face-down cards** — face-down cards are inert (the unified face-down rule), so the opponent's just-committed cards add nothing to the local stat line during recon.
- **Specific card effects, Tempo values, or abilities.**
- **Position-specific content beyond which slot is occupied.**

So recon's information is **structural and positional** — "the opponent committed something to fl and to the action slot" — not *content-revealing*. The recon player can place around opponent presence and counter the *category* of opponent action without knowing what's actually there.

### Face-down state during recon

A face-down card on the battlefield is inert: no stat contribution, no combat, no triggers, not a legal target. This is the unified face-down rule (see *Fog of War & Reveal*), and it applies during recon the same as everywhere else. The recon player therefore sees opponent slot occupancy and card type, but the opponent's just-committed cards add nothing to the local stat line yet — that happens at flip-up at end of phase.

(The AI's overworld bookkeeping treats its own cards as active for its own purposes — stat presence in supply-line calculations, accumulation of upkeep buffs across overworld turns — but for the player's view of the encounter, those cards present face-down via the universal encounter-start stealth rule and become active to the player only at flip-up.)

### Why recon doesn't break Pillar 5

Pillar 5 prohibits *MTG-style priority/response chains*. Recon doesn't create a chain:

1. **Recon is gated by a card cost** — the player has to bring or pay for the privilege.
2. **Recon is a single sub-phase, not a chain** — one window per turn, however many cards qualify all commit there together. No recon-of-recon, no recursive priority.
3. **Information remains asymmetric and one-directional** — the recon player gains slot/type info, the opponent gains nothing.

Recon is more like *MTG's flash* than *MTG priority*. Flash creatures break the "creatures are sorcery-speed" rule selectively; recon breaks the "commits are simultaneous" rule selectively. Both are sanctioned exceptions to a general rule, gated by specific card text.

### Color flavor

Recon flavor splits naturally along the *information-gathering* axis:

- **Green: creature recon.** Scouts, infiltrators, spies. *"You may commit creatures in the recon sub-phase."* Fits Green's "you don't see this coming" identity.
- **Blue: action recon.** Diviners, oracles, mentalists. *"You may commit actions in the recon sub-phase."* Lets Blue's Counterspell only fire when there's a target slot occupied, eliminating the blind-gamble problem.
- **White: limited recon (rare).** *"Once per encounter, you may commit a Prayer in the recon sub-phase."* Religious foresight as divine intervention. Pray-gated and once-per-encounter.

**Red and Black do not get recon.** Red doesn't *want* to wait — Red commits and forces. Black doesn't reconnoiter — Black grinds. The colors that lack recon are the ones whose identity is incompatible with patient information-gathering. This asymmetry is the point.

### How recon is granted

Several cost shapes are possible:

- **Action-granted recon** (most common): an action whose effect is "for the rest of this turn, you may commit one creature in the recon sub-phase."
- **Creature on-reveal recon**: a creature whose reveal grants its controller recon next turn.
- **Structure-granted recon** (premium): a persistent structure that grants recon every turn while in play. Most powerful version; requires the structure to survive.
- **Equipment-granted recon**: equipment that grants recon to the side controlling it.

### Strategic implications

**Recon converts guessing into reacting.** This shifts gameplay weight from "predict AI plays correctly" to "set up information mechanics, then play around what you learn." That's a deeper, more skill-rewarding game state at the cost of higher complexity.

**Recon resolves the Spark/Counterspell circular cost asymmetry — but doesn't trivialize it.** Without recon, Counterspell at ≥2 Insight is too expensive because most plays happen blind. With Blue action recon, the Counterspell only commits when the AI has actually committed an action. **However, recon doesn't guarantee Counterspell wins.** Counterspell still has to win the Tempo race against the action it's trying to counter — if the opposing action has equal or higher Tempo (or higher side priority on a tie), Counterspell resolves *after* the action it would have countered, finds the slot empty, and fizzles. Recon makes Counterspell *informed*, not *unconditional*. The premium cost is justified by reliable *targeting*, not by guaranteed *success*. Counterspell remains a slow card by default; making it fast enough to reliably counter requires Tempo investment, just as it always did.

**AI heuristic implications.** When recon-granting cards exist on the player's side, the AI should plan around them — *don't commit your big creature into a column you expect the player to recon-place into*. This is real AI work but tractable with hints.

### Concerns

- **UX overhead.** The recon sub-phase needs UI work: a new phase indicator, a "recon-eligible" highlight on cards in hand, a separate "advance" button for the recon-to-reveal transition. Real engineering work but contained.
- **AI awareness.** AI scoring needs metadata about player-side recon cards so it doesn't commit predictably into columns that recon would obviously target.

### Open questions

- **Does the recon player commit one card per recon-granter, or one card per type per turn?** Working assumption: recon-granters specify what *type* of card can be recon-committed (creatures vs actions, etc.). Multiple recon-granters can all be in play; their privileges combine into the single recon sub-phase. So if you have a creature-recon-granter and an action-recon-granter, you may commit one creature *and* one action during recon.
- **What if the recon'd card is itself fizzled during reveal?** E.g., the player recons in a Counterspell, then the AI's revealed action is Stifle that prevents reveals. Resolution order is Tempo-based; if Stifle reveals first, the recon'd Counterspell may not flip. Pass 2 detail.
- **Recon and movement.** Movement is available in main and combat-reveal phases. Should it also be available in the recon sub-phase? Probably yes — the recon player is taking actions; movement fits. But the design implication is that recon becomes a *broader* extra action window, not just a commit window.

This is held as a Pass 2 design space — implementation requires a new sub-phase in the engine, a new phase indicator in the UI, and recon-aware AI hints. Significant work, but the design value is high enough to justify it once card-design pressure justifies the effort.

## Relocate-on-Reveal Mechanic Class

Several effects in the game cause cards to *change location or side at the moment of reveal*. This is a coherent mechanic class worth naming explicitly so future card design has a vocabulary for it.

The general rule: **on reveal, this card may relocate** before its other effects resolve. Variations:

- **Where it can go:** same location's other slot / adjacent location / enemy side / specific slot type.
- **Failure cases:** target slot full, no legal destination, etc. — and what happens then (stays put / fizzles / different fallback).
- **Side controlling the destination:** your side / enemy side / neutral.

Confirmed instances, by color and effect:

| Effect | Color | Target | Destination | Ownership change | Notes |
|---|---|---|---|---|---|
| Shift / move | Green | self-creature | empty friendly slot at same location | unchanged | The default movement mechanic — every creature gets one shift per turn |
| Curse migration | Black | self-action card | enemy action slot at same location | **changes** — opponent now holds your card | On-reveal of a Curse |
| Bodyswap (intercession) | White | friendly creature | swap positions | unchanged | Defensive — "I take your place" |
| Stealswap (possession) | Black | enemy creature | swap positions | **changes** — they become yours | Coercive — rare and premium |
| Shove (push back) | Red | enemy creature | enemy back row, same column | unchanged | Aggressive displacement; loses positioning value |
| Disperse — creature (prayer) | White | enemy creature | enemy slot at adjacent location | unchanged | Removes a threat from this fight without killing it (multi-location only) |
| Disperse — action (redirect) | Blue | enemy queued action | enemy action slot at adjacent location | unchanged | Redirects a queued action elsewhere; the action persists, just somewhere else (multi-location only) |

Three distinguishable subclasses:

1. **Move** — single-creature relocation to an empty space, ownership unchanged (Green's signature, default movement).
2. **Swap** — two-creature exchange of positions, may or may not change ownership (White bodyswap, Black stealswap).
3. **Displace** — *enemy*-only relocation, ownership unchanged but position worsened or removed-from-fight (Red shove, White creature disperse, Blue action disperse).

The displace subclass is the most generative one. It applies cleanly across:

| | Creature target | Action target |
|---|---|---|
| Send to enemy's other slot (same location) | Red shove (back row) | Black curse migration (enemy action slot) |
| Send to enemy slot at adjacent location | White creature disperse | Blue action disperse |

Same primitive — *move it elsewhere without taking ownership* — applied to two card types and two destination scopes. Each cell of this matrix gets a different color flavor:

- Red shove is *brutal force* against creatures.
- Black migration is *cunning theft* against your own actions (you sent your bad effect into their slot).
- White creature disperse is *prayer redirection* against creatures.
- Blue action disperse is *information-driven redirection* against actions.

Note Blue's action-disperse is parallel to White's creature-disperse: same destination shape, different target type, different color flavor. **Blue redirects magic; White redirects bodies. Same mechanic, two complementary applications.**

Future effects in this class might include action handoff, "play this at an adjacent location instead," summoner-side relocation effects, or more nuanced displaces (e.g., "swap this enemy with their own back-row creature" — forced internal repositioning). Pass 2 will lock the keyword vocabulary; working terms now: "shift" (Green move), "migrate" (Black curse), "bodyswap" (White swap), "stealswap" (Black swap), "shove" (Red displace), "disperse" (White displace), "agile" (premium second-move-per-turn; see below).

### Resolve-time legality and fizzle

Relocate effects commit at one phase and resolve at end of phase, which means **the destination can change between commit and resolve**. Per the double cost-check rule, relocate effects fizzle if the destination is illegal at resolve time:

- **Move/shift fizzles** if the target empty slot becomes occupied by another reveal in the same phase.
- **Bodyswap fizzles** if the target friendly creature is destroyed before reveal, or moves elsewhere.
- **Shove fizzles** if the target enemy creature's back row gets occupied (by an enemy commit this turn) before reveal — the displaced creature has nowhere to go.
- **Disperse fizzles** if the target enemy creature dies before reveal, or if the destination location has no legal slot.

This makes relocate effects a **gamble on board state**: you commit expecting a destination to remain available, but a careful opponent can shape their plays to deny that destination. **Red shove against a wide-stacked enemy column fizzles**; against a tall single-threat column it lands. The same card has very different value depending on opponent positioning.

Open questions: when does relocation resolve relative to other on-reveal triggers? Can a relocated card *also* fire its other on-reveal effects, or is relocation the entire reveal effect? What if a creature is moved while combat is mid-resolution? Pass 2.

### Combat-phase movement (`agile` keyword)

**Default rule:** a committed creature can move once per turn, in *any commit window* — currently main or combat-reveal. The single move per turn is preserved; the player chooses *which* commit window to spend the move in.

The two windows have very different strategic profiles:

- **Move in main:** your move is committed *before* AI's plays are revealed. The AI can react to your repositioning in their own commits. Early-window movement is *signaled* — opponents see where you've gone before they finalize their plays.
- **Move in combat-reveal:** AI's plays are already revealed. Your move is *informed* by full board information. But by combat-reveal the AI's plays are locked, so you've also passed up the chance to influence the AI's positioning.

Moving early reveals your position; moving late exploits revealed information. **The same mechanic — movement — has a cost-benefit profile that varies by timing.** This is one of the primary depth axes of the design.

Example combat-reveal dodge:

1. End main → reveal → enter combat-reveal. Previews show.
2. Player sees AI's revealed plays. Suppose AI committed Champion at fr.
3. Player moves Skirmisher fr → fl, dodging the Champion's column.
4. Player commits any actions. Click Resolve Combat.
5. Combat resolves: AI Champion fr swings into empty fr → hits player summoner directly (4 damage) instead of killing the Skirmisher.

### `agile` keyword (premium movement, future)

While default movement is one move per turn across windows, an `agile` keyword (probably Green-flavored, possibly granted by equipment like boots) is held open for **a second move per turn**. An `agile` creature may move *twice* — typically once in main and once in combat-reveal, or twice in the same window if rules permit. This is a premium ability, not the default; only specific cards print or grant it.

**Sources of `agile`:**
- Printed on specific creatures (e.g., a fast Green Scout)
- Granted by equipment (e.g., Boots that grant `agile` to the wearer)
- Granted by global effects (a structure that says "all creatures here gain `agile`")

**Combat preview implication:** the preview during combat-reveal shows what *would* happen if the player advanced without further action. As the player moves creatures or commits actions during combat-reveal, the preview re-renders to reflect the new state. This is how the prototype already handles it.

**Open questions:**
- Does `agile`'s second move have any restrictions (e.g., must be a different window, must be a single direction)? Pass 2.
- Can `agile` creatures be the *target* of swap effects committed during combat-reveal? Probably yes — White's bodyswap committed during combat-reveal would resolve in Tempo order at end of combat-reveal. Pass 2.

### Spatial targeting vocabulary

Two distinct spatial vocabularies exist and need separate keywords:

**Attack-pattern keywords** (how a creature's attack reaches additional spaces beyond its main target — describes a *trajectory from attacker outward*):

- **cleave** — attack hits same row (horizontal AOE)
- **pierce** — attack hits behind the target (column-depth AOE)

**Slot-targeting keywords** (used in card text like "swap with a friendly creature ___ at this location" — describes *spatial relationships among slots*):

- **here** — same location (already used for scope; default).
- **adjacent** — 1-step neighbor (front↔back same column or left↔right same row). In a 2x2 grid each slot has 2 adjacent neighbors. Diagonals are *not* adjacent.
- **row** — same row at this location. *"Swap with a friendly creature in the same row."*
- **column** — same column at this location. *"Buff each creature in the same column."*
- **in front of** / **behind** — directional column reference. *"Move to the slot in front of this creature."* / *"The creature behind this gains +1 Force."*

The two vocabularies share no keywords. `cleave` and `row` both describe horizontal spatial relationships, but they're not interchangeable — `cleave` is *attack trajectory*, `row` is *slot relationship*.

Note: in larger location grids (e.g., 3x3), `adjacent` extends to 4 neighbors per inner slot. `row` and `column` extend to all slots in the line, not just immediate neighbors. The vocabulary scales naturally.

## Swap Mechanics (Bodyswap and Stealswap)

Two confirmed instances of the swap subclass within the relocate-on-reveal family. Both involve **two creatures exchanging positions** at the moment of reveal — one ends up where the other was, and vice versa.

### Bodyswap (White)

**Flavor:** intercession, sacrifice, "I take your place." A protector steps into harm's way so an ally doesn't have to.

**Mechanic:** swap this creature with a *friendly* creature in a specified slot relationship (typically `adjacent`, `in front of`, or `row`). Defensive use — a high-Spite tank steps forward into a low-Durability creature's slot, absorbing the threats that were aimed there; the wounded creature retreats to safety.

**Cost:** small Resolve presence (typical White gating). Likely an action card or an on-reveal trigger printed on a creature.

**Pairs with:** White's healing identity (swap a wounded creature out of harm's way, then heal it next turn). Also pairs with Spite-heavy splash creatures whose tankiness is the *point* of the swap.

### Stealswap (Black)

**Flavor:** possession, body-snatching, soul exchange. Black's transactional engagement turned spatial. *I take what is yours; you receive something of mine in exchange — but always at the worst possible time for you.*

**The basic shape.** A stealswap card targets a card on the other side at the same location. On resolve:

1. The targeted card moves to your side at this location, occupying the slot vacated by the swap card.
2. The swap card itself moves to the other side at this location, occupying the slot the target vacated.
3. Net: one card moves each direction. Both sides keep the same card count at the location.

#### The whiff rule (universal across swap cards)

If no legal target exists at resolve time, the swap card **still moves to the other side**. You played a card from your hand; it's now an enemy threat; you got nothing back. This is intentionally punitive — *whiffing on purpose is a real strategic option* (see *Deck-thinning via whiff*, below) — so the whiff penalty must be brutal to keep that decision interesting.

#### The swap card itself is the cost

Unlike Recruit or Convert (which require stat-presence cost-payment), stealswap has **no payable cost**. The currency is *willingness to hand the enemy a real threat in exchange for a chance to take theirs*. Stat-presence requirements at the location aren't what gates stealswap; the loss of the swap card is.

This is a unique cost-shape across the conversion verbs:
- *Recruit* (Red): stat-presence cost (Force-superiority).
- *Convert* (White): stat-presence cost (Resolve overheal + Force threshold).
- *Reroute* (Green): temporal cost (delay until card leaves play).
- *Research* (Blue): resource cost (Insight presence).
- **Stealswap (Black): material cost — the swap card itself goes to the enemy.**

Five distinct cost currencies; each verb is balanced via a different lever.

#### High-threat printing as cost-balancer

The more powerful the swap card's printed stats and abilities, the better the trade can be (you can size up the steal target via threat-parity), but the worse the whiff scenario gets. **Designers tune the stealswap trade by the swap card's threat output.** A weak Nightmare = free card-steal (broken). A strong Nightmare = real threat-as-compensation (balanced). Each stealswap card sets its own balance via its own stat printing.

#### Card-type matching

A creature-stealswap takes a creature, replaces with the creature swap card. An action-stealswap takes an action, replaces with the action swap card. Same for structures and equipment. **Types must match — no cross-type swaps.** This keeps the slot semantics clean (a creature can't end up in an action slot, etc.).

#### Multi-slot resistance is emergent

A 2-slot creature has no 1-slot Nightmare to take its place; the swap can't physically resolve. **Multi-slot creatures are *swap-resistant by default*** — an emergent immunity for the multi-slot design space, free of any extra rules. Theme: multi-slot creatures are too big to "scare into joining."

#### Pillar 10 setup is the win condition

Stealswap on a random target = coin flip. Stealswap on the *only legal candidate* = guaranteed grab of exactly what you want. Setup tools (Bully push, Reroute counter, positional movement) become Black-supporting plays — and most of them are *other colors' cards* enabling Black's identity. Cross-color combos:

- Red pushes to isolate; Black swaps the isolated target.
- Green reroutes the reinforcement to your pile; Black swaps the target they need.
- White's Bodyswap repositions defensively; Black's Stealswap repositions to enable a steal.

#### Pillar 5 clean

Faster cards resolving first is already legal. Swap intercepts the slower card's destination — it doesn't initiate a stack/response chain.

#### Acquired card behavior

- **Acquired creature.** Acts normally on your side from the swap turn forward. Its attack pattern now points at its original allies. Damage taken before the swap rides with it (the wound persists). At end of encounter, the creature reshuffles into *your deck* — **permanent acquisition**.
- **Acquired action.** Resolves *from its new position*. Card text resolves with "your side" / "the other side" interpreted from the action's new location. So a damage action that was meant to hit the original caster's enemies now hits the *original caster's own creatures*. The card itself ends up in your discard (or whichever pile its native rules dictate) after resolving — yours from now on.
- **Per the universal damage-fall-through rule**, if the side targeted by the swapped action has no creatures, damage falls through to the targeted summoner.

#### The action-stealswap brutal whiff

When an action-stealswap whiffs (no enemy action to swap with) and the action prints damage, the damage fires from the swap card's *new* position (enemy side). Damage hits *your* side. If your side has no creatures here, damage falls through to *your* summoner. This is the whiff penalty: card gone, your creatures or summoner damaged. **The brutality is load-bearing** — it makes the deck-thinning-via-whiff strategy a real, costly choice rather than a free upside.

#### Deck-thinning via whiff (a real strategy)

Pure-whiff stealswap permanently removes the swap card from your deck (the card is now on the enemy side). Combined with anti-build play, this is a way to *intentionally shrink* your deck — fewer cards = better cycling = more reliable draws of key pieces. Black runs lean by structure, and deliberate whiffing is one of the lever-pulls that supports that. The whiff penalty must remain substantial enough that the decision *between* gambling for the steal and accepting the cost for the thin is genuinely interesting.

#### Anti-stealswap counters

- **Parliament-style location text:** "Cards cannot change sides here" — blocks the mechanic outright. Documented in CARD_DESIGN.md as a Blue-White multi-color biome.
- **Punish-on-whiff cards:** "If a card swaps to this side at this location, deal X damage to the other summoner." Doubles the whiff penalty.
- **Suppress-acquired-card cards:** "Cards that swap to this side have Pacifist this encounter" or "lose their printed text this encounter." Reduces immediate value of the steal.
- **Color attribution:** White (purification, restoring order) and Blue (foresight, perception) split this design space. Red and Green generally don't get anti-stealswap; their tools are positional, not preventive.

#### Variants and design space

Stealswap is a *printable effect*, not a fixed card. Variants share the core rules with different targeting/conditions:

- **Targeting condition variants:** "swap with the front-most enemy creature here" (deterministic), "swap with an enemy creature in back" (positional), "swap with an action here" (intra-type).
- **Stat-gated variants:** "swap with an enemy creature here whose Force is ≤ X" (size-gated). Lets the swap card calibrate its target size.
- **Conditional variants:** "if you Forced more this turn, swap with the highest-Force enemy creature here" (combat-conditioned).
- **Friendly-fire variants:** an action that swaps a card with a card on the same side (rare; useful for repositioning/sacrificing).
- **Multi-card variants (premium):** "swap two creatures." Premium for multi-target.
- **Aftermath variants:** "swap, then deal X damage" (the action-stealswap example). The aftermath fires from the swap card's new position — see *The action-stealswap brutal whiff*.

Each variant uses the core swap rules; the variation is in targeting condition and any conditional cost components.

**Pairs with:** Black's graveyard recursion theme — a stolen creature that dies enters *your* graveyard, and Black's raise effects can return it as a zombie under your control. Combined with raise-from-any-graveyard (see *Raise from any graveyard*, when added), Black has two distinct acquisition vectors: trade-now (stealswap) and kill-then-claim (raise).

### Why two flavors of swap

White's swap is *self-sacrificial*: you spend a card's commit to protect an ally. The swap is one-way and uncontroversial.

Black's swap is *coercive*: you take what isn't yours. It's an entire strategic axis — Black-heavy decks with stealswap disrupt the enemy's positioning *and* gain their threats.

The same mechanic class produces opposite emotional shapes when given different color flavors — exactly what a healthy color pie does.

## Displace Mechanics (Shove and Disperse)

Confirmed instances of the displace subclass within the relocate-on-reveal family. They **move an enemy card to a worse position without taking ownership**. The card stays the opponent's, but its threat to *this* fight is reduced.

### Shove (Red)

**Flavor:** brute force, body slam, "get out of my way." Direct physical displacement.

**Mechanic:** on reveal, the enemy creature in front of this one is pushed to the back row of its column. The displaced creature does not deal damage this turn (back row creatures don't melee-attack). If the enemy back-row slot in that column is already occupied at resolve time, the shove **fizzles** — there's nowhere to push the creature to.

**Strategic shape:**
- **Strong against tall plays** (one big front-row creature, empty back) — the shove lands cleanly, the threat loses positioning, your column has a clear lane.
- **Weak against wide plays** (front + back occupied in the same column) — the shove fizzles, your card was wasted.
- **The opponent can defend against shove** by hedging — committing a back-row creature in any column they expect a shove. This trades stat efficiency (a slot used defensively) for shove protection.

**Cost:** likely ≥1 Force or ≥2 Force — Red's cheap aggressive option, gated by enough Force presence to commit.

**Why Red specifically:** Red's identity is direct, immediate, physical. Green's relocate effects are *graceful* (your own creatures, elegant repositioning). Red's are *forceful* (their creatures, against their will). A shove fits Red's brutality.

**Pairs with:** Red's lone-champion bonuses (clear the front-row blocker, charge in for direct hits), cleave attack patterns (after shove, your front-row attacks pierce through to the back-row displaced creature).

### Disperse — creatures (White)

**Flavor:** prayer of redirection, "we ask you to be elsewhere," nonviolent intervention.

**Mechanic:** on reveal, a target enemy creature here is moved to an adjacent location. (In v1 with one location, this effectively does nothing — the card is a v2+ design.) The opponent still controls the creature; it's now contributing to a different battle line.

**Strategic shape:**
- **Multi-location dependent.** Disperse is meaningless in single-location encounters. In multi-location encounters, it's a way to *defuse this location* without killing.
- **Doesn't kill, doesn't steal.** The creature is fine. Your opponent still has it. But it's no longer here to do damage. White's "intercession": the creature has been *asked* to be elsewhere.
- **Pairs with route-and-supply-line strategy.** A disperse that moves a Champion from your contested location to an adjacent location the opponent has *also* committed to — that's repositioning their threat into a fight they were already winning, not creating new battles.

**Cost:** Pray-N action (likely Pray 2 or 3) — White's signature delayed-cost mechanic.

**Why White specifically:** White's relocate effects are *redirective* (move the threat without harming it), where Red's are *forceful* (move it brutally). The non-violent flavor pairs with White's broader identity: protection, intervention, restoration.

**Pairs with:** White's bodyswap (one redirects friendly, one redirects enemy — both nonviolent moves). Multi-location strategic play (disperse is the White answer to a contested location *without* having to kill the threat).

### Disperse — actions (Blue)

**Flavor:** redirection of magic, "your spell goes there instead," information-driven misdirection. The third tool in Blue's denial suite, alongside Counterspell and Stifle.

**Mechanic:** on reveal, a target queued enemy action at this location is moved to the enemy's action slot at an adjacent location. The action remains the opponent's; it just resolves at the new location. (V1 with one location: meaningless. V2+ with multi-location: substantial.)

**Strategic shape:**
- **The redirected action might still resolve usefully** at the new location — or not. A Spark redirected to a location with no enemy creatures fizzles (a hard counter). A Spark redirected to a location with a friendly creature damages your *own* ally (extremely useful counter). Counterspell-like value, achieved through redirection rather than removal.
- **Cheaper than Counterspell** because the threat isn't removed, just relocated. Likely ≥1 Insight cost (vs Counterspell's ≥2). Counterspell removes; Blue-disperse misdirects.
- **Multi-location dependent.** Useless in single-location encounters; essential once the battlefield has multiple locations.

**Why Blue specifically:** Blue's identity is *making things not happen here*. Counterspell removes the action entirely (gone for the encounter). Stifle clogs the slot (delays resolution). Blue-disperse moves the action to where it does no harm (or harms the wrong target). Three different shapes of "not here, not now."

**Pairs with:** Counterspell (premium hard counter), Stifle (slot lock), Blue's information mechanics (you see what's queued before you redirect — Pillar 10 specifies redirect happens at reveal, with full info from prior reveal phase).

### Why displaces, not just kills

A core question: why have effects that *displace* rather than just *destroy*? Three reasons:

1. **Cost-flavor distinction.** Killing is direct, expensive, often final. Displacing is cheaper, less final, more flavorful. Some colors *want* to feel non-destructive (White's pacifism, Red's bullying).
2. **Tactical, not strategic, value.** Killing removes a threat permanently. Displacing removes it *from this fight*. The displaced creature can come back next turn (Red shoved it; the opponent can move it forward again next main phase). The threat persists; only the *current combat math* changes.
3. **Self-balancing through fizzle risk.** Displaces fizzle on illegal destinations. Kills don't. So displaces are *cheaper* but *unreliable* — exactly the cost-shape that fits cards with more conditional payoffs.

## Emergent Gameplay: cycling creatures via priority alternation

A discovered emergent property of the v1 prototype, worth recording as a design observation rather than a rule.

When all four creature slots are occupied, combat tends to grind: the same matchups happen every turn, the tank just gets pounded, the glass cannon never gets a clean shot. But when a player **intentionally leaves one front-row slot empty**, the picture changes:

- On turns when the player has priority, the player swings first; their high-Tempo glass cannon (e.g., Skirmisher) acts before the AI's tank can swing back, killing or chunking it.
- On turns when the AI has priority, the AI's threat hits the player's wounded front-row first; the player can then move (during main) to step a fresh tank up into the front row, retreating the wounded creature into back row or to the empty slot.
- Across the priority alternation, creatures *cycle* through positions: tank takes a hit, steps back; glass cannon steps in to finish the kill; next turn, fresh tank steps forward again.

The team feels alive — pieces moving in and out of favorable spots as priority slightly alters the shape of combat. None of this was designed as an explicit mechanic; it falls out of the interaction of:

- **Movement** (creatures can move 1 step at main per turn)
- **Combat geometry** (back-row creatures take damage when their column's front is empty, so back row is "shadowed" by front, not "safer")
- **Priority alternation** (which side acts first changes turn to turn)
- **Slot scarcity** (filling all slots removes the cycling option)

Design implication: **leaving slot space available is a tactical resource**, not just a default state. Cards that punish a full board (locking creatures in place, denying movement) become natural counters to over-stacking. Cards that reward an empty slot (movement-into-vacancy effects) become rewards for restraint.

Worth holding as a *positive emergent property* — the design produces tactical depth from interactions, not from rules complexity. Future increments should preserve this.

### Ranged combat extends the cycling pattern laterally

When ranged combat enters the design (currently a Pass-2 mechanic), the cycling pattern extends into a new dimension. Ranged attacks bypass front-row blocking and bypass thorns — so a back-row mage that's "safe" against melee threats becomes *exposed* to a back-row archer in the same column.

The natural defensive response: **lateral cycling.** A Mage threatened by an enemy back-row archer in column-l moves laterally (bl → br) to dodge the line of fire. The archer's ranged attack still hits column-l, but the Mage is no longer there.

This expands the cycling vocabulary: melee combat encourages front-back cycling (tanks and finishers swap rows); ranged combat encourages left-right cycling (fragile creatures dodge ranged columns). Combined, both axes of movement become tactically meaningful.

**Design imperative:** when adding ranged combat, *preserve the lateral-cycling pattern.* Cards or effects that lock back-row creatures in place would erase this dimension. Movement into adjacent same-row slots must remain a default capability, even with ranged enemies on the field.

## Zombification (Black recursion gating)

Black's graveyard recursion needs a balance constraint, because uncontrolled recursion would let any color's expensive creatures be replayed cheaply.

**Rule:** when a creature returns to play from the graveyard via a Black "raise" / "resurrect" / equivalent effect, **all stats other than Force and Spite clamp to 0** for the duration of that play. Such creatures are themed as **zombies**.

Consequences:

- **Prevents Black from being a free splash for any other color's economy.** A raised Blue spellcaster doesn't generate Insight anymore; it can't fuel further Blue spells. Black has to live off Force and Spite.
- **Forces Black's recursion to be combat-focused.** Brought-back creatures contribute to combat (Force survives, Spite survives) but not to the spell economy.
- **Reinforces the Black + Red affinity.** Red creatures (typically high Force, low everything else) come back from the grave with most of their value intact. Blue/White/Green creatures come back as shadows.
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

2. **Card-level play hints.** Every AI-playable card carries metadata that a heuristic uses to pick where to play it: *prefer contested nodes*, *prefer high-Force locations*, *prefer nodes adjacent to the player*, *avoid playing in supply-line range of these cards (anti-synergy)*, *prefer fresh nodes for spread*, etc. New cards just print new hints. This is data, not new code.

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

## Prototype Findings (v1)

Observations from playtesting v1. These are *findings*, not commitments — they may inform future design choices but they aren't being patched at the v1 level because v1 is intentionally a sliver of the eventual game.

### Spark vs Counterspell — the circular cost asymmetry

**Observation:** in the v1 13-card deck (with two Mages, one Spark, one Counterspell per side), Spark dominates Counterspell because of a circular cost relationship:

- Spark costs ≥1 Insight and prioritizes killing the enemy Mage (Durability 1 — a one-shot Spark kill).
- Counterspell costs ≥2 Insight and requires *two* Mages alive simultaneously.
- Spark is therefore *self-protecting*: it kills the very resource the opposing side needs to play Counterspell.
- Counterspell is structurally rare to fire: by the time you have 2 Insight, an opposing Spark has likely already removed one of your Mages, dropping you back below cost threshold.

**Why it's a v1 issue specifically:** the asymmetry only matters when the only Insight-printer in the game is Durability-1, and when commits are entirely blind. As more cards exist, several structural answers emerge:

- **Mage protection** softens the cost asymmetry (divine shield from White, healing, equipment that grants +Durability, structure-based defenses).
- **Persistent action targets** (Prayers, Curses) justify Counterspell's premium cost — countering a 4-turn-channeled Prayer is a much bigger payoff than countering a 2-damage Spark.
- **Recon (Blue action recon)** is the most direct structural answer. Without recon, Counterspell is a blind gamble — pay ≥2 Insight, hope the opponent committed an action. With recon, Counterspell only commits when an enemy action *is already in their slot*, making the premium cost reliably worth it. This is the cleanest mechanical fix and was added to the design space specifically to resolve this asymmetry. (See *Recon (privileged commit window)*.)

**Decision:** *not* fixing in v1. The structural observation matters for future card design (ensure Insight-printers have viable defense paths; consider whether Counterspell's cost should scale with what it can target). The mechanical fix (recon) lives in Pass 2 design space. v1 numbers stay; the lesson is preserved.

### Mage-protection as a meta strategy

Related: the Mage's Durability 1 makes it the **single most-targeted creature** in v1. Both sides' optimal play prioritizes "kill enemy Mage" because it shuts off their entire spell economy. This is *good* design (creates clear strategic targets) but also reveals a structural fact: **fragile stat-printers create high-value snipe targets that dominate combat priorities.** As more colors get fragile signature-stat printers (a Resolve-printing Acolyte, a perception-printing Scout), expect the same dynamic.

This may be self-correcting at scale. With multiple stat-printer types in play, the "kill their Mage" strategy splits attention across multiple targets, no single one dominates. But for now in v1, the Mage is *the* target and the game largely reduces to "who keeps their Mage alive longer."

### Cycling-creatures pattern is real and load-bearing

Confirmed via play: leaving a front-row slot empty enables the priority-alternation cycling described in *Emergent Gameplay*. Players who fill all four creature slots play a worse, grindier game than players who keep one slot fluid. This pattern is now a known core piece of v1 strategic depth and should be preserved through future increments.

### AI hints worked

The shift from random AI to scored AI (per-card hints + global scoring function) substantially improved game feel. The AI now plays Mages in back row behind blockers, avoids Champion-vs-Champion contested-column trades when possible, fires Spark on killable targets, and holds Counterspell when there's no opposing action. The DECISIONS.md AI architecture is validated at this scale.

The next AI test will be larger card pools — does the heuristic still produce sensible play when there are 30 cards instead of 9? Pass 2 will tell.

## Prototype Findings (v3)

Observations from v3 playtesting. Like the v1 findings, these are *findings* and should not be confused with locked design.

### Engine-demo cards are not card-design candidates

The v3 prototype includes four cards added purely to exercise the engine: **Combat Engineer**, **Sandbag** (token), **Herald**, and **Sapper**. These are *demos* of the flip-up trigger system, token spawning, Inert keyword, and damage-on-flip targeting. **They are not real cards** — their effects are intentionally simple and chosen for engine coverage, not for design merit.

The cards that **do** carry forward as real-card design candidates from the prototype:

- **Spark** (Blue, ≥1 Insight cost, "deal 2 damage here"). Reward-tier.
- **Counterspell** (Blue, ≥2 Insight cost, "send all actions in spell slots to the graveyard"). Reward-tier.
- **Heralding Spark** (Blue, ≥2 Insight cost, "deal 1 damage at each of your locations"). Reward-tier — first scope-extended damage card.

The starter-pool cards in the prototype (Recruit, Conscript, Soldier, Champion, Skirmisher, Mage, Banner of War) are the prototype's working approximation of starter content but predate the locked starter framework. They will be replaced/refined when session 2 designs the starter pool against the new framework.

### AI overworld commits not yet implemented

The v3 prototype loads each encounter from a hand-authored node definition — the AI's deck is dropped into one node at encounter start, with no real overworld build-up. This means **the encounter difficulty curve doesn't exist yet**. Every encounter has the AI's full deck at one node; near vs. far from the boss makes no mechanical difference yet.

This is the largest known engine gap. v3.5 / v4 work: AI takes a mini-turn at each node it controls between player overworld turns, dropping cards face-down on adjacent nodes per the spread-and-supply-line design. Without this, the difficulty tuning the design promises (early encounters thin, late encounters thick) cannot be tested.

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
- *(high)* **Black: tall-tank vs wide-flood.** The current Black profile (high Spite, tanky individuals, hard to remove) reads as tall, but recent design conversations frame Black as the "wide" complement to Red's lone champion. The likely resolution: Black is *wide via persistence* — same creatures cycling through life-and-death over many turns rather than many cheap chump creatures at once. Sharpen which it is, or whether both archetypes coexist.
- *(medium)* **Perception's relationship to Insight.** Currently held as a likely sixth stat for fog-of-war manipulation, but possibly absorbed into Insight. Decide as Blue's design space firms up.
- *(medium)* **Red action timing.** Red's "now / impulse" identity says actions resolve immediately or by end-of-turn / end-of-phase. Is this a *hard rule* (Red actions cannot print delayed timing triggers) or a *strong default* (delayed-timing Red exists but is rare)? Affects card-design vocabulary.
- *(medium)* **Conditional stat printing on global stats.** Red's signature "+5 Force while alone" is local. If a card prints "+1 Insight while alone," does the conditional Insight contribute to global draw? The mechanics say yes (Insight is global), but the flavor of "lonely scholar" reads oddly. Mostly a card-design discipline question.
- *(medium)* **Anti-synergy intensity for Red splash.** Is splashing Red into Blue/White *actively painful* (cleave reliably kills the splashed mages and Resolve creatures) or *just costly* (slightly worse than other splashes)? Tuning question for cleave damage values, but worth picking the principle now.
- *(medium)* **Healing scope and limits.** Healing is now confirmed as White's restoration tool. Heals creature durability — but how much per cast? Can heals exceed printed durability (overheal as a temporary buffer)? Does healing also touch summoner Durability, or strictly creatures?
- *(medium)* **Divine shield specifics.** Pray-1 protective bubble pops on first damage. Does it absorb the *full* damage instance regardless of size, or a fixed amount with overflow passing through? Does the shield persist across phases / turns until popped, or only until end of the turn it resolved on?

### Mechanics

- *(high)* **Healing.** Confirmed as Resolve-themed. Heals creatures or summoner or both? How much? Can it exceed max durability? Big lever for White's defensive identity.
- *(high)* **What a card's "color" formally *is*.** A card with Force 2 and Insight 1 is what color? Red? Red-Blue? "Mostly Red"? Either: (a) color is derived from printed stats (most cards are multi-colored), or (b) cards have a separate primary-color flag independent of stats. Affects AI play hints and card-design vocabulary.
- *(medium)* **Force-less creatures and combat math.** Force-less creatures occupy slots and are attackable. Are they entirely passive in combat, or do they "block" in some way? Does damage assignment force Force creatures to attack non-combatants by position rules? What does a 0-Force creature do during combat? — assumed: just sits there, takes damage when targeted.
- *(medium)* **Damage rule edge cases.** Is damage tracked as marked counters or as current-Durability subtraction? Can damage exceed Durability? Does Spite apply to *all* damage or only combat damage? (Blue's spell damage — should it bypass Spite?) Does damage carry across rounds within an encounter? — assumed: yes, until creature shuffles back to deck at encounter end.
- *(medium)* **Removal doctrine.** Which colors get cheap removal, conditional removal, no removal? Removal is the biggest balance lever in any card game; this needs a stated philosophy before too many cards are designed. Equipment-removal and ammo-stockpile-removal are related questions — same colors as structure-removal, or different?
- *(medium)* **Cost-grammar expressivity.** Confirmed: ≥, ≤, =, compound conjunctions (AND), comparative-vs-opponent. Also legal: scaled costs ("1 Insight per card in your hand"), totals across multiple stats ("≥4 of any combat stat")? Pass 2.
- *(medium)* **Per-encounter post-victory state.** Do destroyed enemy *structures* on a contested node go to AI graveyard, or are they removed from the map? What about *neutral* structures the player builds? Persistence rules need explicit enumeration.
- *(medium)* **AI's first-card problem & opening tempo.** AI plays under same stat-cost rules. Its first play on a fresh node depends on terrain baselines and free-cost cards. Tuning is a central balance knob.
- *(low)* **What "transform" vs. "evolve" mean precisely.** Working definitions: transform = turn this card into a different specific card; evolve = card transforms into a different specific card on meeting a printed criterion. Upgrade = numeric improvement of the same card.
- *(low)* **Boss-specific design.** Boss is a summoner with Durability defeated by normal combat damage. Are there boss-only mechanics, phases, or special cards?
- *(low)* **Multiple encounters per overworld turn.** Assumed: one encounter per player overworld turn; advancing is the act that starts the encounter and ends the turn. Confirm.
- *(low)* **Reveal granularity in detail.** When a player permanent enters at a location, all face-down *resolved* cards there flip. Do face-down cards still in this turn's *play queue* also reveal, or only resolved permanents?

### Equipment — open mechanics

- *(high)* **Per-permanent equipment cap.** Can a single host wear arbitrary equipment, or is there a fixed limit (one weapon, one armor, etc.)? The release-valve framing argues for "many" — more outlet is better.
- *(medium)* **Color-neutral equipment.** Is some equipment uncolored, providing bridging cards for cross-color decks, or does every piece have a color identity?
- *(medium)* **Equipment stat printings.** Does equipment with printed stats contribute to per-side per-location stat totals while attached? A "Holy Sword" printing +1 Resolve — does it grow the global hand size?
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
- *(high)* **Combat preview must not leak random-resolution outcomes.** Per Pillar 10, the strategic skill is *setting up board state where exactly one card qualifies* for a random-target effect. The combat preview currently shows the deterministic first-target as the would-be outcome (e.g., Spark previews as "→ Soldier (br)" when there are multiple valid targets). This **violates the spirit of Pillar 10** — the player gets to see the random pick before committing. Fix: previews of random-target effects should show the *set* of possible targets ("any of: Soldier, Mage, Mage") or simply "→ random enemy here" without specifying which. For deterministic effects (e.g., Counterspell against a single visible action) the specific outcome is fine to show. Captured 2026-05-02 from v3 prototype playtest. Prototype work item, not a rules change.

### Ranged combat & ammo — open mechanics

- *(high)* **Ammo refresh cadence.** Working assumption: typical ammo-generation prints "+1 per upkeep" or similar low-rate, meaning a single ranged creature fires roughly once per turn if alone. Confirm typical generation rate range; tuning lever for ranged tempo.
- *(high)* **Ammo persistence across encounters.** Does a location's ammo stockpile persist on the map between encounters (rewarding pre-built supply lines) or reset at encounter end (each encounter starts at zero)? Affects how investable ammo-generation structures are.
- *(medium)* **Ranged target conditions.** Per Pillar 10, ranged attacks pick at random from legal candidates. Default "an enemy creature here," or back-row-specific patterns ("an enemy back-row creature here"), or column/positional patterns? Worth scoping the working set of printable ranged target conditions.
- *(medium)* **Ammo distribution among multiple ranged creatures.** Working assumption: fastest-Tempo fires first, consuming 1 ammo; subsequent ranged creatures fire in Tempo order until ammo runs out; slower archers may end up dry that turn. Confirm.
- *(medium)* **Ammo cost as global rule vs printed.** Working assumption: every ranged attack consumes 1 ammo (global rule). Some cards may print higher costs ("ranged: consumes 2 ammo") for premium effects. Confirm the global default.
- *(medium)* **Ammo-stockpile destruction.** A new resource implies new removal. Black is the natural home (anti-ranged theme). What's the printed effect grammar? "Destroy 2 ammo at this location"?

### Activation actions — open mechanics

- *(high)* **Naming the design class.** *Activation actions*, *triggered actions*, *permanent-dependent actions* — pick a canonical label so card-design discipline has a shared vocabulary.
- *(medium)* **Off-cycle attack timing.** When Volley resolves in main phase, do the triggered ranged attacks happen *at Volley's resolve* (mini-combat, on-damage triggers fire normally) or queue for next combat? Working assumption: at Volley's resolve, same end-of-phase resolution.
- *(medium)* **Multiple activations per turn.** Could a player play Volley in main and Volley again in cleanup (or in different phases) for two off-cycle ranged firings? Working assumption: yes, if action slot is free and ammo permits. Real burst potential.

### Tempo ordering & combat sequence — open mechanics

- *(medium)* **Side-priority synthesis.** Working rule: local Tempo total at the location wins side priority within a Tempo tier; if tied, alternates per overworld turn. Confirm this is the intended synthesis or if a different mix.
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
- *(resolved 2026-05-02)* **Neutral encounter design space.** Resolved by the unified hostile/neutral encounter framework. Neutral encounters are on-board puzzles using the same multi-location simultaneous-commit system as combat — see *Encounters: unified hostile/neutral framework*. The puzzle archetype matrix replaces the open question. Per-biome / per-color / per-reward-type expansion is ongoing authoring work, not an open design question.
- *(medium)* **Run length.** How many overworld turns from start to boss in a typical run?

### Cards & stats

- *(resolved 2026-05-01)* **Stat naming.** Locked in as Force / Tempo / Insight / Resolve / Spite. Earlier D&D placeholders (STR/DEX/INT/FAITH/VIT) retired. See DECISIONS.md.
- *(low)* **Summoner-Durability vs creature-Durability terminology.** Currently "Durability" is the unified term for damage-soaking value across summoners, creatures, and structures. A v3 playtest raised the question of whether summoners should use "HP" instead, to communicate "summoners are alive in a different way than creatures/structures" (a design truth — the player and boss are characters, not units). Working assumption: keep the unified term for now (one fewer vocabulary item). Revisit if summoner-specific mechanics that don't apply to creatures (resurrection, soul, etc.) emerge that would benefit from the distinction.
- *(high)* **Action subtype names per color.** Spell (Blue), Prayer (White), Curse (Black) are settled. **Maneuver** (Green) and **Tactic** (Red) are working placeholders. Final naming pending.
- *(medium)* **Default action-slot count per location.** Working assumption: 1 action slot is default, with rare 2-slot variants. Confirm.
- *(medium)* **Effect scope vocabulary.** Working keywords: `here` (default, often implicit), `this location`, `adjacent locations`, `supply line`, `all your locations`, `everywhere`. Plus possible directional/relational terms. Full list to be locked in Pass 2.
- *(medium)* **Terrain destruction effect class.** Confirmed: rare premium effects can destroy a location's stat line and/or rules text (but never its slot profile). Open: how rare, what colors own it, whether destruction is reversible, whether partial destruction (stats-only or text-only) is a separate effect.

### UX / prototype

- *(high)* **Variable-adjacency battlefield UI.** A node may have 1–N adjacent nodes. The battlefield must render N location columns side-by-side, each with a slot grid. *This is the single biggest unknown to de-risk in the prototype.*
- *(medium)* **Drag-and-drop affordances.** How does the player target a specific slot at a specific location? Does the play queue have a visible representation?
- *(medium)* **Fog of war presentation on the overworld.** The current v3 prototype shows each node's *kind* (hostile/neutral/boss) on the overworld map via icon and color — this leaks too much. Per design intent, the overworld should hide **what kind of presence** is at adjacent nodes; the player should see only that *something* is there (or the biome aesthetic), with kind/contents resolving at encounter start. A node should reveal its kind once visited, possibly with a "glimpse" mechanic where line-of-sight from a visited node leaks partial information. Need to decide: does kind become permanently visible after first visit? Does it reset between runs? Does some scout-flavor mechanic reveal kind without engaging? **v3.5 / v4 work** — the engine supports it; just need to gate the rendering and decide the persistence rules.

### Framework / engineering

- *(medium)* **JS framework choice.** Deferred until vertical-slice prototype reveals real state-management requirements.
- *(low)* **Static-host target.** GitHub Pages? Custom domain? Pass 2.
