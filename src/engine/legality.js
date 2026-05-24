import { state, L } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES } from "./config.js";
import { logEntry } from "./log.js";
import { committedStatTotal } from "./stats.js";
import { emitFutureChip, emitOutcome } from "./timeline.js";
import { EQUIPMENT_CAP_PER_HOST } from "./marks.js";

// ---------- Card play legality ----------
export function canPay(side, loc, card) {
  // Cost is checked against committed presence at the *target location only*. Per design:
  // "every card has a stat-presence cost requirement at its location."
  // Compound costs: every stat in card.costs must be met by committed presence at the location.
  const costs = effectiveCosts(card);
  for (const stat of Object.keys(costs)) {
    if (committedStatTotal(side, loc, stat) < costs[stat]) return false;
  }
  return true;
}

// Compute the effective cost of a card at this moment. Most cards just return `card.costs`.
// Forage's escalating-per-instance cost: each cast bumps the per-card counter, so the next play
// of that same instance pays `base + forageCasts` Tempo. Counter resets at encounter end.
export function effectiveCosts(card) {
  const base = card.costs ? { ...card.costs } : {};
  // Forage's escalating per-instance Tempo cost.
  if (card.effect === "forageAddAmmo" && card.forageCasts > 0) {
    base.tempo = (base.tempo || 0) + card.forageCasts;
  }
  // Mirror Image's escalating per-instance Insight cost.
  if (card.effect === "mirrorImage" && card.mirrorCasts > 0) {
    base.insight = (base.insight || 0) + card.mirrorCasts;
  }
  return base;
}

// True if the side has any location where this card could legally land (cost + open slot).
// Used by hand-card "playable?" highlighting.
export function cardHasAnyLegalPlay(side, card) {
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    if (!canPay(side, loc, card)) continue;
    if (legalTargetsForCard(side, loc, card).length > 0) return true;
  }
  return false;
}

// A slot is occupied if either committed or pending has something there.
export function slotOccupied(side, loc, kind, pos) {
  const lc = L(side, loc);
  if (kind === "creature") return !!(lc.creatures[pos] || lc.pending.creatures[pos]);
  if (kind === "structure") return !!(lc.structure || lc.pending.structure);
  if (kind === "action") return !!(lc.action || lc.pending.action);
  return false;
}

// Legal placement targets for a card at a specific location.
// (Cost is NOT checked here — caller does that, since cost depends on target location.)
export function legalTargetsForCard(side, loc, card) {
  const targets = [];
  if (card.type === "creature") {
    for (const pos of ["fl", "fr", "bl", "br"]) {
      if (slotOccupied(side, loc, "creature", pos)) continue;
      targets.push({ loc, kind: "creature", pos });
    }
  } else if (card.type === "structure") {
    if (!slotOccupied(side, loc, "structure")) targets.push({ loc, kind: "structure" });
  } else if (card.type === "action") {
    if (!slotOccupied(side, loc, "action")) targets.push({ loc, kind: "action" });
  } else if (card.type === "equipment") {
    // Equipment legal where a face-up committed creature is present on this side at loc, and the
    // host is below the equipment cap.
    const lc = L(side, loc);
    for (const pos of ["fl", "fr", "bl", "br"]) {
      const c = lc.creatures[pos];
      if (!c || c.revealed === false) continue;
      if ((c.equipment || []).length >= EQUIPMENT_CAP_PER_HOST) continue;
      targets.push({ loc, kind: "equipment", pos });
    }
  }
  return targets;
}

// Place a card from hand into a side's pending slots at a specific location.
export function placeCard(side, card, target) {
  const s = state.sides[side];
  const idx = s.hand.findIndex(c => c.instId === card.instId);
  if (idx === -1) return false;
  s.hand.splice(idx, 1);
  const lc = L(side, target.loc);
  if (card.type === "creature") {
    lc.pending.creatures[target.pos] = card;
  } else if (card.type === "structure") {
    lc.pending.structure = card;
  } else if (card.type === "action") {
    lc.pending.action = card;
  } else if (card.type === "equipment") {
    // Equipment is played into a creature's slot. Host is the creature (committed or pending) at
    // that position; equipment attaches to it on end-of-phase flip. Stored face-down in pending.
    if (!lc.pending.equipment[target.pos]) lc.pending.equipment[target.pos] = [];
    lc.pending.equipment[target.pos].push(card);
  }
  return true;
}

