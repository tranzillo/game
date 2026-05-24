import { state, L } from "./state.js";
import { LOCATION_COUNT } from "./config.js";

export function other(side) { return side === "player" ? "ai" : "player"; }

// ---------- Stat totals ----------
// ---------- Stat totals (per location) ----------

// Committed-only stat total at a location. Pending plays do NOT count.
// This is what cost requirements check against — costs are paid by the *target location's*
// committed presence only.
// Compute the effective value of a stat on a card, given the card's location context.
// Returns base + scoped buffs (from grantUntilEndOfTurn — already applied to card[stat]) +
// conditional buffs (Pit-Fighter alone, Provocation Challenger) + equipment grants.
// Inert filters: cards with `inert: true` cannot gain Force/Tempo/Insight/Resolve.
//
// The base `card[stat]` already reflects:
//   - Printed stat
//   - Permanent run-deck mods (applyRunMods at card creation)
//   - End-of-turn buffs (grantUntilEndOfTurn mutates this directly; reverted at cleanup)
//
// What this function adds on top:
//   - Conditional while-X buffs computed from current board state
//   - Stats granted by equipment attached to this card
export function effectiveStat(card, side, loc, stat) {
  if (!card) return 0;
  // Sleeping zeroes Force: no combat presence, no stat-line contribution. Other stats still count
  // (Tempo, Insight, etc. — the design only nails down Force-zero for sleepers explicitly).
  if (card.sleepCounter > 0 && stat === "force") return 0;
  const base = card[stat] || 0;
  let bonus = 0;

  // Conditional buffs — only apply to creatures in play, with a known location.
  if (card.type === "creature" && side != null && loc != null) {
    const lc = L(side, loc);
    if (lc && lc.creatures) {
      // Pit-Fighter "+2 Force while no other creature on your side here" (R5).
      if (card.pitFighterWhileAlone && stat === "force") {
        let others = 0;
        for (const p of ["fl","fr","bl","br"]) {
          const c = lc.creatures[p];
          if (c && c !== card) others++;
        }
        if (others === 0) bonus += 2;
      }
      // Pit-Goblin Challenger Provocation: self gains +1 Force per opposing creature here (RR3).
      if (card.provocationChallenger && stat === "force") {
        const opLoc = L(other(side), loc);
        if (opLoc && opLoc.creatures) {
          for (const p of ["fl","fr","bl","br"]) {
            if (opLoc.creatures[p]) bonus += 1;
          }
        }
      }
      // Magus Apprentice: +1 Insight here for each action this side has resolved this turn.
      if (card.apprenticeInsightFromActions && stat === "insight") {
        bonus += state.sides[side].actionsThisTurn || 0;
      }
      // Mana Rock aura: +1 Insight to creatures in the same row, same side. We check the OTHER
      // slots in this card's row for a Mana Rock — "next to" means literal adjacent same-row neighbor.
      if (stat === "insight" && !card.manaRockAura) {
        // Find this card's position.
        let myPos = null;
        for (const p of ["fl","fr","bl","br"]) {
          if (lc.creatures[p] === card) { myPos = p; break; }
        }
        if (myPos) {
          const sameRowNeighbor = { fl: "fr", fr: "fl", bl: "br", br: "bl" }[myPos];
          const neighbor = lc.creatures[sameRowNeighbor];
          if (neighbor && neighbor.manaRockAura && neighbor.revealed !== false) bonus += 1;
        }
      }
    }
  }

  // Provocation reverse-buff: every creature on the other side from a Challenger gets +1 Force
  // per Challenger that's at the same location on the opposing side. Computed from this card's
  // perspective: scan the *other* side at this location for live Challengers.
  if (card.type === "creature" && side != null && loc != null && stat === "force") {
    const opLoc = L(other(side), loc);
    if (opLoc && opLoc.creatures) {
      for (const p of ["fl","fr","bl","br"]) {
        const c = opLoc.creatures[p];
        if (c && c.provocationChallenger) bonus += 1;
      }
    }
  }

  // Equipment grants. Each attached equipment may grant stats to its host.
  if (card.equipment && card.equipment.length > 0) {
    for (const eq of card.equipment) {
      if (eq.grantsStats && eq.grantsStats[stat]) bonus += eq.grantsStats[stat];
    }
  }

  // Inert: cannot gain Force/Tempo/Insight/Resolve from any source. Bonus is filtered out.
  if (card.inert && ["force","tempo","insight","resolve"].includes(stat)) {
    return base;  // base already excludes scoped buffs that grantUntilEndOfTurn already filtered
  }

  return base + bonus;
}

// Sum of a stat across the location, on a side. For Force, only front-row creatures count
// (per design: Force at a location = front-row Force). For other stats, all creatures + structure.
export function committedStatTotal(side, loc, stat) {
  const lc = L(side, loc);
  let t = 0;
  // Per the unified face-down rule: a face-down card has no stat presence.
  if (stat === "force") {
    // Front-row creatures only contribute Force at the location.
    for (const pos of ["fl", "fr"]) {
      const c = lc.creatures[pos];
      if (c && c.revealed !== false) t += effectiveStat(c, side, loc, stat);
    }
  } else {
    for (const pos of ["fl", "fr", "bl", "br"]) {
      const c = lc.creatures[pos];
      if (c && c.revealed !== false) t += effectiveStat(c, side, loc, stat);
    }
  }
  if (lc.structure && lc.structure.revealed !== false) t += lc.structure[stat] || 0;
  return t;
}

// Visible stat total at a location: committed + pending. Used for display only.
export function visibleStatTotal(side, loc, stat) {
  const lc = L(side, loc);
  let t = committedStatTotal(side, loc, stat);
  // Pending plays — same front-row-only filter for Force.
  if (stat === "force") {
    for (const pos of ["fl", "fr"]) {
      if (lc.pending.creatures[pos]) t += lc.pending.creatures[pos][stat] || 0;
    }
  } else {
    for (const pos of ["fl", "fr", "bl", "br"]) {
      if (lc.pending.creatures[pos]) t += lc.pending.creatures[pos][stat] || 0;
    }
  }
  if (lc.pending.structure) t += lc.pending.structure[stat] || 0;
  return t;
}

// Sum a stat across all locations on a side (for global-economy effects later, e.g., Insight→draw).
// Not used by per-location cost checks — those use committedStatTotal(side, loc, stat).
export function globalStatTotal(side, stat) {
  let t = 0;
  for (let loc = 0; loc < LOCATION_COUNT; loc++) t += committedStatTotal(side, loc, stat);
  return t;
}
