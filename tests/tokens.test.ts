import { describe, it, expect, beforeEach } from "vitest";
import { spawnTokenAt } from "../src/engine/tokens.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  makeSingleLocationState,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("spawnTokenAt", () => {
  it("creates a face-down committed card at the target slot", () => {
    registerCreatureDef("goblin", { force: 1, durability: 1 });
    const state = makeSingleLocationState();

    const result = spawnTokenAt(state, "goblin", "player", "L0", "creature", ["r0c0"]);

    expect(result).not.toBeNull();
    expect(result!.card.revealed).toBe(false);
    expect(result!.card.slots).toEqual(["r0c0"]);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(result!.card.instId);
  });

  it("emits a Future chip into the active sub-phase queue", () => {
    registerCreatureDef("goblin");
    const state = makeSingleLocationState();
    // Slice default subPhase is "start" → chip routes to startOfPhase queue.
    expect(state.currentEncounter!.subPhase).toBe("start");

    const result = spawnTokenAt(state, "goblin", "player", "L0", "creature", ["r0c0"])!;

    expect(state.currentEncounter!.flipQueues.startOfPhase).toContain(result.chip);
    expect(state.timeline).toContain(result.chip);
    expect(result.chip.state).toBe("future");
    expect(result.chip.cardInstId).toBe(result.card.instId);
  });

  it("token has origin 'biome' (cannot be acquired into a deck)", () => {
    registerCreatureDef("goblin");
    const state = makeSingleLocationState();
    const { card } = spawnTokenAt(state, "goblin", "player", "L0", "creature", ["r0c0"])!;
    expect(card.origin).toBe("biome");
  });

  it("supports multi-slot tokens", () => {
    registerCreatureDef("big", {
      force: 3,
      durability: 5,
      footprint: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
    });
    const state = makeSingleLocationState();
    const { card } = spawnTokenAt(state, "big", "player", "L0", "creature", ["r0c0", "r0c1"])!;
    expect(card.slots).toEqual(["r0c0", "r0c1"]);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(card.instId);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c1"]).toBe(card.instId);
  });

  it("works for structure tokens", () => {
    registerStructureDef("rubble");
    const state = makeSingleLocationState();
    const { card } = spawnTokenAt(state, "rubble", "player", "L0", "structure", ["r0c0"])!;
    expect(card.revealed).toBe(false);
    expect(state.world.nodeState["L0"]!.sideSlots.player.structures["r0c0"]).toBe(card.instId);
  });

  it("fizzles (returns null) if the slot is occupied — spawns nothing", () => {
    registerCreatureDef("goblin");
    const state = makeSingleLocationState();
    spawnTokenAt(state, "goblin", "player", "L0", "creature", ["r0c0"]);
    const second = spawnTokenAt(state, "goblin", "player", "L0", "creature", ["r0c0"]);
    expect(second).toBeNull();
    // The occupant is still the first token, not a second one.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).not.toBeNull();
  });

  it("chip cachedTempo is computed at spawn moment", () => {
    registerCreatureDef("fast", { tempo: 3, durability: 1 });
    const state = makeSingleLocationState();
    const { chip } = spawnTokenAt(state, "fast", "player", "L0", "creature", ["r0c0"])!;
    expect(chip.cachedTempo).toBe(3);
  });
});
