// Marks — generic count-based marker on cards.
//
// Contract: ENGINE_SKETCH.md Phase C, REBUILD_PLAN §27.
//
// Marks are color-agnostic, effect-agnostic, marker-agnostic. A mark is just a count on the
// card. Two marks tear the card in half: it's exiled to global trash, the runDeckEntry (if any)
// is removed permanently, no leave-play triggers fire.

import { findCardLocation } from "./presence.ts";
import { detachEquipment } from "./equipment.ts";
import { emit } from "./events.ts";
import type { CardInstance, CardLocation, GameState } from "./types.ts";

// ---------- Mark application ----------

export type MarkResult = "marked" | "exiled";

/**
 * Apply a mark to a card.
 *
 * If card.markCount === 0: increment to 1, mirror to runDeckEntry.mods.markCount.
 * If card.markCount === 1: exile the card. See exileFromMarks for the details.
 *
 * Returns "marked" or "exiled" to signal which path was taken.
 */
export function applyMark(state: GameState, card: CardInstance): MarkResult {
  if (card.markCount === 0) {
    card.markCount = 1;
    mirrorMarkToRunDeck(state, card);
    emit(state, "mark", { instId: card.instId, result: "marked", markCount: 1 });
    return "marked";
  }
  // Already marked — second mark exiles
  exileFromMarks(state, card);
  emit(state, "mark", { instId: card.instId, result: "exiled", markCount: 2 });
  return "exiled";
}

function mirrorMarkToRunDeck(state: GameState, card: CardInstance): void {
  if (card.runDeckEntryRef == null) return;
  const entry = state.runDeck[card.runDeckEntryRef];
  if (!entry) return;
  entry.mods.markCount = 1;
}

// ---------- Exile path ----------

/**
 * Exile a card via double-mark.
 *  - Find current container.
 *  - If equipment attached to a host: detach (so host's buffs / patterns are swept).
 *  - Remove from current container.
 *  - Add to trash.
 *  - Remove runDeckEntry from runDeck if any (permanent removal from the run).
 *
 * No leave-play triggers fire — the card is torn, not killed.
 */
export function exileFromMarks(state: GameState, card: CardInstance): void {
  // If this card is itself equipment attached to a host: detach (cleans up host's buffs/patterns).
  if (card.attachedTo != null) {
    detachEquipment(state.cards, card);
  }

  const location = findCardLocation(state, card.instId);
  if (location) {
    removeCardFromContainer(state, card, location);
  }

  addCardToTrash(state, card);
  removeRunDeckEntryFromRunDeck(state, card);
}

// ---------- Container removal ----------

/**
 * Remove a card from its container. Used by exile and (in later phases) leave-play routing.
 *
 * - Slot container: vacate every position the card occupies in the relevant sideSlots map.
 *   Sets card.slots = [].
 * - Hand / deck / discard / graveyard / junkyard: splice from the side's pile array.
 * - Location pile: splice from the location's pile.
 * - Trash: idempotent — removing from trash means filtering trash.
 * - Pending: splice from pending creatures/structures/actions.
 * - PendingEquipment: splice from the host's pending equipment array.
 * - AttachedTo: the caller should have already called detachEquipment; this branch is a no-op.
 */
export function removeCardFromContainer(
  state: GameState,
  card: CardInstance,
  location: CardLocation,
): void {
  switch (location.container) {
    case "slot": {
      const ns = state.world.nodeState[location.loc];
      if (!ns) return;
      const sideMap = ns.sideSlots[location.side];
      const kindMap =
        location.kind === "creature"
          ? sideMap.creatures
          : location.kind === "structure"
            ? sideMap.structures
            : sideMap.actions;
      for (const pos of card.slots) {
        if (kindMap[pos] === card.instId) kindMap[pos] = null;
      }
      card.slots = [];
      return;
    }
    case "hand":
    case "deck":
    case "discard":
    case "graveyard":
    case "junkyard": {
      if (!state.currentEncounter) return;
      const sideState =
        location.side === "player"
          ? state.currentEncounter.playerSide
          : state.currentEncounter.aiSide;
      if (!sideState) return;
      const pile = sideState[location.container];
      const idx = pile.indexOf(card.instId);
      if (idx !== -1) pile.splice(idx, 1);
      return;
    }
    case "locationPile": {
      const ns = state.world.nodeState[location.loc];
      if (!ns) return;
      const pile = ns.locationPiles[location.pile];
      const idx = pile.indexOf(card.instId);
      if (idx !== -1) pile.splice(idx, 1);
      return;
    }
    case "trash": {
      const idx = state.trash.indexOf(card.instId);
      if (idx !== -1) state.trash.splice(idx, 1);
      return;
    }
    case "pending": {
      if (!state.currentEncounter) return;
      const encLoc = state.currentEncounter.locationData[location.loc];
      if (!encLoc) return;
      const map =
        location.kind === "creature"
          ? encLoc.pending.creatures
          : location.kind === "structure"
            ? encLoc.pending.structures
            : encLoc.pending.actions;
      for (const pos of Object.keys(map)) {
        if (map[pos] === card.instId) map[pos] = null;
      }
      return;
    }
    case "pendingEquipment": {
      if (!state.currentEncounter) return;
      const encLoc = state.currentEncounter.locationData[location.loc];
      if (!encLoc) return;
      const arr = encLoc.pending.equipment[location.hostInstId];
      if (!arr) return;
      const idx = arr.indexOf(card.instId);
      if (idx !== -1) arr.splice(idx, 1);
      return;
    }
    case "attachedTo": {
      // Caller should have called detachEquipment which clears card.attachedTo and updates host.
      return;
    }
  }
}

// ---------- Trash ----------

export function addCardToTrash(state: GameState, card: CardInstance): void {
  if (!state.trash.includes(card.instId)) state.trash.push(card.instId);
}

// ---------- Run-deck cleanup ----------

/**
 * Remove the card's runDeckEntry from state.runDeck. Permanent removal — the card no longer
 * exists in the run. Clears card.runDeckEntryRef.
 *
 * Note: removing an entry shifts indexes. Any other CardInstance with a runDeckEntryRef pointing
 * past the removed index would now reference the wrong entry. Phase C scope: assume each
 * instance's runDeckEntryRef is stable, and that double-mark exile is uncommon enough that
 * rebuilding refs across all instances is acceptable.
 */
function removeRunDeckEntryFromRunDeck(state: GameState, card: CardInstance): void {
  if (card.runDeckEntryRef == null) return;
  const removedIdx = card.runDeckEntryRef;
  if (removedIdx < 0 || removedIdx >= state.runDeck.length) {
    delete card.runDeckEntryRef;
    return;
  }
  state.runDeck.splice(removedIdx, 1);
  // Shift refs on remaining cards.
  for (const id of Object.keys(state.cards)) {
    const c = state.cards[Number(id)];
    if (!c) continue;
    if (c.runDeckEntryRef == null) continue;
    if (c.runDeckEntryRef > removedIdx) c.runDeckEntryRef -= 1;
    else if (c.runDeckEntryRef === removedIdx) delete c.runDeckEntryRef;
  }
  // Clear the exiled card's reference (also covered by the loop, but be explicit).
  delete card.runDeckEntryRef;
}
