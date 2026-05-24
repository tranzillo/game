// Combat.
//
// Per REBUILD_PLAN.md sections 17, 18, 20:
// - Time-based pacing via scheduler.runBeat. Engine never awaits UI.
// - Deferred-death pattern: applyCombatDamage emits damage/death events but does NOT remove
//   the dying creature from its slot or fire deathwish. The orchestrator (runCombat) calls
//   finalizeOneDeath in a follow-up beat — that's the beat where deathwish fires and the
//   card moves to the graveyard pile.
// - Result: the player sees creature take damage → die in slot (death animation) → deathwish
//   triggers → creature slides to graveyard. Each is its own visible beat.

import { state, L } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES } from "./config.js";
import { logEntry } from "./log.js";
import { committedStatTotal, effectiveStat, other } from "./stats.js";
import { render } from "../ui/render.js";
import { emit } from "./events.js";
import { runBeat } from "./scheduler.js";
import { durationFor } from "../ui/animations.js";
import { _initResolved, emitOutcome } from "./timeline.js";
import { firePhaseHook, checkGameOver } from "./phases.js";
import { fireLeavePlayTriggers, detachAllEquipmentFromHost, sendToPile, onCreatureTookDamage } from "./marks.js";

// ---------- Combat preview ----------
// Pure simulation — no state mutation. Returns:
//   attackers: instId -> { targetLabel, damage, killsTarget }
//   willDie: Set of instIds that die in simulated combat
//   summonerHits: { player, ai }
export function computeCombatPreview() {
  function snapshotLoc(side, loc) {
    const lc = L(side, loc);
    const cs = {};
    for (const pos of ["fl", "fr", "bl", "br"]) {
      const c = lc.creatures[pos] || lc.pending.creatures[pos] || null;
      cs[pos] = c ? { instId: c.instId, name: c.name, force: c.force || 0, tempo: c.tempo || 0, durability: c.durability, revealed: c.revealed, sleepCounter: c.sleepCounter || 0, wokeInPhase: c.wokeInPhase || null, ranged: !!c.ranged, ammoCost: c.ammoCost || 0, skipAttackThisTurn: !!c.skipAttackThisTurn } : null;
    }
    const action = lc.action || lc.pending.action || null;
    return {
      creatures: cs,
      action: action ? { instId: action.instId, name: action.name, tempo: action.tempo || 0, effect: action.effect, revealed: action.revealed } : null,
      ammo: lc.ammo || 0
    };
  }
  const sim = { player: { durability: state.sides.player.durability, locs: [] },
                 ai:     { durability: state.sides.ai.durability,     locs: [] } };
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    sim.player.locs.push(snapshotLoc("player", loc));
    sim.ai.locs.push(snapshotLoc("ai", loc));
  }
  function simLocalTempo(side, loc) {
    const cs = sim[side].locs[loc].creatures;
    let t = 0;
    for (const pos of ["fl","fr","bl","br"]) {
      const c = cs[pos];
      if (c && c.revealed !== false) t += c.tempo || 0;
    }
    return t;
  }
  function sidePriorityRankAt(side, loc) {
    const ptempo = simLocalTempo("player", loc);
    const atempo = simLocalTempo("ai", loc);
    if (ptempo > atempo) return side === "player" ? 0 : 1;
    if (atempo > ptempo) return side === "ai" ? 0 : 1;
    return side === state.firstSide ? 0 : 1;
  }
  const spellFallThrough = { player: 0, ai: 0 };
  function simDamageAtLoc(sourceSide, lx, dmg) {
    const enemySide = other(sourceSide);
    const enemyLoc = sim[enemySide].locs[lx];
    const targets = ["fl", "fr", "bl", "br"]
      .map(pos => ({ pos, c: enemyLoc.creatures[pos] }))
      .filter(x => x.c && x.c.revealed !== false);
    if (targets.length === 0) { spellFallThrough[enemySide] += dmg; return; }
    if (targets.length === 1) {
      const pick = targets[0];
      pick.c.durability -= dmg;
      if (pick.c.durability <= 0) enemyLoc.creatures[pick.pos] = null;
      return;
    }
    // Multiple legal random targets: don't apply (preview honesty per Pillar 10).
  }
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const actionCandidates = [];
    for (const sideName of ["player", "ai"]) {
      if (sim[sideName].locs[loc].action) {
        actionCandidates.push({ side: sideName, action: sim[sideName].locs[loc].action, tempo: simLocalTempo(sideName, loc) });
      }
    }
    actionCandidates.sort((a, b) => {
      if (a.tempo !== b.tempo) return b.tempo - a.tempo;
      return a.side === state.firstSide ? -1 : 1;
    });
    for (const ac of actionCandidates) {
      if (sim[ac.side].locs[loc].action !== ac.action) continue;
      if (ac.action.effect === "counterspell") {
        const opp = sim[other(ac.side)].locs[loc];
        if (opp.action) opp.action = null;
      } else if (ac.action.effect === "deal2") {
        simDamageAtLoc(ac.side, loc, 2);
      } else if (ac.action.effect === "deal1all") {
        for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
          simDamageAtLoc(ac.side, l2, 1);
        }
      }
      sim[ac.side].locs[loc].action = null;
    }
  }
  const POS_RANK = { fl: 0, fr: 1, bl: 2, br: 3 };
  const attackers = {};
  const willDie = new Set();
  const summonerHits = { player: spellFallThrough.player, ai: spellFallThrough.ai };
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const candidates = [];
    for (const sideName of ["player", "ai"]) {
      for (const pos of ["fl", "fr", "bl", "br"]) {
        const c = sim[sideName].locs[loc].creatures[pos];
        if (!c) continue;
        if (c.revealed === false) continue;
        const isBack = pos === "bl" || pos === "br";
        if (isBack && !c.ranged) continue;
        if (c.sleepCounter > 0) continue;
        if (c.wokeInPhase === state.phase) continue;
        if (c.skipAttackThisTurn) continue;
        if (c.force <= 0) continue;
        if (c.ranged && (sim[sideName].locs[loc].ammo || 0) < (c.ammoCost || 1)) continue;
        candidates.push({
          side: sideName, loc, pos, creature: c,
          sortKey: [-(c.tempo || 0), sidePriorityRankAt(sideName, loc), POS_RANK[pos]]
        });
      }
    }
    candidates.sort((a, b) => {
      for (let i = 0; i < a.sortKey.length; i++) {
        if (a.sortKey[i] !== b.sortKey[i]) return a.sortKey[i] - b.sortKey[i];
      }
      return 0;
    });
    for (const cand of candidates) {
      const live = sim[cand.side].locs[loc].creatures[cand.pos];
      if (!live || live.instId !== cand.creature.instId) continue;
      if (live.ranged) {
        const cost = live.ammoCost || 1;
        const myLoc = sim[cand.side].locs[loc];
        if ((myLoc.ammo || 0) < cost) continue;
        myLoc.ammo -= cost;
      }
      const enemyLoc = sim[other(cand.side)].locs[loc];
      const column = (cand.pos === "fl" || cand.pos === "bl") ? "fl" : "fr";
      const frontPos = column;
      const backPos = column === "fl" ? "bl" : "br";
      let target = enemyLoc.creatures[frontPos];
      let targetPos = frontPos;
      if (!target) { target = enemyLoc.creatures[backPos]; targetPos = backPos; }
      const dmg = live.force;
      if (target) {
        target.durability -= dmg;
        const killed = target.durability <= 0;
        attackers[live.instId] = {
          targetLabel: `${target.name} (${other(cand.side)} ${LOC_NAMES[loc]} ${targetPos})`,
          damage: dmg,
          killsTarget: killed
        };
        if (killed) {
          willDie.add(target.instId);
          enemyLoc.creatures[targetPos] = null;
        }
      } else {
        sim[other(cand.side)].durability -= dmg;
        summonerHits[other(cand.side)] += dmg;
        attackers[live.instId] = {
          targetLabel: `${other(cand.side) === "player" ? "your" : "AI"} summoner`,
          damage: dmg,
          killsTarget: false,
          hitsSummoner: true
        };
      }
    }
  }
  return { attackers, willDie, summonerHits };
}

