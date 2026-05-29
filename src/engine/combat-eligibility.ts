// Combat eligibility predicate.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §26/§30.
//
// The combat-eligibility predicate is what gates "Force at this location" — only creatures that
// pass this predicate contribute their effective Force to the location's Force total. The same
// predicate determines who attacks during combat phase.

import { effectiveStat } from "./stats.ts";
import {
  hasMeleePattern,
  hasRangedPattern,
  rangedAmmoCost,
} from "./attack-patterns.ts";
import { frontRowPositions, backRowPositions } from "./profile.ts";
import type { CardInstance, GameState, Side } from "./types.ts";

/**
 * Returns true iff this creature is eligible to attack from its current position during the
 * current combat phase.
 *
 * Conditions (all must hold):
 * - card.revealed (face-up)
 * - sleepCounter === 0 (not asleep)
 * - wokeInPhase !== currentPhase (didn't just wake this phase)
 * - effectiveStat(force) > 0 (has Force to deal)
 * - !skipAttackThisTurn (not skip-flagged by an effect)
 * - position-pattern compatible:
 *     * If creature has melee pattern AND is in front row → eligible (melee).
 *     * If creature has ranged pattern AND is in back row AND has ammo at location ≥ ranged cost → eligible.
 *     * Otherwise not eligible to attack from this position.
 */
export function combatEligible(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): boolean {
  // Per the combat-eligibility predicate spec from REBUILD_PLAN §26/§30 + ENGINE_SKETCH Phase B.
  if (!card.revealed) return false;
  if (card.sleepCounter > 0) return false;
  if (state.currentEncounter && card.wokeInPhase === state.currentEncounter.phase) return false;
  if (card.skipAttackThisTurn) return false;
  if (effectiveStat(state, card, side, loc, "force") <= 0) return false;

  // Position-pattern check
  const ns = state.world.nodeState[loc];
  if (!ns) return false;
  const profile = ns.profile;
  const frontRow = new Set(frontRowPositions(profile, "creature"));
  const backRow = new Set(backRowPositions(profile, "creature"));

  // Card occupies multiple positions for multi-slot creatures. Compute "is in front row" /
  // "is in back row" for at least one of its slots. For a row-spanner that's in both rows
  // (1-row profile), both are true.
  let isFront = false;
  let isBack = false;
  for (const pos of card.slots) {
    if (frontRow.has(pos)) isFront = true;
    if (backRow.has(pos)) isBack = true;
  }

  const melee = hasMeleePattern(card);
  const ranged = hasRangedPattern(card);

  if (isFront && melee) return true;
  if (isBack && ranged) {
    const cost = rangedAmmoCost(card) || 1;
    const ammo = ns.ammo[side];
    if (ammo >= cost) return true;
  }

  // Special case: 1-row profile, where every slot is both front and back. A ranged creature
  // with ammo is eligible; a melee creature is also eligible. The isFront / isBack flags
  // above both true → the previous checks cover this.

  return false;
}
