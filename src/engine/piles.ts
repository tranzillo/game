// Pile operations — leave-play, encounter-end reshuffle, within-encounter reshuffle.
//
// Contract: ENGINE_SKETCH.md Phase D, REBUILD_PLAN §29 / §31.
//
// The leavePlay primitive is the single entry point for "a card is leaving its slot." It:
//   1. Decides the destination via routeOnLeavePlay.
//   2. Detaches any equipment attached to this card (if it's a host with equipment).
//   3. Reverts encounter-scoped buffs on the card.
//   4. Fires leave-play triggers (Phase I hook; Phase D leaves this as a TODO marker).
//   5. Removes the card from its slot.
//   6. Sends the card to its destination pile.
//
// V1 deathwish triggers and persistent-action exit hooks are wired in Phase I; here we leave the
// dispatch point clearly marked.

import { revertEncounterScopedBuffs } from "./buffs.ts";
import { detachEquipment } from "./equipment.ts";
import { findCardLocation } from "./presence.ts";
import { addCardToTrash, removeCardFromContainer } from "./marks.ts";
import { routeOnLeavePlay, sendToPile, type LeavePlayReason, type PileTarget } from "./routing.ts";
import type { CardInstance, GameState, Side } from "./types.ts";

// Re-export for callers that don't want to dig into routing.ts
export { routeOnLeavePlay, sendToPile, type LeavePlayReason, type PileTarget };
export { addCardToTrash };

/**
 * Move a card out of its slot to a destination pile per the leave-play routing.
 *
 * Sequence:
 *   1. Compute destination via routeOnLeavePlay.
 *   2. If this card has equipment attached, detach each piece. (Each detach happens via Phase B's
 *      detachEquipment, which routes the equipment to its own junkyard via a recursive leavePlay
 *      call with reason: "equipmentDetached".)
 *   3. Revert encounter-scoped buffs on the card.
 *   4. TODO Phase I: fire leave-play triggers (deathwish, etc.).
 *   5. Remove card from its current container.
 *   6. Send card to destination pile.
 */
export function leavePlay(
  state: GameState,
  card: CardInstance,
  fromSide: Side,
  fromLoc: string,
  reason: LeavePlayReason,
): PileTarget {
  // 1. Decide destination.
  const target = routeOnLeavePlay(state, card, fromSide, fromLoc, reason);

  // 2. Detach equipment attached to this card.
  if (card.equipment.length > 0) {
    const attached = [...card.equipment];
    for (const equipId of attached) {
      const equip = state.cards[equipId];
      if (!equip) continue;
      // Recurse via leavePlay for each equipment with reason "equipmentDetached".
      // First detach via Phase B (removes from host.equipment, clears attachedTo, sweeps buffs).
      detachEquipment(state.cards, equip);
      // Then route the equipment to its own pile.
      leavePlay(state, equip, fromSide, fromLoc, "equipmentDetached");
    }
  }

  // 3. Revert encounter-scoped buffs on the leaving card.
  revertEncounterScopedBuffs(card);

  // 4. TODO Phase I: fire onLeavePlay handler (def.onLeavePlay) via the trigger dispatcher.
  //    The dispatcher will read card.def.onLeavePlay (e.g., a deathwish tag) and run the handler.

  // 5. Find the card's container and remove it.
  const location = findCardLocation(state, card.instId);
  if (location) {
    removeCardFromContainer(state, card, location);
  }

  // 6. Send to destination pile.
  sendToPile(state, card, target);

  return target;
}

// ---------- Within-encounter reshuffle ----------

/**
 * Move all instIds from a side's discard pile into the deck and shuffle.
 *
 * Per §29: when a side's deck runs out and a draw is needed, discard reshuffles into deck.
 * Graveyard, junkyard, location piles do NOT reshuffle mid-encounter — they wait for encounter end.
 *
 * Caller is responsible for triggering this when needed (i.e., the draw routine in Phase E).
 */
