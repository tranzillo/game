// Timeline + reveal queue.
//
// Per REBUILD_PLAN.md sections 18, 20:
// - Engine NEVER awaits the UI. Beats are scheduled via scheduler.runBeat.
// - endOfPhaseRevealAndResolve takes an onDone callback that fires when the queue drains.
// - Each beat: process one reveal event (synchronously mutates state, emits events for UI,
//   may queue pending deaths via marks). Then renders. Then sleeps for the beat's duration
//   via scheduler.runBeat. Then processes the next event.
//
// emitOutcome is a re-export of emit() from events.js — same semantics, kept under the old
// name so other modules don't need to change their imports.

import { state, L, createCard } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES, LOC_TEXT_KEYS } from "./config.js";
import { logEntry } from "./log.js";
import { committedStatTotal, other } from "./stats.js";
import { render } from "../ui/render.js";
import { emit } from "./events.js";
import { runBeat } from "./scheduler.js";
import { durationFor } from "../ui/animations.js";
import { LOCATION_TEXTS } from "./location-texts.js";
import { fireFlipUpTrigger, triggerSpellbooksOnActionFlip } from "./triggers.js";
import { checkQuestsForEvent } from "./quests.js";
import { sendToPile, attachEquipmentToHost, dealDamageAtLoc, sacrificeCreatureOnSide, runRecruitConversion, onCreatureTookDamage, grantUntilEndOfTurn, fireLeavePlayTriggers, detachAllEquipmentFromHost } from "./marks.js";
import { applyCombatDamage, findFirstPendingDeath, finalizeOneDeath } from "./combat.js";
import { drawOne } from "./phases.js";

// Resolved-this-phase tracker — instIds of cards/actions/attacks already resolved this phase.
// Cleared on phase transitions. Used by the initiative tracker UI.
export let _initResolved = new Set();
export function resetInitResolved() { _initResolved = new Set(); }

// Backwards-compatible alias: emitOutcome === emit. Other modules import emitOutcome from
// here for historical reasons; this preserves their imports without rewriting them.
export const emitOutcome = emit;

// ---------- Timeline chip helpers ----------

let _chipIdCounter = 0;
export function nextChipId() { return ++_chipIdCounter; }

export function emitFutureChip(card, side, loc, pos, tempo) {
  if (!state.timeline) state.timeline = [];
  const chip = {
    id: nextChipId(),
    defKey: card.defKey,
    instId: card.instId,
    name: card.name,
    kind: card.type,
    side, loc, pos,
    tempo: tempo != null ? tempo : (card.tempo || 0),
    faceUp: false,
    marks: card.marks ? card.marks.map(m => ({ kind: m.kind, side: m.side })) : [],
    state: "future",
    resolvedTurn: null,
    turn: state.turn
  };
  state.timeline.push(chip);
  return chip;
}

// Mark a chip as resolved — it passed through the present and lives in the past.
export function resolveChipForCard(card, side, loc, pos) {
  if (!state.timeline) return null;
  for (let i = state.timeline.length - 1; i >= 0; i--) {
    const c = state.timeline[i];
    if (c.state !== "future") continue;
    if (c.instId === card.instId && c.side === side && c.loc === loc && (pos === undefined || c.pos === pos)) {
      c.state = "resolved";
      c.faceUp = true;
      c.resolvedTurn = state.turn;
      c.marks = card.marks ? card.marks.map(m => ({ kind: m.kind, side: m.side })) : [];
      return c;
    }
  }
  return null;
}

// Append a resolved action to The Past — encounter-scoped shared log of action resolutions.
export function appendToPast(action, side, loc) {
  if (!state.past) state.past = [];
  state.past.push({
    defKey: action.defKey,
    side, loc,
    name: action.name,
    tempo: action.tempo || 0,
    turn: state.turn
  });
}

// ---------- Action resolution ----------
//
// resolveAction mutates state and emits events. It may set pendingLeavePile on creatures
// damaged into lethal range; the orchestrator (endOfPhaseRevealAndResolve) drains those
// via finalizeOneDeath in subsequent beats.

