import { describe, it, expect, beforeEach } from "vitest";
import { startNewTurn } from "../src/store/advance-helpers.ts";
import { applyBuff } from "../src/engine/buffs.ts";
import { moveCreature } from "../src/engine/movement.ts";
import { effectiveStat } from "../src/engine/stats.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("startNewTurn — per-turn cleanup (2026-06-12 audit fixes)", () => {
  it("reverts turn-scoped buffs (\"+X this turn\" expires)", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    applyBuff(state, card, { stat: "force", amount: 2, scope: "turn" });
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(3);

    startNewTurn(state);
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(1);
  });

  it("keeps encounter- and permanent-scoped buffs", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    applyBuff(state, card, { stat: "force", amount: 1, scope: "encounter" });
    applyBuff(state, card, { stat: "force", amount: 1, scope: "permanent" });
    startNewTurn(state);
    expect(effectiveStat(state, card, "player", "L0", "force")).toBe(3);
  });

  it("clears meleeAttackersThisTurn", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    card.meleeAttackersThisTurn.push(999);
    startNewTurn(state);
    expect(card.meleeAttackersThisTurn).toEqual([]);
  });

  it("clears skipAttackThisTurn and wokeInPhase", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    card.skipAttackThisTurn = true;
    card.wokeInPhase = "combat";
    startNewTurn(state);
    expect(card.skipAttackThisTurn).toBe(false);
    expect(card.wokeInPhase).toBeNull();
  });

  it("clears per-location movedThisTurn so creatures can move again next turn", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    expect(moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r1c0"] })).toBe("ok");
    expect(moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r0c0"] })).toBe("alreadyMoved");

    startNewTurn(state); // clears movedThisTurn; turns now start at the draw phase
    state.currentEncounter!.phase = "main"; // advance to a move-legal phase
    expect(moveCreature({ state, card, side: "player", loc: "L0", toPositions: ["r0c0"] })).toBe("ok");
  });

  it("resets actionsThisTurn on both sides", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.playerSide.actionsThisTurn = 3;
    state.currentEncounter!.aiSide = {
      deck: [],
      hand: [],
      discard: [],
      graveyard: [],
      junkyard: [],
      durability: 10,
      actionsThisTurn: 2,
    };
    startNewTurn(state);
    expect(state.currentEncounter!.playerSide.actionsThisTurn).toBe(0);
    expect(state.currentEncounter!.aiSide!.actionsThisTurn).toBe(0);
  });
});
