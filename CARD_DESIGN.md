# Card design — working space

> Living document. Active card-design state. Patched as we converge.
> Once cards are locked, they migrate into a permanent section in DESIGN.md.

## How to use this doc

- **Tables** are the at-a-glance state of each pool. One row per card.
- **Status column** values: `proposed` (Claude drafted, awaiting feedback) / `discussing` (in-flight) / `agreed` (locked) / `rejected` (dropped) / `parked` (held for later sessions).
- **Currently working on** at top pins the 1-2 cards under active discussion; full notes live there.
- **User comments stay in chat**; Claude patches the doc as discussion converges.
- Cost notation: `0` = free; `≥1F` = at-least-1-Force-here; `≥1T` = at-least-1-Tempo-here; compounds use `+` (`≥2F + ≥1T`).
- Stats notation: `F/T/D` columns are Force / Tempo / Durability. Other stats (Insight / Resolve / Spite) are excluded from starters by framework.

## Vocabulary (side-relative, drop "row", drop friendly/enemy/neutral)

Card text uses **relational** language, not ownership language. This survives side-swaps cleanly.

**Side terms:**
- `your side` — the side currently controlling the card.
- `the other side` — the opposite side from the speaker.
- `here` (default scope, often unprinted) — the location the card is at.
- `(here)` — explicit clarification when needed.

Words like *enemy*, *friendly*, *neutral* are **retired** from card text. They conflate ownership-as-static-property with the actual relational state, which is mutable (creatures can swap sides via Nightmare-class effects).

