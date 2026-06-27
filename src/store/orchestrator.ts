// Orchestrator — phase-driven advance flow.
//
// Contract: REBUILD_PLAN §20 / §28 / §30 / §32.
//
// Each phase has the same shape per §28:
//   1. Play window (interactive). Both sides may commit cards (creatures/structures/equipment in
//      main only; actions in any phase).
//   2. Player clicks "Advance Phase". The play window closes.
//   3. Flip resolution: every committed chip flips up in Tempo order. Each chip's resolution is
//      a present span (chip.ts) — the chip dwells in Present while flip-up triggers fire and
//      any queued resolution beats drain.
//   4. The phase's substantive action runs:
//        - upkeep: tick effects (Phase I)
//        - draw: draw cards (Phase L)
//        - main: no substantive action
//        - combat: gather + sort + drive swings (this slice)
//        - cleanup: discards, cleared-location checks (Phase K)
//   5. Phase-boundary triggers fire: onXEnd of current phase, onYStart of next phase.
//   6. State advances to the next phase's play window (player gets control back).
//
// At end of cleanup, the turn advances and we land back at main (Phase H slice shortcut — Phase
// K reinstates the full upkeep → draw → main loop).
//
// Phase H slice 2.5: implements one-phase-per-click for main → combat → cleanup → next turn.
// No upkeep / draw substantive actions yet. Combat-trick actions (slice 5) will work for free
// because the combat phase play window is now a real interactive state.

import {
  commitPendingForAdvance,
  popNextChipFromStartQueue,
  startNewTurn,
} from "./advance-helpers.ts";
import {
  fireFlipUpTrigger,
  firePhaseBoundary,
  firePresentSubscribers,
} from "../engine/triggers.ts";
import { getCardDef } from "../engine/cards.ts";
import { leavePlay } from "../engine/piles.ts";
import { markChipPresent, markChipResolved } from "../engine/timeline.ts";
import { sortChipQueueInPlace, makeResolutionComparator } from "../engine/flip-order.ts";
import { buildMoveResolutionQueue, resolvePendingMove } from "../engine/movement.ts";
import { emit } from "../engine/events.ts";
import { endSequence, startSequence, isPlaying } from "../engine/scheduler.ts";
import {
  recordSummonerDamage,
  shouldRetreatAtEndOfTurn,
  executeRetreat,
} from "../engine/retreat.ts";
import { runBeatN } from "./beats.ts";
import { aiCommitMainPlays } from "./ai-play.ts";
import { getEngineState } from "./engine-state.ts";
import { notifyStateChanged } from "./index.ts";
import { openPresentSpan, queueResolutionBeat } from "./present-span.ts";
import { gatherSwings, sortSwingsInPlace, type Swing } from "../engine/combat-order.ts";
import { patternTargets } from "../engine/pattern-targets.ts";
import {
  applyDamage,
  applyMultiTargetEmpty,
  type ThornsTrigger,
} from "../engine/damage.ts";
import {
  runEndOfCleanupChecks,
  runPerDamageWinChecks,
  collectClearedLocationCommits,
  discardOneClearedCommit,
} from "../engine/win-conditions.ts";
import { drawOneCard, wantsToDraw, discardHandToResolve } from "../engine/draw.ts";
import {
  collectEncounterEndReclaim,
  reclaimOneCardToDeck,
  finishReclaim,
} from "../engine/piles.ts";
import { queueDeathDrain } from "./death-drain.ts";
import type { Phase, PhaseBoundary, Side } from "../engine/types.ts";

// Beat durations (ms). Phase N tunes these.
const BEAT_MS = {
  commit: 280,
  postResolve: 220,
  phaseBoundary: 400,
  substantiveStart: 320,
  swingAttackerEnter: 240,
  swingDamageLand: 280,
  swingHitLinger: 220,
  thornsRetaliate: 320,
  deathLinger: 380,
  deathSweep: 260,
  drawCard: 200,
  postPhaseSubstantive: 320,
  reclaimCard: 90, // per-card stagger when sweeping cards back into the deck (encounter end)
};

