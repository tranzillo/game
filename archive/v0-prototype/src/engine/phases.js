import { state, L, shuffle } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES, LOC_TEXT_KEYS } from "./config.js";
import { logEntry } from "./log.js";
import { globalStatTotal, other } from "./stats.js";
import { checkEncounterEnd, endEncounter } from "./run.js";
import { render, showGameOver } from "../ui/render.js";
import { LOCATION_TEXTS } from "./location-texts.js";
import { commitPendingPlays, cardHasAnyLegalPlay, isCommitWindowFor, isAdjacent } from "./legality.js";
import { endOfPhaseRevealAndResolve, resetInitResolved } from "./timeline.js";
import { runCombat } from "./combat.js";
import { aiPlaceMain, checkAiRetreat } from "./ai.js";
import { revertEndOfTurnBuffs } from "./marks.js";
import { isPlaying, startSequence, endSequence, runBeat } from "./scheduler.js";
import { durationFor } from "../ui/animations.js";
import { emit } from "./events.js";

// ---------- Phases ----------
// Upkeep is split into "start of upkeep" (per-turn resets and start-of-upkeep neutral effects like
// Forge) and "end of upkeep" (flip-up at end of phase, encounter-end check). startNewTurn inserts
// a render+delay between them so the player sees the upkeep beat with face-down cards before the
// flip-up at end of phase.
// Generic phase-hook dispatcher. Fires registered handlers at a named phase boundary across all
// locations and card-level triggers. Hook names: "onUpkeepStart", "onUpkeepEnd", "onDrawStart",
// "onDrawEnd", "onMainStart", "onMainEnd", "onCombatStart", "onCombatEnd", "onCleanupStart",
// "onCleanupEnd". Location-text handlers are looked up via LOC_TEXT_KEYS + LOCATION_TEXTS.
//
// Handler signature: `function(loc) { ... }`. Receives the location index where the text is active.
// Cards with phase triggers (future) will register similarly per (card, side, loc).
export function firePhaseHook(hookName) {
  if (!state.sides) return;
  // Location-text handlers.
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const key = LOC_TEXT_KEYS[loc];
    if (!key) continue;
    const text = LOCATION_TEXTS[key];
    if (text && typeof text[hookName] === "function") {
      text[hookName](loc);
      if (state.gameOver) return;
    }
  }
}

export function runUpkeepStart() {
  state.phase = "upkeep";
  logEntry(`— Upkeep, turn ${state.turn} —`, "phase");
  // Reset per-turn trackers.
  for (const sideName of ["player", "ai"]) {
    state.sides[sideName].actionsThisTurn = 0;   // Apprentice reads this for live Insight.
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      L(sideName, loc).movedThisTurn = new Set();
      // Reset per-turn melee-attacker trackers on all creatures here (used by Explosive Trap).
      // Also clear skip-attack flags (Blizzard etc.) so combat eligibility resets each turn.
      const lc = L(sideName, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (c) {
          c.meleeAttackersThisTurn = [];
          c.skipAttackThisTurn = false;
        }
      }
    }
  }
  tickSleepCounters();
  firePhaseHook("onUpkeepStart");
  // Start-of-upkeep neutral effects (e.g., Forge stat-bump).
  resolveNeutralUpkeep();
  checkGameOver();
}

// Tick each sleeping creature's counter down by one at start of upkeep. Counter reaches 0 → awake.
export function tickSleepCounters() {
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (!c || c.sleepCounter <= 0) continue;
        c.sleepCounter -= 1;
        if (c.sleepCounter === 0) {
          logEntry(`  ${c.name} (${sideName} ${LOC_NAMES[loc]} ${pos}) wakes up.`, "phase");
        }
      }
    }
  }
}

// End-of-upkeep work: face-down cards flip up here, per the unified flip-up rule (any face-down
// card flips up at end of current phase). On turn 1 this is the encounter-arrival reveal moment.
// Uses the same Tempo-ordered reveal-and-resolve as end-of-main.
export function runUpkeepEnd(onDone) {
  firePhaseHook("onUpkeepEnd");
  endOfPhaseRevealAndResolve(() => {
    checkGameOver();
    if (onDone) onDone();
  });
}

// Brief between-phase pause — gives the player a moment to read the phase label before the
// next thing happens. Uses scheduler.runBeat so it composes with the busy flag and speed mult.
function phaseTransitionPause(then) {
  runBeat(durationFor("phase-divider"), then);
}

