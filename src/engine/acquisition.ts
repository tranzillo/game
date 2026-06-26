// Acquisition primitive — move a CardInstance from one side's containment to the other's.
//
// Contract: REBUILD_PLAN §29 line 1099 ("A card moves from one side's containment to another's
// by the act of being acquired. There is no end-of-encounter reconciliation pass. A Recruited
// creature is already on the player's side from the moment of the Recruit.")
//
// The acquisition keeps the card's instId stable; what changes is which side's sideSlots
// contains it. Per DECISIONS 2026-05-12 line 459 (side-swap mechanics): buffs carry over per
// their printed duration; encounter-scoped buffs persist if their timing covers the swap.
//
// Use cases:
//  - Recruit (Red): Force-superiority swap.
//  - Convert (White): Resolve overheal + Force threshold.
//  - Stealswap (Black): material cost swap (the swap card itself moves over).
//  - Reroute (Green): destination-modifier — different mechanic; this primitive isn't used.

import { emit } from "./events.ts";
import { positionsOf } from "./profile.ts";
import { slotsOfKind } from "./state.ts";
import type {
  CardInstance,
  GameState,
  PositionKey,
  Side,
  SlotKind,
} from "./types.ts";

/**
 * Move a creature from one side's slot to the other side's slot at the same location.
 *
 *  - `card`: the card being acquired.
 *  - `fromSide`: the side it's currently on.
 *  - `loc`: location ID (same on both sides — acquisition happens within one location).
 *  - `toPositions`: target positions on the receiving side's slot map. Must be empty + valid for
 *    the card's footprint.
 *  - `kind`: slot kind (always "creature" for now; v1 acquisition surfaces only target creatures).
 *
 * Returns true on success. Returns false if positions are invalid/occupied/wrong-count — caller
 * (handler) treats false as a fizzle per Pillar 10.
 */
export function acquireCardTo(
  state: GameState,
  card: CardInstance,
  fromSide: Side,
  loc: string,
  toPositions: PositionKey[],
  kind: SlotKind = "creature",
): boolean {
  const ns = state.world.nodeState[loc];
  if (!ns) return false;

  const toSide: Side = fromSide === "player" ? "ai" : "player";
  const fromMap = slotsOfKind(ns.sideSlots[fromSide], kind);
  const toMap = slotsOfKind(ns.sideSlots[toSide], kind);

  // Validate destination positions: must be empty and exist in the profile.
  const profilePositions = positionsOf(ns.profile, kind);
  const valid = new Set(profilePositions);
  for (const pos of toPositions) {
    if (!valid.has(pos)) return false;
    if (toMap[pos] != null) return false;
  }
  // Validate footprint count matches the card's current slot count.
  if (toPositions.length !== card.slots.length) return false;

  // Remove from source side's slot map (multi-slot may occupy multiple positions).
  for (const pos of card.slots) {
    if (fromMap[pos] === card.instId) fromMap[pos] = null;
  }

  // Place on destination side.
  for (const pos of toPositions) {
    toMap[pos] = card.instId;
  }
  card.slots = [...toPositions];

  // Outcome event for the trace / UI: a card changed sides (Recruit/Convert/Stealswap).
  emit(state, "acquire", {
    instId: card.instId,
    fromSide,
    toSide,
    loc,
    toPositions: [...toPositions],
  });

  return true;
}

/**
 * Find the first empty position on a side's slot map at this location, matching an optional row
 * filter ("front" or "back"). Returns null if no empty position matches.
 *
 * Used by acquisition verbs to find a landing spot — Recruit puts the acquired creature in the
 * front row on the player's side, for instance.
 */
export function firstEmptyPosition(
  state: GameState,
  side: Side,
  loc: string,
  kind: SlotKind,
  rowFilter?: "front" | "back",
): PositionKey | null {
  const ns = state.world.nodeState[loc];
  if (!ns) return null;
  const map = slotsOfKind(ns.sideSlots[side], kind);
  const positions = positionsOf(ns.profile, kind);
  // Determine front/back row indices.
  const grid = ns.profile.creatures;
  const rows = new Set<number>();
  for (const p of positions) rows.add(grid.coords[p]!.r);
  const minR = Math.min(...rows);
  const maxR = Math.max(...rows);
  for (const p of positions) {
    if (map[p] != null) continue;
    if (rowFilter === "front" && grid.coords[p]!.r !== minR) continue;
    if (rowFilter === "back" && grid.coords[p]!.r !== maxR) continue;
    return p;
  }
  return null;
}
