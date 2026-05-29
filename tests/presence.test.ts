import { describe, it, expect, beforeEach } from "vitest";
import { isAiPresentAt, isAiPresentAnywhere, findCardLocation } from "../src/engine/presence.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  makeMultiLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("isAiPresentAt", () => {
  it("false when AI-side slots are empty", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    expect(isAiPresentAt(state, "L0")).toBe(false);
  });

  it("true when an AI-origin card sits on the AI side", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1", "aiDeck");
    const card = getCard(state.cards, instId);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);
    expect(isAiPresentAt(state, "L0")).toBe(true);
  });

  it("false when a biome-origin card sits on the AI side (no AI-origin presence)", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1", "biome");
    const card = getCard(state.cards, instId);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);
    expect(isAiPresentAt(state, "L0")).toBe(false);
  });

  it("false when an AI-origin card sits on the PLAYER side (presence is per-side)", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1", "aiDeck");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    expect(isAiPresentAt(state, "L0")).toBe(false);
  });
});

describe("isAiPresentAnywhere", () => {
  it("true when AI present at any encounter location", () => {
    registerCreatureDef("r1");
    const state = makeMultiLocationState(["L0", "L1"]);
    const instId = spawn(state, "r1", "aiDeck");
    const card = getCard(state.cards, instId);
    placeAt(state, "ai", "L1", "creature", ["r0c0"], card, false);
    expect(isAiPresentAnywhere(state)).toBe(true);
  });

  it("false when no AI presence at any encounter location", () => {
    const state = makeMultiLocationState(["L0", "L1"]);
    expect(isAiPresentAnywhere(state)).toBe(false);
  });
});

describe("findCardLocation", () => {
  it("returns the slot location for a placed card", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const loc = findCardLocation(state, instId);
    expect(loc).toEqual({
      container: "slot",
      side: "player",
      loc: "L0",
      kind: "creature",
      positions: ["r0c0"],
    });
  });

  it("returns pending location for a pending placement", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    const card = getCard(state.cards, instId);
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, true);
    const loc = findCardLocation(state, instId);
    expect(loc).toEqual({
      container: "pending",
      side: "player",
      loc: "L0",
      kind: "creature",
      positions: ["r0c0"],
    });
  });

  it("returns trash for a trashed card", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    state.trash.push(instId);
    const loc = findCardLocation(state, instId);
    expect(loc).toEqual({ container: "trash" });
  });

  it("returns hand container for a card in player hand", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    state.currentEncounter!.playerSide.hand.push(instId);
    const loc = findCardLocation(state, instId);
    expect(loc).toEqual({ container: "hand", side: "player" });
  });

  it("returns location pile for a card in location's graveyard pile", () => {
    registerCreatureDef("r1");
    const state = makeSingleLocationState();
    const instId = spawn(state, "r1");
    state.world.nodeState["L0"]!.locationPiles.graveyard.push(instId);
    const loc = findCardLocation(state, instId);
    expect(loc).toEqual({ container: "locationPile", loc: "L0", pile: "graveyard" });
  });

  it("returns null for an unknown instId", () => {
    const state = makeSingleLocationState();
    expect(findCardLocation(state, 9999)).toBeNull();
  });
});
