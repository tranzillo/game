// Pattern → target list dispatcher.
//
// Contract: REBUILD_PLAN §30 — "attack patterns are per-card; the engine has a pattern dispatcher
// (string-tagged). Adding a new pattern is a code change."
//
// Given an attacker, its side, location, and one of its patterns, return the list of creature
// InstIds that the pattern hits at this location. The caller (combat orchestrator) calls
// applyDamage once per target (or applyMultiTargetEmpty if a multi-target pattern hit no one).
//
// The DEFAULT target rule is ONE rule shared by every attack type: hit the space directly in
// front (the attacker's column, front-row-first via profile.across). Melee and ranged use the
// SAME default — they differ only in where the attacker may fire from, which is a
// combat-eligibility concern (melee front row only; ranged back or front + ammo), never a
// targeting one. Printed patterns (cleave, pierce, and future keywords) are deviations that build
// on the same shared primitive (findPrimaryTarget) so the base rule can never drift between them.

import { behind, sameRowNeighbors } from "./profile.ts";
import { isTargetableId, primaryTargetInFront } from "./targeting.ts";
import type { AttackPattern, CardInstance, GameState, InstId, Side } from "./types.ts";

export interface PatternTargetResult {
  // The kind of effect for damage application.
  damageKind: "melee" | "ranged";
  // Whether this pattern is single-target or multi-target. Used by the orchestrator to decide
  // whether to fall-through-once (single) or call applyMultiTargetEmpty when no creatures hit
  // (multi).
  targetMode: "single" | "multi-each";
  // Creature InstIds that this pattern hits at this location.
  creatureTargets: InstId[];
  // Damage per target for this pattern.
  damagePerTarget: number;
  // Whether the pattern is enemy-targeted (not friendly-fire). Default true. Friendly-fire
  // patterns (Red's printed cleave variants) use isFriendlyFire on the orchestrator side.
  isFriendlyFire?: boolean;
}

type DamageKind = PatternTargetResult["damageKind"];

/**
 * Resolve a pattern to a target list. `forceForAttacker` is the attacker's effective Force
 * (computed by the orchestrator), which is the per-target damage unless the pattern sets it.
 *
 * Returns null if this pattern is not yet implemented.
 */
export function patternTargets(
  state: GameState,
  attacker: CardInstance,
  side: Side,
  loc: string,
  pattern: AttackPattern,
  forceForAttacker: number,
): PatternTargetResult | null {
  // damageKind is the only thing the attack TYPE contributes to targeting; melee and ranged are
  // otherwise the same default rule.
  const damageKind: DamageKind = pattern.kind === "ranged" ? "ranged" : "melee";
  const damagePerTarget = pattern.setDamage ?? forceForAttacker;

  switch (pattern.kind) {
    case "default":
    case "ranged":
      return singlePrimaryTarget(state, attacker, side, loc, damageKind, damagePerTarget);
    case "cleave":
      return cleaveTargets(state, attacker, side, loc, damageKind, damagePerTarget);
    case "pierce":
      return pierceTargets(state, attacker, side, loc, damageKind, damagePerTarget);
    default:
      return null;
  }
}

// ---------- Shared primitive: the default target ----------
//
// The single source of truth for "what's in front of me" is targeting.primaryTargetInFront —
// front-first within the attacker's column, gated to face-up (a face-down card hasn't entered
// play and is neither a blocker nor a target). default, ranged, cleave, and pierce all build on
// it so the base rule can never drift between them.

/**
 * Default single-target swing — the shared rule for melee AND ranged. Just the primary target,
 * or an empty list when nothing is in front (→ the orchestrator falls through to the enemy
 * summoner).
 */
function singlePrimaryTarget(
  state: GameState,
  attacker: CardInstance,
  side: Side,
  loc: string,
  damageKind: DamageKind,
  damagePerTarget: number,
): PatternTargetResult {
  const primary = primaryTargetInFront(state, attacker, side, loc);
  return {
    damageKind,
    targetMode: "single",
    creatureTargets: primary ? [primary.instId] : [],
    damagePerTarget,
  };
}

// ---------- Printed deviations from the default ----------

/**
 * Cleave: the default primary target + any same-row neighbors of that target on the opposing
 * side (DESIGN.md line 799 — an attack pattern that includes adjacent spaces). If nothing is in
 * front, the empty list falls through to the summoner exactly like the default swing.
 *
 * Damage is uniform across targets (pattern.setDamage or attacker Force, resolved upstream).
 */
function cleaveTargets(
  state: GameState,
  attacker: CardInstance,
  side: Side,
  loc: string,
  damageKind: DamageKind,
  damagePerTarget: number,
): PatternTargetResult {
  const primary = primaryTargetInFront(state, attacker, side, loc);
  if (!primary) {
    return { damageKind, targetMode: "single", creatureTargets: [], damagePerTarget };
  }
  const ns = state.world.nodeState[loc]!;
  const otherSlots = ns.sideSlots[side === "player" ? "ai" : "player"];

  const targets: InstId[] = [primary.instId];
  const seen = new Set<InstId>([primary.instId]);
  for (const neighborPos of sameRowNeighbors(ns.profile, "creature", primary.pos)) {
    const id = otherSlots.creatures[neighborPos];
    if (id == null || seen.has(id)) continue;
    if (!isTargetableId(state, id)) continue; // a face-down neighbor isn't in play; skip
    seen.add(id);
    targets.push(id);
  }
  return { damageKind, targetMode: "multi-each", creatureTargets: targets, damagePerTarget };
}

/**
 * Pierce: the default primary target + the space directly behind it (same column, back row). A
 * swing that passes THROUGH the front target into the back-row position (prototype r11 Goblin
 * Pike). If nothing is in front, the empty list falls through like the default swing.
 *
 * Damage is currently uniform (both take damagePerTarget); a reduced back-row hit via
 * pattern.value is future design space, not wired here.
 */
function pierceTargets(
  state: GameState,
  attacker: CardInstance,
  side: Side,
  loc: string,
  damageKind: DamageKind,
  damagePerTarget: number,
): PatternTargetResult {
  const primary = primaryTargetInFront(state, attacker, side, loc);
  if (!primary) {
    return { damageKind, targetMode: "single", creatureTargets: [], damagePerTarget };
  }
  const ns = state.world.nodeState[loc]!;
  const otherSlots = ns.sideSlots[side === "player" ? "ai" : "player"];

  const targets: InstId[] = [primary.instId];
  const behindPos = behind(ns.profile, "creature", primary.pos);
  if (behindPos != null) {
    const behindId = otherSlots.creatures[behindPos];
    if (behindId != null && behindId !== primary.instId && isTargetableId(state, behindId)) {
      targets.push(behindId); // a face-down card behind the target isn't in play; skip
    }
  }
  return { damageKind, targetMode: "multi-each", creatureTargets: targets, damagePerTarget };
}
