import { describe, it, expect, beforeEach } from "vitest";
import {
  emitFutureChip,
  markChipResolved,
  removeChipForCard,
  writePastEntry,
  pastEntriesMatchingFilter,
} from "../src/engine/timeline.ts";
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

describe("emitFutureChip — basic shape", () => {
  it("creates a chip with monotonic chipId", () => {
    registerCreatureDef("c", { tempo: 1 });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], b, false);
    const chipA = emitFutureChip(state, a, "player", "L0", "creature", "r0c0", null);
    const chipB = emitFutureChip(state, b, "player", "L0", "creature", "r0c1", null);
    expect(chipA.chipId).toBeLessThan(chipB.chipId);
  });

  it("appends to state.timeline AND the active sub-phase queue", () => {
    registerCreatureDef("c", { tempo: 1 });
    const state = makeSingleLocationState();
    state.currentEncounter!.subPhase = "start";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const chip = emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    expect(state.currentEncounter!.timeline).toContain(chip);
    expect(state.currentEncounter!.flipQueues.startOfPhase).toContain(chip);
    expect(state.currentEncounter!.flipQueues.midPhase).not.toContain(chip);
    expect(state.currentEncounter!.flipQueues.endOfPhase).not.toContain(chip);
  });

  it("routes to midPhase queue when subPhase is 'phase'", () => {
    registerCreatureDef("c", { tempo: 1 });
    const state = makeSingleLocationState();
    state.currentEncounter!.subPhase = "phase";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const chip = emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    expect(state.currentEncounter!.flipQueues.midPhase).toContain(chip);
    expect(state.currentEncounter!.flipQueues.startOfPhase).not.toContain(chip);
  });

  it("routes to endOfPhase queue when subPhase is 'end'", () => {
    registerCreatureDef("c", { tempo: 1 });
    const state = makeSingleLocationState();
    state.currentEncounter!.subPhase = "end";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const chip = emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    expect(state.currentEncounter!.flipQueues.endOfPhase).toContain(chip);
  });

  it("future state by default", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const chip = emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    expect(chip.state).toBe("future");
  });
});

describe("emitFutureChip — tempo caching", () => {
  it("creature chip caches the creature's effective tempo", () => {
    registerCreatureDef("fast", { tempo: 3 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "fast"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const chip = emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    expect(chip.cachedTempo).toBe(3);
  });

  it("non-creature chip caches location tempo total", () => {
    registerCreatureDef("creature", { tempo: 2 });
    registerActionDef("a");
    const state = makeSingleLocationState();
    // Establish location tempo: creature on the side contributing tempo 2
    const creature = getCard(state.cards, spawn(state, "creature"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], creature, false);
    // Now an action commits
    const action = getCard(state.cards, spawn(state, "a"));
    placeAt(state, "player", "L0", "action", ["r0c0"], action, false);
    const chip = emitFutureChip(state, action, "player", "L0", "action", "r0c0", null);
    expect(chip.cachedTempo).toBe(2);
  });

  it("chip tempo doesn't change if location tempo changes afterward", () => {
    registerCreatureDef("c", { tempo: 2 });
    registerStructureDef("s");
    const state = makeSingleLocationState();
    const creature = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], creature, false);
    const struct = getCard(state.cards, spawn(state, "s"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], struct, false);
    const chip = emitFutureChip(state, struct, "player", "L0", "structure", "r0c0", null);
    expect(chip.cachedTempo).toBe(2);
    // Now remove the creature; chip tempo stays cached
    state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"] = null;
    expect(chip.cachedTempo).toBe(2);
  });
});

describe("emitFutureChip — equipment", () => {
  it("equipment chip carries hostInstId and null posKey", () => {
    registerCreatureDef("h");
    const state = makeSingleLocationState();
    const host = getCard(state.cards, spawn(state, "h"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], host, false);
    // Equipment chip (we don't need a real equipment def for the chip shape test)
    const fakeEq = getCard(state.cards, spawn(state, "h")); // any card
    const chip = emitFutureChip(state, fakeEq, "player", "L0", "equipment", null, host.instId);
    expect(chip.posKey).toBeNull();
    expect(chip.hostInstId).toBe(host.instId);
  });
});

