import { describe, it, expect, beforeEach } from "vitest";
import {
  moveCreature,
  resetMovedThisTurn,
  commitMove,
  buildMoveResolutionQueue,
  resolvePendingMove,
  legalMoveTargets,
  checkMove,
} from "../src/engine/movement.ts";
import { canPlaceAt } from "../src/store/actions.ts";
import { subscribe } from "../src/engine/events.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import type { EngineEvent } from "../src/engine/types.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(() => {
  resetEngine();
  subscribe(null);
});

// Place a face-up creature on the player side at L0 and return it.
function placePlayer(
  state: ReturnType<typeof makeSingleLocationState>,
  defKey: string,
  pos: string,
  tempo = 0,
) {
  registerCreatureDef(defKey, { tempo });
  const card = getCard(state.cards, spawn(state, defKey));
  placeAt(state, "player", "L0", "creature", [pos], card, false);
  return card;
}

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

  it("NOT allowed during combat phase — inherent move is main-only", () => {
    // The inherent (enforced) creature move is committed in main and resolved at end of main.
    // Combat-phase movement only happens via printed effects (forced moves bypass the gate with
    // enforceTurnLimit:false).
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
    expect(result).toBe("wrongPhase");
  });

  it("a forced move (enforceTurnLimit:false) bypasses the main-only gate", () => {
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
      enforceTurnLimit: false, // programmatic / printed-effect move (e.g. Bully push)
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

// ---------- commitMove (queued, main-only, adjacency, reservation) ----------

describe("commitMove — validation & recording", () => {
  it("records a pending move to an orthogonally-adjacent empty slot", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0");
    expect(commitMove(state, c, "L0", "r0c1")).toBe("ok"); // row-adjacent
    expect(state.currentEncounter!.locationData["L0"]!.pendingMoves.get(c.instId)).toBe("r0c1");
    // Not executed yet — creature still at source.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(c.instId);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c1"]).toBeNull();
  });

  it("rejects a diagonal destination (orthogonal only)", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0");
    expect(commitMove(state, c, "L0", "r1c1")).toBe("notAdjacent"); // diagonal
  });

  it("rejects outside main phase", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const c = placePlayer(state, "c", "r0c0");
    expect(commitMove(state, c, "L0", "r0c1")).toBe("wrongPhase");
  });

  it("rejects a face-down creature (not in play)", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0");
    c.revealed = false;
    expect(commitMove(state, c, "L0", "r0c1")).toBe("notInPlay");
  });

  it("rejects a destination occupied by a real creature", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const a = placePlayer(state, "a", "r0c0");
    placePlayer(state, "b", "r0c1");
    expect(commitMove(state, a, "L0", "r0c1")).toBe("occupiedNow");
  });

  it("rejects a second move for the same creature", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0");
    expect(commitMove(state, c, "L0", "r0c1")).toBe("ok");
    expect(commitMove(state, c, "L0", "r1c0")).toBe("alreadyMoved");
  });

  it("rejects a destination already reserved by another pending move", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const a = placePlayer(state, "a", "r0c0");
    const b = placePlayer(state, "b", "r1c1");
    expect(commitMove(state, a, "L0", "r0c1")).toBe("ok");
    expect(commitMove(state, b, "L0", "r0c1")).toBe("destReserved"); // same destination
  });

  it("ALLOWS committing into a slot whose occupant is itself vacating (the relay setup)", () => {
    // S at r0c1 commits a move out first; then F can commit INTO r0c1 (it's being vacated).
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const s = placePlayer(state, "s", "r0c1");
    const f = placePlayer(state, "f", "r0c0");
    expect(commitMove(state, s, "L0", "r1c1")).toBe("ok"); // S vacates r0c1
    expect(commitMove(state, f, "L0", "r0c1")).toBe("ok"); // F into the vacating slot — allowed
  });

  it("a successful relay: slow vacates in time, fast follows (both move)", () => {
    // Same setup but SLOW is the faster one so it vacates BEFORE the follower resolves.
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const leaver = placePlayer(state, "leaver", "r0c1", 3); // higher Tempo → resolves first
    const follower = placePlayer(state, "follower", "r0c0", 1);
    commitMove(state, leaver, "L0", "r1c1");
    commitMove(state, follower, "L0", "r0c1");
    const queue = buildMoveResolutionQueue(state); // [leaver(t3), follower(t1)]
    expect(resolvePendingMove(state, queue[0]!)).toBe("moved"); // leaver vacates r0c1
    expect(resolvePendingMove(state, queue[1]!)).toBe("moved"); // follower into now-empty r0c1
    const slots = state.world.nodeState["L0"]!.sideSlots.player.creatures;
    expect(slots["r1c1"]).toBe(leaver.instId);
    expect(slots["r0c1"]).toBe(follower.instId);
    expect(slots["r0c0"]).toBeNull();
  });
});

