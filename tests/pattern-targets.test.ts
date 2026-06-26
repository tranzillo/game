import { describe, it, expect, beforeEach } from "vitest";
import { patternTargets } from "../src/engine/pattern-targets.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("patternTargets — default melee", () => {
  it("targets the creature directly across in the same column", () => {
    registerCreatureDef("p", { force: 2 });
    registerCreatureDef("a");
    const state = makeSingleLocationState();
    const attacker = getCard(state.cards, spawn(state, "p"));
    const defender = getCard(state.cards, spawn(state, "a"));
    placeAt(state, "player", "L0", "creature", ["r0c1"], attacker, false);
    placeAt(state, "ai", "L0", "creature", ["r0c1"], defender, false);

    const result = patternTargets(
      state,
      attacker,
      "player",
      "L0",
      { kind: "default" },
      2,
    );

    expect(result).not.toBeNull();
    expect(result!.targetMode).toBe("single");
    expect(result!.creatureTargets).toEqual([defender.instId]);
    expect(result!.damagePerTarget).toBe(2);
    expect(result!.damageKind).toBe("melee");
  });

  it("returns empty creatureTargets if no creature is across", () => {
    registerCreatureDef("p", { force: 2 });
    const state = makeSingleLocationState();
    const attacker = getCard(state.cards, spawn(state, "p"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], attacker, false);

    const result = patternTargets(
      state,
      attacker,
      "player",
      "L0",
      { kind: "default" },
      2,
    );

    expect(result).not.toBeNull();
    expect(result!.creatureTargets).toEqual([]);
  });

  it("does NOT target a face-down enemy across (face-down cards haven't entered play)", () => {
    registerCreatureDef("p", { force: 2 });
    registerCreatureDef("a");
    const state = makeSingleLocationState();
    const attacker = getCard(state.cards, spawn(state, "p"));
    const facedown = getCard(state.cards, spawn(state, "a", "aiDeck"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], attacker, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], facedown, false);
    facedown.revealed = false; // committed face-down — not yet in play

    const result = patternTargets(state, attacker, "player", "L0", { kind: "default" }, 2);
    expect(result!.creatureTargets).toEqual([]); // empty → orchestrator falls through to summoner
  });

  it("picks the first occupied row in the same column when multiple rows exist", () => {
    registerCreatureDef("p", { force: 1 });
    registerCreatureDef("a");
    const state = makeSingleLocationState();
    const attacker = getCard(state.cards, spawn(state, "p"));
    const back = getCard(state.cards, spawn(state, "a"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], attacker, false);
    // Put defender only at r1c0 — across should still find them since profile.across iterates rows.
    placeAt(state, "ai", "L0", "creature", ["r1c0"], back, false);

    const result = patternTargets(
      state,
      attacker,
      "player",
      "L0",
      { kind: "default" },
      1,
    );

    expect(result!.creatureTargets).toEqual([back.instId]);
  });
});

describe("patternTargets — unimplemented patterns", () => {
  it("returns null for unknown pattern kinds", () => {
    registerCreatureDef("p");
    const state = makeSingleLocationState();
    const attacker = getCard(state.cards, spawn(state, "p"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], attacker, false);

    expect(
      patternTargets(state, attacker, "player", "L0", { kind: "wibble" }, 1),
    ).toBeNull();
  });
});

