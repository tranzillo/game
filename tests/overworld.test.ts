import { describe, it, expect, beforeEach } from "vitest";
import {
  adjacentLocationsFor,
  isBossNode,
  isLocationABoss,
  isLocationInWarMode,
  isNodeControlled,
  isNodeRevealed,
  controlledNodeIds,
  neighborNodeIds,
  getWorldNode,
  startEncounterFromCurrentNode,
} from "../src/engine/overworld.ts";
import { freshGameState, freshNodeState } from "../src/engine/state.ts";
import { defaultProfile } from "../src/engine/profile.ts";
import { resetEngine } from "./helpers.ts";

beforeEach(resetEngine);

function makeMap(): ReturnType<typeof freshGameState> {
  // Hand-authored small map:
  //   N0 (start) --- N1 --- N2 --- N3 (end/boss)
  //                  |
  //                  N4 (side neutral)
  const state = freshGameState();
  state.world.pawnAt = "N0";
  state.world.nodes = [
    { id: "N0", x: 0, y: 0, kind: "start", label: "N0", status: "encountered" },
    { id: "N1", x: 1, y: 0, kind: "neutral", label: "N1", status: "unvisited" },
    { id: "N2", x: 2, y: 0, kind: "neutral", label: "N2", status: "unvisited" },
    { id: "N3", x: 3, y: 0, kind: "end", label: "N3", status: "unvisited" },
    { id: "N4", x: 1, y: 1, kind: "neutral", label: "N4", status: "unvisited" },
  ];
  state.world.edges = [
    ["N0", "N1"],
    ["N1", "N2"],
    ["N2", "N3"],
    ["N1", "N4"],
  ];
  return state;
}

describe("neighborNodeIds", () => {
  it("returns nodes connected by edges (undirected)", () => {
    const state = makeMap();
    expect(neighborNodeIds(state, "N1").sort()).toEqual(["N0", "N2", "N4"]);
  });

  it("returns empty array for an isolated node", () => {
    const state = freshGameState();
    state.world.pawnAt = "N0";
    state.world.nodes = [{ id: "N0", x: 0, y: 0, kind: "start", label: "N0" }];
    state.world.edges = [];
    expect(neighborNodeIds(state, "N0")).toEqual([]);
  });

  it("filters out orphan edge targets (nodes referenced but not in world.nodes)", () => {
    const state = freshGameState();
    state.world.pawnAt = "N0";
    state.world.nodes = [{ id: "N0", x: 0, y: 0, kind: "start", label: "N0" }];
    state.world.edges = [["N0", "Ghost"]];
    expect(neighborNodeIds(state, "N0")).toEqual([]);
  });
});

describe("adjacentLocationsFor", () => {
  it("returns unvisited neighbors of the current node (excluding self)", () => {
    const state = makeMap();
    // From N0, neighbors are [N1]. N1 is unvisited. N0 itself excluded by the visited-filter
    // (status: "encountered").
    expect(adjacentLocationsFor(state, "N0")).toEqual(["N1"]);
  });

  it("excludes already-encountered nodes (one-way travel rule)", () => {
    const state = makeMap();
    state.world.pawnAt = "N1";
    // From N1, neighbors are [N0, N2, N4]. N0 already encountered (the start). N2, N4 unvisited.
    expect(adjacentLocationsFor(state, "N1").sort()).toEqual(["N2", "N4"]);
  });

  it("returns empty array when all neighbors visited (dead end)", () => {
    const state = makeMap();
    // Mark all neighbors of N0 as encountered.
    state.world.nodes.find((n) => n.id === "N1")!.status = "encountered";
    expect(adjacentLocationsFor(state, "N0")).toEqual([]);
  });
});

describe("isBossNode", () => {
  it("true for nodes with kind=end", () => {
    const state = makeMap();
    expect(isBossNode(state, "N3")).toBe(true);
  });

  it("false for neutral, hostile, start", () => {
    const state = makeMap();
    expect(isBossNode(state, "N0")).toBe(false);
    expect(isBossNode(state, "N1")).toBe(false);
  });

  it("false for unknown node ids", () => {
    const state = makeMap();
    expect(isBossNode(state, "Ghost")).toBe(false);
  });
});

describe("isLocationABoss", () => {
  it("alias for isBossNode", () => {
    const state = makeMap();
    expect(isLocationABoss(state, "N3")).toBe(true);
    expect(isLocationABoss(state, "N1")).toBe(false);
  });
});

describe("getWorldNode", () => {
  it("returns the node for a valid id", () => {
    const state = makeMap();
    const n = getWorldNode(state, "N1");
    expect(n.id).toBe("N1");
    expect(n.kind).toBe("neutral");
  });

  it("throws for an unknown id", () => {
    const state = makeMap();
    expect(() => getWorldNode(state, "Ghost")).toThrow();
  });
});

