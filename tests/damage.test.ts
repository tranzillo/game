import { describe, it, expect, beforeEach } from "vitest";
import {
  applyDamage,
  applyMultiTargetEmpty,
  applyScopedDamage,
  completeDeath,
} from "../src/engine/damage.ts";
import { patternTargets } from "../src/engine/pattern-targets.ts";
import { subscribe } from "../src/engine/events.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import type { EngineEvent } from "../src/engine/types.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  makeMultiLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(() => {
  resetEngine();
  subscribe(null); // ensure no event handler leaks between tests
});

describe("applyDamage — creature targets", () => {
  it("reduces target durability by the amount", () => {
    registerCreatureDef("c", { durability: 5 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    const result = applyDamage({
      state,
      amount: 2,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [card.instId],
      enemySide: "ai",
    });

    expect(result.target.kind).toBe("creature");
    expect(result.damageDealt).toBe(2);
    expect(result.targetDiedNow).toBe(false);
    expect(card.durability).toBe(3);
    expect(card.pendingLeavePile).toBeNull();
  });

  it("damage exceeding durability caps at remaining durability", () => {
    registerCreatureDef("c", { durability: 3 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    const result = applyDamage({
      state,
      amount: 10,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [card.instId],
      enemySide: "ai",
    });

    expect(result.damageDealt).toBe(3);
    expect(card.durability).toBe(0);
    expect(result.targetDiedNow).toBe(true);
  });

  it("damage to 0 sets pendingLeavePile and reports targetDiedNow=true; card stays in slot", () => {
    registerCreatureDef("c", { durability: 2 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    const result = applyDamage({
      state,
      amount: 2,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [card.instId],
      enemySide: "ai",
    });

    expect(result.targetDiedNow).toBe(true);
    expect(card.durability).toBe(0);
    // pendingLeavePile is set — slice 1's second beat hasn't run yet.
    expect(card.pendingLeavePile).not.toBeNull();
    // Card is still in the slot — visible death moment per §17.
    expect(state.world.nodeState["L0"]!.sideSlots.ai.creatures["r0c0"]).toBe(card.instId);
  });

  it("subsequent damage on a pending-leave-pile creature does not re-set the pile", () => {
    registerCreatureDef("c", { durability: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    applyDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [card.instId],
      enemySide: "ai",
    });
    const firstPile = card.pendingLeavePile;
    expect(firstPile).not.toBeNull();

    applyDamage({
      state,
      amount: 5,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [card.instId],
      enemySide: "ai",
    });
    expect(card.pendingLeavePile).toBe(firstPile);
  });
});

describe("applyDamage — fall-through to summoner", () => {
  it("falls through to opposing summoner when no creature targets exist", () => {
    const state = makeSingleLocationState();
    // Make sure aiSide exists for summoner damage to land.
    state.currentEncounter!.aiSide = {
      deck: [],
      hand: [],
      discard: [],
      graveyard: [],
      junkyard: [],
      durability: 10,
      actionsThisTurn: 0,
    };

    const result = applyDamage({
      state,
      amount: 3,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [],
      enemySide: "ai",
    });

    expect(result.target.kind).toBe("summoner");
    expect(result.target.summonerSide).toBe("ai");
    expect(result.damageDealt).toBe(3);
    expect(state.currentEncounter!.aiSide!.durability).toBe(7);
  });

  it("friendly-fire on empty board fizzles — no fall-through", () => {
    const state = makeSingleLocationState();
    const playerDurabilityBefore = state.currentEncounter!.playerSide.durability;

    const result = applyDamage({
      state,
      amount: 4,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [],
      enemySide: "player", // friendly side — but caller flags it
      isFriendlyFire: true,
    });

    expect(result.target.kind).toBe("none");
    expect(result.damageDealt).toBe(0);
    expect(state.currentEncounter!.playerSide.durability).toBe(playerDurabilityBefore);
  });

  it("damage to a side with no SideState fizzles (AI-side null in hostile non-boss)", () => {
    const state = makeSingleLocationState();
    // aiSide is null by default in makeSingleLocationState (neutral encounter).
    expect(state.currentEncounter!.aiSide).toBeNull();

    const result = applyDamage({
      state,
      amount: 5,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [],
      enemySide: "ai",
    });

    expect(result.target.kind).toBe("none");
    expect(result.damageDealt).toBe(0);
  });
});

describe("applyDamage — emits a 'damage' event for every call (outcome logging)", () => {
  function aiWithDurability(state: ReturnType<typeof makeSingleLocationState>, d: number) {
    state.currentEncounter!.aiSide = {
      deck: [], hand: [], discard: [], graveyard: [], junkyard: [],
      durability: d, actionsThisTurn: 0,
    };
  }

  it("emits a creature-hit outcome with target + amount dealt", () => {
    registerCreatureDef("c", { durability: 5 });
    const state = makeSingleLocationState();
    const target = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], target, false);

    const events: EngineEvent[] = [];
    subscribe((ev) => events.push(ev));
    applyDamage({
      state, amount: 2, attackerSide: "player", attackerInstId: null,
      loc: "L0", damageKind: "action", candidateCreatureTargets: [target.instId], enemySide: "ai",
    });

    const dmg = events.find((e) => e.kind === "damage");
    expect(dmg).toBeDefined();
    const result = dmg!.payload.result as { target: { kind: string; creatureInstId?: number }; damageDealt: number };
    expect(dmg!.payload.damageKind).toBe("action");
    expect(result.target.kind).toBe("creature");
    expect(result.target.creatureInstId).toBe(target.instId);
    expect(result.damageDealt).toBe(2);
  });

  it("emits a summoner fall-through outcome when nothing is targetable", () => {
    const state = makeSingleLocationState();
    aiWithDurability(state, 10);
    const events: EngineEvent[] = [];
    subscribe((ev) => events.push(ev));
    applyDamage({
      state, amount: 3, attackerSide: "player", attackerInstId: null,
      loc: "L0", damageKind: "action", candidateCreatureTargets: [], enemySide: "ai",
    });
    const dmg = events.find((e) => e.kind === "damage")!;
    const result = dmg.payload.result as { target: { kind: string; summonerSide?: string } };
    expect(result.target.kind).toBe("summoner");
    expect(result.target.summonerSide).toBe("ai");
  });
});

describe("combat: a face-down card across is treated as an empty slot → fall-through", () => {
  it("a single-target swing with only a face-DOWN enemy across falls through to the summoner", () => {
    registerCreatureDef("atk", { force: 3 });
    registerCreatureDef("foe", { durability: 5 });
    const state = makeSingleLocationState();
    state.currentEncounter!.aiSide = {
      deck: [], hand: [], discard: [], graveyard: [], junkyard: [],
      durability: 10, actionsThisTurn: 0,
    };
    const attacker = getCard(state.cards, spawn(state, "atk"));
    const facedown = getCard(state.cards, spawn(state, "foe", "aiDeck"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], attacker, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], facedown, false);
    facedown.revealed = false; // committed face-down — slot is "empty" for damage purposes

    // patternTargets returns no creature target (face-down isn't in play) ...
    const targets = patternTargets(state, attacker, "player", "L0", { kind: "default" }, 3)!;
    expect(targets.creatureTargets).toEqual([]);

    // ... so applyDamage falls through to the enemy summoner, not the face-down card.
    const result = applyDamage({
      state, amount: targets.damagePerTarget, attackerSide: "player",
      attackerInstId: attacker.instId, loc: "L0", damageKind: "melee",
      candidateCreatureTargets: targets.creatureTargets, enemySide: "ai",
    });
    expect(result.target.kind).toBe("summoner");
    expect(state.currentEncounter!.aiSide!.durability).toBe(7);
    expect(facedown.durability).toBe(5); // untouched
  });
});

describe("applyMultiTargetEmpty", () => {
  it("hits the enemy summoner exactly once", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.aiSide = {
      deck: [],
      hand: [],
      discard: [],
      graveyard: [],
      junkyard: [],
      durability: 8,
      actionsThisTurn: 0,
    };

    const result = applyMultiTargetEmpty(state, 2, "ai");

    expect(result.target.kind).toBe("summoner");
    expect(result.damageDealt).toBe(2);
    expect(state.currentEncounter!.aiSide!.durability).toBe(6);
  });
});

describe("completeDeath", () => {
  it("routes a pending-leave-pile creature via leavePlay", () => {
    registerCreatureDef("c", { durability: 1 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    applyDamage({
      state,
      amount: 1,
      attackerSide: "ai",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [card.instId],
      enemySide: "player",
    });
    expect(card.pendingLeavePile).not.toBeNull();
    // Still in slot before completeDeath.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(card.instId);

    completeDeath(state, card, "player", "L0");

    // Now routed to graveyard, slot vacated.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(state.currentEncounter!.playerSide.graveyard).toContain(card.instId);
  });

  it("is a no-op if pendingLeavePile is null", () => {
    registerCreatureDef("c", { durability: 3 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    completeDeath(state, card, "player", "L0");

    // Still in slot.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(card.instId);
    expect(state.currentEncounter!.playerSide.graveyard).not.toContain(card.instId);
  });
});

describe("applyDamage — edge cases", () => {
  it("zero damage is a no-op", () => {
    registerCreatureDef("c", { durability: 3 });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], card, false);

    const result = applyDamage({
      state,
      amount: 0,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [card.instId],
      enemySide: "ai",
    });

    expect(result.target.kind).toBe("none");
    expect(card.durability).toBe(3);
  });

  it("multiple candidates: picks one (and only damages one)", () => {
    registerCreatureDef("c", { durability: 3 });
    const state = makeSingleLocationState();
    const a = getCard(state.cards, spawn(state, "c"));
    const b = getCard(state.cards, spawn(state, "c"));
    const c = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "ai", "L0", "creature", ["r0c1"], b, false);
    placeAt(state, "ai", "L0", "creature", ["r0c2"], c, false);

    applyDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [a.instId, b.instId, c.instId],
      enemySide: "ai",
    });

    const damaged = [a, b, c].filter((card) => card.durability! < 3);
    expect(damaged.length).toBe(1);
  });
});

describe("applyDamage — Spite thorns", () => {
  it("defender thorns: per-card Spite triggers on melee damage to defender", () => {
    registerCreatureDef("atk", { force: 2, durability: 5 });
    registerCreatureDef("def", { force: 0, durability: 5, spite: 2 });
    const state = makeSingleLocationState();
    const atk = getCard(state.cards, spawn(state, "atk"));
    const def = getCard(state.cards, spawn(state, "def", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], atk, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], def, false);

    const result = applyDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: atk.instId,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [def.instId],
      enemySide: "ai",
    });

    expect(result.thornsToAttacker).not.toBeNull();
    expect(result.thornsToAttacker!.attackerInstId).toBe(atk.instId);
    expect(result.thornsToAttacker!.amount).toBe(2);
    expect(result.thornsToAttacker!.source).toBe("defender");
  });

  it("no thorns on ranged damage", () => {
    registerCreatureDef("atk", { force: 2 });
    registerCreatureDef("def", { durability: 5, spite: 2 });
    const state = makeSingleLocationState();
    const atk = getCard(state.cards, spawn(state, "atk"));
    const def = getCard(state.cards, spawn(state, "def", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], atk, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], def, false);

    const result = applyDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: atk.instId,
      loc: "L0",
      damageKind: "ranged",
      candidateCreatureTargets: [def.instId],
      enemySide: "ai",
    });

    expect(result.thornsToAttacker).toBeNull();
  });

  it("no thorns on action damage", () => {
    registerCreatureDef("def", { durability: 5, spite: 2 });
    const state = makeSingleLocationState();
    const def = getCard(state.cards, spawn(state, "def", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], def, false);

    const result = applyDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "action",
      candidateCreatureTargets: [def.instId],
      enemySide: "ai",
    });

    expect(result.thornsToAttacker).toBeNull();
  });

  it("no thorns on thorns damage itself (no infinite cascade)", () => {
    registerCreatureDef("atk", { durability: 5, spite: 1 });
    registerCreatureDef("def", { durability: 5, spite: 2 });
    const state = makeSingleLocationState();
    const atk = getCard(state.cards, spawn(state, "atk"));
    const def = getCard(state.cards, spawn(state, "def", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], atk, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], def, false);

    const result = applyDamage({
      state,
      amount: 1,
      attackerSide: "ai",
      attackerInstId: def.instId,
      loc: "L0",
      damageKind: "thorns",
      candidateCreatureTargets: [atk.instId],
      enemySide: "player",
    });

    expect(result.thornsToAttacker).toBeNull();
  });

  it("no thorns when defender has 0 Spite", () => {
    registerCreatureDef("atk", { force: 1 });
    registerCreatureDef("def", { durability: 5, spite: 0 });
    const state = makeSingleLocationState();
    const atk = getCard(state.cards, spawn(state, "atk"));
    const def = getCard(state.cards, spawn(state, "def", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], atk, false);
    placeAt(state, "ai", "L0", "creature", ["r0c0"], def, false);

    const result = applyDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: atk.instId,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [def.instId],
      enemySide: "ai",
    });

    expect(result.thornsToAttacker).toBeNull();
  });

  it("summoner-fallthrough thorns: per-location Spite total triggers when melee falls through", () => {
    // Empty board on AI side, but locationStatTotal pulls from terrain / structures / Spite-buffs
    // at the location. For this test we use a Spite-printing structure on the AI side.
    registerCreatureDef("atk", { force: 2 });
    const state = makeSingleLocationState();
    // Ensure aiSide exists so summoner can take damage.
    state.currentEncounter!.aiSide = {
      deck: [],
      hand: [],
      discard: [],
      graveyard: [],
      junkyard: [],
      durability: 10,
      actionsThisTurn: 0,
    };
    // Place a Spite-printing AI creature in back row (it's not eligible to defend, but contributes
    // to location Spite total). Actually for this test simpler: put a Spite creature face-up but
    // NOT in the front row — then attacker fall-through hits summoner directly.
    // We need locationStatTotal("ai", "L0", "spite") > 0 without putting anything in the front.
    // The cleanest way is using a back-row Spite-printing creature.
    registerCreatureDef("backer", { force: 0, durability: 3, spite: 2 });
    const backer = getCard(state.cards, spawn(state, "backer", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r1c0"], backer, false);

    const atk = getCard(state.cards, spawn(state, "atk"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], atk, false);

    const result = applyDamage({
      state,
      amount: 2,
      attackerSide: "player",
      attackerInstId: atk.instId,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [], // fall-through
      enemySide: "ai",
    });

    expect(result.target.kind).toBe("summoner");
    expect(result.thornsToAttacker).not.toBeNull();
    expect(result.thornsToAttacker!.source).toBe("summoner-fallthrough");
    expect(result.thornsToAttacker!.amount).toBe(2);
    expect(result.thornsToAttacker!.attackerInstId).toBe(atk.instId);
  });

  it("no summoner-fallthrough thorns when damage fizzles (aiSide null)", () => {
    registerCreatureDef("atk", { force: 2 });
    const state = makeSingleLocationState();
    // aiSide stays null.
    const atk = getCard(state.cards, spawn(state, "atk"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], atk, false);

    const result = applyDamage({
      state,
      amount: 2,
      attackerSide: "player",
      attackerInstId: atk.instId,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [],
      enemySide: "ai",
    });

    expect(result.target.kind).toBe("none");
    expect(result.thornsToAttacker).toBeNull();
  });

  it("no thorns when attackerInstId is null (sourceless damage)", () => {
    registerCreatureDef("def", { durability: 5, spite: 2 });
    const state = makeSingleLocationState();
    const def = getCard(state.cards, spawn(state, "def", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], def, false);

    const result = applyDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [def.instId],
      enemySide: "ai",
    });

    expect(result.thornsToAttacker).toBeNull();
  });
});

