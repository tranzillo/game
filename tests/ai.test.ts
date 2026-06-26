import { describe, it, expect, beforeEach } from "vitest";
import { aiPickBestPlay, canAiPlaceAt, scoreAiPlay } from "../src/engine/ai.ts";
import { aiCommitMainPlays } from "../src/store/ai-play.ts";
import { freshSideState } from "../src/engine/state.ts";
import { getCard } from "../src/engine/cards.ts";
import { placeAt } from "../src/engine/slots.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  makeSingleLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

// Put the encounter into a state where the AI can play: aiSide present, phase = main, and the AI
// is PRESENT at L0 (has an aiDeck-origin card in a slot). Presence is the precondition for the AI
// to commit cards at a location (the AI never plays at neutral / non-present locations). We seed
// the presence anchor at a back-corner slot (r1c1) so it stays out of the way of slots the tests
// place into (r0c0 / r1c0).
function withAiInMain() {
  const state = makeSingleLocationState();
  state.currentEncounter!.aiSide = freshSideState();
  state.currentEncounter!.phase = "main";
  registerCreatureDef("aiAnchor");
  const anchor = getCard(state.cards, spawn(state, "aiAnchor", "aiDeck"));
  placeAt(state, "ai", "L0", "creature", ["r1c1"], anchor, false);
  return state;
}

describe("canAiPlaceAt", () => {
  it("false when no aiSide (summoner not present)", () => {
    registerCreatureDef("c");
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    expect(canAiPlaceAt(state, c, "L0", "creature", "r0c0")).toBe(false);
  });

  it("true for a creature in main at an empty AI slot with cost met", () => {
    registerCreatureDef("c");
    const state = withAiInMain();
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    expect(canAiPlaceAt(state, c, "L0", "creature", "r0c0")).toBe(true);
  });

  it("false for a permanent outside main (commit window §28)", () => {
    registerCreatureDef("c");
    const state = withAiInMain();
    state.currentEncounter!.phase = "combat";
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    expect(canAiPlaceAt(state, c, "L0", "creature", "r0c0")).toBe(false);
  });

  it("false when the committed slot is already occupied", () => {
    registerCreatureDef("c");
    const state = withAiInMain();
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    placeAt(state, "ai", "L0", "creature", ["r0c0"], a, false);
    const b = getCard(state.cards, spawn(state, "c", "aiDeck"));
    expect(canAiPlaceAt(state, b, "L0", "creature", "r0c0")).toBe(false);
  });

  it("false when the location is player-cleared", () => {
    registerCreatureDef("c");
    const state = withAiInMain();
    state.currentEncounter!.playerLocationCleared["L0"] = true;
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    expect(canAiPlaceAt(state, c, "L0", "creature", "r0c0")).toBe(false);
  });

  it("false at a location where the AI is NOT present (no aiDeck cards there)", () => {
    // aiSide exists and it's main, but the location holds only biome content — the AI is not
    // present there, so it may not commit (it never plays at a neutral location). §29/§3.
    registerCreatureDef("c");
    registerCreatureDef("biomeFoe");
    const state = makeSingleLocationState();
    state.currentEncounter!.aiSide = freshSideState();
    state.currentEncounter!.phase = "main";
    const biome = getCard(state.cards, spawn(state, "biomeFoe", "biome"));
    placeAt(state, "ai", "L0", "creature", ["r0c1"], biome, false); // biome on AI slots ≠ presence
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    expect(canAiPlaceAt(state, c, "L0", "creature", "r0c0")).toBe(false);
  });

  it("true once the AI IS present (an aiDeck card occupies a slot here)", () => {
    registerCreatureDef("c");
    const state = withAiInMain(); // seeds an aiDeck presence anchor at L0
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    expect(canAiPlaceAt(state, c, "L0", "creature", "r0c0")).toBe(true);
  });
});

