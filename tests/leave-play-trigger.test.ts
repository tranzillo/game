import { describe, it, expect, beforeEach } from "vitest";
import {
  fireLeavePlayTrigger,
  registerLeavePlayHandler,
} from "../src/engine/triggers.ts";
import { completeDeath, applyDamage } from "../src/engine/damage.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("fireLeavePlayTrigger", () => {
  it("calls the registered handler when the def has onLeavePlay", () => {
    let fired = false;
    registerLeavePlayHandler("deathwish-test", () => {
      fired = true;
    });
    registerCreatureDef("c", { onLeavePlay: "deathwish-test" });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    fireLeavePlayTrigger(state, card, "player", "L0", "creatureDied");
    expect(fired).toBe(true);
  });

  it("is a no-op if the def has no onLeavePlay", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    expect(() => fireLeavePlayTrigger(state, card, "player", "L0", "creatureDied")).not.toThrow();
  });

  it("is a no-op if the handler tag isn't registered", () => {
    registerCreatureDef("c", { onLeavePlay: "missing-handler" });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    expect(() => fireLeavePlayTrigger(state, card, "player", "L0", "creatureDied")).not.toThrow();
  });

  it("passes the leave-play reason to the handler", () => {
    let seenReason = "";
    registerLeavePlayHandler("reason-test", (ctx) => {
      seenReason = ctx.reason;
    });
    registerCreatureDef("c", { onLeavePlay: "reason-test" });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    fireLeavePlayTrigger(state, card, "player", "L0", "creatureDied");
    expect(seenReason).toBe("creatureDied");
  });

  it("rejects duplicate handler registration", () => {
    registerLeavePlayHandler("dup", () => {});
    expect(() => registerLeavePlayHandler("dup", () => {})).toThrow(/Duplicate/);
  });
});

describe("completeDeath fires onLeavePlay before routing the card", () => {
  it("handler sees the card still in its slot (not yet routed to pile)", () => {
    let cardStillInSlot = false;
    registerLeavePlayHandler("check-still-in-slot", (ctx) => {
      const slotMap = ctx.state.world.nodeState["L0"]!.sideSlots.player.creatures;
      cardStillInSlot = slotMap["r0c0"] === ctx.card.instId;
    });
    registerCreatureDef("c", { durability: 1, onLeavePlay: "check-still-in-slot" });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    // Damage to 0 sets pendingLeavePile.
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

    completeDeath(state, card, "player", "L0");

    expect(cardStillInSlot).toBe(true);
    // After completeDeath, the slot is empty and the card is in the graveyard.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(state.currentEncounter!.playerSide.graveyard).toContain(card.instId);
  });

  it("handler runs once per death; idempotent on re-call without pendingLeavePile", () => {
    let fireCount = 0;
    registerLeavePlayHandler("counter", () => {
      fireCount += 1;
    });
    registerCreatureDef("c", { durability: 1, onLeavePlay: "counter" });
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
    completeDeath(state, card, "player", "L0");
    expect(fireCount).toBe(1);

    // pendingLeavePile is now cleared (card was routed); a second completeDeath is a no-op.
    completeDeath(state, card, "player", "L0");
    expect(fireCount).toBe(1);
  });

  it("deathwish handler can damage another creature on the board (synchronous mutation)", () => {
    registerLeavePlayHandler("dwBoom", (ctx) => {
      // Find any other creature at this location and deal 1 damage to it.
      const ns = ctx.state.world.nodeState[ctx.loc]!;
      const enemySide = ctx.side === "player" ? "ai" : "player";
      const enemySlots = ns.sideSlots[enemySide].creatures;
      for (const pos of Object.keys(enemySlots)) {
        const id = enemySlots[pos];
        if (id == null) continue;
        applyDamage({
          state: ctx.state,
          amount: 1,
          attackerSide: ctx.side, // the dying card was on this side
          attackerInstId: null,
          loc: ctx.loc,
          damageKind: "deathwish",
          candidateCreatureTargets: [id],
          enemySide,
        });
        break;
      }
    });
    registerCreatureDef("dyer", { durability: 1, onLeavePlay: "dwBoom" });
    registerCreatureDef("victim", { durability: 3 });

    const state = makeSingleLocationState();
    const dyer = getCard(state.cards, spawn(state, "dyer"));
    const victim = getCard(state.cards, spawn(state, "victim", "biome"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], dyer, false);
    placeAt(state, "ai", "L0", "creature", ["r0c1"], victim, false);

    // Kill dyer with 1 damage.
    applyDamage({
      state,
      amount: 1,
      attackerSide: "ai",
      attackerInstId: null,
      loc: "L0",
      damageKind: "melee",
      candidateCreatureTargets: [dyer.instId],
      enemySide: "player",
    });
    completeDeath(state, dyer, "player", "L0");

    // Victim took 1 damage from dyer's deathwish.
    expect(victim.durability).toBe(2);
  });
});
