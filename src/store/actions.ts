// Store-level actions — the engine's external entry points for the UI.
//
// Contract: ENGINE_SKETCH.md Phase F + Phase G.
//
// Each action wraps engine mutations and calls notifyStateChanged() so React rerenders.
// Orchestrated multi-beat actions (advancePhase) use runBeatN from beats.ts.

import { createCardInstance, getCardDef } from "../engine/cards.ts";
import { freshEncounterState } from "../engine/state.ts";
import { freshNodeState } from "../engine/state.ts";
import { placeAt, removeFrom } from "../engine/slots.ts";
import type {
  CardInstance,
  GameState,
  InstId,
  PositionKey,
  Side,
  SlotKind,
} from "../engine/types.ts";
import { getEngineState, setEngineState } from "./engine-state.ts";
import { notifyStateChanged } from "./index.ts";
import { cancelAll } from "../engine/scheduler.ts";
import { defaultProfile } from "../engine/profile.ts";

// ---------- Selection (UI-local state inside engine.encounter for convenience) ----------
//
// Per ENGINE_SKETCH Phase F note: UI-only state like "selected card" belongs in store/UI layer,
// not in EncounterState. For Phase G simplicity we track selection in a module-local cell.
// Phase G+ can promote this to a small dedicated UI store if other UI state appears.

let selectedCardId: InstId | null = null;

export function getSelectedCardId(): InstId | null {
  return selectedCardId;
}

export function actionSelectCard(instId: InstId | null): void {
  selectedCardId = instId;
  notifyStateChanged();
}

// ---------- Slice setup ----------

/**
 * Load the Phase G validation slice: one location (default profile), the player has a small
 * starting hand and deck. Phase 1 of the slice — main phase, sub-phase start.
 *
 * Call this from a button in the UI. Resets engine state, sets up encounter, populates hand.
 */
export function actionLoadSlice(opts: { handDefKeys: string[]; deckDefKeys: string[] }): void {
  // Cancel any pending beat from a prior encounter.
  cancelAll();

  const state = getEngineState();
  // Reset state in place: clear cards, trash, encounter, etc. Keep runDeck / runDurability
  // alone; this is encounter-scope work.
  state.cards = {};
  state.trash = [];
  state.currentEncounter = null;
  state.runOver = null;

  // Set up the world with one node (L0) and a default profile.
  const L0 = "L0";
  state.world.pawnAt = L0;
  state.world.nodes = [
    {
      id: L0,
      x: 0,
      y: 0,
      kind: "neutral",
      label: "Slice",
    },
  ];
  state.world.nodeState = {};
  state.world.nodeState[L0] = freshNodeState(defaultProfile());

  // Set up the encounter.
  state.currentEncounter = freshEncounterState([L0]);

  // Populate hand + deck from defKeys. Cards are origin: "playerDeck".
  for (const k of opts.handDefKeys) {
    const id = createCardInstance(state, k, "playerDeck");
    state.currentEncounter.playerSide.hand.push(id);
  }
  for (const k of opts.deckDefKeys) {
    const id = createCardInstance(state, k, "playerDeck");
    state.currentEncounter.playerSide.deck.push(id);
  }

  // Slice starts in main, sub-phase "start" (interactive play window).
  state.currentEncounter.phase = "main";
  state.currentEncounter.subPhase = "start";

  selectedCardId = null;
  notifyStateChanged();
}

// ---------- Placement ----------

/**
 * Place the selected card from the player's hand into a pending slot at the given location/
 * position/kind. Updates hand + pending slot. No-op if no card is selected, or the card isn't
 * in hand, or the slot is occupied, or the card's type doesn't match the slot kind.
 *
 * Returns true on success, false otherwise (the UI can use this to show feedback).
 */
export function actionPlaceSelectedCard(opts: {
  loc: string;
  side: Side;
  kind: SlotKind;
  pos: PositionKey;
}): boolean {
  const state = getEngineState();
  if (selectedCardId == null) return false;
  if (!state.currentEncounter) return false;
  const enc = state.currentEncounter;

  const card = state.cards[selectedCardId];
  if (!card) return false;

  // Must be in player hand.
  const handIdx = enc.playerSide.hand.indexOf(card.instId);
  if (handIdx === -1) return false;

  // Card type must match slot kind.
  if (matchesKind(card, opts.kind) === false) return false;

  // Try to place. The placeAt primitive will throw if the slot is already occupied.
  try {
    placeAt(state, opts.side, opts.loc, opts.kind, [opts.pos], card, true /* pending */);
  } catch {
    return false;
  }

  // Remove from hand.
  enc.playerSide.hand.splice(handIdx, 1);

  // Deselect after placement.
  selectedCardId = null;

  notifyStateChanged();
  return true;
}

/**
 * Cancel a pending placement — return the card to the player's hand and free the slot.
 */
export function actionCancelPending(opts: {
  loc: string;
  side: Side;
  kind: SlotKind;
  pos: PositionKey;
}): boolean {
  const state = getEngineState();
  if (!state.currentEncounter) return false;
  const enc = state.currentEncounter;

  // Look up the pending card at the position
  const locData = enc.locationData[opts.loc];
  if (!locData) return false;
  const map =
    opts.kind === "creature"
      ? locData.pending.creatures
      : opts.kind === "structure"
        ? locData.pending.structures
        : locData.pending.actions;
  const instId = map[opts.pos];
  if (instId == null) return false;
  const card = state.cards[instId];
  if (!card) return false;

  // Remove from pending
  removeFrom(state, opts.side, opts.loc, opts.kind, card, true);

  // Return to player hand
  enc.playerSide.hand.push(card.instId);

  notifyStateChanged();
  return true;
}

// ---------- Helpers ----------

function matchesKind(card: CardInstance, kind: SlotKind): boolean {
  const def = getCardDef(card.defKey);
  if (kind === "creature") return def.type === "creature";
  if (kind === "structure") return def.type === "structure";
  if (kind === "action") return def.type === "action";
  return false;
}

// Re-export getState for UI convenience (avoids reaching into engine-state directly).
export { getEngineState as getState };

// Type re-exports for components.
export type { GameState };

// _setEngineState only used by tests
export { setEngineState as _setEngineState };
