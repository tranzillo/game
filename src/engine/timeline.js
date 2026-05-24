import { state, L, createCard } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES, LOC_TEXT_KEYS } from "./config.js";
import { logEntry } from "./log.js";
import { committedStatTotal, other } from "./stats.js";
import { render } from "../ui/render.js";
import { drainScene, enqueueHold } from "../ui/scene.js";
import { LOCATION_TEXTS } from "./location-texts.js";
import { fireFlipUpTrigger, triggerSpellbooksOnActionFlip } from "./triggers.js";
import { checkQuestsForEvent } from "./quests.js";
import { sendToPile, attachEquipmentToHost, dealDamageAtLoc, sacrificeCreatureOnSide, runRecruitConversion, onCreatureTookDamage, grantUntilEndOfTurn, fireLeavePlayTriggers, detachAllEquipmentFromHost } from "./marks.js";
import { applyCombatDamage } from "./combat.js";
import { drawOne } from "./phases.js";

// Resolved-this-phase tracker — instIds of cards/actions/attacks already resolved this phase.
// Used by the initiative tracker to fade out items that have already happened. Cleared on phase
// transitions. Keys are scoped by phase to avoid stale state bleeding.
export let _initResolved = new Set();

export function resetInitResolved() { _initResolved = new Set(); }

// ---------- Timeline + outcomes substrate ----------
// The timeline is a unified Future → Present → Past stream of card-resolution chips. Each chip
// represents a card entering or flipping in play. Chips enter as `state: "future"`, then mark
// `resolved: true` (or `state: "resolved"`) when they pass through the present. UI views render
// the future as a marching strip; the past as a falling stack.
//
// Outcomes are a separate stream for things that *happened* in the encounter beyond card
// resolutions: damage, deaths, attacks, movement, mark applications, etc. Drives the narrative.
//
// Phase 1 — these helpers populate the streams. Phase 2 will render the visual UI. Phase 3 will
// add cards that target the streams (copy/rearrange/suppress future chips, copy/destroy past
// chips). For now they're pure data substrate.

let _chipIdCounter = 0;
export function nextChipId() { return ++_chipIdCounter; }

// Emit a future chip — a card pending resolution. Called when a card commits (player or AI),
// enters play face-down via token creation, or is otherwise placed in a slot.
//   card    — the card object (creature, structure, action, equipment, token)
//   side    — owner side
//   loc     — location index
//   pos     — position string (fl/fr/bl/br/structure/action/equipment)
//   tempo   — effective Tempo at chip-creation time (for non-creatures this is location Tempo)
// Returns the chip so callers can hold a reference if they need to mark it resolved later.
export function emitFutureChip(card, side, loc, pos, tempo) {
  if (!state.timeline) state.timeline = [];
  const chip = {
    id: nextChipId(),
    defKey: card.defKey,
    instId: card.instId,
    name: card.name,
    kind: card.type,            // "creature" | "structure" | "action" | "equipment"
    side, loc, pos,
    tempo: tempo != null ? tempo : (card.tempo || 0),
    faceUp: false,              // chips enter the future face-down by default
    marks: card.marks ? card.marks.map(m => ({ kind: m.kind, side: m.side })) : [],
    state: "future",
    resolvedTurn: null,
    turn: state.turn
  };
  state.timeline.push(chip);
  return chip;
}

// Mark a chip as resolved — it has passed through the present and now lives in the past.
// `faceUp` indicates whether the card flipped face-up at the present (typically true; structures
// already in play just resolve into the past as face-up). Optionally identify chip by instId+kind
// if no direct reference is available.
export function resolveChipForCard(card, side, loc, pos) {
  if (!state.timeline) return null;
  // Find the most recent future chip matching this card+slot.
  for (let i = state.timeline.length - 1; i >= 0; i--) {
    const c = state.timeline[i];
    if (c.state !== "future") continue;
    if (c.instId === card.instId && c.side === side && c.loc === loc && (pos === undefined || c.pos === pos)) {
      c.state = "resolved";
      c.faceUp = true;
      c.resolvedTurn = state.turn;
      // Mirror current marks onto the chip — marks may have been applied between commit and flip.
      c.marks = card.marks ? card.marks.map(m => ({ kind: m.kind, side: m.side })) : [];
      return c;
    }
  }
  return null;
}