describe("patternTargets — ranged", () => {
  it("targets the front creature in its column (same front-first rule as melee), not the back", () => {
    // Ranged targeting is IDENTICAL to melee: hit the space across in the attacker's column,
    // front-first. The only ranged/melee difference is WHERE THE ATTACKER FIRES FROM (ranged may
    // fire from the back row), which is a combat-eligibility concern, not a targeting one.
    registerCreatureDef("archer", { force: 2 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const archer = getCard(state.cards, spawn(state, "archer"));
    const front = getCard(state.cards, spawn(state, "foe", "biome"));
    const back = getCard(state.cards, spawn(state, "foe", "biome"));
    // Archer fires from the back row of column 0; enemies in front and back of column 0.
    placeAt(state, "player", "L0", "creature", ["r1c0"], archer, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], front, false);
    placeAt(state, "ai", "L0", "creature", ["r1c0"], back, false);

    const result = patternTargets(state, archer, "player", "L0", { kind: "ranged" }, 2);

    expect(result).not.toBeNull();
    expect(result!.damageKind).toBe("ranged");
    expect(result!.targetMode).toBe("single");
    expect(result!.creatureTargets).toEqual([front.instId]); // front only, back is shielded
    expect(result!.damagePerTarget).toBe(2);
  });

  it("reaches the back creature only when the front of the column is empty", () => {
    registerCreatureDef("archer", { force: 2 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const archer = getCard(state.cards, spawn(state, "archer"));
    const back = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], archer, false);
    placeAt(state, "ai", "L0", "creature", ["r1c0"], back, false); // only a back-row enemy in col 0

    const result = patternTargets(state, archer, "player", "L0", { kind: "ranged" }, 2);

    expect(result!.creatureTargets).toEqual([back.instId]); // front empty → reach the back
  });

  it("returns empty creatureTargets if no enemies present (orchestrator falls through)", () => {
    registerCreatureDef("archer", { force: 2 });
    const state = makeSingleLocationState();
    const archer = getCard(state.cards, spawn(state, "archer"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], archer, false);

    const result = patternTargets(
      state,
      archer,
      "player",
      "L0",
      { kind: "ranged" },
      2,
    );

    expect(result!.creatureTargets).toEqual([]);
  });

  it("pattern.setDamage overrides attacker Force (equipment-set-Force)", () => {
    registerCreatureDef("giant", { force: 4 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const giant = getCard(state.cards, spawn(state, "giant"));
    const foe = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], giant, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], foe, false);

    const result = patternTargets(
      state,
      giant,
      "player",
      "L0",
      { kind: "ranged", setDamage: 1 }, // bow with Force 1
      4, // giant's Force
    );

    expect(result!.damagePerTarget).toBe(1);
  });

  it("pattern.setDamage of 0 turns a giant into a 0-damage shot", () => {
    registerCreatureDef("giant", { force: 4 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const giant = getCard(state.cards, spawn(state, "giant"));
    const foe = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], giant, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], foe, false);

    const result = patternTargets(
      state,
      giant,
      "player",
      "L0",
      { kind: "ranged", setDamage: 0 },
      4,
    );

    expect(result!.damagePerTarget).toBe(0);
  });

  it("without setDamage, ranged damage is the attacker's Force", () => {
    registerCreatureDef("archer", { force: 3 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const archer = getCard(state.cards, spawn(state, "archer"));
    const foe = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r1c0"], archer, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], foe, false);

    const result = patternTargets(
      state,
      archer,
      "player",
      "L0",
      { kind: "ranged" },
      3,
    );

    expect(result!.damagePerTarget).toBe(3);
  });
});

describe("patternTargets — cleave", () => {
  it("hits primary + same-row neighbors on the opposing side", () => {
    registerCreatureDef("axer", { force: 2 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const axer = getCard(state.cards, spawn(state, "axer"));
    const primary = getCard(state.cards, spawn(state, "foe", "biome"));
    const neighbor = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c1"], axer, false);
    // Place defenders at r0c1 (primary across) and r0c0 (same-row neighbor).
    placeAt(state, "ai", "L0", "creature", ["r0c1"], primary, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], neighbor, false);

    const result = patternTargets(state, axer, "player", "L0", { kind: "cleave" }, 2);

    expect(result).not.toBeNull();
    expect(result!.damageKind).toBe("melee");
    expect(result!.targetMode).toBe("multi-each");
    expect(result!.creatureTargets.sort()).toEqual([primary.instId, neighbor.instId].sort());
    expect(result!.damagePerTarget).toBe(2);
  });

  it("hits only the primary if no same-row neighbors are occupied", () => {
    registerCreatureDef("axer", { force: 2 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const axer = getCard(state.cards, spawn(state, "axer"));
    const primary = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c1"], axer, false);
    placeAt(state, "ai", "L0", "creature", ["r0c1"], primary, false);

    const result = patternTargets(state, axer, "player", "L0", { kind: "cleave" }, 2);

    expect(result!.creatureTargets).toEqual([primary.instId]);
  });

  it("returns empty when no primary target is across (fall-through territory)", () => {
    registerCreatureDef("axer", { force: 2 });
    const state = makeSingleLocationState();
    const axer = getCard(state.cards, spawn(state, "axer"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], axer, false);

    const result = patternTargets(state, axer, "player", "L0", { kind: "cleave" }, 2);
    expect(result!.creatureTargets).toEqual([]);
  });
});

describe("patternTargets — pierce", () => {
  it("hits primary + the space directly behind", () => {
    registerCreatureDef("piker", { force: 2 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const piker = getCard(state.cards, spawn(state, "piker"));
    const front = getCard(state.cards, spawn(state, "foe", "biome"));
    const back = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], piker, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], front, false);
    placeAt(state, "ai", "L0", "creature", ["r1c0"], back, false);

    const result = patternTargets(state, piker, "player", "L0", { kind: "pierce", value: 1 }, 2);

    expect(result).not.toBeNull();
    expect(result!.damageKind).toBe("melee");
    expect(result!.targetMode).toBe("multi-each");
    expect(result!.creatureTargets).toEqual([front.instId, back.instId]);
    expect(result!.damagePerTarget).toBe(2);
  });

  it("hits only primary when there's no creature behind", () => {
    registerCreatureDef("piker", { force: 2 });
    registerCreatureDef("foe");
    const state = makeSingleLocationState();
    const piker = getCard(state.cards, spawn(state, "piker"));
    const front = getCard(state.cards, spawn(state, "foe", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], piker, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], front, false);

    const result = patternTargets(state, piker, "player", "L0", { kind: "pierce", value: 1 }, 2);
    expect(result!.creatureTargets).toEqual([front.instId]);
  });

  it("returns empty when no primary target is across", () => {
    registerCreatureDef("piker", { force: 2 });
    const state = makeSingleLocationState();
    const piker = getCard(state.cards, spawn(state, "piker"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], piker, false);

    const result = patternTargets(state, piker, "player", "L0", { kind: "pierce", value: 1 }, 2);
    expect(result!.creatureTargets).toEqual([]);
  });
});
