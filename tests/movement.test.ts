import { describe, it, expect, beforeEach } from "vitest";
import { moveCreature, resetMovedThisTurn } from "../src/engine/movement.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("moveCreature", () => {
  it("moves a creature from one slot to another empty slot on the same side", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    const result = moveCreature({
      state,
      card,
      side: "player",
      loc: "L0",
      toPositions: ["r1c0"],
    });
    expect(result).toBe("ok");
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r1c0"]).toBe(card.instId);
    expect(card.slots).toEqual(["r1c0"]);
  });

  it("returns 'wrongPhase' outside main/combat phases (when enforced)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "upkeep";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    const result = moveCreature({
      state,
      card,
      side: "player",
      loc: "L0",
      toPositions: ["r1c0"],
    });
    expect(result).toBe("wrongPhase");
  });

  it("allowed during combat phase", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    const result = moveCreature({
      state,
      card,
      side: "player",
      loc: "L0",
      toPositions: ["r1c0"],
    });
    expect(result).toBe("ok");
  });

  it("returns 'occupied' when destination slot has another card", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L0", "creature", ["r1c0"], b, false);

    const result = moveCreature({
      state,
      card: a,
      side: "player",
      loc: "L0",
      toPositions: ["r1c0"],
    });
    expect(result).toBe("occupied");
  });

  it("returns 'alreadyMoved' on a second player-driven move in the same turn", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r1c0"] });
    const second = moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r0c0"] });
    expect(second).toBe("alreadyMoved");
  });

  it("programmatic moves (enforceTurnLimit=false) bypass the per-turn limit", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r1c0"] });
    // Second forced move succeeds.
    const result = moveCreature({
      state,
      card,
      side: "player",
      loc: "L0",
      toPositions: ["r0c0"],
      enforceTurnLimit: false,
    });
    expect(result).toBe("ok");
  });

  it("programmatic moves still bypass the phase gate", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "upkeep";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    const result = moveCreature({
      state,
      card,
      side: "player",
      loc: "L0",
      toPositions: ["r1c0"],
      enforceTurnLimit: false,
    });
    expect(result).toBe("ok");
  });

  it("resetMovedThisTurn clears the counter so the card can move again", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r1c0"] });
    resetMovedThisTurn(state, "L0");
    const second = moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r0c0"] });
    expect(second).toBe("ok");
  });

  it("returns 'wrongCount' if the destination footprint doesn't match the card's slot count", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    const result = moveCreature({
      state,
      card,
      side: "player",
      loc: "L0",
      toPositions: ["r0c1", "r1c1"], // 2 positions for a 1-slot card
    });
    expect(result).toBe("wrongCount");
  });

  it("returns 'outOfRange' for a position not in the profile", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    const result = moveCreature({
      state,
      card,
      side: "player",
      loc: "L0",
      toPositions: ["r9c9"],
    });
    expect(result).toBe("outOfRange");
  });
});
