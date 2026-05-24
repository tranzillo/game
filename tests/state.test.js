import { describe, it, expect, beforeEach } from "vitest";
import { createCard, freshLocation, L } from "../src/engine/state.js";
import { CARD_DEFS } from "../src/data/cards.js";
import { state } from "../src/engine/state.js";
import { makeTestState, spawn } from "./helpers.js";

describe("createCard", () => {
  it("returns an object with a unique instId per call", () => {
    const a = createCard("r1", "player");
    const b = createCard("r1", "player");
    expect(a.instId).not.toBe(b.instId);
  });

  it("copies printed stats from CARD_DEFS", () => {
    const c = createCard("r3", "player");
    expect(c.name).toBe(CARD_DEFS.r3.name);
    expect(c.force).toBe(2);
    expect(c.durability).toBe(3);
    expect(c.durabilityMax).toBe(3);
  });

  it("creates default empty arrays/sets for mutable fields", () => {
    const c = createCard("r1", "player");
    expect(c.marks).toEqual([]);
    expect(c.equipment).toEqual([]);
    expect(c.meleeAttackersThisTurn).toEqual([]);
    expect(c.attackPatterns).toEqual([]);
  });

  it("starts revealed = true by default", () => {
    const c = createCard("r1", "player");
    expect(c.revealed).toBe(true);
  });

  it("normalizes legacy single-stat cost into the costs map", () => {
    const c = createCard("r3", "player");
    // r3 has cost: 1, costStat: "force"
    expect(c.costs).toEqual({ force: 1 });
  });

  it("preserves compound costs as-is", () => {
    const c = createCard("g5", "player");
    expect(c.costs).toEqual({ force: 2, tempo: 1 });
  });

  it("zero-cost cards have an empty costs object", () => {
    const c = createCard("r1", "player");
    expect(c.costs).toEqual({});
  });
});

describe("freshLocation", () => {
  it("returns four empty creature slots and empty structure/action", () => {
    const lc = freshLocation();
    expect(lc.creatures).toEqual({ fl: null, fr: null, bl: null, br: null });
    expect(lc.structure).toBeNull();
    expect(lc.action).toBeNull();
  });

  it("includes pending state with the same slot shape", () => {
    const lc = freshLocation();
    expect(lc.pending.creatures).toEqual({ fl: null, fr: null, bl: null, br: null });
    expect(lc.pending.equipment).toEqual({ fl: [], fr: [], bl: [], br: [] });
  });

  it("ammo starts at 0", () => {
    const lc = freshLocation();
    expect(lc.ammo).toBe(0);
  });
});

describe("L() — location accessor", () => {
  beforeEach(() => {
    makeTestState({ locCount: 2 });
  });

  it("returns distinct location objects per (side, loc)", () => {
    const a = L("player", 0);
    const b = L("player", 1);
    expect(a).not.toBe(b);
  });

  it("returns the same object across calls — mutations are visible", () => {
    const a = L("player", 0);
    a.ammo = 5;
    expect(L("player", 0).ammo).toBe(5);
  });
});
