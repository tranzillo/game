// State factory + accessors.
//
// Contract: ENGINE_SKETCH.md Phase A.
//
// The engine owns its state singleton. Phase F's store wraps this for React; Phase A and
// upcoming engine phases use it directly.

import { defaultProfile } from "./profile.ts";
import type {
  EncounterLocationData,
  EncounterState,
  GameState,
  LocationProfile,
  NodeState,
  PendingSlotMap,
  PositionKey,
  SideState,
  SlotKind,
  SlotMap,
  WorldState,
} from "./types.ts";

// ---------- Empty slot maps ----------

function emptySlotMap(profile: LocationProfile): SlotMap {
  const make = (positions: PositionKey[]): Record<PositionKey, null> => {
    const out: Record<PositionKey, null> = {};
    for (const p of positions) out[p] = null;
    return out;
  };
  return {
    creatures: make(profile.creatures.positions),
    structures: make(profile.structures.positions),
    actions: make(profile.actions.positions),
  };
}

function emptyPendingSlotMap(profile: LocationProfile): PendingSlotMap {
  const make = (positions: PositionKey[]): Record<PositionKey, null> => {
    const out: Record<PositionKey, null> = {};
    for (const p of positions) out[p] = null;
    return out;
  };
  return {
    creatures: make(profile.creatures.positions),
    structures: make(profile.structures.positions),
    actions: make(profile.actions.positions),
    equipment: {},
  };
}

// ---------- Node state factory ----------

/**
 * Build a fresh NodeState with an optionally-supplied profile (defaults to defaultProfile()).
 * Slot maps initialize empty per the profile's positions.
 */
export function freshNodeState(profile?: LocationProfile): NodeState {
  const p = profile ?? defaultProfile();
  return {
    profile: p,
    sideSlots: {
      player: emptySlotMap(p),
      ai: emptySlotMap(p),
    },
    locationPiles: { graveyard: [], junkyard: [] },
    ammo: { player: 0, ai: 0 },
  };
}

/**
 * Build a fresh EncounterLocationData (transient per-encounter overlay) for a node.
 */
export function freshEncounterLocationData(profile: LocationProfile): EncounterLocationData {
  return {
    pending: emptyPendingSlotMap(profile),
    movedThisTurn: new Set(),
  };
}

// ---------- Side state factory ----------

export function freshSideState(): SideState {
  return {
    deck: [],
    hand: [],
    discard: [],
    graveyard: [],
    junkyard: [],
    durability: 20, // v1 default; Phase L will read from run config
    actionsThisTurn: 0,
  };
}

// ---------- World state factory ----------

/**
 * Build an empty WorldState. Phase L's startRun populates nodes/edges/nodeState from a
 * world template.
 */
export function freshWorldState(): WorldState {
  return {
    pawnAt: "",
    nodes: [],
    edges: [],
    nodeState: {},
  };
}

// ---------- Game state factory ----------

export function freshGameState(): GameState {
  return {
    runDeck: [],
    runDurability: 20,
    enemyDurability: 20,
    aiRunDeck: [],
    starterSeed: "",
    world: freshWorldState(),
    cards: {},
    trash: [],
    currentEncounter: null,
    runOver: null,
    timeline: [],
    nextChipId: 1,
    nextResolveSeq: 1,
    encounterCount: 0,
  };
}

// ---------- Encounter state factory ----------

export function freshEncounterState(locationNodeIds: string[]): EncounterState {
  return {
    locationNodeIds,
    encounterKind: "neutral", // computed by encounter setup; Phase A leaves a safe default
    encounterNo: 0, // stamped by encounter setup (startEncounterFromCurrentNode)
    turn: 1,
    phase: "upkeep",
    subPhase: "start",
    phaseQueue: ["draw", "main", "combat", "cleanup"],
    firstSide: "player",
    playerSide: freshSideState(),
    aiSide: null,
    flipQueues: {
      startOfPhase: [],
      midPhase: [],
      endOfPhase: [],
    },
    resolvingChipId: null,
    swingingAttackerInstId: null,
    swingHitTargetInstId: null,
    playerLocationCleared: Object.fromEntries(locationNodeIds.map((id) => [id, false])),
    outcome: null,
    summonerDamageThisEncounter: 0,
    summonerRetreated: false,
    locationData: {},
    outcomes: [],
    activeSubscriptions: [],
  };
}

// ---------- LocationView accessor ----------

export interface LocationView {
  node: NodeState;
  enc: EncounterLocationData;
}

/**
 * Returns the joined view of a location: persistent NodeState + transient EncounterLocationData.
 * Throws if there's no current encounter or no nodeState entry for the given node.
 */
export function locationView(state: GameState, nodeId: string): LocationView {
  if (!state.currentEncounter) throw new Error(`locationView: no encounter active`);
  const node = state.world.nodeState[nodeId];
  if (!node) throw new Error(`locationView: no nodeState for ${nodeId}`);
  let enc = state.currentEncounter.locationData[nodeId];
  if (!enc) {
    enc = freshEncounterLocationData(node.profile);
    state.currentEncounter.locationData[nodeId] = enc;
  }
  return { node, enc };
}

// ---------- Slot accessor by kind ----------

/**
 * Returns the slot map for a kind from a SlotMap (creatures / structures / actions).
 * Helper so callers don't repeat the switch.
 */
export function slotsOfKind(
  map: SlotMap,
  kind: SlotKind,
): Record<PositionKey, number | null> {
  return kind === "creature" ? map.creatures : kind === "structure" ? map.structures : map.actions;
}

export function pendingSlotsOfKind(
  map: PendingSlotMap,
  kind: SlotKind,
): Record<PositionKey, number | null> {
  return kind === "creature" ? map.creatures : kind === "structure" ? map.structures : map.actions;
}