/**
 * Player clicks "Advance Phase". Drives one phase transition per call.
 */
export function actionAdvancePhase(): void {
  const state = getEngineState();
  if (!state.currentEncounter) return;
  if (isPlaying()) return;

  const phase = state.currentEncounter.phase;
  startSequence();
  emit(state, "phase-advance-start", { phase });

  // Step 0: AI summoner commits its main-phase plays (§29 — straight to committed face-down,
  // no pending). Done BEFORE the player's pending commit so both sides' chips queue together and
  // sort by tempo in one resolution order. Only fires advancing out of main (the play window).
  if (phase === "main" && state.currentEncounter.aiSide) {
    const n = aiCommitMainPlays(state);
    if (n > 0) emit(state, "ai-commit", { count: n });
  }

  // Step 1: close play window. Commit pending → chips.
  commitPendingForAdvance(state);
  notifyStateChanged();

  // Step 2: sort the active sub-phase queue (startOfPhase since slice keeps subPhase="start").
  sortChipQueueInPlace(state, state.currentEncounter.flipQueues.startOfPhase);

  // Step 2b: advancing out of MAIN, build the sorted move-resolution queue. Moves interleave with
  // flips in one Tempo order during the drain (drainNextChipBeat picks the earlier head). Other
  // phases have no inherent moves (main-only), so the queue stays empty.
  state.currentEncounter.moveResolutionQueue =
    phase === "main" ? buildMoveResolutionQueue(state) : [];

  // Step 3: drain the chip + move queues, then run the phase's substantive action.
  runBeatN(BEAT_MS.commit, () => {
    drainNextChipBeat();
  });
}

// ---------- Chip flip drain ----------

