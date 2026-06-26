import { describe, it, expect, beforeEach } from "vitest";
import {
  isLocationClearedByPlayer,
  discardClearedLocationCommits,
  runEndOfCleanupChecks,
  runPerDamageWinChecks,
} from "../src/engine/win-conditions.ts";
import { placeAt } from "../src/engine/slots.ts";
import { freshSideState } from "../src/engine/state.ts";
import { attachEquipment } from "../src/engine/equipment.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  registerActionDef,
  makeSingleLocationState,
  makeMultiLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("isLocationClearedByPlayer", () => {
  it("true when AI side has no creatures at this loc", () => {
    const state = makeSingleLocationState();
    expect(isLocationClearedByPlayer(state, "L0")).toBe(true);
  });

  it("false when AI side has at least one creature at this loc", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const c = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], c, false);
    expect(isLocationClearedByPlayer(state, "L0")).toBe(false);
  });

  it("origin-irrelevant: biome AI creature still counts", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const c = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c1"], c, false);
    expect(isLocationClearedByPlayer(state, "L0")).toBe(false);
  });

  it("multi-slot AI creature counts once (still blocks clear)", () => {
    registerCreatureDef("big", {
      footprint: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
    });
    const state = makeSingleLocationState();
    const big = getCard(state.cards, spawn(state, "big", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0", "r0c1"], big, false);
    expect(isLocationClearedByPlayer(state, "L0")).toBe(false);
  });

  it("structures on AI side don't block clear (they're not creatures)", () => {
    registerStructureDef("s");
    const state = makeSingleLocationState();
    const s = getCard(state.cards, spawn(state, "s", "biome"));
    placeAt(state, "ai", "L0", "structure", ["r0c0"], s, false);
    expect(isLocationClearedByPlayer(state, "L0")).toBe(true);
  });
});

describe("discardClearedLocationCommits", () => {
  it("moves player creatures at the loc to the DISCARD pile and empties their slots", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], b, false);

    discardClearedLocationCommits(state, "L0");

    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c1"]).toBeNull();
    // DECISIONS 2026-06-13: cleared commits go to discard, NOT the deck.
    expect(state.currentEncounter!.playerSide.discard).toContain(a.instId);
    expect(state.currentEncounter!.playerSide.discard).toContain(b.instId);
    expect(state.currentEncounter!.playerSide.deck).not.toContain(a.instId);
    expect(a.slots).toEqual([]);
    expect(b.slots).toEqual([]);
  });

  it("discards persistent actions but NOT structures (structures stay per §29)", () => {
    registerStructureDef("s");
    registerActionDef("watch", { persistent: true });
    const state = makeSingleLocationState();
    const s = getCard(state.cards, spawn(state, "s"));
    const watch = getCard(state.cards, spawn(state, "watch"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], s, false);
    placeAt(state, "player", "L0", "action", ["r0c0"], watch, false);

    discardClearedLocationCommits(state, "L0");

    // Structure stays.
    expect(state.world.nodeState["L0"]!.sideSlots.player.structures["r0c0"]).toBe(s.instId);
    expect(state.currentEncounter!.playerSide.discard).not.toContain(s.instId);
    // Persistent action goes to discard.
    expect(state.world.nodeState["L0"]!.sideSlots.player.actions["r0c0"]).toBeNull();
    expect(state.currentEncounter!.playerSide.discard).toContain(watch.instId);
  });

  it("discards equipment attached to reclaimed creatures", () => {
    registerCreatureDef("host");
    registerCardDef({
      defKey: "axe",
      name: "Axe",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 1, kind: "add" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "host"));
    const axe = getCard(state.cards, spawn(state, "axe"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    attachEquipment(state, axe, host);

    discardClearedLocationCommits(state, "L0");

    expect(state.currentEncounter!.playerSide.discard).toContain(host.instId);
    expect(state.currentEncounter!.playerSide.discard).toContain(axe.instId);
    // Equipment is no longer attached.
    expect(host.equipment).toEqual([]);
  });

  it("is a no-op if there's nothing to discard", () => {
    const state = makeSingleLocationState();
    const discardBefore = [...state.currentEncounter!.playerSide.discard];
    discardClearedLocationCommits(state, "L0");
    expect(state.currentEncounter!.playerSide.discard).toEqual(discardBefore);
  });

  it("dedupes multi-slot creatures (discard once)", () => {
    registerCreatureDef("big", {
      footprint: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
    });
    const state = makeSingleLocationState();
    const big = getCard(state.cards, spawn(state, "big"));
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], big, false);

    discardClearedLocationCommits(state, "L0");

    const discard = state.currentEncounter!.playerSide.discard;
    expect(discard.filter((id) => id === big.instId).length).toBe(1);
  });
});

