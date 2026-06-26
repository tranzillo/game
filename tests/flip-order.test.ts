import { describe, it, expect, beforeEach } from "vitest";
import { sortChipQueueInPlace } from "../src/engine/flip-order.ts";
import { emitFutureChip } from "../src/engine/timeline.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  makeMultiLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("flip ordering — Tempo descending (priority 1)", () => {
  it("higher tempo sorts before lower tempo", () => {
    registerCreatureDef("slow", { tempo: 1 });
    registerCreatureDef("fast", { tempo: 3 });
    const state = makeSingleLocationState();
    const slow = getCard(state.cards, spawn(state, "slow"));
    const fast = getCard(state.cards, spawn(state, "fast"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], slow, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], fast, false);
    const queue = [
      emitFutureChip(state, slow, "player", "L0", "creature", "r0c0", null),
      emitFutureChip(state, fast, "player", "L0", "creature", "r0c1", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.cardInstId).toBe(fast.instId);
    expect(queue[1]!.cardInstId).toBe(slow.instId);
  });

  it("negative tempo sorts last", () => {
    registerCreatureDef("neg", { tempo: -1 });
    registerCreatureDef("zero", { tempo: 0 });
    const state = makeSingleLocationState();
    const neg = getCard(state.cards, spawn(state, "neg"));
    const zero = getCard(state.cards, spawn(state, "zero"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], neg, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], zero, false);
    const queue = [
      emitFutureChip(state, neg, "player", "L0", "creature", "r0c0", null),
      emitFutureChip(state, zero, "player", "L0", "creature", "r0c1", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.cardInstId).toBe(zero.instId);
    expect(queue[1]!.cardInstId).toBe(neg.instId);
  });
});

describe("flip ordering — Location order (priority 2)", () => {
  it("on tempo tie, earlier location sorts first", () => {
    registerCreatureDef("c");
    const state = makeMultiLocationState(["L0", "L1"]);
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L1", "creature", ["r0c0"], b, false);
    const queue = [
      emitFutureChip(state, b, "player", "L1", "creature", "r0c0", null),
      emitFutureChip(state, a, "player", "L0", "creature", "r0c0", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.loc).toBe("L0");
    expect(queue[1]!.loc).toBe("L1");
  });
});

describe("flip ordering — Position rank (priority 3)", () => {
  it("within a location at tempo tie, r0c0 sorts before r0c1", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], b, false);
    const queue = [
      emitFutureChip(state, b, "player", "L0", "creature", "r0c1", null),
      emitFutureChip(state, a, "player", "L0", "creature", "r0c0", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.posKey).toBe("r0c0");
    expect(queue[1]!.posKey).toBe("r0c1");
  });

  it("front row sorts before back row", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const front = getCard(state.cards, spawn(state, "c"));
    const back = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], front, false);
    placeAt(state, "player", "L0", "creature", ["r1c0"], back, false);
    const queue = [
      emitFutureChip(state, back, "player", "L0", "creature", "r1c0", null),
      emitFutureChip(state, front, "player", "L0", "creature", "r0c0", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.posKey).toBe("r0c0");
    expect(queue[1]!.posKey).toBe("r1c0");
  });
});

