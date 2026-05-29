// Cost evaluation.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §26.
//
// Single cost-check at cast (per §26 the double-check was rejected). If commit-time check passes,
// the card is committed; no resolve-time recheck.
//
// Comparative costs evaluate against currently-visible opponent state at cast. Face-down
// opponent cards count as 0 for the comparison.

import { getCardDef } from "./cards.ts";
import { locationStatTotal } from "./location-totals.ts";
import { other } from "./stats.ts";
import type { CardInstance, CostRequirement, GameState, Side } from "./types.ts";

/**
 * Returns effective costs for a card. Applies per-instance escalation for forageAddAmmo /
 * mirrorImage / etc. The base costs come from def.costs.
 *
 * Escalation lives here so the cost-evaluation pipeline goes through one function.
 */
export function effectiveCosts(card: CardInstance): CostRequirement[] {
  const def = getCardDef(card.defKey);
  const base = def.costs.map((c) => ({ ...c }));

  // Forage escalating Tempo: each cast adds +1 Tempo.
  if (def.effect === "forageAddAmmo" && (card.forageCasts ?? 0) > 0) {
    addOrCreateAbsoluteCost(base, "tempo", card.forageCasts ?? 0);
  }
  // Mirror Image escalating Insight: each cast adds +1 Insight.
  if (def.effect === "mirrorImage" && (card.mirrorCasts ?? 0) > 0) {
    addOrCreateAbsoluteCost(base, "insight", card.mirrorCasts ?? 0);
  }

  return base;
}

function addOrCreateAbsoluteCost(
  costs: CostRequirement[],
  stat: CostRequirement extends { stat: infer S } ? S : never,
  extra: number,
): void {
  for (const c of costs) {
    if (c.kind === "absolute" && c.stat === stat) {
      c.amount += extra;
      return;
    }
  }
  costs.push({ kind: "absolute", stat, amount: extra });
}

/**
 * Evaluates whether a card can be cast at side+loc right now.
 * Reads location stat totals (committed only) for absolute checks.
 * For comparative checks: evaluates side vs opponent at the same loc using committed totals.
 */
export function evaluateCost(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): boolean {
  const costs = effectiveCosts(card);
  for (const c of costs) {
    if (!checkOne(state, side, loc, c)) return false;
  }
  return true;
}

function checkOne(
  state: GameState,
  side: Side,
  loc: string,
  cost: CostRequirement,
): boolean {
  const own = locationStatTotal(state, side, loc, cost.stat);
  if (cost.kind === "absolute") {
    return own >= cost.amount;
  }
  const opp = locationStatTotal(state, other(side), loc, cost.stat);
  if (cost.kind === "comparativeMore") return own > opp;
  if (cost.kind === "comparativeLess") return own < opp;
  if (cost.kind === "comparativeEqual") return own === opp;
  return false;
}