function drainNextChipBeat(): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  const enc = state.currentEncounter;

  // Interleave flips and moves by Tempo: peek both heads, resolve whichever sorts first. The flip
  // queue is pre-sorted (sortChipQueueInPlace); the move queue is pre-sorted (buildMoveResolution-
  // Queue). Both use the same comparator, so comparing heads gives one correct Tempo order.
  const nextChip = enc.flipQueues.startOfPhase[0] ?? null;
  const nextMove = enc.moveResolutionQueue[0] ?? null;

  if (nextChip == null && nextMove == null) {
    // Both queues drained. Run the phase's substantive action.
    runBeatN(BEAT_MS.substantiveStart, () => {
      runPhaseSubstantive();
    });
    return;
  }

  // Decide which head resolves next.
  const moveFirst =
    nextMove != null &&
    (nextChip == null || makeResolutionComparator(state)(nextMove, nextChip) <= 0);

  if (moveFirst && nextMove != null) {
    enc.moveResolutionQueue.shift();
    const outcome = resolvePendingMove(state, nextMove);
    // On fizzle, flash the blocked creature (recoil/dim) for this beat; on success the creature
    // slides to its destination via Framer's layoutId. Clear the fizzle flag at the start of the
    // next drain step so it shows for exactly this beat.
    enc.fizzledMoveInstId = outcome === "fizzled" ? nextMove.instId : null;
    notifyStateChanged();
    // A move is a short, self-contained beat (no present span — it doesn't flip a card or write to
    // the Past). Pace it, then continue the drain.
    runBeatN(outcome === "fizzled" ? BEAT_MS.postResolve : BEAT_MS.commit, () => {
      const s = getEngineState();
      if (s.currentEncounter) s.currentEncounter.fizzledMoveInstId = null;
      drainNextChipBeat();
    });
    return;
  }

  const chip = popNextChipFromStartQueue(state);
  if (!chip) {
    drainNextChipBeat();
    return;
  }

  const card = state.cards[chip.cardInstId];
  if (!card) {
    drainNextChipBeat();
    return;
  }

  // Present span begins. Chip enters Present + card flips face-up + flip-up trigger fires +
  // past entry written, all in the same frame. The chip is the visual anchor for the card's
  // resolution. Any beats the resolution queues (via queueResolutionBeat) extend the span.
  markChipPresent(state, chip);
  state.currentEncounter.resolvingChipId = chip.chipId;
  card.revealed = true;
  emit(state, "flip", {
    instId: card.instId,
    side: chip.side,
    loc: chip.loc,
    posKey: chip.posKey,
  });
  // The Past is recorded by the chip itself: markChipResolved (below, in the present span) sets
  // chip.state = "resolved", and the chip already carries its timestamp from emission. No
  // separate Past write is needed (DECISIONS 2026-06-13 — resolved chips ARE the Past).
  // Self-trigger fires first (the flipping card's onFlipUp), then cross-card subscribers (other
  // cards' onPresent) react to the present-enter event. Both queue resolution beats into the
  // same span, so cascades drain in one moment.
  fireFlipUpTrigger(state, card, chip.side, chip.loc);
  firePresentSubscribers(state, {
    card,
    side: chip.side,
    loc: chip.loc,
    cardType: getCardDef(card.defKey).type,
  });
  notifyStateChanged();

  openPresentSpan(chip, () => {
    const s = getEngineState();
    if (s.currentEncounter) s.currentEncounter.resolvingChipId = null;
    markChipResolved(s, chip);

    // Non-persistent actions exit to their pile after resolving. Persistent actions (Prayer,
    // Curse, Quest, Reaction per DESIGN) declare `persistent: true` and stay in the action
    // slot across turns — content code calls exitPersistentAction to retire them when their
    // persistence condition resolves. Per REBUILD §29: no second chip is emitted on exit
    // (the Past entry from the original flip already records the flip-up).
    //
    // If def.exitTo === "trash", route via "explicitTrash" so the card is exiled rather than
    // sent to discard. This is the Proof-of-the-Champion-style one-shot pattern.
    const def = getCardDef(card.defKey);
    if (def.type === "action" && !def.persistent) {
      const reason = def.exitTo === "trash" ? "explicitTrash" : "actionResolved";
      leavePlay(s, card, chip.side, chip.loc, reason);
    }
    notifyStateChanged();

    runBeatN(BEAT_MS.postResolve, () => {
      // Per-damage win check after the chip's resolution + cascade fully drained. If the action
      // (or any cascading effect) killed the player summoner, short-circuit.
      if (checkPerDamageOutcome()) return;
      drainNextChipBeat();
    });
  });
}

// ---------- Phase substantive action dispatcher ----------

function runPhaseSubstantive(): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  const phase = state.currentEncounter.phase;
  switch (phase) {
    case "upkeep":
    case "main":
      // No substantive action wired for these yet (upkeep effects pending; main's substantive
      // IS the play window per §28).
      endPhaseAndAdvance();
      return;
    case "draw":
      runDrawSubstantive();
      return;
    case "combat":
      runCombatResolution();
      return;
    case "cleanup":
      runCleanupSubstantive();
      return;
  }
}

// ---------- Draw substantive ----------
//
// Per the prototype + §26: each side draws up to BASE_DRAW_TARGET + its global Insight, one
// card per beat (visible draws). Deck-empty draws reshuffle the discard first (§29; handled
// inside drawOneCard). Initiative side draws first (DECISIONS 2026-06-12).

function runDrawSubstantive(): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  const first = state.currentEncounter.firstSide;
  const second: Side = first === "player" ? "ai" : "player";
  emit(state, "draw-substantive-start", {});
  drawNextCardBeat([first, second]);
}

