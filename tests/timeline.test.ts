import { describe, it, expect, beforeEach } from "vitest";
import {
  buildPendingPreviewChips,
  emitFutureChip,
  markChipResolved,
  removeChipForCard,
  pastEntriesMatchingFilter,
} from "../src/engine/timeline.ts";
import { placeAt, removeFrom } from "../src/engine/slots.ts";
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
    expect(state.timeline).toContain(chip);
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

  it("action chip caches location tempo total (actions don't print stats)", () => {
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

  it("structure chip caches its PRINTED tempo, not the location total (2026-06-12: permanents flip on their own tempo)", () => {
    registerCreatureDef("c", { tempo: 2 });
    registerStructureDef("s"); // no printed tempo → 0
    const state = makeSingleLocationState();
    const creature = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], creature, false);
    const struct = getCard(state.cards, spawn(state, "s"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], struct, false);
    const chip = emitFutureChip(state, struct, "player", "L0", "structure", "r0c0", null);
    expect(chip.cachedTempo).toBe(0); // printed tempo, location total (2) plays no role
  });

  it("chip tempo doesn't change if location tempo changes afterward (cached at commit)", () => {
    registerCreatureDef("c", { tempo: 2 });
    registerActionDef("a");
    const state = makeSingleLocationState();
    const creature = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], creature, false);
    const action = getCard(state.cards, spawn(state, "a"));
    placeAt(state, "player", "L0", "action", ["r0c0"], action, false);
    const chip = emitFutureChip(state, action, "player", "L0", "action", "r0c0", null);
    expect(chip.cachedTempo).toBe(2);
    // Now remove the creature; chip tempo stays cached
    state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"] = null;
    expect(chip.cachedTempo).toBe(2);
  });
});

describe("buildPendingPreviewChips — real-time future preview", () => {
  it("returns a preview chip per pending placement, with commit-formula tempo", () => {
    registerCreatureDef("fast", { tempo: 2 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "fast"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, true /* pending */);

    const previews = buildPendingPreviewChips(state);
    expect(previews.length).toBe(1);
    expect(previews[0]!.cardInstId).toBe(card.instId);
    expect(previews[0]!.state).toBe("future");
    expect(previews[0]!.cachedTempo).toBe(2); // same formula as commit
    expect(previews[0]!.chipId).toBeLessThan(0); // ephemeral, never stored
    expect(state.timeline).toEqual([]); // not added to real timeline
  });

  it("canceling a pending placement removes its preview", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, true);
    expect(buildPendingPreviewChips(state).length).toBe(1);

    removeFrom(state, "player", "L0", "creature", card, true);
    expect(buildPendingPreviewChips(state).length).toBe(0);
  });

  it("dedups multi-slot pending cards (one preview chip)", () => {
    registerCreatureDef("big", {
      footprint: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
    });
    const state = makeSingleLocationState();
    const big = getCard(state.cards, spawn(state, "big"));
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], big, true);

    expect(buildPendingPreviewChips(state).length).toBe(1);
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
    expect(state.timeline).toContain(chip);
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
    expect(state.timeline).toEqual([]);
    expect(state.currentEncounter!.flipQueues.startOfPhase).toEqual([]);
  });
});

// The Past is now the RESOLVED chips in the run-scoped timeline (DECISIONS 2026-06-13). A chip
// becomes Past by emitFutureChip → markChipResolved; it carries its {encounter,turn,phase,loc,
// side,cardType} from emission. This helper plays a chip through to resolved.
function resolveChip(
  state: ReturnType<typeof makeSingleLocationState>,
  defKey: string,
  side: "player" | "ai",
  loc: string,
  kind: "creature" | "structure" | "action" = "creature",
) {
  const card = getCard(state.cards, spawn(state, defKey));
  const chip = emitFutureChip(state, card, side, loc, kind, "r0c0", null);
  markChipResolved(state, chip);
  return chip;
}