describe("runEndOfCleanupChecks — clear-flag updates (commit move deferred)", () => {
  it("sets clear flag + reports the loc; the commit move is deferred (DECISIONS 2026-06-13)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.encounterKind = "hostile";
    const p = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    expect(state.currentEncounter!.playerLocationCleared["L0"]).toBe(false);

    const result = runEndOfCleanupChecks(state);

    expect(state.currentEncounter!.playerLocationCleared["L0"]).toBe(true);
    expect(result.newlyClearedLocs).toEqual(["L0"]);
    // The check no longer moves commits — the orchestrator cascades them to discard. The
    // player creature is still in its slot at this point.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(p.instId);

    // The deferred move, when applied, sends it to discard (not the deck).
    discardClearedLocationCommits(state, "L0");
    expect(state.currentEncounter!.playerSide.discard).toContain(p.instId);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
  });

  it("does NOT set flag if AI still has presence at this loc", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.encounterKind = "hostile";
    const ai = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], ai, false);

    const result = runEndOfCleanupChecks(state);

    expect(state.currentEncounter!.playerLocationCleared["L0"]).toBe(false);
    expect(result.newlyClearedLocs).toEqual([]);
  });

  it("doesn't re-shuffle locs that were already cleared in a prior turn", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.encounterKind = "hostile";
    state.currentEncounter!.playerLocationCleared["L0"] = true; // already cleared
    const p = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);

    const result = runEndOfCleanupChecks(state);

    expect(result.newlyClearedLocs).toEqual([]);
    // Player creature stays (not re-reclaimed).
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(p.instId);
  });
});

describe("runEndOfCleanupChecks — outcome resolution", () => {
  it("outcome=playerCleared when every non-boss loc has its clear flag set", () => {
    const state = makeMultiLocationState(["L0", "L1"]);
    state.currentEncounter!.encounterKind = "hostile";
    // Both locs are empty of AI from setup (makeMultiLocationState).
    const result = runEndOfCleanupChecks(state);
    expect(result.outcome).toBe("playerCleared");
    expect(state.currentEncounter!.outcome).toBe("playerCleared");
  });

  it("outcome=playerCleared when a hostile encounter has no AI creatures anywhere", () => {
    // With no AI forces present, every non-summoner location is clear → playerCleared. (Summoner
    // retreat is no longer an outcome; it's a state change that doesn't end the encounter.)
    const state = makeMultiLocationState(["L0", "L1"]);
    state.currentEncounter!.encounterKind = "hostile";
    const result = runEndOfCleanupChecks(state);
    expect(result.outcome).toBe("playerCleared");
  });

  it("outcome=null when any AI-origin creature still alive at any contested loc", () => {
    registerCreatureDef("c");
    const state = makeMultiLocationState(["L0", "L1"]);
    state.currentEncounter!.encounterKind = "hostile";
    // aiDeck-origin creature establishes AI presence at L1.
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L1", "creature", ["r0c0"], a, false);

    const result = runEndOfCleanupChecks(state);
    expect(result.outcome).toBeNull();
    // L0 cleared, L1 not.
    expect(state.currentEncounter!.playerLocationCleared["L0"]).toBe(true);
    expect(state.currentEncounter!.playerLocationCleared["L1"]).toBe(false);
  });

  it("biome creature holding a location keeps the encounter going (CORRECTED 2026-06-12)", () => {
    // Neutral encounters don't end early. A remaining neutral/biome creature is the player's
    // puzzle: it blocks clearing AND must keep the encounter going even with zero AI-origin
    // presence anywhere. (Summoner presence never gated encounter end; the retreat-as-outcome
    // bug that this guarded against was removed entirely 2026-06-13.)
    registerCreatureDef("c");
    const state = makeMultiLocationState(["L0", "L1"]);
    state.currentEncounter!.encounterKind = "hostile";
    const a = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L1", "creature", ["r0c0"], a, false);

    const result = runEndOfCleanupChecks(state);
    // L0 cleared by player, L1 blocked by biome creature (uncleared).
    expect(state.currentEncounter!.playerLocationCleared["L0"]).toBe(true);
    expect(state.currentEncounter!.playerLocationCleared["L1"]).toBe(false);
    // Encounter continues — outcome stays null.
    expect(result.outcome).toBeNull();
  });
});

describe("runPerDamageWinChecks", () => {
  it("returns playerLost when player Durability hits 0", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.playerSide.durability = 0;
    expect(runPerDamageWinChecks(state)).toBe("playerLost");
    expect(state.currentEncounter!.outcome).toBe("playerLost");
  });

  it("returns null when player Durability is positive", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.playerSide.durability = 5;
    expect(runPerDamageWinChecks(state)).toBeNull();
  });

  it("returns null when no encounter is active", () => {
    const state = makeSingleLocationState();
    state.currentEncounter = null;
    expect(runPerDamageWinChecks(state)).toBeNull();
  });

  it("returns summonerDefeated when an enemy summoner's Durability hits 0 (DECISIONS 2026-06-13)", () => {
    const state = makeSingleLocationState();
    // Summoner present anywhere → aiSide exists with run-scoped Durability.
    state.currentEncounter!.aiSide = freshSideState();
    state.currentEncounter!.aiSide!.durability = 0;
    expect(runPerDamageWinChecks(state)).toBe("summonerDefeated");
    expect(state.currentEncounter!.outcome).toBe("summonerDefeated");
  });

  it("does NOT fire summonerDefeated while the summoner has Durability left", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.aiSide = freshSideState();
    state.currentEncounter!.aiSide!.durability = 3;
    expect(runPerDamageWinChecks(state)).toBeNull();
  });

  it("no summoner present (aiSide null) → no summonerDefeated regardless", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.aiSide = null;
    expect(runPerDamageWinChecks(state)).toBeNull();
  });
});
