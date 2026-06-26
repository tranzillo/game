// Flip-queue ordering — Tempo with initiative tie-break.
//
// Contract: REBUILD_PLAN §28/§30 (revised 2026-06-12), DECISIONS 2026-06-12 initiative entry.
//
// Sort key (lower = sooner):
//   1. Tempo descending (higher tempo first). Cached on the chip at commit; not re-evaluated.
//      Permanents cache printed/effective Tempo; actions cache their side's location Tempo total.
//   2. Within a Tempo tier: INITIATIVE side first. Initiative (enc.firstSide) alternates each
//      turn; all of the initiative side's chips at this tier resolve before any of the other
//      side's. Initiative is purely a fair tie-breaker — it never overrides a real Tempo
//      difference.
//   3. Within a side's batch: location order (state.currentEncounter.locationNodeIds.indexOf
//      ascending).
//   4. Within a location: position rank (front-to-back, left-to-right per profile order).
//
// This is the same hierarchy that drives combat order (combat-order.ts).

import { positionsOf } from "./profile.ts";
import type { GameState, Side, TimelineChip } from "./types.ts";

/**
 * Sort a chip queue in place. Returns the same array reference. Stable per JS Array.sort
 * implementation.
 */
export function sortChipQueueInPlace(
  state: GameState,
  queue: TimelineChip[],
): TimelineChip[] {
  if (!state.currentEncounter) return queue;
  const enc = state.currentEncounter;
  const initiative = enc.firstSide;
  const locationIndex = makeLocationIndex(enc.locationNodeIds);
  const positionRank = makePositionRankCache(state);

  queue.sort((a, b) => compareChips(initiative, locationIndex, positionRank, a, b));
  return queue;
}

/**
 * Pure comparator. Negative if a sorts before b.
 */
function compareChips(
  initiative: Side,
  locIndex: (loc: string) => number,
  posRank: (loc: string, posKey: string | null) => number,
  a: TimelineChip,
  b: TimelineChip,
): number {
  // 1. Tempo desc
  if (a.cachedTempo !== b.cachedTempo) {
    return b.cachedTempo - a.cachedTempo;
  }
  // 2. Initiative side first
  if (a.side !== b.side) {
    return a.side === initiative ? -1 : 1;
  }
  // 3. Location order
  const aLoc = locIndex(a.loc);
  const bLoc = locIndex(b.loc);
  if (aLoc !== bLoc) return aLoc - bLoc;
  // 4. Position rank
  return posRank(a.loc, a.posKey) - posRank(b.loc, b.posKey);
}

// ---------- Location index ----------

function makeLocationIndex(locationNodeIds: string[]): (loc: string) => number {
  const idx: Record<string, number> = {};
  locationNodeIds.forEach((id, i) => {
    idx[id] = i;
  });
  return (loc: string) => idx[loc] ?? Number.MAX_SAFE_INTEGER;
}

// ---------- Position rank ----------
//
// Position rank within a location follows the profile's iteration order. For each kind grid,
// positions are listed front-to-back, left-to-right. A chip's posKey is looked up in the
// profile's positions array — its index is the rank.
//
// Equipment chips (posKey === null) sort to a high rank (after slot-occupying cards).
// Within equipment chips at the same loc + tempo, no further deterministic order — caller
// can rely on append order via the Array.sort stability.

function makePositionRankCache(state: GameState): (loc: string, posKey: string | null) => number {
  const cache: Record<string, Record<string, number>> = {};
  return (loc: string, posKey: string | null) => {
    if (posKey == null) return Number.MAX_SAFE_INTEGER - 1;
    if (!cache[loc]) {
      cache[loc] = buildPositionRankForLoc(state, loc);
    }
    return cache[loc][posKey] ?? Number.MAX_SAFE_INTEGER;
  };
}

function buildPositionRankForLoc(state: GameState, loc: string): Record<string, number> {
  const ns = state.world.nodeState[loc];
  if (!ns) return {};
  const result: Record<string, number> = {};
  let rank = 0;
  // Order: creatures first (front-to-back, left-to-right per profile order), then structures,
  // then actions. Within each kind, profile.positions is the canonical order.
  for (const kind of ["creature", "structure", "action"] as const) {
    for (const pos of positionsOf(ns.profile, kind)) {
      if (result[pos] == null) result[pos] = rank++;
    }
  }
  return result;
}
