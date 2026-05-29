import { describe, it, expect, beforeEach } from "vitest";
import { effectiveStat, other } from "../src/engine/stats.ts";
import { applyBuff } from "../src/engine/buffs.ts";
import { attachEquipment } from "../src/engine/equipment.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  registerActionDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";
import { registerCardDef } from "../src/engine/cards.ts";

beforeEach(resetEngine);

describe("other", () => {
  it("flips sides", () => {
    expect(other("player")).toBe("ai");
    expect(other("ai")).toBe("player");
  });
});

describe("effectiveStat — base reads", () => {
  it("returns printed force for a creature with no buffs", () => {
    registerCreatureDef("c", { force: 3 });
    const state = makeSingleLocationState();
    const id = spawn(state, "c");
    const card = getCard(state.cards, id);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(3);
  });

  it("returns 0 for missing printed stats", () => {
    registerCreatureDef("c", { force: 2 });
    const state = makeSingleLocationState();
    const id = spawn(state, "c");
    const card = getCard(state.cards, id);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(effectiveStat(state, card, "player", "L0", "tempo")).toBe(0);
    expect(effectiveStat(state, card, "player", "L0", "insight")).toBe(0);
    expect(effectiveStat(state, card, "player", "L0", "spite")).toBe(0);
  });

  it("returns 0 for non-creature card types", () => {
    registerStructureDef("s");
    registerActionDef("a");
    const state = makeSingleLocationState();
    const sId = spawn(state, "s");
    const aId = spawn(state, "a");
    expect(effectiveStat(state, getCard(state.cards, sId), "player", "L0", "force")).toBe(0);
    expect(effectiveStat(state, getCard(state.cards, aId), "player", "L0", "force")).toBe(0);
  });
});

describe("effectiveStat — Inert", () => {
  it("Inert creature has 0 Force regardless of printed value", () => {
    registerCreatureDef("inert", { force: 5, inert: true });
    const state = makeSingleLocationState();
    const id = spawn(state, "inert");
    const card = getCard(state.cards, id);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(0);
  });

  it("Inert blocks all five stats", () => {
    registerCreatureDef("inert", {
      force: 5,
      tempo: 5,
      insight: 5,
      resolve: 5,
      spite: 5,
      inert: true,
    });
    const state = makeSingleLocationState();
    const id = spawn(state, "inert");
    const card = getCard(state.cards, id);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    for (const stat of ["force", "tempo", "insight", "resolve", "spite"] as const) {
      expect(effectiveStat(state, card, "player", "L0", stat)).toBe(0);
    }
  });

  it("Inert doesn't gain from buffs", () => {
    registerCreatureDef("inert", { force: 0, inert: true });
    const state = makeSingleLocationState();
    const id = spawn(state, "inert");
    const card = getCard(state.cards, id);
    applyBuff(card, { stat: "force", amount: 3, scope: "encounter" });
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(0);
  });
});

describe("effectiveStat — Sleep", () => {
  it("sleeping creature has 0 Force", () => {
    registerCreatureDef("c", { force: 3 });
    const state = makeSingleLocationState();
    const id = spawn(state, "c");
    const card = getCard(state.cards, id);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    card.sleepCounter = 2;
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(0);
  });

  it("sleep does NOT zero other stats", () => {
    registerCreatureDef("c", { force: 3, tempo: 2 });
    const state = makeSingleLocationState();
    const id = spawn(state, "c");
    const card = getCard(state.cards, id);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    card.sleepCounter = 2;
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(0);
    expect(effectiveStat(state, card, "player", "L0", "tempo")).toBe(2);
  });
});

describe("effectiveStat — buffs", () => {
  it("turn buff sums in", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(card, { stat: "force", amount: 2, scope: "turn" });
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(3);
  });

  it("encounter buff sums in", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(card, { stat: "force", amount: 2, scope: "encounter" });
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(3);
  });

  it("permanent buff sums in", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(card, { stat: "force", amount: 1, scope: "permanent" });
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(2);
  });

  it("multiple buffs accumulate", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(card, { stat: "force", amount: 2, scope: "turn" });
    applyBuff(card, { stat: "force", amount: 1, scope: "encounter" });
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(4);
  });
});

describe("effectiveStat — conditional buffs", () => {
  it("Pit-Fighter alone gives +2 Force", () => {
    registerCreatureDef("pf", { force: 1, pitFighterWhileAlone: true });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "pf"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(3);
  });

  it("Pit-Fighter NOT alone (other friendly creature here) loses the bonus", () => {
    registerCreatureDef("pf", { force: 1, pitFighterWhileAlone: true });
    registerCreatureDef("buddy", { force: 1 });
    const state = makeSingleLocationState();
    const pf = getCard(state.cards, spawn(state, "pf"));
    const buddy = getCard(state.cards, spawn(state, "buddy"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], pf, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], buddy, false);
    expect(effectiveStat(state, pf, "player", "L0", "force")).toBe(1);
  });

  it("Challenger gains +1 Force per opposing creature", () => {
    registerCreatureDef("ch", { force: 1, provocationChallenger: true });
    registerCreatureDef("e", { force: 1 });
    const state = makeSingleLocationState();
    const ch = getCard(state.cards, spawn(state, "ch"));
    const e1 = getCard(state.cards, spawn(state, "e"));
    const e2 = getCard(state.cards, spawn(state, "e"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], ch, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], e1, false);
    placeAt(state, "ai", "L0", "creature", ["r0c1"], e2, false);
    // Base 1 + 2 (two opposing) = 3
    expect(effectiveStat(state, ch, "player", "L0", "force")).toBe(3);
  });

  it("Opposing Challenger gives +1 Force to enemies (reverse-buff)", () => {
    registerCreatureDef("ch", { force: 1, provocationChallenger: true });
    registerCreatureDef("e", { force: 1 });
    const state = makeSingleLocationState();
    const ch = getCard(state.cards, spawn(state, "ch"));
    const e = getCard(state.cards, spawn(state, "e"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], ch, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], e, false);
    // Base 1 + 1 from challenger reverse-buff
    expect(effectiveStat(state, e, "player", "L0", "force")).toBe(2);
  });
});

describe("effectiveStat — equipment grants", () => {
  it("equipment add-grant via grantsStats adds to host", () => {
    registerCreatureDef("c", { force: 1 });
    registerCardDef({
      defKey: "eq",
      name: "EquipAdd",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 2, kind: "add" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    attachEquipment(state.cards, eq, host);
    expect(effectiveStat(state, host, "player", "L0", "force")).toBe(3);
  });

  it("equipment set-grant overrides host's Force", () => {
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
    attachEquipment(state.cards, bow, host);
    expect(effectiveStat(state, host, "player", "L0", "force")).toBe(1);
  });

  it("set-grant overrides even after other layers add", () => {
    registerCreatureDef("c", { force: 1 });
    registerCardDef({
      defKey: "bow",
      name: "Bow",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 2, kind: "set" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "c"));
    const bow = getCard(state.cards, spawn(state, "bow"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    applyBuff(host, { stat: "force", amount: 5, scope: "turn" });
    attachEquipment(state.cards, bow, host);
    // base 1 + buff 5 = 6, but set overrides to 2
    expect(effectiveStat(state, host, "player", "L0", "force")).toBe(2);
  });
});
