import { describe, it, expect, beforeEach } from "vitest";
import {
  routeOnLeavePlay,
  sendToPile,
  type PileTarget,
} from "../src/engine/routing.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  registerActionDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("routeOnLeavePlay — explicit trash", () => {
  it("returns trash regardless of side or zone", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    const target = routeOnLeavePlay(state, card, "player", "L0", "explicitTrash");
    expect(target).toEqual({ kind: "trash" });
  });
});

describe("routeOnLeavePlay — base zones by reason", () => {
  it("creatureDied → graveyard zone (player always present)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    const target = routeOnLeavePlay(state, card, "player", "L0", "creatureDied");
    expect(target).toEqual({ kind: "sidePile", side: "player", zone: "graveyard" });
  });

  it("structureDestroyed → junkyard zone", () => {
    registerStructureDef("s");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "s"));
    const target = routeOnLeavePlay(state, card, "player", "L0", "structureDestroyed");
    expect(target).toEqual({ kind: "sidePile", side: "player", zone: "junkyard" });
  });

  it("equipmentDetached → junkyard zone", () => {
    registerCardDef({
      defKey: "eq",
      name: "Eq",
      type: "equipment",
      text: "",
      costs: [],
    });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "eq"));
    const target = routeOnLeavePlay(state, card, "player", "L0", "equipmentDetached");
    expect(target).toEqual({ kind: "sidePile", side: "player", zone: "junkyard" });
  });

  it("actionResolved → discard by default", () => {
    registerActionDef("a");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "a"));
    const target = routeOnLeavePlay(state, card, "player", "L0", "actionResolved");
    expect(target).toEqual({ kind: "sidePile", side: "player", zone: "discard" });
  });

  it("actionResolved with exitTo: graveyard routes to graveyard", () => {
    registerActionDef("a", { exitTo: "graveyard" });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "a"));
    const target = routeOnLeavePlay(state, card, "player", "L0", "actionResolved");
    expect(target).toEqual({ kind: "sidePile", side: "player", zone: "graveyard" });
  });

  it("fromHandDiscard → discard", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    const target = routeOnLeavePlay(state, card, "player", "L0", "fromHandDiscard");
    expect(target).toEqual({ kind: "sidePile", side: "player", zone: "discard" });
  });
});

describe("routeOnLeavePlay — AI presence at location", () => {
  it("AI dying at a location with AI presence → AI graveyard side pile", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    // Establish AI presence: AI-origin card on AI side at L0.
    const presence = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], presence, false);
    // The dying AI card:
    const dying = getCard(state.cards, spawn(state, "c", "aiDeck"));
    const target = routeOnLeavePlay(state, dying, "ai", "L0", "creatureDied");
    expect(target).toEqual({ kind: "sidePile", side: "ai", zone: "graveyard" });
  });

  it("AI dying at a location with NO AI presence → location pile", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const dying = getCard(state.cards, spawn(state, "c", "biome"));
    const target = routeOnLeavePlay(state, dying, "ai", "L0", "creatureDied");
    expect(target).toEqual({ kind: "locationPile", loc: "L0", zone: "graveyard" });
  });

  it("AI structure leaving at no-presence location → location junkyard", () => {
    registerStructureDef("s");
    const state = makeSingleLocationState();
    const dying = getCard(state.cards, spawn(state, "s", "biome"));
    const target = routeOnLeavePlay(state, dying, "ai", "L0", "structureDestroyed");
    expect(target).toEqual({ kind: "locationPile", loc: "L0", zone: "junkyard" });
  });

  it("AI action resolving at no-presence location → trash (no discard exists)", () => {
    registerActionDef("a");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "a", "biome"));
    const target = routeOnLeavePlay(state, card, "ai", "L0", "actionResolved");
    expect(target).toEqual({ kind: "trash" });
  });
});

describe("sendToPile", () => {
  it("pushes to side pile", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    const target: PileTarget = { kind: "sidePile", side: "player", zone: "graveyard" };
    sendToPile(state, card, target);
    expect(state.currentEncounter!.playerSide.graveyard).toContain(card.instId);
  });

  it("pushes to location pile", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    const target: PileTarget = { kind: "locationPile", loc: "L0", zone: "graveyard" };
    sendToPile(state, card, target);
    expect(state.world.nodeState["L0"]!.locationPiles.graveyard).toContain(card.instId);
  });

  it("pushes to trash", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    sendToPile(state, card, { kind: "trash" });
    expect(state.trash).toContain(card.instId);
  });

  it("falls through to trash if side pile target side has no SideState", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.aiSide = null;
    const card = getCard(state.cards, spawn(state, "c"));
    sendToPile(state, card, { kind: "sidePile", side: "ai", zone: "graveyard" });
    expect(state.trash).toContain(card.instId);
  });

  it("is idempotent (won't double-push the same instId)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    sendToPile(state, card, { kind: "sidePile", side: "player", zone: "graveyard" });
    sendToPile(state, card, { kind: "sidePile", side: "player", zone: "graveyard" });
    expect(
      state.currentEncounter!.playerSide.graveyard.filter((id) => id === card.instId).length,
    ).toBe(1);
  });
});