function drawNextCardBeat(order: Side[]): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  // Find the first side in initiative order that still wants to draw.
  const side = order.find((s) => wantsToDraw(state, s));
  if (side == null) {
    emit(state, "draw-substantive-end", {});
    endPhaseAndAdvance();
    return;
  }
  const drawn = drawOneCard(state, side);
  if (drawn != null) {
    emit(state, "draw", { side, instId: drawn });
  }
  notifyStateChanged();
  runBeatN(BEAT_MS.drawCard, () => {
    drawNextCardBeat(order);
  });
}

// ---------- Cleanup substantive ----------
//
// Per §31: end of cleanup is when per-location clear flags update, newly-cleared locs shuffle
// back their player commits, and outcome resolution fires. If outcome is set, transition to the
// encounter-end flow instead of advancing to the next phase.

function runCleanupSubstantive(): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  emit(state, "cleanup-substantive-start", {});

  // Cleanup discard per the prototype + §26: keep the leftmost Resolve-N of the hand, discard
  // the rest (full-hand discard at Resolve 0). Initiative side discards first (side-level
  // activity ordering, DECISIONS 2026-06-12). Runs BEFORE the end-of-cleanup checks.
  const first = state.currentEncounter.firstSide;
  const second: Side = first === "player" ? "ai" : "player";
  for (const side of [first, second]) {
    const discarded = discardHandToResolve(state, side);
    if (discarded.length > 0) {
      emit(state, "cleanup-discard", { side, count: discarded.length });
    }
  }
  notifyStateChanged();

  // End-of-turn retreat evaluation (DECISIONS 2026-06-13): if the summoner took enough damage
  // (over the tier cap) or is exposed, it withdraws — its forces reclaim into its deck and it
  // stops being present. This happens BEFORE the clear checks so a location the summoner vacated
  // is correctly seen as clear. Retreat does NOT end the encounter (locations do).
  if (shouldRetreatAtEndOfTurn(state)) {
    const withdrawn = executeRetreat(state);
    if (withdrawn.length > 0) {
      // Withdrawn forces were in-play (face-up): their chips are RESOLVED and stay as legitimate
      // Past history. No chip cleanup needed at end of cleanup (nothing is still future here).
      emit(state, "summoner-retreat", { count: withdrawn.length });
      notifyStateChanged();
    }
  }

  const result = runEndOfCleanupChecks(state);
  for (const loc of result.newlyClearedLocs) {
    emit(state, "location-cleared", { loc });
  }
  notifyStateChanged();

  // Paced cascade: each cleared location's player commits slide one-per-beat into the discard
  // pile (DECISIONS 2026-06-13). The clear flag is already set; we just animate the move. Then
  // continue to the outcome / next phase.
  const clearedCommits: Array<{ loc: string; id: number }> = [];
  for (const loc of result.newlyClearedLocs) {
    for (const id of collectClearedLocationCommits(state, loc)) clearedCommits.push({ loc, id });
  }

  const afterClear = () => {
    if (result.outcome) {
      endEncounterWithOutcome(result.outcome);
      return;
    }
    endPhaseAndAdvance();
  };

  cascadeClearedCommitsToDiscard(clearedCommits, () => {
    runBeatN(BEAT_MS.postPhaseSubstantive, afterClear);
  });
}

/**
 * Paced cascade: move each cleared-location commit into the discard pile one per beat, notifying
 * between so the card's layoutId element slides slot → discard. Calls `done` after the last (or
 * immediately, next frame, if empty).
 */
function cascadeClearedCommitsToDiscard(
  items: Array<{ loc: string; id: number }>,
  done: () => void,
): void {
  const step = (i: number) => {
    if (i >= items.length) {
      done();
      return;
    }
    const s = getEngineState();
    if (!s.currentEncounter) {
      done();
      return;
    }
    discardOneClearedCommit(s, items[i]!.loc, items[i]!.id);
    notifyStateChanged();
    runBeatN(BEAT_MS.reclaimCard, () => step(i + 1));
  };
  step(0);
}

/**
 * Encounter ended with a non-null outcome. Emit the event, run encounter-end pile cleanup,
 * stop the orchestrator. The UI sees `encounter.outcome` and renders the banner.
 */