// Reverse a pending placement at a specific location: return the pending card to the side's hand.
export function cancelPendingPlacement(side, loc, kind, pos) {
  const lc = L(side, loc);
  let card = null;
  if (kind === "creature") {
    card = lc.pending.creatures[pos];
    lc.pending.creatures[pos] = null;
  } else if (kind === "structure") {
    card = lc.pending.structure;
    lc.pending.structure = null;
  } else if (kind === "action") {
    card = lc.pending.action;
    lc.pending.action = null;
  } else if (kind === "equipment") {
    // Pop the most-recently-added pending equipment at this position (LIFO undo).
    const arr = lc.pending.equipment[pos];
    if (arr && arr.length > 0) card = arr.pop();
  }
  if (card) state.sides[side].hand.push(card);
  return card;
}

// At end of main phase, commit all pending placements into the committed slots, at every location.
// AI commits go down face-down (revealed=false); player's own cards remain visible to the player.
// The reveal phase (next step) flips AI cards to face-up.
// At end of main, both sides commit pending → committed slots. Per the unified face-down rule,
// ALL just-committed cards are face-down (revealed=false) until end of phase, regardless of side.
// They then flip up via endOfPhaseRevealAndResolve in Tempo order.
//
// The fog-of-war asymmetry (the player can see their own committed cards, but AI's are hidden) is
// a UI/render concern, not a game-state concern: the player's face-down cards are rendered face-up
// to the owner (see makeCardEl), but their underlying `revealed` state is `false` until they flip.
// This is what makes player flip-up triggers fire — they go through the same end-of-phase queue
// as AI commits.
export function commitPendingPlays() {
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      const locTempo = committedStatTotal(sideName, loc, "tempo");
      for (const pos of ["fl", "fr", "bl", "br"]) {
        if (lc.pending.creatures[pos]) {
          const card = lc.pending.creatures[pos];
          card.revealed = false;
          lc.creatures[pos] = card;
          lc.pending.creatures[pos] = null;
          if (sideName === "player") {
            logEntry(`You commit ${card.name} to ${LOC_NAMES[loc]} ${pos} (face-down).`);
          } else {
            logEntry(`AI commits a card to ${LOC_NAMES[loc]} ${pos} (face-down).`);
          }
          emitFutureChip(card, sideName, loc, pos, card.tempo || 0);
        }
      }
      if (lc.pending.structure) {
        const card = lc.pending.structure;
        card.revealed = false;
        lc.structure = card;
        lc.pending.structure = null;
        if (sideName === "player") logEntry(`You commit ${card.name} (structure, face-down) at ${LOC_NAMES[loc]}.`);
        else logEntry(`AI commits a structure at ${LOC_NAMES[loc]} (face-down).`);
        emitFutureChip(card, sideName, loc, "structure", locTempo);
      }
      if (lc.pending.action) {
        const card = lc.pending.action;
        card.revealed = false;
        lc.action = card;
        lc.pending.action = null;
        if (sideName === "player") logEntry(`You commit ${card.name} (action, face-down) at ${LOC_NAMES[loc]}.`);
        else logEntry(`AI commits an action at ${LOC_NAMES[loc]} (face-down).`);
        emitFutureChip(card, sideName, loc, "action", locTempo);
      }
      // Equipment pending stays in pending.equipment[pos] (no committed slot). Mark face-down for
      // the unified flip rule; attach happens in endOfPhaseRevealAndResolve.
      for (const pos of ["fl","fr","bl","br"]) {
        const arr = lc.pending.equipment[pos];
        if (!arr || arr.length === 0) continue;
        for (const eq of arr) {
          eq.revealed = false;
          if (sideName === "player") logEntry(`You commit ${eq.name} (equipment, face-down) to ${LOC_NAMES[loc]} ${pos}.`);
          else logEntry(`AI commits an equipment at ${LOC_NAMES[loc]} ${pos} (face-down).`);
          emitFutureChip(eq, sideName, loc, pos, locTempo);
        }
      }
    }
  }
}

