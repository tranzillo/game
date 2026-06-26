import { describe, it, expect, beforeEach } from "vitest";
import { gatherSwings, sortSwingsInPlace } from "../src/engine/combat-order.ts";
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

describe("gatherSwings", () => {
  it("emits one swing per eligible creature per pattern (default = 1 pattern)", () => {
    registerCreatureDef("c", { force: 2 });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], b, false);

    const swings = gatherSwings(state);
    expect(swings.length).toBe(2);
    expect(swings.every((s) => s.pattern.kind === "default")).toBe(true);
    expect(swings.every((s) => s.forceAtSwing === 2)).toBe(true);
  });

  it("excludes face-down creatures (combat-eligibility fails)", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, true /* face down */);
    expect(gatherSwings(state)).toEqual([]);
  });

  it("excludes 0-Force creatures", () => {
    registerCreatureDef("c", { force: 0 });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], a, false);
    expect(gatherSwings(state)).toEqual([]);
  });

  it("emits swings for both sides", () => {
    registerCreatureDef("c", { force: 1 });
    const state = makeSingleLocationState();
    const p = getCard(state.cards, spawn(state, "c"));
    const a = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);

    const swings = gatherSwings(state);
    expect(swings.length).toBe(2);
    expect(swings.map((s) => s.side).sort()).toEqual(["ai", "player"]);
  });

  it("deduplicates multi-slot creatures (one swing, not N)", () => {
    registerCreatureDef("big", {
      force: 3,
      footprint: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
    });
    const state = makeSingleLocationState();
    const big = getCard(state.cards, spawn(state, "big"));
    placeAt(state, "player", "L0", "creature", ["r0c0", "r0c1"], big, false);

    const swings = gatherSwings(state);
    expect(swings.length).toBe(1);
    expect(swings[0]!.attacker.instId).toBe(big.instId);
  });
});

describe("sortSwingsInPlace — four-level Tempo order", () => {
  it("sorts by Tempo descending", () => {
    registerCreatureDef("fast", { force: 1, tempo: 5 });
    registerCreatureDef("slow", { force: 1, tempo: 1 });
    const state = makeSingleLocationState();
    const fast = getCard(state.cards, spawn(state, "fast"));
    const slow = getCard(state.cards, spawn(state, "slow"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], fast, false);
    placeAt(state, "player", "L0", "creature", ["r0c1"], slow, false);

    const sorted = sortSwingsInPlace(state, gatherSwings(state));
    expect(sorted[0]!.attacker.instId).toBe(fast.instId);
    expect(sorted[1]!.attacker.instId).toBe(slow.instId);
  });

  it("on Tempo tie, sorts by location order (left-to-right across encounter)", () => {
    registerCreatureDef("c", { force: 1, tempo: 2 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const at0 = getCard(state.cards, spawn(state, "c"));
    const at1 = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L1", "creature", ["r0c0"], at1, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], at0, false);

    const sorted = sortSwingsInPlace(state, gatherSwings(state));
    expect(sorted[0]!.loc).toBe("L0");
    expect(sorted[1]!.loc).toBe("L1");
  });

  it("on Tempo + location tie, sorts by position rank (front-to-back, left-to-right)", () => {
    registerCreatureDef("c", { force: 1, tempo: 2 });
    const state = makeSingleLocationState();
    const left = getCard(state.cards, spawn(state, "c"));
    const right = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c1"], right, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], left, false);

    const sorted = sortSwingsInPlace(state, gatherSwings(state));
    expect(sorted[0]!.attackerPosKey).toBe("r0c0");
    expect(sorted[1]!.attackerPosKey).toBe("r0c1");
  });

  it("on all-tie, sorts by firstSide priority", () => {
    registerCreatureDef("c", { force: 1, tempo: 2 });
    const state = makeSingleLocationState();
    state.currentEncounter!.firstSide = "ai";

    const p = getCard(state.cards, spawn(state, "c"));
    const a = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], p, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);

    const sorted = sortSwingsInPlace(state, gatherSwings(state));
    // Same Tempo, same loc, same posKey r0c0 — side priority: firstSide=ai wins.
    expect(sorted[0]!.side).toBe("ai");
    expect(sorted[1]!.side).toBe("player");
  });
});

describe("cross-location combat — integration", () => {
  it("Tempo-3 at L1 swings before Tempo-1 at L0", () => {
    registerCreatureDef("fast", { force: 1, tempo: 3 });
    registerCreatureDef("slow", { force: 1, tempo: 1 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const slow = getCard(state.cards, spawn(state, "slow"));
    const fast = getCard(state.cards, spawn(state, "fast"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], slow, false);
    placeAt(state, "player", "L1", "creature", ["r0c0"], fast, false);

    const sorted = sortSwingsInPlace(state, gatherSwings(state));
    // Tempo dominates location order.
    expect(sorted[0]!.attacker.instId).toBe(fast.instId);
    expect(sorted[1]!.attacker.instId).toBe(slow.instId);
  });

  it("Tempo tie → L0's attacker goes before L1's", () => {
    registerCreatureDef("c", { force: 1, tempo: 2 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const at1 = getCard(state.cards, spawn(state, "c"));
    const at0 = getCard(state.cards, spawn(state, "c"));
    // Insert in reverse order to verify sort isn't using insertion order.
    placeAt(state, "player", "L1", "creature", ["r0c0"], at1, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], at0, false);

    const sorted = sortSwingsInPlace(state, gatherSwings(state));
    expect(sorted[0]!.loc).toBe("L0");
    expect(sorted[1]!.loc).toBe("L1");
  });

  it("each location resolves independently: attackers hit creatures in their own loc only", () => {
    registerCreatureDef("p", { force: 1 });
    registerCreatureDef("a", { durability: 5 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const playerAtL0 = getCard(state.cards, spawn(state, "p"));
    const playerAtL1 = getCard(state.cards, spawn(state, "p"));
    const aiAtL0 = getCard(state.cards, spawn(state, "a", "biome"));
    const aiAtL1 = getCard(state.cards, spawn(state, "a", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], playerAtL0, false);
    placeAt(state, "player", "L1", "creature", ["r0c0"], playerAtL1, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], aiAtL0, false);
    placeAt(state, "ai", "L1", "creature", ["r0c0"], aiAtL1, false);

    const swings = sortSwingsInPlace(state, gatherSwings(state));
    // 4 swings (2 player + 2 AI).
    expect(swings.length).toBe(4);
    // Each player swing targets the AI creature at its own loc (via default melee = across same column).
    const playerSwings = swings.filter((s) => s.side === "player");
    expect(playerSwings.length).toBe(2);
    expect(playerSwings.map((s) => s.loc).sort()).toEqual(["L0", "L1"]);
  });
});