function endEncounterWithOutcome(outcome: import("../engine/types.ts").EncounterOutcome): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  emit(state, "encounter-end", { outcome });

  // Encounter-end pile cleanup per §29: everything except in-play structures reshuffles back
  // into the side's deck. The PLAYER side cascades visibly (one card slides into the Draw pile
  // per beat — the "sweep the table back into the deck" feel), THEN we finish (AI side
  // synchronously since it isn't rendered, shuffle both) and the view auto-zooms to the map.
  const playerReclaim = collectEncounterEndReclaim(state, "player");

  const finishAndEnd = () => {
    const s = getEngineState();
    if (!s.currentEncounter) {
      endSequence();
      return;
    }
    finishReclaim(s, "player");
    // AI side isn't rendered — reclaim + shuffle it in one frame.
    for (const id of collectEncounterEndReclaim(s, "ai")) reclaimOneCardToDeck(s, "ai", id);
    finishReclaim(s, "ai");
    // Write the enemy summoner's surviving Durability AND deck back to the run-scoped values so
    // they persist into the next encounter (DECISIONS 2026-06-13 — both carry across the run).
    if (s.currentEncounter.aiSide) {
      s.enemyDurability = s.currentEncounter.aiSide.durability;
      s.aiRunDeck = [...s.currentEncounter.aiSide.deck];
    }
    if (outcome === "bossKilled") s.runOver = "playerWin";
    if (outcome === "summonerDefeated") s.runOver = "playerWin";
    if (outcome === "playerLost") s.runOver = "playerLose";
    notifyStateChanged();
    endSequence();
  };

  cascadeReclaimToDeck(playerReclaim, finishAndEnd);
}

/**
 * Paced visual cascade: move each player instId into the Draw pile one per beat, notifying between
 * so the card's layoutId element slides slot/pile → deck (shared LayoutGroup). Calls `done` after
 * the last card. An empty list still calls `done` (next frame).
 */
function cascadeReclaimToDeck(ids: number[], done: () => void): void {
  const step = (i: number) => {
    if (i >= ids.length) {
      done();
      return;
    }
    const s = getEngineState();
    if (!s.currentEncounter) {
      done();
      return;
    }
    reclaimOneCardToDeck(s, "player", ids[i]!);
    notifyStateChanged();
    runBeatN(BEAT_MS.reclaimCard, () => step(i + 1));
  };
  step(0);
}

/**
 * Per-damage win check helper for the orchestrator. Returns true if a run-over outcome fired —
 * the caller should short-circuit its beat chain.
 *
 * Called from combat swing damage and from any cascaded-damage moment in handlers. Boss-kill
 * detection is Phase L; for now this only catches playerLost (player Durability hits 0).
 */
function checkPerDamageOutcome(): boolean {
  const state = getEngineState();
  const outcome = runPerDamageWinChecks(state);
  if (outcome) {
    notifyStateChanged();
    endEncounterWithOutcome(outcome);
    return true;
  }
  return false;
}

// ---------- Combat substantive ----------
//
// Per §30: gather attackers across encounter, sort by four-level Tempo, drive each swing.
// Each swing IS its own present-span — the swing opens a span (no chip, just the attacker glow
// state), queues damage + death cascade as resolution beats, and closes when all beats drain.
// This composes uniformly with thorns (slice 3) and Phase I cascades.

function runCombatResolution(): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  const swings = sortSwingsInPlace(state, gatherSwings(state));
  emit(state, "combat-substantive-start", { swingCount: swings.length });
  driveNextSwing(swings);
}

