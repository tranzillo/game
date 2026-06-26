import { describe, it, expect, beforeEach } from "vitest";
import {
  applyBuff,
  sumBuffsForStat,
  revertTurnScopedBuffs,
  revertEncounterScopedBuffs,
  sweepEquippedBuffs,
} from "../src/engine/buffs.ts";
import { getCard } from "../src/engine/cards.ts";
import { subscribe } from "../src/engine/events.ts";
import type { EngineEvent } from "../src/engine/types.ts";
import { resetEngine, registerCreatureDef, makeSingleLocationState, spawn } from "./helpers.ts";

beforeEach(() => {
  resetEngine();
  subscribe(null);
});

describe("applyBuff", () => {
  it("appends a buff to card.buffs", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(state, card, { stat: "force", amount: 1, scope: "turn" });
    expect(card.buffs.length).toBe(1);
    expect(card.buffs[0]).toEqual({ stat: "force", amount: 1, scope: "turn" });
  });

  it("equipped scope requires sourceInstId", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    expect(() => applyBuff(state, card, { stat: "force", amount: 1, scope: "equipped" })).toThrow();
  });

  it("Inert silently drops buffs to F/T/I/R/S", () => {
    registerCreatureDef("inert", { inert: true });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "inert"));
    applyBuff(state, card, { stat: "force", amount: 5, scope: "encounter" });
    expect(card.buffs.length).toBe(0);
  });

  it("emits a 'buff' event when a buff is stored", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    const events: EngineEvent[] = [];
    subscribe((ev) => events.push(ev));
    applyBuff(state, card, { stat: "force", amount: 2, scope: "permanent" });
    const buff = events.find((e) => e.kind === "buff");
    expect(buff).toBeDefined();
    expect(buff!.payload).toMatchObject({ instId: card.instId, stat: "force", amount: 2, scope: "permanent" });
  });

  it("emits NO 'buff' event when Inert drops the buff (nothing happened)", () => {
    registerCreatureDef("inert", { inert: true });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "inert"));
    const events: EngineEvent[] = [];
    subscribe((ev) => events.push(ev));
    applyBuff(state, card, { stat: "force", amount: 5, scope: "encounter" });
    expect(events.find((e) => e.kind === "buff")).toBeUndefined();
  });
});

describe("sumBuffsForStat", () => {
  it("sums all stored buffs of the given stat", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(state, card, { stat: "force", amount: 2, scope: "turn" });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "encounter" });
    applyBuff(state, card, { stat: "tempo", amount: 3, scope: "turn" });
    expect(sumBuffsForStat(card, "force")).toBe(3);
    expect(sumBuffsForStat(card, "tempo")).toBe(3);
    expect(sumBuffsForStat(card, "insight")).toBe(0);
  });
});

describe("revertTurnScopedBuffs", () => {
  it("removes only turn-scoped buffs", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(state, card, { stat: "force", amount: 1, scope: "turn" });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "encounter" });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "permanent" });
    revertTurnScopedBuffs(state.cards);
    expect(card.buffs.length).toBe(2);
    expect(card.buffs.map((b) => b.scope).sort()).toEqual(["encounter", "permanent"]);
  });
});

describe("revertEncounterScopedBuffs", () => {
  it("removes only encounter-scoped buffs", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(state, card, { stat: "force", amount: 1, scope: "turn" });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "encounter" });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "permanent" });
    revertEncounterScopedBuffs(card);
    expect(card.buffs.length).toBe(2);
    expect(card.buffs.map((b) => b.scope).sort()).toEqual(["permanent", "turn"]);
  });
});

describe("sweepEquippedBuffs", () => {
  it("removes equipped buffs with matching sourceInstId", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    applyBuff(state, card, { stat: "force", amount: 1, scope: "equipped", sourceInstId: 5 });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "equipped", sourceInstId: 6 });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "encounter" });
    sweepEquippedBuffs(state.cards, 5);
    expect(card.buffs.length).toBe(2);
    expect(card.buffs.some((b) => b.sourceInstId === 5)).toBe(false);
    expect(card.buffs.some((b) => b.sourceInstId === 6)).toBe(true);
  });
});
