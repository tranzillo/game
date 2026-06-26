import { describe, it, expect, beforeEach } from "vitest";
import {
  firePhaseBoundary,
  registerPhaseBoundaryHandler,
} from "../src/engine/triggers.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  registerActionDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("firePhaseBoundary", () => {
  it("fires the hook tag matching the boundary", () => {
    let fired = false;
    registerPhaseBoundaryHandler("upkeepPing", (ctx) => {
      expect(ctx.boundary).toBe("onUpkeepStart");
      fired = true;
    });
    registerCreatureDef("c", { hooks: { onUpkeepStart: "upkeepPing" } });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    firePhaseBoundary(state, "onUpkeepStart");
    expect(fired).toBe(true);
  });

  it("does NOT fire hooks for other boundaries", () => {
    let fired = 0;
    registerPhaseBoundaryHandler("upkeepPing", () => {
      fired += 1;
    });
    registerCreatureDef("c", { hooks: { onUpkeepStart: "upkeepPing" } });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    firePhaseBoundary(state, "onCombatStart");
    firePhaseBoundary(state, "onDrawEnd");
    firePhaseBoundary(state, "onCleanupEnd");
    expect(fired).toBe(0);

    firePhaseBoundary(state, "onUpkeepStart");
    expect(fired).toBe(1);
  });

  it("does NOT fire on face-down cards", () => {
    let fired = false;
    registerPhaseBoundaryHandler("ping", () => {
      fired = true;
    });
    registerCreatureDef("c", { hooks: { onMainStart: "ping" } });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, true);

    firePhaseBoundary(state, "onMainStart");
    expect(fired).toBe(false);
  });

  it("fires for structures and actions, not just creatures", () => {
    let creatureFired = false;
    let structureFired = false;
    let actionFired = false;
    registerPhaseBoundaryHandler("cPing", () => {
      creatureFired = true;
    });
    registerPhaseBoundaryHandler("sPing", () => {
      structureFired = true;
    });
    registerPhaseBoundaryHandler("aPing", () => {
      actionFired = true;
    });
    registerCreatureDef("c", { hooks: { onCombatStart: "cPing" } });
    registerStructureDef("s", { hooks: { onCombatStart: "sPing" } });
    registerActionDef("a", { hooks: { onCombatStart: "aPing" } });

    const state = makeSingleLocationState();
    const c = getCard(state.cards, spawn(state, "c"));
    const s = getCard(state.cards, spawn(state, "s"));
    const a = getCard(state.cards, spawn(state, "a"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], c, false);
    placeAt(state, "player", "L0", "structure", ["r0c0"], s, false);
    placeAt(state, "player", "L0", "action", ["r0c0"], a, false);

    firePhaseBoundary(state, "onCombatStart");
    expect(creatureFired).toBe(true);
    expect(structureFired).toBe(true);
    expect(actionFired).toBe(true);
  });

  it("walks both sides at all encounter locations", () => {
    let count = 0;
    registerPhaseBoundaryHandler("count", () => {
      count += 1;
    });
    registerCreatureDef("c", { hooks: { onMainEnd: "count" } });
    const state = makeSingleLocationState();
    const p = getCard(state.cards, spawn(state, "c"));
    const a = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);

    firePhaseBoundary(state, "onMainEnd");
    expect(count).toBe(2);
  });

  it("is a no-op if the def has no hooks for the boundary", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    expect(() => firePhaseBoundary(state, "onUpkeepStart")).not.toThrow();
  });

  it("is a no-op if the handler tag isn't registered", () => {
    registerCreatureDef("c", { hooks: { onMainStart: "missing" } });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    expect(() => firePhaseBoundary(state, "onMainStart")).not.toThrow();
  });

  it("rejects duplicate handler registration", () => {
    registerPhaseBoundaryHandler("dup", () => {});
    expect(() => registerPhaseBoundaryHandler("dup", () => {})).toThrow(/Duplicate/);
  });

  it("deduplicates multi-slot cards (handler fires once)", () => {
    let count = 0;
    registerPhaseBoundaryHandler("count", () => {
      count += 1;
    });
    registerCreatureDef("big", {
      hooks: { onCombatStart: "count" },
      footprint: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
    });
    const state = makeSingleLocationState();
    const big = getCard(state.cards, spawn(state, "big"));
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], big, false);

    firePhaseBoundary(state, "onCombatStart");
    expect(count).toBe(1);
  });
});