// ---------- Combat orchestrator (runCombat) ----------
//
// Beat-chained. Each attacker is one beat (attack + damage). If the attack killed something,
// the next beat finalizes that death (deathwish + leave-play). Then more pending deaths are
// drained one beat at a time. Then the next attacker steps up.

export const COMBAT_STEP_MS = 700;  // Legacy reference. Actual pacing per-event via durationFor().

export function runCombat(onDone) {
  state.phase = "combat";
  logEntry(`— Combat —`, "phase");
  logEntry(`Priority: ${state.firstSide === "player" ? "you" : "AI"} have priority on Tempo ties.`, "phase");
  firePhaseHook("onCombatStart");

  if (state.gameOver) { if (onDone) onDone(); return; }

  const queue = [];
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const orderedAttackers = computeCombatOrder(loc);
    if (orderedAttackers.length === 0) continue;
    queue.push({ kind: "loc-header", loc });
    let lastSide = null;
    for (const atk of orderedAttackers) {
      if (atk.side !== lastSide) {
        queue.push({ kind: "side-header", side: atk.side });
        lastSide = atk.side;
      }
      queue.push({ kind: "attack", side: atk.side, pos: atk.pos, creature: atk.creature, loc });
    }
  }

  if (queue.length === 0) { finish(); return; }
  processOne(0);

  function processOne(idx) {
    if (state.gameOver) { finish(); return; }
    if (idx >= queue.length) {
      // Queue empty — drain any final pending deaths, then finish.
      drainPendingDeaths(() => finish());
      return;
    }
    const ev = queue[idx];
    if (ev.kind === "loc-header") {
      logEntry(`At ${LOC_NAMES[ev.loc]}:`, "combat-header");
      processOne(idx + 1);
      return;
    }
    if (ev.kind === "side-header") {
      logEntry(`  ${ev.side === "player" ? "Your" : "AI"} attacks:`, "combat-header");
      processOne(idx + 1);
      return;
    }
    // attack
    runAttackBeat(ev, () => {
      // After the attack beat, drain any pending deaths (each as its own beat), then next attack.
      drainPendingDeaths(() => processOne(idx + 1));
    });
  }

  function finish() {
    firePhaseHook("onCombatEnd");
    checkGameOver();
    if (onDone) onDone();
  }
}

