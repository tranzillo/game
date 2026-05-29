// Pile routing decision.
//
// Contract: ENGINE_SKETCH.md Phase D, REBUILD_PLAN §29 / §31.
//
// Routes leaving-play cards to their destination pile. Routing is positional + reason-driven:
//   - reason determines the zone (graveyard / junkyard / discard / trash).
//   - If a summoner is present on the dying side AT THIS LOCATION → side pile.
//   - Else → location pile (graveyard or junkyard; discards on a no-summoner side go to trash).
//
// Per §29: AI is "present at a location" iff at least one AI-origin card occupies the AI side
// at that location. The player is always present.

import { getCardDef } from "./cards.ts";
import { isAiPresentAt } from "./presence.ts";
import type { CardInstance, GameState, Side } from "./types.ts";

// ---------- Pile target ----------

export type SidePileZone = "deck" | "hand" | "discard" | "graveyard" | "junkyard";
export type LocationPileZone = "graveyard" | "junkyard";

export type PileTarget =
  | { kind: "sidePile"; side: Side; zone: SidePileZone }
  | { kind: "locationPile"; loc: string; zone: LocationPileZone }
  | { kind: "trash" };

// ---------- Reason for leaving play ----------

export type LeavePlayReason =
  | "creatureDied"
  | "structureDestroyed"
  | "equipmentDetached"
  | "actionResolved"
  | "explicitTrash"
  | "fromHandDiscard";

// ---------- Routing ----------

/**
 * Compute the destination pile target given the dying card, the side it's on, the location,
 * and the leave-play reason.
 *
 * Algorithm:
 *  1. If reason is "explicitTrash" → trash.
 *  2. Compute zone from reason:
 *     - creatureDied → graveyard
 *     - structureDestroyed | equipmentDetached → junkyard
 *     - actionResolved → discard (or override per def.exitTo)
 *     - fromHandDiscard → discard
 *  3. Check if the card's side has a summoner present at this location:
 *     - Player: always present.
 *     - AI: presence determined by isAiPresentAt(loc).
 *  4. If side has a summoner present AT THIS LOCATION → side pile.
 *  5. Else → location pile (for graveyard/junkyard zones), or trash (for discard).
 *
 * Note for actions: §29 says actions resolving on a side without a summoner have no discard
 * to go to — they go to trash.
 */
export function routeOnLeavePlay(
  state: GameState,
  card: CardInstance,
  fromSide: Side,
  fromLoc: string,
  reason: LeavePlayReason,
): PileTarget {
  if (reason === "explicitTrash") {
    return { kind: "trash" };
  }

  const zone = computeBaseZone(card, reason);

  // For actions, check if def.exitTo overrides discard.
  // (We already factored this into computeBaseZone — actionResolved respects def.exitTo.)

  const sideIsPresent = isSidePresentAtLocation(state, fromSide, fromLoc);

  if (sideIsPresent) {
    return { kind: "sidePile", side: fromSide, zone };
  }

  // Side not present at this location.
  if (zone === "graveyard" || zone === "junkyard") {
    return { kind: "locationPile", loc: fromLoc, zone };
  }
  // Actions resolving on a no-summoner side: trash (no discard exists).
  return { kind: "trash" };
}

function computeBaseZone(
  card: CardInstance,
  reason: LeavePlayReason,
): SidePileZone {
  switch (reason) {
    case "creatureDied":
      return "graveyard";
    case "structureDestroyed":
    case "equipmentDetached":
      return "junkyard";
    case "actionResolved": {
      const def = getCardDef(card.defKey);
      const exit = def.exitTo;
      if (exit === "graveyard") return "graveyard";
      if (exit === "trash") {
        // explicitTrash short-circuit should have caught this; defensive fallback
        return "discard";
      }
      return "discard";
    }
    case "fromHandDiscard":
      return "discard";
    case "explicitTrash":
      return "discard"; // unreachable due to early return above
  }
}

/**
 * Returns true iff the side has summoner presence at this location.
 * - Player is always present.
 * - AI presence is determined by AI-origin cards on AI's side at the location (per §29).
 */
function isSidePresentAtLocation(state: GameState, side: Side, loc: string): boolean {
  if (side === "player") return true;
  return isAiPresentAt(state, loc);
}

// ---------- Apply routing ----------

/**
 * Push the card's instId onto the target pile.
 * Does NOT remove the card from its current container — caller handles that
 * (the leave-play primitive in piles.ts orchestrates the full sequence).
 *
 * For "trash" target, uses addCardToTrash (idempotent).
 */
export function sendToPile(state: GameState, card: CardInstance, target: PileTarget): void {
  switch (target.kind) {
    case "sidePile": {
      if (!state.currentEncounter) return;
      const sideState =
        target.side === "player"
          ? state.currentEncounter.playerSide
          : state.currentEncounter.aiSide;
      if (!sideState) {
        // Side doesn't have a SideState — fall through to trash for safety.
        if (!state.trash.includes(card.instId)) state.trash.push(card.instId);
        return;
      }
      const pile = sideState[target.zone];
      if (!pile.includes(card.instId)) pile.push(card.instId);
      return;
    }
    case "locationPile": {
      const ns = state.world.nodeState[target.loc];
      if (!ns) return;
      const pile = ns.locationPiles[target.zone];
      if (!pile.includes(card.instId)) pile.push(card.instId);
      return;
    }
    case "trash": {
      if (!state.trash.includes(card.instId)) state.trash.push(card.instId);
      return;
    }
  }
}
