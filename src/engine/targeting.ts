// Targeting — who is a legal target right now.
//
// Contract: REBUILD_PLAN §29 (lifecycle) + §32 (Past/Present/Future).
//
// A card that is face-down has NOT yet entered play. It sits in its slot but is inert: no stat
// presence, no triggers, and — the rule this module enforces — NOT TARGETABLE. A card only
// becomes a legal target after its chip transits the Present and it flips face-up (enters play /
// the Past). "You cannot target what has not arrived."
//
// This is the DEFAULT. Printed effects that deliberately reach into the Future — Suppress,
// Counter, peek/scry, tempo-reorder — target face-down chips on purpose. Those effects query the
// Future chip array directly (timeline.ts); they do NOT go through these gatherers. Everything
// else (damage, buffs, destroys, acquisition, default combat) gathers candidates HERE so the
// face-up rule is enforced in exactly one place and can't be forgotten at a new call site.
//
// Today all in-engine targeting is creature targeting (the only printed effects target creatures
// in slots), so these gatherers cover creatures. When non-creature targeting arrives, add a
// parallel gatherer here rather than re-inlining the face-up filter elsewhere.
//
// TWO DISTINCT AXES — do not conflate them:
//   - TARGETABILITY (this module's gatherers): can a card be the target of / be damaged by an
//     effect? Face-down = NO (hasn't entered play).
//   - SLOT OCCUPANCY (the occupiedCreatureSlots helpers below): does a card take up space? A
//     face-down committed card DOES occupy its slot. "Only creature on your side here" and
//     "+1 Force per opposing creature here" are occupancy questions — face-down counts. The body
//     is in the world; whether it has flipped is irrelevant to occupancy.

import { frontRowPositions, positionsOf } from "./profile.ts";
import type { CardInstance, GameState, InstId, Side } from "./types.ts";

/**
 * Is this card a legal target for a default (Present/Past-scoped) effect right now?
 *
 * The lifecycle gate: a face-down card has not entered play, so it is not targetable. (Sleeping,
 * back-row, and inert creatures ARE targetable — those states restrict what a card DOES, not
 * whether it can be hit. Only face-down removes a card from the targetable world.)
 */
export function isTargetable(card: CardInstance): boolean {
  return card.revealed;
}

/** Convenience: look up an instId and test targetability. Null/missing → false. */
export function isTargetableId(state: GameState, instId: InstId | null | undefined): boolean {
  if (instId == null) return false;
  const card = state.cards[instId];
  return card != null && isTargetable(card);
}

// ---------- Creature target gatherers ----------
//
// All gatherers: walk the relevant slots, return UNIQUE (multi-slot deduped) instIds of
// face-up creatures only. Order follows profile iteration (front-to-back, left-to-right).

function collectFaceUp(
  state: GameState,
  loc: string,
  side: Side,
  positions: string[],
): InstId[] {
  const ns = state.world.nodeState[loc];
  if (!ns) return [];
  const slots = ns.sideSlots[side].creatures;
  const out: InstId[] = [];
  const seen = new Set<InstId>();
  for (const pos of positions) {
    const instId = slots[pos];
    if (instId == null || seen.has(instId)) continue;
    seen.add(instId);
    if (isTargetableId(state, instId)) out.push(instId);
  }
  return out;
}

/** Face-up creatures on an EXPLICIT side at a location (the base gather). */
export function creatureTargetsOnSide(state: GameState, side: Side, loc: string): InstId[] {
  const ns = state.world.nodeState[loc];
  if (!ns) return [];
  return collectFaceUp(state, loc, side, positionsOf(ns.profile, "creature"));
}

/** Face-up enemy creatures at a location (the most common gather: Spark, Bombardment, …). */
export function enemyCreatureTargets(state: GameState, side: Side, loc: string): InstId[] {
  return creatureTargetsOnSide(state, side === "player" ? "ai" : "player", loc);
}

/** Face-up own-side creatures at a location. */
export function friendlyCreatureTargets(state: GameState, side: Side, loc: string): InstId[] {
  return creatureTargetsOnSide(state, side, loc);
}

/** Face-up creatures at a location on BOTH sides (e.g. "a creature here, any side"). */
export function allCreatureTargets(state: GameState, loc: string): InstId[] {
  return [
    ...friendlyCreatureTargets(state, "player", loc),
    ...enemyCreatureTargets(state, "player", loc),
  ];
}

/** Face-up enemy creatures in the FRONT ROW at a location (e.g. Recruit's front-row pick). */
export function enemyFrontRowTargets(state: GameState, side: Side, loc: string): InstId[] {
  const ns = state.world.nodeState[loc];
  if (!ns) return [];
  const enemy: Side = side === "player" ? "ai" : "player";
  return collectFaceUp(state, loc, enemy, frontRowPositions(ns.profile, "creature"));
}

// ---------- Slot occupancy (the OTHER axis — face-down counts) ----------

/**
 * Unique creature instIds occupying a side's creature slots at a location, INCLUDING face-down
 * cards. This is occupancy, not targetability: a committed face-down card takes up its slot, so
 * it counts. Used by "only creature on your side here" / "per opposing creature here" effects.
 */
export function occupiedCreatureSlots(state: GameState, side: Side, loc: string): InstId[] {
  const ns = state.world.nodeState[loc];
  if (!ns) return [];
  const slots = ns.sideSlots[side].creatures;
  const out: InstId[] = [];
  const seen = new Set<InstId>();
  for (const pos of positionsOf(ns.profile, "creature")) {
    const instId = slots[pos];
    if (instId == null || seen.has(instId)) continue;
    seen.add(instId);
    out.push(instId);
  }
  return out;
}

/** Count of creatures occupying a side's slots at a location (face-down included). */
export function countOccupiedCreatureSlots(state: GameState, side: Side, loc: string): number {
  return occupiedCreatureSlots(state, side, loc).length;
}

/**
 * The single creature directly in front of `attacker` (front-row-first within the attacker's
 * column, via profile.across), gated to face-up. This is the default combat/melee/ranged primary
 * target. Returns its position + instId, or null if nothing TARGETABLE is in front.
 *
 * Note: `across` walks front-to-back, so a face-DOWN front-row card would otherwise be returned
 * as the "first occupied" — we skip past non-targetable occupants and keep scanning back, since a
 * face-down card is not in play and cannot block or be hit.
 */
export function primaryTargetInFront(
  state: GameState,
  attacker: CardInstance,
  side: Side,
  loc: string,
): { pos: string; instId: InstId } | null {
  const ns = state.world.nodeState[loc];
  if (!ns) return null;
  const otherSlots = ns.sideSlots[side === "player" ? "ai" : "player"];
  for (const pos of attacker.slots) {
    // across returns the first occupied column position; but "occupied by a face-down card"
    // doesn't count as in-play, so scan the column ourselves front-to-back skipping non-targetable.
    const coord = ns.profile.creatures.coords[pos];
    if (!coord) continue;
    for (let r = 0; r < ns.profile.creatures.rows; r++) {
      const key = `r${r}c${coord.c}`;
      if (!ns.profile.creatures.positions.includes(key)) continue;
      const instId = otherSlots.creatures[key];
      if (instId == null) continue;
      if (!isTargetableId(state, instId)) continue; // face-down doesn't block; keep scanning back
      return { pos: key, instId };
    }
  }
  return null;
}
