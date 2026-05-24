import { describe, it, expect, beforeEach } from "vitest";
import { computeCombatOrder } from "../src/engine/core.js";
import { state } from "../src/engine/state.js";
import { makeTestState, placeForTest, spawn } from "./helpers.js";

describe("computeCombatOrder", () => {
  beforeEach(() => {
    makeTestState({ locCount: 1 });
    state.phase = "combat";
  });

  it("returns no attackers when both sides are empty", () => {
    expect(computeCombatOrder(0)).toEqual([]);
  });

  it("excludes back-row non-ranged creatures (melee is front-row only)", () => {
    placeForTest(state, "player", 0, "bl", spawn("r3", "player")); // 2 Force back row
    const order = computeCombatOrder(0);
    expect(order).toEqual([]);
  });

  it("includes ranged creatures from the back row when they have ammo", () => {
    const slinger = spawn("g4", "player");
    placeForTest(state, "player", 0, "bl", slinger);
    state.sides.player.locations[0].ammo = 1;
    const order = computeCombatOrder(0);
    expect(order).toHaveLength(1);
    expect(order[0].creature).toBe(slinger);
  });

  it("excludes ranged creatures from back row when ammo is zero", () => {
    placeForTest(state, "player", 0, "bl", spawn("g4", "player"));
    state.sides.player.locations[0].ammo = 0;
    expect(computeCombatOrder(0)).toEqual([]);
  });

  it("excludes creatures with zero effective Force", () => {
    // r14 is a structure (1 Force), not a creature, so use one that has 0 Force naturally:
    // r1 has 1 Force — use a creature with grantUntilEndOfTurn-style negative? Simpler: use
    // a creature whose Force is 0. b_water_golem has 1 Force. b1 has 0. b1 is a creature.
    const apprentice = spawn("b1", "player");
    placeForTest(state, "player", 0, "fl", apprentice);
    // No actions resolved this turn, so apprenticeInsightFromActions adds 0. Force is 0.
    expect(apprentice.force).toBe(0);
    expect(computeCombatOrder(0)).toEqual([]);
  });

  it("excludes sleeping creatures", () => {
    const c = spawn("r3", "player"); // 2 Force
    c.sleepCounter = 1;
    placeForTest(state, "player", 0, "fl", c);
    expect(computeCombatOrder(0)).toEqual([]);
  });

  it("excludes creatures that woke this phase", () => {
    const c = spawn("r3", "player");
    c.wokeInPhase = "combat";
    placeForTest(state, "player", 0, "fl", c);
    expect(computeCombatOrder(0)).toEqual([]);
  });

  it("excludes creatures with skipAttackThisTurn (Blizzard)", () => {
    const c = spawn("r3", "player");
    c.skipAttackThisTurn = true;
    placeForTest(state, "player", 0, "fl", c);
    expect(computeCombatOrder(0)).toEqual([]);
  });

  it("orders attackers by Tempo descending", () => {
    const slowHigh = spawn("r3", "player"); // 2 Force, 0 Tempo
    const fastLow = spawn("g4", "player");  // 1 Force, 1 Tempo
    placeForTest(state, "player", 0, "fl", slowHigh);
    placeForTest(state, "player", 0, "fr", fastLow);
    state.sides.player.locations[0].ammo = 1; // give slinger ammo

    const order = computeCombatOrder(0);
    expect(order).toHaveLength(2);
    expect(order[0].creature).toBe(fastLow);   // higher Tempo first
    expect(order[1].creature).toBe(slowHigh);
  });

  it("on Tempo tie, the side with more local Tempo goes first", () => {
    const p = spawn("r3", "player"); // 2F/0T
    const a = spawn("r3", "ai");     // 2F/0T
    placeForTest(state, "player", 0, "fl", p);
    placeForTest(state, "ai", 0, "fl", a);

    // Both 0 tempo. Tie breaks on firstSide.
    state.firstSide = "ai";
    const order = computeCombatOrder(0);
    expect(order[0].creature).toBe(a);
    expect(order[1].creature).toBe(p);
  });
});