function driveNextSwing(swings: Swing[]): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  const swing = swings.shift();
  if (!swing) {
    emit(state, "combat-substantive-end", {});
    endPhaseAndAdvance();
    return;
  }

  // Re-check the swing is still valid — earlier swings may have killed this attacker.
  const attacker = state.cards[swing.attacker.instId];
  if (
    !attacker ||
    attacker.durability == null ||
    attacker.durability <= 0 ||
    attacker.pendingLeavePile != null
  ) {
    driveNextSwing(swings);
    return;
  }

  // Resolve the pattern → target list. Unimplemented patterns (cleave, pierce) return null;
  // skip the swing.
  const targets = patternTargets(
    state,
    attacker,
    swing.side,
    swing.loc,
    swing.pattern,
    swing.forceAtSwing,
  );
  if (!targets) {
    driveNextSwing(swings);
    return;
  }

  // Ranged: re-check ammo (earlier swings may have drained the pool per §30 "fastest-Tempo
  // fires first; slower archers may end up dry") and consume the shot.
  if (targets.damageKind === "ranged") {
    const cost = swing.pattern.ammoCost ?? 1;
    const ns = state.world.nodeState[swing.loc];
    if (!ns || ns.ammo[swing.side] < cost) {
      // Out of ammo — skip the swing (other contributions still happen via other patterns).
      driveNextSwing(swings);
      return;
    }
    ns.ammo[swing.side] -= cost;
  }

  // Open the swing as a synthetic present span. The "chip" we pass is a placeholder — it isn't
  // routed to any timeline; openPresentSpan just uses it as the span's identity. The visual
  // sync for combat lives on swingingAttackerInstId (set here, cleared in onClose).
  state.currentEncounter.swingingAttackerInstId = attacker.instId;
  emit(state, "swing-start", {
    attackerInstId: attacker.instId,
    side: swing.side,
    loc: swing.loc,
    patternKind: swing.pattern.kind,
    force: targets.damagePerTarget,
  });
  notifyStateChanged();

  // Queue the damage application as a beat inside the span. Any deaths the damage produces are
  // drained by additional queued beats — including thorns (slice 3) and Phase I cascades.
  queueResolutionBeat(BEAT_MS.swingAttackerEnter, () => {
    applySwingDamage(swing, targets);
    // Hit flash linger — the white flash on the target stays visible for a beat before deaths
    // start draining.
    queueResolutionBeat(BEAT_MS.swingHitLinger, () => {
      const s = getEngineState();
      if (s.currentEncounter) s.currentEncounter.swingHitTargetInstId = null;
      notifyStateChanged();
      queueDeathDrain();
    });
  });

  openSyntheticSwingSpan(() => {
    // Span closed: clear attacker glow, move on.
    const s = getEngineState();
    if (s.currentEncounter) {
      s.currentEncounter.swingingAttackerInstId = null;
      s.currentEncounter.swingHitTargetInstId = null;
    }
    notifyStateChanged();
    // Per-damage win check per §31: if player Durability hit 0 (or boss died — Phase L), the
    // outcome short-circuits the active beat chain and we transition to encounter-end without
    // running further swings or phases.
    if (checkPerDamageOutcome()) return;
    driveNextSwing(swings);
  });
}

