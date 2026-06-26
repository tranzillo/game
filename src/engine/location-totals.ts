// Per-location + global stat totals.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §26.
//
// For Force at a location: sum of effective Force over creatures passing combat-eligibility.
// For Tempo, Insight, Spite: sum over all face-up creatures at the location (no eligibility filter).
// For Resolve: not a per-location stat. Returns 0 if queried per-location.
//
// Global totals: sum locationStatTotal across all encounter locations on the side.
// Used for: Insight (draw count), Resolve (kept hand size).

import { effectiveStat } from "./stats.ts";
import { combatEligible } from "./combat-eligibility.ts";
import { getCardDef } from "./cards.ts";
import { locationTextStatPresence } from "./location-text.ts";
import { positionsOf } from "./profile.ts";
import type { GameState, Side, StatKind } from "./types.ts";

/**
 * Committed-only stat total at a location, for the given side.
 *
 * For "force": filtered by combatEligible (only attackers contribute).
 * For "tempo"/"insight"/"spite": all face-up creatures contribute their effectiveStat.
 * For "resolve": returns 0 (not a per-location stat).
 */
export function locationStatTotal(
  state: GameState,
  side: Side,
  loc: string,
  stat: StatKind,
): number {
  if (stat === "resolve") return 0;
  const ns = state.world.nodeState[loc];
  if (!ns) return 0;
  const profile = ns.profile;
  const creaturePositions = positionsOf(profile, "creature");
  let total = 0;
  const seen = new Set<number>();
  for (const pos of creaturePositions) {
    const instId = ns.sideSlots[side].creatures[pos];
    if (instId == null) continue;
    if (seen.has(instId)) continue; // multi-slot dedup
    seen.add(instId);
    const card = state.cards[instId];
    if (!card) continue;
    if (!card.revealed) continue; // face-down inert
    if (stat === "force") {
      if (!combatEligible(state, card, side, loc)) continue;
    }
    total += effectiveStat(state, card, side, loc, stat);
  }

  // Text-hook contributions per DECISIONS 2026-06-12 (stats are creature-only; locations and
  // structures contribute presence via printed text). These join the total for ALL stats —
  // presence pays costs, feeds action flip-tempo, per-location Spite thorns, "your Force here"
  // effects. Combat swing damage is unaffected (per-attacker effectiveStat; text never swings).

  // 1. Location text: "add 1 Tempo here."
  total += locationTextStatPresence(state, side, loc, stat);

  // 2. Structures with presence text ("+1 Force here") — face-up, own side, dedup multi-slot.
  const structSeen = new Set<number>();
  for (const pos of positionsOf(profile, "structure")) {
    const instId = ns.sideSlots[side].structures[pos];
    if (instId == null) continue;
    if (structSeen.has(instId)) continue;
    structSeen.add(instId);
    const card = state.cards[instId];
    if (!card || !card.revealed) continue;
    const def = getCardDef(card.defKey);
    if (!def.presenceGrants) continue;
    for (const grant of def.presenceGrants) {
      if (grant.stat === stat) total += grant.amount;
    }
  }

  return total;
}

/**
 * Visible stat total = committed + pending. For display only; cost checks use committed.
 */
export function pendingStatTotal(
  state: GameState,
  side: Side,
  loc: string,
  stat: StatKind,
): number {
  if (stat === "resolve") return 0;
  let total = locationStatTotal(state, side, loc, stat);
  if (!state.currentEncounter) return total;
  const encLoc = state.currentEncounter.locationData[loc];
  if (!encLoc) return total;

  // Add pending creatures' contributions. Note: pending cards are face-down per §29,
  // but for *visibility* the player can see their own pending plays, so we sum their stats
  // here for the display number. Cost checks use locationStatTotal only.
  const ns = state.world.nodeState[loc];
  if (!ns) return total;
  const creaturePositions = positionsOf(ns.profile, "creature");
  const seen = new Set<number>();
  for (const pos of creaturePositions) {
    const instId = encLoc.pending.creatures[pos];
    if (instId == null) continue;
    if (seen.has(instId)) continue;
    seen.add(instId);
    const card = state.cards[instId];
    if (!card) continue;
    total += effectiveStat(state, card, side, loc, stat);
  }
  return total;
}

/**
 * Global stat total for a side = sum of locationStatTotal across all encounter locations.
 * Used for Insight (draw count) and Resolve (kept hand size at cleanup).
 *
 * For Resolve specifically: this DOES return a value — it sums the side's Resolve across
 * locations, even though per-location Resolve returns 0. So Resolve must be computed differently:
 * sum effectiveStat(c, "resolve") over all face-up creatures on the side, regardless of location.
 *
 * Implementation: iterate the side's creatures across all encounter locations and sum
 * effectiveStat(resolve). Other stats use locationStatTotal.
 */
export function globalStatTotal(state: GameState, side: Side, stat: StatKind): number {
  if (!state.currentEncounter) return 0;
  if (stat === "resolve") return globalResolveTotal(state, side);
  let total = 0;
  for (const loc of state.currentEncounter.locationNodeIds) {
    total += locationStatTotal(state, side, loc, stat);
  }
  return total;
}

function globalResolveTotal(state: GameState, side: Side): number {
  if (!state.currentEncounter) return 0;
  let total = 0;
  for (const loc of state.currentEncounter.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    const creaturePositions = positionsOf(ns.profile, "creature");
    const seen = new Set<number>();
    for (const pos of creaturePositions) {
      const instId = ns.sideSlots[side].creatures[pos];
      if (instId == null) continue;
      if (seen.has(instId)) continue;
      seen.add(instId);
      const card = state.cards[instId];
      if (!card) continue;
      if (!card.revealed) continue;
      total += effectiveStat(state, card, side, loc, "resolve");
    }
  }
  return total;
}
