import { describe, it, expect, beforeEach } from "vitest";
import { sacrificeCreature } from "../src/engine/sacrifice.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  registerLeavePlayHandler,
} from "../src/engine/triggers.ts";
import {
  resetEngine,
  registerCreatureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

describe("sacrificeCreature", () => {
  it("routes the creature to its side's graveyard", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    const ok = sacrificeCreature(state, card, "player", "L0");
    expect(ok).toBe(true);
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBeNull();
    expect(state.currentEncounter!.playerSide.graveyard).toContain(card.instId);
  });

  it("fires the card's onLeavePlay (deathwish) before routing", () => {
    let dwFired = false;
    let stillInSlotAtFire = false;
    registerLeavePlayHandler("sacDw", (ctx) => {
      dwFired = true;
      const map = ctx.state.world.nodeState["L0"]!.sideSlots.player.creatures;
      stillInSlotAtFire = map["r0c0"] === ctx.card.instId;
    });
    registerCreatureDef("c", { onLeavePlay: "sacDw" });
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    sacrificeCreature(state, card, "player", "L0");
    expect(dwFired).toBe(true);
    expect(stillInSlotAtFire).toBe(true);
  });

  it("returns false if the card isn't on the named side at the named loc", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    // Try to sacrifice as if it were on the AI side — should fail.
    const ok = sacrificeCreature(state, card, "ai", "L0");
    expect(ok).toBe(false);
    // Card still in player's slot.
    expect(state.world.nodeState["L0"]!.sideSlots.player.creatures["r0c0"]).toBe(card.instId);
  });

  it("clears pendingLeavePile after the sacrifice (no second leave-play attempt)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    sacrificeCreature(state, card, "player", "L0");
    expect(card.pendingLeavePile).toBeNull();
  });
});
