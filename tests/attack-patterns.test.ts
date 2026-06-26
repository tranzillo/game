import { describe, it, expect, beforeEach } from "vitest";
import {
  effectiveAttackPatterns,
  hasMeleePattern,
  hasRangedPattern,
  rangedAmmoCost,
} from "../src/engine/attack-patterns.ts";
import { attachEquipment } from "../src/engine/equipment.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("effectiveAttackPatterns", () => {
  it("returns own attack patterns from def", () => {
    registerCreatureDef("m", { attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "m"));
    expect(effectiveAttackPatterns(card)).toEqual([{ kind: "default" }]);
  });

  it("appends granted patterns from attached equipment", () => {
    registerCreatureDef("m", { attackPatterns: [{ kind: "default" }] });
    registerCardDef({
      defKey: "axe",
      name: "Axe",
      type: "equipment",
      text: "",
      costs: [],
      grantsAttackPatterns: [{ kind: "cleave", value: 1 }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "m"));
    const axe = getCard(state.cards, spawn(state, "axe"));
    attachEquipment(state, axe, host);
    const patterns = effectiveAttackPatterns(host);
    expect(patterns).toContainEqual({ kind: "default" });
    expect(patterns).toContainEqual({ kind: "cleave", value: 1 });
  });
});

describe("hasMeleePattern / hasRangedPattern / rangedAmmoCost", () => {
  it("default-pattern card has melee, no ranged", () => {
    registerCreatureDef("m", { attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "m"));
    expect(hasMeleePattern(card)).toBe(true);
    expect(hasRangedPattern(card)).toBe(false);
    expect(rangedAmmoCost(card)).toBe(0);
  });

  it("ranged-only card has ranged, no melee", () => {
    registerCreatureDef("r", { attackPatterns: [{ kind: "ranged", ammoCost: 2 }] });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "r"));
    expect(hasMeleePattern(card)).toBe(false);
    expect(hasRangedPattern(card)).toBe(true);
    expect(rangedAmmoCost(card)).toBe(2);
  });

  it("a card with both ranged + melee patterns has both", () => {
    registerCreatureDef("dual", {
      attackPatterns: [
        { kind: "default" },
        { kind: "ranged", ammoCost: 1 },
      ],
    });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "dual"));
    expect(hasMeleePattern(card)).toBe(true);
    expect(hasRangedPattern(card)).toBe(true);
    expect(rangedAmmoCost(card)).toBe(1);
  });

  it("rangedAmmoCost defaults to 1 if pattern omits it", () => {
    registerCreatureDef("r", { attackPatterns: [{ kind: "ranged" }] });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "r"));
    expect(rangedAmmoCost(card)).toBe(1);
  });
});
