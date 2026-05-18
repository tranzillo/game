# Status — implementation vs. design

Audit of the prototype implementation against the design as locked in DESIGN.md / DECISIONS.md / CARD_DESIGN.md / DESIGN_LESSONS.md. Captures what's built, what's gaps, what's wrong. Updated as work progresses.

## Real bugs (correctness issues affecting playtest validity)

1. ~~**Stat reads bypass conditionals.**~~ **FIXED.** Replaced mutation-based conditional buffs with on-demand `effectiveStat(card, side, loc, stat)`. Computes base + scoped buffs + Pit-Fighter alone + Provocation (both directions) + equipment-granted stats - Inert filter. Conditional buffs are always correct now — no re-evaluation timing to manage.

2. ~~**Front-row-only Force not enforced.**~~ **FIXED.** `committedStatTotal` for `force` only sums front-row creatures. Other stats still sum all positions. Push-to-back now actually drops location Force. Recruit superiority + Bombardment damage use the canonical helper.

3. **Default-duration buffs don't lift on leave-play.** Default duration = while target in play. Currently buffs mutate `card.force` with no tracking; if a creature dies and is later returned to play (graveyard recursion, Recruit, etc.), the buff is still on it. Latent — won't surface until creatures return from graveyard.

3a. **Display lag for conditional creatures.** Card render badges show `card.force` directly (the base), not `effectiveStat(...)`. A Pit-Fighter that's alone shows "1 Force" in the UI but actually swings for 3. Combat math is correct; visual is misleading. Needs render-side use of `effectiveStat` with location context.

## Half-implemented design features

4. ~~**Equipment can't be played from hand.**~~ **FIXED.** Equipment can be played from hand: select equipment in hand, click a friendly committed face-up creature slot, equipment goes pending. At end-of-phase flip, equipment attaches (or fizzles to junkyard if host died/moved). Pending-target check rejects pending and face-down hosts.

5. ~~**Equipment can't grant stats.**~~ **FIXED.** Equipment now supports `grantsStats: { force: 1 }` etc. on the def. `effectiveStat` reads attached equipment for stat grants. `goblinSword` card def added (+1 Force).

5a. ~~**Equipment can't be acquired across encounters.**~~ **FIXED.** `attachEquipmentToHost` marks `acquired = true` when `hostSide === "player"`. The encounter-end acquisition pass scans equipment attached to player creatures and equipment in the player's junkyard, pushing acquired ones into runDeck. Goblin Armaments' cycling-onto-player-goblin reward now durably persists.

6. ~~**Equipment cap not enforced.**~~ **FIXED.** `EQUIPMENT_CAP_PER_HOST = 1` enforced in `attachEquipmentToHost` (returns false on cap). UI legal-target check, `legalTargetsForCard`, Goblin Armaments candidate filter, and the play-from-hand fizzle-on-cap path all honor the cap.

7. **No Magnetic keyword.** Equipment leaves play to the host's-side junkyard with no override path.

8. **No cross-side equipment.** Only same-side attach is supported.

9. ~~**Location text has only 2 hook types.**~~ **FIXED.** `onEquipmentLeavesPlay` hook added; location texts now intercept equipment that's leaving play and can re-attach it elsewhere. Goblin Armaments deployed at B1 using this hook plus the phase hooks already in place.

10. **No dynamic peace/war flip.** Hard-coded per node. Real game needs AI spread to flip nodes from peace to war.

11. ~~**Battle Driver and Bombardment not deployed.**~~ **FIXED.** Both r10 and r12 added to the shared starting deck. AI and player both draw and play them. (Player can't "acquire" actions yet — Recruit takes creatures only — but they're already in deck so they cycle through play normally.)

12. ~~**Phase trigger windows incomplete.**~~ **FIXED.** `firePhaseHook(hookName)` dispatcher fires registered handlers at all 10 phase boundaries (`onUpkeepStart/End`, `onDrawStart/End`, `onMainStart/End`, `onCombatStart/End`, `onCleanupStart/End`). Location texts can hook any. Future card-level phase triggers ride the same pattern.

13. ~~**Tokens vanish; should be torn up = exile.**~~ **PARTIALLY FIXED.** Tokens that die now go to exile (with equipment detaching first), not "vanishing into nothing." Tokens-survive-encounter-and-join-piles still TODO; not testable in slice (no player-side token-creators deployed). Token-actions-exile-on-resolve still TODO; no token actions in the prototype yet (Blue's copy mechanics aren't built). The framing is unified: "torn up" = exile, applies to all tokens leaving play.

## Designed but deferred mechanics