// Run one attacker's beat — pre-checks, do the attack (sync state mutation + event emission),
// render, then schedule the next call via runBeat.
function runAttackBeat(ev, onBeatDone) {
  const { side, pos, creature, loc } = ev;
  const liveAttacker = L(side, loc).creatures[pos];

  // No-attack branches: log it, brief hold, on to next.
  function noAttack(reason) {
    logEntry(`    ${(liveAttacker || creature).name} (${pos}): ${reason} — does not attack.`, "combat-detail");
    render();
    runBeat(durationFor("no-attack"), onBeatDone);
  }

  if (!liveAttacker || liveAttacker.instId !== creature.instId) {
    return noAttack("killed before its swing");
  }
  if (liveAttacker.sleepCounter > 0) return noAttack("asleep");
  if (liveAttacker.wokeInPhase === state.phase) return noAttack("just woke up this phase");
  if (liveAttacker.skipAttackThisTurn) return noAttack("skip-attack flag (Blizzard etc.)");
  if (effectiveStat(liveAttacker, side, loc, "force") <= 0) return noAttack("no Force");

  if (liveAttacker.ranged) {
    const cost = liveAttacker.ammoCost || 1;
    const lc2 = L(side, loc);
    if ((lc2.ammo || 0) < cost) return noAttack("out of ammo — can't fire");
    lc2.ammo -= cost;
    logEntry(`    ${liveAttacker.name} (${pos}): spends ${cost} ammo (${side} ${LOC_NAMES[loc]} stockpile now ${lc2.ammo}).`, "combat-detail");
  }

  // Look ahead at the target slot so the `attack` event includes targetInstId for the crash anim.
  const enemySideLook = other(side);
  const enemyLocLook = L(enemySideLook, loc);
  const columnLook = (pos === "fl" || pos === "bl") ? "fl" : "fr";
  const backLook = columnLook === "fl" ? "bl" : "br";
  const targetPosLook = enemyLocLook.creatures[columnLook] ? columnLook : (enemyLocLook.creatures[backLook] ? backLook : null);
  const targetCard = targetPosLook ? enemyLocLook.creatures[targetPosLook] : null;
  emit("attack", {
    instId: liveAttacker.instId,
    name: liveAttacker.name,
    side, loc, pos,
    force: effectiveStat(liveAttacker, side, loc, "force"),
    ranged: !!liveAttacker.ranged,
    targetInstId: targetCard ? targetCard.instId : null
  });

  // resolveAttack synchronously applies damage to all targets (main + cleave + pierce).
  // Each applyCombatDamage call may set creatures' pendingLeavePile if they die — but does
  // NOT remove them from slots or fire deathwish yet. Those happen in the drain that follows.
  resolveAttack(side, loc, pos, liveAttacker);
  _initResolved.add(`attack-${liveAttacker.instId}`);
  render();
  runBeat(durationFor("attack"), onBeatDone);
}

// Drain pending deaths one at a time. Each death is its own beat (death anim + deathwish
// triggers + slide to pile). Calls onDrained when no pending deaths remain.
function drainPendingDeaths(onDrained) {
  if (state.gameOver) { onDrained(); return; }
  const pending = findFirstPendingDeath();
  if (!pending) { onDrained(); return; }
  finalizeOneDeath(pending);
  render();
  runBeat(durationFor("leave-play"), () => drainPendingDeaths(onDrained));
}

