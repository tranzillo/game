import { describe, it, expect, beforeEach } from "vitest";
import {
  retreatDamageCap,
  recordSummonerDamage,
  shouldRetreatAtEndOfTurn,
  executeRetreat,
  canRetreat,
} from "../src/engine/retreat.ts";
import { freshSideState } from "../src/engine/state.ts";
import { getCard } from "../src/engine/cards.ts";
import { placeAt } from "../src/engine/slots.ts";
import { resetEngine, registerCreatureDef, makeSingleLocationState, spawn } from "./helpers.ts";

beforeEach(resetEngine);

function withSummoner(encounterNo = 1) {
  const state = makeSingleLocationState();
  state.currentEncounter!.aiSide = freshSideState();
  state.currentEncounter!.encounterNo = encounterNo;
  // Give L0 an onward, unvisited neighbor so the summoner has somewhere to flee — i.e. NOT a
  // cornering encounter. (A node with no onward travel reads as cornered → retreat blocked.)
  state.world.nodes.push({ id: "ONWARD", x: 0, y: 1, kind: "neutral", label: "ONWARD", status: "unvisited" });
  state.world.edges.push(["L0", "ONWARD"]);
  state.world.pawnAt = "START_NODE"; // pawn isn't L0 (L0 is an encounter location, not the stand)
  return state;
}

describe("retreatDamageCap", () => {
  it("is low early and scales up with encounter depth", () => {
    const e1 = withSummoner(1);
    const e3 = withSummoner(3);
    expect(retreatDamageCap(e3)).toBeGreaterThan(retreatDamageCap(e1));
  });
});

describe("recordSummonerDamage", () => {
  it("accumulates summoner damage this encounter and reports crossing the cap", () => {
    const state = withSummoner(1); // cap = base (2)
    expect(recordSummonerDamage(state, 1)).toBe(false); // 1 <= 2
    expect(state.currentEncounter!.summonerDamageThisEncounter).toBe(1);
    expect(recordSummonerDamage(state, 2)).toBe(true); // 3 > 2
    expect(state.currentEncounter!.summonerDamageThisEncounter).toBe(3);
  });

  it("ignores non-positive amounts", () => {
    const state = withSummoner(1);
    expect(recordSummonerDamage(state, 0)).toBe(false);
    expect(state.currentEncounter!.summonerDamageThisEncounter).toBe(0);
  });
});

describe("shouldRetreatAtEndOfTurn", () => {
  it("false with no damage taken", () => {
    const state = withSummoner(1);
    expect(shouldRetreatAtEndOfTurn(state)).toBe(false);
  });

  it("true once cumulative damage exceeds the tier cap (instant cap trigger)", () => {
    const state = withSummoner(1); // cap 2
    recordSummonerDamage(state, 3);
    expect(shouldRetreatAtEndOfTurn(state)).toBe(true);
  });

  it("true when exposed (took damage, no AI presence left) even under the cap", () => {
    const state = withSummoner(1);
    recordSummonerDamage(state, 1); // under cap, but...
    // No AI-origin creatures anywhere → exposed.
    expect(shouldRetreatAtEndOfTurn(state)).toBe(true);
  });

  it("false when not exposed and under the cap", () => {
    registerCreatureDef("c");
    const state = withSummoner(1);
    const guard = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], guard, false);
    guard.revealed = true; // present (face-up AI creature blocks)
    recordSummonerDamage(state, 1); // under cap
    expect(shouldRetreatAtEndOfTurn(state)).toBe(false);
  });

  it("false once already retreated", () => {
    const state = withSummoner(1);
    recordSummonerDamage(state, 5);
    state.currentEncounter!.summonerRetreated = true;
    expect(shouldRetreatAtEndOfTurn(state)).toBe(false);
  });
});

describe("executeRetreat", () => {
  it("withdraws AI-origin forces back to the AI deck and flags retreated", () => {
    registerCreatureDef("c");
    const state = withSummoner(1);
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);
    a.revealed = true;

    const withdrawn = executeRetreat(state);
    expect(withdrawn).toContain(a.instId);
    expect(state.currentEncounter!.summonerRetreated).toBe(true);
    // Card is off the board and back in the AI deck.
    expect(state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]).toBeNull();
    expect(state.currentEncounter!.aiSide!.deck).toContain(a.instId);
    expect(a.slots).toEqual([]);
  });

  it("does NOT withdraw biome/neutral content (not the summoner's force)", () => {
    registerCreatureDef("c");
    const state = withSummoner(1);
    const biome = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], biome, false);
    biome.revealed = true;

    const withdrawn = executeRetreat(state);
    expect(withdrawn).not.toContain(biome.instId);
    // Biome creature stays on the board (it's the player's puzzle).
    expect(state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]).toBe(biome.instId);
  });

  it("is idempotent — a second call after retreat does nothing", () => {
    registerCreatureDef("c");
    const state = withSummoner(1);
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);
    executeRetreat(state);
    expect(executeRetreat(state)).toEqual([]);
  });
});

describe("canRetreat / isCorneringEncounter", () => {
  it("allowed when an encounter location has an onward unvisited neighbor", () => {
    const state = withSummoner(1); // L0 → ONWARD (unvisited)
    expect(canRetreat(state)).toBe(true);
  });

  it("blocked at the map's end — a location with no onward travel corners the summoner", () => {
    const state = makeSingleLocationState(); // L0 isolated, no onward edges
    state.currentEncounter!.aiSide = freshSideState();
    expect(canRetreat(state)).toBe(false);
  });

  it("blocked at an `end` (terminal) location regardless of edges", () => {
    const state = withSummoner(1);
    state.world.nodes.find((n) => n.id === "L0")!.kind = "end";
    expect(canRetreat(state)).toBe(false);
  });

  it("a cornered summoner does NOT retreat even over the cap (must be defeated)", () => {
    const state = makeSingleLocationState(); // cornered (no onward travel)
    state.currentEncounter!.aiSide = freshSideState();
    recordSummonerDamage(state, 99);
    expect(shouldRetreatAtEndOfTurn(state)).toBe(false);
  });
});