describe("markChipResolved", () => {
  it("transitions chip state to resolved", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const chip = emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    markChipResolved(state, chip);
    expect(chip.state).toBe("resolved");
  });

  it("removes chip from sub-phase queue but keeps it in timeline", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.subPhase = "start";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    const chip = emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    markChipResolved(state, chip);
    expect(state.currentEncounter!.flipQueues.startOfPhase).not.toContain(chip);
    expect(state.currentEncounter!.timeline).toContain(chip);
  });
});

describe("removeChipForCard", () => {
  it("removes the chip from timeline and all queues", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.subPhase = "start";
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);
    emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null);
    removeChipForCard(state, card.instId);
    expect(state.currentEncounter!.timeline).toEqual([]);
    expect(state.currentEncounter!.flipQueues.startOfPhase).toEqual([]);
  });
});

describe("writePastEntry", () => {
  it("appends to state.past with the right snapshot fields", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.turn = 4;
    const card = getCard(state.cards, spawn(state, "c"));
    writePastEntry(state, card, "player", "L0");
    expect(state.currentEncounter!.past).toEqual([
      { defKey: "c", side: "player", loc: "L0", turn: 4, cardType: "creature" },
    ]);
  });

  it("preserves append order across multiple writes", () => {
    registerCreatureDef("c");
    registerActionDef("a");
    const state = makeSingleLocationState();
    const c = getCard(state.cards, spawn(state, "c"));
    const a = getCard(state.cards, spawn(state, "a"));
    writePastEntry(state, c, "player", "L0");
    writePastEntry(state, a, "ai", "L0");
    expect(state.currentEncounter!.past.map((e) => e.cardType)).toEqual(["creature", "action"]);
  });
});

describe("pastEntriesMatchingFilter", () => {
  it("filters by side", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    writePastEntry(state, a, "player", "L0");
    writePastEntry(state, a, "ai", "L0");
    expect(pastEntriesMatchingFilter(state, { side: "player" }).length).toBe(1);
    expect(pastEntriesMatchingFilter(state, { side: "ai" }).length).toBe(1);
  });

  it("filters by cardType", () => {
    registerCreatureDef("c");
    registerActionDef("a");
    registerStructureDef("s");
    const state = makeSingleLocationState();
    writePastEntry(state, getCard(state.cards, spawn(state, "c")), "player", "L0");
    writePastEntry(state, getCard(state.cards, spawn(state, "a")), "player", "L0");
    writePastEntry(state, getCard(state.cards, spawn(state, "s")), "player", "L0");
    expect(pastEntriesMatchingFilter(state, { cardType: "action" }).length).toBe(1);
  });

  it("filters by loc", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    writePastEntry(state, card, "player", "L0");
    expect(pastEntriesMatchingFilter(state, { loc: "L1" }).length).toBe(0);
    expect(pastEntriesMatchingFilter(state, { loc: "L0" }).length).toBe(1);
  });

  it("compound filters AND together", () => {
    registerCreatureDef("c");
    registerActionDef("a");
    const state = makeSingleLocationState();
    writePastEntry(state, getCard(state.cards, spawn(state, "c")), "player", "L0");
    writePastEntry(state, getCard(state.cards, spawn(state, "a")), "ai", "L0");
    writePastEntry(state, getCard(state.cards, spawn(state, "a")), "player", "L0");
    const results = pastEntriesMatchingFilter(state, {
      side: "player",
      cardType: "action",
    });
    expect(results.length).toBe(1);
    expect(results[0]!.side).toBe("player");
    expect(results[0]!.cardType).toBe("action");
  });
});
