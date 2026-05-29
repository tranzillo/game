import { describe, it, expect, beforeEach } from "vitest";
import {
  registerAuraHandler,
  _resetAuraHandlers,
  sumAuraContributions,
} from "../src/engine/auras.ts";
import { effectiveStat } from "../src/engine/stats.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(() => {
  resetEngine();
  _resetAuraHandlers();
});

describe("aura handler registry", () => {
  it("registers and retrieves a handler", () => {
    registerAuraHandler("test", () => 1);
    expect(sumAuraContributions(makeSingleLocationState(), {
      targetLoc: "L0",
      stat: "force",
    })).toBe(0);
  });

  it("rejects duplicate handler tag", () => {
    registerAuraHandler("dup", () => 0);
    expect(() => registerAuraHandler("dup", () => 0)).toThrow();
  });
});

describe("sumAuraContributions", () => {
  it("returns 0 when there are no aura sources in play", () => {
    const state = makeSingleLocationState();
    const sum = sumAuraContributions(state, { targetLoc: "L0", stat: "force" });
    expect(sum).toBe(0);
  });

  it("sums contributions from a single aura source", () => {
    registerAuraHandler("alwaysOne", () => 1);
    registerCardDef({
      defKey: "src",
      name: "Source",
      type: "structure",
      text: "",
      costs: [],
      aura: { handlerTag: "alwaysOne" },
    });
    const state = makeSingleLocationState();
    const src = getCard(state.cards, spawn(state, "src"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], src, false);
    const sum = sumAuraContributions(state, { targetLoc: "L0", stat: "force" });
    expect(sum).toBe(1);
  });

  it("skips face-down sources", () => {
    registerAuraHandler("alwaysOne", () => 1);
    registerCardDef({
      defKey: "src",
      name: "Source",
      type: "structure",
      text: "",
      costs: [],
      aura: { handlerTag: "alwaysOne" },
    });
    const state = makeSingleLocationState();
    const src = getCard(state.cards, spawn(state, "src"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], src, false);
    src.revealed = false; // face-down
    const sum = sumAuraContributions(state, { targetLoc: "L0", stat: "force" });
    expect(sum).toBe(0);
  });

  it("skips cards not in play (slots empty)", () => {
    registerAuraHandler("alwaysOne", () => 1);
    registerCardDef({
      defKey: "src",
      name: "Source",
      type: "structure",
      text: "",
      costs: [],
      aura: { handlerTag: "alwaysOne" },
    });
    const state = makeSingleLocationState();
    spawn(state, "src"); // created but not placed
    const sum = sumAuraContributions(state, { targetLoc: "L0", stat: "force" });
    expect(sum).toBe(0);
  });
});

describe("aura integration with effectiveStat", () => {
  it("aura contribution lands in effectiveStat reads", () => {
    // A "Warbanner" structure: +1 Force aura to creatures on your side at this loc.
    registerAuraHandler("warbanner", (_state, _src, sourceSide, sourceLoc, ctx) => {
      if (ctx.stat !== "force") return 0;
      if (ctx.targetSide !== sourceSide) return 0;
      if (ctx.targetLoc !== sourceLoc) return 0;
      if (!ctx.targetCard) return 0;
      return 1;
    });
    registerCardDef({
      defKey: "warbanner",
      name: "Warbanner",
      type: "structure",
      text: "Creatures on your side here have +1 Force.",
      costs: [],
      aura: { handlerTag: "warbanner" },
    });
    registerCreatureDef("c", { force: 2 });
    const state = makeSingleLocationState();
    const banner = getCard(state.cards, spawn(state, "warbanner"));
    const creature = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], banner, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], creature, false);
    expect(effectiveStat(state, creature, "player", "L0", "force")).toBe(3);
  });

  it("aura on AI side doesn't boost player creatures", () => {
    registerAuraHandler("warbanner", (_state, _src, sourceSide, sourceLoc, ctx) => {
      if (ctx.stat !== "force") return 0;
      if (ctx.targetSide !== sourceSide) return 0;
      if (ctx.targetLoc !== sourceLoc) return 0;
      if (!ctx.targetCard) return 0;
      return 1;
    });
    registerCardDef({
      defKey: "warbanner",
      name: "Warbanner",
      type: "structure",
      text: "",
      costs: [],
      aura: { handlerTag: "warbanner" },
    });
    registerCreatureDef("c", { force: 2 });
    const state = makeSingleLocationState();
    const banner = getCard(state.cards, spawn(state, "warbanner", "aiDeck"));
    const creature = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "ai", "L0", "structure", ["r0c0"], banner, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], creature, false);
    expect(effectiveStat(state, creature, "player", "L0", "force")).toBe(2);
  });
});