// Compute combat order at a single location. Per-location Tempo hierarchy.
export function computeCombatOrder(loc) {
  const POS_RANK = { fl: 0, fr: 1, bl: 2, br: 3 };
  const localTempoTotal = {
    player: committedStatTotal("player", loc, "tempo"),
    ai: committedStatTotal("ai", loc, "tempo")
  };
  function sidePriorityRank(side) {
    if (localTempoTotal.player > localTempoTotal.ai) return side === "player" ? 0 : 1;
    if (localTempoTotal.ai > localTempoTotal.player) return side === "ai" ? 0 : 1;
    return side === state.firstSide ? 0 : 1;
  }
  const candidates = [];
  for (const sideName of ["player", "ai"]) {
    for (const pos of ["fl", "fr", "bl", "br"]) {
      const c = L(sideName, loc).creatures[pos];
      if (!c) continue;
      const isBack = pos === "bl" || pos === "br";
      if (isBack && !c.ranged) continue;
      if (c.sleepCounter > 0) continue;
      if (c.wokeInPhase === state.phase) continue;
      if (c.skipAttackThisTurn) continue;
      if (effectiveStat(c, sideName, loc, "force") <= 0) continue;
      if (c.ranged) {
        const cost = c.ammoCost || 1;
        if ((L(sideName, loc).ammo || 0) < cost) continue;
      }
      candidates.push({
        side: sideName, loc, pos, creature: c,
        sortKey: [-(c.tempo || 0), sidePriorityRank(sideName), POS_RANK[pos]]
      });
    }
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < a.sortKey.length; i++) {
      if (a.sortKey[i] !== b.sortKey[i]) return a.sortKey[i] - b.sortKey[i];
    }
    return 0;
  });
  return candidates;
}

// Spite — summoner thorns. Fires when a creature attack damages a summoner.
export function fireSpiteThorns(defendingSide, loc, attacker, attackerLabel) {
  if (!attacker) return;
  const spite = committedStatTotal(defendingSide, loc, "spite");
  if (spite <= 0) return;
  const attackerSide = other(defendingSide);
  const aLoc = L(attackerSide, loc);
  let atkPos = null;
  for (const p of ["fl","fr","bl","br"]) {
    if (aLoc.creatures[p] === attacker) { atkPos = p; break; }
  }
  if (!atkPos) return;
  logEntry(`    Spite (${defendingSide} ${LOC_NAMES[loc]}, ${spite}) → ${attackerLabel} for ${spite}.`, "combat-detail");
  applyCombatDamage(attackerSide, loc, atkPos, spite, `Spite (${defendingSide} ${LOC_NAMES[loc]})`, null);
}

// Damage to a summoner. In non-boss encounters, AI side has no summoner — fizzles.
export function damageSummoner(side, dmg, label, loc) {
  if (dmg <= 0) return false;
  if (side === "ai" && state.encounterKind !== "boss") {
    logEntry(`    ${label} → ${side} side has no summoner here — damage fizzles.`, "combat-detail");
    emit("summoner-damage-fizzle", { side, amount: dmg, source: label, loc });
    return false;
  }
  state.sides[side].durability -= dmg;
  const locLabel = loc != null ? ` ${LOC_NAMES[loc]}` : "";
  logEntry(`    ${label} →${locLabel} ${side} summoner for ${dmg}. (${side} Durability: ${state.sides[side].durability})`, "combat-detail");
  emit("summoner-damage", { side, amount: dmg, source: label, loc, newDurability: state.sides[side].durability });
  return true;
}

