// Overworld topology helpers — derive encounter shape from the world graph.
//
// Contract: REBUILD_PLAN §2 / §3 / §29.
//
// Per §2 line 80: "The encounter's locations are the connected NEXT nodes — the nodes the
// player could travel to from their current position. The current node itself is NOT a location
// in the encounter."
//
// Per §3 line 124: "The overworld is a map. On the map there are a network of connected nodes
// with one start and a number of exits, with opposing summoners at those exits."
//
// Per §29 line 1081: "A summoner is 'present' at a location iff their summoner-position is
// adjacent to that location in the overworld graph."

import { freshEncounterState, freshSideState } from "./state.ts";
import { materializeInitialNodeContent } from "./node-content.ts";
import { isAiPresentAt } from "./presence.ts";
import { shuffleDeck } from "./piles.ts";
import { emitFutureChip } from "./timeline.ts";
import type { EncounterKind, EncounterState, GameState, WorldNode } from "./types.ts";

/**
 * Return the IDs of all neighbor nodes of `nodeId` in the world graph. Reads world.edges
 * (undirected). Filters to nodes that exist in world.nodes.
 */
export function neighborNodeIds(state: GameState, nodeId: string): string[] {
  const ids = new Set<string>();
  for (const [a, b] of state.world.edges) {
    if (a === nodeId) ids.add(b);
    else if (b === nodeId) ids.add(a);
  }
  // Filter to nodes that exist (defensive against orphan edges in authored data).
  const existing = new Set(state.world.nodes.map((n) => n.id));
  return [...ids].filter((id) => existing.has(id));
}

/**
 * Return the location IDs for an encounter triggered at `currentNodeId`. Per §2 line 80, these
 * are the connected NEXT nodes — the player's unvisited neighbors. The current node itself is
 * NOT included.
 *
 * If the player can't move (no unvisited neighbors), returns an empty array. Phase L will treat
 * this as "encounter has no locations" — UI surfaces "run complete" or "dead end."
 */
export function adjacentLocationsFor(state: GameState, currentNodeId: string): string[] {
  const neighbors = neighborNodeIds(state, currentNodeId);
  const nodeById = new Map(state.world.nodes.map((n) => [n.id, n] as const));
  const out: string[] = [];
  for (const id of neighbors) {
    const node = nodeById.get(id);
    if (!node) continue;
    // Skip already-encountered nodes per §7 line 243 "one-way travel; can't go back."
    if (node.status === "encountered") continue;
    out.push(id);
  }
  return out;
}

/**
 * True iff the node is an exit / boss node. v1 has one boss summoner at the exit node per §3
 * line 128. The `kind: "end"` flag identifies it.
 */
export function isBossNode(state: GameState, nodeId: string): boolean {
  const node = state.world.nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  return node.kind === "end";
}

/**
 * True iff the location is hosting a boss summoner — i.e., the location's underlying node is a
 * boss node. Used by win-conditions.ts `isBossLocation` (Phase K placeholder) and by combat /
 * pile routing decisions that need to know whether AI summoner Durability is the win condition.
 */
export function isLocationABoss(state: GameState, loc: string): boolean {
  return isBossNode(state, loc);
}

/**
 * Convenience: get the WorldNode for an id, throwing if not found. Useful inside encounter
 * setup where the node must exist.
 */
export function getWorldNode(state: GameState, nodeId: string): WorldNode {
  const node = state.world.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`getWorldNode: no node with id ${nodeId}`);
  return node;
}

// ---------- Encounter setup from topology ----------

/**
 * Set up `currentEncounter` for the player's current pawn position. Per §2 line 80, the
 * encounter's locations are the unvisited neighbors of the pawn node (the current node is NOT
 * a location). Each adjacent location's pre-authored content is materialized via
 * `materializeInitialNodeContent` (idempotent — only runs the first time).
 *
 * Sets `encounterKind` based on whether any location is a boss node:
 *  - "boss" if any adjacent loc is `kind: "end"`
 *  - "hostile" if any adjacent loc has authored AI-origin content (Phase L doesn't infer this
 *    yet; defaults to "hostile" for simplicity — content authoring distinguishes hostile/neutral
 *    via the location's pre-placed creatures)
 *  - "neutral" if no AI presence at any loc
 *  - "mixed" reserved for Phase L+ when boss + non-boss locs coexist
 *
 * Returns null if the current pawn position has no unvisited adjacent nodes (dead end / run
 * complete). Caller should handle the empty-encounter case (run end UI).
 */
