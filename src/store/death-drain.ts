// Death-drain helper — finds pending deaths (creatures with pendingLeavePile set) and queues
// their two-beat death sequence (linger → completeDeath) into the active present span.
//
// Contract: REBUILD_PLAN §17 (death sequence) + §32 (chip stays in Present for the entire
// resolution cascade, including downstream deaths).
//
// Called by:
//   - The combat orchestrator after each swing's damage application.
//   - Card effect handlers (e.g., action damage handlers) that may cause deaths inside a chip's
//     resolution span.
// In all cases, the deaths drain inside the span that's currently open — they don't leak into
// later swings or post-span work.

import { emit } from "../engine/events.ts";
import { completeDeath } from "../engine/damage.ts";
import { queueResolutionBeat } from "./present-span.ts";
import { getEngineState } from "./engine-state.ts";
import { notifyStateChanged } from "./index.ts";
import type { CardInstance, GameState, Side } from "../engine/types.ts";

const DEATH_LINGER_MS = 380;
const DEATH_SWEEP_MS = 260;

/**
 * Find the next creature with pendingLeavePile set and queue its death sequence (linger →
 * completeDeath → sweep → recurse). Idempotent — if no deaths pending, this is a no-op.
 *
 * Recurses inside the queued beat to catch chained deaths (deathwish kills, thorns kills, etc.).
 */
export function queueDeathDrain(): void {
  const state = getEngineState();
  if (!state.currentEncounter) return;
  const pending = findOneCreatureWithPendingLeave(state);
  if (!pending) return;

  queueResolutionBeat(DEATH_LINGER_MS, () => {
    const s = getEngineState();
    const { card, side, loc } = pending;
    // Phase I will fire onDeathwish handler inside completeDeath.
    completeDeath(s, card, side, loc);
    emit(s, "death-complete", { instId: card.instId, side, loc });
    notifyStateChanged();
    queueResolutionBeat(DEATH_SWEEP_MS, () => {
      queueDeathDrain();
    });
  });
}

function findOneCreatureWithPendingLeave(state: GameState):
  | { card: CardInstance; side: Side; loc: string }
  | null {
  if (!state.currentEncounter) return null;
  for (const loc of state.currentEncounter.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    for (const side of ["player", "ai"] as const) {
      const creatures = ns.sideSlots[side].creatures;
      const seen = new Set<number>();
      for (const pos of Object.keys(creatures)) {
        const instId = creatures[pos];
        if (instId == null) continue;
        if (seen.has(instId)) continue;
        seen.add(instId);
        const card = state.cards[instId];
        if (card && card.pendingLeavePile != null) {
          return { card, side, loc };
        }
      }
    }
  }
  return null;
}