// Fire neutral cards' upkeep effects across all locations.
export function resolveNeutralUpkeep() {
  if (!state.sides) return;
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("ai", loc);
    // Forge can be the structure; can also imagine future neutrals occupying creature slots.
    const candidates = [];
    if (lc.structure && lc.structure.owner === "neutral") candidates.push({ card: lc.structure, where: "structure" });
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.creatures[pos];
      if (c && c.owner === "neutral") candidates.push({ card: c, where: "creature", pos });
    }
    for (const cand of candidates) {
      if (!cand.card.revealed) continue;       // face-down neutrals are inert (not yet revealed)
      if (cand.card.effect === "forge") {
        // Find the highest-Force friendly (player) creature here.
        const friendlies = ["fl","fr","bl","br"]
          .map(p => L("player", loc).creatures[p])
          .filter(c => c);
        if (friendlies.length === 0) continue;     // no friendly creature — nothing to bump
        let best = friendlies[0];
        for (const c of friendlies) if ((c.force || 0) > (best.force || 0)) best = c;
        // Bump the run-deck entry's mods so the buff persists across encounters.
        if (best.runDeckEntry) {
          best.runDeckEntry.mods.force = (best.runDeckEntry.mods.force || 0) + 1;
        }
        // Also bump the in-play instance so the rest of this encounter sees it.
        best.force = (best.force || 0) + 1;
        logEntry(`  ${cand.card.name} (@${LOC_NAMES[loc]}) → ${best.name} gains +1 Force permanently.`, "win");
        cand.card.durability -= 1;
        if (cand.card.durability <= 0) {
          logEntry(`    ${cand.card.name} is destroyed.`, "combat-detail");
          if (cand.where === "structure") lc.structure = null;
          else lc.creatures[cand.pos] = null;
        }
      }
    }
  }
}

// Base draw target. Each side's global Insight (summed across the encounter's locations) adds
// to this — see globalStatTotal("insight"). So drawing fills the hand up to 5 + Insight cards.
export const BASE_DRAW_TARGET = 5;

// Draw a single card SYNCHRONOUSLY. Used by effects mid-action-resolution (Study) where the
// draw is one step inside a larger beat. Reshuffles the discard if the deck is empty.
// Returns the drawn card or null if both deck and discard are empty.
//
// For batched, visible draws (the draw phase, multiple cards per side) use drawOneScheduled
// — it splits reshuffle and draw into discrete beats so the player sees the cards move.
export function drawOne(sideName) {
  const s = state.sides[sideName];
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null;
    s.deck = shuffle(s.discard);
    s.discard = [];
    logEntry(`${sideName === "player" ? "Your" : "AI"} discard pile reshuffled into deck.`, "draw");
    emit("reshuffle", { side: sideName });
  }
  const card = s.deck.shift();
  s.hand.push(card);
  emit("draw", { side: sideName, instId: card ? card.instId : null });
  return card;
}

// Draw a single card with VISIBLE BEATS. If a reshuffle is needed, that's one beat (discard
// pile visibly moves into deck pile via FLIP). Then the draw is its own beat (top deck card
// visibly slides into hand). Calls onDone(card) when done.
export function drawOneScheduled(sideName, onDone) {
  const s = state.sides[sideName];
  if (s.deck.length === 0) {
    if (s.discard.length === 0) { onDone(null); return; }
    // Reshuffle beat — the discard pile moves into the deck pile. The cards are the same
    // DOM elements (persistent _cardRegistry); FLIP slides them on render.
    s.deck = shuffle(s.discard);
    s.discard = [];
    logEntry(`${sideName === "player" ? "Your" : "AI"} discard pile reshuffled into deck.`, "draw");
    emit("reshuffle", { side: sideName });
    render();
    runBeat(durationFor("reshuffle"), () => doScheduledDraw(sideName, onDone));
    return;
  }
  doScheduledDraw(sideName, onDone);
}

function doScheduledDraw(sideName, onDone) {
  const s = state.sides[sideName];
  if (s.deck.length === 0) { onDone(null); return; }
  const card = s.deck.shift();
  s.hand.push(card);
  emit("draw", { side: sideName, instId: card.instId, name: card.name });
  render();
  runBeat(durationFor("draw"), () => onDone(card));
}

// Beat-chained draw phase. Draws for player then AI, one card at a time, with a beat between
// each. Calls onDone() when both sides have drawn to their target hand size.
export function runDraw(onDone) {
  state.phase = "draw";
  logEntry(`— Draw —`, "phase");
  firePhaseHook("onDrawStart");
  drawForSide("player", () => {
    drawForSide("ai", () => {
      logEntry(`Draw phase complete.`, "draw");
      firePhaseHook("onDrawEnd");
      if (onDone) onDone();
    });
  });
}

