// Damage primitive — the unified "apply N damage" function for combat, action damage,
// deathwish damage, and any other source.
//
// Contract: REBUILD_PLAN §30 — Damage application + fall-through.
//
// - Damage targets only Durability. Creatures and summoners have Durability.
// - Fall-through: if no creature target is available at the location, damage falls through to
//   the OPPOSING summoner (boss; or no-op fizzle for non-boss hostile AI per §31).
// - Single-target with no creatures → opposing summoner once.
// - Multi-target ("deal X to each") with no creatures → opposing summoner ONCE (not per
//   phantom target).
// - Friendly-fire on empty board → does nothing. Only enemy-targeted damage falls through to
//   the enemy summoner.
// - Non-damage effects don't fall through (caller's concern; they don't call applyDamage).
//
// Death:
// - A creature dropped to 0 Durability has `pendingLeavePile` set here. The card stays in its
//   slot until the orchestrator drives the next beat (the visible death moment per §17).
// - The orchestrator calls completeDeath(card) on a later beat to actually route via leavePlay.

import { applyBuff } from "./buffs.ts";
import { getCardDef } from "./cards.ts";
import { emit } from "./events.ts";
import { leavePlay } from "./piles.ts";
import { routeOnLeavePlay, type PileTarget } from "./routing.ts";
import { effectiveStat } from "./stats.ts";
import { locationStatTotal } from "./location-totals.ts";
import { creatureTargetsOnSide } from "./targeting.ts";
import type { CardInstance, GameState, InstId, PileZone, Side } from "./types.ts";

// ---------- Public types ----------

export type DamageKind = "melee" | "ranged" | "action" | "deathwish" | "thorns";

export interface DamageTarget {
  // "creature" — damage lands on a specific creature instance.
  // "summoner" — damage lands on the side's summoner (Durability on SideState).
  // "none" — friendly-fire on empty board, damage source's own side hit nothing legal. No-op.
  kind: "creature" | "summoner" | "none";
  creatureInstId?: InstId;
  summonerSide?: Side;
}

export interface DamageResult {
  target: DamageTarget;
  damageDealt: number; // 0 if the target was "none" or fizzled
  targetDiedNow: boolean; // true if this hit dropped a creature to 0 durability
  // Thorns trigger info per §26 / §30. Non-null iff this hit was melee combat damage that
  // triggered Spite thorns. The orchestrator queues a separate beat to apply this back to the
  // attacker via applyDamage with damageKind: "thorns". Thorns can itself kill the attacker
  // and may cascade further.
  thornsToAttacker: ThornsTrigger | null;
}

export interface ThornsTrigger {
  // The InstId of the attacker that should take the thorns damage.
  attackerInstId: InstId;
  // Thorns amount to deal back to the attacker.
  amount: number;
  // "defender" — per-card Spite on the defender that was hit (creature target).
  // "summoner-fallthrough" — per-location Spite total on the defender's side (when attacker hit
  // through to the summoner with no defender blocking).
  source: "defender" | "summoner-fallthrough";
  // The location to resolve thorns damage at (for tracking; matches the swing location).
  loc: string;
}

export interface ApplyDamageOptions {
  state: GameState;
  amount: number;
  attackerSide: Side; // for "opposing summoner" routing on fall-through
  attackerInstId: InstId | null; // for thorns / per-turn tracking; null for sourceless damage
  loc: string;
  damageKind: DamageKind;
  // Candidate creature targets per attack pattern / effect text. Empty array means
  // "no legal creature target here" → fall-through applies.
  // For single-target effects: pick a random one (Pillar 10).
  // For multi-target effects: caller invokes applyDamage once per target; fall-through is
  // handled separately by applyMultiTargetEmpty.
  candidateCreatureTargets: InstId[];
  // When the candidate list is empty and we'd fall through: which side is the enemy?
  // For combat damage this is the side OPPOSITE attackerSide. For deathwish / action damage
  // it's whatever the effect targets — caller specifies.
  enemySide: Side;
  // Friendly-fire variant: if the damage is friendly-targeted (e.g., cleave on the attacker's
  // own side) and no creature is hit, the damage does NOT fall through to a summoner.
  isFriendlyFire?: boolean;
}

// ---------- Public API ----------

/**
 * Apply a single hit of damage. Picks a random target from candidates if the kind is
 * single-target; falls through to enemy summoner if candidates is empty (and not friendly fire).
 *
 * Returns a DamageResult describing what was hit and whether something died.
 */
