import { state, L } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES } from "./config.js";
import { logEntry } from "./log.js";
import { canPay, legalTargetsForCard, placeCard } from "./legality.js";

// Returns true if the AI has non-neutral presence (creature or structure) at any location in the
// current encounter. Used to gate AI placement: per the unified-encounter framework, the AI may
// only commit cards into a neutral location during an encounter if it has presence at *some other*
// location in the same encounter (the in-encounter "AI contesting" rule mirroring overworld
// adjacency). For v3's single-location encounters: a pure neutral encounter has no AI presence at
// all, so the AI cannot place. A hostile or boss encounter has AI presence by definition.
export function aiHasPresenceInEncounter() {
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("ai", loc);
    if (lc.structure && lc.structure.owner === "ai") return true;
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.creatures[pos];
      if (c && c.owner === "ai") return true;
    }
    // Pending plays count too — if the AI committed something earlier this turn, it's "present".
    if (lc.pending.structure && lc.pending.structure.owner === "ai") return true;
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.pending.creatures[pos];
      if (c && c.owner === "ai") return true;
    }
  }
  return false;
}

// AI placement using scored heuristics. Per DECISIONS.md (AI architecture): per-card hints + a
// small global scoring function picks the highest-scoring (card, location, target) tuple and commits it.
// Cost checks use COMMITTED state at the *target location* only.
//
// Per the unified-encounter framework: the AI cannot place at a neutral encounter where it has no
// other-location presence. v3 has single-location encounters, so this collapses to "AI does not
// place if it has no presence at the encounter at all" — i.e., pure neutral encounters get no AI plays.
export function aiPlaceMain() {
  if (!aiHasPresenceInEncounter()) return;
  let safety = 80;
  while (safety-- > 0) {
    const best = aiPickBestPlay();
    if (!best) break;
    placeCard("ai", best.card, best.target);
  }
}

// AI retreat: end-of-turn evaluation. Fires at end of cleanup if the AI has no living presence
// AND failed to bring in reinforcements this turn. "Living presence" means *creatures* —
// structures are infrastructure, not forces. A faction with only buildings left, that also
// couldn't field anything new this turn, has effectively been beaten; the encounter ends.
//
// "No reinforcements this turn" is captured implicitly by checking at end-of-cleanup: by then,
// the AI's main-phase placement opportunity is over, combat has resolved, and pending is empty.
// If there are zero AI creatures committed at this moment, the AI had its full turn and managed
// no living presence on the board. That's retreat.
//
// Retreat is a HOSTILE-encounter-only mechanic. It does not apply to:
//   - Boss encounters (boss is a summoner with Durability; win via Durability=0, not retreat).
//   - Neutral encounters (the AI was never present; there's nothing to retreat from. Neutral
//     encounters end via player engagement consuming the neutral cards, or via the player
//     pressing the Leave Encounter button).
export function checkAiRetreat() {
  if (!state.sides) return false;
  if (state.encounterKind !== "hostile") return false;
  // Any AI creature anywhere (committed or pending) cancels retreat. Pending will be empty when
  // called at end-of-cleanup, but the check is here for safety in case of mid-turn invocation.
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("ai", loc);
    for (const pos of ["fl","fr","bl","br"]) {
      if (lc.creatures[pos] && lc.creatures[pos].owner === "ai") return false;
      if (lc.pending.creatures[pos] && lc.pending.creatures[pos].owner === "ai") return false;
    }
  }
  // No AI creatures present and no reinforcements pending. Retreat fires. Vanish any AI structures
  // (the faction withdrew with them).
  let vanished = 0;
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("ai", loc);
    if (lc.structure && lc.structure.owner === "ai") {
      lc.structure = null;
      vanished++;
    }
  }
  logEntry(`The AI faction withdraws from ${LOC_NAMES.join(", ")}. ${vanished > 0 ? `(${vanished} structure${vanished === 1 ? "" : "s"} vanish with them.)` : ""}`, "win");
  state.encounterEndPending = "playerCleared";
  return true;
}

// Returns the highest-scoring legal (card, location, target) tuple, or null.
export function aiPickBestPlay() {
  const ai = state.sides.ai;
  let best = null;
  for (const card of ai.hand) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      if (!canPay("ai", loc, card)) continue;
      const targets = legalTargetsForCard("ai", loc, card);
      if (targets.length === 0) continue;
      for (const target of targets) {
        const score = aiScorePlay(card, loc, target);
        if (score === null) continue;
        if (!best || score > best.score) best = { card, target, score };
      }
    }
  }
  return best;
}