export function reshuffleDiscardIntoDeck(state: GameState, side: Side): void {
  if (!state.currentEncounter) return;
  const sideState =
    side === "player" ? state.currentEncounter.playerSide : state.currentEncounter.aiSide;
  if (!sideState) return;
  if (sideState.discard.length === 0) return;
  for (const id of sideState.discard) sideState.deck.push(id);
  sideState.discard.length = 0;
  shuffleInPlace(sideState.deck);
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

// ---------- Encounter-end pile resolution ----------

/**
 * At encounter end, each side with a SideState shuffles its hand + discard + graveyard +
 * junkyard + in-play creatures + in-play equipment back into its deck. Structures stay on the
 * map (in nodeState). Trash stays. Location piles stay.
 *
 * Also writes back persistent state (markCount, permanent buffs) from each instance to its
 * runDeckEntry.mods, so cross-encounter persistence works (Phase L's startRun re-materializes
 * deck cards from the run-deck mods).
 *
 * V1 implementation: just moves instIds back to deck and shuffles. The Phase L startRun is
 * what re-materializes instances from the run-deck at the next encounter; this function leaves
 * the existing CardInstance objects in state.cards for the encounter-end frame (they'll be
 * discarded by Phase L's encounter teardown if a full reset is needed).
 */
export function endEncounterPiles(state: GameState): void {
  if (!state.currentEncounter) return;

  for (const side of ["player", "ai"] as const) {
    const sideState =
      side === "player" ? state.currentEncounter.playerSide : state.currentEncounter.aiSide;
    if (!sideState) continue;

    // Gather all instIds that should go back to deck for this side.
    const reclaim: number[] = [];

    // Hand, discard, graveyard, junkyard → reclaim
    for (const id of sideState.hand) reclaim.push(id);
    for (const id of sideState.discard) reclaim.push(id);
    for (const id of sideState.graveyard) reclaim.push(id);
    for (const id of sideState.junkyard) reclaim.push(id);

    sideState.hand.length = 0;
    sideState.discard.length = 0;
    sideState.graveyard.length = 0;
    sideState.junkyard.length = 0;

    // In-play creatures + equipment on this side at all encounter locations → reclaim.
    // Structures stay where they are (per §29).
    for (const loc of state.currentEncounter.locationNodeIds) {
      const ns = state.world.nodeState[loc];
      if (!ns) continue;
      const sideSlots = ns.sideSlots[side];
      // Creatures
      const creatureIds = new Set<number>();
      for (const key of Object.keys(sideSlots.creatures)) {
        const id = sideSlots.creatures[key];
        if (id != null) creatureIds.add(id);
      }
      for (const id of creatureIds) {
        reclaim.push(id);
        // Also reclaim any equipment attached to this creature.
        const card = state.cards[id];
        if (!card) continue;
        for (const equipId of card.equipment) reclaim.push(equipId);
      }
      // Vacate the slots
      for (const key of Object.keys(sideSlots.creatures)) {
        sideSlots.creatures[key] = null;
      }
    }

    // Write-back persistent state on each reclaimed card to its runDeckEntry.mods.
    for (const id of reclaim) {
      writeBackPersistentState(state, id);
    }

    // Move to deck, shuffle.
    for (const id of reclaim) sideState.deck.push(id);
    shuffleInPlace(sideState.deck);
  }
}

/**
 * Write back the card's persistent state (markCount, permanent buffs) to its runDeckEntry.mods.
 * Called for each card at encounter end before deck shuffle.
 */
function writeBackPersistentState(state: GameState, instId: number): void {
  const card = state.cards[instId];
  if (!card) return;
  if (card.runDeckEntryRef == null) return;
  const entry = state.runDeck[card.runDeckEntryRef];
  if (!entry) return;
  // Marks
  if (card.markCount > 0) entry.mods.markCount = card.markCount;
  else delete entry.mods.markCount;
  // Permanent buffs
  const permanent = card.buffs.filter((b) => b.scope === "permanent");
  if (permanent.length > 0) entry.mods.buffs = permanent;
  else delete entry.mods.buffs;
}
