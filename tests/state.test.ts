import { describe, it, expect, beforeEach } from "vitest";
import {
  freshGameState,
  freshEncounterLocationData,
  freshNodeState,
  freshSideState,
  locationView,
} from "../src/engine/state.ts";
import { defaultProfile, makeProfile } from "../src/engine/profile.ts";
import { resetEngine, makeSingleLocationState } from "./helpers.ts";

beforeEach(resetEngine);

describe("freshGameState", () => {
  it("returns a state with no encounter, empty cards, empty trash", () => {
    const s = freshGameState();
    expect(s.currentEncounter).toBeNull();
    expect(s.cards).toEqual({});
    expect(s.trash).toEqual([]);
    expect(s.runOver).toBeNull();
  });

  it("default runDurability is 20", () => {
    const s = freshGameState();
    expect(s.runDurability).toBe(20);
  });
});

describe("freshSideState", () => {
  it("starts with empty piles and 20 durability", () => {
    const s = freshSideState();
    expect(s.deck).toEqual([]);
    expect(s.hand).toEqual([]);
    expect(s.durability).toBe(20);
    expect(s.actionsThisTurn).toBe(0);
  });
});

describe("freshNodeState", () => {
  it("uses defaultProfile when no profile supplied", () => {
    const n = freshNodeState();
    expect(n.profile.creatures.positions).toEqual(["r0c0", "r0c1", "r1c0", "r1c1"]);
  });

  it("initializes empty slot maps for both sides", () => {
    const n = freshNodeState();
    for (const side of ["player", "ai"] as const) {
      for (const pos of n.profile.creatures.positions) {
        expect(n.sideSlots[side].creatures[pos]).toBeNull();
      }
    }
  });

  it("empty location piles + 0 ammo on both sides", () => {
    const n = freshNodeState();
    expect(n.locationPiles.graveyard).toEqual([]);
    expect(n.locationPiles.junkyard).toEqual([]);
    expect(n.ammo).toEqual({ player: 0, ai: 0 });
  });

  it("respects the supplied profile", () => {
    const p = makeProfile({ creatures: { rows: 3, cols: 1 } });
    const n = freshNodeState(p);
    expect(n.profile.creatures.positions).toEqual(["r0c0", "r1c0", "r2c0"]);
    expect(Object.keys(n.sideSlots.player.creatures).sort()).toEqual(["r0c0", "r1c0", "r2c0"]);
  });
});

describe("freshEncounterLocationData", () => {
  it("initializes empty pending maps for the profile", () => {
    const p = defaultProfile();
    const enc = freshEncounterLocationData(p);
    for (const pos of p.creatures.positions) {
      expect(enc.pending.creatures[pos]).toBeNull();
    }
    expect(enc.pending.equipment).toEqual({});
    expect(enc.movedThisTurn.size).toBe(0);
  });
});

describe("locationView", () => {
  it("returns node + enc joined", () => {
    const state = makeSingleLocationState({ nodeId: "L0" });
    const view = locationView(state, "L0");
    expect(view.node).toBe(state.world.nodeState["L0"]);
    expect(view.enc.pending).toBeDefined();
  });

  it("creates EncounterLocationData lazily on first access", () => {
    const state = makeSingleLocationState({ nodeId: "L0" });
    expect(state.currentEncounter!.locationData["L0"]).toBeUndefined();
    locationView(state, "L0");
    expect(state.currentEncounter!.locationData["L0"]).toBeDefined();
  });

  it("throws when there's no current encounter", () => {
    const state = freshGameState();
    expect(() => locationView(state, "L0")).toThrow(/no encounter active/);
  });

  it("throws when there's no nodeState for the node", () => {
    const state = makeSingleLocationState({ nodeId: "L0" });
    expect(() => locationView(state, "L99")).toThrow(/no nodeState/);
  });
});
