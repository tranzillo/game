// Test helpers — fresh state setup + simple card def registration for Phase A.

import {
  registerCardDef,
  _resetCardDefs,
  _resetInstIdCounter,
  createCardInstance,
} from "../src/engine/cards.ts";
import { freshGameState, freshNodeState, freshEncounterState } from "../src/engine/state.ts";
import { defaultProfile } from "../src/engine/profile.ts";
import type {
  CardDef,
  CardOrigin,
  GameState,
  InstId,
  LocationProfile,
} from "../src/engine/types.ts";

/**
 * Reset Phase-A-side singletons between tests: card def registry + InstId counter.
 * Call in beforeEach for deterministic instId values.
 */
export function resetEngine(): void {
  _resetCardDefs();
  _resetInstIdCounter();
}

/**
 * Register a minimal creature def. Tests can override stats.
 */
export function registerCreatureDef(
  defKey: string,
  opts: Partial<CardDef> = {},
): CardDef {
  const def: CardDef = {
    defKey,
    name: opts.name ?? defKey,
    type: "creature",
    text: opts.text ?? "",
    costs: opts.costs ?? [],
    force: opts.force ?? 1,
    durability: opts.durability ?? 2,
    ...opts,
  };
  registerCardDef(def);
  return def;
}

/**
 * Register a minimal structure def.
 */
export function registerStructureDef(
  defKey: string,
  opts: Partial<CardDef> = {},
): CardDef {
  const def: CardDef = {
    defKey,
    name: opts.name ?? defKey,
    type: "structure",
    text: opts.text ?? "",
    costs: opts.costs ?? [],
    ...opts,
  };
  registerCardDef(def);
  return def;
}

/**
 * Register a minimal action def.
 */
export function registerActionDef(
  defKey: string,
  opts: Partial<CardDef> = {},
): CardDef {
  const def: CardDef = {
    defKey,
    name: opts.name ?? defKey,
    type: "action",
    text: opts.text ?? "",
    costs: opts.costs ?? [],
    ...opts,
  };
  registerCardDef(def);
  return def;
}

/**
 * Build a state with a single-location encounter using the default profile.
 * Node id defaults to "L0".
 */
export function makeSingleLocationState(opts: {
  nodeId?: string;
  profile?: LocationProfile;
} = {}): GameState {
  const state = freshGameState();
  const nodeId = opts.nodeId ?? "L0";
  const profile = opts.profile ?? defaultProfile();
  state.world.nodes = [
    {
      id: nodeId,
      x: 0,
      y: 0,
      kind: "neutral",
      label: nodeId,
    },
  ];
  state.world.pawnAt = nodeId;
  state.world.nodeState[nodeId] = freshNodeState(profile);
  state.currentEncounter = freshEncounterState([nodeId]);
  return state;
}

/**
 * Build a state with N locations.
 */
export function makeMultiLocationState(nodeIds: string[]): GameState {
  const state = freshGameState();
  state.world.nodes = nodeIds.map((id, i) => ({
    id,
    x: i,
    y: 0,
    kind: "neutral" as const,
    label: id,
  }));
  state.world.pawnAt = nodeIds[0]!;
  for (const id of nodeIds) {
    state.world.nodeState[id] = freshNodeState();
  }
  state.currentEncounter = freshEncounterState(nodeIds);
  return state;
}

/**
 * Create a card instance of the given def. Returns the instance directly for convenience.
 */
export function spawn(
  state: GameState,
  defKey: string,
  origin: CardOrigin = "playerDeck",
): InstId {
  return createCardInstance(state, defKey, origin);
}
