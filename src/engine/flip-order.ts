// Flip-queue ordering — the four-level hierarchy.
//
// Contract: ENGINE_SKETCH.md Phase E, REBUILD_PLAN §28.
//
// Sort key (lower = sooner):
//   1. Tempo descending (higher tempo first). Cached on the chip at commit; not re-evaluated.
//   2. Location order: state.currentEncounter.locationNodeIds.indexOf(chip.loc) ascending.
//   3. Position rank within the location's grid (front-to-back, left-to-right).
//   4. Side priority on remaining ties:
//      - The side with the higher local Tempo total at the chip's location goes first.
//      - If local Tempo totals are tied, the firstSide of the turn goes first.
//
// This is the same hierarchy that drives combat order (Phase H will reuse it).

import { positionsOf } from "./profile.ts";
import { locationStatTotal } from "./location-totals.ts";
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
  const firstSide = enc.firstSide;
  const locationIndex = makeLocationIndex(enc.locationNodeIds);
  const positionRank = makePositionRankCache(state);

  queue.sort((a, b) => compareChips(state, firstSide, locationIndex, positionRank, a, b));
  return queue;
}

/**
 * Pure comparator. Negative if a sorts before b.
 */
function compareChips(
  state: GameState,
  firstSide: Side,
  locIndex: (loc: string) => number,
  posRank: (loc: string, posKey: string | null) => number,
  a: TimelineChip,
  b: TimelineChip,
): number {
  // 1. Tempo desc
  if (a.cachedTempo !== b.cachedTempo) {
    return b.cachedTempo - a.cachedTempo;
  }
  // 2. Location order
  const aLoc = locIndex(a.loc);
  const bLoc = locIndex(b.loc);
  if (aLoc !== bLoc) return aLoc - bLoc;
  // 3. Position rank
  const aRank = posRank(a.loc, a.posKey);
  const bRank = posRank(b.loc, b.posKey);
  if (aRank !== bRank) return aRank - bRank;
  // 4. Side priority — local Tempo at chip.loc, else firstSide
  const sidePri = sidePriorityRank(state, firstSide, a.loc);
  // Both chips are at the same loc here (location tier matched). Same firstSide rules apply.
  return sidePri(a.side) - sidePri(b.side);
}

// ---------- Side priority helper ----------

/**
 * Returns a function side → priority rank (lower = goes first) for the given location and turn.
 */
function sidePriorityRank(
  state: GameState,
  firstSide: Side,
  loc: string,
): (side: Side) => number {
  const playerTempo = locationStatTotal(state, "player", loc, "tempo");
  const aiTempo = locationStatTotal(state, "ai", loc, "tempo");
  if (playerTempo !== aiTempo) {
    // Higher local Tempo total goes first
    return (side: Side) => {
      if (side === "player") return playerTempo > aiTempo ? 0 : 1;
      return aiTempo > playerTempo ? 0 : 1;
    };
  }
  // Tied — firstSide goes first
  return (side: Side) => (side === firstSide ? 0 : 1);
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
