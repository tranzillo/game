// Pre-authored node content materialization.
//
// Contract: ENGINE_SKETCH.md Phase D, REBUILD_PLAN §3 / §29.
//
// When the engine first encounters a node, materializeInitialNodeContent reads the node's
// initialContent (declared on the WorldNode) and creates CardInstance entries for each
// placement and initial pile entry. Placements drop into the appropriate side slot at the
// declared position (or anchor for multi-slot footprints). Initial pile entries land in
// the location's pile.
//
// Origin per placement: declared on the placement itself (typically "aiDeck" for hostile
// node content, "biome" for neutral node content).

import { getCardDef } from "./cards.ts";
import { createCardInstance } from "./cards.ts";
import { attachEquipment } from "./equipment.ts";
import { footprintFitsAt } from "./profile.ts";
import { freshNodeState } from "./state.ts";
import type { GameState, PositionKey, Side, SlotKind, WorldNode } from "./types.ts";

// ---------- Public ----------

/**
 * Materialize a node's initial content into state. Idempotent: sets node.initialized = true
 * on first call; subsequent calls are no-ops.
 *
 * Pre-conditions: the node exists in state.world.nodes; nodeState entry exists or will be created.
 */
export function materializeInitialNodeContent(state: GameState, nodeId: string): void {
  const node = state.world.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`materializeInitialNodeContent: no node with id ${nodeId}`);
  if (node.initialized) return;

  // Ensure nodeState exists.
  if (!state.world.nodeState[nodeId]) {
    state.world.nodeState[nodeId] = freshNodeState();
  }

  const ns = state.world.nodeState[nodeId]!;
  const content = node.initialContent;

  if (content?.placements) {
    for (const placement of content.placements) {
      materializePlacement(state, nodeId, placement, ns);
    }
  }

  if (content?.initialPiles) {
    if (content.initialPiles.graveyard) {
      for (const defKey of content.initialPiles.graveyard) {
        const instId = createCardInstance(state, defKey, "biome");
        ns.locationPiles.graveyard.push(instId);
      }
    }
    if (content.initialPiles.junkyard) {
      for (const defKey of content.initialPiles.junkyard) {
        const instId = createCardInstance(state, defKey, "biome");
        ns.locationPiles.junkyard.push(instId);
      }
    }
  }

  node.initialized = true;
}

// ---------- Per-placement ----------

function materializePlacement(
  state: GameState,
  _nodeId: string,
  placement: NonNullable<WorldNode["initialContent"]>["placements"] extends Array<infer P> | undefined
    ? P
    : never,
  ns: ReturnType<typeof freshNodeState>,
): void {
  if (!placement) return;
  const def = getCardDef(placement.defKey);
  const profile = ns.profile;

  // Compute footprint positions. For single-slot cards, use placement.anchor as a single position.
  const footprintOffsets = def.footprint ?? [{ r: 0, c: 0 }];
  const anchorKey: PositionKey = `r${placement.anchor.r}c${placement.anchor.c}`;
  const kind = placement.kind;
  const fit = footprintFitsAt(profile, kind, footprintOffsets, anchorKey, ns.sideSlots[placement.side]);
  if (!fit) {
    throw new Error(
      `materializePlacement: footprint at ${anchorKey} doesn't fit for ${placement.defKey}`,
    );
  }

  // Create the instance with the declared origin.
  const instId = createCardInstance(state, placement.defKey, placement.origin);
  const card = state.cards[instId]!;

  // Place. Note: state.currentEncounter may not exist (run init before encounter); placeAt
  // requires locationView which requires currentEncounter. For pre-authored content we mutate
  // the nodeState slot maps directly. This is the only place that bypasses placeAt.
  placeDirectIntoNode(ns, placement.side, kind, fit, instId);
  card.slots = [...fit];

  // Equipment attach.
  if (placement.equipWith) {
    for (const eqKey of placement.equipWith) {
      const eqInstId = createCardInstance(state, eqKey, placement.origin);
      const eqCard = state.cards[eqInstId]!;
      attachEquipment(state, eqCard, card);
    }
  }
}

/**
 * Place a card directly into a node's side slot map. Used during pre-authored content
 * materialization (which runs at world init before any encounter exists).
 *
 * NOT for use during normal gameplay — use Phase A's placeAt instead, which goes through
 * locationView and respects encounter state.
 */
function placeDirectIntoNode(
  ns: ReturnType<typeof freshNodeState>,
  side: Side,
  kind: SlotKind,
  positions: PositionKey[],
  instId: number,
): void {
  const map =
    kind === "creature" ? ns.sideSlots[side].creatures
    : kind === "structure" ? ns.sideSlots[side].structures
    : ns.sideSlots[side].actions;
  for (const p of positions) {
    map[p] = instId;
  }
}