- **Movement-as-queued-action.** Currently movement is instant on click. Design intent (noted on 2026-05-13): movement should commit to a per-phase queue and resolve in Tempo order at end of phase, same as flips and actions. Players queue moves face-up to themselves; opposing-side moves interleave by Tempo. Lets you mistime your own positioning or be cut off by enemy plays. Implementation TBD — affects move-click handler, UI feedback, the initiative tracker, and combat-preview snapshotting.
- **Initiative tracker animation.** Items currently render in a single beat per phase. The "card walks out of fog" reveal flow described in design (faces-down item slides into Tempo-position, then flips at its turn to resolve) requires animation/delay between events in `endOfPhaseRevealAndResolve` and `runCombat`. Deferred.

## Missing major systems (designed, not built)

14. ~~**Marks system.**~~ **FIXED (foundation).** Per-instance `card.marks` array of `{kind, side}`. `applyMark()` places a mark; same-kind double mark exiles the card (and removes the runDeck entry permanently). `sendToPile()` is now the central pile-push helper — Reroute marks redirect destination to the marker's same-zone pile (graveyard/junkyard/discard/exile). Acquisition flag set on rerouted-to-player cards. Marks persist across encounters via `mods.marks` on the runDeck entry. Marks render visibly on cards in all zones, including face-down opposing cards (fog leak by design). Specific mark kinds (reroute / convert / damage) — only Reroute is currently used; Convert and Red damage marks have no application sites yet.

15. **Reroute, Convert, Stealswap, Research conversion verbs.** **Reroute mark partially implemented** via the marks system — `applyMark(card, "reroute", side)` places a mark that redirects the card's leave-play destination to the marker's pile (handled by sendToPile). Pathfinder (g2) drops a Bad Intel quest that places a Reroute mark on the next card flipping up at its location. Convert (White), Stealswap (Black), Research (Blue) still TBD. Recruit (Red) remains the only active conversion verb.

16. **AI overworld spread.** AI mini-turns between player encounters. Eats neutrals. Flips nodes from peace to war via summoner presence. Difficulty curve emerges from accumulated build-up. Not started.

17. **Persistent structures and supply lines.** Pillar 9. Player structures stay on the map across encounters. Supply lines feed future encounters via the chain. Not started.

18. ~~**Ranged combat + ammo.**~~ **FIXED.** `ranged + ammoCost` on creature defs; back-row attackers must be ranged. `lc.ammo` per-side per-location stockpile (resets per encounter). Forage (g6 action) adds 1 ammo with per-instance escalating cost. Slinger (g4) is the first ranged creature.

19. ~~**Deathwish and other leave-play triggers.**~~ **FIXED (dispatch).** Generic `fireLeavePlayTriggers(card, side, loc)` runs at every creature-death site BEFORE sendToPile (so triggers see original side/position, before destination redirect). `card.deathwish` field on def holds the effect tag; `fireDeathwish()` dispatches by tag. No deathwish effects implemented yet — Pathfinder's "drop a token quest" will be the first.

20. ~~**Run-end / win condition.**~~ **FIXED (tutorial shape).** Map adds an `end` node (kind: "end") at x=5 connected only to C1/C2. End is the boss summoner's seat — *not* pulled into the T3 encounter as a location. Instead, T3 is flagged `encounterKind === "boss"` because at least one of its pulled-in locations is adjacent to an end node. The boss is the AI summoner of T3; reducing AI summoner Durability to 0 sets `runOver = "playerWin"` and visually moves the pawn to end. End has no encounter content of its own — the boss's entourage lives at the C nodes.

## Polish / minor

21. ~~**Fog of war on overworld.**~~ **FIXED.** Node labels (location names) are always visible — the player knows the *place*. The fog hides only the *kind icon* (hostile vs neutral vs end), replaced with a `?`. The player can see "Champion's Rest" or "Ogre Hideaway" on the map but doesn't know whether the AI has shown up to contest it. Kind icons reveal for pawn-current, completed, and pawn-adjacent nodes (which would be in the next encounter). Per design: peace-time text is the location's "name"; war-time AI presence is what fog hides.

22. **Side priority via local Tempo total.** Design says higher local Tempo wins side priority within a Tempo tier. Currently implements only the alternation fallback. Local-Tempo tiebreaker not built.

23. **Tribe system is single-field.** A creature has at most one `tribe`. Design space opens for multi-tribe creatures (e.g., Demon Knight = both Demon and Knight) — would need tribe array, not single field.

## Tuning numbers (unvalidated guesses)

24. **Card pool / deck size / hand size / draw count / encounter length.** All currently set to provisional values:
   - Starter deck size: 5 cards (Red).
   - Hand size: 5.
   - Cards drawn per turn: refill to hand size.
   - Stages per slice: 3.
   - Locations per encounter: 2 (set by bipartite map shape).
   - Equipment cap (when implemented): 1 per host.

   None of these are validated by playtest. They're starting points to iterate on. **Many design questions can't be answered until these are tuned and broken.**