describe("applyScopedDamage — multi-location resolution per §30", () => {
  it("resolves at each encounter location independently, returning one result per loc", () => {
    registerCreatureDef("c", { durability: 3 });
    const state = makeMultiLocationState(["L0", "L1"]);
    const a = getCard(state.cards, spawn(state, "c", "biome"));
    const b = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);
    placeAt(state, "ai", "L1", "creature", ["r0c0"], b, false);

    const results = applyScopedDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: null,
      damageKind: "action",
      enemySide: "ai",
    });

    expect(results.length).toBe(2);
    // Both creatures took 1 damage each.
    expect(a.durability).toBe(2);
    expect(b.durability).toBe(2);
  });

  it("locations with no creatures fall through to enemy summoner per-location", () => {
    const state = makeMultiLocationState(["L0", "L1"]);
    state.currentEncounter!.aiSide = {
      deck: [],
      hand: [],
      discard: [],
      graveyard: [],
      junkyard: [],
      durability: 10,
      actionsThisTurn: 0,
    };
    // No creatures on AI side — both locations should fall through.
    const results = applyScopedDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: null,
      damageKind: "action",
      enemySide: "ai",
    });

    expect(results.length).toBe(2);
    expect(results.every((r) => r.target.kind === "summoner")).toBe(true);
    // Two hits of 1 damage each.
    expect(state.currentEncounter!.aiSide!.durability).toBe(8);
  });

  it("mixed: one location has a creature, the other empty → one creature hit + one summoner hit", () => {
    registerCreatureDef("c", { durability: 3 });
    const state = makeMultiLocationState(["L0", "L1"]);
    state.currentEncounter!.aiSide = {
      deck: [],
      hand: [],
      discard: [],
      graveyard: [],
      junkyard: [],
      durability: 10,
      actionsThisTurn: 0,
    };
    const c = getCard(state.cards, spawn(state, "c", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], c, false);

    const results = applyScopedDamage({
      state,
      amount: 1,
      attackerSide: "player",
      attackerInstId: null,
      damageKind: "action",
      enemySide: "ai",
    });

    expect(results.length).toBe(2);
    expect(results[0]!.target.kind).toBe("creature");
    expect(results[1]!.target.kind).toBe("summoner");
    expect(c.durability).toBe(2);
    expect(state.currentEncounter!.aiSide!.durability).toBe(9);
  });
});
