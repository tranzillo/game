// Slot access and mutation primitives.
//
// Contract: ENGINE_SKETCH.md Phase A.
//
// Multi-slot cards share a single CardInstance reference across multiple position keys in
// the slot map. The `card.slots` array records every position the card occupies; iterators
// that want unique cards must dedupe by instId.

import { locationView, slotsOfKind, pendingSlotsOfKind } from "./state.ts";
import type {
  CardInstance,
  CardRegistry,
  GameState,
  InstId,
  NodeState,
  PendingSlotMap,
  PositionKey,
  Side,
  SlotKind,
  SlotMap,
} from "./types.ts";

// ---------- Reads against state ----------

export function slotOccupied(
  loc: NodeState,
  side: Side,
  kind: SlotKind,
  pos: PositionKey,
): boolean {
  return slotsOfKind(loc.sideSlots[side], kind)[pos] != null;
}

export function pendingSlotOccupied(
  enc: { pending: PendingSlotMap },
  kind: SlotKind,
  pos: PositionKey,
): boolean {
  return pendingSlotsOfKind(enc.pending, kind)[pos] != null;
}

export function cardAtSlot(
  loc: NodeState,
  side: Side,
  kind: SlotKind,
  pos: PositionKey,
  cards: CardRegistry,
): CardInstance | null {
  const instId = slotsOfKind(loc.sideSlots[side], kind)[pos];
  if (instId == null) return null;
  return cards[instId] ?? null;
}

/**
 * Returns every card occupying a position-in-this-kind on the side at this location,
 * deduplicated by instId (multi-slot cards appear once).
 */
export function allCardsAt(
  loc: NodeState,
  side: Side,
  kind: SlotKind,
  cards: CardRegistry,
): CardInstance[] {
  const map = slotsOfKind(loc.sideSlots[side], kind);
  const seen = new Set<InstId>();
  const out: CardInstance[] = [];
  for (const key of Object.keys(map)) {
    const id = map[key];
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const card = cards[id];
    if (card) out.push(card);
  }
  return out;
}

// ---------- Mutations ----------

/**
 * Place a card into the given positions in either the committed slot map or the pending map.
 * Sets card.slots to the position list (replacing any previous content).
 *
 * Caller is responsible for footprint validation — this primitive trusts that `positions` are
 * legal (use footprintFitsAt to validate first).
 *
 * Multi-slot cards land at all positions atomically (same InstId at each).
 */
export function placeAt(
  state: GameState,
  side: Side,
  loc: string,
  kind: SlotKind,
  positions: PositionKey[],
  card: CardInstance,
  pending: boolean,
): void {
  const view = locationView(state, loc);
  if (pending) {
    const map = pendingSlotsOfKind(view.enc.pending, kind);
    for (const p of positions) {
      if (map[p] != null) {
        throw new Error(`placeAt: pending slot ${kind} ${p} at ${loc} already occupied`);
      }
      map[p] = card.instId;
    }
  } else {
    const map = slotsOfKind(view.node.sideSlots[side], kind);
    for (const p of positions) {
      if (map[p] != null) {
        throw new Error(`placeAt: committed slot ${kind} ${p} at ${loc} already occupied`);
      }
      map[p] = card.instId;
    }
  }
  card.slots = [...positions];
}

/**
 * Remove a card from all positions in either the committed or pending slot map. Clears
 * card.slots. Idempotent on cards that are not currently placed in the named map.
 *
 * `pending` controls which map; pass `false` for committed slots.
 */
export function removeFrom(
  state: GameState,
  side: Side,
  loc: string,
  kind: SlotKind,
  card: CardInstance,
  pending: boolean,
): void {
  const view = locationView(state, loc);
  const map = pending
    ? pendingSlotsOfKind(view.enc.pending, kind)
    : slotsOfKind(view.node.sideSlots[side], kind);
  for (const p of card.slots) {
    if (map[p] === card.instId) map[p] = null;
  }
  card.slots = [];
}

// ---------- Convenience: find the side a card occupies at a loc ----------

/**
 * Search the location's committed slots on both sides for the card. Returns the side it's on,
 * or null if not in any committed slot at this location.
 */
export function findSideAtLocation(
  loc: NodeState,
  card: CardInstance,
  kind: SlotKind,
): Side | null {
  for (const side of ["player", "ai"] as const) {
    const map = slotsOfKind(loc.sideSlots[side], kind);
    for (const key of card.slots) {
      if (map[key] === card.instId) return side;
    }
  }
  return null;
}

// Re-export SlotMap-aware lookups so callers don't have to import from state.ts for these
// (the contract is that all slot access goes through this module in Phase A code).
export { slotsOfKind, pendingSlotsOfKind };
export type { SlotMap, PendingSlotMap };
