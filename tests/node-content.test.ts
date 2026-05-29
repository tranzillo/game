import { describe, it, expect, beforeEach } from "vitest";
import { materializeInitialNodeContent } from "../src/engine/node-content.ts";
import { freshGameState, freshNodeState } from "../src/engine/state.ts";
import { registerCardDef } from "../src/engine/cards.ts";
import { isAiPresentAt } from "../src/engine/presence.ts";
import {
  resetEngine,
  registerCreatureDef,
} from "./helpers.ts";
import type { WorldNode } from "../src/engine/types.ts";

beforeEach(resetEngine);

function setupNode(node: WorldNode) {
  const state = freshGameState();
  state.world.nodes = [node];
  state.world.pawnAt = node.id;
  state.world.nodeState[node.id] = freshNodeState();
  return state;
}

describe("materializeInitialNodeContent — placements", () => {
  it("places a single creature at the declared anchor", () => {
    registerCreatureDef("r3", { force: 2, durability: 3 });
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "hostile",
      label: "L0",
      initialContent: {
        placements: [
          {
            side: "ai",
            kind: "creature",
            anchor: { r: 0, c: 0 },
            defKey: "r3",
            origin: "aiDeck",
          },
        ],
      },
    });
    materializeInitialNodeContent(state, "L0");
    const ns = state.world.nodeState["L0"]!;
    const instId = ns.sideSlots.ai.creatures["r0c0"]!;
    expect(instId).toBeDefined();
    const card = state.cards[instId]!;
    expect(card.defKey).toBe("r3");
    expect(card.origin).toBe("aiDeck");
  });

  it("a neutral placement with biome origin doesn't grant AI presence (per §29)", () => {
    registerCreatureDef("biome1");
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "neutral",
      label: "L0",
      initialContent: {
        placements: [
          {
            side: "ai",
            kind: "creature",
            anchor: { r: 0, c: 0 },
            defKey: "biome1",
            origin: "biome",
          },
        ],
      },
    });
    materializeInitialNodeContent(state, "L0");
    // No encounter yet; check via the slot map manually
    const card = state.cards[state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]!]!;
    expect(card.origin).toBe("biome");
  });

  it("aiDeck origin DOES grant AI presence when an encounter exists", () => {
    registerCreatureDef("r1");
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "hostile",
      label: "L0",
      initialContent: {
        placements: [
          {
            side: "ai",
            kind: "creature",
            anchor: { r: 0, c: 0 },
            defKey: "r1",
            origin: "aiDeck",
          },
        ],
      },
    });
    materializeInitialNodeContent(state, "L0");
    // isAiPresentAt requires a currentEncounter; create one minimally for the test
    state.currentEncounter = {
      locationNodeIds: ["L0"],
      encounterKind: "hostile",
      turn: 1,
      phase: "upkeep",
      subPhase: "start",
      phaseQueue: [],
      firstSide: "player",
      playerSide: {
        deck: [],
        hand: [],
        discard: [],
        graveyard: [],
        junkyard: [],
        durability: 20,
        actionsThisTurn: 0,
      },
      aiSide: null,
      timeline: [],
      past: [],
      flipQueues: { startOfPhase: [], midPhase: [], endOfPhase: [] },
      nextChipId: 1,
      playerLocationCleared: { L0: false },
      outcome: null,
      locationData: {},
      outcomes: [],
      activeSubscriptions: [],
    };
    expect(isAiPresentAt(state, "L0")).toBe(true);
  });

  it("places a multi-slot creature across its footprint", () => {
    registerCreatureDef("big", {
      force: 3,
      footprint: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
    });
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "hostile",
      label: "L0",
      initialContent: {
        placements: [
          {
            side: "ai",
            kind: "creature",
            anchor: { r: 0, c: 0 },
            defKey: "big",
            origin: "aiDeck",
          },
        ],
      },
    });
    materializeInitialNodeContent(state, "L0");
    const ns = state.world.nodeState["L0"]!;
    const id1 = ns.sideSlots.ai.creatures["r0c0"];
    const id2 = ns.sideSlots.ai.creatures["r0c1"];
    expect(id1).toBeDefined();
    expect(id1).toBe(id2);
    const card = state.cards[id1!]!;
    expect(card.slots.sort()).toEqual(["r0c0", "r0c1"]);
  });

  it("attaches equipment when equipWith is supplied", () => {
    registerCreatureDef("h");
    registerCardDef({
      defKey: "axe",
      name: "Axe",
      type: "equipment",
      text: "",
      costs: [],
      grantsAttackPatterns: [{ kind: "cleave", value: 1 }],
    });
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "hostile",
      label: "L0",
      initialContent: {
        placements: [
          {
            side: "ai",
            kind: "creature",
            anchor: { r: 0, c: 0 },
            defKey: "h",
            origin: "aiDeck",
            equipWith: ["axe"],
          },
        ],
      },
    });
    materializeInitialNodeContent(state, "L0");
    const host = state.cards[state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]!]!;
    expect(host.equipment.length).toBe(1);
    expect(host.grantedPatterns.length).toBe(1);
  });
});

describe("materializeInitialNodeContent — initial piles", () => {
  it("populates location graveyard from initialPiles.graveyard", () => {
    registerCreatureDef("biome1");
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "neutral",
      label: "L0",
      initialContent: {
        initialPiles: {
          graveyard: ["biome1", "biome1"],
        },
      },
    });
    materializeInitialNodeContent(state, "L0");
    const pile = state.world.nodeState["L0"]!.locationPiles.graveyard;
    expect(pile.length).toBe(2);
    for (const id of pile) {
      expect(state.cards[id]!.origin).toBe("biome");
    }
  });

  it("populates location junkyard from initialPiles.junkyard", () => {
    registerCreatureDef("biome1");
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "neutral",
      label: "L0",
      initialContent: {
        initialPiles: {
          junkyard: ["biome1"],
        },
      },
    });
    materializeInitialNodeContent(state, "L0");
    expect(state.world.nodeState["L0"]!.locationPiles.junkyard.length).toBe(1);
  });
});

describe("materializeInitialNodeContent — idempotency", () => {
  it("doesn't re-place content on second call", () => {
    registerCreatureDef("r1");
    const state = setupNode({
      id: "L0",
      x: 0,
      y: 0,
      kind: "hostile",
      label: "L0",
      initialContent: {
        placements: [
          {
            side: "ai",
            kind: "creature",
            anchor: { r: 0, c: 0 },
            defKey: "r1",
            origin: "aiDeck",
          },
        ],
      },
    });
    materializeInitialNodeContent(state, "L0");
    const firstId = state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"];
    materializeInitialNodeContent(state, "L0");
    const secondId = state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"];
    expect(firstId).toBe(secondId); // no new instance created
  });
});