## What's working correctly

- Multi-location encounters via adjacency.
- Pawn-click triggers encounter; click cleared adjacents to walk.
- Pure neutral encounters (no AI presence, neutral-owned cards).
- Mixed encounters (AI at one location, neutral at another in same encounter).
- All-hostile encounters.
- Location-text engine for the implemented hooks (`suppressActionFlipUp`, `onCleanupEnd`).
- Encounter end deferred to end-of-cleanup so all triggers fire that turn.
- Recruit conversion verb (action card + creature trigger).
- Acquired creatures join the run-deck at encounter end.
- Permanent stat-buff actions exile themselves.
- Run-deck mods ride through pile cycling.
- Flip-up triggers (extensible string-dispatch pattern).
- Tokens (creation + slot placement; needs the exile-on-leave-play unification).
- Side state: deck, hand, discard, graveyard, junkyard, exile.
- Side priority alternation fallback.
- Damage fall-through to summoner (combat and action damage).
- Equipment pre-attached at encounter load + play-from-hand.
- Sleep keyword: sleeping creatures have 0 effective Force, can't attack/move, take damage normally. Damage wakes them mid-phase; "groggy this phase" gate (via `wokeInPhase === state.phase`) suppresses awake actions for the remainder of that phase. Sleep counter ticks at start of upkeep.
- Location-text `onFlipUp(loc, side, card)` hook fires when any card flips up at that location (used by Ogre Hideaway).
- All 5 phases (Upkeep, Draw, Main, Combat, Cleanup) are player-advanced. Actions and equipment can be committed in any interactive phase; creatures and structures only in main. Each phase end runs `endOfPhaseRevealAndResolve` to flip face-down cards committed during the phase. Player-driven Advance button with auto-advance when the player has no legal plays or moves remaining.
- Movement allowed in any interactive phase. Each card can move once per turn (via `movedThisTurn` tracker, reset at upkeep start). Creatures that flipped this turn can't move (`flippedThisTurn`, cleared at end of cleanup).
- Compound costs: card cost is now `card.costs = { force: 2, tempo: 1 }` (object keyed by stat). `canPay` checks every stat. Cost badge renders one per stat, color-coded. Legacy single-stat `cost + costStat` still accepted at def time.
- Marks system: per-instance permanent state, persists through pile cycling and across encounters. Same-kind double mark exiles the card. Renders visibly in all zones, including face-down opposing cards.
- `sendToPile()` central pile-router honors Reroute marks (destination redirects to marker's same-zone pile; rerouted-to-player flags `acquired`).
- Deathwish keyword: generic leave-play trigger fired before destination redirect.
- Quest action archetype: persistent action that flips up, sits in slot, watches for completion event, fires reward, exits. QUEST_DEFS registry. `createQuestToken()` for tokens. `checkQuestsForEvent()` runs after relevant events (currently flip-up).
- Pathfinder (g2): assembles deathwish → quest token → mark + reroute → acquisition.
- Stealth keyword: `stealth(card)` flips a face-up card face-down. Card re-flips at the next end-of-phase pass, firing flip-up triggers a second time. Rebel Outrider (g5) flips up and stealths same-row friendlies on this side — re-flip payoff is Green's foundational synergy.
- Ranged combat + ammo: `card.ranged + ammoCost` enables back-row (or front-row) firing that consumes ammo from the side's per-location stockpile. `lc.ammo` initialized 0 per encounter. Slinger (g4) is ranged 1F/1T/2D consuming 1 ammo per shot. Forage (g6) is an action that adds 1 ammo to your stockpile here; per-instance escalating cost via `effectiveCosts(card)` (+1 Tempo per previous cast of that card-instance, counter resets per encounter).
- **Per-color stat effects** (per CARD_DESIGN.md):
  - **Red Force** at the location scales damage payloads ("deal damage equal to your Force here"). Already used by Bombardment + Recruit threshold. No new wiring.
  - **Green Tempo** at the location sets the reveal-order Tempo for non-creature plays (actions, structures, equipment). The caster's Tempo total at the location replaces the card's printed (always 0) Tempo at queue-build time. Wired in `endOfPhaseRevealAndResolve`, `computeCombatPreview` action sort, and the initiative tracker.
  - **Blue Insight** (globalStatTotal across the side's locations) adds to per-turn draw count. `BASE_DRAW_TARGET = 5`; draw fills to `5 + Insight` each turn.
  - **White Resolve** (globalStatTotal across the side's locations) sets how many leftmost hand cards survive cleanup. Player can drag-reorder hand throughout the turn; leftmost N are visually marked with a white top border. Cleanup keeps the leftmost N; discards the rest.
  - **Black Spite** (committedStatTotal at the location, per-side) — summoner thorns. When a creature attack damages a summoner via fall-through (empty slot or no front-row defender), the defending side's Spite at that location deals retaliation damage back to the attacker. Per-location. Fires only when summoner Durability actually drops. Action damage to summoners does NOT trigger Spite — only creature combat.
- Starter-deck menu at run start (Red or Green). Picking sets `state.deckKey` and builds the runDeck.
- Initiative tracker at top of UI: shows the current phase's queue (face-down face-down items rendered as `?` for opposing side) sorted by Tempo → side priority → loc → pos. Items fade to `resolved` state as they fire during the phase. Combat phase shows the attack queue. Animation between events (so the player can watch the queue resolve card-by-card) is deferred — all events currently fire in a single synchronous beat per phase.

## What card pool exists

CARD_DEFS uses flat keys r1–r13 (Red pool only). Display names are UI-only and may change without engine impact.

**Starter decks:** three per-color starters selected from a menu before the run begins.
- **Red:** r1, r2, r3, r4, r5, r6, r10, r12, r14.
- **Green:** g1, g2, g3, g4, g5, g6, g7, g8.
- **Blue (WIP):** b1 Magus Apprentice (per-action Insight aura), b2 Keeper of the Flame (summon Fire Golem + Pyroblast token), b3 Study (draw 1), b4 Spark (≥1I, deal 1 damage here), b5 Keeper of the Font (summon Water Golem + Blizzard token), b6 Mana Rock (Inert; +1 Insight to same-row creatures), b7 Mirror Image (escalating ≥Insight; token-copy any face-up creature here to discard), b8 Tome Golem (Golem; at cleanup, leftmost action → top of deck), b9 Spellbook (≥1I equipment; 3 pages; opposing actions flipping here copy to your discard; destroyed at 0 pages). Tokens: b_fire_golem (3F/1D), b_water_golem (1F/3D), b_pyroblast (≥2I; 1 damage to each face-up creature on opposing side here), b_blizzard (≥2I; opposing front creature at each location skips attack this turn).

`DECKS` registry indexed by `deckKey`. AI uses the same deck list as the chosen color (custom AI decks per color land later).

**Apprentice's per-action Insight:** `state.sides[side].actionsThisTurn` counter, ticked at the top of every `resolveAction`, reset at upkeep start. Apprentice has `apprenticeInsightFromActions: true`; `effectiveStat` adds `actionsThisTurn` to its Insight read. Living Insight value reflects on the card via the live-stat badge.

**Deployed at encounter locations:** A1 (Ogre Hideaway): r9 ogre. A2 (Champion's Rest): r3 + r13. B1 (Goblin Armaments): 4×r1 + r2 axe + r11 pike. B2 (Skirmish): r1 + r7 + r6. C1 (Forward Line): r8 (+r2) + r3 (+r11). C2 (Rear Camp): r9 + r1.

Slice difficulty curve: Stage 1 both peace, Stage 2 mixed, Stage 3 both hostile.

**Implemented but not deployed:** r10 (Battle Driver), r12 (Goblin Bombardment) — actions waiting on a place to acquire them.

**Not implemented:** anything outside the Red pool (other colors, multi-color, neutral biome cards beyond Champion's Rest content).

## Cards / content for designed locations and encounters

- **Champion's Rest** (peace location text, key `locP1`): implemented and deployed at A2.
- **Goblin Armaments** (peace location text, key `locP2`): implemented and deployed at B1 with 4 goblins + axe + pike. Equipment cycles between dying goblins; if cycling lands the equipment on a player-committed goblin here, the equipment is acquired at encounter end.
- **Ogre Hideaway** (peace location text, key `locP3`): implemented and deployed at A1 with r9 ogre. Ogres flipping up here gain Sleep 2 (effective Force 0, no combat, no movement). Recruit-bait — easy to acquire while sleeping, or wake-and-trade.
- **Cursed Crypts** (peace/war pair): not implemented.
- **Library / Draw biome** (peace/war pair, paired with Siren): not implemented.

## Audit framing

This is a living document. Each item is *what the implementation needs to become*, not "what's wrong with the prototype." The prototype isn't disposable — it's the starting state of the real game. Each fixed item moves the game closer to the locked design.

Items have rough dependencies (e.g., effective-stat foundation makes equipment-grants-stats and conditional buffs cleaner; marks foundation underlies Reroute and Convert). Future work picks items based on dependency order and what the design needs validated next.
