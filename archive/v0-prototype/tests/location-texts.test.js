import { describe, it, expect, beforeEach } from "vitest";
import { LOCATION_TEXTS } from "../src/engine/core.js";
import { state } from "../src/engine/state.js";
import { makeTestState, placeForTest, spawn } from "./helpers.js";

describe("Champion's Rest (locP1) — shouldSuppressAction predicate", () => {
  const predicate = LOCATION_TEXTS.locP1.shouldSuppressAction;
  const dummyAction = { name: "stub" };

  beforeEach(() => {
    makeTestState({ locCount: 1 });
  });

  it("suppresses when no creatures are at the location", () => {
    expect(predicate(dummyAction, 0)).toBe(true);
  });

  it("does NOT suppress when exactly one creature is at the location", () => {
    placeForTest(state, "player", 0, "fl", spawn("r1", "player"));
    expect(predicate(dummyAction, 0)).toBe(false);
  });

  it("suppresses when two creatures are at the location (regardless of side)", () => {
    placeForTest(state, "player", 0, "fl", spawn("r1", "player"));
    placeForTest(state, "ai", 0, "fr", spawn("r1", "ai"));
    expect(predicate(dummyAction, 0)).toBe(true);
  });

  it("suppresses when two creatures are on the same side", () => {
    placeForTest(state, "player", 0, "fl", spawn("r1", "player"));
    placeForTest(state, "player", 0, "fr", spawn("r1", "player"));
    expect(predicate(dummyAction, 0)).toBe(true);
  });

  it("one face-down creature still counts toward the creature count", () => {
    // The predicate counts all creatures in slots regardless of revealed status.
    // (Suppression timing is checked at every end-of-phase pass, and at that moment any
    // committed creatures here — face-down or face-up — occupy a slot.)
    placeForTest(state, "player", 0, "fl", spawn("r1", "player"), { revealed: false });
    expect(predicate(dummyAction, 0)).toBe(false);
  });
});
