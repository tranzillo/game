import { describe, it, expect, beforeEach } from "vitest";
import { exitPersistentAction } from "../src/engine/persistent-actions.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerActionDef,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("exitPersistentAction", () => {
  it("routes a persistent action to its discard pile via leavePlay", () => {
    registerActionDef("prayer", { persistent: true });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "prayer"));
    placeAt(state, "player", "L0", "action", ["r0c0"], card, false);

    exitPersistentAction(state, card, "player", "L0");

    // Slot is empty.
    expect(state.world.nodeState["L0"]!.sideSlots.player.actions["r0c0"]).toBeNull();
    // Action routed to discard (default).
    expect(state.currentEncounter!.playerSide.discard).toContain(card.instId);
  });

  it("respects def.exitTo for the destination", () => {
    registerActionDef("quest", { persistent: true, exitTo: "graveyard" });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "quest"));
    placeAt(state, "player", "L0", "action", ["r0c0"], card, false);

    exitPersistentAction(state, card, "player", "L0");

    expect(state.currentEncounter!.playerSide.graveyard).toContain(card.instId);
  });

  it("throws if called on a non-persistent action", () => {
    registerActionDef("spark", { persistent: false });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "spark"));
    placeAt(state, "player", "L0", "action", ["r0c0"], card, false);

    expect(() => exitPersistentAction(state, card, "player", "L0")).toThrow(/not persistent/);
  });

  it("throws if called on a non-action card", () => {
    registerCreatureDef("c", { durability: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    expect(() => exitPersistentAction(state, card, "player", "L0")).toThrow(/not an action/);
  });

  it("accepts a custom leave-play reason", () => {
    registerActionDef("curse", { persistent: true });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "curse"));
    placeAt(state, "player", "L0", "action", ["r0c0"], card, false);

    // explicitTrash → card goes to global trash.
    exitPersistentAction(state, card, "player", "L0", "explicitTrash");
    expect(state.trash).toContain(card.instId);
  });
});
