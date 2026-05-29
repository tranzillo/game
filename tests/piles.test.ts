import { describe, it, expect, beforeEach } from "vitest";
import {
  leavePlay,
  reshuffleDiscardIntoDeck,
  endEncounterPiles,
} from "../src/engine/piles.ts";
import { placeAt } from "../src/engine/slots.ts";
import { applyBuff } from "../src/engine/buffs.ts";
import { attachEquipment } from "../src/engine/equipment.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("leavePlay — full sequence", () => {
  it("creature dying moves from slot to side graveyard", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    leavePlay(state, card, "player", "L0", "creatureDied");
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(state.currentEncounter!.playerSide.graveyard).toContain(card.instId);
    expect(card.slots).toEqual([]);
  });

  it("reverts encounter-scoped buffs on the leaving card", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(card, { stat: "force", amount: 1, scope: "encounter" });
    applyBuff(card, { stat: "force", amount: 1, scope: "permanent" });
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    leavePlay(state, card, "player", "L0", "creatureDied");
    expect(card.buffs.length).toBe(1);
    expect(card.buffs[0]!.scope).toBe("permanent");
  });

  it("detaches equipment and sends it to junkyard", () => {
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
    expect(host.buffs.length).toBe(1);
    leavePlay(state, host, "player", "L0", "creatureDied");
    // Host went to graveyard
    expect(state.currentEncounter!.playerSide.graveyard).toContain(host.instId);
    // Equipment detached: went to junkyard
    expect(state.currentEncounter!.playerSide.junkyard).toContain(eq.instId);
    // Host no longer has the equipped buff
    expect(host.buffs.length).toBe(0);
    expect(host.equipment).toEqual([]);
  });

  it("AI creature dying at no-AI-presence location goes to location pile", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);
    leavePlay(state, card, "ai", "L0", "creatureDied");
    expect(state.world.nodeState["L0"]!.locationPiles.graveyard).toContain(card.instId);
    expect(state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]).toBeNull();
  });

  it("returns the chosen pile target", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const target = leavePlay(state, card, "player", "L0", "creatureDied");
    expect(target).toEqual({ kind: "sidePile", side: "player", zone: "graveyard" });
  });
});

describe("reshuffleDiscardIntoDeck", () => {
  it("moves discard contents to deck and clears discard", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.playerSide.discard.push(1, 2, 3);
    reshuffleDiscardIntoDeck(state, "player");
    expect(state.currentEncounter!.playerSide.discard).toEqual([]);
    expect(state.currentEncounter!.playerSide.deck.length).toBe(3);
    expect(state.currentEncounter!.playerSide.deck.sort()).toEqual([1, 2, 3]);
  });

  it("does nothing when discard is empty", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.playerSide.deck = [1];
    reshuffleDiscardIntoDeck(state, "player");
    expect(state.currentEncounter!.playerSide.deck).toEqual([1]);
  });

  it("noop when side has no SideState", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.aiSide = null;
    expect(() => reshuffleDiscardIntoDeck(state, "ai")).not.toThrow();
  });
});

describe("endEncounterPiles", () => {
  it("reshuffles hand + discard + graveyard + junkyard + in-play creatures into deck", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    const c = getCard(state.cards, spawn(state, "c"));
    const d = getCard(state.cards, spawn(state, "c"));
    const e = getCard(state.cards, spawn(state, "c"));
    state.currentEncounter!.playerSide.hand.push(a.instId);
    state.currentEncounter!.playerSide.discard.push(b.instId);
    state.currentEncounter!.playerSide.graveyard.push(c.instId);
    state.currentEncounter!.playerSide.junkyard.push(d.instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], e, false);
    endEncounterPiles(state);
    const deck = state.currentEncounter!.playerSide.deck.sort();
    expect(deck.length).toBe(5);
    for (const card of [a, b, c, d, e]) {
      expect(deck).toContain(card.instId);
    }
    expect(state.currentEncounter!.playerSide.hand).toEqual([]);
    expect(state.currentEncounter!.playerSide.discard).toEqual([]);
    expect(state.currentEncounter!.playerSide.graveyard).toEqual([]);
    expect(state.currentEncounter!.playerSide.junkyard).toEqual([]);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
  });

  it("structures stay in slots", () => {
    registerStructureDef("s");
    const state = makeSingleLocationState();
    const struct = getCard(state.cards, spawn(state, "s"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], struct, false);
    endEncounterPiles(state);
    expect(state.world.nodeState["L0"]!.sideSlots.player.structures["r0c0"]).toBe(struct.instId);
    expect(state.currentEncounter!.playerSide.deck).not.toContain(struct.instId);
  });

  it("location piles stay (not reshuffled into either side's deck)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const stuck = getCard(state.cards, spawn(state, "c", "biome"));
    state.world.nodeState["L0"]!.locationPiles.graveyard.push(stuck.instId);
    endEncounterPiles(state);
    expect(state.world.nodeState["L0"]!.locationPiles.graveyard).toContain(stuck.instId);
    expect(state.currentEncounter!.playerSide.deck).not.toContain(stuck.instId);
  });

  it("trash stays (not reshuffled)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const exiled = getCard(state.cards, spawn(state, "c"));
    state.trash.push(exiled.instId);
    endEncounterPiles(state);
    expect(state.trash).toContain(exiled.instId);
    expect(state.currentEncounter!.playerSide.deck).not.toContain(exiled.instId);
  });

  it("writes back markCount and permanent buffs to runDeckEntry.mods", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.runDeck.push({ defKey: "c", mods: {} });
    const card = getCard(state.cards, spawn(state, "c"));
    card.runDeckEntryRef = 0;
    card.markCount = 1;
    applyBuff(card, { stat: "force", amount: 1, scope: "permanent" });
    applyBuff(card, { stat: "force", amount: 1, scope: "encounter" }); // shouldn't persist
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    endEncounterPiles(state);
    expect(state.runDeck[0]!.mods.markCount).toBe(1);
    expect(state.runDeck[0]!.mods.buffs?.length).toBe(1);
    expect(state.runDeck[0]!.mods.buffs?.[0]!.scope).toBe("permanent");
  });

  it("includes equipment attached to in-play creatures in the reshuffle", () => {
    registerCreatureDef("h");
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
    });
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "h"));
    const eq = getCard(state.cards, spawn(state, "eq"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    attachEquipment(state.cards, eq, host);
    endEncounterPiles(state);
    expect(state.currentEncounter!.playerSide.deck).toContain(host.instId);
    expect(state.currentEncounter!.playerSide.deck).toContain(eq.instId);
  });
});
