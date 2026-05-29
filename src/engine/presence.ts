// AI presence + card-location resolver.
//
// Contract: ENGINE_SKETCH.md Phase A, REBUILD_PLAN §29.
//
// AI presence at a location is dynamic: AI-origin cards must exist on the AI side at that
// location right now. Biome cards on the AI side do NOT grant AI presence — origin matters
// for presence but not for clearing (per §31).

import { positionsOf } from "./profile.ts";
import { locationView } from "./state.ts";
import type {
  CardInstance,
  CardLocation,
  GameState,
  InstId,
  PositionKey,
  SlotKind,
} from "./types.ts";

// ---------- AI presence ----------

/**
 * True iff at least one AI-origin card occupies the AI-side slots at this location.
 * Drives war/peace location-text mode (§J), AI commit legality (§29), and routing decisions
 * for AI-side deaths (§D).
 */
export function isAiPresentAt(state: GameState, loc: string): boolean {
  const view = locationView(state, loc);
  const sides = view.node.sideSlots.ai;
  const profile = view.node.profile;
  const kinds: SlotKind[] = ["creature", "structure", "action"];
  for (const kind of kinds) {
    const positions = positionsOf(profile, kind);
    const map = kind === "creature" ? sides.creatures : kind === "structure" ? sides.structures : sides.actions;
    const seen = new Set<InstId>();
    for (const pos of positions) {
      const instId = map[pos];
      if (instId == null || seen.has(instId)) continue;
      seen.add(instId);
      const card = state.cards[instId];
      if (card && card.origin === "aiDeck") return true;
    }
  }
  return false;
}

/**
 * True iff AI is present at any encounter location. Used by encounter setup to decide
 * whether to create aiSide.
 */
export function isAiPresentAnywhere(state: GameState): boolean {
  if (!state.currentEncounter) return false;
  for (const loc of state.currentEncounter.locationNodeIds) {
    if (isAiPresentAt(state, loc)) return true;
  }
  return false;
}

// ---------- Card location resolver ----------

/**
 * Find the container a card instance is currently in. Returns null if the card isn't in any
 * tracked container (which would only happen for a freshly-created instance that hasn't been
 * placed anywhere yet).
 */
export function findCardLocation(state: GameState, instId: InstId): CardLocation | null {
  const card = state.cards[instId];
  if (!card) return null;

  // Trash check
  if (state.trash.includes(instId)) return { container: "trash" };

  // Side piles
  if (state.currentEncounter) {
    for (const side of ["player", "ai"] as const) {
      const sideState = side === "player" ? state.currentEncounter.playerSide : state.currentEncounter.aiSide;
      if (!sideState) continue;
      if (sideState.hand.includes(instId)) return { container: "hand", side };
      if (sideState.deck.includes(instId)) return { container: "deck", side };
      if (sideState.discard.includes(instId)) return { container: "discard", side };
      if (sideState.graveyard.includes(instId)) return { container: "graveyard", side };
      if (sideState.junkyard.includes(instId)) return { container: "junkyard", side };
    }
  }

  // Location piles
  for (const [loc, ns] of Object.entries(state.world.nodeState)) {
    if (ns.locationPiles.graveyard.includes(instId)) {
      return { container: "locationPile", loc, pile: "graveyard" };
    }
    if (ns.locationPiles.junkyard.includes(instId)) {
      return { container: "locationPile", loc, pile: "junkyard" };
    }
  }

  // Attached to host
  if (card.attachedTo != null) {
    return { container: "attachedTo", hostInstId: card.attachedTo };
  }

  // Committed slots
  if (card.slots.length > 0) {
    const result = findInCommittedSlots(state, card);
    if (result) return result;
  }

  // Pending slots
  if (state.currentEncounter) {
    const result = findInPending(state, card);
    if (result) return result;
  }

  return null;
}

function findInCommittedSlots(state: GameState, card: CardInstance): CardLocation | null {
  for (const [loc, ns] of Object.entries(state.world.nodeState)) {
    for (const side of ["player", "ai"] as const) {
      const sides = ns.sideSlots[side];
      const kinds: SlotKind[] = ["creature", "structure", "action"];
      for (const kind of kinds) {
        const map = kind === "creature" ? sides.creatures : kind === "structure" ? sides.structures : sides.actions;
        const positions: PositionKey[] = [];
        for (const key of card.slots) {
          if (map[key] === card.instId) positions.push(key);
        }
        if (positions.length > 0) {
          return { container: "slot", side, loc, kind, positions };
        }
      }
    }
  }
  return null;
}

function findInPending(state: GameState, card: CardInstance): CardLocation | null {
  if (!state.currentEncounter) return null;
  for (const [loc, encLoc] of Object.entries(state.currentEncounter.locationData)) {
    const kinds: SlotKind[] = ["creature", "structure", "action"];
    for (const kind of kinds) {
      const map = kind === "creature" ? encLoc.pending.creatures : kind === "structure" ? encLoc.pending.structures : encLoc.pending.actions;
      const positions: PositionKey[] = [];
      for (const key of Object.keys(map)) {
        if (map[key] === card.instId) positions.push(key);
      }
      if (positions.length > 0) {
        // Pending is only on the player side (per §29 — AI commits go straight to face-down)
        return { container: "pending", side: "player", loc, kind, positions };
      }
    }
    // Pending equipment, keyed by host instId
    for (const [hostInstIdStr, equipList] of Object.entries(encLoc.pending.equipment)) {
      if (equipList.includes(card.instId)) {
        return {
          container: "pendingEquipment",
          side: "player",
          loc,
          hostInstId: Number(hostInstIdStr),
        };
      }
    }
  }
  return null;
}
