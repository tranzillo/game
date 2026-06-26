// Win condition + encounter end checks.
//
// Contract: REBUILD_PLAN §31.
//
// Per-location clear status: a location is "player-cleared" when there are no creatures on the
// opposing side's spatial slots at that location. Origin-irrelevant — purely positional.
//
// End-of-cleanup check (once per turn): walks all encounter locations, sets newly-cleared flags
// (triggering shuffle-back), then determines encounter outcome.
//
// Per-damage check: boss durability → 0 = bossKilled (run win); player durability → 0 = playerLost
// (run loss). These short-circuit the active beat chain.
//
// "Clearing applies only at locations where the AI summoner is not present (neutral locations
// and hostile non-boss locations). Boss locations are not cleared — they're won by reducing the
// boss's Durability to 0." (§31 line 1239)
//
// Phase K: the slice is hostile non-boss; every loc is clearable. Boss-loc detection lives in
// Phase L when boss content lands. The `isBossLocation` placeholder here returns false for v1.

import { positionsOf } from "./profile.ts";
import { isLocationABoss } from "./overworld.ts";
import type { CardInstance, EncounterOutcome, GameState, InstId, Side } from "./types.ts";

// ---------- Per-location clear predicate ----------

/**
 * True iff the location has no creatures on the opposing side at any spatial slot. Origin-
 * irrelevant per §31 line 1241.
 *
 * Returns false for boss locations (which are won by reducing boss Durability, not by clearing
 * the opposing creature slots). Phase L surfaces the boss-location concept.
 */
export function isLocationClearedByPlayer(state: GameState, loc: string): boolean {
  if (isBossLocation(state, loc)) return false;
  const ns = state.world.nodeState[loc];
  if (!ns) return false;
  const aiCreatures = ns.sideSlots.ai.creatures;
  for (const pos of positionsOf(ns.profile, "creature")) {
    if (aiCreatures[pos] != null) return false;
  }
  return true;
}

/**
 * True iff the location is hosting a boss summoner — i.e., the underlying world node is an
 * exit node (kind === "end"). Boss locations are NOT cleared by emptying creature slots; they
 * are won by reducing boss Durability to 0 (bossKilled outcome via runPerDamageWinChecks).
 *
 * Wired in Phase L slice 4 (was a Phase K placeholder).
 */
export function isBossLocation(state: GameState, loc: string): boolean {
  return isLocationABoss(state, loc);
}

// ---------- Per-location shuffle-back ----------

/**
 * Pure query: the player's commits at a cleared location — creatures, equipment, persistent
 * actions — in cascade order. Player structures stay (supply-line rule, §7 / §29) and are NOT
 * included. Does not mutate. The orchestrator uses this to drive a paced cascade to the discard
 * pile; discardClearedLocationCommits uses it for the synchronous path.
 */
export function collectClearedLocationCommits(state: GameState, loc: string): InstId[] {
  if (!state.currentEncounter) return [];
  const ns = state.world.nodeState[loc];
  if (!ns) return [];
  const sideSlots = ns.sideSlots.player;
  const reclaimed = new Set<InstId>();
  for (const pos of positionsOf(ns.profile, "creature")) {
    const id = sideSlots.creatures[pos];
    if (id != null) reclaimed.add(id);
  }
  for (const pos of positionsOf(ns.profile, "action")) {
    const id = sideSlots.actions[pos];
    if (id != null) reclaimed.add(id);
  }
  // Equipment lives via host.equipment[]; include each one whose host is here.
  for (const id of [...reclaimed]) {
    const host = state.cards[id];
    if (!host) continue;
    for (const equipId of host.equipment) reclaimed.add(equipId);
  }
  return [...reclaimed];
}

/**
 * Move ONE cleared-location commit to the player's DISCARD pile (DECISIONS 2026-06-13 — cleared
 * commits go to discard, not back to the deck). Vacates its slot, clears in-play bookkeeping.
 * The single primitive behind both the synchronous and paced-cascade paths.
 */
export function discardOneClearedCommit(state: GameState, loc: string, id: InstId): void {
  if (!state.currentEncounter) return;
  const ns = state.world.nodeState[loc];
  if (!ns) return;
  const card = state.cards[id];
  if (!card) return;
  const sideSlots = ns.sideSlots.player;
  // Vacate creature + action slots holding this card (structures stay; equipment has no slot).
  for (const pos of positionsOf(ns.profile, "creature")) {
    if (sideSlots.creatures[pos] === id) sideSlots.creatures[pos] = null;
  }
  for (const pos of positionsOf(ns.profile, "action")) {
    if (sideSlots.actions[pos] === id) sideSlots.actions[pos] = null;
  }
  card.slots = [];
  // Detach equipment bookkeeping — these cards aren't "leaving play" in the deathwish sense.
  card.equipment = [];
  if (card.attachedTo != null) delete card.attachedTo;
  if (!state.currentEncounter.playerSide.discard.includes(id)) {
    state.currentEncounter.playerSide.discard.push(id);
  }
}

/**
 * Synchronous: move all of a cleared location's player commits to discard (tests + non-paced
 * callers). The orchestrator paces this via collect + discardOneClearedCommit instead.
 */
export function discardClearedLocationCommits(state: GameState, loc: string): void {
  for (const id of collectClearedLocationCommits(state, loc)) {
    discardOneClearedCommit(state, loc, id);
  }
}

// ---------- End-of-cleanup checks ----------

export interface EndOfCleanupResult {
  newlyClearedLocs: string[];
  outcome: EncounterOutcome | null;
}