describe("pending move blocks card commits at source AND destination", () => {
  it("a card cannot be committed to a pending move's destination or its source slot", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const mover = placePlayer(state, "mover", "r0c0");
    commitMove(state, mover, "L0", "r0c1"); // source r0c0, destination r0c1

    registerCreatureDef("hand", {});
    const handCard = getCard(state.cards, spawn(state, "hand"));
    state.currentEncounter!.playerSide.hand.push(handCard.instId);

    // Destination is a pending occupation → blocked.
    expect(canPlaceAt(state, handCard, { loc: "L0", side: "player", kind: "creature", pos: "r0c1" })).toBe(false);
    // Source still holds the real (solid) creature → blocked.
    expect(canPlaceAt(state, handCard, { loc: "L0", side: "player", kind: "creature", pos: "r0c0" })).toBe(false);
    // An untouched slot is still free.
    expect(canPlaceAt(state, handCard, { loc: "L0", side: "player", kind: "creature", pos: "r1c0" })).toBe(true);
  });
});

describe("move resolution — Tempo order, fizzle, not-refunded", () => {
  it("buildMoveResolutionQueue orders moves by creature Tempo (desc)", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const slow = placePlayer(state, "slow", "r0c0", 1);
    const fast = placePlayer(state, "fast", "r1c1", 3);
    commitMove(state, slow, "L0", "r1c0");
    commitMove(state, fast, "L0", "r0c1");
    const queue = buildMoveResolutionQueue(state);
    expect(queue.map((e) => e.instId)).toEqual([fast.instId, slow.instId]); // fast first
  });

  it("the cut-off case: fast move into a slot a slower creature hasn't vacated yet fizzles", () => {
    // S(t1) at X=r0c1 wants to move to r1c1; F(t3) at r0c0 wants to move INTO X=r0c1.
    // Resolve order: F first (higher Tempo). X still occupied by S → F fizzles. Then S moves.
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const slow = placePlayer(state, "slow", "r0c1", 1);
    const fast = placePlayer(state, "fast", "r0c0", 3);
    commitMove(state, slow, "L0", "r1c1");
    commitMove(state, fast, "L0", "r0c1"); // into slow's current slot

    const events: EngineEvent[] = [];
    subscribe((ev) => events.push(ev));
    const queue = buildMoveResolutionQueue(state); // [fast, slow]
    const r1 = resolvePendingMove(state, queue[0]!); // fast
    const r2 = resolvePendingMove(state, queue[1]!); // slow

    expect(r1).toBe("fizzled"); // fast cut off — r0c1 still held by slow at that moment
    expect(r2).toBe("moved"); // slow vacates r0c1 → r1c1
    const slots = state.world.nodeState["L0"]!.sideSlots.player.creatures;
    expect(slots["r0c0"]).toBe(fast.instId); // fast stuck at source
    expect(slots["r1c1"]).toBe(slow.instId); // slow moved
    expect(slots["r0c1"]).toBeNull(); // the contested slot is now empty
    expect(events.some((e) => e.kind === "move-fizzle")).toBe(true);
  });

  it("a fizzled move is spent, not refunded (movedThisTurn recorded)", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const a = placePlayer(state, "a", "r0c0", 1);
    placePlayer(state, "blocker", "r0c1"); // r0c1 occupied, won't move
    // Force a pending move into the occupied slot by reserving via the map directly (commitMove
    // would reject occupiedNow; here we test resolution-time fizzle when a non-mover blocks).
    state.currentEncounter!.locationData["L0"]!.pendingMoves.set(a.instId, "r0c1");
    const entry = buildMoveResolutionQueue(state)[0]!;
    expect(resolvePendingMove(state, entry)).toBe("fizzled");
    expect(state.currentEncounter!.locationData["L0"]!.movedThisTurn.has(a.instId)).toBe(true);
  });

  it("a clear move resolves and relocates the creature", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0", 2);
    commitMove(state, c, "L0", "r0c1");
    const entry = buildMoveResolutionQueue(state)[0]!;
    expect(resolvePendingMove(state, entry)).toBe("moved");
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c1"]).toBe(c.instId);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
  });
});

describe("legalMoveTargets / checkMove — UI highlight helpers", () => {
  it("returns the empty orthogonal neighbors of a creature in main", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0");
    // r0c0 neighbors on a 2x2: r0c1 (row) and r1c0 (col). Both empty → both legal. r1c1 is diagonal.
    expect(legalMoveTargets(state, c, "L0").sort()).toEqual(["r0c1", "r1c0"]);
  });

  it("excludes a neighbor occupied by a non-moving creature", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0");
    placePlayer(state, "block", "r0c1"); // occupies one neighbor, not moving
    expect(legalMoveTargets(state, c, "L0")).toEqual(["r1c0"]);
  });

  it("is empty outside main, or after the creature already moved", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "combat";
    const c = placePlayer(state, "c", "r0c0");
    expect(legalMoveTargets(state, c, "L0")).toEqual([]);
    state.currentEncounter!.phase = "main";
    expect(legalMoveTargets(state, c, "L0").length).toBeGreaterThan(0);
    commitMove(state, c, "L0", "r0c1");
    expect(legalMoveTargets(state, c, "L0")).toEqual([]); // already has a pending move
  });

  it("checkMove is a pure predicate (does not record a pending move)", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = placePlayer(state, "c", "r0c0");
    expect(checkMove(state, c, "L0", "r0c1")).toBe("ok");
    expect(state.currentEncounter!.locationData["L0"]?.pendingMoves.size ?? 0).toBe(0);
  });
});