// Flip every face-down committed card to face-up at every location.
export function revealAllFaceDown() {
  let revealedAny = false;
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      for (const pos of ["fl", "fr", "bl", "br"]) {
        const c = lc.creatures[pos];
        if (c && !c.revealed) {
          c.revealed = true; revealedAny = true;
          if (sideName === "ai") logEntry(`Revealed: ${c.name} at ${LOC_NAMES[loc]} ${pos}.`);
        }
      }
      if (lc.structure && !lc.structure.revealed) {
        lc.structure.revealed = true; revealedAny = true;
        if (sideName === "ai") logEntry(`Revealed: ${lc.structure.name} (AI structure at ${LOC_NAMES[loc]}).`);
      }
      if (lc.action && !lc.action.revealed) {
        lc.action.revealed = true; revealedAny = true;
        if (sideName === "ai") logEntry(`Revealed: ${lc.action.name} (AI action at ${LOC_NAMES[loc]}).`);
      }
    }
  }
  return revealedAny;
}

// Move a committed creature within a single location's slot grid.
// v2 holds cross-location movement for v3+ — movement is always within the same location.
// One move per creature per turn. Allowed in any direction (front<->back same column, left<->right same row).
export function moveCommittedCreature(side, loc, fromPos, toPos) {
  const lc = L(side, loc);
  const creature = lc.creatures[fromPos];
  if (!creature) return false;
  // Face-down: can't move (inert per unified rule).
  if (creature.revealed === false) return false;
  // Inert: cannot use the normal once-per-turn move. Effects (push, swap, etc.) can still move
  // an Inert creature; the player's default move action cannot.
  if (creature.inert) return false;
  // Sleeping: same rule as Inert for normal movement. Effects can still relocate a sleeper.
  if (creature.sleepCounter > 0) return false;
  // Groggy: just woke this phase. Can't take awake actions (move, attack) until the next phase.
  if (creature.wokeInPhase === state.phase) return false;
  // A creature that flipped up this turn can't move this turn.
  if (creature.flippedThisTurn) return false;
  if (lc.movedThisTurn.has(creature.instId)) return false;
  if (slotOccupied(side, loc, "creature", toPos)) return false;
  if (!isAdjacent(fromPos, toPos)) return false;

  lc.creatures[fromPos] = null;
  lc.creatures[toPos] = creature;
  lc.movedThisTurn.add(creature.instId);
  logEntry(`${side === "player" ? "You" : "AI"} moves ${creature.name} ${fromPos} → ${toPos} at ${LOC_NAMES[loc]}.`);
  emitOutcome("move", { instId: creature.instId, name: creature.name, side, loc, fromPos, toPos });
  return true;
}

export function isAdjacent(a, b) {
  const adj = {
    fl: ["fr", "bl"],
    fr: ["fl", "br"],
    bl: ["fl", "br"],
    br: ["fr", "bl"]
  };
  return adj[a] && adj[a].includes(b);
}

// Which card types can be committed into a slot during the current phase?
// Permanents (creatures, structures) only commit during main. Actions can be committed during
// any phase that is a commit window — in v1 that's main and combat-reveal.
export function isCommitWindowFor(cardType) {
  // Creatures and structures only commit during main. Actions and equipment commit in any
  // player-interactive phase (upkeep, draw, main, combat-reveal, cleanup).
  const interactivePhases = ["upkeep", "draw", "main", "combat-reveal", "cleanup"];
  if (cardType === "creature" || cardType === "structure") {
    return state.phase === "main";
  }
  if (cardType === "action" || cardType === "equipment") {
    return interactivePhases.includes(state.phase);
  }
  return false;
}
