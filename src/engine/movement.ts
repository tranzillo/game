// Movement primitive — relocate a creature within a side's slot map at a single location.
//
// Contract: REBUILD_PLAN §30 line 1208 ("Movement is allowed in main and combat phases.
// One move per creature per turn.")
//
// Two ways to call this:
//  - Player-driven move (main/combat phases): UI passes the card + target positions; engine
//    validates phase + per-turn move counter + slot legality.
//  - Programmatic move from a card effect (push, swap, displace): handler calls moveCreature
//    directly; the move counter MAY or MAY NOT apply depending on the printed effect's intent
//    (most "push" effects bypass the per-turn limit since they're forced moves).
//
// The `enforceTurnLimit` parameter controls the move-counter gate.

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

export interface MoveOptions {
  state: GameState;
  card: CardInstance;
  side: Side;
  loc: string;
  toPositions: PositionKey[];
  kind?: SlotKind; // defaults to "creature"
  enforceTurnLimit?: boolean; // defaults to true (player-driven move)
}

export type MoveResult = "ok" | "wrongCount" | "outOfRange" | "occupied" | "alreadyMoved" | "wrongPhase";

/**
 * Move a creature from its current positions to `toPositions` on the same side at the same
 * location. Validates slot legality, footprint count, per-turn move limit, and (when
 * enforceTurnLimit is true) the current phase.
 *
 * Returns a MoveResult — "ok" on success, otherwise a reason. Handler / UI treats non-"ok" as
 * fizzle / disallowed input.
 */
export function moveCreature(opts: MoveOptions): MoveResult {
  const { state, card, side, loc, toPositions } = opts;
  const kind: SlotKind = opts.kind ?? "creature";
  const enforce = opts.enforceTurnLimit ?? true;

  // Phase gate: per §30, movement is allowed in main and combat phases only when the move is
  // player-driven. Programmatic forced moves (Bully push, Bodyswap, etc.) bypass this.
  if (enforce) {
    const enc = state.currentEncounter;
    if (!enc) return "wrongPhase";
    if (enc.phase !== "main" && enc.phase !== "combat") return "wrongPhase";
  }

  const ns = state.world.nodeState[loc];
  if (!ns) return "outOfRange";

  // Footprint count must match card's current slot count.
  if (toPositions.length !== card.slots.length) return "wrongCount";

  // Validate destination positions are in profile.
  const profilePositions = positionsOf(ns.profile, kind);
  const valid = new Set(profilePositions);
  for (const p of toPositions) {
    if (!valid.has(p)) return "outOfRange";
  }

  const map = slotsOfKind(ns.sideSlots[side], kind);
  // Validate destination positions are empty (excluding the card's own current slots — a card
  // can "move" to a subset of its current footprint if that ever matters; here we require
  // strictly different positions to mean the card actually moved somewhere new).
  const selfSlots = new Set(card.slots);
  for (const p of toPositions) {
    if (map[p] != null && !selfSlots.has(p)) return "occupied";
  }

  // Per-turn move counter (only enforced for player-driven moves).
  if (enforce) {
    const enc = state.currentEncounter!;
    const locData = enc.locationData[loc];
    if (locData && locData.movedThisTurn.has(card.instId)) return "alreadyMoved";
  }

  // Capture the source positions before mutation for the outcome event.
  const fromPositions = [...card.slots];

  // Mutation: clear source positions, set destination positions, update card.slots.
  for (const pos of card.slots) {
    if (map[pos] === card.instId) map[pos] = null;
  }
  for (const pos of toPositions) {
    map[pos] = card.instId;
  }
  card.slots = [...toPositions];

  // Outcome event for the trace / UI: a creature moved within its side at this location.
  emit(state, "move", {
    instId: card.instId,
    side,
    loc,
    fromPositions,
    toPositions: [...toPositions],
  });

  // Record the move (regardless of enforce flag — even programmatic moves count for tracking).
  if (state.currentEncounter) {
    let locData = state.currentEncounter.locationData[loc];
    if (!locData) {
      locData = { pending: { creatures: {}, structures: {}, actions: {}, equipment: {} }, movedThisTurn: new Set() };
      state.currentEncounter.locationData[loc] = locData;
    }
    locData.movedThisTurn.add(card.instId);
  }

  return "ok";
}

/**
 * Reset the per-turn move counter for a location. Called at the start of a new turn.
 */
export function resetMovedThisTurn(state: GameState, loc: string): void {
  const enc = state.currentEncounter;
  if (!enc) return;
  const locData = enc.locationData[loc];
  if (locData) locData.movedThisTurn.clear();
}