export function resolveAction(side, loc) {
  const lc = L(side, loc);
  const s = state.sides[side];
  if (!lc.action) return;
  const action = lc.action;
  let exitZone = "discard";

  s.actionsThisTurn = (s.actionsThisTurn || 0) + 1;
  appendToPast(action, side, loc);
  resolveChipForCard(action, side, loc, "action");

  if (action.effect === "deal2") {
    dealDamageAtLoc(side, loc, 2, action.name, ` @${LOC_NAMES[loc]}`);
  } else if (action.effect === "counterspell") {
    const oppLoc = L(other(side), loc);
    if (oppLoc.action) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) counters ${oppLoc.action.name} (${other(side)}) — to graveyard.`, "combat-detail");
      const c = oppLoc.action;
      oppLoc.action = null;
      sendToPile(c, other(side), "graveyard");
    } else {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) finds no opposing action here — fizzles, exits to graveyard.`, "combat-detail");
    }
    exitZone = "graveyard";
  } else if (action.effect === "permPlus1ForceHere") {
    const candidates = [];
    for (const sideName of ["player", "ai"]) {
      const lc2 = L(sideName, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc2.creatures[pos];
        if (c && c.revealed !== false) candidates.push({ side: sideName, pos, c });
      }
    }
    if (candidates.length === 0) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) finds no creatures here — fizzles.`, "combat-detail");
    } else {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.c.force = (pick.c.force || 0) + 1;
      if (pick.c.runDeckEntry) {
        pick.c.runDeckEntry.mods = pick.c.runDeckEntry.mods || {};
        pick.c.runDeckEntry.mods.force = (pick.c.runDeckEntry.mods.force || 0) + 1;
      }
      const reason = candidates.length === 1 ? "[only legal target]" : `[random pick from ${candidates.length}]`;
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) → ${pick.c.name} (${pick.side} ${pick.pos}) gains +1 Force permanently. ${reason}`, "combat-detail");
    }
    exitZone = "exile";
  } else if (action.effect === "deal1all") {
    for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
      dealDamageAtLoc(side, l2, 1, action.name, ``);
    }
  } else if (action.effect === "recruitConversion") {
    runRecruitConversion(side, loc, action.name);
  } else if (action.effect === "goblinBombardment") {
    const sacrificed = sacrificeCreatureOnSide(side, loc, c => c.tribe === "goblin", action.name);
    if (!sacrificed) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — no goblin on your side here. Fizzles.`, "combat-detail");
    } else {
      const force = committedStatTotal(side, loc, "force");
      if (force <= 0) {
        logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — 0 Force here after sacrifice. No damage dealt.`, "combat-detail");
      } else {
        dealDamageAtLoc(side, loc, force, action.name, ` @${LOC_NAMES[loc]}`);
      }
    }
  } else if (action.effect === "battleDriver") {
    const lc2 = L(side, loc);
    const candidates = [];
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc2.creatures[pos];
      if (c && c.revealed !== false) candidates.push({ pos, c });
    }
    if (candidates.length === 0) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — no creatures on your side here. Fizzles.`, "combat-detail");
    } else {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const reason = candidates.length === 1 ? "[only legal target]" : `[random pick from ${candidates.length}]`;
      pick.c.durability -= 1;
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) → ${pick.c.name} (${side} ${pick.pos}) takes 1 damage. ${reason}`, "combat-detail");
      onCreatureTookDamage(pick.c, side, loc, 1);
      if (pick.c.durability > 0) {
        grantUntilEndOfTurn(pick.c, "force", 1);
        logEntry(`  ${pick.c.name} gains +1 Force this turn.`, "combat-detail");
      } else {
        // Damaged creature into lethal range — mark for deferred finalize, same pattern as
        // combat damage. The orchestrator's drain loop will finalize after this beat.
        emit("death", { instId: pick.c.instId, name: pick.c.name, side, loc, pos: pick.pos, killerInstId: null, isToken: !!pick.c.isToken });
        pick.c.pendingLeavePile = "graveyard";
      }
    }
  } else if (action.effect === "forageAddAmmo") {
    const lc2 = L(side, loc);
    lc2.ammo = (lc2.ammo || 0) + 1;
    action.forageCasts = (action.forageCasts || 0) + 1;
    logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — +1 ammo (stockpile now ${lc2.ammo}). Next cast of this card needs ≥${action.forageCasts} Tempo extra.`, "combat-detail");
  } else if (action.effect === "study") {
    const drawn = drawOne(side);
    if (drawn) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — drew ${side === "player" ? drawn.name : "a card"}.`, "combat-detail");
    } else {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — deck and discard empty; nothing to draw.`, "combat-detail");
    }
  } else if (action.effect === "spark") {
    dealDamageAtLoc(side, loc, 1, action.name, ` @${LOC_NAMES[loc]}`);
  } else if (action.effect === "pyroblast") {
    const enemySide = other(side);
    const enemyLoc = L(enemySide, loc);
    for (const pos of ["fl","fr","bl","br"]) {
      const target = enemyLoc.creatures[pos];
      if (!target || target.revealed === false) continue;
      applyCombatDamage(enemySide, loc, pos, 1, action.name, null);
    }
  } else if (action.effect === "blizzard") {
    const enemySide = other(side);
    for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
      const eLoc = L(enemySide, l2);
      const frontCandidates = [];
      for (const pos of ["fl","fr"]) {
        const c = eLoc.creatures[pos];
        if (c && c.revealed !== false) frontCandidates.push({ pos, c });
      }
      if (frontCandidates.length === 0) continue;
      const pick = frontCandidates[Math.floor(Math.random() * frontCandidates.length)];
      pick.c.skipAttackThisTurn = true;
      logEntry(`  ${action.name}: ${pick.c.name} (${enemySide} ${LOC_NAMES[l2]} ${pick.pos}) won't attack this turn.`, "combat-detail");
    }
  } else if (action.effect === "mirrorImage") {
    const candidates = [];
    for (const s2 of ["player", "ai"]) {
      const lc2 = L(s2, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc2.creatures[pos];
        if (!c || c.revealed === false) continue;
        if (c.isToken) continue;
        candidates.push(c);
      }
    }
    if (candidates.length === 0) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — no legal creature to copy. Fizzles.`, "combat-detail");
    } else {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const copy = createCard(pick.defKey, side);
      copy.isToken = true;
      copy.revealed = true;
      state.sides[side].discard.push(copy);
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — token copy of ${pick.name} to your discard.`, "combat-detail");
      action.mirrorCasts = (action.mirrorCasts || 0) + 1;
    }
  }
  lc.action = null;
  sendToPile(action, side, exitZone);
}

