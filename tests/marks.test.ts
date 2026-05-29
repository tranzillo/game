import { describe, it, expect, beforeEach } from "vitest";
import { applyMark, exileFromMarks, removeCardFromContainer, addCardToTrash } from "../src/engine/marks.ts";
import { placeAt } from "../src/engine/slots.ts";
import { attachEquipment } from "../src/engine/equipment.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("applyMark — first mark", () => {
  it("increments markCount from 0 to 1", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    const result = applyMark(state, card);
    expect(result).toBe("marked");
    expect(card.markCount).toBe(1);
  });

  it("mirrors to runDeckEntry.mods.markCount when card has a runDeckEntryRef", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.runDeck.push({ defKey: "c", mods: {} });
    const card = getCard(state.cards, spawn(state, "c"));
    card.runDeckEntryRef = 0;
    applyMark(state, card);
    expect(state.runDeck[0]!.mods.markCount).toBe(1);
  });

  it("does not crash when card has no runDeckEntry", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyMark(state, card);
    expect(card.markCount).toBe(1);
  });
});

describe("applyMark — second mark (exile path)", () => {
  it("returns 'exiled' on second mark", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    applyMark(state, card);
    const result = applyMark(state, card);
    expect(result).toBe("exiled");
  });

  it("moves the card from its slot to trash", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    applyMark(state, card);
    applyMark(state, card);
    expect(state.trash).toContain(card.instId);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(card.slots).toEqual([]);
  });

  it("removes the card's runDeckEntry permanently", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.runDeck.push({ defKey: "c", mods: {} });
    const card = getCard(state.cards, spawn(state, "c"));
    card.runDeckEntryRef = 0;
    applyMark(state, card);
    applyMark(state, card);
    expect(state.runDeck.length).toBe(0);
    expect(card.runDeckEntryRef).toBeUndefined();
  });

  it("shifts other cards' runDeckEntryRefs when the removed entry is in the middle", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.runDeck.push(
      { defKey: "c", mods: {} },
      { defKey: "c", mods: {} },
      { defKey: "c", mods: {} },
    );
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    const c = getCard(state.cards, spawn(state, "c"));
    a.runDeckEntryRef = 0;
    b.runDeckEntryRef = 1;
    c.runDeckEntryRef = 2;
    placeAt(state, "player", "L0", "creature", ["r0c0"], b, false);
    applyMark(state, b);
    applyMark(state, b);
    expect(state.runDeck.length).toBe(2);
    expect(a.runDeckEntryRef).toBe(0);
    expect(c.runDeckEntryRef).toBe(1);
    expect(b.runDeckEntryRef).toBeUndefined();
  });

  it("equipment attached to a host is detached before exile", () => {
    registerCreatureDef("h");
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
      grantsStats: [{ stat: "force", amount: 1, kind: "add" }],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "h"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    attachEquipment(state.cards, eq, host);
    expect(host.equipment).toContain(eq.instId);
    // First mark on eq
    applyMark(state, eq);
    // Second mark on eq → exile
    applyMark(state, eq);
    expect(state.trash).toContain(eq.instId);
    expect(host.equipment).not.toContain(eq.instId);
    expect(host.buffs.length).toBe(0); // equipped-scope buff swept
  });
});

describe("exileFromMarks — direct call without the second-mark check", () => {
  it("can exile a card regardless of markCount (used by content effects)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    exileFromMarks(state, card);
    expect(state.trash).toContain(card.instId);
  });
});

describe("removeCardFromContainer — branches", () => {
  it("removes from hand", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    state.currentEncounter!.playerSide.hand.push(card.instId);
    removeCardFromContainer(state, card, { container: "hand", side: "player" });
    expect(state.currentEncounter!.playerSide.hand).not.toContain(card.instId);
  });

  it("removes from discard", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    state.currentEncounter!.playerSide.discard.push(card.instId);
    removeCardFromContainer(state, card, { container: "discard", side: "player" });
    expect(state.currentEncounter!.playerSide.discard).not.toContain(card.instId);
  });

  it("removes from a location pile", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    state.world.nodeState["L0"]!.locationPiles.graveyard.push(card.instId);
    removeCardFromContainer(state, card, {
      container: "locationPile",
      loc: "L0",
      pile: "graveyard",
    });
    expect(state.world.nodeState["L0"]!.locationPiles.graveyard).not.toContain(card.instId);
  });

  it("removes a multi-slot card from all its positions", () => {
    registerCreatureDef("big", { footprint: [{ r: 0, c: 0 }, { r: 0, c: 1 }] });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "big"));
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], card, false);
    removeCardFromContainer(state, card, {
      container: "slot",
      side: "player",
      loc: "L0",
      kind: "creature",
      positions: ["r0c0", "r0c1"],
    });
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c1"]).toBeNull();
    expect(card.slots).toEqual([]);
  });
});

describe("addCardToTrash", () => {
  it("pushes the instId once (idempotent)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    addCardToTrash(state, card);
    addCardToTrash(state, card);
    expect(state.trash.filter((id) => id === card.instId).length).toBe(1);
  });
});