describe("startEncounterFromCurrentNode", () => {
  it("creates a currentEncounter with the unvisited adjacents as locations", () => {
    const state = makeMap();
    // Need nodeState initialized for each location (the helper materializes content but it
    // depends on freshNodeState being there). Phase A pre-creates this via freshNodeState.
    state.world.nodeState["N1"] = freshNodeState(defaultProfile());

    state.world.pawnAt = "N0";
    const enc = startEncounterFromCurrentNode(state);

    expect(enc).not.toBeNull();
    expect(enc!.locationNodeIds).toEqual(["N1"]);
    expect(state.currentEncounter).toBe(enc);
  });

  it("returns null when the pawn has no unvisited adjacents (dead end / run complete)", () => {
    const state = makeMap();
    // Mark all of N0's neighbors as already encountered.
    state.world.nodes.find((n) => n.id === "N1")!.status = "encountered";

    const enc = startEncounterFromCurrentNode(state);
    expect(enc).toBeNull();
    expect(state.currentEncounter).toBeNull();
  });

  it("infers encounterKind=boss when any adjacent loc is an exit node", () => {
    const state = makeMap();
    state.world.nodeState["N2"] = freshNodeState(defaultProfile());
    state.world.nodeState["N3"] = freshNodeState(defaultProfile());
    state.world.nodes.find((n) => n.id === "N1")!.status = "encountered";
    state.world.pawnAt = "N2";

    const enc = startEncounterFromCurrentNode(state);
    expect(enc!.encounterKind).toBe("boss");
    expect(enc!.locationNodeIds).toEqual(["N3"]);
  });

  it("infers encounterKind=neutral when no adjacent loc is hostile/boss", () => {
    const state = makeMap();
    state.world.nodeState["N1"] = freshNodeState(defaultProfile());
    state.world.pawnAt = "N0";

    const enc = startEncounterFromCurrentNode(state);
    expect(enc!.encounterKind).toBe("neutral");
  });

  it("starts the encounter at the draw phase (deck shuffles, opening hand deals via draw substantive)", () => {
    const state = makeMap();
    state.world.nodeState["N1"] = freshNodeState(defaultProfile());
    state.world.pawnAt = "N0";

    const enc = startEncounterFromCurrentNode(state);
    expect(enc!.phase).toBe("draw");
    expect(enc!.subPhase).toBe("start");
  });

  it("carries the player's deck and Durability forward from the prior encounter (§29/§31)", () => {
    const state = makeMap();
    state.world.nodeState["N1"] = freshNodeState(defaultProfile());
    state.world.pawnAt = "N0";

    // Simulate a prior encounter whose end refilled the deck and left run-damage on the summoner.
    const prior = startEncounterFromCurrentNode(state)!;
    prior.playerSide.deck.push(101, 102, 103);
    prior.playerSide.durability = 13;

    // Travel-equivalent: mark N1 encountered, move pawn, start the next encounter.
    state.world.nodes.find((n) => n.id === "N1")!.status = "encountered";
    state.world.pawnAt = "N1";
    const next = startEncounterFromCurrentNode(state)!;

    expect(next.playerSide.deck.sort()).toEqual([101, 102, 103]);
    expect(next.playerSide.durability).toBe(13);
    expect(next.playerSide.hand).toEqual([]); // hand reforms via the draw phase
  });

  it("creates aiSide seeded from run-scoped enemyDurability when AI is present at a loc (DECISIONS 2026-06-13)", () => {
    const state = makeMap();
    // Author AI-origin content at N1 so the summoner is "present" there.
    state.world.nodeState["N1"] = freshNodeState(defaultProfile());
    state.world.nodes.find((n) => n.id === "N1")!.initialContent = {
      placements: [
        { side: "ai", kind: "creature", anchor: { r: 0, c: 0 }, defKey: "tc", origin: "aiDeck" },
      ],
    };
    registerCreatureDefForWar("tc");
    state.enemyDurability = 14; // run-scoped — already chipped down in a prior encounter
    state.world.pawnAt = "N0";

    const enc = startEncounterFromCurrentNode(state)!;
    expect(enc.aiSide).not.toBeNull();
    expect(enc.aiSide!.durability).toBe(14); // seeded from the run value, not a fresh 20
  });

  it("does NOT create aiSide in a pure-neutral encounter (no summoner to damage)", () => {
    const state = makeMap();
    state.world.nodeState["N1"] = freshNodeState(defaultProfile());
    state.world.pawnAt = "N0";
    const enc = startEncounterFromCurrentNode(state)!;
    expect(enc.aiSide).toBeNull();
  });
});

// ---------- §34: tiered map, fog, control ----------