export function startEncounterFromCurrentNode(state: GameState): EncounterState | null {
  const currentNode = state.world.pawnAt;
  if (!currentNode) return null;
  const locationIds = adjacentLocationsFor(state, currentNode);
  if (locationIds.length === 0) return null;

  // Order encounter locations by map column (x) per §34 — the encounter view renders them in
  // their natural map order, and location order is tier 3 of the resolution hierarchy, so this
  // makes resolution order match what the player sees on the map.
  const nodeById = new Map(state.world.nodes.map((n) => [n.id, n] as const));
  locationIds.sort((a, b) => (nodeById.get(a)?.x ?? 0) - (nodeById.get(b)?.x ?? 0));

  // Fog lifts at encounter start, at exactly the encounter's locations (§34). Permanent.
  for (const id of locationIds) {
    const node = nodeById.get(id);
    if (node) node.revealed = true;
  }

  // Materialize content at each location (idempotent — skips if already initialized).
  for (const id of locationIds) {
    materializeInitialNodeContent(state, id);
  }

  // Build the fresh encounter. The player's persistent deck carries over between encounters —
  // capture it from the prior encounter (endEncounterPiles reclaimed everything into it),
  // shuffle fresh per §29, hand reforms via the turn's draw phase.
  const priorDeck = state.currentEncounter?.playerSide.deck ?? [];
  const priorDurability = state.currentEncounter?.playerSide.durability;

  const enc = freshEncounterState(locationIds);
  enc.playerSide.deck = [...priorDeck];
  if (priorDurability != null) enc.playerSide.durability = priorDurability; // run-state per §31
  enc.encounterKind = inferEncounterKind(state, locationIds);
  enc.encounterNo = ++state.encounterCount; // Past timestamp axis (run-scoped Past)
  // The enemy summoner is present (and therefore damageable) at any encounter where it has forces
  // at a location (DECISIONS 2026-06-13: damageable wherever present, not only at a boss node).
  // Create aiSide seeded from the run-scoped enemyDurability so fall-through damage lands on the
  // summoner and persists across encounters. Pure-neutral encounters (no AI-origin presence) get
  // no aiSide — there is no summoner to damage there.
  const aiPresent = locationIds.some((loc) => isAiPresentAt(state, loc));
  if (aiPresent) {
    enc.aiSide = freshSideState();
    enc.aiSide.durability = state.enemyDurability; // run-scoped: carry the summoner's HP in
    enc.aiSide.deck = [...state.aiRunDeck]; // run-scoped: carry the summoner's deck in
  }
  // Encounter starts at the draw phase: deck shuffles fresh, the draw substantive deals the
  // opening hand (5 + Insight). Upkeep is skipped until upkeep content exists (slice shortcut).
  enc.phase = "draw";
  enc.subPhase = "start";

  state.currentEncounter = enc;
  shuffleDeck(state, "player");
  if (enc.aiSide) shuffleDeck(state, "ai");

  // Pre-placed content enters the timeline like any committed card (unified face-down rule:
  // ALL pre-placed content starts face-down and flips through future → present → past with
  // normal flip timings). Fog lifted above reveals the face-down cards; their chips queue now
  // and drain on the first flip pass, firing flip-up triggers normally.
  enterPrePlacedContentIntoTimeline(state, enc);

  return enc;
}

function enterPrePlacedContentIntoTimeline(state: GameState, enc: EncounterState): void {
  for (const loc of enc.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    for (const side of ["player", "ai"] as const) {
      for (const kind of ["creature", "structure", "action"] as const) {
        const slotMap =
          kind === "creature"
            ? ns.sideSlots[side].creatures
            : kind === "structure"
              ? ns.sideSlots[side].structures
              : ns.sideSlots[side].actions;
        const seen = new Set<number>();
        for (const pos of Object.keys(slotMap)) {
          const instId = slotMap[pos];
          if (instId == null || seen.has(instId)) continue;
          seen.add(instId);
          const card = state.cards[instId];
          if (!card) continue;
          // Face-down + future chip. Tempo caches at this moment (face-down cards still read
          // their printed tempo for the cache — same as player commits).
          card.revealed = false;
          emitFutureChip(state, card, side, loc, kind, card.slots[0] ?? null, null);
        }
      }
    }
  }
}

// ---------- Fog + control predicates (§34) ----------

/**
 * True iff the node's fog has lifted (its cards are visible at the overworld zoom). Fog lifts
 * at encounter start and never returns. Location TEXT is never fogged — only cards.
 */
export function isNodeRevealed(state: GameState, nodeId: string): boolean {
  const node = state.world.nodes.find((n) => n.id === nodeId);
  return node?.revealed === true;
}

/**
 * The player CONTROLS locations they have previously traveled to (§34). Control is the
 * card-text relationship for reaching back down the traveled chain — "a graveyard you control"
 * = a location graveyard at a controlled node.
 */
export function isNodeControlled(state: GameState, nodeId: string): boolean {
  const node = state.world.nodes.find((n) => n.id === nodeId);
  return node?.status === "encountered";
}

/**
 * All controlled node ids, in map order. Queryable surface for card effects targeting
 * "piles you control."
 */
export function controlledNodeIds(state: GameState): string[] {
  return state.world.nodes.filter((n) => n.status === "encountered").map((n) => n.id);
}

/**
 * War/peace mode per §34: a location shows its peace-time text while fogged; when fog lifts
 * AND AI presence is revealed there, the text changes to war mode. War mode = revealed + AI
 * present. (Location text dispatch consumes this; lands with the text-hook surface.)
 */
export function isLocationInWarMode(state: GameState, loc: string): boolean {
  if (!isNodeRevealed(state, loc)) return false;
  return isAiPresentAt(state, loc);
}

function inferEncounterKind(state: GameState, locationIds: string[]): EncounterKind {
  let anyBoss = false;
  let anyHostile = false;
  for (const id of locationIds) {
    const node = state.world.nodes.find((n) => n.id === id);
    if (!node) continue;
    if (node.kind === "end") anyBoss = true;
    else if (node.kind === "hostile") anyHostile = true;
  }
  if (anyBoss && anyHostile) return "mixed";
  if (anyBoss) return "boss";
  if (anyHostile) return "hostile";
  return "neutral";
}
