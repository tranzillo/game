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
import { makeResolutionComparator } from "./flip-order.ts";
import { adjacentSameSide, positionsOf } from "./profile.ts";
import { slotsOfKind } from "./state.ts";
import { effectiveStat } from "./stats.ts";
import type {
  CardInstance,
  GameState,
  InstId,
  MoveResolutionEntry,
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

  // Phase gate: the inherent creature move is MAIN-phase only (committed in main, resolved at end
  // of main). Programmatic forced moves (Bully push, Bodyswap, and printed Green out-of-phase
  // mobility) pass enforceTurnLimit:false and bypass this gate. (Note: resolvePendingMove runs the
  // move at END of main, where phase is still "main" — so the gate holds during resolution.)
  if (enforce) {
    const enc = state.currentEncounter;
    if (!enc) return "wrongPhase";
    if (enc.phase !== "main") return "wrongPhase";
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
      locData = { pending: { creatures: {}, structures: {}, actions: {}, equipment: {} }, movedThisTurn: new Set(), pendingMoves: new Map() };
      state.currentEncounter.locationData[loc] = locData;
    }
    locData.movedThisTurn.add(card.instId);
  }

  return "ok";
}

/**
 * Reset the per-turn move counter for a location. Called at the start of a new turn. Also clears
 * any leftover pending moves (they normally drain at end of main; this is a belt-and-suspenders
 * clear so a stale pending move can't survive into the next turn).
 */
export function resetMovedThisTurn(state: GameState, loc: string): void {
  const enc = state.currentEncounter;
  if (!enc) return;
  const locData = enc.locationData[loc];
  if (locData) {
    locData.movedThisTurn.clear();
    locData.pendingMoves.clear();
  }
}

// ---------- Pending-move commit (player-driven, queued) ----------
//
// The inherent creature move: committed during MAIN's play window, resolved in Tempo order at end
// of main (interleaved with flips). commitMove validates and RECORDS a pending move; it does NOT
// execute the relocation (that happens at resolution via moveCreature). The pending move is a
// "pending occupation" of the destination slot — it blocks card commits there (see canPlaceAt),
// exactly like a pending card placement, while the creature stays solid at its source slot.
//
// Eligibility is implicitly "face-up creature in play": only such a creature can be selected to
// move (a face-down committed card isn't a legal move source — it isn't in play yet, and the
// move-assignment window is the same play window in which cards are still face-down). There is no
// "summoning sickness" — a creature that flipped up earlier can't be assigned a move only because
// it wasn't face-up during the assignment window, not by any rule.

export type CommitMoveResult =
  | "ok"
  | "noEncounter"
  | "wrongPhase" // inherent move is main-only
  | "notInPlay" // source isn't a face-up creature on this side at this loc
  | "notAdjacent" // destination isn't orthogonally adjacent to the source
  | "occupiedNow" // destination already holds a real card (can't even reserve it)
  | "destReserved" // another pending move already targets this destination
  | "alreadyMoved"; // this creature already has a move this turn

/**
 * Commit a pending inherent move for `card` to `toPos` (single-slot creatures; the inherent move
 * is single-slot). Player side only. Records into locData.pendingMoves; resolution is later.
 */
export function commitMove(
  state: GameState,
  card: CardInstance,
  loc: string,
  toPos: PositionKey,
): CommitMoveResult {
  const check = checkMove(state, card, loc, toPos);
  if (check !== "ok") return check;
  // Record the pending move. Ensure locData exists.
  const data = state.currentEncounter!.locationData[loc] ?? ensureLocData(state, loc);
  data.pendingMoves.set(card.instId, toPos);
  return "ok";
}

/**
 * Pure validity check for a pending move (no mutation). commitMove records iff this returns "ok";
 * legalMoveTargets maps it over a creature's adjacent slots for UI highlighting.
 */
export function checkMove(
  state: GameState,
  card: CardInstance,
  loc: string,
  toPos: PositionKey,
): CommitMoveResult {
  const enc = state.currentEncounter;
  if (!enc) return "noEncounter";
  if (enc.phase !== "main") return "wrongPhase";

  const ns = state.world.nodeState[loc];
  if (!ns) return "notInPlay";

  // Source must be a face-up creature occupying a slot on the player side here.
  const creatures = ns.sideSlots.player.creatures;
  const fromPos = card.slots[0];
  if (
    !card.revealed ||
    fromPos == null ||
    card.slots.length !== 1 || // inherent move is single-slot (multi-slot movement is later content)
    creatures[fromPos] !== card.instId
  ) {
    return "notInPlay";
  }

  const locData = enc.locationData[loc];
  if (locData?.movedThisTurn.has(card.instId)) return "alreadyMoved";
  if (locData?.pendingMoves.has(card.instId)) return "alreadyMoved";

  // Destination must be orthogonally adjacent to the source (same side, same loc).
  if (!adjacentSameSide(ns.profile, "creature", fromPos).includes(toPos)) return "notAdjacent";

  // Destination occupancy at commit time:
  //  - empty → fine, reserve it.
  //  - occupied by a creature that is ALSO moving out this phase → the slot is "being vacated";
  //    allow the commit (this is the relay / cut-off setup). Whether it actually frees in time is
  //    decided at resolution by Tempo order — if not, the move fizzles.
  //  - occupied by a creature that is staying put → can't move there → reject.
  const occupantId = creatures[toPos];
  if (occupantId != null) {
    const occupantIsVacating = locData?.pendingMoves.has(occupantId) ?? false;
    if (!occupantIsVacating) return "occupiedNow";
  }
  // Two creatures can't reserve the same destination (first reservation wins).
  if (locData && destinationIsPendingMove(locData.pendingMoves, toPos)) return "destReserved";

  return "ok";
}