function drawForSide(sideName, onDone) {
  const insight = globalStatTotal(sideName, "insight");
  const target = BASE_DRAW_TARGET + insight;
  function step() {
    const s = state.sides[sideName];
    if (s.hand.length >= target) {
      if (insight > 0 && sideName === "player") {
        logEntry(`Insight ${insight} → drew up to ${target} cards.`, "draw");
      }
      onDone();
      return;
    }
    drawOneScheduled(sideName, (card) => {
      if (!card) {
        // Truly out — no deck, no discard. Stop drawing.
        onDone();
        return;
      }
      step();
    });
  }
  step();
}

export function runMain() {
  state.phase = "main";
  logEntry(`— Main phase: play cards, then end. —`, "phase");
  firePhaseHook("onMainStart");
  // Player plays via UI; AI plays after player ends main
}

// End-of-cleanup work. Called from advancePhase when player ends the cleanup phase, after any
// pending cleanup-phase commits have been committed and flipped. Discards hands, reverts
// end-of-turn buffs, fires onCleanupEnd hooks, runs neutral end-of-cleanup, advances priority/turn.
export function runCleanupEnd() {
  // White Resolve: each side keeps the leftmost N cards in hand (where N = side's global Resolve)
  // through cleanup; the rest discards. Player can reorder their hand throughout the turn — the
  // leftmost N are a standing decision, "locked" by the time cleanup fires.
  for (const sideName of ["player", "ai"]) {
    const s = state.sides[sideName];
    const resolve = globalStatTotal(sideName, "resolve");
    if (s.hand.length > 0) {
      const keep = s.hand.slice(0, resolve);
      const discard = s.hand.slice(resolve);
      if (discard.length > 0) {
        s.discard.push(...discard);
      }
      if (sideName === "player") {
        logEntry(`Resolve ${resolve} → ${sideName === "player" ? "you" : "AI"} keep ${keep.length}, discard ${discard.length}.`, "cleanup");
      } else {
        logEntry(`AI keeps ${keep.length}, discards ${discard.length} (Resolve ${resolve}).`, "cleanup");
      }
      s.hand = keep;
    }
  }
  revertEndOfTurnBuffs();
  // Clear per-turn "flipped this turn" markers so movement is allowed next turn.
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (c && c.flippedThisTurn) c.flippedThisTurn = false;
      }
    }
  }
  firePhaseHook("onCleanupEnd");
  if (state.gameOver) return;
  resolveNeutralCleanup();
  checkGameOver();
  if (state.view === "encounter") checkAiRetreat();
  if (state.encounterEndPending) {
    const result = state.encounterEndPending;
    state.encounterEndPending = null;
    endEncounter(result);
    return;
  }
  const oldPriority = state.firstSide;
  state.firstSide = other(state.firstSide);
  logEntry(`Priority flips: ${oldPriority} → ${state.firstSide} (alternation tiebreak).`, "cleanup");
  state.turn += 1;
}

// Fire neutral cards' end-of-cleanup effects across all locations.
export function resolveNeutralCleanup() {
  if (!state.sides) return;
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("ai", loc);
    // Iterate over a snapshot of slots so card removals during the loop don't break iteration.
    const candidates = [];
    if (lc.structure && lc.structure.owner === "neutral") candidates.push({ card: lc.structure, where: "structure" });
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.creatures[pos];
      if (c && c.owner === "neutral") candidates.push({ card: c, where: "creature", pos });
    }
    for (const cand of candidates) {
      if (!cand.card.revealed) continue;
      if (cand.card.effect === "siren") {
        // Find a non-neutral creature here at random — pool is BOTH player and AI creatures.
        // Per design, "another non-neutral creature here" excludes neutrals (so the siren never
        // accidentally consumes a sister-siren).
        const pool = [];
        for (const ownerSide of ["player", "ai"]) {
          for (const pos of ["fl","fr","bl","br"]) {
            const c = L(ownerSide, loc).creatures[pos];
            if (c && c.owner !== "neutral") pool.push({ side: ownerSide, pos, card: c });
          }
        }
        if (pool.length === 0) {
          logEntry(`  ${cand.card.name} (@${LOC_NAMES[loc]}) finds no creature to take — it lingers.`, "combat-detail");
          continue;
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        // Remove the picked creature: from the slot, and if it's a player creature, from the run deck too.
        L(pick.side, loc).creatures[pick.pos] = null;
        if (pick.card.owner === "player" && pick.card.runDeckEntry) {
          const idx = state.runDeck.indexOf(pick.card.runDeckEntry);
          if (idx !== -1) state.runDeck.splice(idx, 1);
          logEntry(`  ${cand.card.name} (@${LOC_NAMES[loc]}) takes ${pick.card.name} (yours) — removed from your deck for the rest of the run.`, "win");
        } else {
          logEntry(`  ${cand.card.name} (@${LOC_NAMES[loc]}) takes ${pick.card.name} (${pick.side}) — removed from this encounter.`, "combat-detail");
        }
        // Siren removes itself too.
        if (cand.where === "creature") L("ai", loc).creatures[cand.pos] = null;
        else L("ai", loc).structure = null;
        logEntry(`    ${cand.card.name} sings itself out of existence.`, "combat-detail");
      }
    }
  }
}

