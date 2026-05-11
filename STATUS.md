# Status — implementation vs. design

Audit of the prototype implementation against the design as locked in DESIGN.md / DECISIONS.md / CARD_DESIGN.md / DESIGN_LESSONS.md. Captures what's built, what's gaps, what's wrong. Updated as work progresses.

## Real bugs (correctness issues affecting playtest validity)

1. ~~**Stat reads bypass conditionals.**~~ **FIXED.** Replaced mutation-based conditional buffs with on-demand `effectiveStat(card, side, loc, stat)`. Computes base + scoped buffs + Pit-Fighter alone + Provocation (both directions) + equipment-granted stats - Inert filter. Conditional buffs are always correct now — no re-evaluation timing to manage.

2. ~~**Front-row-only Force not enforced.**~~ **FIXED.** `committedStatTotal` for `force` only sums front-row creatures. Other stats still sum all positions. Push-to-back now actually drops location Force. Recruit superiority + Bombardment damage use the canonical helper.

3. **Default-duration buffs don't lift on leave-play.** Default duration = while target in play. Currently buffs mutate `card.force` with no tracking; if a creature dies and is later returned to play (graveyard recursion, Recruit, etc.), the buff is still on it. Latent — won't surface until creatures return from graveyard.

3a. **Display lag for conditional creatures.** Card render badges show `card.force` directly (the base), not `effectiveStat(...)`. A Pit-Fighter that's alone shows "1 Force" in the UI but actually swings for 3. Combat math is correct; visual is misleading. Needs render-side use of `effectiveStat` with location context.

## Half-implemented design features

4. **Equipment can't be played from hand.** Pre-attached only via `equipWith` in `aiPlacements`. The standard commit/flip/attach flow doesn't exist. Player has no way to play equipment from hand or pick a target host.

5. ~~**Equipment can't grant stats.**~~ **FIXED.** Equipment now supports `grantsStats: { force: 1 }` etc. on the def. `effectiveStat` reads attached equipment for stat grants. `goblinSword` card def added (+1 Force).

5a. ~~**Equipment can't be acquired across encounters.**~~ **FIXED.** `attachEquipmentToHost` marks `acquired = true` when `hostSide === "player"`. The encounter-end acquisition pass scans equipment attached to player creatures and equipment in the player's junkyard, pushing acquired ones into runDeck. Goblin Armaments' cycling-onto-player-goblin reward now durably persists.

6. **Equipment cap not enforced.** Design rule: 1 equipment per host. Currently unlimited.

7. **No Magnetic keyword.** Equipment leaves play to the host's-side junkyard with no override path.

8. **No cross-side equipment.** Only same-side attach is supported.

9. ~~**Location text has only 2 hook types.**~~ **FIXED.** `onEquipmentLeavesPlay` hook added; location texts now intercept equipment that's leaving play and can re-attach it elsewhere. Goblin Armaments deployed at B1 using this hook plus the phase hooks already in place.

10. **No dynamic peace/war flip.** Hard-coded per node. Real game needs AI spread to flip nodes from peace to war.

11. **Battle Driver and Bombardment not deployed.** Cards exist in CARD_DEFS but not in any deck — can't be played, can't be acquired.

12. ~~**Phase trigger windows incomplete.**~~ **FIXED.** `firePhaseHook(hookName)` dispatcher fires registered handlers at all 10 phase boundaries (`onUpkeepStart/End`, `onDrawStart/End`, `onMainStart/End`, `onCombatStart/End`, `onCleanupStart/End`). Location texts can hook any. Future card-level phase triggers ride the same pattern.

13. ~~**Tokens vanish; should be torn up = exile.**~~ **PARTIALLY FIXED.** Tokens that die now go to exile (with equipment detaching first), not "vanishing into nothing." Tokens-survive-encounter-and-join-piles still TODO; not testable in slice (no player-side token-creators deployed). Token-actions-exile-on-resolve still TODO; no token actions in the prototype yet (Blue's copy mechanics aren't built). The framing is unified: "torn up" = exile, applies to all tokens leaving play.

## Missing major systems (designed, not built)

14. **Marks system.** Foundational primitive. Per-instance permanent state, visible in all zones, same-kind double mark exiles. Reroute (Green) and Convert (White) both ride on marks. Red damage mark (+1 damage) too. Black/Blue marks TBD. Not started.

15. **Reroute, Convert, Stealswap, Research conversion verbs.** Four of five verbs not implemented. Recruit (Red) is the only one built.

16. **AI overworld spread.** AI mini-turns between player encounters. Eats neutrals. Flips nodes from peace to war via summoner presence. Difficulty curve emerges from accumulated build-up. Not started.

17. **Persistent structures and supply lines.** Pillar 9. Player structures stay on the map across encounters. Supply lines feed future encounters via the chain. Not started.

18. **Ranged combat + ammo.** Green's combat identity. Back-row creatures fire in combat with ammo. Ammo as consumable resource. Not started.

19. **Deathwish and other leave-play triggers.** Generic trigger pattern: card prints "when this leaves play, X." Currently only Enraged (per-damage-instance) is implemented as a leave-play-adjacent trigger, and only on the damage taking side. No generic deathwish dispatch.

20. **Run-end / win condition.** Slice has no boss and no "you won" check. Player wanders the cleared overworld with nothing to declare victory.

## Polish / minor

21. **Fog of war on overworld.** Kind icons (hostile/neutral) leak through. Player should see only that *something* is at adjacent nodes, not what kind.

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
- Equipment pre-attached at encounter load (no play-from-hand yet).
- Sleep keyword: sleeping creatures have 0 effective Force, can't attack/move, take damage normally. Damage wakes them mid-phase; "groggy this phase" gate (via `wokeInPhase === state.phase`) suppresses awake actions for the remainder of that phase. Sleep counter ticks at start of upkeep.
- Location-text `onFlipUp(loc, side, card)` hook fires when any card flips up at that location (used by Ogre Hideaway).

## What card pool exists

CARD_DEFS uses flat keys r1–r13 (Red pool only). Display names are UI-only and may change without engine impact.

**Starting deck:** r1, r3, r4, r5, r6.

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