/**
 * The adjacent positions a creature could legally move to right now (for UI highlighting). Empty
 * if the creature can't move (wrong phase, already moved, not in play, etc.).
 */
export function legalMoveTargets(state: GameState, card: CardInstance, loc: string): PositionKey[] {
  const fromPos = card.slots[0];
  const ns = state.world.nodeState[loc];
  if (fromPos == null || !ns) return [];
  return adjacentSameSide(ns.profile, "creature", fromPos).filter(
    (toPos) => checkMove(state, card, loc, toPos) === "ok",
  );
}

/** Cancel a pending move (UI undo before advance). No-op if none. */
export function cancelMove(state: GameState, instId: InstId, loc: string): void {
  state.currentEncounter?.locationData[loc]?.pendingMoves.delete(instId);
}

// ---------- Pending-move occupancy reads (for canPlaceAt) ----------

/** True iff `toPos` is the DESTINATION of any pending move at this loc. */
export function destinationIsPendingMove(
  pendingMoves: Map<InstId, PositionKey>,
  toPos: PositionKey,
): boolean {
  for (const dest of pendingMoves.values()) {
    if (dest === toPos) return true;
  }
  return false;
}

/**
 * True iff a card commit to (loc, pos) on the player side is blocked by a pending move — either
 * pos is a move's destination (pending occupation) OR pos is the source slot of a creature with a
 * pending move (the creature is still solid there until end of main). Both block a card commit.
 *
 * Note: the source case is already covered by the real-creature occupancy check in canPlaceAt
 * (the creature physically occupies its source slot), but we include it here for completeness so
 * this predicate fully answers "does a pending move block this slot?".
 */
export function pendingMoveBlocksSlot(
  state: GameState,
  loc: string,
  pos: PositionKey,
): boolean {
  const locData = state.currentEncounter?.locationData[loc];
  if (!locData) return false;
  if (destinationIsPendingMove(locData.pendingMoves, pos)) return true;
  // Source slots: the creature still occupies them (solid), so they're already blocked by the
  // committed-map check; included for completeness.
  for (const instId of locData.pendingMoves.keys()) {
    const card = state.cards[instId];
    if (card && card.slots.includes(pos)) return true;
  }
  return false;
}

function ensureLocData(state: GameState, loc: string) {
  const enc = state.currentEncounter!;
  let locData = enc.locationData[loc];
  if (!locData) {
    locData = {
      pending: { creatures: {}, structures: {}, actions: {}, equipment: {} },
      movedThisTurn: new Set(),
      pendingMoves: new Map(),
    };
    enc.locationData[loc] = locData;
  }
  return locData;
}

// ---------- Move resolution (end of main, Tempo-interleaved with flips) ----------
//
// MoveResolutionEntry lives in types.ts (it's a state-shape type — the encounter holds a queue of
// them). It exposes the ResolutionSortKey fields so moves and flip chips share one Tempo order.

/**
 * Build the sorted move-resolution queue for the current end-of-main drain: every pending move
 * across encounter locations, ordered by the same Tempo comparator flips use. The orchestrator
 * interleaves this with the flip-chip queue (resolve whichever head sorts first). Tempo is the
 * creature's effective Tempo at its source slot, cached now so mid-drain stat changes don't
 * reorder (parallels chip Tempo caching).
 *
 * Inherent moves are player-side only; the AI doesn't issue inherent moves in this slice.
 */
export function buildMoveResolutionQueue(state: GameState): MoveResolutionEntry[] {
  const enc = state.currentEncounter;
  if (!enc) return [];
  const entries: MoveResolutionEntry[] = [];
  for (const loc of enc.locationNodeIds) {
    const locData = enc.locationData[loc];
    if (!locData) continue;
    for (const [instId, toPos] of locData.pendingMoves) {
      const card = state.cards[instId];
      const fromPos = card?.slots[0];
      if (!card || fromPos == null) continue;
      entries.push({
        instId,
        side: "player",
        loc,
        fromPos,
        toPos,
        cachedTempo: effectiveStat(state, card, "player", loc, "tempo"),
        posKey: fromPos,
      });
    }
  }
  const cmp = makeResolutionComparator(state);
  entries.sort(cmp);
  return entries;
}

/**
 * Resolve a single pending move at drain time. Executes via moveCreature — whose "occupied"
 * return IS the fizzle: if the destination is still occupied at this moment (occupant hasn't
 * vacated, or isn't moving), the move does nothing and a "move-fizzle" event is emitted. The
 * move is spent either way (not refunded): the pending entry is removed and movedThisTurn is
 * recorded by moveCreature on success; on fizzle we record it here so it can't be retried.
 */
export function resolvePendingMove(state: GameState, entry: MoveResolutionEntry): "moved" | "fizzled" {
  const enc = state.currentEncounter;
  if (enc) enc.locationData[entry.loc]?.pendingMoves.delete(entry.instId);
  const card = state.cards[entry.instId];
  if (!card) return "fizzled";

  const result = moveCreature({
    state,
    card,
    side: entry.side,
    loc: entry.loc,
    toPositions: [entry.toPos],
    kind: "creature",
    enforceTurnLimit: true,
  });

  if (result === "ok") return "moved";

  // Fizzle (occupied / otherwise blocked at resolution). Spend the move so it can't retry, and
  // tell the trace/UI a move was blocked.
  if (enc) {
    const locData = enc.locationData[entry.loc] ?? ensureLocData(state, entry.loc);
    locData.movedThisTurn.add(entry.instId);
  }
  emit(state, "move-fizzle", {
    instId: entry.instId,
    side: entry.side,
    loc: entry.loc,
    fromPos: entry.fromPos,
    toPos: entry.toPos,
    reason: result,
  });
  return "fizzled";
}
