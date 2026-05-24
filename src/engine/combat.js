import { state, L } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES } from "./config.js";
import { logEntry } from "./log.js";
import { committedStatTotal, effectiveStat, other } from "./stats.js";
import { render } from "../ui/render.js";
import { drainScene, enqueueHold } from "../ui/scene.js";
import { _initResolved, emitOutcome } from "./timeline.js";
import { firePhaseHook, checkGameOver } from "./phases.js";
import { fireLeavePlayTriggers, detachAllEquipmentFromHost, sendToPile, onCreatureTookDamage } from "./marks.js";

// ---------- Combat preview ----------
// Returns:
//   attackers:   instId -> { targetLabel, damage, killsTarget }
//   willDie:     Set of instIds that die in simulated combat
//   summonerHits: { player, ai }
//
// Combat is per-location: creatures at location L attack creatures at the same location L.
// Cross-location attacks don't exist in v2. Per-location, we use the same Tempo hierarchy as v1.
export function computeCombatPreview() {
  // Per-location snapshot of the side's creatures + the side's action at that location.
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
  // Build per-location snapshots for both sides; summoner durabilities are global per side.
  const sim = { player: { durability: state.sides.player.durability, locs: [] },
                 ai:     { durability: state.sides.ai.durability,     locs: [] } };
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    sim.player.locs.push(snapshotLoc("player", loc));
    sim.ai.locs.push(snapshotLoc("ai", loc));
  }

  // Per-location side-priority based on local Tempo (within a single location).
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

  // First simulate action resolution per location in Tempo order. Counterspell here removes the
  // opposing action at this location; damage actions consume targets ahead of creature combat.
  // (default scope is "here").
  // Tracks summoner hits from spell fall-through during preview, fed into summonerHits below.
  const spellFallThrough = { player: 0, ai: 0 };

  // Helper: simulate a damage instance with fall-through. Mirrors dealDamageAtLoc in real resolve.
  // Face-down cards are inert per the unified rule and not legal damage targets.
  //
  // PILLAR 10 / preview-honesty rule: if there are multiple legal random targets, we DO NOT pick
  // one — we leave the sim board untouched. This prevents the preview from leaking the random
  // pick by consequence (e.g., "combat preview shows my Recruit swinging through to summoner →
  // therefore the Spark must have killed the Mage"). The player sees combat as it would play out
  // *if the spell didn't fire*; they know the spell will fire but not which target it picks.
  //
  // Deterministic cases (0 targets → fall-through to summoner; 1 target → known pick) DO apply,
  // because the outcome is knowable without random information.
  function simDamageAtLoc(sourceSide, lx, dmg) {
    const enemySide = other(sourceSide);
    const enemyLoc = sim[enemySide].locs[lx];
    const targets = ["fl", "fr", "bl", "br"]
      .map(pos => ({ pos, c: enemyLoc.creatures[pos] }))
      .filter(x => x.c && x.c.revealed !== false);
    if (targets.length === 0) {
      // Deterministic fall-through to summoner.
      spellFallThrough[enemySide] += dmg;
      return;
    }
    if (targets.length === 1) {
      // Deterministic single-target pick.
      const pick = targets[0];
      pick.c.durability -= dmg;
      if (pick.c.durability <= 0) enemyLoc.creatures[pick.pos] = null;
      return;
    }
    // Multiple legal random targets: don't apply the damage. Combat preview reflects pre-spell
    // board state so the random pick remains hidden until reveal.
  }

  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const actionCandidates = [];
    for (const sideName of ["player", "ai"]) {
      // Action queue Tempo = caster-side Tempo at this location (per design).
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
        // Scope-extended damage: 1 per location, with fall-through per empty location.
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

  // Per-location creature combat. Each location resolves in its own Tempo order; locations are
  // simulated left-to-right but their orderings are independent.
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const candidates = [];
    for (const sideName of ["player", "ai"]) {
      for (const pos of ["fl", "fr", "bl", "br"]) {
        const c = sim[sideName].locs[loc].creatures[pos];
        if (!c) continue;
        if (c.revealed === false) continue;  // face-down cards don't attack (unified rule)
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
      // Ranged ammo simulation: must still have ammo at swing time; consume it.
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
      if (!target) {
        target = enemyLoc.creatures[backPos];
        targetPos = backPos;
      }
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

// Combat resolves one swing at a time with a render+delay between each swing, so the player
// sees the attack queue unfold in Tempo order. Takes an `onDone` callback because the resolution
// is now async-chained via setTimeout. State still mutates synchronously inside each beat.
// Legacy constant kept for compatibility; combat beat spacing is now controlled by the scene
// queue (each beat waits for drainScene before processing the next attacker).
export const COMBAT_STEP_MS = 700;
export function runCombat(onDone) {
  state.phase = "combat";
  logEntry(`— Combat —`, "phase");
  logEntry(`Priority: ${state.firstSide === "player" ? "you" : "AI"} have priority on Tempo ties.`, "phase");
  firePhaseHook("onCombatStart");

  if (state.gameOver) { if (onDone) onDone(); return; }

  // Flatten all per-location attack queues into one sequenced list. Each loc still uses its own
  // Tempo ordering; locations process left-to-right (existing behavior).
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

  function processOne(idx) {
    if (state.gameOver) { finish(); return; }
    if (idx >= queue.length) { finish(); return; }
    const ev = queue[idx];
    if (ev.kind === "loc-header") {
      logEntry(`At ${LOC_NAMES[ev.loc]}:`, "combat-header");
      processOne(idx + 1);  // headers are instant, no delay
      return;
    }
    if (ev.kind === "side-header") {
      logEntry(`  ${ev.side === "player" ? "Your" : "AI"} attacks:`, "combat-header");
      processOne(idx + 1);
      return;
    }
    // attack
    const { side, pos, creature, loc } = ev;
    const liveAttacker = L(side, loc).creatures[pos];
    if (!liveAttacker || liveAttacker.instId !== creature.instId) {
      logEntry(`    ${creature.name} (${pos}): killed before its swing — does not attack.`, "combat-detail");
      render();
      enqueueHold(300);
      drainScene(() => processOne(idx + 1));
      return;
    }
    if (liveAttacker.sleepCounter > 0) {
      logEntry(`    ${liveAttacker.name} (${pos}): asleep — does not attack.`, "combat-detail");
      render();
      enqueueHold(300);
      drainScene(() => processOne(idx + 1));
      return;
    }
    if (liveAttacker.wokeInPhase === state.phase) {
      logEntry(`    ${liveAttacker.name} (${pos}): just woke up this phase — does not attack.`, "combat-detail");
      render();
      enqueueHold(300);
      drainScene(() => processOne(idx + 1));
      return;
    }
    if (liveAttacker.skipAttackThisTurn) {
      logEntry(`    ${liveAttacker.name} (${pos}): skip-attack flag (Blizzard etc.) — does not attack.`, "combat-detail");
      render();
      enqueueHold(300);
      drainScene(() => processOne(idx + 1));
      return;
    }
    if (effectiveStat(liveAttacker, side, loc, "force") <= 0) {
      logEntry(`    ${liveAttacker.name} (${pos}): no Force — does not attack.`, "combat-detail");
      render();
      enqueueHold(300);
      drainScene(() => processOne(idx + 1));
      return;
    }
    if (liveAttacker.ranged) {
      const cost = liveAttacker.ammoCost || 1;
      const lc2 = L(side, loc);
      if ((lc2.ammo || 0) < cost) {
        logEntry(`    ${liveAttacker.name} (${pos}): out of ammo — can't fire.`, "combat-detail");
        render();
        enqueueHold(300);
        drainScene(() => processOne(idx + 1));
        return;
      }
      lc2.ammo -= cost;
      logEntry(`    ${liveAttacker.name} (${pos}): spends ${cost} ammo (${side} ${LOC_NAMES[loc]} stockpile now ${lc2.ammo}).`, "combat-detail");
    }
    // Look ahead at the target slot the same way resolveAttack will, so the outcome can
    // include the targetInstId (used by the UI to compute the crash-animation vector).
    const enemySideLook = other(side);
    const enemyLocLook = L(enemySideLook, loc);
    const columnLook = (pos === "fl" || pos === "bl") ? "fl" : "fr";
    const backLook = columnLook === "fl" ? "bl" : "br";
    const targetPosLook = enemyLocLook.creatures[columnLook] ? columnLook : (enemyLocLook.creatures[backLook] ? backLook : null);
    const targetCard = targetPosLook ? enemyLocLook.creatures[targetPosLook] : null;
    emitOutcome("attack", {
      instId: liveAttacker.instId,
      name: liveAttacker.name,
      side, loc, pos,
      force: effectiveStat(liveAttacker, side, loc, "force"),
      ranged: !!liveAttacker.ranged,
      targetInstId: targetCard ? targetCard.instId : null
    });
    resolveAttack(side, loc, pos, liveAttacker);
    _initResolved.add(`attack-${liveAttacker.instId}`);
    render();
    drainScene(() => processOne(idx + 1));
  }

  function finish() {
    firePhaseHook("onCombatEnd");
    checkGameOver();
    if (onDone) onDone();
  }

  if (queue.length === 0) { finish(); return; }
  processOne(0);
}

// Compute combat order at a single location. Per-location Tempo hierarchy:
//   1. Tempo descending
//   2. Side priority (higher local Tempo total at THIS location wins; ties go to state.firstSide)
//   3. Position rank (front-row left, then front-row right; back-row ranged after)
// Ranged creatures attack from any row, melee creatures attack from the front row only.
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
      // Melee: front row only. Ranged: any row but needs ammo to fire.
      const isBack = pos === "bl" || pos === "br";
      if (isBack && !c.ranged) continue;
      if (c.sleepCounter > 0) continue;
      if (c.wokeInPhase === state.phase) continue;
      if (c.skipAttackThisTurn) continue;  // Blizzard / similar — no attack this turn
      // Effective Force gates combat — conditional buffs (Provocation reverse-buff, Pit-Fighter
      // alone, equipment grants) all count toward whether this creature can swing.
      if (effectiveStat(c, sideName, loc, "force") <= 0) continue;
      // Ranged creatures need ammo to attack (any row — they only fire, never melee).
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

// Apply combat damage to a creature at a specific (side, loc, pos). Handles death-resolution and
// fires onCreatureTookDamage. Used by resolveAttack's main hit + extra-target attack patterns
// (cleave hits adjacent same-row slots; pierce hits the back-row slot behind the front-row target).
// Black Spite — summoner thorns. When a creature attack damages the summoner, the defending
// side's Spite at the attack's location deals retaliation damage to the attacker. Per-location
// (not global). Fires only if the summoner actually lost Durability (caller guarantees this).
export function fireSpiteThorns(defendingSide, loc, attacker, attackerLabel) {
  if (!attacker) return;
  const spite = committedStatTotal(defendingSide, loc, "spite");
  if (spite <= 0) return;
  // Find attacker's current position on the board (it's on the OTHER side from defending).
  const attackerSide = other(defendingSide);
  const aLoc = L(attackerSide, loc);
  let atkPos = null;
  for (const p of ["fl","fr","bl","br"]) {
    if (aLoc.creatures[p] === attacker) { atkPos = p; break; }
  }
  if (!atkPos) return;  // attacker moved/died — can't retaliate
  logEntry(`    Spite (${defendingSide} ${LOC_NAMES[loc]}, ${spite}) → ${attackerLabel} for ${spite}.`, "combat-detail");
  applyCombatDamage(attackerSide, loc, atkPos, spite, `Spite (${defendingSide} ${LOC_NAMES[loc]})`, null);
}

// Apply damage to a summoner. In non-boss encounters there's no real AI summoner — the AI side
// is just a holder for neutral / hostile content. Damage that falls through to that side has
// nowhere to go and just dissipates. The player summoner is always real (their Durability is the
// run-Durability across encounters). Returns true if the damage actually landed.
export function damageSummoner(side, dmg, label, loc) {
  if (dmg <= 0) return false;
  if (side === "ai" && state.encounterKind !== "boss") {
    logEntry(`    ${label} → ${side} side has no summoner here — damage fizzles.`, "combat-detail");
    emitOutcome("summoner-damage-fizzle", { side, amount: dmg, source: label, loc });
    return false;
  }
  state.sides[side].durability -= dmg;
  const locLabel = loc != null ? ` ${LOC_NAMES[loc]}` : "";
  logEntry(`    ${label} →${locLabel} ${side} summoner for ${dmg}. (${side} Durability: ${state.sides[side].durability})`, "combat-detail");
  emitOutcome("summoner-damage", { side, amount: dmg, source: label, loc, newDurability: state.sides[side].durability });
  return true;
}

export function applyCombatDamage(targetSide, loc, pos, dmg, attackerLabel, attacker) {
  if (dmg <= 0) return;
  const lc = L(targetSide, loc);
  const target = lc.creatures[pos];
  if (!target) {
    // No creature at this slot — damage falls through to the summoner (if any).
    const landed = damageSummoner(targetSide, dmg, `${attackerLabel} (empty ${pos})`, loc);
    if (landed) fireSpiteThorns(targetSide, loc, attacker, attackerLabel);
    return;
  }
  // Record this melee attacker on the target for the Explosive Trap deathwish (only non-ranged
  // attackers count as melee — ranged shots don't trigger the trap).
  if (attacker && !attacker.ranged) {
    if (!target.meleeAttackersThisTurn) target.meleeAttackersThisTurn = [];
    if (!target.meleeAttackersThisTurn.includes(attacker.instId)) target.meleeAttackersThisTurn.push(attacker.instId);
  }
  target.durability -= dmg;
  logEntry(`    ${attackerLabel} → ${target.name} (${targetSide} ${pos}) for ${dmg}.`, "combat-detail");
  emitOutcome("damage", { targetInstId: target.instId, targetName: target.name, targetSide, loc, pos, amount: dmg, source: attackerLabel });
  onCreatureTookDamage(target, targetSide, loc, dmg);
  if (target.durability <= 0) {
    logEntry(`      ${target.name} is destroyed.`, "combat-detail");
    // Gameplay order (per MtG-style state-based-actions): card leaves the battlefield BEFORE
    // its leave-play triggers resolve. That means the slot is empty when deathwish runs, so
    // deathwishes that spawn into the front row can use the dying card's slot.
    //
    // Animation order: the UI plays death (in slot via FLIP-hold) → deathwish-trigger →
    // deathwish effects (summon, damage, etc.) → leave-play (slide to graveyard pile). The
    // dying card visually overlays anything that takes its slot until the slide completes,
    // then disappears. This is brief and reads as "the dying creature collapses into the
    // graveyard, revealing what it left behind."
    emitOutcome("death", { instId: target.instId, name: target.name, side: targetSide, loc, pos, isToken: !!target.isToken });
    lc.creatures[pos] = null;
    fireLeavePlayTriggers(target, targetSide, loc, pos);
    detachAllEquipmentFromHost(target, targetSide, loc);
    emitOutcome("leave-play", { instId: target.instId, name: target.name, side: targetSide, loc, pos });
    sendToPile(target, targetSide, "graveyard");
  }
}

export function resolveAttack(side, loc, pos, attacker) {
  // Front-row attackers always allowed. Back-row attackers must be ranged.
  const isBack = pos === "bl" || pos === "br";
  if (isBack && !attacker.ranged) return;

  const enemySide = other(side);
  const enemyLoc = L(enemySide, loc);
  // Map attacker column to enemy front/back the way front-row attacks already do.
  // fl/bl on player's side aligns with enemy's fl front-row column; fr/br with enemy's fr.
  const column = (pos === "fl" || pos === "bl") ? "fl" : "fr";
  const enemyFront = column;
  const enemyBack = column === "fl" ? "bl" : "br";

  // Main target: front first, falling through to back if front is empty.
  const targetPos = enemyLoc.creatures[enemyFront] ? enemyFront : (enemyLoc.creatures[enemyBack] ? enemyBack : null);
  const dmg = effectiveStat(attacker, side, loc, "force");
  const label = `${attacker.name} (${pos})`;

  if (targetPos) {
    applyCombatDamage(enemySide, loc, targetPos, dmg, label, attacker);
  } else {
    const landed = damageSummoner(enemySide, dmg, label, loc);
    if (landed) fireSpiteThorns(enemySide, loc, attacker, label);
  }

  // Attack-pattern extras (cleave, pierce). attackPatterns is an array of { type, value? }.
  const patterns = attacker.attackPatterns || [];
  for (const p of patterns) {
    if (p.type === "cleave") {
      // Cleave hits the *adjacent same-row slots* of the main target's location on the same
      // side as the main target. On a 2-column grid, that's the *other* front-row slot
      // (cleave fires from a front-row attacker → hits across-front; the cleave adjacency is
      // the same-row other column on the enemy side, i.e., the slot next to the main target).
      if (!targetPos) continue;  // no target hit, cleave has nothing adjacent
      const adjacent = targetPos === "fl" ? "fr" : (targetPos === "fr" ? "fl" : (targetPos === "bl" ? "br" : "bl"));
      if (enemyLoc.creatures[adjacent]) {
        applyCombatDamage(enemySide, loc, adjacent, dmg, `${label} (cleave)`, attacker);
      }
    } else if (p.type === "pierce") {
      // Pierce X: deal X damage to the slot directly behind the main target's column on the
      // enemy side. If the main target was already in the back row (front was empty), pierce
      // has nothing further to pierce — fizzle the pierce portion.
      const pierceVal = p.value || 1;
      if (!targetPos) {
        // Front + back both empty → main damage already hit summoner. Pierce also hits summoner.
        const landed = damageSummoner(enemySide, pierceVal, `${label} (pierce ${pierceVal})`, loc);
        if (landed) fireSpiteThorns(enemySide, loc, attacker, `${label} (pierce ${pierceVal})`);
      } else if (targetPos === "fl" || targetPos === "fr") {
        const backPos = targetPos === "fl" ? "bl" : "br";
        if (enemyLoc.creatures[backPos]) {
          applyCombatDamage(enemySide, loc, backPos, pierceVal, `${label} (pierce ${pierceVal})`, attacker);
        } else {
          // No back-row creature → pierce falls through to summoner.
          const landed = damageSummoner(enemySide, pierceVal, `${label} (pierce ${pierceVal})`, loc);
          if (landed) fireSpiteThorns(enemySide, loc, attacker, `${label} (pierce ${pierceVal})`);
        }
      }
      // If main target was a back-row creature (front was empty), pierce doesn't go further.
    }
  }
}