// Emit a narrative outcome — damage, death, movement, attack, mark application, etc. Lines
// drive the narrative-history UI (replacement for the combat log). `kind` is a string tag;
// `payload` is whatever metadata the UI/log needs.
export function emitOutcome(kind, payload) {
  if (!state.outcomes) state.outcomes = [];
  state.outcomes.push({
    id: nextChipId(),
    kind,
    turn: state.turn,
    phase: state.phase,
    ...payload
  });
}

// Append a resolved action to The Past — shared, encounter-scoped, ordered list of action
// resolutions. Both sides write to it; both sides can read it. Used by Blue copy-from-past
// cards (and eventually Black erase-the-past). The entry holds a minimal snapshot — defKey is
// enough to re-create the action as a token if a Past-copy effect fires.
export function appendToPast(action, side, loc) {
  if (!state.past) state.past = [];
  state.past.push({
    defKey: action.defKey,
    side,
    loc,
    name: action.name,
    tempo: action.tempo || 0,
    turn: state.turn
  });
}

export function resolveAction(side, loc) {
  const lc = L(side, loc);
  const s = state.sides[side];
  if (!lc.action) return;
  const action = lc.action;
  let exitZone = "discard";

  // Track actions resolved this turn (per side). Read by Apprentice's Insight rule.
  s.actionsThisTurn = (s.actionsThisTurn || 0) + 1;

  // Append to The Past — a shared, encounter-scoped log of action resolutions. Both sides
  // see it; Blue cards (and future Black "erase past" mechanics) target it positionally or
  // randomly. Cleared at encounter start.
  appendToPast(action, side, loc);

  // Transit the action's chip from future → past (via the present). The reveal queue's
  // action-branch also calls this redundantly — the helper is idempotent (only marks the
  // first matching future chip resolved). This ensures location-text force-flip paths like
  // Champion's Rest also resolve their chips, not just the reveal-queue path.
  resolveChipForCard(action, side, loc, "action");

  if (action.effect === "deal2") {
    // Deal 2 damage to a random enemy creature *here* (or fall through to summoner).
    dealDamageAtLoc(side, loc, 2, action.name, ` @${LOC_NAMES[loc]}`);
  } else if (action.effect === "counterspell") {
    // Counterspell: clear the opposing action at *this* location (default scope "here").
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
    // Permanent stat-buff action: pick a random creature here (per Pillar 10), give +1 Force
    // permanently. Self-exiles per the exile-as-physical-destruction rule for permanent stat
    // buffs — the card is physically destroyed and cannot be recovered.
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
      // Permanent buff: also bump the run-deck entry so the change persists if this is a player creature.
      if (pick.c.runDeckEntry) {
        pick.c.runDeckEntry.mods = pick.c.runDeckEntry.mods || {};
        pick.c.runDeckEntry.mods.force = (pick.c.runDeckEntry.mods.force || 0) + 1;
      }
      const reason = candidates.length === 1 ? "[only legal target]" : `[random pick from ${candidates.length}]`;
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) → ${pick.c.name} (${pick.side} ${pick.pos}) gains +1 Force permanently. ${reason}`, "combat-detail");
    }
    exitZone = "exile";
  } else if (action.effect === "deal1all") {
    // SCOPE EXAMPLE: deal 1 damage to a random enemy creature at EACH location.
    // Per the universal fall-through rule, an empty location → 1 damage to the opposing summoner
    // (one fall-through instance per empty location). A scope-effect on an empty board hits the
    // summoner once *per empty location*.
    for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
      dealDamageAtLoc(side, l2, 1, action.name, ``);
    }
  } else if (action.effect === "recruitConversion") {
    runRecruitConversion(side, loc, action.name);
  } else if (action.effect === "goblinBombardment") {
    // Sacrifice a goblin on your side here (random pick if multiple). Then deal damage equal to
    // front-row Force on your side here (post-sacrifice — the sacrificed goblin's Force is gone).
    const sacrificed = sacrificeCreatureOnSide(side, loc, c => c.tribe === "goblin", action.name);
    if (!sacrificed) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — no goblin on your side here. Fizzles.`, "combat-detail");
    } else {
      // Force at the location = front-row creatures' effective Force (post-sacrifice).
      const force = committedStatTotal(side, loc, "force");
      if (force <= 0) {
        logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — 0 Force here after sacrifice. No damage dealt.`, "combat-detail");
      } else {
        dealDamageAtLoc(side, loc, force, action.name, ` @${LOC_NAMES[loc]}`);
      }
    }
  } else if (action.effect === "battleDriver") {
    // Pick a random creature on your side here. Deal 1 damage to it. That creature gains +1
    // Force this turn. Combos with Berserker — the 1 damage triggers Enraged for an additional +1F.
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
      // Fire damage-taken triggers (Enraged etc.).
      onCreatureTookDamage(pick.c, side, loc, 1);
      // Buff +1 Force this turn (if creature is still alive).
      if (pick.c.durability > 0) {
        grantUntilEndOfTurn(pick.c, "force", 1);
        logEntry(`  ${pick.c.name} gains +1 Force this turn.`, "combat-detail");
      } else {
        logEntry(`  ${pick.c.name} is destroyed before buff applies.`, "combat-detail");
        const bdPos = pick.pos;
        lc2.creatures[bdPos] = null;
        fireLeavePlayTriggers(pick.c, side, loc, bdPos);
        detachAllEquipmentFromHost(pick.c, side, loc);
        sendToPile(pick.c, side, "graveyard");
      }
    }
  } else if (action.effect === "forageAddAmmo") {
    // Forage: add 1 ammo to this side's stockpile at this location. Per-instance escalating cost
    // tracks here too — bump the cast counter so the next play of THIS card-instance costs more.
    const lc2 = L(side, loc);
    lc2.ammo = (lc2.ammo || 0) + 1;
    action.forageCasts = (action.forageCasts || 0) + 1;
    logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — +1 ammo (stockpile now ${lc2.ammo}). Next cast of this card needs ≥${action.forageCasts} Tempo extra.`, "combat-detail");
  } else if (action.effect === "study") {
    // Study: draw 1 card. Counts as an action played this turn (already tracked via the counter
    // bump at the top of resolveAction) — Apprentice's Insight rises by 1.
    const drawn = drawOne(side);
    if (drawn) {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — drew ${side === "player" ? drawn.name : "a card"}.`, "combat-detail");
    } else {
      logEntry(`  ${action.name} (${side} @${LOC_NAMES[loc]}) — deck and discard empty; nothing to draw.`, "combat-detail");
    }
  } else if (action.effect === "spark") {
    // b4 Spark: deal 1 damage to a creature on the other side here. Single target via universal
    // damage rule (random face-up creature, fall through to summoner if none).
    dealDamageAtLoc(side, loc, 1, action.name, ` @${LOC_NAMES[loc]}`);
  } else if (action.effect === "pyroblast") {
    // b_pyroblast token: deal 1 damage to each face-up creature on the other side here. Face-down
    // creatures are not "really in play yet" — skipped.
    const enemySide = other(side);
    const enemyLoc = L(enemySide, loc);
    for (const pos of ["fl","fr","bl","br"]) {
      const target = enemyLoc.creatures[pos];
      if (!target || target.revealed === false) continue;
      applyCombatDamage(enemySide, loc, pos, 1, action.name, null);
    }
  } else if (action.effect === "blizzard") {
    // b_blizzard token: at each location in the encounter, the front-row creature on the other
    // side does not attack this turn. Pillar 10 random pick if both front slots occupied. Sets a
    // skipAttackThisTurn flag the combat order check honors.
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
    // b7 Mirror Image: add a token copy of a face-up creature at this location (any side) to
    // your discard. Per-instance escalating Insight cost — bump the cast counter.
    const candidates = [];
    for (const s2 of ["player", "ai"]) {
      const lc2 = L(s2, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc2.creatures[pos];
        if (!c || c.revealed === false) continue;
        if (c.isToken) continue;  // don't copy tokens — would explode the run-deck cleanup
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

// Resolve all queued actions across all locations in Tempo order. Higher Tempo resolves first;
// ties broken by side priority. Each (side, loc) action is its own candidate.
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
    // Side-priority tiebreak — globally, by state.firstSide. (Per-location tiebreak via local
    // Tempo totals would be more correct but adds complexity for little gain at v2 scale.)
    if (a.side === state.firstSide && b.side !== state.firstSide) return -1;
    if (b.side === state.firstSide && a.side !== state.firstSide) return 1;
    // Same side, same Tempo — left-to-right by location.
    return a.loc - b.loc;
  });
  logEntry(`Actions resolve:`, "combat-header");
  for (const cand of candidates) {
    if (state.gameOver) return;
    // Re-check that the action is still in the slot — Counterspell at this location may have removed it.
    if (L(cand.side, cand.loc).action !== cand.action) {
      logEntry(`  ${cand.action.name} (${cand.side} @${LOC_NAMES[cand.loc]}) was countered before resolving.`, "combat-detail");
      continue;
    }
    resolveAction(cand.side, cand.loc);
  }
}

// Unified end-of-phase reveal-and-resolve. Per the design's Tempo-ordered reveal rule, face-down
// cards flip up in Tempo order — and crucially, a higher-Tempo action that flips up resolves
// BEFORE lower-Tempo cards have flipped up. This means a Spark (Tempo 1) flipping up first sees a
// still-face-down Mage (Tempo 0) at the same location and cannot target it (face-down = inert).
//
// Each event is sorted by Tempo desc, then side priority, then location/position. Events are:
//   - "flip" — a face-down creature/structure becomes face-up (no other effect in v3)
//   - "action" — an action resolves (flipping it up if face-down, then executing its effect)
// Reveal queue resolves one chip at a time with render+delay between each, so the player watches
// flips march through the present in Tempo order. Takes an `onDone` callback because the
// resolution is now async-chained via setTimeout.
export const REVEAL_STEP_MS = 380;
export function endOfPhaseRevealAndResolve(onDone) {
  const events = [];
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      // Face-down creatures: flip events.
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (c && c.revealed === false) {
          events.push({ kind: "flip", side: sideName, loc, where: "creature", pos, card: c, tempo: c.tempo || 0 });
        }
      }
      // Non-creature reveal order: actions, structures, equipment do NOT print their own Tempo.
      // Per design (CARD_DESIGN.md): their queue Tempo = the location's Tempo (caster's side).
      // Killing your Tempo-printing creatures mid-phase slows your action reveals.
      const locTempo = committedStatTotal(sideName, loc, "tempo");
      // Face-down structures: flip events.
      if (lc.structure && lc.structure.revealed === false) {
        events.push({ kind: "flip", side: sideName, loc, where: "structure", card: lc.structure, tempo: locTempo });
      }
      // Actions in slots: action-resolve events (they flip up as part of resolving).
      // Location text can declare a per-card suppression predicate (e.g., Champion's Rest:
      // suppress unless only one creature is here). Re-checked every end-of-phase; when the
      // predicate returns false, the action flips on that pass.
      const locTextKey = LOC_TEXT_KEYS[loc];
      const locText = locTextKey ? LOCATION_TEXTS[locTextKey] : null;
      if (lc.action) {
        const isQuest = lc.action.subtype === "quest";
        const suppressed = locText && typeof locText.shouldSuppressAction === "function"
          ? locText.shouldSuppressAction(lc.action, loc) : false;
        // Quests that have already flipped sit in the slot watching for completion — don't
        // re-queue them. Only face-down actions need to flip here.
        if (!suppressed && (!isQuest || lc.action.revealed === false)) {
          events.push({ kind: "action", side: sideName, loc, card: lc.action, tempo: locTempo });
        }
      }
      // Pending equipment: flip events. Attaches to host on flip; fizzles to junkyard if host gone.
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
  if (events.length === 0) { if (onDone) onDone(); return; }

  // Sort by Tempo desc, then side priority on Tempo ties, then location, then position-in-grid.
  const POS_RANK = { fl: 0, fr: 1, bl: 2, br: 3, structure: 4, action: 5 };
  events.sort((a, b) => {
    if (a.tempo !== b.tempo) return b.tempo - a.tempo;
    if (a.side !== b.side) {
      if (a.side === state.firstSide) return -1;
      return 1;
    }
    if (a.loc !== b.loc) return a.loc - b.loc;
    const ar = POS_RANK[a.pos || a.where] ?? 99;
    const br = POS_RANK[b.pos || b.where] ?? 99;
    return ar - br;
  });

  logEntry(`Reveal & resolve queue (priority: ${state.firstSide}, sorted Tempo desc → priority → location → position):`, "combat-header");
  for (const ev of events) {
    const where = ev.where === "creature" ? ev.pos : ev.where;
    logEntry(`  · ${ev.side}/${LOC_NAMES[ev.loc]}/${where} — ${ev.card.name} (T${ev.tempo}) [${ev.kind}]`, "combat-detail");
  }

  function processOne(idx) {
    if (state.gameOver) { if (onDone) onDone(); return; }
    if (idx >= events.length) { if (onDone) onDone(); return; }
    const ev = events[idx];
    processEvent(ev);
    render();
    // Always hold for a minimum beat so the chip-passes-through-present visual reads even when
    // no outcomes fire animations. Scene also waits for any animations enqueued from outcomes.
    enqueueHold(420);
    drainScene(() => processOne(idx + 1));
  }

  function processEvent(ev) {
    if (ev.kind === "flip") {
      // Re-check the slot — earlier action at this Tempo may have destroyed it.
      const lc = L(ev.side, ev.loc);
      const stillThere = ev.where === "creature" ? lc.creatures[ev.pos] === ev.card : lc.structure === ev.card;
      if (!stillThere) {
        logEntry(`  → ${ev.card.name} (${ev.side} ${LOC_NAMES[ev.loc]} ${ev.pos || ev.where}) skipped: removed before flipping.`, "combat-detail");
        return;
      }
      ev.card.revealed = true;
      // Creatures that flip this turn can't move this turn. flippedThisTurn clears at end of cleanup.
      if (ev.where === "creature") ev.card.flippedThisTurn = true;
      _initResolved.add(`flip-${ev.card.instId}`);
      // Chip transits from future → past via the present.
      resolveChipForCard(ev.card, ev.side, ev.loc, ev.pos);
      if (ev.side === "ai") {
        const where = ev.where === "creature" ? `${LOC_NAMES[ev.loc]} ${ev.pos}` : `${LOC_NAMES[ev.loc]} (structure)`;
        logEntry(`  → Revealed: ${ev.card.name} at ${where}.`, "combat-detail");
      } else {
        const where = ev.where === "creature" ? `${LOC_NAMES[ev.loc]} ${ev.pos}` : `${LOC_NAMES[ev.loc]} (structure)`;
        logEntry(`  → Your ${ev.card.name} flips up at ${where}.`, "combat-detail");
      }
      // Fire the card's flip-up trigger if it has one. Triggers fire AFTER the card is face-up
      // (so the card itself is on the board for any "this gains X" effects).
      fireFlipUpTrigger(ev.side, ev.loc, ev.card);
      // Notify active quests of this flip-up event.
      checkQuestsForEvent({ kind: "flipUp", card: ev.card, side: ev.side, loc: ev.loc });
    } else if (ev.kind === "action") {
      // Action might have been countered / removed already.
      const lc = L(ev.side, ev.loc);
      if (lc.action !== ev.card) {
        logEntry(`  → ${ev.card.name} (${ev.side} @${LOC_NAMES[ev.loc]}) was countered before resolving.`, "combat-detail");
        return;
      }
      // Quests flip up but DON'T resolve immediately. They sit in the slot until their completion
      // condition fires. Skip resolveAction for quests; just reveal and continue.
      const isQuest = ev.card.subtype === "quest";
      if (ev.card.revealed === false) {
        ev.card.revealed = true;
        if (ev.side === "ai") logEntry(`  → Revealed: ${ev.card.name} (AI action at ${LOC_NAMES[ev.loc]}).`, "combat-detail");
        if (isQuest) logEntry(`  → ${ev.card.name} (Quest) sits in slot, watching for completion.`, "combat-detail");
        // Spellbook trigger: any opposing-side Spellbook at this location loses 1 page and copies
        // this action to the owner's discard. Multiple spellbooks each fire independently.
        triggerSpellbooksOnActionFlip(ev.card, ev.side, ev.loc);
      }
      if (!isQuest) resolveAction(ev.side, ev.loc);
      _initResolved.add(`action-${ev.card.instId}`);
      resolveChipForCard(ev.card, ev.side, ev.loc, "action");
    } else if (ev.kind === "equipment") {
      // Equipment flips up and attaches to the host at its slot. If the host is gone (died/moved
      // before flip), the equipment fizzles to the owner-side junkyard.
      const lc = L(ev.side, ev.loc);
      const arr = lc.pending.equipment[ev.pos];
      const idx = arr ? arr.indexOf(ev.card) : -1;
      if (idx === -1) return;  // already removed somehow
      arr.splice(idx, 1);
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

  processOne(0);
}