export function applyDamage(opts: ApplyDamageOptions): DamageResult {
  const { state, amount, candidateCreatureTargets, enemySide, isFriendlyFire } = opts;

  // Emit one structured "damage" event for EVERY applyDamage call (the single chokepoint all
  // damage flows through — combat, action, deathwish, thorns). This is how the trace / UI see the
  // OUTCOME of an effect (e.g. what Spark hit), not just that a card flipped. The result carries
  // target kind/instId, amount dealt, and whether the target died. emit no-ops cleanly with no
  // handler, so this is safe in headless tests too.
  const finish = (result: DamageResult): DamageResult => {
    emit(state, "damage", {
      damageKind: opts.damageKind,
      attackerSide: opts.attackerSide,
      attackerInstId: opts.attackerInstId,
      loc: opts.loc,
      amountRequested: amount,
      result,
    });
    return result;
  };

  if (amount <= 0) {
    return finish(noDamage());
  }

  // Has a creature target? Pick one randomly per Pillar 10.
  if (candidateCreatureTargets.length > 0) {
    const idx = Math.floor(rand(state) * candidateCreatureTargets.length);
    const instId = candidateCreatureTargets[idx]!;
    const card = state.cards[instId];
    if (!card || card.durability == null) {
      // Should not happen — candidate list pre-filtered upstream.
      return finish(noDamage());
    }
    const result = applyDamageToCreature(state, card, amount, opts);
    result.thornsToAttacker = computeDefenderThorns(state, card, opts);
    return finish(result);
  }

  // No creature target. Friendly fire on empty board fizzles.
  if (isFriendlyFire) {
    return finish(noDamage());
  }

  // Fall through to enemy summoner. For hostile non-boss encounters the enemy side may have
  // no summoner Durability — per §31 the damage fizzles in that case.
  const result = applyDamageToSummoner(state, amount, enemySide);
  // Summoner thorns: only triggers on melee combat fall-through that ACTUALLY landed on the
  // summoner. If the side has no summoner Durability (fizzle), no thorns trigger.
  if (result.target.kind === "summoner") {
    result.thornsToAttacker = computeSummonerThorns(state, opts, enemySide);
  }
  return finish(result);
}

function noDamage(): DamageResult {
  return { target: { kind: "none" }, damageDealt: 0, targetDiedNow: false, thornsToAttacker: null };
}

/**
 * Apply single-target damage at each encounter location independently. Per §30 / DESIGN line 875:
 * "Scope-extended damage resolves per-location. Locations with creatures → random pick at that
 * location. Locations with no creatures → damage to the opposing summoner from that location."
 *
 * Returns one DamageResult per location, in encounter location order. Caller can use these for
 * UI pacing (one beat per location, target flash per result, etc.).
 *
 * The candidate-gathering is done per-location automatically; caller doesn't need to know the
 * geometry. attackerInstId is the source instId (for thorns trigger); pass null for sourceless
 * scope damage (e.g., from a structure pulse).
 */
export function applyScopedDamage(opts: {
  state: GameState;
  amount: number;
  attackerSide: Side;
  attackerInstId: InstId | null;
  damageKind: DamageKind;
  enemySide: Side;
  isFriendlyFire?: boolean;
}): DamageResult[] {
  const { state } = opts;
  if (!state.currentEncounter) return [];
  const results: DamageResult[] = [];
  for (const loc of state.currentEncounter.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    // Gather candidates at this location: face-up creatures on the targeted side (face-down
    // haven't entered play and can't be targeted), deduped for multi-slot. Use the explicit
    // enemySide (may equal attackerSide for friendly-fire scoped damage).
    const candidates = creatureTargetsOnSide(state, opts.enemySide, loc);
    const damageOpts: ApplyDamageOptions = {
      state,
      amount: opts.amount,
      attackerSide: opts.attackerSide,
      attackerInstId: opts.attackerInstId,
      loc,
      damageKind: opts.damageKind,
      candidateCreatureTargets: candidates,
      enemySide: opts.enemySide,
    };
    if (opts.isFriendlyFire != null) damageOpts.isFriendlyFire = opts.isFriendlyFire;
    const result = applyDamage(damageOpts);
    results.push(result);
  }
  return results;
}

/**
 * Apply damage to the enemy summoner exactly once for a multi-target effect that found no
 * creature targets at the location. Per §30: "deal X to each" with empty board → enemy
 * summoner once, not per phantom target.
 *
 * Caller invokes this in lieu of running applyDamage per phantom target. If the multi-target
 * effect did hit at least one creature, no fall-through happens — caller skips this.
 */
export function applyMultiTargetEmpty(
  state: GameState,
  amount: number,
  enemySide: Side,
): DamageResult {
  // Multi-target fall-through with no candidates is treated as a non-thorns source — it has
  // no single attacker to retaliate against in the orchestrator's swing model. (Action damage
  // is the canonical caller of this path.) Spite does not trigger on action damage per §26.
  return applyDamageToSummoner(state, amount, enemySide);
}

/**
 * Drive the second beat of a death. The creature has pendingLeavePile set and has been visible
 * in its slot since the damage hit. Now: fire deathwish (TODO Phase I), then call leavePlay to
 * route the card to its destination pile.
 *
 * The orchestrator calls this on a separate beat per §17 so the player sees the creature die
 * in place before being swept away.
 */
export function completeDeath(
  state: GameState,
  card: CardInstance,
  fromSide: Side,
  fromLoc: string,
): void {
  if (card.pendingLeavePile == null) return;
  // leavePlay handles pile routing, equipment detachment, encounter-scoped buff revert. It also
  // fires onLeavePlay (deathwish) BEFORE the card moves to its pile per REBUILD §17.
  leavePlay(state, card, fromSide, fromLoc, "creatureDied");
  // Clear the pendingLeavePile flag so a second completeDeath call (defensive / cascade-loop
  // safety) is a no-op rather than re-firing the handler.
  card.pendingLeavePile = null;
}