// v3 game-over check: handles per-event win/loss conditions (player death, boss death). Does NOT
// check AI retreat — that's an end-of-turn evaluation, fired from runCleanupEnd. This way mid-turn
// creature deaths don't end the encounter prematurely (the AI might still reinforce next turn,
// but we can't know that until cleanup).
export function checkGameOver() {
  if (!state.sides) return;
  const p = state.sides.player.durability;
  if (p <= 0) {
    state.gameOver = "playerLost";
    logEntry(`Your summoner falls.`, "lose");
    checkEncounterEnd();
    return;
  }
  if (state.encounterKind === "boss") {
    const a = state.sides.ai.durability;
    if (a <= 0) {
      state.gameOver = "bossKilled";
      logEntry(`The boss summoner falls!`, "win");
      checkEncounterEnd();
      return;
    }
  }
  // Catchall: check broader encounter-end conditions (e.g., neutral-only encounter is empty).
  checkEncounterEnd();
}

// ---------- Turn flow ----------
//
// Per REBUILD_PLAN.md section 20: every phase orchestrator is a beat-chained function. The
// engine never awaits the UI; all pacing is via scheduler.runBeat. Each terminal beat that
// lands the engine in an interactive phase calls endSequence() so click handlers re-enable.

export function startNewTurn() {
  if (state.gameOver) return;
  if (state.view !== "encounter" || !state.sides) return;
  resetInitResolved();
  startSequence();
  runUpkeepStart();
  if (state.gameOver || state.view !== "encounter") {
    render();
    endSequence();
    return;
  }
  render();
  // Upkeep is interactive — release the busy flag and let the player play actions or advance.
  endSequence();
  maybeAutoAdvance();
}

// If the current phase is interactive but the player has nothing legal to do, auto-advance
// to the next phase after a brief readable pause.
export function maybeAutoAdvance() {
  const interactive = ["upkeep","draw","main","combat-reveal","cleanup"];
  if (!interactive.includes(state.phase)) return;
  if (state.gameOver || state.view !== "encounter") return;
  if (isPlaying()) return;  // already mid-sequence
  if (playerHasAnyLegalActionThisPhase()) return;
  runBeat(1500, () => {
    if (state.view !== "encounter" || state.gameOver) return;
    if (playerHasAnyLegalActionThisPhase()) return;
    advancePhase();
  });
}

// End main: AI places its main-phase plays, both sides commit, fire onMainEnd, run reveal,
// transition to combat-reveal (interactive).
export function endMainPhase() {
  if (state.phase !== "main") return;
  if (state.gameOver || state.view !== "encounter") return;
  startSequence();
  aiPlaceMain();
  commitPendingPlays();
  firePhaseHook("onMainEnd");
  state.phase = "reveal";
  logEntry(`— Reveal —`, "phase");
  render();
  phaseTransitionPause(() => {
    if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
    endOfPhaseRevealAndResolve(() => {
      if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
      state.phase = "combat-reveal";
      logEntry(`— Combat preview — commit actions/equipment, then advance to combat. —`, "phase");
      render();
      endSequence();
      maybeAutoAdvance();
    });
  });
}

// End combat-reveal: commit any pending combat-reveal commits, flip them, run combat,
// transition to cleanup (interactive).
export function resolveCombatPhase() {
  if (state.phase !== "combat-reveal") return;
  if (state.gameOver || state.view !== "encounter") return;
  startSequence();
  commitPendingPlays();
  endOfPhaseRevealAndResolve(() => {
    if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
    state.phase = "combat-resolve";
    render();
    phaseTransitionPause(() => {
      if (state.view !== "encounter") { endSequence(); return; }
      runCombat(() => {
        if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
        state.phase = "cleanup";
        logEntry(`— Cleanup —`, "phase");
        firePhaseHook("onCleanupStart");
        runTomeGolemCleanup();
        render();
        endSequence();
        maybeAutoAdvance();
      });
    });
  });
}