/**
 * Runs at end of cleanup, once per turn. Walks all encounter locations:
 *  - If a loc is newly-cleared (predicate true AND flag was false), set the flag and shuffle-back
 *    the player's commits at that loc.
 *  - After all clear-flag updates, determine the encounter outcome:
 *      - playerCleared: every non-boss loc has its clear flag set (and there are no remaining
 *        boss locs alive — Phase L work).
 *      - else: null (encounter continues).
 *
 * aiRetreated (§31 line 1261) requires the AI play loop: AI has no living presence AND brought
 * in no reinforcements this turn. Until the AI plays, no retreat outcome fires — in particular,
 * a remaining neutral/biome creature holding a location means the encounter CONTINUES (it's the
 * player's puzzle, not the AI's presence).
 *
 * Returns the outcome (or null) plus the list of locs newly cleared this turn.
 */
export function runEndOfCleanupChecks(state: GameState): EndOfCleanupResult {
  const out: EndOfCleanupResult = { newlyClearedLocs: [], outcome: null };
  if (!state.currentEncounter) return out;
  const enc = state.currentEncounter;

  // Walk all encounter locations. Set the clear flag and record the loc; the MOVE of the
  // player's commits to discard is deferred to the orchestrator so it can pace the cascade
  // (DECISIONS 2026-06-13). Outcome computation below doesn't depend on the commits being gone
  // (it reads clear flags + AI presence, not player commits).
  for (const loc of enc.locationNodeIds) {
    if (enc.playerLocationCleared[loc]) continue; // already cleared in a prior turn
    if (isBossLocation(state, loc)) continue;
    if (isLocationClearedByPlayer(state, loc)) {
      enc.playerLocationCleared[loc] = true;
      out.newlyClearedLocs.push(loc);
    }
  }

  // Determine outcome.
  out.outcome = computeEncounterOutcome(state);
  if (out.outcome) enc.outcome = out.outcome;
  return out;
}

function computeEncounterOutcome(state: GameState): EncounterOutcome | null {
  if (!state.currentEncounter) return null;
  const enc = state.currentEncounter;

  // Per §31 line 1254: "In mixed encounters with a boss + other locations: typically the
  // boss-killed short-circuit fires first; if it didn't, all non-boss locations cleared while
  // the boss is still alive doesn't end the encounter — the boss is still the win."
  // So: if any boss loc is in the encounter, playerCleared / aiRetreated do NOT fire while
  // boss Durability remains. The boss-killed outcome is per-damage (runPerDamageWinChecks).
  let hasBossLoc = false;
  for (const loc of enc.locationNodeIds) {
    if (isBossLocation(state, loc)) {
      hasBossLoc = true;
      break;
    }
  }
  if (hasBossLoc && enc.aiSide != null && enc.aiSide.durability > 0) {
    // Boss still alive. Outcome stays null; combat continues until bossKilled.
    return null;
  }

  // playerCleared: every non-boss loc is cleared. (Boss locs handled by per-damage bossKilled.)
  let allNonBossCleared = true;
  let anyNonBossLoc = false;
  for (const loc of enc.locationNodeIds) {
    if (isBossLocation(state, loc)) continue;
    anyNonBossLoc = true;
    if (!enc.playerLocationCleared[loc]) {
      allNonBossCleared = false;
      break;
    }
  }
  if (anyNonBossLoc && allNonBossCleared) return "playerCleared";

  // Summoner retreat is NOT an outcome (DECISIONS 2026-06-13) — it's a state change that doesn't
  // end the encounter. Encounters end via locations (playerCleared, above) or summoner defeat
  // (summonerDefeated, per-damage). A summoner alive elsewhere never blocks playerCleared here.
  return null;
}

// ---------- Per-damage win checks ----------

/**
 * Returns the encounter outcome iff a damage event has triggered an immediate-end condition:
 *  - playerLost: the player summoner's Durability hit 0 (run loss).
 *  - summonerDefeated: an enemy summoner's run-scoped Durability hit 0 (run win).
 *
 * Caller (orchestrator) checks this after each damage application and short-circuits the active
 * beat chain if non-null.
 *
 * DECISIONS 2026-06-13: the enemy summoner is present (with run-scoped Durability) at any
 * encounter where it has forces — not only at a boss node. Reducing it to 0 defeats it. (The
 * "retreat instead of dying" guard and the "only cornered summoners can actually die"
 * restriction are Slices 3–4; until then, reaching 0 defeats it outright.)
 */
export function runPerDamageWinChecks(state: GameState): EncounterOutcome | null {
  if (!state.currentEncounter) return null;
  const enc = state.currentEncounter;
  if (enc.playerSide.durability <= 0) {
    enc.outcome = "playerLost";
    return "playerLost";
  }
  // Enemy summoner defeated: aiSide exists (summoner present) with Durability <= 0.
  if (enc.aiSide != null && enc.aiSide.durability <= 0) {
    enc.outcome = "summonerDefeated";
    return "summonerDefeated";
  }
  return null;
}

// ---------- Helpers ----------

/**
 * Walk all encounter locations and return creatures on a given side, deduped (multi-slot).
 * Useful for tests and content that wants "all my creatures at this loc."
 */
export function creaturesOnSideAtLoc(
  state: GameState,
  side: Side,
  loc: string,
): CardInstance[] {
  const ns = state.world.nodeState[loc];
  if (!ns) return [];
  const slots = ns.sideSlots[side].creatures;
  const seen = new Set<InstId>();
  const out: CardInstance[] = [];
  for (const pos of positionsOf(ns.profile, "creature")) {
    const id = slots[pos];
    if (id == null) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const card = state.cards[id];
    if (card) out.push(card);
  }
  return out;
}
