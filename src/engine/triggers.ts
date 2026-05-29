// Trigger handler registry — Phase G's thin version. Phase I expands this with full event
// subscriptions, deathwish, action effects, etc.
//
// Contract: ENGINE_SKETCH.md Phase G + Phase I, REBUILD_PLAN §28/§29.
//
// For Phase G: just the flip-up trigger dispatcher (FLIP_UP_HANDLERS).
// Each card def can declare onFlipUp: string; the engine looks up the tagged handler and
// calls it when the card flips face-up during the flip queue drain.

import { getCardDef } from "./cards.ts";
import type { CardInstance, GameState, Side } from "./types.ts";

// ---------- Handler context ----------

export interface FlipUpContext {
  state: GameState;
  card: CardInstance;
  side: Side;
  loc: string;
}

export type FlipUpHandler = (ctx: FlipUpContext) => void;

// ---------- Registry ----------

const FLIP_UP_HANDLERS: Record<string, FlipUpHandler> = {};

export function registerFlipUpHandler(tag: string, handler: FlipUpHandler): void {
  if (FLIP_UP_HANDLERS[tag] != null) {
    throw new Error(`Duplicate flip-up handler registered: ${tag}`);
  }
  FLIP_UP_HANDLERS[tag] = handler;
}

export function getFlipUpHandler(tag: string): FlipUpHandler | null {
  return FLIP_UP_HANDLERS[tag] ?? null;
}

/**
 * Clear all flip-up handlers. Used in tests for isolation.
 */
export function _resetFlipUpHandlers(): void {
  for (const k of Object.keys(FLIP_UP_HANDLERS)) delete FLIP_UP_HANDLERS[k];
}

// ---------- Dispatch ----------

/**
 * Fire the card's onFlipUp handler if it has one. No-op if the card doesn't declare onFlipUp
 * or the tag isn't registered.
 *
 * Called from the flip queue drain. Pure: mutates state, returns void. Phase I will also fire
 * location-text onFlipUp here.
 */
export function fireFlipUpTrigger(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): void {
  const def = getCardDef(card.defKey);
  if (!def.onFlipUp) return;
  const handler = getFlipUpHandler(def.onFlipUp);
  if (!handler) return;
  handler({ state, card, side, loc });
}