// Tome Golem: at start of cleanup, the leftmost action in your hand goes on top of your draw
// pile. Fires once per Tome Golem in play, per side. Silent fizzle if no actions in hand.
export function runTomeGolemCleanup() {
  for (const sideName of ["player", "ai"]) {
    const s = state.sides[sideName];
    // Count Tome Golems on this side in play.
    let count = 0;
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (c && c.defKey === "b8" && c.revealed !== false) count++;
      }
    }
    for (let i = 0; i < count; i++) {
      const idx = s.hand.findIndex(c => c.type === "action");
      if (idx === -1) break;
      const action = s.hand.splice(idx, 1)[0];
      s.deck.unshift(action);
      logEntry(`  Tome Golem (${sideName}): ${action.name} → top of deck.`, "combat-detail");
    }
  }
}

// End cleanup: commit any pending cleanup commits, flip them, fire onCleanupEnd, discard,
// alternate priority, end encounter if applicable, start next turn otherwise.
export function endCleanupPhase() {
  if (state.phase !== "cleanup") return;
  if (state.gameOver || state.view !== "encounter") return;
  startSequence();
  commitPendingPlays();
  endOfPhaseRevealAndResolve(() => {
    if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
    runCleanupEnd();
    if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
    render();
    runBeat(400, () => {
      if (state.view !== "encounter") { endSequence(); return; }
      endSequence();   // released before startNewTurn re-acquires
      startNewTurn();
    });
  });
}

// Single advance handler — picks the right action based on current phase.
//
// Gates on isPlaying(): if the engine is mid-sequence, the click is dropped. Per
// REBUILD_PLAN section 20 — the player can't double-advance during a beat chain.
export function advancePhase() {
  // Note: click gating happens at the UI call site (in export.js), not here. Internal
  // scheduled callers (maybeAutoAdvance, etc.) call advancePhase as a continuation and
  // must NOT be gated by isPlaying — they fire while the engine is mid-sequence by design.
  if (state.gameOver) return;
  if (state.view !== "encounter" || !state.sides) return;
  state.selectedCardId = null;
  state.selectedCommittedId = null;
  resetInitResolved();

  if (state.phase === "upkeep") {
    startSequence();
    commitPendingPlays();
    runUpkeepEnd(() => {
      if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
      // runDraw is beat-chained now — draws each card as its own beat with a reshuffle beat
      // if needed. onDone fires after both sides have drawn to target.
      runDraw(() => {
        if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
        render();
        endSequence();
        maybeAutoAdvance();
      });
    });
    return;
  }
  if (state.phase === "draw") {
    startSequence();
    commitPendingPlays();
    firePhaseHook("onDrawEnd");
    endOfPhaseRevealAndResolve(() => {
      if (state.gameOver || state.view !== "encounter") { render(); showGameOver(); endSequence(); return; }
      runMain();
      render();
      endSequence();
      maybeAutoAdvance();
    });
    return;
  }
  if (state.phase === "main") {
    return endMainPhase();
  }
  if (state.phase === "combat-reveal") {
    return resolveCombatPhase();
  }
  if (state.phase === "cleanup") {
    return endCleanupPhase();
  }
}

// Check if the player has any legal play (action/equipment in hand they can commit, or a creature
// that can still move). Used to decide whether to auto-advance an idle phase.
export function playerHasAnyLegalActionThisPhase() {
  if (state.view !== "encounter" || !state.sides) return false;
  const p = state.sides.player;
  // Any playable hand card?
  for (const card of p.hand) {
    if (!isCommitWindowFor(card.type)) continue;
    if (cardHasAnyLegalPlay("player", card)) return true;
  }
  // Any movable committed creature? (movement allowed in all phases except the turn a creature
  // flipped up; one move per turn per creature.)
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("player", loc);
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.creatures[pos];
      if (!c || c.revealed === false) continue;
      if (c.flippedThisTurn) continue;
      if (c.sleepCounter > 0) continue;
      if (c.wokeInPhase === state.phase) continue;
      if (lc.movedThisTurn.has(c.instId)) continue;
      // At least one adjacent slot must be empty for a move to be possible.
      for (const dest of ["fl","fr","bl","br"]) {
        if (dest === pos) continue;
        if (!isAdjacent(pos, dest)) continue;
        if (!lc.creatures[dest]) return true;
      }
    }
  }
  return false;
}
