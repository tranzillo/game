import { describe, it, expect, beforeEach } from "vitest";
import {
  registerCardDef,
  getCardDef,
  hasCardDef,
  createCardInstance,
  getCard,
} from "../src/engine/cards.ts";
import { freshGameState } from "../src/engine/state.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  registerActionDef,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("card def registry", () => {
  it("registers and retrieves defs", () => {
    registerCreatureDef("r1", { force: 1, durability: 2 });
    expect(hasCardDef("r1")).toBe(true);
    expect(getCardDef("r1").force).toBe(1);
  });

  it("throws on missing def", () => {
    expect(() => getCardDef("nope")).toThrow();
  });

  it("rejects duplicate registration", () => {
    registerCreatureDef("r1");
    expect(() => registerCardDef({ defKey: "r1", name: "dup", type: "creature", text: "", costs: [] })).toThrow();
  });
});

describe("createCardInstance", () => {
  it("creates an instance with monotonic instId", () => {
    registerCreatureDef("r1");
    registerCreatureDef("r2");
    const state = freshGameState();
    const a = createCardInstance(state, "r1", "playerDeck");
    const b = createCardInstance(state, "r1", "playerDeck");
    const c = createCardInstance(state, "r2", "aiDeck");
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(c).toBe(3);
  });

  it("adds the instance to state.cards", () => {
    registerCreatureDef("r1", { force: 3, durability: 5 });
    const state = freshGameState();
    const instId = createCardInstance(state, "r1", "playerDeck");
    const card = getCard(state.cards, instId);
    expect(card.defKey).toBe("r1");
    expect(card.origin).toBe("playerDeck");
    expect(card.durability).toBe(5);
  });

  it("creatures: durability is set from def; non-creatures: null", () => {
    registerCreatureDef("creature", { durability: 4 });
    registerStructureDef("struct");
    registerActionDef("act");
    const state = freshGameState();
    const a = createCardInstance(state, "creature", "playerDeck");
    const b = createCardInstance(state, "struct", "playerDeck");
    const c = createCardInstance(state, "act", "playerDeck");
    expect(getCard(state.cards, a).durability).toBe(4);
    expect(getCard(state.cards, b).durability).toBeNull();
    expect(getCard(state.cards, c).durability).toBeNull();
  });

  it("instance defaults: revealed=true, slots=[], markCount=0, no buffs", () => {
    registerCreatureDef("r1");
    const state = freshGameState();
    const instId = createCardInstance(state, "r1", "playerDeck");
    const card = getCard(state.cards, instId);
    expect(card.revealed).toBe(true);
    expect(card.slots).toEqual([]);
    expect(card.markCount).toBe(0);
    expect(card.buffs).toEqual([]);
    expect(card.sleepCounter).toBe(0);
    expect(card.pendingLeavePile).toBeNull();
  });

  it("each origin is preserved", () => {
    registerCreatureDef("r1");
    const state = freshGameState();
    const a = createCardInstance(state, "r1", "playerDeck");
    const b = createCardInstance(state, "r1", "aiDeck");
    const c = createCardInstance(state, "r1", "biome");
    expect(getCard(state.cards, a).origin).toBe("playerDeck");
    expect(getCard(state.cards, b).origin).toBe("aiDeck");
    expect(getCard(state.cards, c).origin).toBe("biome");
  });
});
