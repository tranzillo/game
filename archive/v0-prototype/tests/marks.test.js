import { describe, it, expect, beforeEach } from "vitest";
import { applyMark, exileFromPlay } from "../src/engine/core.js";
import { state } from "../src/engine/state.js";
import { makeTestState, placeForTest, spawn } from "./helpers.js";

describe("marks system", () => {
  beforeEach(() => {
    makeTestState({ locCount: 1 });
  });

  it("first mark of a kind is recorded on the card", () => {
    const card = spawn("r1", "player");
    applyMark(card, "reroute", "ai");
    expect(card.marks).toHaveLength(1);
    expect(card.marks[0]).toEqual({ kind: "reroute", side: "ai" });
  });

  it("second mark of the same kind exiles the card (torn in half)", () => {
    const card = spawn("r1", "player");
    placeForTest(state, "player", 0, "fl", card);

    applyMark(card, "reroute", "ai");
    expect(card.marks).toHaveLength(1);

    const ok = applyMark(card, "reroute", "ai");
    expect(ok).toBe(false);

    expect(state.sides.player.locations[0].creatures.fl).toBeNull();
    expect(state.sides.player.exile).toContain(card);
  });

  it("two different-kind marks coexist on the same card", () => {
    const card = spawn("r1", "player");
    applyMark(card, "reroute", "ai");
    applyMark(card, "damage", "ai");
    expect(card.marks).toHaveLength(2);
    expect(card.marks.map(m => m.kind).sort()).toEqual(["damage", "reroute"]);
  });

  it("marks persist into runDeckEntry.mods.marks when card has a runDeckEntry", () => {
    const card = spawn("r1", "player");
    const entry = { defKey: "r1", mods: {} };
    card.runDeckEntry = entry;

    applyMark(card, "convert", "ai");

    expect(entry.mods.marks).toEqual([{ kind: "convert", side: "ai" }]);
  });

  it("same-kind double mark removes the entry from runDeck permanently", () => {
    const card = spawn("r1", "player");
    placeForTest(state, "player", 0, "fl", card);

    const entry = { defKey: "r1", mods: {} };
    card.runDeckEntry = entry;
    state.runDeck.push(entry);

    applyMark(card, "reroute", "ai");
    applyMark(card, "reroute", "ai");

    expect(state.runDeck).not.toContain(entry);
  });

  it("exileFromPlay removes a card from its slot and detaches equipment", () => {
    const host = spawn("r1", "player");
    const equip = spawn("r2", "player");
    placeForTest(state, "player", 0, "fl", host);
    host.equipment = [equip];

    exileFromPlay(host);

    expect(state.sides.player.locations[0].creatures.fl).toBeNull();
    expect(state.sides.player.exile).toContain(host);
  });
});
