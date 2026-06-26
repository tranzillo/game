// Engine-machinery tests for the location-text dispatch surface. Fixtures here are SYNTHETIC
// (test-prefixed keys, placeholder text) — they exercise the hooks, they are NOT game content.
// Real content (the prototype ports in src/data/location-content.ts) is tested separately below
// via its actual registration.

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerLocationText,
  displayTextFor,
} from "../src/engine/location-text.ts";
import { locationStatTotal } from "../src/engine/location-totals.ts";
import { emitFutureChip } from "../src/engine/timeline.ts";
import {
  firePhaseBoundary,
  registerFlipUpHandler,
  fireFlipUpTrigger,
} from "../src/engine/triggers.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard, registerCardDef } from "../src/engine/cards.ts";
import {
  registerLocationContent,
  _resetLocationContentFlag,
} from "../src/data/location-content.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  registerActionDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

function setNodeTextKey(state: ReturnType<typeof makeSingleLocationState>, key: string): void {
  state.world.nodes.find((n) => n.id === "L0")!.locationTextKey = key;
}

describe("location text registry + display modes (synthetic fixtures)", () => {
  it("rejects duplicate keys", () => {
    registerLocationText({ key: "test-dup", peaceText: "TEST" });
    expect(() => registerLocationText({ key: "test-dup", peaceText: "TEST" })).toThrow(/Duplicate/);
  });

  it("returns null display text for nodes without a text key", () => {
    const state = makeSingleLocationState();
    expect(displayTextFor(state, "L0")).toBeNull();
  });

  it("shows peace text while fogged, war text once revealed with AI presence", () => {
    registerLocationText({ key: "test-modes", peaceText: "TEST-PEACE", warText: "TEST-WAR" });
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    setNodeTextKey(state, "test-modes");

    // Fogged (revealed undefined), AI creature present — still peace text.
    const ai = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], ai, false);
    expect(displayTextFor(state, "L0")).toBe("TEST-PEACE");

    // Reveal the node → war mode → war text.
    state.world.nodes.find((n) => n.id === "L0")!.revealed = true;
    expect(displayTextFor(state, "L0")).toBe("TEST-WAR");
  });

  it("falls back to peace text in war mode when no war variant is printed", () => {
    registerLocationText({ key: "test-fallback", peaceText: "TEST-ONLY" });
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    setNodeTextKey(state, "test-fallback");
    state.world.nodes.find((n) => n.id === "L0")!.revealed = true;
    const ai = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], ai, false);
    expect(displayTextFor(state, "L0")).toBe("TEST-ONLY");
  });
});

describe("statPresence hook machinery (synthetic fixtures)", () => {
  // §26: "If a location grants stat presence ('+1 Force here'), the location text declares a
  // hook that modifies reads." These tests exercise the hook plumbing with synthetic grants.

  it("joins locationStatTotal", () => {
    registerLocationText({
      key: "test-presence",
      peaceText: "TEST",
      statPresence: (_s, side, _loc, stat) =>
        stat === "tempo" && side === "player" ? 1 : 0,
    });
    const state = makeSingleLocationState();
    setNodeTextKey(state, "test-presence");

    expect(locationStatTotal(state, "player", "L0", "tempo")).toBe(1);
    expect(locationStatTotal(state, "ai", "L0", "tempo")).toBe(0);
    expect(locationStatTotal(state, "player", "L0", "force")).toBe(0);
  });

  it("text presence stacks with creature stats", () => {
    registerLocationText({
      key: "test-presence",
      peaceText: "TEST",
      statPresence: (_s, side, _loc, stat) =>
        stat === "tempo" && side === "player" ? 1 : 0,
    });
    registerCreatureDef("fast", { tempo: 2 });
    const state = makeSingleLocationState();
    setNodeTextKey(state, "test-presence");
    const c = getCard(state.cards, spawn(state, "fast"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], c, false);

    expect(locationStatTotal(state, "player", "L0", "tempo")).toBe(3); // 2 creature + 1 text
  });

  it("action chips cache the text-boosted tempo total at commit", () => {
    registerLocationText({
      key: "test-presence",
      peaceText: "TEST",
      statPresence: (_s, side, _loc, stat) =>
        stat === "tempo" && side === "player" ? 1 : 0,
    });
    registerActionDef("a");
    const state = makeSingleLocationState();
    setNodeTextKey(state, "test-presence");
    const action = getCard(state.cards, spawn(state, "a"));
    placeAt(state, "player", "L0", "action", ["r0c0"], action, false);

    const chip = emitFutureChip(state, action, "player", "L0", "action", "r0c0", null);
    expect(chip.cachedTempo).toBe(1);
  });
});

