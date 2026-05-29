// Effective attack patterns.
//
// Contract: ENGINE_SKETCH.md Phase B/H, REBUILD_PLAN §30.
//
// A creature's effective attack patterns are: its def's attackPatterns + any grantedPatterns
// pushed by attached equipment (Phase B's equipment.ts attach/detach).
//
// Pattern dispatch (per-kind resolution in Phase H) lives in src/engine/combat/patterns.ts; this
// module is the static read of what patterns a creature has right now.

import { getCardDef } from "./cards.ts";
import type { AttackPattern, CardInstance } from "./types.ts";

export function effectiveAttackPatterns(card: CardInstance): AttackPattern[] {
  const def = getCardDef(card.defKey);
  const own = def.attackPatterns ?? [];
  const granted = card.grantedPatterns.map((g) => g.pattern);
  return [...own, ...granted];
}

/**
 * Convenience: true iff the card has any melee pattern.
 * (A pattern is "ranged" iff its `kind` is "ranged"; everything else is melee for v1.
 *  Specifically, "default", "cleave", "pierce" are all melee.)
 */
export function hasMeleePattern(card: CardInstance): boolean {
  for (const p of effectiveAttackPatterns(card)) {
    if (p.kind !== "ranged") return true;
  }
  return false;
}

export function hasRangedPattern(card: CardInstance): boolean {
  for (const p of effectiveAttackPatterns(card)) {
    if (p.kind === "ranged") return true;
  }
  return false;
}

/**
 * Returns the ammo cost for the cheapest ranged pattern on this card, or 0 if none.
 * Used by combat eligibility to determine ammo gating.
 */
export function rangedAmmoCost(card: CardInstance): number {
  let min = 0;
  let seen = false;
  for (const p of effectiveAttackPatterns(card)) {
    if (p.kind !== "ranged") continue;
    const cost = p.ammoCost ?? 1;
    if (!seen || cost < min) {
      min = cost;
      seen = true;
    }
  }
  return seen ? min : 0;
}