function pileTargetZone(target: PileTarget): PileZone {
  switch (target.kind) {
    case "sidePile":
      return target.zone;
    case "locationPile":
      return target.zone;
    case "trash":
      return "trash";
  }
}

// ---------- Internals ----------

function applyDamageToCreature(
  state: GameState,
  card: CardInstance,
  amount: number,
  opts: ApplyDamageOptions,
): DamageResult {
  if (card.durability == null) {
    return noDamage();
  }
  const before = card.durability;
  const dealt = Math.min(amount, before);
  card.durability = before - dealt;

  // Enraged: defender gains +1 Force this turn when it takes damage. Only fires if damage was
  // actually dealt (dealt > 0). Per the prototype's r8 Goblin Berserker.
  if (dealt > 0) {
    const def = getCardDef(card.defKey);
    if (def.enraged) {
      applyBuff(state, card, { stat: "force", amount: 1, scope: "turn" });
    }
  }

  // Track melee attackers on this defender for this turn. Used by Explosive Trap's deathwish
  // and any future "damage source" cards. Only melee combat damage counts (not action / ranged
  // / thorns / deathwish). Dedup by attacker instId so multiple swings from the same attacker
  // record once.
  if (dealt > 0 && opts.damageKind === "melee" && opts.attackerInstId != null) {
    if (!card.meleeAttackersThisTurn.includes(opts.attackerInstId)) {
      card.meleeAttackersThisTurn.push(opts.attackerInstId);
    }
  }

  let died = false;
  if (card.durability <= 0 && card.pendingLeavePile == null) {
    // Death detected. Set pendingLeavePile but don't route yet — that's the next beat per §17.
    // The defending creature's side is OPPOSITE the attacker's side; we route from that side.
    const defenderSide = opposingSideOf(opts.attackerSide);
    const pile = routeOnLeavePlay(state, card, defenderSide, opts.loc, "creatureDied");
    card.pendingLeavePile = pileTargetZone(pile);
    died = true;
  }

  return {
    target: { kind: "creature", creatureInstId: card.instId },
    damageDealt: dealt,
    targetDiedNow: died,
    thornsToAttacker: null, // populated by caller (applyDamage) after this returns
  };
}

function applyDamageToSummoner(state: GameState, amount: number, side: Side): DamageResult {
  if (!state.currentEncounter) {
    return noDamage();
  }
  const sideState = side === "player" ? state.currentEncounter.playerSide : state.currentEncounter.aiSide;
  // Per §31: AI in non-boss hostile encounters has no summoner Durability. aiSide null = fizzle.
  if (!sideState) {
    return noDamage();
  }
  const before = sideState.durability;
  const dealt = Math.min(amount, before);
  sideState.durability = before - dealt;
  return {
    target: { kind: "summoner", summonerSide: side },
    damageDealt: dealt,
    targetDiedNow: sideState.durability <= 0,
    thornsToAttacker: null, // populated by caller (applyDamage) after this returns
  };
}

function opposingSideOf(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

// ---------- Thorns computation ----------
//
// Per §26 / §30: Spite triggers on MELEE COMBAT damage only.
// - Per-card thorns: when a defender's Durability is lowered by melee combat damage, the
//   attacker takes thorns equal to the defender's effective Spite.
// - Per-location thorns: when melee combat damage falls through to the summoner, the attacker
//   takes thorns equal to the defender side's total Spite at that location.
// Ranged, action, deathwish, and thorns-itself damage do NOT trigger thorns.

function computeDefenderThorns(
  state: GameState,
  defender: CardInstance,
  opts: ApplyDamageOptions,
): ThornsTrigger | null {
  if (opts.damageKind !== "melee") return null;
  if (opts.attackerInstId == null) return null;
  const defenderSide = opposingSideOf(opts.attackerSide);
  const spite = effectiveStat(state, defender, defenderSide, opts.loc, "spite");
  if (spite <= 0) return null;
  return {
    attackerInstId: opts.attackerInstId,
    amount: spite,
    source: "defender",
    loc: opts.loc,
  };
}

function computeSummonerThorns(
  state: GameState,
  opts: ApplyDamageOptions,
  defenderSide: Side,
): ThornsTrigger | null {
  if (opts.damageKind !== "melee") return null;
  if (opts.attackerInstId == null) return null;
  const total = locationStatTotal(state, defenderSide, opts.loc, "spite");
  if (total <= 0) return null;
  return {
    attackerInstId: opts.attackerInstId,
    amount: total,
    source: "summoner-fallthrough",
    loc: opts.loc,
  };
}

// Simple seeded RNG hook — Phase G uses Math.random; later phases will route through a seeded
// per-encounter RNG on state. For now this lets tests stub it.
function rand(_state: GameState): number {
  return Math.random();
}
