// Combat swing gathering + Tempo-with-initiative ordering.
//
// Contract: REBUILD_PLAN §28/§30 (revised 2026-06-12), combat eligibility = Force-at-location
// predicate per §26.
//
// A swing is one attacker's contribution to combat: one (attacker, side, loc, pattern) triple.
// Eligible attackers contribute one swing per effective pattern.
//
// Sort hierarchy (lower sorts sooner) — same as the flip queue (flip-order.ts):
//   1. Effective Tempo descending. Evaluated NOW (not cached) — chip tempo is cached at commit
//      but combat tempo is the live value at combat resolution.
//   2. Within a Tempo tier: INITIATIVE side first (enc.firstSide, alternates each turn). All of
//      the initiative side's swings at this tier resolve before any of the other side's.
//   3. Within a side's batch: location order (left-to-right across rendered locations).
//   4. Within a location: position rank (front-to-back, left-to-right).

import { combatEligible } from "./combat-eligibility.ts";
import { effectiveAttackPatterns } from "./attack-patterns.ts";
import { effectiveStat } from "./stats.ts";
import { positionsOf } from "./profile.ts";
import type {
  AttackPattern,
  CardInstance,
  GameState,
  PositionKey,
  Side,
} from "./types.ts";

export interface Swing {
  attacker: CardInstance;
  side: Side;
  loc: string;
  pattern: AttackPattern;
  attackerPosKey: PositionKey;
  cachedTempo: number;
  forceAtSwing: number;
}

/**
 * Gather all eligible swings across the encounter. Returns them unsorted; caller should pipe
 * through sortSwingsInPlace.
 *
 * For multi-slot attackers: the canonical posKey is the first slot in card.slots. Multi-slot
 * creatures get one swing per pattern, not N.
 */
export function gatherSwings(state: GameState): Swing[] {
  if (!state.currentEncounter) return [];
  const enc = state.currentEncounter;
  const out: Swing[] = [];

  for (const loc of enc.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    for (const side of ["player", "ai"] as const) {
      const creatures = ns.sideSlots[side].creatures;
      // Walk each unique creature instId at the location (multi-slot dedupe via Set).
      const seen = new Set<number>();
      for (const pos of positionsOf(ns.profile, "creature")) {
        const instId = creatures[pos];
        if (instId == null) continue;
        if (seen.has(instId)) continue;
        seen.add(instId);
        const card = state.cards[instId];
        if (!card) continue;
        if (!combatEligible(state, card, side, loc)) continue;

        const force = effectiveStat(state, card, side, loc, "force");
        const tempo = effectiveStat(state, card, side, loc, "tempo");
        const canonicalPos = card.slots[0] ?? pos;
        for (const pattern of effectiveAttackPatterns(card)) {
          out.push({
            attacker: card,
            side,
            loc,
            pattern,
            attackerPosKey: canonicalPos,
            cachedTempo: tempo,
            forceAtSwing: force,
          });
        }
      }
    }
  }

  return out;
}

/**
 * Sort swings in place per the Tempo-with-initiative hierarchy. Stable per Array.sort.
 */
export function sortSwingsInPlace(state: GameState, swings: Swing[]): Swing[] {
  if (!state.currentEncounter) return swings;
  const enc = state.currentEncounter;
  const initiative = enc.firstSide;
  const locIdx = makeLocationIndex(enc.locationNodeIds);
  const posRank = makePositionRankCache(state);

  swings.sort((a, b) => {
    // 1. Tempo desc
    if (a.cachedTempo !== b.cachedTempo) return b.cachedTempo - a.cachedTempo;
    // 2. Initiative side first
    if (a.side !== b.side) return a.side === initiative ? -1 : 1;
    // 3. Location order
    const aL = locIdx(a.loc);
    const bL = locIdx(b.loc);
    if (aL !== bL) return aL - bL;
    // 4. Position rank
    return posRank(a.loc, a.attackerPosKey) - posRank(b.loc, b.attackerPosKey);
  });

  return swings;
}

// ---------- Sub-helpers (parallel to flip-order.ts; the same hierarchy applied to swings) ----------

function makeLocationIndex(locationNodeIds: string[]): (loc: string) => number {
  const idx: Record<string, number> = {};
  locationNodeIds.forEach((id, i) => {
    idx[id] = i;
  });
  return (loc: string) => idx[loc] ?? Number.MAX_SAFE_INTEGER;
}

function makePositionRankCache(state: GameState): (loc: string, posKey: PositionKey) => number {
  const cache: Record<string, Record<string, number>> = {};
  return (loc: string, posKey: PositionKey) => {
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
  for (const kind of ["creature", "structure", "action"] as const) {
    for (const pos of positionsOf(ns.profile, kind)) {
      if (result[pos] == null) result[pos] = rank++;
    }
  }
  return result;
}