// Apply damage to a creature. SYNC. Emits damage + (if lethal) death events. Does NOT remove
// the card from its slot, fire deathwish, or sendToPile. Those happen in finalizeOneDeath in
// a subsequent beat. Per REBUILD_PLAN sec 17 (death sequence).
export function applyCombatDamage(targetSide, loc, pos, dmg, attackerLabel, attacker) {
  if (dmg <= 0) return;
  const lc = L(targetSide, loc);
  const target = lc.creatures[pos];
  if (!target) {
    const landed = damageSummoner(targetSide, dmg, `${attackerLabel} (empty ${pos})`, loc);
    if (landed) fireSpiteThorns(targetSide, loc, attacker, attackerLabel);
    return;
  }
  // Skip already-pending-death targets (defensive — re-damaging a dying creature is a no-op).
  if (target.pendingLeavePile) return;
  // Record melee attacker for Explosive Trap deathwish tracking.
  if (attacker && !attacker.ranged) {
    if (!target.meleeAttackersThisTurn) target.meleeAttackersThisTurn = [];
    if (!target.meleeAttackersThisTurn.includes(attacker.instId)) target.meleeAttackersThisTurn.push(attacker.instId);
  }
  target.durability -= dmg;
  logEntry(`    ${attackerLabel} → ${target.name} (${targetSide} ${pos}) for ${dmg}.`, "combat-detail");
  emit("damage", { targetInstId: target.instId, targetName: target.name, targetSide, loc, pos, amount: dmg, source: attackerLabel });
  onCreatureTookDamage(target, targetSide, loc, dmg);
  if (target.durability <= 0) {
    logEntry(`      ${target.name} is destroyed.`, "combat-detail");
    emit("death", {
      instId: target.instId,
      name: target.name,
      side: targetSide,
      loc, pos,
      killerInstId: attacker ? attacker.instId : null,
      isToken: !!target.isToken
    });
    target.pendingLeavePile = "graveyard";
  }
}

// Resolve one attacker's swing — main hit + attack patterns (cleave / pierce).
export function resolveAttack(side, loc, pos, attacker) {
  const isBack = pos === "bl" || pos === "br";
  if (isBack && !attacker.ranged) return;

  const enemySide = other(side);
  const enemyLoc = L(enemySide, loc);
  const column = (pos === "fl" || pos === "bl") ? "fl" : "fr";
  const enemyFront = column;
  const enemyBack = column === "fl" ? "bl" : "br";
  const targetPos = enemyLoc.creatures[enemyFront] ? enemyFront : (enemyLoc.creatures[enemyBack] ? enemyBack : null);
  const dmg = effectiveStat(attacker, side, loc, "force");
  const label = `${attacker.name} (${pos})`;

  if (targetPos) {
    applyCombatDamage(enemySide, loc, targetPos, dmg, label, attacker);
  } else {
    const landed = damageSummoner(enemySide, dmg, label, loc);
    if (landed) fireSpiteThorns(enemySide, loc, attacker, label);
  }

  const patterns = attacker.attackPatterns || [];
  for (const p of patterns) {
    if (p.type === "cleave") {
      if (!targetPos) continue;
      const adjacent = targetPos === "fl" ? "fr" : (targetPos === "fr" ? "fl" : (targetPos === "bl" ? "br" : "bl"));
      if (enemyLoc.creatures[adjacent]) {
        applyCombatDamage(enemySide, loc, adjacent, dmg, `${label} (cleave)`, attacker);
      }
    } else if (p.type === "pierce") {
      const pierceVal = p.value || 1;
      if (!targetPos) {
        const landed = damageSummoner(enemySide, pierceVal, `${label} (pierce ${pierceVal})`, loc);
        if (landed) fireSpiteThorns(enemySide, loc, attacker, `${label} (pierce ${pierceVal})`);
      } else if (targetPos === "fl" || targetPos === "fr") {
        const backPos = targetPos === "fl" ? "bl" : "br";
        if (enemyLoc.creatures[backPos]) {
          applyCombatDamage(enemySide, loc, backPos, pierceVal, `${label} (pierce ${pierceVal})`, attacker);
        } else {
          const landed = damageSummoner(enemySide, pierceVal, `${label} (pierce ${pierceVal})`, loc);
          if (landed) fireSpiteThorns(enemySide, loc, attacker, `${label} (pierce ${pierceVal})`);
        }
      }
    }
  }
}

// ---------- Pending-death helpers (used by orchestrators in combat + timeline) ----------

// Scan all locations on both sides for a creature with pendingLeavePile set. Returns the
// first found, or null.
export function findFirstPendingDeath() {
  if (!state || !state.sides) return null;
  for (const side of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(side, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (c && c.pendingLeavePile) {
          return { card: c, side, loc, pos, pile: c.pendingLeavePile };
        }
      }
    }
  }
  return null;
}

// Finalize one death: remove from slot, fire leave-play triggers (deathwish), emit
// leave-play, send to pile. SYNC. May emit more events (deathwish-trigger, summon, damage,
// further deaths). Caller is responsible for the surrounding beat scheduling.
export function finalizeOneDeath({ card, side, loc, pos, pile }) {
  const lc = L(side, loc);
  card.pendingLeavePile = null;
  lc.creatures[pos] = null;
  fireLeavePlayTriggers(card, side, loc, pos);
  detachAllEquipmentFromHost(card, side, loc);
  emit("leave-play", { instId: card.instId, name: card.name, side, loc, pos, toPile: pile });
  sendToPile(card, side, pile);
}
