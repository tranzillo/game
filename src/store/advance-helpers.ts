// Helpers for the Phase G advance orchestration.
//
// Splits pure engine work (commit pending, advance turn) from the beat-chained orchestrator.

import { emitFutureChip } from "../engine/timeline.ts";
import { getCardDef } from "../engine/cards.ts";
import { positionsOf } from "../engine/profile.ts";
import { locationView } from "../engine/state.ts";
import type {
  GameState,
  PendingSlotMap,
  PositionKey,
  Side,
  SlotKind,
  SlotMap,
  TimelineChip,
} from "../engine/types.ts";

const KINDS: SlotKind[] = ["creature", "structure", "action"];

/**
 * For each pending placement at each encounter location, move the card from pending → committed
 * face-down and emit a future chip. Done at the moment the play window closes (player advances).
 *
 * Only the player has pending placements (per §29 — AI commits go straight to face-down at
 * the moment of advance). For Phase G there's no AI commit logic yet; this just handles player.
 *
 * Per ENGINE_SKETCH Phase E: emitFutureChip routes to the active sub-phase queue. We expect
 * subPhase = "start" here.
 */
export function commitPendingForAdvance(state: GameState): void {
  if (!state.currentEncounter) return;
  const enc = state.currentEncounter;

  for (const loc of enc.locationNodeIds) {
    const view = locationView(state, loc);
    const profile = view.node.profile;
    const sideSlots = view.node.sideSlots.player;
    const pending = view.enc.pending;

    for (const kind of KINDS) {
      const pendingMap = pendingMapOfKind(pending, kind);
      const committedMap = committedMapOfKind(sideSlots, kind);

      // Track instIds we've already moved (multi-slot dedup — same instId at multiple positions).
      const moved = new Set<number>();

      for (const pos of positionsOf(profile, kind)) {
        const instId = pendingMap[pos];
        if (instId == null) continue;
        if (moved.has(instId)) {
          // Same multi-slot card encountered at another position; vacate this pending slot.
          pendingMap[pos] = null;
          continue;
        }
        moved.add(instId);

        const card = state.cards[instId];
        if (!card) {
          pendingMap[pos] = null;
          continue;
        }

        // Find all positions in pending occupied by this card (multi-slot footprint).
        const positions: PositionKey[] = [];
        for (const p of positionsOf(profile, kind)) {
          if (pendingMap[p] === instId) positions.push(p);
        }

        // Move to committed (set revealed = false for face-down).
        card.revealed = false;
        card.slots = [...positions];
        for (const p of positions) {
          pendingMap[p] = null;
          committedMap[p] = instId;
        }

        // Emit a chip for this commit. The first position is the canonical posKey.
        const posKey = positions[0]!;
        const def = getCardDef(card.defKey);
        const chipKind: TimelineChip["kind"] = def.type === "equipment" ? "equipment" : def.type;
        emitFutureChip(state, card, "player", loc, chipKind, posKey, null);
      }
    }
  }
}

/**
 * Pop and return the next chip from the active sub-phase's startOfPhase queue. Removes from
 * the queue. Returns null if queue empty.
 */
export function popNextChipFromStartQueue(state: GameState): TimelineChip | null {
  if (!state.currentEncounter) return null;
  const queue = state.currentEncounter.flipQueues.startOfPhase;
  if (queue.length === 0) return null;
  return queue.shift() ?? null;
}

/**
 * Wrap to the next turn for the Phase G slice. Phase A-locked design says turns alternate
 * priority; for the slice we simply increment turn, alternate firstSide, reset to phase=main /
 * subPhase=start, and clear out pending state.
 *
 * Phase K+ will replace this with the full end-of-cleanup → next-turn flow.
 */
export function startNewTurn(state: GameState): void {
  if (!state.currentEncounter) return;
  const enc = state.currentEncounter;
  enc.turn += 1;
  enc.firstSide = enc.firstSide === "player" ? "ai" : "player";
  enc.phase = "main";
  enc.subPhase = "start";
}

// ---------- Slot map kind helpers ----------

function pendingMapOfKind(
  pending: PendingSlotMap,
  kind: SlotKind,
): Record<PositionKey, number | null> {
  return kind === "creature"
    ? pending.creatures
    : kind === "structure"
      ? pending.structures
      : pending.actions;
}

function committedMapOfKind(
  sideSlots: SlotMap,
  kind: SlotKind,
): Record<PositionKey, number | null> {
  return kind === "creature"
    ? sideSlots.creatures
    : kind === "structure"
      ? sideSlots.structures
      : sideSlots.actions;
}

// Re-export `Side` for callers that import advance-helpers without engine types.
export type { Side };
