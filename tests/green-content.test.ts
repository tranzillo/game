import { describe, it, expect, beforeEach } from "vitest";
import {
  registerGreenContent,
  _resetGreenContentFlag,
} from "../src/data/green-content.ts";
import { spawnTokenAt } from "../src/engine/tokens.ts";
import { column } from "../src/engine/profile.ts";
import { getCard, getCardDef } from "../src/engine/cards.ts";
import { placeAt } from "../src/engine/slots.ts";
import {
  fireFlipUpTrigger,
  fireLeavePlayTrigger,
} from "../src/engine/triggers.ts";
import { applyDamage } from "../src/engine/damage.ts";
import { resetEngine, makeSingleLocationState, spawn } from "./helpers.ts";

beforeEach(() => {
  resetEngine();
  _resetGreenContentFlag();
  registerGreenContent();
});

describe("g3 Rebel Sapper — deathwish drops Explosive Trap", () => {
  it("handler is registered and runs without throwing", () => {
    const state = makeSingleLocationState();
    const sapper = getCard(state.cards, spawn(state, "g3"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], sapper, false);

    expect(() => fireLeavePlayTrigger(state, sapper, "player", "L0", "creatureDied")).not.toThrow();
  });
});

describe("g4 Rebel Slinger — ranged", () => {
  it("has a ranged attack pattern with ammoCost 1", () => {
    const def = getCardDef("g4");
    expect(def.attackPatterns?.length).toBe(1);
    expect(def.attackPatterns![0]!.kind).toBe("ranged");
    expect(def.attackPatterns![0]!.ammoCost).toBe(1);
  });
});

describe("g8 Rebel Saboteur — flip-up drops Explosive Trap on opposing front row", () => {
  it("handler is registered and runs without throwing", () => {
    const state = makeSingleLocationState();
    const sab = getCard(state.cards, spawn(state, "g8"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], sab, false);

    expect(() => fireFlipUpTrigger(state, sab, "player", "L0")).not.toThrow();
  });
});

// Find the position of the g_trap token on a side at L0 (or null if none).
function trapPos(
  state: ReturnType<typeof makeSingleLocationState>,
  side: "player" | "ai",
): string | null {
  const slots = state.world.nodeState["L0"]!.sideSlots[side].creatures;
  for (const [pos, instId] of Object.entries(slots)) {
    if (instId == null) continue;
    if (state.cards[instId]!.defKey === "g_trap") return pos;
  }
  return null;
}

describe("column()[0] — across-column front-row placement (the Saboteur uses this)", () => {
  it("maps a back-row anchor to the front-row slot in the same column", () => {
    const state = makeSingleLocationState();
    const profile = state.world.nodeState["L0"]!.profile;
    // column() returns the column front-to-back; [0] is the front-row cell.
    expect(column(profile, "creature", "r1c1")[0]).toBe("r0c1"); // col 1: back → front
    expect(column(profile, "creature", "r1c0")[0]).toBe("r0c0"); // col 0
    expect(column(profile, "creature", "r0c1")[0]).toBe("r0c1"); // already front
  });
});