// Score a (card, loc, target) play for the AI. Higher = better. Returns null to disqualify.
export function aiScorePlay(card, loc, target) {
  const hints = card.aiHints || {};
  let score = 0;
  // Cost-magnitude weight (favor expensive plays). Sum across all cost stats for compound costs.
  const costs = card.costs || {};
  let costMag = 0;
  for (const s of Object.keys(costs)) costMag += costs[s];
  score += costMag * 2;
  if (card.type === "creature") return scoreCreaturePlay(card, loc, target, hints, score);
  if (card.type === "structure") return scoreStructurePlay(card, loc, target, hints, score);
  if (card.type === "action") return scoreActionPlay(card, loc, target, hints, score);
  return score;
}

export function scoreCreaturePlay(card, loc, target, hints, baseScore) {
  let score = baseScore;
  const pos = target.pos;
  const isFront = (pos === "fl" || pos === "fr");
  const isBack = !isFront;
  const sameColumnFront = pos === "bl" ? "fl" : (pos === "br" ? "fr" : pos);
  const aiLoc = L("ai", loc);
  const playerLoc = L("player", loc);

  if (hints.preferFront && isFront) score += 5;
  if (hints.preferFront && isBack) score -= 2;
  if (hints.preferBack && isBack) score += 5;
  if (hints.preferBack && isFront) score -= 4;

  if (hints.requireBlocker && isBack) {
    const frontCard = aiLoc.creatures[sameColumnFront] || aiLoc.pending.creatures[sameColumnFront];
    if (frontCard) score += 6; else score -= 4;
  }
  if (hints.requireBlocker && isFront) score -= 6;

  if (hints.preferUncontestedColumn && isFront) {
    const enemyFront = playerLoc.creatures[pos];
    if (enemyFront) score -= 4; else score += 3;
  }

  if (hints.preferLowHpFront && isFront) {
    const enemyFront = playerLoc.creatures[pos];
    if (enemyFront && (enemyFront.durability || 0) <= (card.force || 0)) score += 4;
  }

  // Slight preference: locations where the enemy is *more* committed get higher creature priority
  // (push back at threats), and uncontested locations get slightly lower (no need to spend stats there).
  let enemyPresenceHere = 0;
  for (const p of ["fl","fr","bl","br"]) if (playerLoc.creatures[p]) enemyPresenceHere++;
  score += enemyPresenceHere * 0.6;

  if (pos === "fl" || pos === "bl") score += 0.5;
  return score;
}

export function scoreStructurePlay(card, loc, target, hints, baseScore) {
  // Structures are always reasonable to play. Slight preference to spread structures across locations
  // — having a structure already at this location is worth less than putting one where there isn't one.
  let score = baseScore + 3;
  if (L("ai", loc).structure || L("ai", loc).pending.structure) score -= 2;
  return score;
}

export function scoreActionPlay(card, loc, target, hints, baseScore) {
  let score = baseScore;
  const playerLoc = L("player", loc);
  // Damage spell with "here" scope (Spark). Per the universal damage fall-through rule, this is
  // ALWAYS a legal play — empty location → hits opposing summoner. Score reflects whether a creature
  // target is more or less attractive than summoner-pressure.
  if (hints.damagePreferTarget) {
    const enemiesHere = ["fl","fr","bl","br"].map(p => playerLoc.creatures[p]).filter(c => c);
    if (enemiesHere.length > 0) {
      score += 4; // creature target present — damage lands on a creature
      // Killable creature is best — clean removal.
      const wouldKill = enemiesHere.some(c => (c.durability || 0) <= 2);
      if (wouldKill) score += 3;
    } else {
      // No creature here — damage falls through to opposing summoner. Worth doing if the AI is
      // ahead on summoner pressure or just chipping the player down.
      score += 3; // slightly less attractive than killing a creature, but still real value
    }
  }

  if (hints.requiresOpposingAction) {
    // Counterspell is "here" — counters opposing actions at *this* location only. AI peeks at the
    // player's pending action at this location (transparent cheat per DECISIONS.md).
    const playerHasActionHere = !!(playerLoc.action || playerLoc.pending.action);
    if (!playerHasActionHere) return null;
    score += 8;
  }

  // Damage spell with scope = "at each of your locations" (Heralding Spark). Per fall-through, this
  // ALWAYS lands SOMETHING — creatures get hit, empty locations leak damage to the summoner.
  // Maximum value when most locations have targets *and* the empty ones can pressure the summoner.
  if (hints.damageAllLocations) {
    let creatureLocs = 0, emptyLocs = 0, killableHere = false;
    for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
      const enemyLoc = L("player", l2);
      const enemies = ["fl","fr","bl","br"].map(p => enemyLoc.creatures[p]).filter(c => c);
      if (enemies.length > 0) {
        creatureLocs++;
        if (enemies.some(c => (c.durability || 0) <= 1)) killableHere = true;
      } else {
        emptyLocs++;
      }
    }
    // Per-creature-loc bonus (chip damage), per-empty-loc bonus (summoner damage), kill bonus.
    score += creatureLocs * 2 + emptyLocs * 1.5;
    if (killableHere) score += 2;
    // Always playable — never returns null.
  }

  return score;
}