describe("structure presenceGrants machinery (synthetic fixtures)", () => {
  it("joins the structure's own side's location total while face-up", () => {
    registerStructureDef("test-struct", { presenceGrants: [{ stat: "force", amount: 1 }] });
    const state = makeSingleLocationState();
    const s = getCard(state.cards, spawn(state, "test-struct"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], s, false);

    expect(locationStatTotal(state, "player", "L0", "force")).toBe(1);
    expect(locationStatTotal(state, "ai", "L0", "force")).toBe(0); // own side only
  });

  it("contributes nothing while face-down", () => {
    registerStructureDef("test-struct", { presenceGrants: [{ stat: "force", amount: 1 }] });
    const state = makeSingleLocationState();
    const s = getCard(state.cards, spawn(state, "test-struct"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], s, false);
    s.revealed = false;

    expect(locationStatTotal(state, "player", "L0", "force")).toBe(0);
  });
});

describe("location text onFlipUp machinery (synthetic fixtures)", () => {
  it("location hook runs BEFORE the card's own trigger", () => {
    const order: string[] = [];
    registerLocationText({
      key: "test-fliporder",
      peaceText: "TEST",
      onFlipUp: () => order.push("location"),
    });
    registerFlipUpHandler("test-cardPing", () => order.push("card"));
    registerCardDef({
      defKey: "c",
      name: "c",
      type: "creature",
      text: "",
      costs: [],
      force: 1,
      durability: 1,
      onFlipUp: "test-cardPing",
    });
    const state = makeSingleLocationState();
    setNodeTextKey(state, "test-fliporder");
    const card = getCard(state.cards, spawn(state, "c"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], card, false);

    fireFlipUpTrigger(state, card, "player", "L0");
    expect(order).toEqual(["location", "card"]);
  });
});

describe("location text boundary hook machinery (synthetic fixtures)", () => {
  it("fires at the matching boundary for encounter locations", () => {
    let fired = 0;
    registerLocationText({
      key: "test-boundary",
      peaceText: "TEST",
      hooks: { onCombatEnd: () => fired++ },
    });
    const state = makeSingleLocationState();
    setNodeTextKey(state, "test-boundary");

    firePhaseBoundary(state, "onCombatEnd");
    expect(fired).toBe(1);
    firePhaseBoundary(state, "onMainStart");
    expect(fired).toBe(1);
  });
});

// ---------- Real content: prototype ports (location-content.ts) ----------

describe("Ogre Hideaway (prototype locP3 port)", () => {
  beforeEach(() => {
    _resetLocationContentFlag();
    registerLocationContent();
  });

  it("an ogre flipping up here sleeps for 2", () => {
    registerCreatureDef("someOgre", { tribe: "ogre" });
    const state = makeSingleLocationState();
    setNodeTextKey(state, "ogreHideaway");
    const ogre = getCard(state.cards, spawn(state, "someOgre"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], ogre, false);

    fireFlipUpTrigger(state, ogre, "player", "L0");
    expect(ogre.sleepCounter).toBe(2);
  });

  it("non-ogres are unaffected", () => {
    registerCreatureDef("someGoblin", { tribe: "goblin" });
    const state = makeSingleLocationState();
    setNodeTextKey(state, "ogreHideaway");
    const goblin = getCard(state.cards, spawn(state, "someGoblin"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], goblin, false);

    fireFlipUpTrigger(state, goblin, "player", "L0");
    expect(goblin.sleepCounter).toBe(0);
  });

  it("an already-sleeping ogre does NOT refresh its counter (prototype guard)", () => {
    registerCreatureDef("someOgre", { tribe: "ogre" });
    const state = makeSingleLocationState();
    setNodeTextKey(state, "ogreHideaway");
    const ogre = getCard(state.cards, spawn(state, "someOgre"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], ogre, false);
    ogre.sleepCounter = 1;

    fireFlipUpTrigger(state, ogre, "player", "L0");
    expect(ogre.sleepCounter).toBe(1); // unchanged
  });
});
