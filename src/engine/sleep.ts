// Sleep + wake state primitives.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §26.
//
// Sleep counter ticks at end of cleanup. Damage-waking happens during combat; the woken
// creature is "groggy this phase" (wokeInPhase) and can't act for the rest of the current phase.

import type { CardInstance, CardRegistry, Phase } from "./types.ts";

/**
 * Set a card's sleep counter to max(current, turns). Applies only on a positive duration.
 */
export function applySleep(card: CardInstance, turns: number): void {
  if (turns <= 0) return;
  if (turns > card.sleepCounter) card.sleepCounter = turns;
}

/**
 * Decrement sleepCounter on every creature in the registry (clamped to 0). Called at end of cleanup.
 */
export function tickSleep(cards: CardRegistry): void {
  for (const id of Object.keys(cards)) {
    const c = cards[Number(id)];
    if (!c) continue;
    if (c.sleepCounter > 0) c.sleepCounter -= 1;
  }
}

/**
 * Wake a card from damage. Clears sleep counter and sets wokeInPhase so the card can't act
 * for the rest of the current phase.
 */
export function wakeFromDamage(card: CardInstance, currentPhase: Phase): void {
  if (card.sleepCounter > 0) {
    card.sleepCounter = 0;
    card.wokeInPhase = currentPhase;
  }
}

/**
 * Reset per-phase grog flags. Called at end of cleanup along with sleep tick.
 */
export function clearWokeInPhase(cards: CardRegistry): void {
  for (const id of Object.keys(cards)) {
    const c = cards[Number(id)];
    if (!c) continue;
    c.wokeInPhase = null;
  }
}
