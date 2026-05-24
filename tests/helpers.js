// Test helpers — build deterministic engine state without going through the overworld machinery.
// Engine modules use mutable shared bindings (state, LOCATION_COUNT), so every test must reset
// them via resetEngine() in beforeEach.

import { setState } from "../src/engine/state.js";
import { setLocationConfig } from "../src/engine/config.js";
import { createCard, freshLocation } from "../src/engine/state.js";

// Build a minimal encounter state with `locCount` locations, two sides with empty boards.
// Caller is expected to populate creatures/structures/actions via placeForTest below.
export function makeTestState({ locCount = 1, locNames = null } = {}) {
  const names = locNames || Array.from({ length: locCount }, (_, i) => `L${i}`);
  setLocationConfig(locCount, names, Array(locCount).fill(null));

  const buildSide = () => ({
    durability: 20,
    deck: [],
    hand: [],
    discard: [],
    graveyard: [],
    junkyard: [],
    exile: [],
    locations: Array.from({ length: locCount }, () => freshLocation()),
    actionsThisTurn: 0
  });

  const s = {
    deckKey: "red",
    runDeck: [],
    runDurability: 20,
    world: null,
    view: "encounter",
    runOver: null,
    turn: 1,
    phase: "main",
    activeSide: "player",
    firstSide: "player",
    sides: { player: buildSide(), ai: buildSide() },
    currentNodeId: null,
    encounterNodeIds: null,
    encounterDestId: null,
    encounterKind: "hostile",
    encounterEndPending: null,
    selectedCardId: null,
    selectedCommittedId: null,
    gameOver: null,
    log: [],
    past: [],
    timeline: [],
    outcomes: []
  };

  setState(s);
  return s;
}

// Place a card directly into a slot — bypasses commit/flip machinery. Useful when a test wants
// to set up a board configuration and assert on engine queries.
export function placeForTest(state, side, loc, slot, card, opts = {}) {
  const lc = state.sides[side].locations[loc];
  const { revealed = true } = opts;
  card.revealed = revealed;
  if (slot === "structure") lc.structure = card;
  else if (slot === "action") lc.action = card;
  else lc.creatures[slot] = card;
}

// Spawn a fresh card from a CARD_DEFS key.
export function spawn(defKey, owner = "player") {
  return createCard(defKey, owner);
}