// ---------- The reveal queue, beat-scheduled ----------
//
// Walks the queue one event at a time. Each beat:
// 1. Process one event (synchronous state mutation + event emissions).
// 2. Render.
// 3. Drain any pending deaths queued by the event (each death is its own beat via runBeat).
// 4. Schedule the next event via runBeat.
//
// onDone fires when the queue is fully drained AND all pending deaths are finalized.

export const REVEAL_STEP_MS = 380;   // Legacy constant kept for reference; actual pacing
                                      // is per-event via durationFor() from animations.js.

export function endOfPhaseRevealAndResolve(onDone) {
  const events = buildRevealQueue();
  if (events.length === 0) { if (onDone) onDone(); return; }

  logEntry(`Reveal & resolve queue (priority: ${state.firstSide}, sorted Tempo desc → priority → location → position):`, "combat-header");
  for (const ev of events) {
    const where = ev.where === "creature" ? ev.pos : ev.where;
    logEntry(`  · ${ev.side}/${LOC_NAMES[ev.loc]}/${where} — ${ev.card.name} (T${ev.tempo}) [${ev.kind}]`, "combat-detail");
  }

  processOne(events, 0, onDone);
}

function buildRevealQueue() {
  const events = [];
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (c && c.revealed === false) {
          events.push({ kind: "flip", side: sideName, loc, where: "creature", pos, card: c, tempo: c.tempo || 0 });
        }
      }
      const locTempo = committedStatTotal(sideName, loc, "tempo");
      if (lc.structure && lc.structure.revealed === false) {
        events.push({ kind: "flip", side: sideName, loc, where: "structure", card: lc.structure, tempo: locTempo });
      }
      const locTextKey = LOC_TEXT_KEYS[loc];
      const locText = locTextKey ? LOCATION_TEXTS[locTextKey] : null;
      if (lc.action) {
        const isQuest = lc.action.subtype === "quest";
        const suppressed = locText && typeof locText.shouldSuppressAction === "function"
          ? locText.shouldSuppressAction(lc.action, loc) : false;
        if (!suppressed && (!isQuest || lc.action.revealed === false)) {
          events.push({ kind: "action", side: sideName, loc, card: lc.action, tempo: locTempo });
        }
      }
      for (const pos of ["fl","fr","bl","br"]) {
        const arr = lc.pending.equipment[pos];
        if (!arr) continue;
        for (const eq of arr) {
          if (eq.revealed === false) {
            events.push({ kind: "equipment", side: sideName, loc, where: "equipment", pos, card: eq, tempo: locTempo });
          }
        }
      }
    }
  }
  const POS_RANK = { fl: 0, fr: 1, bl: 2, br: 3, structure: 4, action: 5 };
  events.sort((a, b) => {
    if (a.tempo !== b.tempo) return b.tempo - a.tempo;
    if (a.side !== b.side) return a.side === state.firstSide ? -1 : 1;
    if (a.loc !== b.loc) return a.loc - b.loc;
    const ar = POS_RANK[a.pos || a.where] ?? 99;
    const br = POS_RANK[b.pos || b.where] ?? 99;
    return ar - br;
  });
  return events;
}

