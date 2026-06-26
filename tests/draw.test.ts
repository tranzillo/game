import { describe, it, expect, beforeEach } from "vitest";
import {
  BASE_DRAW_TARGET,
  drawOneCard,
  drawTargetFor,
  wantsToDraw,
  discardHandToResolve,
} from "../src/engine/draw.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("drawTargetFor", () => {
  it("is BASE_DRAW_TARGET (5, per the prototype) with no Insight", () => {
    const state = makeSingleLocationState();
    expect(BASE_DRAW_TARGET).toBe(5);
    expect(drawTargetFor(state, "player")).toBe(5);
  });

  it("adds global Insight to the target", () => {
    registerCreatureDef("sage", { insight: 2 });
    const state = makeSingleLocationState();
    const sage = getCard(state.cards, spawn(state, "sage"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], sage, false);

    expect(drawTargetFor(state, "player")).toBe(7);
    expect(drawTargetFor(state, "ai")).toBe(5);
  });
});

describe("drawOneCard", () => {
  it("moves the top of the deck into hand", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = spawn(state, "c");
    const b = spawn(state, "c");
    state.currentEncounter!.playerSide.deck.push(a, b);

    const drawn = drawOneCard(state, "player");
    expect(drawn).toBe(a);
    expect(state.currentEncounter!.playerSide.hand).toEqual([a]);
    expect(state.currentEncounter!.playerSide.deck).toEqual([b]);
  });

  it("reshuffles the discard into the deck when the deck is empty (§29)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = spawn(state, "c");
    state.currentEncounter!.playerSide.discard.push(a);

    const drawn = drawOneCard(state, "player");
    expect(drawn).toBe(a);
    expect(state.currentEncounter!.playerSide.discard).toEqual([]);
    expect(state.currentEncounter!.playerSide.hand).toEqual([a]);
  });

  it("returns null when both deck and discard are empty", () => {
    const state = makeSingleLocationState();
    expect(drawOneCard(state, "player")).toBeNull();
  });

  it("returns null for a side with no SideState (aiSide null)", () => {
    const state = makeSingleLocationState();
    expect(state.currentEncounter!.aiSide).toBeNull();
    expect(drawOneCard(state, "ai")).toBeNull();
  });
});

describe("wantsToDraw", () => {
  it("true below target with cards available; false at target", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    for (let i = 0; i < 6; i++) state.currentEncounter!.playerSide.deck.push(spawn(state, "c"));

    expect(wantsToDraw(state, "player")).toBe(true);
    for (let i = 0; i < 5; i++) drawOneCard(state, "player");
    expect(state.currentEncounter!.playerSide.hand.length).toBe(5);
    expect(wantsToDraw(state, "player")).toBe(false); // at target
  });

  it("false below target when deck AND discard are dry", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.playerSide.deck.push(spawn(state, "c"));
    drawOneCard(state, "player");
    expect(state.currentEncounter!.playerSide.hand.length).toBe(1); // below target of 5
    expect(wantsToDraw(state, "player")).toBe(false); // nothing left to draw
  });
});

describe("discardHandToResolve", () => {
  it("full-hand discard at Resolve 0", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = spawn(state, "c");
    const b = spawn(state, "c");
    state.currentEncounter!.playerSide.hand.push(a, b);

    const discarded = discardHandToResolve(state, "player");
    expect(discarded).toEqual([a, b]);
    expect(state.currentEncounter!.playerSide.hand).toEqual([]);
    expect(state.currentEncounter!.playerSide.discard).toEqual([a, b]);
  });

  it("keeps the LEFTMOST Resolve-N cards (prototype rule)", () => {
    registerCreatureDef("faithful", { resolve: 2 });
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const keeper = getCard(state.cards, spawn(state, "faithful"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], keeper, false);

    const a = spawn(state, "c");
    const b = spawn(state, "c");
    const c3 = spawn(state, "c");
    state.currentEncounter!.playerSide.hand.push(a, b, c3);

    const discarded = discardHandToResolve(state, "player");
    expect(state.currentEncounter!.playerSide.hand).toEqual([a, b]); // leftmost 2 kept
    expect(discarded).toEqual([c3]);
  });

  it("no-op for a side with no SideState", () => {
    const state = makeSingleLocationState();
    expect(discardHandToResolve(state, "ai")).toEqual([]);
  });
});
