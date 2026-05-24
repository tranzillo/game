import { describe, it, expect, beforeEach } from "vitest";
import { canPay, effectiveCosts, legalTargetsForCard, slotOccupied } from "../src/engine/core.js";
import { state } from "../src/engine/state.js";
import { makeTestState, placeForTest, spawn } from "./helpers.js";

describe("cost checking", () => {
  beforeEach(() => {
    makeTestState({ locCount: 1 });
  });

  it("canPay returns true when the location has enough committed Force", () => {
    const banner = spawn("r14", "player");
    placeForTest(state, "player", 0, "fl", banner);

    const recruit = spawn("r4", "player");
    expect(canPay("player", 0, recruit)).toBe(true);
  });

  it("canPay returns false when the location has zero presence", () => {
    const bruiser = spawn("r3", "player");
    expect(canPay("player", 0, bruiser)).toBe(false);
  });

  it("effectiveCosts returns base costs when no escalating-cast counter is set", () => {
    const spark = spawn("b4", "player");
    expect(effectiveCosts(spark)).toEqual({ insight: 1 });
  });

  it("effectiveCosts escalates Forage cost by past casts on the same instance", () => {
    const forage = spawn("g6", "player");
    forage.forageCasts = 2;
    expect(effectiveCosts(forage).tempo).toBe(2);
  });

  it("effectiveCosts escalates Mirror Image cost by past casts on the same instance", () => {
    const mirror = spawn("b7", "player");
    mirror.mirrorCasts = 3;
    expect(effectiveCosts(mirror).insight).toBe(3);
  });
});

describe("placement legality", () => {
  beforeEach(() => {
    makeTestState({ locCount: 2 });
  });

  it("creatures have 4 legal positions on an empty side", () => {
    const goblin = spawn("r1", "player");
    const targets = legalTargetsForCard("player", 0, goblin);
    expect(targets).toHaveLength(4);
    expect(targets.map(t => t.pos).sort()).toEqual(["bl", "br", "fl", "fr"]);
  });

  it("creature slots fill from front to back; occupied positions are excluded", () => {
    const goblin = spawn("r1", "player");
    placeForTest(state, "player", 0, "fl", goblin);
    placeForTest(state, "player", 0, "fr", spawn("r1", "player"));

    const more = spawn("r1", "player");
    const targets = legalTargetsForCard("player", 0, more);
    expect(targets.map(t => t.pos).sort()).toEqual(["bl", "br"]);
  });

  it("structure slot is occupied after a structure is placed", () => {
    placeForTest(state, "player", 0, "structure", spawn("r14", "player"));
    expect(slotOccupied("player", 0, "structure")).toBe(true);
  });

  it("action slot blocks a second action at the same location", () => {
    placeForTest(state, "player", 0, "action", spawn("r4", "player"));
    const recruit = spawn("r4", "player");
    expect(legalTargetsForCard("player", 0, recruit)).toEqual([]);
  });
});
