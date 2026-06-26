import { describe, it, expect, beforeEach } from "vitest";
import {
  allCreatureTargets,
  countOccupiedCreatureSlots,
  creatureTargetsOnSide,
  enemyCreatureTargets,
  enemyFrontRowTargets,
  friendlyCreatureTargets,
  isTargetable,
  occupiedCreatureSlots,
  primaryTargetInFront,
} from "../src/engine/targeting.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

// Helper: place a creature and set its face-up/face-down state explicitly. Uses a per-position
// def key so repeated calls in one test don't re-register the same def (which throws).
let defCounter = 0;
function place(
  state: ReturnType<typeof makeSingleLocationState>,
  side: "player" | "ai",
  pos: string,
  revealed: boolean,
  origin: "playerDeck" | "aiDeck" | "biome" = side === "ai" ? "aiDeck" : "playerDeck",
) {
  const key = `tc${defCounter++}`;
  registerCreatureDef(key);
  const card = getCard(state.cards, spawn(state, key, origin));
  placeAt(state, side, "L0", "creature", [pos], card, false);
  card.revealed = revealed;
  return card;
}

describe("isTargetable", () => {
  it("true for a face-up card, false for a face-down card", () => {
    const state = makeSingleLocationState();
    const up = place(state, "ai", "r0c0", true);
    const down = place(state, "ai", "r0c1", false);
    expect(isTargetable(up)).toBe(true);
    expect(isTargetable(down)).toBe(false);
  });
});

describe("creature gatherers exclude face-down cards", () => {
  it("enemyCreatureTargets returns only face-up enemy creatures", () => {
    const state = makeSingleLocationState();
    const up = place(state, "ai", "r0c0", true);
    place(state, "ai", "r0c1", false); // face-down — must be excluded
    expect(enemyCreatureTargets(state, "player", "L0")).toEqual([up.instId]);
  });

  it("friendlyCreatureTargets returns only face-up own-side creatures", () => {
    const state = makeSingleLocationState();
    const up = place(state, "player", "r0c0", true);
    place(state, "player", "r0c1", false);
    expect(friendlyCreatureTargets(state, "player", "L0")).toEqual([up.instId]);
  });

  it("allCreatureTargets spans both sides, face-up only", () => {
    const state = makeSingleLocationState();
    const pUp = place(state, "player", "r0c0", true);
    const aUp = place(state, "ai", "r0c0", true);
    place(state, "player", "r1c0", false);
    place(state, "ai", "r1c0", false);
    expect(allCreatureTargets(state, "L0").sort()).toEqual([pUp.instId, aUp.instId].sort());
  });

  it("creatureTargetsOnSide honors the explicit side (friendly-fire path)", () => {
    const state = makeSingleLocationState();
    const up = place(state, "player", "r0c0", true);
    place(state, "ai", "r0c0", true); // different side — must NOT appear
    expect(creatureTargetsOnSide(state, "player", "L0")).toEqual([up.instId]);
  });

  it("enemyFrontRowTargets returns only face-up front-row enemies", () => {
    const state = makeSingleLocationState();
    const front = place(state, "ai", "r0c0", true);
    place(state, "ai", "r0c1", false); // front but face-down
    place(state, "ai", "r1c0", true); // back row, face-up — excluded (not front)
    expect(enemyFrontRowTargets(state, "player", "L0")).toEqual([front.instId]);
  });
});

describe("slot occupancy INCLUDES face-down cards (the other axis)", () => {
  it("occupiedCreatureSlots counts face-down occupants (unlike the targeting gatherers)", () => {
    const state = makeSingleLocationState();
    const up = place(state, "player", "r0c0", true);
    const down = place(state, "player", "r0c1", false);
    // Occupancy: both count. Targetability: only the face-up one.
    expect(occupiedCreatureSlots(state, "player", "L0").sort()).toEqual([up.instId, down.instId].sort());
    expect(friendlyCreatureTargets(state, "player", "L0")).toEqual([up.instId]);
  });

  it("countOccupiedCreatureSlots counts both sides' face-down occupants", () => {
    const state = makeSingleLocationState();
    place(state, "ai", "r0c0", true);
    place(state, "ai", "r0c1", false);
    place(state, "ai", "r1c0", false);
    expect(countOccupiedCreatureSlots(state, "ai", "L0")).toBe(3); // all three slots occupied
  });
});

describe("primaryTargetInFront — the default combat/action primary target", () => {
  it("ignores a face-down front-row card and reaches the face-up card behind it", () => {
    const state = makeSingleLocationState();
    registerCreatureDef("atk", { force: 2 });
    const attacker = getCard(state.cards, spawn(state, "atk"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], attacker, false);
    // Column 0: face-DOWN in front, face-UP behind. A face-down card hasn't entered play, so it
    // neither blocks nor is targetable — the swing reaches the live card behind it.
    place(state, "ai", "r0c0", false);
    const behind = place(state, "ai", "r1c0", true);

    const primary = primaryTargetInFront(state, attacker, "player", "L0");
    expect(primary?.instId).toBe(behind.instId);
  });

  it("returns null when the only enemy in the column is face-down", () => {
    const state = makeSingleLocationState();
    registerCreatureDef("atk", { force: 2 });
    const attacker = getCard(state.cards, spawn(state, "atk"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], attacker, false);
    place(state, "ai", "r0c0", false); // face-down — not a legal target
    expect(primaryTargetInFront(state, attacker, "player", "L0")).toBeNull();
  });
});
