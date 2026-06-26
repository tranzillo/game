import { describe, it, expect, beforeEach } from "vitest";
import {
  attachEquipment,
  detachEquipment,
  getActiveSetOverride,
} from "../src/engine/equipment.ts";
import { effectiveStat } from "../src/engine/stats.ts";
import { effectiveAttackPatterns } from "../src/engine/attack-patterns.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import { registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("attachEquipment", () => {
  it("links equipment to host", () => {
    registerCreatureDef("c");
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    attachEquipment(state, eq, host);
    expect(host.equipment).toContain(eq.instId);
    expect(eq.attachedTo).toBe(host.instId);
  });

  it("throws on double-attach", () => {
    registerCreatureDef("c");
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    attachEquipment(state, eq, host);
    expect(() => attachEquipment(state, eq, host)).toThrow();
  });

  it("add-grants apply as equipped-scope buffs", () => {
    registerCreatureDef("c", { force: 1 });
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 2, kind: "add" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    attachEquipment(state, eq, host);
    expect(host.buffs.length).toBe(1);
    expect(host.buffs[0]).toMatchObject({
      stat: "force",
      amount: 2,
      scope: "equipped",
      sourceInstId: eq.instId,
    });
  });

  it("set-grants populate grantedSetOverrides", () => {
    registerCreatureDef("c", { force: 5 });
    registerCardDef({
      defKey: "bow",
      name: "Bow",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 1, kind: "set" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const bow = getCard(state.cards, spawn(state, "bow"));
    attachEquipment(state, bow, host);
    expect(getActiveSetOverride(host, "force")).toEqual({
      stat: "force",
      amount: 1,
      sourceInstId: bow.instId,
    });
  });

  it("grants attack patterns onto host's grantedPatterns", () => {
    registerCreatureDef("c");
    registerCardDef({
      defKey: "axe",
      name: "Axe",
      type: "equipment",
      text: "",
      costs: [],
      grantsAttackPatterns: [{ kind: "cleave", value: 1 }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const axe = getCard(state.cards, spawn(state, "axe"));
    attachEquipment(state, axe, host);
    const patterns = effectiveAttackPatterns(host);
    expect(patterns).toContainEqual({ kind: "cleave", value: 1 });
  });
});

describe("detachEquipment", () => {
  it("removes the equipment from host.equipment", () => {
    registerCreatureDef("c");
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    attachEquipment(state, eq, host);
    detachEquipment(state.cards, eq);
    expect(host.equipment).not.toContain(eq.instId);
    expect(eq.attachedTo).toBeUndefined();
  });

  it("sweeps equipped-scope buffs sourced from the equipment", () => {
    registerCreatureDef("c", { force: 1 });
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 2, kind: "add" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    attachEquipment(state, eq, host);
    expect(effectiveStat(state, host, "player", "L0", "force")).toBe(3);
    detachEquipment(state.cards, eq);
    expect(effectiveStat(state, host, "player", "L0", "force")).toBe(1);
    expect(host.buffs.length).toBe(0);
  });

  it("removes set-overrides sourced from the equipment", () => {
    registerCreatureDef("c", { force: 5 });
    registerCardDef({
      defKey: "bow",
      name: "Bow",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 1, kind: "set" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const bow = getCard(state.cards, spawn(state, "bow"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    attachEquipment(state, bow, host);
    expect(effectiveStat(state, host, "player", "L0", "force")).toBe(1);
    detachEquipment(state.cards, bow);
    expect(effectiveStat(state, host, "player", "L0", "force")).toBe(5);
    expect(getActiveSetOverride(host, "force")).toBeNull();
  });

  it("removes granted attack patterns", () => {
    registerCreatureDef("c");
    registerCardDef({
      defKey: "axe",
      name: "Axe",
      type: "equipment",
      text: "",
      costs: [],
      grantsAttackPatterns: [{ kind: "cleave", value: 1 }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const axe = getCard(state.cards, spawn(state, "axe"));
    attachEquipment(state, axe, host);
    detachEquipment(state.cards, axe);
    expect(effectiveAttackPatterns(host)).not.toContainEqual({ kind: "cleave", value: 1 });
  });
});
