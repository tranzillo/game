// Effective stat reads — on-demand, layered.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §26.
//
// Algorithm (in order):
//   1. Non-creature → return 0.
//   2. Inert + stat in {F,T,I,R,S} → return 0 (Inert locks stat to 0 absolutely).
//   3. Sleep + stat == force → return 0 (sleeping creatures have no Force).
//   4. Start with printed base from def.
//   5. Add scoped stored buffs (sum buffs of this stat from card.buffs).
//   6. Add equipment add-grants (via stored buffs from attachEquipment — already in card.buffs).
//   7. Add conditional buff contributions (per-card-def flags).
//   8. Add aura contributions (sumAuraContributions).
//   9. If equipment has a set-grant for this stat, OVERRIDE the total with the set amount.
//
// Pure. No side effects.

import { getCardDef } from "./cards.ts";
import { getActiveSetOverride } from "./equipment.ts";
import { sumAuraContributions } from "./auras.ts";
import { sumBuffsForStat } from "./buffs.ts";
import { positionsOf } from "./profile.ts";
import { countOccupiedCreatureSlots, occupiedCreatureSlots } from "./targeting.ts";
import type {
  CardInstance,
  CardRegistry,
  GameState,
  Side,
  StatKind,
} from "./types.ts";

// ---------- Effective stat ----------

export function effectiveStat(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
  stat: StatKind,
): number {
  const def = getCardDef(card.defKey);

  // Non-creature: no stats.
  if (def.type !== "creature") return 0;

  // Inert: F/T/I/R/S locked to 0.
  if (def.inert && isInertLocked(stat)) return 0;

  // Sleep zeroes Force.
  if (card.sleepCounter > 0 && stat === "force") return 0;

  // Base printed stat (creatures only get here).
  const base = readPrinted(def, stat);

  // Stored buffs (turn / encounter / permanent / equipped add-buffs from equipment).
  const bufftotal = sumBuffsForStat(card, stat);

  // Conditional buffs (per-card flags).
  const cond = conditionalContribution(state, card, side, loc, stat);

  // Auras (any card in play with a registered aura).
  const aura = sumAuraContributions(state, {
    targetCard: card,
    targetSide: side,
    targetLoc: loc,
    stat,
  });

  let total = base + bufftotal + cond + aura;

  // Set-overrides from equipment win.
  const setOverride = getActiveSetOverride(card, stat);
  if (setOverride) total = setOverride.amount;

  return total;
}

function isInertLocked(stat: StatKind): boolean {
  return (
    stat === "force" ||
    stat === "tempo" ||
    stat === "insight" ||
    stat === "resolve" ||
    stat === "spite"
  );
}

function readPrinted(def: ReturnType<typeof getCardDef>, stat: StatKind): number {
  switch (stat) {
    case "force":
      return def.force ?? 0;
    case "tempo":
      return def.tempo ?? 0;
    case "insight":
      return def.insight ?? 0;
    case "resolve":
      return def.resolve ?? 0;
    case "spite":
      return def.spite ?? 0;
  }
}

// ---------- Conditional buff contributions ----------
//
// Per-card-def flags drive conditional buffs. Each flag adds a branch here.
// New conditional buffs add their flag to CardDef (types.ts) and their branch here.

function conditionalContribution(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
  stat: StatKind,
): number {
  const def = getCardDef(card.defKey);
  let bonus = 0;

  // Pit-Fighter: +2 Force while alone on your side here (no other creatures on your side at this loc).
  if (def.pitFighterWhileAlone && stat === "force") {
    if (isAloneOnSide(state, card, side, loc)) bonus += 2;
  }

  // Provocation Challenger: +1 Force per opposing creature here.
  if (def.provocationChallenger && stat === "force") {
    bonus += countOpposingCreatures(state, side, loc);
  }

  // Apprentice: +1 Insight per action this side has resolved this turn.
  if (def.apprenticeInsightFromActions && stat === "insight") {
    if (!state.currentEncounter) {
      // no encounter
    } else if (side === "player") {
      bonus += state.currentEncounter.playerSide.actionsThisTurn;
    } else if (state.currentEncounter.aiSide) {
      bonus += state.currentEncounter.aiSide.actionsThisTurn;
    }
  }

  // Provocation Challenger reverse-buff: this creature gains +1 Force per opposing Challenger
  // on the other side at this location.
  if (stat === "force") {
    bonus += countOpposingChallengers(state, side, loc);
  }

  return bonus;
}

// ---------- Conditional buff helpers ----------

const SIDES: Side[] = ["player", "ai"];

// These two are SLOT-OCCUPANCY counts, not targetability checks. A face-down committed card
// occupies its slot — it takes up space — so it COUNTS here even though it hasn't flipped. This
// is the relevant condition for "only creature on your side" and "per opposing creature" effects
// (the body is present in the world; whether it has flipped is irrelevant to occupancy). Contrast
// with targeting (pattern-targets / damage / buff application), where face-down is NOT a valid
// target because it hasn't entered play. Occupancy ≠ targetability. Both use the shared occupancy
// helpers in targeting.ts.
function isAloneOnSide(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): boolean {
  // Alone iff no OTHER creature occupies a slot on this side here (face-down occupants count).
  return occupiedCreatureSlots(state, side, loc).every((id) => id === card.instId);
}

function countOpposingCreatures(state: GameState, side: Side, loc: string): number {
  const otherSide = side === "player" ? "ai" : "player";
  return countOccupiedCreatureSlots(state, otherSide, loc);
}

function countOpposingChallengers(state: GameState, side: Side, loc: string): number {
  const ns = state.world.nodeState[loc];
  if (!ns) return 0;
  const otherSide = side === "player" ? "ai" : "player";
  const profile = ns.profile;
  const creaturePositions = positionsOf(profile, "creature");
  let count = 0;
  const seen = new Set<number>();
  for (const pos of creaturePositions) {
    const instId = ns.sideSlots[otherSide].creatures[pos];
    if (instId == null) continue;
    if (seen.has(instId)) continue;
    seen.add(instId);
    const other = state.cards[instId];
    if (!other) continue;
    const otherDef = getCardDef(other.defKey);
    if (otherDef.provocationChallenger) count++;
  }
  return count;
}

// `other(side)` moved to ./sides.ts (opponentOf). Re-exported here for back-compat callers.
export { other } from "./sides.ts";

// Re-exports for the consolidated stats API.
export { SIDES };
export type { CardRegistry };