**Position terms:**
- `in front` (replaces "in the front row") — same-side, front-row position.
- `in back` (replaces "in the back row") — same-side, back-row position.
- `the creature in front of this` — directly forward in the same column, on the same side.
- `across` — directly opposite this slot, on the other side. A creature in your front-left has an "across" relationship to the front-left slot on the other side. Used for cross-side positional targeting.
- `left / right / middle` — column position, used only when grid geometry requires (most cards don't).

The word *row* is dropped — *front* and *back* are unambiguous on their own.

**Buff/debuff durations.** A buff or debuff is a property of the *target*, not the source. Once applied, the modifier lives on the target creature; the source has nothing to do with it after that moment. Three durations:
- **Default (no duration printed)**: the buff/debuff lasts as long as the *target* stays in play. Resets when the target leaves play (dies, is destroyed, is removed). The source can die immediately after applying — doesn't matter; the modifier is on the target now. *Example:* Hexer's flip-up `-1 Force` stays on the target as long as the target is in play, even if Hexer dies in the same turn.
- **End of turn / end of phase / until trigger**: scoped explicitly by the printed clause. Lifts at the named timing regardless of whether the target is still in play.
- **Permanent**: persists across the target's pile cycling within the run. A creature debuffed permanently and sent to the graveyard, then raised back into play, retains the debuff. The instance state rides with the target through deck/hand/discard/graveyard transitions.

**Trigger-on-leave-play effects (deathwish, etc.) work fine with default duration.** The debuff lands on the target; both the source and the trigger are then irrelevant. A Cultist Martyr's deathwish `-1 Force` debuffs a creature on the other side; Martyr is dead, but the debuff lives on the target as long as the target lives.

**Combat: back row blocks; back row doesn't attack.** Back-row creatures don't attack (unless they print a ranged pattern), but they *do block for the summoner* and *take damage*. A creature pushed from front to back is still a target — it just no longer projects Force at the location and no longer participates in front-row combat patterns.

**Death event rule.** Any creature transitioning from play to the graveyard is *dying*, regardless of how it got there. Combat damage, sacrifice, deathwish triggers, removal effects — all are death events. Death-triggered effects (deathwish, "when a friendly creature dies, ...", graveyard-fillers) all fire on any death event. The mechanism doesn't matter; the *transition* matters.

This generalizes: leaving play to a dead zone is *death*. Three dead zones, three death types:
- Creature → graveyard = death (deathwish fires).
- Structure / equipment → junkyard = demolition (reward-tier collapse-class triggers fire — none in starter).
- Card → exile = banished (no triggers fire from exile transitions; exile is the no-recursion zone).

Specific cards may print exceptions: a *Buried Alive* keyword (reward-tier Black) might print *"This goes to the graveyard without dying"* — bypassing death-triggers, useful for setting up graveyard-recursion without paying the death-event cost. Exceptions are reward-tier; the default is "play → graveyard = death."

**Equipment defaults:**
Equipment text starts with just *Equip.* — no side qualifier. The rule that equipment attaches to a creature on your side is **the default**. Cross-side equipment (the rare exception) prints explicitly: *"Equip to a creature on the other side."* Same as the default-local scope rule: print the exception, not the default.

**Equipment piles destination (the host-side rule):**
- Equipment goes to the **junkyard** when it leaves play (not the graveyard — see *Junkyard as a separate zone*).
- *Whose junkyard?* Whichever side the host was on at the moment the equipment leaves play.
- Cross-side equipment (equipped to a creature on the other side): when that creature dies, the equipment goes to the **other side's junkyard** — you've lost it forever.
- **Magnetic** equipment overrides the host-side rule: it always returns to *your* junkyard, regardless of which side the host was on.
- Equipment text can also override the host-side rule for *the host*: a card like a stealswap-equipment can print *"When the wielder dies, they go to your graveyard."* This is a one-shot card-acquisition equipment — equip to an enemy, kill the host, steal the body. Without Magnetic, you still lose the equipment itself.

**Junkyard as a separate zone.**
- **Graveyard** — the pile for *creatures*. Creatures go here when they die.
- **Junkyard** — the pile for *structures and equipment*. They go here when they leave play.
- **Discard pile** — the pile for *actions*. Actions go here on resolve (per existing rule), then reshuffle into the deck when the deck runs out.

The split matters for graveyard-recursion mechanics (Black raise targets creatures in the graveyard, not equipment in the junkyard) and for equipment-recursion mechanics (Magnetic targets equipment in the junkyard, not creatures in the graveyard).

**Magnetic as scope-shifting.** The same Magnetic keyword prints differently per card type:
- **Magnetic on an equipment card itself:** affects that one equipment — when it leaves play, it returns to your junkyard regardless of host side.
- **Magnetic on a structure:** scope-extends to all equipment at this location — every equipment leaving play here gets pulled to your junkyard, including equipment originally owned by the other side. The structure becomes *stealswap for equipment*.

Same keyword, different scope based on the card type printing it. This is a general design pattern worth noting: **the same effect printed on different card types has different scopes by virtue of the host card-type's natural scope.**

**Neutrals are biome-native cards, not a third side.** Neutrals are the cards already at a location before the player or AI arrives. They sit in slots. When an encounter starts, neutrals contribute stats to whichever side they ended up on (typically opposite the player at encounter start, but Nightmare-style conversions can shift them). Their card text and color reflect the **biome** of the location they live in (a coastal location's neutral is Blue-flavored; a mountain forge is Red-flavored). The shared card pool includes biome-themed cards available exclusively as neutrals.

**One shared card pool, three windows:**
1. **Starter pool** — cards seeded into player decks at run start, biome-flavored per choice.
2. **Enemy decks** — designer-curated, color-themed decks the AI runs.
3. **Neutral biome-natives** — cards seeded into specific biomes/locations, encountered when the player arrives.

All three are drawn from one pool. The conversion verbs (Nightmare for Black, Recruit for Red, Reroute for Green, Research for Blue, Convert for White) are how cards from any of the three windows enter the player's deck.

## Stat model — local, global, scaling-reference

Every stat does **three things**:

| Stat | Local (at this location) | Global / summoner-side | Scaling reference |
|---|---|---|---|
| **Force** | Sum of Force on **front-row** living creatures, structures, and terrain at this location (per side). Back-row creatures don't print Force to the location regardless of their printed Force value. Used for cost-payment, combat damage projection, comparative checks. | Damage-to-summoner via combat fall-through. | Card text references "Force here" as a scaling number for damage payloads, threshold checks. (Reward-tier — starters use fixed values.) |
| **Tempo** | Sum of Tempo on living creatures, structures, terrain at this location (per side). Any position. | Higher Tempo total wins **side priority**; ties alternate per turn. | **Actions don't print Tempo.** An action's queue Tempo = the location's Tempo (caster's side) at resolve time. Tempo-printers are *temporal anchors* — kill them mid-phase to delay opposing actions. |
| **Insight** | Sum of Insight at this location (per side). Any position. | Summed globally across all your locations → adds to your draw count for the turn. | Cost-reduction patterns (Blue's signature — *"this Spell costs 1 less Insight per Insight here above 2"*); scope-extension; perception scaling. |
| **Resolve** | Sum of Resolve at this location (per side). Any position. | Summed globally across all your locations → adds to your kept hand size at cleanup. | Threshold tier-jumps (White's signature — *"if Resolve here ≥3, this Prayer's effect doubles"*); healing magnitude; divine-shield-class effects. |
| **Spite** | Sum of Spite on living creatures, structures, terrain at this location (per side). Any position. | **Summoner thorns:** when an attacker breaks through and damages your summoner, the location's Spite total (your side) deals retaliation damage to the attacker. Fires only if the target actually loses Durability. | Retaliation magnitude scaling, debuff persistence, curse intensity. Black's signature scaling style. |

**Force is the only stat with a special positional rule.** Force at a location comes from *front-row* creatures only. Back-row creatures contribute their other stats normally but their Force is dormant (zero contribution to location Force).

**Tempo, Insight, Resolve, Spite have no row rule.** All living creatures at the location, front or back, print these stats normally.

**Dead creatures don't print stats.** This is the only universal gating. Position only matters for combat (who attacks/blocks) and for the special Force rule.

**Why Spite-on-summoner feels "gated by survival":** an attacker only reaches the summoner if no creature is in their way — meaning the would-be blocker either wasn't there or died. If the blocker died, that creature's Spite stops printing (because the creature is dead). So the summoner-thorns total at the moment of breakthrough is whatever Spite is *still alive* at the location. **It's slot economy, not a row rule.**

**Spite is pure retaliation, not damage reduction.** The Spite-printing target takes the full damage; the attacker takes Spite-equal damage back **if and only if the target lost Durability**. A 0-damage attack absorbed elsewhere doesn't trigger Spite. Even when the Spite-creature dies to the attack, Spite still fires (Durability went to 0, that's a reduction). Spite is *cost imposed on the attacker*, not *defense for the defender*.

**Position matters for combat geometry.** Front-row creatures attack and can be attacked; back-row creatures generally don't unless they have ranged attack patterns. The Force rule above is part of this combat-geometry logic — Force is *combat damage projection*, so only front-row Force projects. The other stats aren't combat-projection stats and don't need the same restriction.

## Stat as effect-scaling reference

Card text can reference any local stat total as a numerical input for scaling effects. The location's stat is read at **resolve time**.

Each color has a *flavor-distinctive* scaling pattern:

- **Force scaling (Red):** direct numerical multiplication — damage payloads, threshold checks. Red's bluntest tool.
- **Tempo scaling (Green):** queue manipulation, off-cycle attack triggers — manipulates *time*. Green's identity.
- **Insight scaling (Blue):** **cost reduction**, scope extension, perception scaling. Manipulates *the rules of casting*. Blue's identity.
- **Resolve scaling (White):** **threshold tier-jumps** — effects double or transform when Resolve crosses a threshold. White's patience-as-power identity.
- **Spite scaling (Black):** retaliation magnitude, debuff intensity, curse persistence. Retribution scaling. Black's identity.

Direct multiplication (`deal damage equal to Force here`) is the simplest pattern, used mostly by Red. Other colors use *cleverer* scaling shapes that match their identity.

## Buffs and debuffs — three durations

A buff or debuff is **a property of the target**, not the source. Once a card applies a modifier to another card, the modifier lives on the target. The source is irrelevant after that moment — it can die instantly and the modifier persists on the target normally. Three durations:

1. **Default (no duration printed)** — the modifier lasts as long as the *target* stays in play. Resets when the target leaves play (dies, is destroyed, is removed). *Example:* Hexer's flip-up `-1 Force` lives on the targeted creature as long as that creature is in play. Hexer can die immediately after the flip-up; doesn't matter.
2. **Scoped duration** — explicitly printed timing: *"until end of turn"*, *"until end of phase"*, *"until [trigger]"*. Lifts at the named timing regardless of target lifetime.
3. **Permanent** — printed as `permanent` or `permanently`. Persists across the target's pile cycling within the run. A creature debuffed permanently and sent to the graveyard, then raised back into play, retains the debuff. The instance state rides with the target through deck/hand/discard/graveyard transitions. Permanent buffs/debuffs are reward-tier (most starter cards use default-while-target-in-play).

**Trigger-on-leave-play effects (deathwish, etc.) work fine with default duration.** The debuff lands on the target; the source's death is irrelevant. Cultist Martyr's deathwish `-1 Force` lands on a creature, and persists on that creature for as long as the creature is in play, even though Martyr is dead.

**Strategic depth from the default rule:** Black's debuff lattice accumulates on opposing creatures — Hexer's debuff plus Martyr's deathwish plus Bone Cairn's recurring fires can stack -3 Force or more on a single target. The debuffs only reset when *the targets* leave play. **Counterplay is to kill or remove the debuffed creature**, not to kill Black's debuff sources. Once cursed, a creature stays cursed until it dies.

**Bone Cairn doesn't need to survive for its applied debuffs to stick.** Each cleanup, Bone Cairn fires; the -1 Force lands on a target and lives on that target. If Bone Cairn is destroyed mid-encounter, the previously-applied debuffs all persist on their targets. Bone Cairn just stops adding new ones.

**Permanent buffs/debuffs are the reward-tier upgrade.** A reward Bone Cairn variant might print `permanently` to make its debuffs survive even the target's death-and-revival via pile cycling. That's the reward-tier power level.

## Card text style

Card text is **short and narrative**. Rules text handles edge cases. Cards say what they *do*; the rules engine handles "what if there's no slot?" / "what if no target exists?" via standard fizzle behavior.

Examples:
- Good: *"If you have more Force here, a creature in front on the other side moves to the front on your side."*
- Bad (over-engineered): *"If your side here has more Force in front than the other side, the creature in front on the other side here moves to the front on your side (if a slot is available). The taken creature joins your piles."*

Conversion verbs imply *the taken creature joins your piles* by virtue of being a conversion verb — that's the conversion. Card text doesn't repeat it.

**Costs follow the same default-implied rule.** A stat requirement of `≥1` of the relevant stat is the default and isn't printed on the card. Only exceptions are spelled out:
- `≤` (less-than) requirements.
- Comparisons against the other side's stats at the location.
- Compound or alternative cost types.

"Your stats here" is the default scope and isn't printed either. Only cross-side comparisons or scope-expansions get printed text.

## Anchoring constraints (starter pool)

Locked rules from the starter framework. Every starter card must satisfy all:

1. **No Insight, Resolve, or Spite printing.** Themed stats are reward-tier.
2. **No damage actions in starters.** Direct damage is reward-tier.
3. **No "deal damage on flip-up" effects.** Damage on flip is design-disciplined-against; the unified ranged combat model replaces it. Ranged creatures fire in combat, not on flip.
4. **One mechanic per card max.** Tutorial difficulty layer — readability is the priority.
5. **Per-color flavor effect must not print themed stats.** Express identity *thematically*, not economically.
6. **Cost grammar is simple.** Free, or stat-gated (`≥X Force here`, possibly compound `≥XF + ≥YT`). No comparatives, no ≤.
7. **Each card creates want.** Even at starter-tier, each card should make the player ask "I need *that other card* to unlock this." Sidegrade-only relationships are flat and bad pedagogy.
8. **System variety per color.** Each color's starter pool prints **at least 2 card types** (creatures + at least one of: equipment, structure, action). Cards that aren't creatures preview the full taxonomy.
9. **Tribal naming where it adds signal; gaps where they tell a story.** Most starter creatures take a tribe prefix. Cards that *don't fit the tribe* (no Force, off-flavor) deliberately drop the prefix to mark them as off-pattern.
10. **No vanilla bodies.** Every card prints at least a small narrow effect, even one that whiffs in many board states. Power level is on a spectrum of *effect breadth and value*, not "has effect / doesn't have effect." Stronger cards do things broader, at higher values, more reliably; weaker cards do narrow conditional things that often whiff. Both are part of the strategic conversation. **Pure stat-stick cards are reward-tier negative space** — they exist by *not* printing effects, which is itself a design choice paid for in stat efficiency.

The per-color flavor effects (locked from session 1, revised in this session):

- **Red** — "+X Force when alone here" — conditional stat printing seed.
- **Green** — small movement keyword + **ranged combat with ammo** (replaces earlier "damage on flip" framing).
- **White** — healing/restoration with positional targeting (in-front-of an ally).
- **Black** — "on flip-up: afflict -1 Force on an enemy in the front row here."
- **Blue** — "on flip-up: draw 1" creature, *or* a starter Blue action with "draw 1."

Each starter pool is **6 cards**. Composition guideline (flexible):
- 3-4 creatures (recruits + ramp)
- 1-2 non-creature cards (equipment / structure / action) for system variety
- 1-2 cards expressing the per-color flavor

---

## Currently working on

**Pivoting to vertical-slice scope.** The full design is rich; the slice is much smaller. Focus has shifted to *Red only* — full starter pool + reward pool + enemy decks + boss + 6-8 node fixed map. Other 4 colors are designed in this doc but held until slice ships.

**Recent updates this session:**
- **Stat model finalized** — Force is the one positional stat (front-row only); other stats position-independent; Spite is pure thorns (no reduction); Tempo-on-actions resolves at location-Tempo at resolve time.
- **Buff/debuff durations corrected** — modifiers are properties of the *target*, not the source. Default duration = while target is in play. Scoped = explicit timing. Permanent = survives pile cycling.
- **Across keyword added** — the slot directly opposite this slot on the other side. Used for cross-side positional targeting.
- **Combat geometry clarified** — back row blocks for the summoner and takes damage; back row creatures don't attack unless ranged.
- **Red reward pool now at RR1-RR6:** Goblin Bully (push), Goblin Berserker (Enraged), Pit-Goblin Challenger (Provocation), Battle Driver (action), Goblin Pike (pierce 1 equipment), Goblin Bombardment (sacrifice + tribal-as-resource).
- **Red starter R6 changed:** Watchfire (structure) replaced by **Goblin Recruiter** (creature-shaped Recruit source). Red starter loses structure variety but gains a second deckbuilding path.
- **Red starter R1, R3 redesigned (no more vanilla bodies):** Goblin Brawler now prints *"On flip-up: if this is the only creature on your side here, gain +1 Force"* (seedling Pit-Fighter at recruit tier). Orc Bruiser now prints *"On flip-up: this gains +1 Force this turn"* (always-fires charge buff). **No more vanilla bodies in Red starter.**
- **New starter constraint #10 added:** *no vanilla bodies* — every card prints at least a small narrow effect, even one that whiffs. Power level is on a spectrum of effect breadth/value/reliability, not "has effect / doesn't have effect."
- **Tempo as strategic axis documented:** higher Tempo = attack first; lower Tempo = collect more triggers before swinging. Equipment lowering Tempo is valuable for collect-late triggers. Black "likes being slow" because reaction-and-attrition rhythm rewards swinging late.
- **New mechanics added:** push (front-to-back displacement), pierce X (capped trample), Enraged (per-damage Force stacking), sacrifice (creature → graveyard via Pillar 10 random pick), tribal-as-resource costs, **death event rule (play → graveyard = death regardless of mechanism)**.

**Other 4 colors have flagged vanilla bodies that need redesign before each color enters slice scope:** Green G1, G3, G5; Blue B2, B5, B6; White W1, W2, W5; Black K1. ~10 redesigns total when those colors come back. Held for now.

**Each color's story (recap):**
- **Red:** *the warband self-destructs into a champion*. Reward pool extends to push-targeting + damage-as-fuel + Provocation-scaling.
- **Green:** *the rebellion outmaneuvers and out-shoots* (held, post-slice).
- **Blue:** *the apprentice studies, then casts* (held, post-slice).
- **White:** *the line endures, and is mended* (held, post-slice).
- **Black:** *summon a horror, give it to the other side, steal a soul on the way out — and run lean* (held, post-slice).

**Conversion verbs across colors:**
- **Red — Recruit** (✓ proposed — `R4`). Force-check; if you have more Force here, a creature on the other side moves to your front. The slice's primary deckbuilding mechanic.
- Green — reroute/redirect (Tempo-check intercepts incoming creatures) — held post-slice.
- Blue — research-token (per-encounter copy that never enters deck) — held post-slice.
- White — convert (overheal-into-flip) — held post-slice.
- Black — Nightmare (✓ proposed — `K5`) — held post-slice.

**Next:** finish Red reward pool (1-3 more cards: vehicle, multi-target Tactic, maybe a token-spawner), sketch enemy decks for the slice, sketch boss deck. Then move into engine work for slice mechanics (Recruit, push, pierce, Enraged, etc.).

**Next:** design Green/Blue/White conversion verbs, then start enemy-deck design (since rewards = enemy-deck cards taken via conversion).

## Captured ideas — multi-color biomes (DESIGN.md write-up later)

**Biome geography includes color-pair hybrid biomes.** Where two single-color biomes meet on the overworld map, a hybrid biome emerges with multi-color flavor. These biomes:

1. **Seed multi-color neutral cards** (cards with both colors' flavors and stats). These are the *only* place multi-color cards appear naturally — multi-color decks are a *route choice*, not a draft choice.
2. **Print location effects that reflect the intersection** of the two colors' identities. The effect typically *disables* or *modifies* mechanics from outside-the-pair colors, creating routing pressure.

**Working sketches per color pair:**
- **Blue-White (Parliament):** *"Creatures cannot change sides here."* (Disables Black's Nightmare, Red's Recruit, Green's Reroute, White's Convert. Blue's Research is unaffected — it doesn't change sides; it copies.)
- **Red-White (Battlefield Cathedral):** *"Creatures here can't be debuffed below 1 Force."* (Disables Black's debuff lattice from neutralizing Red+White presence.)
- **Red-Green (Wildlands):** *"Creatures with 0 Tempo can't act here."* (Penalizes pure-Force decks; rewards Tempo investment.)
- **Red-Blue (Storm Coast):** *"Spells dealing damage here deal +1."* (Boosts Red+Blue spell aggression.)
- **Red-Black (Wastelands):** *"Creatures here ignore retaliation."* (Cleave kills cleanly; thorns-style retaliation suppressed.)
- **Green-White (Sanctuaries):** *"Creatures here regenerate 1 Durability at start of upkeep."* (Free heal layer; passive sustain.)
- **Green-Blue (Mistlands):** *"Cards revealed here can be re-stealthed at end of phase."* (Stealth re-flip combos enabled at the location.)
- **Green-Black (Decay):** *"Creatures dying here go directly to your hand."* (Recursion-via-death; Black's flavor extended into Green's tempo.)
- **Blue-Black (Catacombs):** *"When a creature dies here, draw a card."* (Insight from death; Blue+Black scholar-of-the-dead flavor.)
- **White-Black (Ossuaries):** *"At end of turn, the side with less Durability lost this turn restores 1 to a creature."* (Mutual healing; opposing-side flavors balance.)

**Why this is rich:**
- **The biome map is the strategic terrain of the run.** Routing through Parliament shuts down 4 of 5 conversion verbs — most colors must avoid it. Routing through Wastelands enables Red-Black combat aggression but penalizes White's healing.
- **Color-pair biomes are *negative-space* effects.** They disable or modify, rather than enable. This creates *route-friendly* and *route-hostile* terrain for each color identity.
- **Multi-color cards live in these biomes exclusively.** A Red-Black multi-color creature is found only in Wastelands. A Blue-White Parliament card is found only in Parliament biomes. **Multi-color is geographic, not draftable.**
- **Pillar 1 deepens.** "The map is the battlefield" → "the map's color geography is the strategic context of every encounter." Routing decisions become identity-relevant decisions.

Held as a captured idea. Full DESIGN.md write-up when we work on the map / biome system.

---

## Red starter pool — Force, combat-pure, lone-champion payoff

**Per-color flavor effect:** "+X Force when alone here" — conditional stat printing seed.

**Color teaching goal:** Red is the tutorial color. Starter teaches *combat with one strategic wrinkle* (Pit-Fighter wants friendlies to die). Tribal vocabulary: **goblins** (scrappy recruits), **orcs** (rank-and-file ramp), **ogres** (lone champions). Trolls held for reward-tier.

**System variety:** 4 creatures + 1 equipment + 1 structure.

| # | Name | Type | Cost | F | T | D | Effect | Status |
|---|---|---|---|---|---|---|---|---|
| R1 | Goblin Brawler | creature | 0 | 1 | 0 | 2 | "On flip-up: if this is the only creature on your side here, gain +1 Force." | proposed |
| R2 | Crude Axe | equipment | 0 | — | — | — | "Equip. The wielder's attacks gain cleave." | proposed |
| R3 | Orc Bruiser | creature | ≥1F | 2 | 0 | 3 | "On flip-up: this gains +1 Force this turn." | proposed |
| R4 | Recruit | action | ≥1F | — | — | — | "If you have more Force here, a creature in front on the other side moves to the front on your side." | proposed |
| R5 | Ogre Pit-Fighter | creature | ≥1F | 1 | 0 | 4 | "+2 Force here while no other creature on your side is here." | proposed |
| R6 | Goblin Recruiter | creature | 0 | 1 | 0 | 2 | "On flip-up: if this is your only creature here, recruit." | proposed |

### Card-by-card rationale

**R1 Goblin Brawler** — Red's recruit. Free, 1 Force, 0 Tempo, 2 Durability. *"On flip-up: if this is the only creature on your side here, gain +1 Force."*

The narrow effect is a *seedling Pit-Fighter* — a tiny conditional Force bonus that whiffs when other goblins are around, but turns Brawler into a 2F/2D body when alone. **Pre-teaches Pit-Fighter's lone-champion mechanic at recruit tier.** By the time the player encounters Pit-Fighter (≥1F, +2 alone, while-conditional), they've already met the alone-condition idea on a free starter.

The buff is **default duration** (lasts while Brawler is in play) but *triggered by a flip-up if-condition* (one-time check, not continuous). After flip-up, even if other creatures arrive, the bonus stays. **Brawler is a different power tier of the alone mechanic from Pit-Fighter** — flip-up-if vs. while-condition; +1 vs. +2; free body vs. ramp body. Same DNA, different shape. Goblin tribe seeds Red's reward-tier vehicle/pilot synergies.

**R2 Crude Axe** — equipment, free, grants cleave. **Teaches the equipment card type *and* the cleave attack pattern at starter level.** Player sees: equipment doesn't take a slot, attaches to a host, grants a printed effect. Cleave is on-flavor for Red (anti-wide answer + friendly fire). Free cost makes equipping easy; the player learns "more bodies are better when paired with cleave."

**R3 Orc Bruiser** — first ramp. ≥1F gate, 2 Force, 0 Tempo, 3 Durability. *"On flip-up: this gains +1 Force this turn."*

The narrow effect is a *small unconditional this-turn buff* — Bruiser becomes 3F this turn, drops back to 2F next turn. **Always fires** (no whiff condition), but the buff is *scoped to this turn*. Reads as *"the orc charges in hard then settles in."*

Strategic implication: play Bruiser into a turn where you can use that 3F immediately — combat damage, Recruit's Force-superiority check, Bombardment's Force-here calculation. The this-turn duration encourages timing Bruiser's arrival to a high-impact combat moment, not just dropping it for stat presence. Orc tribe — disciplined-ish, rank-and-file.

**R4 Recruit** — *Red's starter conversion verb*. ≥1F gated action. *"If you have more Force here, a creature in front on the other side moves to the front on your side."* The taken creature joins your piles forever. Per the conversion-verb framework, this is how Red brings cards into the player's deck. Cost-balanced via the Force-superiority requirement: you must already be winning the Force projection contest at this location. Cleave + numeric Force advantage from front-row recruits creates the pre-condition; Recruit cashes the advantage into a permanent acquisition.

**Note:** Orc Veteran (the prior ≥2F generic ramp) was removed to make room for Recruit. Reaver-class generic ramps don't carry story-driving roles; the conversion verb is much more flavor-driving for Red's starter pool. Veteran can return as a reward-tier card.

**R5 Ogre Pit-Fighter** — *Red's payoff card*. ≥1F cost, 1 Force baseline, 4 Durability, +2 Force when alone. Two play phases:
1. **Bad version on commit.** Costs Force you established with recruits, comes in weak. Sits behind the line while Brawlers do the work.
2. **Strong version when alone.** As recruits die, Pit-Fighter's bonus turns on (becomes 3 Force). The high Durability (4) means Pit-Fighter outlasts the front line *by design* — it's built to be the last creature standing.

The teach: **you want your front line to die in service of your champion.** Red as anti-faction expressed at starter scale.

**R6 Goblin Recruiter** — *Red's second Recruit source*, creature-shaped. Free, 1 Force, 0 Tempo, 2 Durability. *"On flip-up: if this is your only creature here, recruit."*

Recruiter only fires the Recruit verb when it's *alone* on your side at this location. The alone-condition is an additional gate on top of Recruit's underlying Force-comparison rule:
- Alone-condition required → Recruiter is the only creature on your side here.
- Force comparison still required → your side's Force here (Recruiter's 1F) must exceed the other side's Force here.

Combined: Recruiter only succeeds when you have *exactly* Recruiter on your side here AND the other side has 0 Force at this location. **The card naturally targets Force-less utility creatures** — Mages, Acolytes, scribes, Apprentices, etc. — when they're alone in front on the other side.

**Why Recruiter exists in the starter:** the Recruit (action) card is one source of deckbuilding; Recruiter is a *second, niche, opportunistic* source. Different niche from action-Recruit:
- Action-Recruit: ≥1F gate, can recruit anything Force can beat. Mid-late game power play.
- Goblin Recruiter: free creature, alone-only, takes only 0-Force targets. **Round-1 utility-creature snipes.**

Together they make Recruit feel like *Red's identity* (deckbuilding via Force-superiority) rather than *one specific card*. **Two paths to deckbuilding from turn 1.**

**Future hand-buff payoff:** the alone-only condition means Recruiter's Force is artificially low at the location. *Hand buffs* (a Pass 2 design space — printing cards that buff the leftmost creature in hand before it enters play) would be the way to *raise Recruiter's Force at flip-up*. A Recruiter that flipped up at +2 Force from a hand-buff comes in at 3 Force, alone, and beats 2-Force ramps. **Recruiter is the *card that pays off* hand-buff design space.** Hand-buffs are post-slice; for now, Recruiter is a niche-but-real round-1 tool.

**Note:** Watchfire (the previous R6 starter structure) was dropped. Red starter now has 3 card types (creature + equipment + action), no structure. Red as a tribe-of-fighters builds engineering structures *as rewards* (Salvage Yard, etc.); starter Red is *people, not buildings*. Reasonable thematic fit.

### Want web (Red)

- Goblin Brawler → universal opener, enables every gate.
- Crude Axe → wants a friendly creature *with another friendly nearby* (cleave hits that friendly too — the friendly fire teach).
- Orc Bruiser → wants Brawler down first (≥1F gate).
- Orc Veteran → wants 2+ Force on board (Brawler + Bruiser, or 2 Brawlers).
- Pit-Fighter → wants the rest of your board to *die* (lone-champion payoff).
- Watchfire → wants ≥1F on board to commit; once played, helps pay for the next ramp.

### Open questions on Red

- **Is Crude Axe at free cost too good?** Cleave is one of the strongest attack patterns. But it's friendly fire — equipping it means cleave hits your own creatures. Self-balancing in Red's anti-faction frame.
- **Should Pit-Fighter be ≥2F instead of ≥1F?** ≥2F makes it harder to land; ≥1F means it can come in turn 2-3. ≥1F feels right for starter pacing.

---

## Red reward pool — first batch (vertical slice)

**These are reward-tier Red cards** designed for the vertical slice: cards the player can encounter in enemy decks and Recruit into their deck. The slice's enemy decks draw from this pool plus the Red starter pool.

**Story:** reward Red expands the *warband self-destructs into a champion* arc with mechanics that make the death-spiral more interesting:
- **Push** (Bully) creates the targeting opportunity for Recruit — manipulate the front to isolate the creature you actually want.
- **Self-damage as fuel** (Battle Driver, Berserker) turns combat damage into Force gain.
- **Pierce** (Pike) reaches back-row threats from the front.
- **Provocation** (Challenger) scales on enemy presence — flips Pit-Fighter's "alone" identity into a "surrounded" identity.

**System variety:** 3 creatures + 1 equipment + 1 action (provisional 5 cards; aiming for ~6-8 reward cards before slice freeze).

| # | Name | Type | Cost | F | T | D | Effect | Status |
|---|---|---|---|---|---|---|---|---|
| RR1 | Goblin Bully | creature | ≥1F | 1 | 0 | 2 | "On flip-up: push the creature across from this from front to back." | proposed |
| RR2 | Goblin Berserker | creature | ≥1F | 1 | 0 | 3 | "Enraged. *(Gains +1 Force this turn each time it takes damage this turn.)*" | proposed |
| RR3 | Pit-Goblin Challenger | creature | ≥2F | 1 | 0 | 3 | "+1 Force per creature on the other side here. Creatures on the other side here gain +1 Force." | proposed |
| RR4 | Battle Driver | action | ≥1F | — | — | — | "Deal 1 damage to a creature on your side here. That creature gains +1 Force this turn." | proposed |
| RR5 | Goblin Pike | equipment | ≥1F | — | — | — | "Equip. The wielder's attacks gain pierce 1." | proposed |
| RR6 | Goblin Bombardment | action | ≥1F | — | — | — | "Sacrifice a goblin on your side here. Deal damage equal to your Force here." | proposed |
| RR7 | Bounty | action | — | — | — | — | "Quest: the next creature on the other side destroyed in combat at this location is sent to your graveyard." | proposed |

### Card-by-card rationale

**RR1 Goblin Bully** — the *push* setup card. Cost ≥1F, modest body (1F/2D). On flip-up, pushes the creature across from Bully from front to back. **The creature pushed is still in play** — it's now in back, doesn't project Force, doesn't attack from front, but still blocks for the summoner and takes damage. Bully's flip-up doesn't *remove* a creature; it *displaces* it.

**The Pillar 10 use case:** Bully isolates a Recruit target. If the other side's front has 2 creatures (a Mage and a Bruiser, say), and the player wants the Mage, Bully pushes the Bruiser to back. Now Mage is alone in front. Recruit fires on the Mage — *guaranteed*, because there's only one valid target. **This is the heart of the design at work** — manipulate the board so that exactly one card qualifies for the random-target effect.

**Open question:** what if the opposing back-row slot is full? Push fizzles per the standard fizzle rule. Worth noting for clarity.

**RR2 Goblin Berserker** — the **Enraged** keyword card. Cost ≥1F, 1F/3D. Each time the Berserker takes damage this turn, gains +1 Force this turn. Stacks. Combat damage triggers it naturally; Battle Driver triggers it explicitly; multiple damage sources stack the Force gain.

**Strategic combo:** Battle Driver on Berserker = +1 damage to Berserker = +1 Force from Enraged + +1 Force from Battle Driver = +2 Force this turn. Berserker swings for 3 (1 base + 2 buffs). Or feeds the buffed Force into Recruit's superiority check at resolve time.

**RR3 Pit-Goblin Challenger** — Provocation creature. Cost ≥2F, 1F base, 3D. Scales on opposing creature count: gains +1 Force per creature on the other side here. *And* gives those creatures +1 Force in return. Asymmetric trade — Challenger gains more than they grant, but the opponent gets *something*.

**Inverts Pit-Fighter's identity.** Pit-Fighter wants to be alone; Challenger wants to be surrounded. **Anti-synergy with Pit-Fighter** — they fight each other for board space (Pit-Fighter's "alone" condition breaks if Challenger is there). On-flavor for Red: even Red sub-mechanics fight each other.

**RR4 Battle Driver** — the damage-as-buff cycle action. Cost ≥1F. Deals 1 damage to a creature on your side here, that creature gains +1 Force this turn. Trade Durability for Force. Best paired with Berserker (double-buff) or with a creature about to swing for damage anyway.

**RR5 Goblin Pike** — equipment with **pierce 1**. Cost ≥1F. Equip a creature; their attacks gain pierce 1.

**Pierce mechanic:** the wielder's attack hits the front-row target normally (full Force damage), *and* deals X damage (the pierce value) to the back-row creature behind that target. If there's no back-row creature, the pierce damage falls through to the summoner (per universal damage fall-through). If there's no front-row target either, the wielder's full Force hits the back-row blocker, and pierce hits the summoner.

**Pierce is a capped trample.** Front-row damage is the wielder's Force; back-row damage is capped at the printed pierce value. Pike is *anti-mage tech* for Red — back-row utility creatures (Mages, scribes) are usually 1-2 Durability and pierce 1 picks them off.

**RR6 Goblin Bombardment** — action with the **Sacrifice** keyword. Cost ≥1F. *"Sacrifice a goblin on your side here. Deal damage equal to your Force here."*

**This card opens a new design space — tribal-as-resource costs.** Bombardment isn't gated by stat presence alone; it requires *a goblin on your side here, sacrificeable*. The goblin is the *ammunition*. No goblins → Bombardment fizzles.

**The mechanics interlock:**
- **Sacrifice** is a new keyword: send a creature on your side directly to the graveyard. Per Pillar 10, the system picks the sacrificed creature at random from legal candidates (goblins on your side here). The player's setup is *which goblins are present*; the system picks among them.
- **Damage scales on Force here at resolve time, *after* the sacrifice.** The sacrificed creature's Force is gone before damage calculates — so sacrificing your highest-Force goblin *lowers* the damage. The math points the player at sacrificing weak goblins (Brawler 1F) and keeping strong ones (Bruiser 2F).
- **Sacrifice triggers death-triggers.** Sacrificing a creature is a death event; deathwish and other death-triggered effects fire normally. (Cultist Martyr's deathwish would fire on sacrifice — but Martyr is Black, not goblin, so Bombardment can't sacrifice Martyr. Tribal-as-resource creates color-locked combos.)

**Strategic interactions:**
- **Pit-Fighter combo:** Bombardment sacrifices a Brawler → Pit-Fighter is now alone → conditional bonus turns on. **Two effects from one action.**
- **Recruit setup tension:** Bombardment removes a goblin from your front. If you were planning to use that goblin as Recruit-superiority Force, Bombardment is at odds with Recruit. Player chooses per-turn: damage now (Bombardment) or build Recruit pressure (keep goblins).
- **Berserker synergy?** Berserker is Enraged but isn't a goblin (printed as Goblin Berserker — wait, it is). So Bombardment can sacrifice Berserker. But Berserker is your damage-stacker — sacrificing it is bad. Implication: **the player wants weak goblin recruits as ammunition, not their buffed Force-printers**. Tribal designation matters; goblin-with-no-buffs is the right sacrifice target.

**Why this is excellent for Red:**
- Reflects Red's *throw-the-goblin-at-the-problem* identity perfectly. Goblins as ammunition is the deepest Red flavor.
- Damage payoff that's *not* Insight-gated. Different cost shape from Blue's spells.
- Self-attenuating (sacrificing high-Force creatures lowers damage) — the system points at the right sacrifice target naturally.
- Opens a category for all 5 colors (sacrifice a tribal creature for a color-flavored payoff).

**Open question:** does the sacrifice happen *before* damage resolves? Per the resolve order: yes — sacrifice fires first (the creature is in the graveyard), then damage calculates Force-here using the post-sacrifice board. This is the cost-paid-then-effect model.

**RR7 Bounty** — Red's first **Quest**. Quests are persistent actions that resolve when a printed condition is met, then exit to graveyard. Curse, Prayer, and Quest are the three printed persistent-action subtypes (rules-text concept "persistent action" is not printed terminology).

Bounty's condition: the next time a creature on the other side is destroyed in combat at this location. On trigger, the destroyed creature is sent to the player's graveyard (acquired into deck via end-of-encounter reshuffle), and Bounty resolves and exits.

**Combat-only trigger.** Spell damage killing an enemy creature here does not trigger Bounty. Pairs Bounty specifically with combat-focused decks.

**Same-phase tie-handling.** When a single attack destroys multiple enemy creatures (cleave, AOE pierce, etc.), the *direct attack target* counts as destroyed first; splash damage targets count after. Bounty claims the direct-attack target.

Cost and stat values deferred until tuning.

### Want web (Red reward tier)

- **Goblin Bully** wants to set up a Recruit (push to isolate target).
- **Goblin Berserker** wants damage taken (combat or Battle Driver) to stack Force.
- **Pit-Goblin Challenger** wants opposing creatures to scale on.
- **Battle Driver** wants Berserker to combo with, or any creature about to swing.
- **Goblin Pike** wants a front-row attacker to wield it; pairs with Bully (push the front, swing past with pierce, hit back).

The card pool has **strong internal synergy** — Bully + Recruit, Battle Driver + Berserker, Pike + Bully (push someone aside, swing the Pike-wielder, pierce the back). At the same time, pieces fight each other (Pit-Fighter + Challenger anti-synergize). **Red's identity holds: synergy without coordination, sub-mechanics that don't always cooperate.**

### Open questions on Red reward pool

- **Card #6 / #7 / #8 still TBD.** Could include: a vehicle (the chaos-pilot synergy), a multi-target Tactic (front-row only — *"all creatures on your side in front here gain +1 Force this turn"*), a goblin token-spawner, a structure (e.g., Salvage Yard — but that needs junkyard, deferred). Likely to add 2-3 more cards before slice freeze.
- **Salvage held.** Junkyard zone is out of slice scope; Salvage waits until that infrastructure exists.

---

## Green starter pool — Tempo, movement, ranged + ammo

**Per-color flavor effect:** small movement keyword + ranged combat with ammo (replaces earlier "damage on flip-up" framing).

**Color teaching goal:** Green's identity is *speed and reach*. Starter teaches:
- Movement (on Pathfinder)
- Ranged combat (back-row attackers fire in combat; consume ammo)
- Ammo as the first explicitly consumable resource
- The ammo-action cycle (Forage adds ammo; Slinger consumes it)

Tribal vocabulary: **Rebel** (organized but guerilla — the dominant tribe). Off-pattern: **Pathfinder** (no tribe, no Force — outsider whose role is movement).

**System variety:** 5 creatures + 1 action.

| # | Name | Type | Cost | F | T | D | Effect | Status |
|---|---|---|---|---|---|---|---|---|
| G1 | Rebel Scout | creature | 0 | 1 | 1 | 2 | — | proposed |
| G2 | Pathfinder | creature | 0 | 0 | 2 | 2 | "May move to an adjacent slot in this location at start of main." | proposed |
| G3 | Rebel Skirmisher | creature | ≥1F | 2 | 0 | 2 | — | proposed |
| G4 | Rebel Slinger | creature | ≥1F | 1 | 1 | 2 | "Ranged. Ammo 1." | proposed |
| G5 | Rebel Outrider | creature | ≥2F + ≥1T | 2 | 2 | 3 | — | proposed |
| G6 | Forage | action | 0 (escalating) | — | — | — | "Add 1 ammo to this location's stockpile. This requires +1 Tempo here for each previous cast of this card this encounter." | proposed |

### Card-by-card rationale

**G1 Rebel Scout** — Green's recruit. Free, 1 Force, 1 Tempo, 2 Durability. Bootstraps both axes cheaply.

**G2 Pathfinder** — *off-pattern card*. No tribe (intentional gap — they're aligned with the rebellion but not of it; an outsider hired for their feet). 0 Force, 2 Tempo, 2 Durability. Movement keyword: "May move to an adjacent slot in this location at start of main." The teach: repositioning is a Green capability, and *some creatures don't fight at all*. Pathfinder also pays the Tempo gate for Outrider, making it strategically important despite zero combat damage.

**G3 Rebel Skirmisher** — first ramp. ≥1F gate, 2 Force, 0 Tempo, 2 Durability. Genuinely better Force than Scout (so it's not a sidegrade); no Tempo (so it doesn't redundantly stack with Scout's Tempo printing).

**G4 Rebel Slinger** — *the ranged starter creature*. ≥1F gate, 1 Force, 1 Tempo, 2 Durability. **Ranged. Ammo 1.** Player commits Slinger to back row; it consumes ammo from the location's stockpile to fire during combat. Without ammo, Slinger sits there contributing stats but unable to attack. Teaches ranged + ammo + stockpiles + back-row-as-functional-position.

**G5 Rebel Outrider** — second ramp, *compound gate*. ≥2F + ≥1T cost. 2 Force, 2 Tempo, 3 Durability. The big Green body. Compound cost means you need *both* Force and Tempo presence — driving Pathfinder's value (the only free Tempo body in the pool).

**G6 Forage** — *the ammo action with escalating cost*. **Cost is 0 base, escalating +1 Tempo per cast this encounter (per card instance)**. First cast: free. Second cast: ≥1T. Third cast: ≥2T. Etc. Adds 1 ammo to this location's stockpile per cast. Teaches:

- Actions exist, cost stat-presence, generate consumable resources (ammo).
- *Escalating cost* as a new mechanic class — cards can become harder to play the more you've used them. Self-balancing against infinite-ammo loops.
- Per-instance escalation: two Forage cards in a deck track separately. Each Forage represents *that particular forager's* depletion of the local environment. Adding more Foragers via rewards extends the cheap-cast runway.
- Encounter-scoped reset: the counter clears at encounter end. Each new encounter, the wilderness is fresh.

Flavor: scavenging makeshift ammo from the natural environment. First time, easy pickings. Second time, slimmer. By the fourth time, you've combed the area — finding more requires real Tempo presence (speed, reach, patience to keep looking).

### Want web (Green)

- Rebel Scout → opens both Force and Tempo gates economically.
- Pathfinder → enables Outrider's Tempo gate, enables Forage; also re-positions in combat.
- Rebel Skirmisher → ramps Force without redundant Tempo.
- Rebel Slinger → wants Forage + back-row positioning to fire.
- Rebel Outrider → wants Force *and* Tempo presence — the compound gate ties the pool together.
- Forage → first cast is free anywhere; later casts want Tempo presence (escalating). Enables Slinger to fire; running multiple Forages stacks ammo cheaply early but each card escalates independently.

### Open questions on Green

- **What is "an adjacent slot in this location"?** A 2x2 grid has each slot adjacent to 2 others (front-row slots adjacent to their own back-row slot + the other front-row slot; same for back row). Pathfinder can move to any of those if the destination is empty. Is this the right rule? Alternative: only same-row movement, or only column-flip (front <-> back). Movement geometry needs pinning down at engine-implementation time.
- **Does Slinger need ammo at *start of combat* or at *moment of attack*?** If start-of-combat, Forage played the same turn fires the same combat. If moment-of-attack, Forage in main feeds Slinger's combat. The latter is more flexible; the former is simpler. Engineering call.
- **Forage cost was reframed as escalating per-cast.** First cast 0, each subsequent cast +1T required. This replaces the "≥1T flat" earlier draft. See escalating-cost note in mechanics reference. **Engine implication:** per-card-instance state tracking is new — each card needs a `castsThisEncounter` counter that resets at encounter end and persists through deck → hand → discard → deck cycles within an encounter.

---

## Blue starter pool — fragile engine, study, payoff spell

**Per-color flavor effect:** the **history-tracking Insight engine** — Magus Apprentice generates Insight per action played this turn. Study draws (and counts as an action). Spark fires once Insight is high enough.

**Story:** *the apprentice studies, then casts.* Blue's deck cannot fire spells round 1 — the Apprentice's Insight printing depends on actions played *this turn*. Round 1: place the Apprentice (a fragile body). Round 2: cast Study (draws a card, counts as 1 action), Apprentice prints 1 Insight, you can cast Spark for 1 damage *if* you've drawn it. Round 3+: chain studies, build deeper Insight, fire bigger.

The whole deck routes through *protecting the fragile Apprentice* while she ramps Insight by counting actions. Without the Apprentice, no Insight, no Spark. Without Study, the Apprentice prints zero Insight. Without Spark, Study just thins for nothing meaningful. **The three cards form a single mechanism.**

The trio:
- **Magus Apprentice** prints *zero* base Insight. Text: *"+1 Insight here for each action you've played this turn."* Fragile body (1 Durability), zero combat presence.
- **Study** is a free action. Text: *"Draw 1."* The act of casting Study *is* an action — it counts toward Apprentice's Insight by virtue of card type, not explicit hand-off.
- **Spark (starter)** is the payoff. ≥1 Insight cost. Text: *"Deal 1 damage here."* The starter version of Spark prints 1 damage, not 2 (the reward-tier version is the upgrade).

Tribal vocabulary: **Apprentice / Adept / Sage** for the arcane-academia mage progression. **Magus** as the Apprentice's tribe (their school of magic). Off-pattern: **Scribe** (a librarian / record-keeper, not a Magus practitioner) or other non-Magus naming for the off-tribe card.

**System variety:** 4 creatures + 2 actions.

| # | Name | Type | Cost | F | T | D | Effect | Status |
|---|---|---|---|---|---|---|---|---|
| B1 | Magus Apprentice | creature | 0 | 0 | 0 | 1 | "+1 Insight here for each action played from your side this turn." | proposed |
| B2 | Adept Mage | creature | 0 | 1 | 0 | 2 | — | proposed |
| B3 | Study | action | 0 | — | — | — | "Draw 1." | proposed |
| B4 | Spark (starter) | action | ≥1 Insight | — | — | — | "Deal 1 damage here." | proposed |
| B5 | Sage Mage | creature | ≥1F | 2 | 0 | 2 | — | proposed |
| B6 | Archmage | creature | ≥2F | 2 | 0 | 3 | — | proposed |

### Card-by-card rationale

**B1 Magus Apprentice** — *the Insight engine*. Free, 0 Force, 0 Tempo, **1 Durability**. Fragile by design — Apprentice is the deck's *load-bearing creature* and *also its most vulnerable*. One hit kills her. The whole deck routes through protecting her.

**Effect:** *"+1 Insight here for each action you have played this turn."* The Insight is generated *passively* by counting actions — no explicit hand-off needed. Cast Study? Apprentice prints 1 Insight. Cast Study again? Apprentice prints 2. Cast Spark? Apprentice prints 3 *for that resolve* (counting the Spark itself? Probably *no* — actions counted are those *resolved before* the current action).

**The history-tracking nature** — Apprentice's stat printing changes based on actions you've played this turn. This is the *output* version of the same history-tracking class as Forage (which is *input*). Same mechanic class, opposite direction. See escalating-cost / history-tracking note in DECISIONS.md.

**B2 Adept Mage** — second free creature. 1 Force, 0 Tempo, 2 Durability. Force-printer recruit. **Stands in front of Apprentice** to absorb hits. The Adept Mage's combat role is *protecting the engine*, not winning combat. Tribal: Magus order, junior journeyman.

**B3 Study** — *the cycler*. Free action, "Draw 1." The teach: actions *exist as a card type*, can be cast freely, and *count toward Apprentice's Insight* by virtue of *being an action* (not because Study explicitly hands off Insight).

**Narrowness:** Study does *one* thing — draws a card. It does not print Insight. The Insight comes from Apprentice counting Study as an action. Splitting the draw and the Insight printing across two cards is the **narrow-cards-need-each-other** principle in action.

**Discard cycle:** Study resolves to discard, reshuffles when deck empties. Multiple casts of Study per turn are possible (action slot must be free; the card-type-as-axis principle says one action can be cast each turn the slot is empty). Each cast counts as one action for Apprentice.

**B4 Spark (starter)** — *the payoff*. ≥1 Insight cost. Deal 1 damage here.

The starter Spark is **strictly weaker than the reward-tier Spark** (which deals 2 damage). The reward upgrade is *graduating from apprentice's spark to the real spark* — the deck's narrative arc continues in the reward pool.

**Per damage fall-through rule:** Spark deals 1 damage to a random enemy creature here, OR to the opposing summoner if no enemy creatures here. Card text just says *"deal 1 damage here"* — the fall-through is implicit.

**B5 Sage Mage** — first creature ramp. ≥1F gate, 2 Force, 2 Durability, no text. Workhorse stat-printer; stands in front of the Apprentice. Tribal: Magus order, mid-rank.

**B6 Archmage** — second creature ramp. ≥2F gate, 2 Force, 0 Tempo, **3 Durability**. The pool's most durable creature. Tribal: Magus order, senior. Combined with Adept and Sage (also Magus) you have three Magus creatures plus the Apprentice — four bodies that protect the apprentice in shifting positions.

### Want web (Blue)

- Magus Apprentice → wants actions cast each turn (Study, Spark) to generate Insight.
- Adept Mage → wants to be in front of Apprentice (defensive role).
- Study → wants to be cast (free, always-castable); each cast feeds Apprentice's count.
- Spark → wants Apprentice alive and 1+ actions already played this turn.
- Sage Mage → wants ≥1F on board (Adept or Apprentice — wait, Apprentice is 0 Force; only Adept ramps).
- Archmage → wants 2+ Force on board (Adept + Sage, or Adept + new free recruit).

The trio is **Apprentice + Study + Spark**. Without any one of them, the deck's whole arc breaks. The remaining 3 (Adept, Sage, Archmage) are *protectors and Force economy* — they exist to keep the Apprentice alive long enough to cast Spark.

### Open questions on Blue

- **Is the Apprentice at 1 Durability too fragile?** Yes, by design. A Black Hexer kills her in one hit. Red Brawler kills her in one hit. The deck's whole strategic shape is *protecting her*. Defensive creatures (Adept Mage in front) are the answer. If 1 Durability feels too punishing, can be tuned to 2 — but then the protect-her tension flattens.
- **Does Spark count as an action when it resolves, contributing to its own Insight cost?** *No* — actions counted are those *resolved before* the current action. So Spark itself doesn't bootstrap its own cost. The deck needs Study (or another action) cast first, then Spark can fire on the count of *prior* actions.
- **Engine implication:** Apprentice needs an `actionsPlayedThisTurn` counter per side per turn that resets on cleanup. The Apprentice's stat-printing is computed dynamically based on this counter. New state shape.
- **Worry remains: Blue starter is the weakest combat pool.** Force values 0/1/2/2/2/0 — no big damage. Blue's reward pool compensates with damage spells (Spark 2-damage, Heralding Spark, etc.). Starter Blue is genuinely weak in combat by design — the deck wins by *casting Spark across multiple turns*, not by stat-pressure.
- **Two actions in starter (Study + Spark) is more than other colors.** Acceptable because Blue is *the action color*. Action density in starter is on-flavor.
- **Initiate Scribe (the off-pattern card from earlier draft) is dropped.** Replaced by tighter trio. Future expansion of Blue starter could re-add a Scribe-type card; for now the 6-card pool is clean without it.

---

## Blue reward pool — first batch (the three action-acquisition vectors)

The first batch of Blue reward-tier cards spans the **three action-acquisition vectors** (see DESIGN.md → *Blue's three action-acquisition vectors*): equipment, structure, and persistent action. Together they give Blue real deck-growth paths beyond the encounter-only research-token model.

All three express the same Blue verb — **copy, never steal** — with distinct conditions, scope, destinations, and timings.

**System variety:** 1 equipment + 1 structure + 1 persistent action.

| # | Name | Type | Cost | F | T | D | Effect | Status |
|---|---|---|---|---|---|---|---|---|
| BR1 | Spellbook | equipment | ≥2I | — | — | — | "3 pages. Equip. When an opposing action resolves at this location, this loses 1 page; a copy of that action enters your discard pile. When pages reach 0, this is destroyed." | proposed |
| BR2 | Forbidden Library | structure | ≥3I | 0 | 0 | — | "When the next opposing action resolves at this location, copy it to your hand. Then this is destroyed." | proposed |
| BR3 | Archeological Expedition | action | ≥2I | — | — | — | "Add a copy of an action in the other side's graveyard to your graveyard." | proposed |
| BR4 | Archive | action | ≥1I | — | — | — | "Move an action in the other side's discard pile to their graveyard." | proposed |

### Card-by-card rationale

**BR1 Spellbook** — Blue's *ongoing study* equipment. ≥2 Insight gates it to Insight-rich locations (Blue's mage-heavy boards). Once equipped to a creature on your side, every opposing action that resolves at the wielder's location burns 1 of 3 pages and adds a copy to your discard pile (cycles back into your deck via reshuffle).

The wielder is the load-bearing defense — kill the wielder, equipment goes to junkyard. Spellbook is an *infrastructure investment that demands protection*. Cross-color synergies light up: White Bodyswap to put a tank in front of the wielder, Green stealth to skip combat, Red walls defending the wielder's column. Blue alone struggles to defend Spellbook; Blue + a defensive splash is the natural shape.

Wielder mobility: when the wielder moves (Shove, Disperse, Bodyswap), Spellbook moves with them; "this location" tracks wherever the wielder now is. The book is *carried*, not pinned.

Theme: a scribe's notebook. The wielder observes enemy spells, rips a page, inscribes the spell. One page = one copy.

**BR2 Forbidden Library** — Blue's *single big play* structure. ≥3 Insight is premium-tier (matches Counterspell). One-shot: copies the *next* opposing action resolving at this location to your *hand* (immediate use this encounter, distinct from Spellbook's discard destination), then destroys itself.

The hand destination is the lever that justifies the premium cost. Spellbook copies into discard (cycles back later); Library copies into hand (castable right now). Use case: drop Library when an enemy persistent action is about to resolve here (Prayer, Curse, Counterspell), copy into hand, cast the copied action next turn for double-value.

No wielder defending it; vulnerable to standard structure-removal.

Theme: a forbidden book, opened once, the secret out. Protection breaks; library destroys itself.

*Flagged for revisit:* the underlying "copy enemy action resolving here" verb overlaps Spellbook. The hand-destination is a real differentiator but worth iterating in a future pass on whether the variety is sharp enough at the gameplay level.

**BR3 Archeological Expedition** — Blue's deck-acquisition action. One-shot: copies an action from the other side's graveyard into your graveyard. Random target per Pillar 10. Copy joins your deck for next encounter via graveyard reshuffle at encounter end — not an in-encounter weapon, a long-game deck-building tool.

Setup-required: the other side has to have an action in their graveyard. Counterspell is the natural setup tool (sends countered actions to graveyard); Archive (BR4) is the dedicated setup tool — it moves opposing actions from discard to graveyard, *not for the effect, for the relocation*.

Theme: an archeological dig. What's already buried can be unearthed.

**BR4 Archive** — Blue disruption. Moves a random action from the other side's discard pile to their graveyard. Doesn't counter the effect (the action already resolved); it removes the card from the *cycling* loop. Discard pile reshuffles into deck on deck-empty; graveyard does not. So Archive ensures the targeted action is locked out of the rest of the encounter.

Pairs with Archeological Expedition — Archive fills the other side's graveyard, Expedition mines it. Each works alone: Archive is pure disruption, Expedition copies whatever the other side has graveyard'd through other means (Counterspell, etc.).

Theme: scholarly Blue's quiet sabotage — misfile the page so it can't be found again.

### Want web (Blue reward tier)

- Spellbook → wants high-Insight wielder (Blue mage), defensive splash to protect the wielder, locations the opponent must commit actions at.
- Forbidden Library → wants enemy persistent actions about to resolve here, hand-played follow-up next turn.
- Archeological Expedition → wants opponent forced to resolve high-value actions at this location; counter-play against opponent's low-value-baiting tactics.
- All three → benefit from cross-location pressure (forcing the opponent to resolve actions at locations the player can't avoid).

### Open questions on Blue reward pool

- **Spellbook page count.** 3 working assumption. Tunable in playtest.
- **Forbidden Library similarity to Spellbook.** Flagged for revisit; verb overlaps and hand-destination may not be enough variety. May redesign trigger or effect in a future pass.
- **Archeological Expedition trigger window.** End of cleanup (one check per turn). May tune to "end of any phase where an action resolved" if cleanup-only feels too telegraphed.
- **Persistent actions and Expedition's trigger.** A Prayer/Curse that ticks once but stays in slot — does that count as "an action resolved here this turn"? Working assumption: no, only fully-resolved-and-leaving-play actions count.
- **Cost scaling.** Spellbook ≥2I (premium-but-accessible); Library ≥3I (premium, matches Counterspell); Expedition ≥2I. Library is the most expensive reflecting its better destination (hand).

---

## White starter pool — patience, marks, and self-sacrifice

**Per-color flavor effect:** healing / restoration with positional targeting *and* the **mark** mechanic (Wayshrine bestows divine attention on a chosen creature).

**Story:** *the line endures, and is mended.* White builds a defensive front, marks the chosen creature with divine attention (Wayshrine's flip-up grants healing-per-turn), and sacrifices the front-line position itself when the situation calls (Get Down swaps a tank into harm's way after the Force-printer has swung). Patience compounds across turns; the line outlasts whatever the enemy can throw.

The trio:
- **Defender** soaks. Free, 0 Force, 3 Durability — a body that doesn't fight but takes hits.
- **Wayshrine** marks. ≥1F structure; on flip-up, designates a friendly creature here as **marked**. The mark grants regeneration each upkeep.
- **Get Down** swaps. An action that swaps the highest-Durability friendly here with a friendly directly in front. The play pattern: front-row Force-printer swings in combat; after combat, swap a tank into the front so the Force-printer is safe.

Each card by itself is weak. Together they describe a way of playing: *commit early, mark a chosen creature, position your line so the right body absorbs the next hit.* White's strategic shape is **patient asymmetric defense** — never the fastest path to a kill, but very hard to run out of bodies against.

**Tribal vocabulary:** **Initiate / Mender / Steward** for clergy-flavored creatures. **Defender** is off-pattern (civilian, not clergy — high Durability with no fighting role). Get Down and Wayshrine don't take a tribe (action and structure).

**System variety:** 4 creatures + 1 structure + 1 action.

| # | Name | Type | Cost | F | T | D | Effect | Status |
|---|---|---|---|---|---|---|---|---|
| W1 | Cleric Initiate | creature | 0 | 1 | 0 | 2 | — | proposed |
| W2 | Defender | creature | 0 | 0 | 0 | 3 | — | proposed |
| W3 | Cleric Mender | creature | 0 | 0 | 0 | 2 | "On flip-up: a creature on your side in front (here) regenerates 1 Durability." | proposed |
| W4 | Wayshrine | structure | ≥1F | 0 | 0 | — | "On flip-up: mark a creature on your side here. The marked creature regenerates 1 Durability at the start of each upkeep. The mark is removed if the creature leaves play." | proposed |
| W5 | Cleric Steward | creature | ≥2F | 2 | 0 | 3 | — | proposed |
| W6 | Get Down | action | ≥1F | — | — | — | "The highest-Durability creature on your side here swaps with a creature on your side in front." | proposed |

### Card-by-card rationale

**W1 Cleric Initiate** — free Force-printing recruit, the universal opener. 1 Force, 2 Durability. Bootstraps the location's economy.

**W2 Defender** — *off-pattern card*. No tribe; civilian, not clergy. 0 Force, 3 Durability. The body that wants to be the *post-swap front line* — high Durability so it can absorb hits when Get Down moves it forward, no Force so its combat contribution is purely defensive.

**W3 Cleric Mender** — burst-heal niche. Free, 0 Force, 2 Durability. Flip-up heals the creature directly in front. *One-shot* heal that fires the moment Mender flips up. Distinct from Wayshrine's recurring mark — Mender saves a creature *this turn*; Wayshrine sustains a creature *over many turns*. Burst vs. sustain split.

**W4 Wayshrine** — **the central White starter card**. ≥1F structure, 0/0/— stats. On flip-up: marks one friendly creature at this location with **divine attention**. The marked creature regenerates 1 Durability at the start of each upkeep for as long as it stays in play. If the marked creature leaves play, the mark is lost (no migration to another creature, no second chance — divine choice was specific). If Wayshrine itself is destroyed, the *already-bestowed* mark persists — the structure was the consecrating act, not the ongoing source.

**Why mark-on-flip-up rather than action-driven mark:** an action that bestows a mark would cycle through the discard pile — within a few turns the player marks every creature on their side, making the line effectively unkillable. Tying the mark to a structure flip-up *bounds* it: 1 structure slot per location, 1 flip-up per encounter (rewards may add stealth/re-flip combos that retrigger, but that's reward-tier scaling). Mark-via-structure is balanced for starter scale.

**Flavor:** *divine inspiration / the chosen one / blessed protector.* The Wayshrine is a holy site; standing within its consecration grants the chosen creature ongoing protection. The choice is *where you build the shrine*, and *which creature is in its presence at the moment of consecration* (flip-up).

**W5 Cleric Steward** — second ramp. ≥2F gate, 2 Force, 3 Durability. White's big body for late-encounter pressure.

**W6 Get Down** — **the swap action**. ≥1F gate. Swaps the highest-Durability friendly creature here with a friendly creature in the slot directly in front of it. Per Pillar 10, the swap auto-resolves on the highest-Durability creature (random pick if tied); the *front* creature is positionally determined.

**Resolution timing:** committed in main, **resolves at end of combat phase**. The play pattern is: front-row Force-printer swings in combat (their high Tempo or Force gets value from the swing), then Get Down resolves *after* combat damage and swaps the now-vulnerable Force-printer to the back, replacing them with a high-Durability tank.

**Flavor:** *get down, Mr. President.* A guard takes a bullet for someone vulnerable. A cleric throws themselves between an attacker and the priest. White as the color of *self-sacrifice for the chosen* — but mechanically expressed via *position*, not Durability transfer. The tank doesn't take damage *for* the Force-printer; the tank takes the *next* turn's damage *instead of* the Force-printer who has already done their work.

### Want web (White)

- Cleric Initiate → universal opener; Force-printer for ≥1F gates.
- Defender → wants Get Down to put them in front, wants Wayshrine's mark.
- Cleric Mender → wants a creature in front to heal; burst-heal niche.
- Wayshrine → wants a creature here when it flips; chooses the mark target.
- Cleric Steward → late-game body; wants 2+ Force on board.
- Get Down → wants a high-Durability creature in back *and* a Force-printer in front; swaps them.

The trio is **Defender + Wayshrine + Get Down**. Without Defender, Get Down's swap brings nothing useful forward. Without Wayshrine's mark, Defender slowly dies under combat damage. Without Get Down, the front line dies before Defender can reach the front. Each card individually weak; together they describe White's whole strategic shape.

### Open questions on White

- **Pillar 10 tie-handling for Get Down's "highest-Durability" target.** If two friendlies tie for highest current Durability (after damage), the auto-resolve picks randomly per Pillar 10. The player's setup is the column they want the swap to fire on — they control by *not letting two creatures tie at high Durability simultaneously*. This is genuine strategic engagement (ensure your tank is uniquely highest before casting Get Down).
- **What if no friendly creature is "in front of" the highest-Durability creature?** The action fizzles per the standard fizzle rule. Setup matters — the player must *position the column* before casting. This is intended; it's the Pillar 10 pattern.
- **Does "highest-Durability" mean printed or current?** Probably *current* (after damage applied). A 3-Durability creature that's taken 1 damage is at 2 current; a 2-Durability creature at full is at 2 current — they tie. Subtle but impacts strategy. Pass 2 detail.
- **Engine implication:** Get Down adds **column-relationship checking** + **two-creature swap** as new operations. Wayshrine's mark adds a **per-creature persistent state** (`marked: bool`, `markSource: structureId`).
- **Is mark-on-flip-up too rare?** Wayshrine fires *once* per encounter at flip-up. After that, the mark exists but no new marks can be placed unless rewards introduce re-flip mechanics. Working assumption: this is the right scaling — starter Wayshrine is a one-shot bestowal; reward Wayshrine variants (or Green stealth combos) extend it.

---

## Black starter pool — lean deckbuilder, debuffs enable the swap

**Per-color flavor effect:** the **debuff lattice** (-1 Force at multiple trigger timings) + **Nightmare** (one-shot self-imposed threat that converts a small enemy creature into your piles forever).

**Story:** *summon a horror, give it to the other side, and steal a soul on the way out.* Black is the **lean deckbuilder color**. The starter runs thin and gets thinner — Nightmare *removes itself from your deck forever* when played, in exchange for adding a small creature from the other side to your piles. The rest of the encounter is spent debuffing the Nightmare you just gave the other side and surviving until your new acquisition can pull its weight.

**The synergy that ties Black together:** Nightmare's swap is gated by a Force cap (only swaps with creatures of current Force ≤1). Black's debuff lattice (-1 Force from Hexer, Martyr, Cairn, Cursed Blade) **drops higher-Force creatures into Nightmare's swap range**. Hex a 2-Force creature this turn → its current Force is 1 → Nightmare can take it.

**The debuff lattice and the conversion verb interlock.** Without debuffs, Nightmare can only steal naturally-small creatures (recruits, utility bodies). With debuffs, Nightmare reaches into bigger ramps. **The win condition:** debuff a key opposing creature, swap it with Nightmare, take it permanently into your piles.

The trio:
- **Witch Hexer** — flip-up debuff (-1 Force *now*). Fragile (1D). Drops a 2-Force creature into Nightmare's range *this turn*.
- **Nightmare** — the conversion verb. ≥1F cost; on flip-up, swap sides with a creature on the other side here whose current Force is ≤1. The taken creature joins your piles forever; Nightmare leaves your deck forever.
- **Bone Cairn** — recurring debuff (-1 Force every cleanup). Maintains Force pressure across multiple turns, opening future Nightmare swaps.

**Cultist Martyr** (deathwish debuff) and **Cursed Blade** (reactive on-melee debuff) are the supporting debuff sources at additional trigger timings. Together: four trigger windows for -1 Force (flip-up / death / cleanup / on-melee-strike).

**Black runs lean.** Six cards in the starter, dropping to five effective after one Nightmare cast. Black wins by *cycling fast through high-leverage tools* (debuff + convert), not by stacking bodies. This is the seed of Black's reward-tier identity: graveyard recursion, deathwish payoffs, deck-thinning as a strategy.

Tribal vocabulary: **Witch / Cultist** for dark-magic tribes. Off-pattern: **Mourner** (civilian victim, not practitioner). Cursed Blade and Bone Cairn don't take a tribe. **Nightmare** is its own off-pattern flavor — not a person, a *conjured horror*.

**System variety:** 4 creatures + 1 equipment + 1 structure.

| # | Name | Type | Cost | F | T | D | Effect | Status |
|---|---|---|---|---|---|---|---|---|
| K1 | Mourner | creature | 0 | 1 | 0 | 2 | — | proposed |
| K2 | Witch Hexer | creature | 0 | 1 | 0 | 1 | "On flip-up: a creature on the other side in front (here) loses 1 Force." | proposed |
| K3 | Cultist Martyr | creature | 0 | 1 | 0 | 1 | "Deathwish: a creature on the other side in front (here) loses 1 Force." | proposed |
| K4 | Cultist Stigmatic | creature | 0 | 0 | 0 | 1 | "On flip-up: this damages you for 1 and grants +1 Spite here." | proposed |
| K5 | Nightmare | creature | ≥1F | 3 | 0 | 2 | "On flip-up: this moves to the other side here. A creature there moves to your side." | proposed |
| K6 | Bone Cairn | structure | ≥1F | 0 | 0 | — | "At end of cleanup: a creature on the other side in front (here) loses 1 Force." | proposed |

### Card-by-card rationale

**K1 Mourner** — *off-pattern card*. No tribe (civilian victim, caught in the curse). Free, 1 Force, 2 Durability. Universal opener; pays ≥1F gates.

**K2 Witch Hexer** — flip-up debuff. Free, 1 Force, 1 Durability. Glass cannon. The flip-up debuff fires *before* combat. **Combos with Nightmare:** Hexer's debuff drops a 2-Force enemy to 1, opening Nightmare's swap window the same turn.

**K3 Cultist Martyr** — deathwish debuff. Free, 1 Force, 1 Durability. The dying-as-trigger card. Send Martyr into combat to die against a 2-Force creature; on death, the debuff lands permanently. The Cult cheers when Martyr dies because the conversion path opens (and the debuff persists, stacking with future debuffs on the same target).

**K4 Cultist Stigmatic** — *self-injury Spite-granter*. Free, 0/0/1. On flip-up: damages you (the player/summoner) for 1 *and grants +1 Spite to this location*. The +1 Spite goes to **the location**, not to the creature itself — terrain-style. The Stigmatic is a *delivery vehicle* for location-Spite, dying almost immediately to anything but leaving the +1 location-Spite behind.

**Why this card is interesting:** Spite at a location normally requires a Spite-printing creature in the front row to *survive* combat. That's hard — Spite-printing creatures need to be both Spite-printers *and* combat-durable, which rarely overlap at starter scale. Stigmatic *bypasses the survival gate* by self-inflicting the cost (1 damage to you) and granting the Spite *to the location, not the creature*. The creature dies, the +1 location-Spite persists.

**The teach:** the player learns (a) Spite exists as a stat, (b) Spite at a location grants summoner-thorns when attackers break through, (c) Black's flavor is *suffering as power* — you take damage to give yourself a deterrent. Spite is the only themed stat that appears in any starter pool, and it appears here because Spite is encounter-local (doesn't compound across the run the way Insight/Resolve do for global hand/draw).

**Cursed Blade dropped from this pool.** The Spite-source teach replaces the reactive-equipment teach. Equipment as a card type is taught elsewhere (Crude Axe in Red); reactive triggers can come reward-tier.

**K5 Nightmare** — *the central conversion card*. ≥1F cost, **3 Force, 0 Tempo, 2 Durability**.

Card text: *"On flip-up: this moves to the other side here. A creature there moves to your side."*

The conversion-verb nature is implicit in the mechanic — the creature taken joins your piles forever (per the conversion-verb rules), and Nightmare leaves your deck forever (it moved to the other side; it's no longer in your piles). Card text doesn't print these consequences explicitly; they emerge from the system rules around side-changes and conversion verbs.

**Behavior:**
- Nightmare *always* moves to the other side. Unconditional — Nightmare is now a 3F/2D body on the other side, threatening you.
- If a creature was on the other side here, it moves to your side and joins your piles. Forever.
- If no creature was there to displace, Nightmare still moves; you get nothing in return. **The fizzle is punishing**: you handed the other side a 3F threat and got nothing.

**The flavor:** Nightmare is a horror you summoned to scare a victim into joining you. The horror takes a place on the other side; if a victim was there, they flee to your side traumatized. If no one was there, the horror still appears — it's now their problem and you got nothing.

**Why no Force cap:** the threat-creation always happens, so the *cost* is always paid. The acquisition is *the conditional payoff*. Power scales naturally with what's on the board — small fish early, bigger fish late. Card rarity (deployment-decided per the rarity-as-deployment decision) governs how often the player ever sees more than the one starter Nightmare per run.

**Card rarity governs late-game power.** Nightmare appears in the **Black starter pool**, where every Black starter gets exactly one cast per run. Reward acquisition outside the starter is rare by deployment — Nightmare may or may not appear in late-game Black-themed boss decks and biome-natives.

**K6 Bone Cairn** — structure, recurring **permanent** debuff. ≥1F gate, **0/0/—** stats. At end of cleanup, debuffs an opposing front creature for **the lifetime of that creature** (per the *buffs are permanent by default* rule).

**Much more powerful than it looks.** Each cleanup, Bone Cairn fires; the targeted creature loses 1 Force *forever* (until it leaves play). A creature in front of Bone Cairn for 3 turns has -3 Force permanently. Combined with Hexer's flip-up debuff and Martyr's deathwish, the same target can be hit by several permanent debuffs across an encounter — a 3-Force enemy can be reduced to 0 within 3 turns of focused debuffs. **Bone Cairn is a Force-erosion engine; long encounters favor Black.**

**Synergy with Nightmare:** when a creature is Nightmared into your piles, its debuffs ride through pile cycling. Permanent buffs/debuffs are part of the card instance. So Black-corrupted creatures come into your deck *worse than originally*. Black's flavor: corruption persists.

### Want web (Black)

- Mourner → universal opener; pays ≥1F gates.
- Witch Hexer → fragile flip-up debuff *now*; combos with Nightmare same-turn.
- Cultist Martyr → fragile deathwish debuff *on dying*; combos with Nightmare next-turn.
- Cursed Blade → wants Mourner or another sturdy body to host; defensive disruption.
- Nightmare → wants a 1-Force creature on the other side, OR a 2+-Force creature that's been debuffed. Wants ≥1F on your side to cast.
- Bone Cairn → wants ≥1F to commit; provides ongoing debuff coverage that opens future Nightmare swaps.

The trio is **Hexer + Nightmare + Bone Cairn**. Hexer is the burst debuff that opens an immediate Nightmare swap. Bone Cairn is the sustain debuff that opens swaps over many turns. Nightmare is the conversion payoff. Together, the lattice + the conversion verb is *the entire deck strategy*.

### Open questions on Black

- **No Force cap on Nightmare's swap.** The cap was overengineering. The fizzle case (no targets to displace) is the natural cost-balance — you've given the other side a 3F body for nothing in return. Power scales with what's on the board: small fish early, bigger fish late. Card rarity (deployment-decided) governs late-game frequency.
- **Nightmare always leaves your deck.** Whether the acquisition fired or fizzled, Nightmare is now on the other side and gone from your deck. This makes the cast a *committed gamble*.
- **Nightmare on the other side: 3F/2D.** A real threat. 3 Force takes 1 turn to swing for 3 damage. 2 Durability means most creatures (1-2 Force) can kill it in 1-2 combats. Black's debuffs further shave Force off it.
- **Nightmare can swap with neutrals.** Neutrals are biome-native cards that contribute stats to whichever side they're on (typically the other side at encounter start). They're legal Nightmare targets. **This is the third pathway for cards into your deck** — alongside enemy decks and starter pools, neutral biome-natives are accessible via Nightmare.
- **Cultist Reaver removed from the pool.** Reaver was a generic 3F ramp with no story role. Replaced by Nightmare at the same ≥cost slot. Black no longer has a ≥2F ramp; this is on-flavor for the lean-deckbuilder identity.
- **Engine implications:** **Side-swap mechanic** (`creature.side` mutability + persistent state riding the swap). **Adding a card to the player's piles mid-encounter** (new state transition: this creature is now in your hand / deck / discard mid-encounter). **Deathwish trigger** at end of combat resolution. **Junkyard zone** for equipment and structures, separate from graveyard. All new compared to v3 prototype.
- **Marks die on swap.** A marked creature swapped to the other side loses its mark (per Wayshrine's "leaves play" rule).
- **Card rarity is deployment-decided.** Nightmare appears in the Black starter pool. Whether it appears in enemy decks or as biome-natives is a separate design decision per-deck, per-biome. The starter player gets *one* Nightmare per run unless they encounter and acquire more via conversion verbs from other sources.

---

## Slice enemy decks (Red-only)

The slice draws all enemy decks from Red's 12 cards (R1-R6 starter + RR1-RR6 reward), plus a single boss-signature card. Player and AI both play strictly Red.

**Recruit is creature-only.** Equipment and actions in enemy decks are *decorative* (AI uses them; player can't acquire). Slice deckbuilding loop is creature-focused. Equipment/action conversion verbs are post-slice.

### Tier 1 — Goblin Skirmishers

Early-encounter deck. Foundation: small goblin band, fragile and numerous.

| Card | Count | Recruitable? |
|---|---|---|
| Goblin Brawler | 4 | ✓ |
| Orc Bruiser | 2 | ✓ |
| Goblin Bully | 1 | ✓ (push demonstration) |
| Goblin Recruiter | 1 | ✓ (alone-only Recruit demonstration) |

**Total: 8 cards.** All creatures. The first conversion-verb experience: encounter Bully, use the player's starter Recruit to take it.

### Tier 2 — Pit Cult

Mid-encounter deck. More dangerous warband with a champion and damage tools.

| Card | Count | Recruitable? |
|---|---|---|
| Goblin Brawler | 3 | ✓ |
| Orc Bruiser | 2 | ✓ |
| Goblin Berserker | 1 | ✓ (Enraged target) |
| Pit-Goblin Challenger | 1 | ✓ (Provocation target) |
| Ogre Pit-Fighter | 1 | ✓ (champion target) |
| Battle Driver | 1 | decorative (action — AI uses it on its own creatures) |

**Total: 9 cards.** Player can Recruit 3 distinct reward cards from this deck depending on board state. The AI uses Battle Driver to buff its own goblins, demonstrating the action without making it acquirable.

### Boss — to design

The boss encounter is **deferred** — boss design isn't a "denser enemy deck" question; it's a real design decision that needs collaboration. Open questions:

- **What does a boss mean in this game?** The summoner-with-Durability framing is the rules answer. The *experience* answer (signature mechanics, what makes the boss feel like a boss) is unwritten.
- **Should the boss-signature card be a brand-new mechanic, or a power-tier expression of an existing one?**
- **Is the boss encounter single-location or multi-location?**
- **Does the boss have a tribal or thematic identity beyond "Red leader"?** (Pit Lord, Champion, Warlord — flavor exists; mechanics don't.)
- **Does the player permanently acquire any boss content, or is the boss the run's terminus and acquisition stops there?**

Boss design is the next collaborative work item. Tier 1 and Tier 2 enemy decks above are sketched from agreed Red cards and can be locked. **Boss is held until we discuss.**

## Slice map sketch — partial

The map's *non-boss* portion is sketchable from agreed pieces. The boss node is held until boss design is settled.

Working shape: linear path, 4 non-boss encounter nodes + start + boss.

```
[Start]
   ↓
  [E1: Tier 1]
   ↓
  [E2: Tier 1, different composition]
   ↓
  [N1: Forge]   (neutral biome encounter — already in prototype)
   ↓
  [E3: Tier 2]
   ↓
  [Boss]        (held — design TBD)
```

**Encounter flow (non-boss):**
1. **E1 (tier 1):** player wins with starter cards. Probably Recruits 1 card.
2. **E2 (tier 1):** another tier-1 fight, different composition (e.g., one swaps a Bully for a Recruiter, or adds a second Bully). Player's deck starts growing.
3. **N1 (Forge):** player optionally engages Forge for a Force buff. Already in prototype.
4. **E3 (tier 2):** harder fight. Player has 1-3 Recruited cards by now.

**Tutorial scripting open:** whether E1 should be scripted (predetermined AI commits on turn 1) is a separate decision. The slice could ship with or without scripting. Worth a quick call when we get to engine work.

- **Death-feed creature** *(probably Black, post-slice)*: 1F/1T/2D — *"When a friendly creature dies here, gain +1 Force this turn."* High Tempo creates a strategic puzzle (you'd want it to swing late to collect triggers, but high Tempo says swing early — a real positioning decision). Not Red flavor; vengeful-figure-grows-from-allies'-deaths reads Black or Green. Captured during R1/R3 brain-tangent on tempo-as-strategic-axis.
- **Equipment that lowers Tempo** *(reward-tier, post-slice)*: *"Equip. The wielder has Tempo 0."* Drops a fast creature to attack last so collect-late triggers stack maximally. Pairs with Berserker (Enraged), death-feed creatures, and any "watch board events first, then swing" pattern.
- **"Buried Alive"-class keyword** *(reward-tier Black)*: *"This goes to the graveyard without dying."* Bypasses death-triggers when the source goes to graveyard. Useful for Black graveyard-recursion setups that don't want to pay the death-trigger cost. Captured under death-event rule.

---

## Story-coherence as a starter-design principle

The story-pass surfaced a principle that should be captured for future card-design sessions:

**Narrow cards force combinations. Combinations are where the engagement lives.**

A card that does two things is *two cards' worth of resilience* — destroying it wipes out two effects at once. Splitting those two effects across two cards means either card alone is weaker, but the *pairing* tells a richer story and creates fragile board states the player must defend.

The lower power level of starter cards is *load-bearing*: it lets us print weak narrow cards that *only matter together*, where the strategic engagement is *assembling the right combination* rather than playing strong cards in isolation.

This is Pillar 10 (no on-resolve targeting; setup is the strategic skill) at the starter scale. Setup includes assembling the right narrow cards into the right board state.

**Rules of thumb:**
- A card that does 2+ things is a candidate for splitting.
- Narrow cards in service of a deck's strategic story > generic stat-printers without role.
- Story-coherence: each pool should have 2-3 *story-driving* cards that depend on each other, plus 3-4 *supporting* cards (Force/Tempo printers) that protect and enable the story-drivers.
- Off-pattern cards (those that don't fit the dominant tribe) deliberately mark themselves as conceptually distinct — they're seeds for future tribal expansion.

## Status summary

### Card pools

| Color | Starter | Reward | Status |
|---|---|---|---|
| Red | 6 (R1-R6) | 6 (RR1-RR6) — slice scope | proposed; could add vehicle/token-spawner before freeze, or call it complete |
| Green | 6 (G1-G6) | — | proposed; held for post-slice |
| Blue | 6 (B1-B6) | — | proposed; held for post-slice |
| White | 6 (W1-W6) | — | proposed; held for post-slice |
| Black | 6 (K1-K6) | — | proposed; held for post-slice |

**Slice scope:** Red only. Other 4 colors held until slice ships.

### Vertical slice plan

**Phase A — Card design for slice:**
- ✓ Red starter pool (6 cards).
- ◐ Red reward pool (5 of 6-8 cards proposed). Need: maybe a vehicle, a token-spawner, a multi-target Tactic.
- TODO: Two enemy deck tiers (~15 cards each, drawing from Red starter + reward + a small generic pool).
- TODO: One boss deck (~10-15 cards including 1-2 boss-signature cards).
- TODO: Map authoring — 6-8 nodes, fixed AI placement, 3-4 neutral encounter cards.
- TODO: Tutorial-scripted first encounter.

**Phase B — Engine work for slice:**
- TODO: Recruit conversion mechanic (creature swap + add-to-piles).
- TODO: Push mechanic (front-to-back same-side displacement).
- TODO: Pierce X attack pattern.
- TODO: Enraged keyword (per-creature damage counter + per-turn Force stacking).
- TODO: Across positional relator (vocabulary support in card text and effects).
- TODO: Self-side damage (Battle Driver pattern).
- TODO: Buff/debuff duration model (default-while-source-in-play / scoped / permanent).
- TODO: Front-row Force rule.
- TODO: Post-encounter card-acquisition flow (Recruited cards persist into next encounter's deck).

**Phase C — Playtest the slice end-to-end. Iterate.**

**Phase D — Expansion (post-slice, only if Phase C succeeds).** Second color (Green), biome system, AI overworld spread, etc.

### Held for post-slice (not gating v1)

- Green / Blue / White / Black starter pools (designed in this doc but not implemented).
- Other 4 conversion verbs (Nightmare, Reroute, Research, Convert).
- Multi-color biome system (captured idea, not designed).
- Junkyard zone + Salvage / Magnetic mechanics.
- Side-swap mechanics (Nightmare requires).
- Escalating cost (Forage requires).
- Tempo-on-actions rule (Blue requires).
- Spite-as-thorns (Cultist Stigmatic / location Spite requires).
- Vehicle + driver mechanics.
- Stealth re-flip combos.
- Multi-slot creatures.

This is the *full design* — the doc captures it and the design is coherent — but none of these gate the slice.

### Outstanding decisions on existing cards

- Apprentice's Durability (1 vs. 2) — lean 1 for fragility-as-feature.
- Vigil renamed to Wayshrine's mark — confirmed in revision.
- Cultist Wretch → Cultist Martyr (deathwish replaces generic ramp) — confirmed.
- Bone Cairn narrowed (no Force) — confirmed.
- Get Down resolution timing (end of combat phase) — confirmed.
- Cursed Blade → replaced by Cultist Stigmatic — confirmed.

---

## Mechanics reference (quick lookup for design)

**Attack patterns** (printed on creatures or granted by equipment):
- *(default — not printed)* Melee. Hits the slot across (the slot directly opposite this slot on the other side).
- **Cleave** — melee, also hits adjacent same-side slots (friendly fire).
- **Pierce X** — melee. The wielder's normal melee target takes full Force damage; the creature in the back-row slot behind that target takes X damage (the printed pierce value, capped — not Force-scaled). If no back-row creature exists, pierce damage falls through to the summoner. Pierce is a *capped trample*.
- **Ranged** — fires in combat from anywhere (typically back row). Consumes 1 ammo per shot from the location's stockpile. Bypasses thorns / melee-retaliation.
- **Snipe** *(reward-tier)* — ranged with inverted targeting (back row first, then front).

**Combat targeting and back-row blocking:**
- A front-row creature attacks the slot **across** from it on the other side.
- If that slot's front-row is empty (no creature there), the attack hits the **back-row creature in the same column** on the other side.
- If the back-row is also empty, damage falls through to the opposing summoner.
- **Back row creatures don't attack** (unless they have a printed ranged pattern). They *do* block for the summoner and take damage when they're the target.

**Ammo** — location-level stockpile. Generated by `Ammo N` keyword (on flip-up: add N to stockpile) and by ammo-printing actions (Forage). Consumed 1 per ranged shot. Out of ammo = no ranged attack that turn.

**Push** (Bully's flip-up): force-move a specific creature from the front row to the back row on its own side. The creature stays in play and on its side — only its row position changes. Pushed creatures lose Force projection (front-row Force rule), can no longer attack from front, but still block for the summoner and take damage. Push fizzles if no empty back-row slot exists for the pushed creature. **Push is the targeting mechanism for Recruit and other isolation effects** — manipulate the front row to make exactly one target legal.

**Sacrifice** (Bombardment's keyword): send a creature on your side directly to the graveyard. Per Pillar 10, the sacrificed creature is picked at random from legal candidates (the player's setup is *which creatures are legal*, not which one gets picked). Sacrifice is a death event — deathwish and other death-triggers fire normally. Sacrifice happens *before* the rest of the action's effect resolves (cost-paid-then-effect model), so the sacrificed creature's stats don't contribute to any subsequent calculation in the same action.

**Tribal-as-resource costs.** A new category of cost shape: an action requires a creature of a specific tribe to be present and (often) sacrificeable. Different from stat-presence costs — it's *board-state-tribal*, gated on having committed deck-building space to the right creature type. Bombardment is the first instance (requires a goblin); each color has natural tribal-as-resource design space (Black sacrifices a cultist for stronger debuffs; Green sacrifices a rebel for ammo conversion; etc.).

**Enraged** (Berserker's keyword): each time the creature takes damage this turn, it gains +1 Force this turn. Stacks per damage instance. Buff lifts at end of turn; counter resets at end of turn. Combat damage triggers it naturally; Battle Driver triggers it explicitly.

**Tempo as a strategic axis (not strictly "fast = good").** Higher Tempo means *attacking earlier in the combat phase*. But triggers that fire from board events (deaths, damage taken, debuffs landing) accumulate *more triggers* if the creature attacks *later*. So:

- A creature with **damage-takes triggers** (Enraged) wants to attack last — let other creatures hit it first, stack the buffs, then swing.
- A creature with **death-feeds triggers** (e.g., "when a friendly dies, gain +1 Force") wants to attack last — let friendlies die first, accumulate buff, then swing.
- A creature with **first-strike triggers** (e.g., "when this attacks, deal +1 damage") wants to attack first — high Tempo aligns.

**Equipment that lowers Tempo** is therefore valuable for creatures with collect-late triggers. *Reward-tier:* equipment like *"The wielder has Tempo 0."* — drops a fast creature to act last so its triggers fire after maximum board events.

**Black naturally likes being slow.** Black's identity is reaction and attrition; Black wants the other side to act first so Black can react. Slow Tempo = attack last = collect maximum debuff/death triggers before swinging. Black starter creatures all print 0 Tempo — *deliberately slow*, not just absent of Tempo.

**Red's "fast in flavor, slow in math" tension.** Red is the *now*-color in flavor (fury, impulse, intensity) but Red creatures mostly print 0 Tempo across the starter pool. Red attacks late because chaos doesn't organize quickly — flavor and mechanics align in the friction.

**Parking lot — high-Tempo collect-late card sketch:** *"1F/1T/2D — when a friendly creature dies here, gain +1 Force this turn."* Not Red (death-feeds is more Black/Green flavor). Probably Black: a vengeful figure who grows stronger from teammates' deaths. Captured here because it surfaces the tempo-as-strategic-axis design space.

**Equipment** — slotless modifier card type. Attaches to a host (creature by default; cross-side equipment prints explicitly). Modifies the host's stats / attack pattern / triggers.

**Equipment piles destination (host-side rule):** equipment goes to the **junkyard** of whichever side the host was on at the moment the equipment leaves play. Cross-side equipment lost to the other side's junkyard unless **Magnetic** (which always returns equipment to your junkyard).

**Triggers seen in starter / reward pool:**
- *On flip-up* — fires when a card transitions face-down → face-up.
- *Deathwish* — fires when this creature dies (end of combat resolution). Effects need explicit durations because the source is gone; print `until end of turn` or `permanently` explicitly.
- *At start of upkeep* — recurring at the top of every turn.
- *At end of cleanup* — recurring at the bottom of every turn.
- *When the wielder is attacked in melee* — reactive, fires on incoming melee damage.
- *Each time this takes damage* — per-damage-instance trigger (Enraged uses this).

**Movement** (Pathfinder's keyword): "May move to an adjacent slot in this location at start of main." Adjacent in a 2x2 grid: front-row slots are adjacent to each other and to the back-row slot directly behind; same for back-row.

**Positional vocabulary:**
- `in front` / `in back` — same-side row position.
- `the creature in front of this` — directly forward in same column, same side.
- `across` — directly opposite this slot, on the other side. **The natural target slot of melee combat.**
- `here` — at this location.

**Escalating cost** (Forage's mechanic class — new design space): a card prints `0 (escalating)` as its cost, with text specifying how the cost grows per cast. Forage's text: *"requires +1 Tempo here for each previous cast of this card this encounter."*

Properties of escalating cost:
- **Per-card-instance, not per-card-name.** Two Forage cards in a deck track separately.
- **Encounter-scoped.** The counter resets at encounter end.
- **Persists through discard cycle within encounter.** A Forage that's been cast twice and reshuffled into the deck retains its 2-cast counter when redrawn.
- **Self-balancing against infinite loops.** As the counter climbs, the cost eventually exceeds available stat presence, naturally capping per-encounter usage.
- **Generalizes beyond Forage.** Any card can print escalating cost. Future design space: Black "growing curse" (each upkeep, debuff +1), Red "berserker rage," Blue "spiral of insight," etc.

Engine implication: `castsThisEncounter` is a new per-card-instance state field that resets at encounter end.