describe("spawnTokenAt — generic token spawn, fizzles instead of throwing", () => {
  it("places a token at the requested slot and returns the result", () => {
    const state = makeSingleLocationState();
    const result = spawnTokenAt(state, "g_trap", "ai", "L0", "creature", ["r0c1"]);
    expect(result).not.toBeNull();
    expect(trapPos(state, "ai")).toBe("r0c1");
  });

  it("fizzles (returns null, spawns nothing) when the target slot is occupied", () => {
    const state = makeSingleLocationState();
    const blocker = getCard(state.cards, spawn(state, "g8", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c1"], blocker, false);
    const result = spawnTokenAt(state, "g_trap", "ai", "L0", "creature", ["r0c1"]);
    expect(result).toBeNull();
    expect(trapPos(state, "ai")).toBeNull(); // no trap created
  });

  it("fizzles when the target position doesn't exist in the profile", () => {
    const state = makeSingleLocationState();
    const result = spawnTokenAt(state, "g_trap", "player", "L0", "creature", ["r9c9"]);
    expect(result).toBeNull();
  });

  it("Saboteur placement: across-column front row (the composed behavior)", () => {
    // The Saboteur effect = column()[0] (placement math) + spawnTokenAt (generic spawn).
    const state = makeSingleLocationState();
    const profile = state.world.nodeState["L0"]!.profile;
    const dest = column(profile, "creature", "r1c1")[0]!; // Saboteur in back row, col 1
    spawnTokenAt(state, "g_trap", "ai", "L0", "creature", [dest]);
    expect(trapPos(state, "ai")).toBe("r0c1"); // enemy front row, same column
  });

  it("Sapper placement: the exact vacated slot (no front-row anchoring)", () => {
    const state = makeSingleLocationState();
    spawnTokenAt(state, "g_trap", "player", "L0", "creature", ["r1c1"]);
    expect(trapPos(state, "player")).toBe("r1c1"); // back row stays back row
  });
});

describe("g_trap Explosive Trap — token def", () => {
  it("is registered as an inert creature with 1 Durability", () => {
    const def = getCardDef("g_trap");
    expect(def.type).toBe("creature");
    expect(def.inert).toBe(true);
    expect(def.durability).toBe(1);
  });
});

describe("g6 Forage — ammo + escalating counter", () => {
  it("handler runs without throwing", () => {
    const state = makeSingleLocationState();
    const forage = getCard(state.cards, spawn(state, "g6"));
    placeAt(state, "player", "L0", "action", ["r0c0"], forage, false);

    expect(() => fireFlipUpTrigger(state, forage, "player", "L0")).not.toThrow();
  });
});

describe("melee attacker tracking on defender (for trap deathwish targeting)", () => {
  it("damage with kind=melee + attackerInstId records the attacker on defender.meleeAttackersThisTurn", () => {
    const state = makeSingleLocationState();
    const sab = getCard(state.cards, spawn(state, "g8"));
    const trap = getCard(state.cards, spawn(state, "g_trap"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], sab, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], trap, false);

    applyDamage({
      state,
      amount: 1,
      attackerSide: "ai",
      attackerInstId: sab.instId,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [trap.instId],
      enemySide: "player",
    });

    expect(trap.meleeAttackersThisTurn).toContain(sab.instId);
  });

  it("does NOT record action damage attackers", () => {
    const state = makeSingleLocationState();
    const target = getCard(state.cards, spawn(state, "g_trap"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], target, false);

    applyDamage({
      state,
      amount: 1,
      attackerSide: "ai",
      attackerInstId: null,
      loc: "L0",
      damageKind: "action",
      candidateCreatureTargets: [target.instId],
      enemySide: "player",
    });

    expect(target.meleeAttackersThisTurn).toEqual([]);
  });

  it("does NOT record when attackerInstId is null even on melee damage", () => {
    const state = makeSingleLocationState();
    const target = getCard(state.cards, spawn(state, "g_trap"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], target, false);

    applyDamage({
      state,
      amount: 1,
      attackerSide: "ai",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [target.instId],
      enemySide: "player",
    });

    expect(target.meleeAttackersThisTurn).toEqual([]);
  });

  it("dedups multiple swings from the same attacker", () => {
    const state = makeSingleLocationState();
    const sab = getCard(state.cards, spawn(state, "g8"));
    const trap = getCard(state.cards, spawn(state, "g_trap", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], sab, false);
    placeAt(state, "player", "L0", "creature", ["r0c0"], trap, false);

    for (let i = 0; i < 3; i++) {
      applyDamage({
        state,
        amount: 0, // 0 amount → no damage dealt → no tracking. Wait, the gate is on dealt > 0.
        attackerSide: "ai",
        attackerInstId: sab.instId,
        loc: "L0",
        damageKind: "melee",
        candidateCreatureTargets: [trap.instId],
        enemySide: "player",
      });
    }
    // With amount=0, no damage dealt, so the attacker isn't tracked.
    expect(trap.meleeAttackersThisTurn).toEqual([]);

    // Now with actual damage but defender's durability is still positive across both hits.
    // Set high durability for this part.
    trap.durability = 10;
    for (let i = 0; i < 3; i++) {
      applyDamage({
        state,
        amount: 1,
        attackerSide: "ai",
        attackerInstId: sab.instId,
        loc: "L0",
        damageKind: "melee",
        candidateCreatureTargets: [trap.instId],
        enemySide: "player",
      });
    }
    // Recorded once despite three hits.
    expect(trap.meleeAttackersThisTurn.filter((id) => id === sab.instId).length).toBe(1);
  });
});
