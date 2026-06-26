// Draw + cleanup-discard primitives — the per-turn hand economy.
//
// Contract: prototype phases.js (BASE_DRAW_TARGET = 5; "drawing fills the hand up to 5 + Insight
// cards"; cleanup keeps the leftmost Resolve-N of the hand and discards the rest), REBUILD §26
// (Insight global adds to draw count; Resolve global sets leftmost-N hand-size kept at cleanup),
// §28 (draw/cleanup substantives), §29 (deck-empty draw reshuffles discard into deck).
//
// Initiative (DECISIONS 2026-06-12) orders these side-level activities: the initiative side
// draws first and discards first. The orchestrator drives that ordering; these primitives are
// per-side.

import { reshuffleDiscardIntoDeck } from "./piles.ts";
import { globalStatTotal } from "./location-totals.ts";
import type { GameState, InstId, Side } from "./types.ts";

// Base draw target per the prototype: each side draws UP TO this + its global Insight.
export const BASE_DRAW_TARGET = 5;

function sideStateOf(state: GameState, side: Side) {
  if (!state.currentEncounter) return null;
  return side === "player" ? state.currentEncounter.playerSide : state.currentEncounter.aiSide;
}

/**
 * The side's draw target this turn: BASE_DRAW_TARGET + global Insight (summed across the
 * encounter's locations per §26).
 */
export function drawTargetFor(state: GameState, side: Side): number {
  return BASE_DRAW_TARGET + globalStatTotal(state, side, "insight");
}

/**
 * Draw one card: top of deck → hand. If the deck is empty, the discard reshuffles into the
 * deck first (§29). Returns the drawn instId, or null if both deck and discard are empty
 * (truly out — caller stops drawing).
 */
export function drawOneCard(state: GameState, side: Side): InstId | null {
  const s = sideStateOf(state, side);
  if (!s) return null;
  if (s.deck.length === 0 && s.discard.length > 0) {
    reshuffleDiscardIntoDeck(state, side);
  }
  const drawn = s.deck.shift();
  if (drawn == null) return null;
  s.hand.push(drawn);
  return drawn;
}

/**
 * True iff the side still wants to draw (hand below target) AND can (deck or discard nonempty).
 */
export function wantsToDraw(state: GameState, side: Side): boolean {
  const s = sideStateOf(state, side);
  if (!s) return false;
  if (s.hand.length >= drawTargetFor(state, side)) return false;
  return s.deck.length > 0 || s.discard.length > 0;
}

/**
 * Cleanup discard per the prototype: keep the LEFTMOST N cards of the hand where N = the side's
 * global Resolve; discard the rest. With Resolve 0 this is the full-hand discard (DESIGN:
 * "Cleanup — full-hand discard"; Resolve retention is the counter-mechanic).
 *
 * Returns the discarded instIds (possibly empty).
 */
export function discardHandToResolve(state: GameState, side: Side): InstId[] {
  const s = sideStateOf(state, side);
  if (!s) return [];
  const resolve = globalStatTotal(state, side, "resolve");
  const kept = s.hand.slice(0, resolve);
  const discarded = s.hand.slice(resolve);
  s.hand = kept;
  for (const id of discarded) s.discard.push(id);
  return discarded;
}