function applySwingDamage(
  swing: Swing,
  patternResult: ReturnType<typeof patternTargets> & NonNullable<unknown>,
): void {
  const state = getEngineState();
  if (!state.currentEncounter) return;
  if (!patternResult) return;
  const enemySide: Side = swing.side === "player" ? "ai" : "player";
  const thornsTriggers: ThornsTrigger[] = [];

  if (patternResult.targetMode === "single") {
    const result = applyDamage({
      state,
      amount: patternResult.damagePerTarget,
      attackerSide: swing.side,
      attackerInstId: swing.attacker.instId,
      loc: swing.loc,
      damageKind: patternResult.damageKind,
      candidateCreatureTargets: patternResult.creatureTargets,
      enemySide,
    });
    if (result.target.kind === "creature" && result.target.creatureInstId != null) {
      state.currentEncounter.swingHitTargetInstId = result.target.creatureInstId;
    }
    noteSummonerDamage(state, result);
    if (result.thornsToAttacker) thornsTriggers.push(result.thornsToAttacker);
    emit(state, "swing-damage", {
      attackerInstId: swing.attacker.instId,
      result,
      side: swing.side,
      loc: swing.loc,
    });
  } else {
    // Multi-target: apply damage once per target; if no targets, one fall-through.
    if (patternResult.creatureTargets.length === 0) {
      const r = applyMultiTargetEmpty(state, patternResult.damagePerTarget, enemySide);
      noteSummonerDamage(state, r);
    } else {
      for (const instId of patternResult.creatureTargets) {
        const r = applyDamage({
          state,
          amount: patternResult.damagePerTarget,
          attackerSide: swing.side,
          attackerInstId: swing.attacker.instId,
          loc: swing.loc,
          damageKind: patternResult.damageKind,
          candidateCreatureTargets: [instId],
          enemySide,
        });
        noteSummonerDamage(state, r);
        if (r.thornsToAttacker) thornsTriggers.push(r.thornsToAttacker);
      }
    }
    emit(state, "swing-damage", {
      attackerInstId: swing.attacker.instId,
      side: swing.side,
      loc: swing.loc,
    });
  }
  notifyStateChanged();

  // Queue thorns retaliation beats. Each thorns hit is its own paced beat — the attacker takes
  // the thorns damage visibly, may die from it, and that death joins the swing's cascade.
  for (const trigger of thornsTriggers) {
    queueResolutionBeat(BEAT_MS.thornsRetaliate, () => {
      applyThornsRetaliation(trigger, swing.side);
    });
  }
}

/**
 * Record summoner-fall-through damage for the retreat triggers (DECISIONS 2026-06-13). Only the
 * ENEMY (ai) summoner accumulates toward retreat — the player doesn't retreat. If this pushes
 * cumulative damage past the tier-scaled instant cap, the summoner is flagged to retreat at the
 * end-of-turn evaluation (execution happens in cleanup, not mid-swing-cascade).
 */
function noteSummonerDamage(
  state: ReturnType<typeof getEngineState>,
  result: import("../engine/damage.ts").DamageResult,
): void {
  if (result.target.kind !== "summoner" || result.target.summonerSide !== "ai") return;
  if (result.damageDealt <= 0) return;
  // recordSummonerDamage accumulates and returns true past the cap; the retreat decision reads
  // the accumulated total at end-of-turn, so we don't need to store the boolean separately.
  recordSummonerDamage(state, result.damageDealt);
}

/**
 * Apply thorns back to the attacker. Re-runs through applyDamage with damageKind="thorns" so the
 * universal damage rules still apply (Spite kills can lethally damage the attacker; the death
 * cascade picks it up via queueDeathDrain). Thorns themselves do NOT trigger further thorns —
 * computeDefenderThorns gates on damageKind="melee", so the recursive trigger is structurally
 * impossible.
 */
function applyThornsRetaliation(trigger: ThornsTrigger, attackerSide: Side): void {
  const state = getEngineState();
  if (!state.currentEncounter) return;
  const attackerCard = state.cards[trigger.attackerInstId];
  if (!attackerCard) return;
  // If the attacker already died (e.g., from a prior thorns trigger in the same swing), the
  // pendingLeavePile guard short-circuits the damage. We still want to flash visually so the
  // player sees the retaliation moment, but skip the application.
  if (attackerCard.pendingLeavePile != null) {
    emit(state, "thorns-fizzle", { trigger });
    notifyStateChanged();
    return;
  }
  // Flash the attacker as the thorns hit target.
  state.currentEncounter.swingHitTargetInstId = attackerCard.instId;
  const defenderSide: Side = attackerSide === "player" ? "ai" : "player";
  const result = applyDamage({
    state,
    amount: trigger.amount,
    attackerSide: defenderSide, // for fall-through routing if attacker has no Durability
    attackerInstId: null, // thorns has no swinging attacker (defensive recoil)
    loc: trigger.loc,
    damageKind: "thorns",
    candidateCreatureTargets: [attackerCard.instId],
    enemySide: attackerSide,
  });
  emit(state, "thorns-hit", { trigger, result });
  notifyStateChanged();

  // Clear the flash on a short follow-up beat so the original swing's visual flow stays clean.
  queueResolutionBeat(BEAT_MS.swingHitLinger, () => {
    const s = getEngineState();
    if (s.currentEncounter) s.currentEncounter.swingHitTargetInstId = null;
    notifyStateChanged();
  });
}

