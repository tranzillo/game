// Persistent action lifecycle helpers.
//
// Contract: REBUILD_PLAN §29 — "Persistent actions (Quest, Prayer, etc.) sit in their action
// slot across turns. Their initial flip resolves like any flip — chip drops to past. The action
// then stays face-up in the slot, watching for its persistence condition. When the condition
// resolves and the action exits, no new chip is emitted (past entry already recorded the flip)."
//
// Phase I builds the lifecycle primitive. Specific persistent-action subtypes (Pray-N channel,
// Curse migration, Quest completion conditions) are content-defined predicates that watch state
// and call exitPersistentAction when ready. Phase M ports the subtypes.

import { getCardDef } from "./cards.ts";
import { leavePlay } from "./piles.ts";
import type { CardInstance, GameState, Side } from "./types.ts";
import type { LeavePlayReason } from "./routing.ts";

/**
 * Retire a persistent action that's been sitting in its slot. Routes the card to its destination
 * pile via leavePlay (which fires onLeavePlay first, then pile routing). Per §29, no new chip is
 * emitted — the original flip-up already wrote the Past entry.
 *
 * The default leave-play reason is "actionResolved" so routing reads the def.exitTo as it would
 * for any resolving action. Callers can pass a different reason if the persistent action exits
 * for a non-resolution cause (e.g., Counterspell wiping the slot — which would use a different
 * reason in Phase M content).
 *
 * Throws if called on a non-persistent action or a non-action card — defensive.
 */
export function exitPersistentAction(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
  reason: LeavePlayReason = "actionResolved",
): void {
  const def = getCardDef(card.defKey);
  if (def.type !== "action") {
    throw new Error(`exitPersistentAction: card ${card.instId} is not an action (type=${def.type})`);
  }
  if (!def.persistent) {
    throw new Error(`exitPersistentAction: card ${card.instId} (${def.defKey}) is not persistent`);
  }
  leavePlay(state, card, side, loc, reason);
}
