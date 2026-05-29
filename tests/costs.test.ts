import { describe, it, expect, beforeEach } from "vitest";
import { effectiveCosts, evaluateCost } from "../src/engine/costs.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerActionDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("effectiveCosts", () => {
  it("returns def costs unmodified for a card with no escalation", () => {
    registerActionDef("spark", { costs: [{ kind: "absolute", stat: "insight", amount: 1 }] });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "spark"));
    const costs = effectiveCosts(card);
    expect(costs).toEqual([{ kind: "absolute", stat: "insight", amount: 1 }]);
  });

  it("escalates Forage tempo cost by forageCasts", () => {
    registerActionDef("forage", {
      costs: [{ kind: "absolute", stat: "tempo", amount: 0 }],
      effect: "forageAddAmmo",
    });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "forage"));
    card.forageCasts = 2;
    const costs = effectiveCosts(card);
    const tempo = costs.find((c) => c.kind === "absolute" && c.stat === "tempo")!;
    expect((tempo as { amount: number }).amount).toBe(2);
  });

  it("creates a tempo cost if none exists when Forage escalates", () => {
    registerActionDef("forage", {
      costs: [],
      effect: "forageAddAmmo",
    });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "forage"));
    card.forageCasts = 3;
    const costs = effectiveCosts(card);
    expect(costs).toContainEqual({ kind: "absolute", stat: "tempo", amount: 3 });
  });

  it("escalates Mirror Image insight cost", () => {
    registerActionDef("mirror", {
      costs: [{ kind: "absolute", stat: "insight", amount: 0 }],
      effect: "mirrorImage",
    });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "mirror"));
    card.mirrorCasts = 2;
    const costs = effectiveCosts(card);
    const insight = costs.find((c) => c.kind === "absolute" && c.stat === "insight")!;
    expect((insight as { amount: number }).amount).toBe(2);
  });
});

describe("evaluateCost — absolute", () => {
  it("returns true when location has enough committed Force", () => {
    registerActionDef("a", { costs: [{ kind: "absolute", stat: "force", amount: 2 }] });
    registerCreatureDef("c", { force: 3, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const stat = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], stat, false);
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(true);
  });

  it("returns false when location lacks enough committed Force", () => {
    registerActionDef("a", { costs: [{ kind: "absolute", stat: "force", amount: 5 }] });
    registerCreatureDef("c", { force: 1, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const stat = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], stat, false);
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(false);
  });
});

describe("evaluateCost — comparative", () => {
  it("comparativeMore: true when own > opp", () => {
    registerActionDef("a", { costs: [{ kind: "comparativeMore", stat: "force" }] });
    registerCreatureDef("p", { force: 3, attackPatterns: [{ kind: "default" }] });
    registerCreatureDef("e", { force: 1, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const pCard = getCard(state.cards, spawn(state, "p"));
    const eCard = getCard(state.cards, spawn(state, "e"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], pCard, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], eCard, false);
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(true);
  });

  it("comparativeMore: false when tied", () => {
    registerActionDef("a", { costs: [{ kind: "comparativeMore", stat: "force" }] });
    registerCreatureDef("c", { force: 1, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const p = getCard(state.cards, spawn(state, "c"));
    const e = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], e, false);
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(false);
  });

  it("comparativeLess: true when own < opp", () => {
    registerActionDef("a", { costs: [{ kind: "comparativeLess", stat: "force" }] });
    registerCreatureDef("strong", { force: 5, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const e = getCard(state.cards, spawn(state, "strong"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], e, false);
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(true);
  });

  it("comparativeEqual: true on tie", () => {
    registerActionDef("a", { costs: [{ kind: "comparativeEqual", stat: "force" }] });
    registerCreatureDef("c", { force: 1, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const p = getCard(state.cards, spawn(state, "c"));
    const e = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], e, false);
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(true);
  });

  it("face-down opponent cards count as 0 in comparative", () => {
    registerActionDef("a", { costs: [{ kind: "comparativeMore", stat: "force" }] });
    registerCreatureDef("p", { force: 1, attackPatterns: [{ kind: "default" }] });
    registerCreatureDef("e", { force: 5, attackPatterns: [{ kind: "default" }] });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const pCard = getCard(state.cards, spawn(state, "p"));
    const eCard = getCard(state.cards, spawn(state, "e"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], pCard, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], eCard, false);
    eCard.revealed = false; // face-down
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(true);
  });
});

describe("evaluateCost — compound costs", () => {
  it("all requirements must hold", () => {
    registerActionDef("a", {
      costs: [
        { kind: "absolute", stat: "force", amount: 1 },
        { kind: "absolute", stat: "tempo", amount: 1 },
      ],
    });
    registerCardDef({
      defKey: "ft",
      name: "FT",
      type: "creature",
      text: "",
      costs: [],
      force: 1,
      tempo: 1,
      durability: 2,
      attackPatterns: [{ kind: "default" }],
    });
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const ft = getCard(state.cards, spawn(state, "ft"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], ft, false);
    const action = getCard(state.cards, spawn(state, "a"));
    expect(evaluateCost(state, action, "player", "L0")).toBe(true);
  });
});
