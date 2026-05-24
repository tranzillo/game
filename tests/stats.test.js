import { describe, it, expect, beforeEach } from "vitest";
import { effectiveStat, committedStatTotal, globalStatTotal, other } from "../src/engine/stats.js";
import { state } from "../src/engine/state.js";
import { makeTestState, placeForTest, spawn } from "./helpers.js";

describe("other()", () => {
  it("returns the opposing side", () => {
    expect(other("player")).toBe("ai");
    expect(other("ai")).toBe("player");
  });
});

describe("effectiveStat — conditional buffs", () => {
  beforeEach(() => {
    makeTestState({ locCount: 1 });
  });

  it("Pit-Fighter gains +2 Force while alone on your side", () => {
    const pit = spawn("r5", "player");
    placeForTest(state, "player", 0, "fl", pit);
    expect(effectiveStat(pit, "player", 0, "force")).toBe(3); // base 1 + 2 alone
  });

  it("Pit-Fighter loses the alone-bonus when a second friendly is here", () => {
    const pit = spawn("r5", "player");
    const buddy = spawn("r1", "player");
    placeForTest(state, "player", 0, "fl", pit);
    placeForTest(state, "player", 0, "fr", buddy);
    expect(effectiveStat(pit, "player", 0, "force")).toBe(1); // base only
  });

  it("Challenger gains +1 Force per opposing creature here", () => {
    const challenger = spawn("r9", "player");
    placeForTest(state, "player", 0, "fl", challenger);
    placeForTest(state, "ai", 0, "fl", spawn("r1", "ai"));
    placeForTest(state, "ai", 0, "fr", spawn("r1", "ai"));
    // base 1 + 2 (opposing creatures)
    expect(effectiveStat(challenger, "player", 0, "force")).toBe(3);
  });

  it("creatures opposing a Challenger gain +1 Force from the reverse-buff", () => {
    const challenger = spawn("r9", "ai");
    const goblin = spawn("r1", "player");
    placeForTest(state, "ai", 0, "fl", challenger);
    placeForTest(state, "player", 0, "fl", goblin);
    // base 1 + 1 (one opposing Challenger)
    expect(effectiveStat(goblin, "player", 0, "force")).toBe(2);
  });
});

describe("face-down cards have no stat presence", () => {
  beforeEach(() => {
    makeTestState({ locCount: 1 });
  });

  it("committedStatTotal excludes face-down creatures", () => {
    const banner = spawn("r14", "player");
    placeForTest(state, "player", 0, "structure", banner, { revealed: false });
    expect(committedStatTotal("player", 0, "force")).toBe(0);
  });

  it("committedStatTotal includes face-up creatures", () => {
    const banner = spawn("r14", "player");
    placeForTest(state, "player", 0, "structure", banner, { revealed: true });
    expect(committedStatTotal("player", 0, "force")).toBe(1);
  });
});

describe("Force is front-row-only at a location", () => {
  beforeEach(() => {
    makeTestState({ locCount: 1 });
  });

  it("back-row creatures do not contribute Force at the location", () => {
    placeForTest(state, "player", 0, "bl", spawn("r3", "player")); // 2 Force back row
    expect(committedStatTotal("player", 0, "force")).toBe(0);
  });

  it("front-row creatures contribute Force", () => {
    placeForTest(state, "player", 0, "fl", spawn("r3", "player")); // 2 Force front row
    expect(committedStatTotal("player", 0, "force")).toBe(2);
  });
});

describe("globalStatTotal sums across all locations", () => {
  beforeEach(() => {
    makeTestState({ locCount: 2 });
  });

  it("adds Force across both locations", () => {
    placeForTest(state, "player", 0, "fl", spawn("r3", "player")); // 2
    placeForTest(state, "player", 1, "fl", spawn("r5", "player")); // 1 + 2 alone-bonus = 3
    expect(globalStatTotal("player", "force")).toBe(5);
  });
});