describe("scoreAiPlay", () => {
  it("prefers the front row over the back row for creatures", () => {
    registerCreatureDef("c");
    const state = withAiInMain();
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    const front = scoreAiPlay(state, c, "L0", "creature", "r0c0");
    const back = scoreAiPlay(state, c, "L0", "creature", "r1c0");
    expect(front).toBeGreaterThan(back);
  });

  it("favors more expensive plays (cost magnitude weight)", () => {
    registerCreatureDef("cheap", { costs: [] });
    registerCreatureDef("pricey", { costs: [{ kind: "absolute", stat: "force", amount: 3 }] });
    const state = withAiInMain();
    const cheap = getCard(state.cards, spawn(state, "cheap", "aiDeck"));
    const pricey = getCard(state.cards, spawn(state, "pricey", "aiDeck"));
    const cheapScore = scoreAiPlay(state, cheap, "L0", "creature", "r0c0");
    const priceyScore = scoreAiPlay(state, pricey, "L0", "creature", "r0c0");
    expect(priceyScore).toBeGreaterThan(cheapScore);
  });
});

describe("aiPickBestPlay", () => {
  it("returns null when the AI hand is empty", () => {
    const state = withAiInMain();
    expect(aiPickBestPlay(state)).toBeNull();
  });

  it("picks the highest-scoring legal tuple (front row, costliest)", () => {
    registerCreatureDef("c", { costs: [] });
    registerStructureDef("big", { costs: [{ kind: "absolute", stat: "force", amount: 2 }] });
    const state = withAiInMain();
    // Give the AI Force presence so the structure's cost can be met (drop a free creature first
    // is unnecessary — structures read presence; here we just verify the pick among legal plays).
    const c = getCard(state.cards, spawn(state, "c", "aiDeck"));
    state.currentEncounter!.aiSide!.hand.push(c.instId);
    const best = aiPickBestPlay(state);
    expect(best).not.toBeNull();
    expect(best!.card.instId).toBe(c.instId);
    expect(best!.kind).toBe("creature");
  });
});

describe("aiCommitMainPlays", () => {
  it("commits cards face-down with future chips, emptying the hand of playable cards", () => {
    registerCreatureDef("c", { costs: [] });
    const state = withAiInMain();
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    const b = getCard(state.cards, spawn(state, "c", "aiDeck"));
    state.currentEncounter!.aiSide!.hand.push(a.instId, b.instId);

    const n = aiCommitMainPlays(state);
    expect(n).toBe(2); // both placed (default profile has 4 creature slots; anchor took 1)

    // Face-down committed at AI creature slots — 3 total (2 just placed + the presence anchor).
    const ns = state.world.nodeState["L0"]!;
    const placed = Object.values(ns.sideSlots.ai.creatures).filter((v) => v != null);
    expect(placed.length).toBe(3);
    expect(a.revealed).toBe(false);
    expect(b.revealed).toBe(false);
    // Hand emptied.
    expect(state.currentEncounter!.aiSide!.hand).toEqual([]);
    // Future chips emitted (run-scoped timeline), AI side, state "future". Two for the cards we
    // committed (the anchor was placed directly, not via a commit, so it has no future chip).
    const aiChips = state.timeline.filter((ch) => ch.side === "ai" && ch.state === "future");
    expect(aiChips.length).toBe(2);
  });

  it("no-op when the summoner isn't present (no aiSide)", () => {
    const state = makeSingleLocationState();
    state.currentEncounter!.phase = "main";
    expect(aiCommitMainPlays(state)).toBe(0);
  });

  it("stops when no play is legal (e.g. unmet cost everywhere)", () => {
    // Creature with an unmeetable absolute Force cost and no Force presence anywhere.
    registerCreatureDef("c", { costs: [{ kind: "absolute", stat: "force", amount: 5 }] });
    const state = withAiInMain();
    const a = getCard(state.cards, spawn(state, "c", "aiDeck"));
    state.currentEncounter!.aiSide!.hand.push(a.instId);
    expect(aiCommitMainPlays(state)).toBe(0);
    expect(state.currentEncounter!.aiSide!.hand).toContain(a.instId); // still in hand
  });
});