function makeTieredMap(): ReturnType<typeof freshGameState> {
  // tier 1 (y=1): A (x=0), B (x=2) — both unvisited neighbors of start.
  // tier 0 (y=2): S (start).
  const state = freshGameState();
  state.world.pawnAt = "S";
  state.world.nodes = [
    { id: "S", x: 1, y: 2, kind: "start", label: "S", status: "encountered", revealed: true },
    { id: "B", x: 2, y: 1, kind: "neutral", label: "B", status: "unvisited" },
    { id: "A", x: 0, y: 1, kind: "hostile", label: "A", status: "unvisited" },
  ];
  state.world.edges = [
    ["S", "A"],
    ["S", "B"],
  ];
  state.world.nodeState["A"] = freshNodeState(defaultProfile());
  state.world.nodeState["B"] = freshNodeState(defaultProfile());
  return state;
}

describe("startEncounterFromCurrentNode — §34 column order + fog lift", () => {
  it("orders encounter locations by map column (x), not authoring/edge order", () => {
    const state = makeTieredMap();
    // Node B (x=2) is authored before A (x=0); edges list A first. Column order wins: A, B.
    const enc = startEncounterFromCurrentNode(state);
    expect(enc!.locationNodeIds).toEqual(["A", "B"]);
  });

  it("lifts fog at exactly the encounter's locations", () => {
    const state = makeTieredMap();
    expect(isNodeRevealed(state, "A")).toBe(false);
    expect(isNodeRevealed(state, "B")).toBe(false);

    startEncounterFromCurrentNode(state);

    expect(isNodeRevealed(state, "A")).toBe(true);
    expect(isNodeRevealed(state, "B")).toBe(true);
  });

  it("fog stays lifted (revealed persists)", () => {
    const state = makeTieredMap();
    startEncounterFromCurrentNode(state);
    state.currentEncounter = null; // encounter ends
    expect(isNodeRevealed(state, "A")).toBe(true);
  });
});

describe("pre-placed content enters the timeline (unified face-down rule)", () => {
  it("pre-placed cards go face-down with future chips at encounter start", () => {
    registerCreatureDefForWar("prePlaced");
    const state = makeTieredMap();
    // Author initial content on node A so materialization pre-places an AI creature.
    state.world.nodes.find((n) => n.id === "A")!.initialContent = {
      placements: [
        { side: "ai", kind: "creature", anchor: { r: 0, c: 0 }, defKey: "prePlaced", origin: "aiDeck" },
      ],
    };

    const enc = startEncounterFromCurrentNode(state)!;

    // The pre-placed card exists, is FACE-DOWN, and has a future chip queued.
    const placedId = state.world.nodeState["A"]!.sideSlots.ai.creatures["r0c0"];
    expect(placedId).not.toBeNull();
    const card = state.cards[placedId!]!;
    expect(card.revealed).toBe(false);
    const chip = state.timeline.find((c) => c.cardInstId === card.instId);
    expect(chip).toBeDefined();
    expect(chip!.state).toBe("future");
    expect(enc.flipQueues.startOfPhase).toContain(chip);
  });
});

describe("control (§34) — locations the player has traveled to", () => {
  it("controlled = encountered nodes", () => {
    const state = makeTieredMap();
    expect(isNodeControlled(state, "S")).toBe(true);
    expect(isNodeControlled(state, "A")).toBe(false);
    expect(controlledNodeIds(state)).toEqual(["S"]);
  });

  it("a revealed-but-not-traveled node is NOT controlled", () => {
    const state = makeTieredMap();
    startEncounterFromCurrentNode(state); // reveals A and B
    expect(isNodeRevealed(state, "A")).toBe(true);
    expect(isNodeControlled(state, "A")).toBe(false);
  });
});

describe("isLocationInWarMode (§34) — war text needs reveal + AI presence", () => {
  it("false while fogged even if AI-origin cards sit there", () => {
    registerCreatureDefForWar("w");
    const state = makeTieredMap();
    placeAiCreature(state, "A", "w");
    expect(isLocationInWarMode(state, "A")).toBe(false); // fogged
  });

  it("true once revealed with AI presence; false at revealed peaceful nodes", () => {
    registerCreatureDefForWar("w");
    const state = makeTieredMap();
    placeAiCreature(state, "A", "w");
    startEncounterFromCurrentNode(state); // lifts fog at A and B
    expect(isLocationInWarMode(state, "A")).toBe(true);
    expect(isLocationInWarMode(state, "B")).toBe(false); // revealed, no AI
  });
});

// Local helpers for the war-mode tests.
import { registerCardDef, createCardInstance } from "../src/engine/cards.ts";
import type { GameState } from "../src/engine/types.ts";

function registerCreatureDefForWar(defKey: string): void {
  registerCardDef({
    defKey,
    name: defKey,
    type: "creature",
    text: "",
    costs: [],
    force: 1,
    durability: 1,
  });
}

function placeAiCreature(state: GameState, loc: string, defKey: string): void {
  // Write the slot map directly — pre-encounter placement (like materializeInitialNodeContent's
  // placeDirectIntoNode path; placeAt requires an active encounter).
  const id = createCardInstance(state, defKey, "aiDeck");
  const card = state.cards[id]!;
  state.world.nodeState[loc]!.sideSlots.ai.creatures["r0c0"] = id;
  card.slots = ["r0c0"];
}
