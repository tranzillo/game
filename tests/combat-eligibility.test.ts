import { describe, it, expect, beforeEach } from "vitest";
import { combatEligible } from "../src/engine/combat-eligibility.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import { applyBuff } from "../src/engine/buffs.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

const meleeDef = (over: Partial<{ force: number; durability: number }> = {}) => ({
  force: over.force ?? 1,
  durability: over.durability ?? 2,
  attackPatterns: [{ kind: "default" }],
});

const rangedDef = (over: Partial<{ force: number; ammoCost: number }> = {}) => ({
  force: over.force ?? 1,
  attackPatterns: [{ kind: "ranged", ammoCost: over.ammoCost ?? 1 }],
});

describe("combatEligible", () => {
  it("face-up melee creature in front row is eligible", () => {
    registerCreatureDef("m", meleeDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(combatEligible(state, card, "player", "L0")).toBe(true);
  });

  it("face-down creature is not eligible", () => {
    registerCreatureDef("m", meleeDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    card.revealed = false;
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
  });

  it("sleeping creature is not eligible", () => {
    registerCreatureDef("m", meleeDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    card.sleepCounter = 1;
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
  });

  it("just-woke creature is not eligible this phase", () => {
    registerCreatureDef("m", meleeDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    card.wokeInPhase = "combat";
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
  });

  it("creature with 0 effective Force is not eligible", () => {
    registerCreatureDef("m", { ...meleeDef(), force: 0 });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
  });

  it("skipAttackThisTurn makes a creature ineligible", () => {
    registerCreatureDef("m", meleeDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    card.skipAttackThisTurn = true;
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
  });

  it("melee creature in back row is NOT eligible", () => {
    registerCreatureDef("m", meleeDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], card, false);
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
  });

  it("ranged creature in back row with ammo IS eligible", () => {
    registerCreatureDef("r", rangedDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    state.world.nodeState["L0"]!.ammo.player = 1;
    const card = getCard(state.cards, spawn(state, "r"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], card, false);
    expect(combatEligible(state, card, "player", "L0")).toBe(true);
  });

  it("ranged creature in back row WITHOUT ammo is NOT eligible", () => {
    registerCreatureDef("r", rangedDef());
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    state.world.nodeState["L0"]!.ammo.player = 0;
    const card = getCard(state.cards, spawn(state, "r"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], card, false);
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
  });

  it("buffs are reflected in the eligibility Force check", () => {
    registerCreatureDef("m", { ...meleeDef(), force: 0 });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "m"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(combatEligible(state, card, "player", "L0")).toBe(false);
    applyBuff(state, card, { stat: "force", amount: 2, scope: "turn" });
    expect(combatEligible(state, card, "player", "L0")).toBe(true);
  });
});
