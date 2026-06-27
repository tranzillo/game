// Card instance creation + registry access.
//
// Contract: ENGINE_SKETCH.md Phase A.
//
// Card defs live in src/data/ (Phase M will populate). The engine accesses defs via a
// lookup function; the registry of defs is injected at engine boot rather than hardcoded here
// to keep the engine layer independent of content data.

import type {
  CardDef,
  CardInstance,
  CardOrigin,
  CardRegistry,
  GameState,
  InstId,
} from "./types.ts";

// ---------- Card def lookup ----------
//
// Content modules populate this map at boot. Engine code reads via getCardDef.

const cardDefs: Record<string, CardDef> = {};

export function registerCardDef(def: CardDef): void {
  if (cardDefs[def.defKey] != null) {
    throw new Error(`Duplicate card def registered: ${def.defKey}`);
  }
  cardDefs[def.defKey] = def;
}

export function getCardDef(defKey: string): CardDef {
  const def = cardDefs[defKey];
  if (!def) throw new Error(`No card def for key: ${defKey}`);
  return def;
}

export function hasCardDef(defKey: string): boolean {
  return cardDefs[defKey] != null;
}

/**
 * Clear all card defs. Used in tests for isolation.
 */
export function _resetCardDefs(): void {
  for (const k of Object.keys(cardDefs)) delete cardDefs[k];
}

// ---------- Card instance creation ----------

/**
 * Create a new CardInstance from a def, allocate a new InstId, and add to the registry.
 *
 * Origin is set at creation and immutable thereafter.
 * Per-instance state is initialized to defaults; the card has no position (slots: []) and
 * is not in any container until placed.
 */
export function createCardInstance(state: GameState, defKey: string, origin: CardOrigin): InstId {
  const def = getCardDef(defKey);
  const instId = allocateInstId(state);
  const instance: CardInstance = {
    instId,
    defKey,
    origin,
    revealed: true, // default — face-up. Flipped face-down by commit logic.
    slots: [],
    markCount: 0,
    durability: def.type === "creature" && def.durability != null ? def.durability : null,
    sleepCounter: 0,
    wokeInPhase: null,
    skipAttackThisTurn: false,
    buffs: [],
    equipment: [],
    grantedPatterns: [],
    meleeAttackersThisTurn: [],
    pendingLeavePile: null,
  };
  state.cards[instId] = instance;
  return instId;
}

let _nextInstId = 1;

function allocateInstId(_state: GameState): InstId {
  return _nextInstId++;
}

/**
 * Reset the instance id counter. Used in tests for deterministic ids.
 */
export function _resetInstIdCounter(): void {
  _nextInstId = 1;
}

// ---------- Registry access ----------

export function getCard(cards: CardRegistry, instId: InstId): CardInstance {
  const c = cards[instId];
  if (!c) throw new Error(`No card with instId ${instId}`);
  return c;
}

export function getCardOrNull(cards: CardRegistry, instId: InstId): CardInstance | null {
  return cards[instId] ?? null;
}
