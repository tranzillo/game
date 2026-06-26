import { describe, it, expect, beforeEach } from "vitest";
import { acquireCardTo, firstEmptyPosition } from "../src/engine/acquisition.ts";
import { subscribe } from "../src/engine/events.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import type { EngineEvent } from "../src/engine/types.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(() => {
  resetEngine();
  subscribe(null);
});

describe("acquireCardTo", () => {
  it("moves a creature from AI side to player side at the same location", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    const ok = acquireCardTo(state, card, "ai", "L0", ["r0c1"], "creature");
    expect(ok).toBe(true);
    // Removed from AI side
    expect(state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]).toBeNull();
    // Placed on player side at r0c1
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c1"]).toBe(card.instId);
    expect(card.slots).toEqual(["r0c1"]);
  });

  it("emits an 'acquire' outcome event describing the side change", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    const events: EngineEvent[] = [];
    subscribe((ev) => events.push(ev));
    acquireCardTo(state, card, "ai", "L0", ["r0c1"], "creature");

    const acq = events.find((e) => e.kind === "acquire");
    expect(acq).toBeDefined();
    expect(acq!.payload).toMatchObject({
      instId: card.instId,
      fromSide: "ai",
      toSide: "player",
      loc: "L0",
    });
  });

  it("returns false if destination slot is occupied", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const ai = getCard(state.cards, spawn(state, "c", "aiDeck"));
    const blocker = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], ai, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], blocker, false);

    const ok = acquireCardTo(state, ai, "ai", "L0", ["r0c1"], "creature");
    expect(ok).toBe(false);
    // Source unchanged.
    expect(state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]).toBe(ai.instId);
  });

  it("returns false if destination footprint count doesn't match card's slot count", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    // Pass 2 destinations for a 1-slot card.
    const ok = acquireCardTo(state, card, "ai", "L0", ["r0c1", "r1c1"], "creature");
    expect(ok).toBe(false);
  });
});

describe("firstEmptyPosition", () => {
  it("returns the first empty position when no row filter is set", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    // All slots empty initially.
    const pos = firstEmptyPosition(state, "player", "L0", "creature");
    expect(pos).not.toBeNull();
  });

  it("respects front-row filter", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const pos = firstEmptyPosition(state, "player", "L0", "creature", "front");
    expect(pos).toMatch(/^r0/);
  });

  it("respects back-row filter", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const pos = firstEmptyPosition(state, "player", "L0", "creature", "back");
    expect(pos).toMatch(/^r1/);
  });

  it("skips occupied positions", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const blocker = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], blocker, false);
    const pos = firstEmptyPosition(state, "player", "L0", "creature", "front");
    // r0c0 occupied; the next front-row position is r0c1.
    expect(pos).toBe("r0c1");
  });

  it("returns null when no empty positions match", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const ns = state.world.nodeState["L0"]!;
    // Fill all front-row positions.
    let i = 0;
    for (const p of Object.keys(ns.sideSlots.player.creatures)) {
      if (!p.startsWith("r0")) continue;
      const card = getCard(state.cards, spawn(state, "c"));
      placeAt(state, "player", "L0", "creature", [p], card, false);
      i++;
    }
    expect(i).toBeGreaterThan(0);
    const pos = firstEmptyPosition(state, "player", "L0", "creature", "front");
    expect(pos).toBeNull();
  });
});