function processOne(events, idx, onDone) {
  if (state.gameOver) { if (onDone) onDone(); return; }
  if (idx >= events.length) {
    // Queue empty — drain any final pending deaths, then call onDone.
    drainPendingDeaths(() => { if (onDone) onDone(); });
    return;
  }
  const ev = events[idx];
  processEvent(ev);
  render();
  // After the reveal event plays its beat, drain any pending deaths (e.g., the action's
  // damage put creatures into lethal range). Each death is its own beat.
  drainPendingDeaths(() => {
    runBeat(durationFor(ev.kind === "flip" ? "flip" : "action-resolve"), () => {
      processOne(events, idx + 1, onDone);
    });
  });
}

// Drain pending deaths one at a time, each as its own beat. Calls `onDrained` when no
// pending deaths remain.
function drainPendingDeaths(onDrained) {
  if (state.gameOver) { onDrained(); return; }
  const pending = findFirstPendingDeath();
  if (!pending) { onDrained(); return; }
  finalizeOneDeath(pending);
  render();
  runBeat(durationFor("leave-play"), () => drainPendingDeaths(onDrained));
}

function processEvent(ev) {
  if (ev.kind === "flip") {
    const lc = L(ev.side, ev.loc);
    const stillThere = ev.where === "creature" ? lc.creatures[ev.pos] === ev.card : lc.structure === ev.card;
    if (!stillThere) {
      logEntry(`  → ${ev.card.name} (${ev.side} ${LOC_NAMES[ev.loc]} ${ev.pos || ev.where}) skipped: removed before flipping.`, "combat-detail");
      return;
    }
    ev.card.revealed = true;
    if (ev.where === "creature") ev.card.flippedThisTurn = true;
    _initResolved.add(`flip-${ev.card.instId}`);
    resolveChipForCard(ev.card, ev.side, ev.loc, ev.pos);
    emit("flip", { instId: ev.card.instId, name: ev.card.name, side: ev.side, loc: ev.loc, pos: ev.pos });
    if (ev.side === "ai") {
      const where = ev.where === "creature" ? `${LOC_NAMES[ev.loc]} ${ev.pos}` : `${LOC_NAMES[ev.loc]} (structure)`;
      logEntry(`  → Revealed: ${ev.card.name} at ${where}.`, "combat-detail");
    } else {
      const where = ev.where === "creature" ? `${LOC_NAMES[ev.loc]} ${ev.pos}` : `${LOC_NAMES[ev.loc]} (structure)`;
      logEntry(`  → Your ${ev.card.name} flips up at ${where}.`, "combat-detail");
    }
    fireFlipUpTrigger(ev.side, ev.loc, ev.card);
    checkQuestsForEvent({ kind: "flipUp", card: ev.card, side: ev.side, loc: ev.loc });
  } else if (ev.kind === "action") {
    const lc = L(ev.side, ev.loc);
    if (lc.action !== ev.card) {
      logEntry(`  → ${ev.card.name} (${ev.side} @${LOC_NAMES[ev.loc]}) was countered before resolving.`, "combat-detail");
      return;
    }
    const isQuest = ev.card.subtype === "quest";
    if (ev.card.revealed === false) {
      ev.card.revealed = true;
      emit("flip", { instId: ev.card.instId, name: ev.card.name, side: ev.side, loc: ev.loc, pos: "action" });
      if (ev.side === "ai") logEntry(`  → Revealed: ${ev.card.name} (AI action at ${LOC_NAMES[ev.loc]}).`, "combat-detail");
      if (isQuest) logEntry(`  → ${ev.card.name} (Quest) sits in slot, watching for completion.`, "combat-detail");
      triggerSpellbooksOnActionFlip(ev.card, ev.side, ev.loc);
    }
    if (!isQuest) resolveAction(ev.side, ev.loc);
    _initResolved.add(`action-${ev.card.instId}`);
    resolveChipForCard(ev.card, ev.side, ev.loc, "action");
  } else if (ev.kind === "equipment") {
    const lc = L(ev.side, ev.loc);
    const arr = lc.pending.equipment[ev.pos];
    const idx2 = arr ? arr.indexOf(ev.card) : -1;
    if (idx2 === -1) return;
    arr.splice(idx2, 1);
    ev.card.revealed = true;
    const host = lc.creatures[ev.pos];
    if (!host) {
      logEntry(`  → ${ev.card.name} (${ev.side} ${LOC_NAMES[ev.loc]} ${ev.pos}) has no host — fizzles to junkyard.`, "combat-detail");
      sendToPile(ev.card, ev.side, "junkyard");
      return;
    }
    const ok = attachEquipmentToHost(ev.card, host, ev.side);
    if (!ok) {
      logEntry(`  → ${ev.card.name} can't attach to ${host.name} — already at equipment cap. Fizzles to junkyard.`, "combat-detail");
      sendToPile(ev.card, ev.side, "junkyard");
      return;
    }
    logEntry(`  → ${ev.card.name} attaches to ${host.name} (${ev.side} ${LOC_NAMES[ev.loc]} ${ev.pos}).`, "combat-detail");
    fireFlipUpTrigger(ev.side, ev.loc, ev.card);
    _initResolved.add(`equip-${ev.card.instId}`);
    resolveChipForCard(ev.card, ev.side, ev.loc, ev.pos);
  }
}

// Resolve all queued actions across all locations in Tempo order. Used by legacy callers
// that want the sync version. Most call sites use the queue-based endOfPhaseRevealAndResolve.
export function resolveAllActions() {
  const candidates = [];
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const action = L(sideName, loc).action;
      if (action) candidates.push({ side: sideName, loc, action, tempo: action.tempo || 0 });
    }
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => {
    if (a.tempo !== b.tempo) return b.tempo - a.tempo;
    if (a.side === state.firstSide && b.side !== state.firstSide) return -1;
    if (b.side === state.firstSide && a.side !== state.firstSide) return 1;
    return a.loc - b.loc;
  });
  logEntry(`Actions resolve:`, "combat-header");
  for (const cand of candidates) {
    if (state.gameOver) return;
    if (L(cand.side, cand.loc).action !== cand.action) {
      logEntry(`  ${cand.action.name} (${cand.side} @${LOC_NAMES[cand.loc]}) was countered before resolving.`, "combat-detail");
      continue;
    }
    resolveAction(cand.side, cand.loc);
  }
}
