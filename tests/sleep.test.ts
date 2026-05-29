import { describe, it, expect, beforeEach } from "vitest";
import {
  applySleep,
  tickSleep,
  wakeFromDamage,
  clearWokeInPhase,
} from "../src/engine/sleep.ts";
import { getCard } from "../src/engine/cards.ts";
import { resetEngine, registerCreatureDef, makeSingleLocationState, spawn } from "./helpers.ts";

beforeEach(resetEngine);

describe("applySleep", () => {
  it("sets sleepCounter to the supplied turns", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applySleep(card, 2);
    expect(card.sleepCounter).toBe(2);
  });

  it("takes the max of current and supplied", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applySleep(card, 3);
    applySleep(card, 1); // shorter; should not reduce
    expect(card.sleepCounter).toBe(3);
  });

  it("ignores non-positive durations", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applySleep(card, 0);
    applySleep(card, -1);
    expect(card.sleepCounter).toBe(0);
  });
});

describe("tickSleep", () => {
  it("decrements sleep on every creature in the registry", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    a.sleepCounter = 2;
    b.sleepCounter = 1;
    tickSleep(state.cards);
    expect(a.sleepCounter).toBe(1);
    expect(b.sleepCounter).toBe(0);
  });

  it("clamps at 0", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    a.sleepCounter = 0;
    tickSleep(state.cards);
    expect(a.sleepCounter).toBe(0);
  });
});

describe("wakeFromDamage", () => {
  it("clears sleepCounter and sets wokeInPhase", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    card.sleepCounter = 3;
    wakeFromDamage(card, "combat");
    expect(card.sleepCounter).toBe(0);
    expect(card.wokeInPhase).toBe("combat");
  });

  it("does nothing if not sleeping", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    wakeFromDamage(card, "combat");
    expect(card.sleepCounter).toBe(0);
    expect(card.wokeInPhase).toBeNull();
  });
});

describe("clearWokeInPhase", () => {
  it("resets wokeInPhase on every card", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    a.wokeInPhase = "combat";
    b.wokeInPhase = "main";
    clearWokeInPhase(state.cards);
    expect(a.wokeInPhase).toBeNull();
    expect(b.wokeInPhase).toBeNull();
  });
});
