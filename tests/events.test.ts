import { describe, it, expect, beforeEach } from "vitest";
import { emit, subscribe, resetEvents, _getCurrentHandler } from "../src/engine/events.ts";
import { freshGameState, freshEncounterState } from "../src/engine/state.ts";
import type { EngineEvent } from "../src/engine/types.ts";

beforeEach(() => {
  subscribe(null);
  resetEvents();
});

describe("subscribe", () => {
  it("registers a single handler", () => {
    const handler = (_ev: EngineEvent) => {};
    subscribe(handler);
    expect(_getCurrentHandler()).toBe(handler);
  });

  it("a second subscribe replaces the first", () => {
    const a = (_ev: EngineEvent) => {};
    const b = (_ev: EngineEvent) => {};
    subscribe(a);
    subscribe(b);
    expect(_getCurrentHandler()).toBe(b);
  });

  it("subscribe(null) unsubscribes", () => {
    subscribe((_ev) => {});
    subscribe(null);
    expect(_getCurrentHandler()).toBeNull();
  });
});

describe("emit", () => {
  it("constructs the event with envelope fields + payload", () => {
    const state = freshGameState();
    state.currentEncounter = freshEncounterState(["L0"]);
    state.currentEncounter.turn = 3;
    state.currentEncounter.phase = "combat";
    const ev = emit(state, "test", { foo: 42 });
    expect(ev.kind).toBe("test");
    expect(ev.turn).toBe(3);
    expect(ev.phase).toBe("combat");
    expect(ev.payload).toEqual({ foo: 42 });
    expect(ev.id).toBeGreaterThan(0);
  });

  it("appends to encounter.outcomes", () => {
    const state = freshGameState();
    state.currentEncounter = freshEncounterState(["L0"]);
    emit(state, "a");
    emit(state, "b");
    expect(state.currentEncounter.outcomes.length).toBe(2);
    expect(state.currentEncounter.outcomes.map((ev) => ev.kind)).toEqual(["a", "b"]);
  });

  it("calls the registered handler synchronously", () => {
    const seen: string[] = [];
    subscribe((ev) => seen.push(ev.kind));
    const state = freshGameState();
    state.currentEncounter = freshEncounterState(["L0"]);
    emit(state, "ping");
    emit(state, "pong");
    expect(seen).toEqual(["ping", "pong"]);
  });

  it("works headlessly (no handler) — events still push to outcomes", () => {
    subscribe(null);
    const state = freshGameState();
    state.currentEncounter = freshEncounterState(["L0"]);
    emit(state, "ping");
    expect(state.currentEncounter.outcomes.length).toBe(1);
  });

  it("works with no encounter (no outcomes push but event still constructed + handler called)", () => {
    const seen: EngineEvent[] = [];
    subscribe((ev) => seen.push(ev));
    const state = freshGameState();
    state.currentEncounter = null;
    const ev = emit(state, "ping");
    expect(ev.kind).toBe("ping");
    expect(seen).toEqual([ev]);
  });

  it("handler errors don't break the engine — emit returns and id increments", () => {
    subscribe(() => {
      throw new Error("boom");
    });
    const state = freshGameState();
    state.currentEncounter = freshEncounterState(["L0"]);
    const a = emit(state, "a");
    const b = emit(state, "b");
    expect(a.id).toBeLessThan(b.id);
  });

  it("monotonic ids across multiple emits", () => {
    const state = freshGameState();
    state.currentEncounter = freshEncounterState(["L0"]);
    const a = emit(state, "a");
    const b = emit(state, "b");
    const c = emit(state, "c");
    expect(b.id).toBeGreaterThan(a.id);
    expect(c.id).toBeGreaterThan(b.id);
  });
});

describe("resetEvents", () => {
  it("resets the id counter so the next event starts at 1", () => {
    const state = freshGameState();
    state.currentEncounter = freshEncounterState(["L0"]);
    emit(state, "a");
    emit(state, "b");
    resetEvents();
    const next = emit(state, "c");
    expect(next.id).toBe(1);
  });
});