describe("flip ordering — Side priority (priority 4)", () => {
  it("on all-equal except side, firstSide wins when local tempo is tied", () => {
    registerCreatureDef("c", { tempo: 1 });
    const state = makeSingleLocationState();
    state.currentEncounter!.firstSide = "player";
    const p = getCard(state.cards, spawn(state, "c"));
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);
    const queue = [
      emitFutureChip(state, a, "ai", "L0", "creature", "r0c0", null),
      emitFutureChip(state, p, "player", "L0", "creature", "r0c0", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.side).toBe("player");
    expect(queue[1]!.side).toBe("ai");
  });

  it("firstSide=ai flips the tied resolution order", () => {
    registerCreatureDef("c", { tempo: 1 });
    const state = makeSingleLocationState();
    state.currentEncounter!.firstSide = "ai";
    const p = getCard(state.cards, spawn(state, "c"));
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);
    const queue = [
      emitFutureChip(state, p, "player", "L0", "creature", "r0c0", null),
      emitFutureChip(state, a, "ai", "L0", "creature", "r0c0", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.side).toBe("ai");
    expect(queue[1]!.side).toBe("player");
  });

  it("initiative wins Tempo ties regardless of local tempo totals (2026-06-12 revision)", () => {
    // Two tempo-0 chips from opposite sides. The player side has a high-tempo creature
    // contributing to its LOCAL tempo total — under the superseded rule that would have given
    // the player side priority. Under the revised rule, local tempo totals play no role in
    // side ordering: initiative (firstSide=ai) wins the tie.
    registerCreatureDef("zero", { tempo: 0 });
    registerCreatureDef("hi", { tempo: 5 });
    const state = makeSingleLocationState();
    state.currentEncounter!.firstSide = "ai";
    const playerHi = getCard(state.cards, spawn(state, "hi"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], playerHi, false);
    const p = getCard(state.cards, spawn(state, "zero"));
    const a = getCard(state.cards, spawn(state, "zero", "aiDeck"));
    placeAt(state, "player", "L0", "creature", ["r0c1"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c1"], a, false);
    const queue = [
      emitFutureChip(state, p, "player", "L0", "creature", "r0c1", null),
      emitFutureChip(state, a, "ai", "L0", "creature", "r0c1", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.side).toBe("ai");
    expect(queue[1]!.side).toBe("player");
  });

  it("initiative side resolves ALL its chips in a tier before the other side's (side before location)", () => {
    // Same tempo, two locations. Initiative side's chip at the LATER location still resolves
    // before the other side's chip at the EARLIER location — side outranks location order.
    registerCreatureDef("c", { tempo: 1 });
    const state = makeMultiLocationState(["L0", "L1"]);
    state.currentEncounter!.firstSide = "player";
    const pAtL1 = getCard(state.cards, spawn(state, "c"));
    const aAtL0 = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "player", "L1", "creature", ["r0c0"], pAtL1, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], aAtL0, false);
    const queue = [
      emitFutureChip(state, aAtL0, "ai", "L0", "creature", "r0c0", null),
      emitFutureChip(state, pAtL1, "player", "L1", "creature", "r0c0", null),
    ];
    sortChipQueueInPlace(state, queue);
    expect(queue[0]!.side).toBe("player");
    expect(queue[0]!.loc).toBe("L1");
    expect(queue[1]!.side).toBe("ai");
  });
});

describe("flip ordering — multi-criterion", () => {
  it("tempo trumps location, location trumps position, position trumps side", () => {
    // Set up four chips that test each priority transition:
    //   high-tempo at L1 r1c0 ai
    //   low-tempo at L0 r0c0 player
    //   med-tempo at L0 r0c0 player  ← would beat low + at r0c0 by tempo
    //   med-tempo at L1 r0c0 ai      ← med tempo same as 3, then loc tiebreak (L1 > L0)
    registerCreatureDef("hi", { tempo: 5 });
    registerCreatureDef("med", { tempo: 2 });
    registerCreatureDef("lo", { tempo: 1 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const hi = getCard(state.cards, spawn(state, "hi", "aiDeck"));
    const lo = getCard(state.cards, spawn(state, "lo"));
    const med1 = getCard(state.cards, spawn(state, "med"));
    const med2 = getCard(state.cards, spawn(state, "med", "aiDeck"));
    placeAt(state, "ai", "L1", "creature", ["r1c0"], hi, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], lo, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], med1, false);
    placeAt(state, "ai", "L1", "creature", ["r0c0"], med2, false);
    const queue = [
      emitFutureChip(state, hi, "ai", "L1", "creature", "r1c0", null),
      emitFutureChip(state, lo, "player", "L0", "creature", "r0c0", null),
      emitFutureChip(state, med1, "player", "L0", "creature", "r0c1", null),
      emitFutureChip(state, med2, "ai", "L1", "creature", "r0c0", null),
    ];
    sortChipQueueInPlace(state, queue);
    // Expected order: hi (tempo 5) → med1 (tempo 2, L0) → med2 (tempo 2, L1) → lo (tempo 1)
    expect(queue.map((c) => c.cardInstId)).toEqual([
      hi.instId,
      med1.instId,
      med2.instId,
      lo.instId,
    ]);
  });
});
