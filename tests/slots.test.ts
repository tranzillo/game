import { describe, it, expect, beforeEach } from "vitest";
import {
  placeAt,
  removeFrom,
  slotOccupied,
  cardAtSlot,
  allCardsAt,
} from "../src/engine/slots.ts";
import { locationView } from "../src/engine/state.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("placeAt + slotOccupied", () => {
  it("places a single-slot creature at r0c0", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const view = locationView(state, "L0");
    expect(view.node.sideSlots.player.creatures["r0c0"]).toBe(instId);
    expect(slotOccupied(view.node, "player", "creature", "r0c0")).toBe(true);
    expect(slotOccupied(view.node, "player", "creature", "r0c1")).toBe(false);
  });

  it("sets card.slots to the placed positions", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(card.slots).toEqual(["r0c0"]);
  });

  it("throws when placing into an occupied slot", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const a = spawn(state, "r1");
    const b = spawn(state, "r1");
    placeAt(state, "player", "L0", "creature", ["r0c0"], getCard(state.cards, a), false);
    expect(() =>
      placeAt(state, "player", "L0", "creature", ["r0c0"], getCard(state.cards, b), false),
    ).toThrow();
  });

  it("places a structure into the structure grid (separate kind from creatures)", () => {
    registerStructureDef("s1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "s1");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "structure", ["r0c0"], card, false);
    const view = locationView(state, "L0");
    expect(view.node.sideSlots.player.structures["r0c0"]).toBe(instId);
    // Creature grid still empty
    expect(view.node.sideSlots.player.creatures["r0c0"]).toBeNull();
  });
});

describe("placeAt pending vs committed", () => {
  it("pending placement writes to encLocData, not committed slot map", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, true);
    const view = locationView(state, "L0");
    expect(view.node.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(view.enc.pending.creatures["r0c0"]).toBe(instId);
  });
});

describe("multi-slot placement", () => {
  it("places a row-spanner across r0c0 and r0c1; both maps point to same InstId", () => {
    registerCreatureDef("twoSlot", { footprint: [{ r: 0, c: 0 }, { r: 0, c: 1 }] });
    const state = makeSingleLocationState();
    const instId = spawn(state, "twoSlot");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], card, false);
    const view = locationView(state, "L0");
    expect(view.node.sideSlots.player.creatures["r0c0"]).toBe(instId);
    expect(view.node.sideSlots.player.creatures["r0c1"]).toBe(instId);
    expect(card.slots).toEqual(["r0c0", "r0c1"]);
  });

  it("allCardsAt dedupes multi-slot cards", () => {
    registerCreatureDef("twoSlot", { footprint: [{ r: 0, c: 0 }, { r: 0, c: 1 }] });
    const state = makeSingleLocationState();
    const instId = spawn(state, "twoSlot");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], card, false);
    const view = locationView(state, "L0");
    const cards = allCardsAt(view.node, "player", "creature", state.cards);
    expect(cards.length).toBe(1);
    expect(cards[0]!.instId).toBe(instId);
  });
});

describe("removeFrom", () => {
  it("clears all positions a card occupies", () => {
    registerCreatureDef("twoSlot", { footprint: [{ r: 0, c: 0 }, { r: 0, c: 1 }] });
    const state = makeSingleLocationState();
    const instId = spawn(state, "twoSlot");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], card, false);
    removeFrom(state, "player", "L0", "creature", card, false);
    const view = locationView(state, "L0");
    expect(view.node.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(view.node.sideSlots.player.creatures["r0c1"]).toBeNull();
    expect(card.slots).toEqual([]);
  });

  it("does not affect other cards in different slots", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const a = spawn(state, "r1");
    const b = spawn(state, "r1");
    const cardA = getCard(state.cards, a);
    const cardB = getCard(state.cards, b);
    placeAt(state, "player", "L0", "creature", ["r0c0"], cardA, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], cardB, false);
    removeFrom(state, "player", "L0", "creature", cardA, false);
    const view = locationView(state, "L0");
    expect(view.node.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(view.node.sideSlots.player.creatures["r0c1"]).toBe(b);
  });

  it("is idempotent on a card with no current placement", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    const card = getCard(state.cards, instId);
    // Not placed; remove is a no-op
    removeFrom(state, "player", "L0", "creature", card, false);
    expect(card.slots).toEqual([]);
  });
});

describe("cardAtSlot", () => {
  it("returns the card at the slot, or null", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const view = locationView(state, "L0");
    expect(cardAtSlot(view.node, "player", "creature", "r0c0", state.cards)).toBe(card);
    expect(cardAtSlot(view.node, "player", "creature", "r0c1", state.cards)).toBeNull();
  });
});
