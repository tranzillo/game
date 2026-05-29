import { describe, it, expect, beforeEach } from "vitest";
import {
  locationStatTotal,
  globalStatTotal,
  pendingStatTotal,
} from "../src/engine/location-totals.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  makeMultiLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("locationStatTotal — Force (combat-eligibility filter)", () => {
  it("front-row melee creature contributes", () => {
    registerCreatureDef("m", { force: 2, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(locationStatTotal(state, "player", "L0", "force")).toBe(2);
  });

  it("back-row melee creature contributes 0 (not combat-eligible)", () => {
    registerCreatureDef("m", { force: 2, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], card, false);
    expect(locationStatTotal(state, "player", "L0", "force")).toBe(0);
  });

  it("face-down creature doesn't contribute even if combat-eligible by position", () => {
    registerCreatureDef("m", { force: 2, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    card.revealed = false;
    expect(locationStatTotal(state, "player", "L0", "force")).toBe(0);
  });

  it("ranged back-row with ammo contributes", () => {
    registerCreatureDef("r", { force: 1, attackPatterns: [{ kind: "ranged" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    state.world.nodeState["L0"]!.ammo.player = 1;
    const card = getCard(state.cards, spawn(state, "r"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], card, false);
    expect(locationStatTotal(state, "player", "L0", "force")).toBe(1);
  });
});

describe("locationStatTotal — other stats (no eligibility filter)", () => {
  it("sums Tempo from all face-up creatures", () => {
    registerCreatureDef("c", { tempo: 1, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L0", "creature", ["r1c0"], b, false);
    expect(locationStatTotal(state, "player", "L0", "tempo")).toBe(2);
  });

  it("face-down creatures don't contribute to Tempo", () => {
    registerCreatureDef("c", { tempo: 1, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    a.revealed = false;
    expect(locationStatTotal(state, "player", "L0", "tempo")).toBe(0);
  });

  it("Resolve returns 0 (not a per-location stat)", () => {
    registerCreatureDef("c", { resolve: 3 });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    expect(locationStatTotal(state, "player", "L0", "resolve")).toBe(0);
  });
});

describe("locationStatTotal — multi-slot dedup", () => {
  it("a 2-slot creature contributes its effective force ONCE", () => {
    registerCreatureDef("big", {
      force: 3,
      attackPatterns: [{ kind: "default" }],
      footprint: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
    });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "big"));
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], card, false);
    expect(locationStatTotal(state, "player", "L0", "force")).toBe(3);
  });
});

describe("globalStatTotal", () => {
  it("sums Insight across all encounter locations", () => {
    registerCreatureDef("c", { insight: 1 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L1", "creature", ["r0c0"], b, false);
    expect(globalStatTotal(state, "player", "insight")).toBe(2);
  });

  it("Resolve global sums across all locations even though per-loc returns 0", () => {
    registerCreatureDef("c", { resolve: 1 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L1", "creature", ["r0c0"], b, false);
    expect(globalStatTotal(state, "player", "resolve")).toBe(2);
  });
});

describe("pendingStatTotal", () => {
  it("adds pending creatures' stats to the committed total", () => {
    registerCreatureDef("c", { force: 2, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const committed = getCard(state.cards, spawn(state, "c"));
    const pending = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], committed, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], pending, true);
    expect(locationStatTotal(state, "player", "L0", "force")).toBe(2);
    expect(pendingStatTotal(state, "player", "L0", "force")).toBe(4);
  });
});