describe("resolved chips ARE the Past", () => {
  it("a resolved chip carries the full timestamp from emission", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.turn = 4;
    state.currentEncounter!.encounterNo = 2;
    state.currentEncounter!.phase = "main";
    const chip = resolveChip(state, "c", "player", "L0");
    expect(chip.state).toBe("resolved");
    expect({
      side: chip.side,
      loc: chip.loc,
      encounter: chip.encounter,
      turn: chip.turn,
      phase: chip.phase,
      cardType: chip.cardType,
    }).toEqual({
      side: "player",
      loc: "L0",
      encounter: 2,
      turn: 4,
      phase: "main",
      cardType: "creature",
    });
  });

  it("preserves append order across multiple resolutions", () => {
    registerCreatureDef("c");
    registerActionDef("a");
    const state = makeSingleLocationState();
    resolveChip(state, "c", "player", "L0", "creature");
    resolveChip(state, "a", "ai", "L0", "action");
    expect(pastEntriesMatchingFilter(state, {}).map((e) => e.cardType)).toEqual([
      "creature",
      "action",
    ]);
  });

  it("the Past reads in FLIP (resolution) order, not commit/append order", () => {
    // Chips are appended to state.timeline in COMMIT order, but flip in sorted Tempo/initiative
    // order. The Past must reflect the order they actually flipped. Here we commit three chips,
    // then resolve them in a DIFFERENT order — the Past must follow the resolution order.
    registerCreatureDef("first");
    registerCreatureDef("second");
    registerCreatureDef("third");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "first"));
    const b = getCard(state.cards, spawn(state, "second"));
    const c = getCard(state.cards, spawn(state, "third"));
    // Commit order: a, b, c.
    const chipA = emitFutureChip(state, a, "player", "L0", "creature", "r0c0", null);
    const chipB = emitFutureChip(state, b, "player", "L0", "creature", "r0c1", null);
    const chipC = emitFutureChip(state, c, "player", "L0", "creature", "r1c0", null);
    // Resolve order (e.g. by Tempo): c, a, b.
    markChipResolved(state, chipC);
    markChipResolved(state, chipA);
    markChipResolved(state, chipB);

    const pastDefKeys = pastEntriesMatchingFilter(state, {}).map(
      (e) => state.cards[e.cardInstId]!.defKey,
    );
    expect(pastDefKeys).toEqual(["third", "first", "second"]);
  });
});

describe("pastEntriesMatchingFilter (over resolved chips)", () => {
  it("filters by side", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    resolveChip(state, "c", "player", "L0");
    resolveChip(state, "c", "ai", "L0");
    expect(pastEntriesMatchingFilter(state, { side: "player" }).length).toBe(1);
    expect(pastEntriesMatchingFilter(state, { side: "ai" }).length).toBe(1);
  });

  it("filters by cardType", () => {
    registerCreatureDef("c");
    registerActionDef("a");
    registerStructureDef("s");
    const state = makeSingleLocationState();
    resolveChip(state, "c", "player", "L0", "creature");
    resolveChip(state, "a", "player", "L0", "action");
    resolveChip(state, "s", "player", "L0", "structure");
    expect(pastEntriesMatchingFilter(state, { cardType: "action" }).length).toBe(1);
  });

  it("filters by loc", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    resolveChip(state, "c", "player", "L0");
    expect(pastEntriesMatchingFilter(state, { loc: "L1" }).length).toBe(0);
    expect(pastEntriesMatchingFilter(state, { loc: "L0" }).length).toBe(1);
  });

  it("compound filters AND together", () => {
    registerCreatureDef("c");
    registerActionDef("a");
    const state = makeSingleLocationState();
    resolveChip(state, "c", "player", "L0", "creature");
    resolveChip(state, "a", "ai", "L0", "action");
    resolveChip(state, "a", "player", "L0", "action");
    const results = pastEntriesMatchingFilter(state, {
      side: "player",
      cardType: "action",
    });
    expect(results.length).toBe(1);
    expect(results[0]!.side).toBe("player");
    expect(results[0]!.cardType).toBe("action");
  });

  it("only RESOLVED chips count as Past — future chips are excluded", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    emitFutureChip(state, card, "player", "L0", "creature", "r0c0", null); // stays future
    expect(pastEntriesMatchingFilter(state, {}).length).toBe(0);
  });

  it("Past is run-scoped: chips from a prior encounter survive, filterable by encounter", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.encounterNo = 1;
    resolveChip(state, "c", "player", "L0");
    // A new encounter begins (counter advances); the prior chip is NOT cleared.
    state.currentEncounter!.encounterNo = 2;
    resolveChip(state, "c", "ai", "L0");

    expect(pastEntriesMatchingFilter(state, {}).length).toBe(2); // both survive
    expect(pastEntriesMatchingFilter(state, { encounter: 1 }).length).toBe(1);
    expect(pastEntriesMatchingFilter(state, { encounter: 2 }).length).toBe(1);
  });
});