/**
 * Open a present span for a swing. Combat swings don't have a chip in the timeline, but they
 * are conceptually parallel resolution moments to chip flips — they have an opener event, a
 * cascade of queued resolution beats, and a closer.
 *
 * We synthesize a placeholder chip (negative chipId so it can't collide with real chips) so
 * openPresentSpan's identity check still works.
 */
let nextSyntheticChipId = -1;
function openSyntheticSwingSpan(onClose: () => void): void {
  const fakeChip = {
    chipId: nextSyntheticChipId--,
    cardInstId: -1,
    side: "player" as const,
    loc: "",
    kind: "creature" as const,
    posKey: null,
    state: "present" as const,
    cachedTempo: 0,
    encounter: 0,
    turn: 0,
    phase: "combat" as const,
    cardType: "creature" as const,
  };
  openPresentSpan(fakeChip, onClose);
}

// ---------- Phase advance ----------

function endPhaseAndAdvance(): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  const fromPhase = state.currentEncounter.phase;
  const endBoundary = phaseEndBoundary(fromPhase);
  emit(state, endBoundary, { phase: fromPhase });
  // Fire the boundary handlers across all in-play cards before transitioning.
  firePhaseBoundary(state, endBoundary);
  notifyStateChanged();

  runBeatN(BEAT_MS.postPhaseSubstantive, () => {
    transitionToNextPhase(fromPhase);
  });
}

function transitionToNextPhase(fromPhase: Phase): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }
  const enc = state.currentEncounter;
  const nextPhase = phaseAfter(fromPhase);

  if (nextPhase == null) {
    // End of turn: cleanup just ended. Start next turn (lands at the slice's main shortcut).
    startNewTurn(state);
    const startBoundary = phaseStartBoundary(enc.phase);
    emit(state, "turn-start", { turn: enc.turn });
    emit(state, startBoundary, { phase: enc.phase });
    firePhaseBoundary(state, startBoundary);
    notifyStateChanged();
    endSequence();
    return;
  }

  enc.phase = nextPhase;
  enc.subPhase = "start";
  const startBoundary = phaseStartBoundary(nextPhase);
  emit(state, startBoundary, { phase: nextPhase });
  firePhaseBoundary(state, startBoundary);
  notifyStateChanged();
  endSequence();
}

function phaseAfter(phase: Phase): Phase | null {
  switch (phase) {
    case "upkeep":
      return "draw";
    case "draw":
      return "main";
    case "main":
      return "combat";
    case "combat":
      return "cleanup";
    case "cleanup":
      return null; // end of turn
  }
}

function phaseStartBoundary(phase: Phase): PhaseBoundary {
  switch (phase) {
    case "upkeep":
      return "onUpkeepStart";
    case "draw":
      return "onDrawStart";
    case "main":
      return "onMainStart";
    case "combat":
      return "onCombatStart";
    case "cleanup":
      return "onCleanupStart";
  }
}

function phaseEndBoundary(phase: Phase): PhaseBoundary {
  switch (phase) {
    case "upkeep":
      return "onUpkeepEnd";
    case "draw":
      return "onDrawEnd";
    case "main":
      return "onMainEnd";
    case "combat":
      return "onCombatEnd";
    case "cleanup":
      return "onCleanupEnd";
  }
}
