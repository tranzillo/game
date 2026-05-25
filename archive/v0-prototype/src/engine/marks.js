import { state, L, createCard, summonerPresent } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES, LOC_TEXT_KEYS } from "./config.js";
import { logEntry } from "./log.js";
import { committedStatTotal, other } from "./stats.js";
import { LOCATION_TEXTS } from "./location-texts.js";
import { emitFutureChip, emitOutcome } from "./timeline.js";
import { createQuestToken } from "./quests.js";
import { damageSummoner, applyCombatDamage } from "./combat.js";

// Grant a temporary "until end of turn" stat buff to a card. The buff is applied to the in-play
// instance only and does not persist into the run deck (unlike Forge's permanent +1 Force).
// Tracked via state.endOfTurnReverts so cleanup can revert.
//
// Inert keyword (per DESIGN.md): cards with `inert: true` cannot gain Force/Tempo/Insight/Resolve
// from any source. Buffs to those stats no-op. Durability is not on the no-grow list — Inert cards
// can be healed/repaired.
export function grantUntilEndOfTurn(card, stat, amount) {
  if (card.inert && ["force","tempo","insight","resolve"].includes(stat)) {
    // Inert blocks the buff entirely. Don't track for revert.
    return;
  }
  card[stat] = (card[stat] || 0) + amount;
  if (!state.endOfTurnReverts) state.endOfTurnReverts = [];
  state.endOfTurnReverts.push({ card, stat, amount });
}

// ---------- Marks system ----------
// A mark is per-instance permanent state. Each mark = { kind, side }. Marks persist through
// pile cycling and across encounters. Same-kind double mark on a card destroys it (exile).
//
// Mark kinds:
//   - "reroute" (Green): on leave-play, destination redirects to the marker's same-zone pile.
//   - "convert" (White): switches sides when overhealed by Force value+. Not implemented.
//   - "damage"  (Red):   +1 damage from any damage source on this card. Not implemented.
//
// applyMark: place a mark on a card from a side. If a same-kind mark already exists, the card
// is destroyed (exiled). Returns true if the mark applied normally, false if double-mark exile.
export function applyMark(card, kind, side) {
  if (!card.marks) card.marks = [];
  const existing = card.marks.find(m => m.kind === kind);
  if (existing) {
    // Same-kind double mark — card tears in half. Exile from the run entirely.
    logEntry(`  ${card.name} torn in half — same-kind double mark (${kind}). Exiled.`, "combat-detail");
    emitOutcome("mark-tear", { instId: card.instId, name: card.name, kind });
    exileFromPlay(card);
    // Same-kind exile is permanent: remove the entry from the run-deck so it can't return.
    if (card.runDeckEntry) {
      const idx = state.runDeck.indexOf(card.runDeckEntry);
      if (idx !== -1) state.runDeck.splice(idx, 1);
    }
    return false;
  }
  card.marks.push({ kind, side });
  // Mirror the mark into the run-deck entry's mods so it persists across encounters.
  if (card.runDeckEntry) {
    if (!card.runDeckEntry.mods) card.runDeckEntry.mods = {};
    if (!card.runDeckEntry.mods.marks) card.runDeckEntry.mods.marks = [];
    card.runDeckEntry.mods.marks.push({ kind, side });
  }
  logEntry(`  ${card.name}: marked for ${kind} (by ${side}).`, "combat-detail");
  emitOutcome("mark-applied", { instId: card.instId, name: card.name, kind, side });
  return true;
}

// Exile a card from play immediately, regardless of zone. Used by same-kind double-mark.
// Removes the card from whatever slot it's in, detaches equipment, places in exile under its
// current side.
export function exileFromPlay(card) {
  for (const side of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(side, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        if (lc.creatures[pos] === card) {
          detachAllEquipmentFromHost(card, side, loc);
          lc.creatures[pos] = null;
          state.sides[side].exile.push(card);
          return;
        }
      }
      if (lc.structure === card) {
        detachAllEquipmentFromHost(card, side, loc);
        lc.structure = null;
        state.sides[side].exile.push(card);
        return;
      }
      if (lc.action === card) {
        lc.action = null;
        state.sides[side].exile.push(card);
        return;
      }
    }
  }
}

// Central leave-play pile routing. Tokens always exile (regardless of marks). Otherwise check
// the card's marks for "reroute" — if present, the destination side becomes the marker's side.
// Rerouted-to-player marks the card `acquired = true` so it joins runDeck at encounter end.
// Triggers fire BEFORE this is called (per design: leave-play triggers from original side, then
// destination modifies).
//
// `loc` (optional): the location the card is leaving from. When the destination side has no
// summoner present at this encounter, the card routes to the LOCATION pile at `loc` rather than
// the side root pile — bodies stay where they fell. When no `loc` is supplied (e.g., action exits,
// equipment fizzles), routing always goes to the side root pile (summoner-driven dispositions).
export function sendToPile(card, intendedSide, zone, loc) {
  if (card.isToken) { state.sides[intendedSide].exile.push(card); return; }
  const reroute = card.marks ? card.marks.find(m => m.kind === "reroute") : null;
  let destSide = intendedSide;
  if (reroute && reroute.side !== intendedSide) {
    destSide = reroute.side;
    if (destSide === "player") card.acquired = true;
    logEntry(`  ${card.name}: rerouted to ${destSide}'s ${zone}.`, "combat-detail");
  }
  if (loc != null && !summonerPresent(destSide)) {
    // The pile belongs to the LOCATION, not to a side. We canonically store it on the AI-side's
    // location object (the side neutral cards spatially occupy) so the renderer has one place to
    // read from.
    L("ai", loc).piles[zone].push(card);
    return;
  }
  state.sides[destSide][zone].push(card);
}

// Generic leave-play trigger dispatch. Fires Deathwish and any future leave-play effects.
// Called BEFORE sendToPile so triggers see the original side/position and fire from there
// (per design: triggers fire first, destination modifies after).
// pos is optional — if provided, recorded on the card as lastPos for position-dependent effects.
export function fireLeavePlayTriggers(card, side, loc, pos) {
  if (pos !== undefined) card.lastPos = pos;
  if (card.deathwish) fireDeathwish(card, side, loc);
}

// Dispatcher for Deathwish effect tags. Each tag is a behavior key. New effects add cases here.
export function fireDeathwish(card, side, loc) {
  const effect = card.deathwish;
  if (!effect) return;
  // Signal the UI that this card's deathwish is firing — the scene queue plays a pulse on the
  // dying card so the player sees which card just triggered, BEFORE the deathwish effects (summon,
  // damage, etc.) play their own animations. The dying card is still visible at its slot via the
  // FLIP-on-death hold.
  emitOutcome("deathwish-trigger", { instId: card.instId, name: card.name, side, loc, effect });
  logEntry(`  ${card.name} (${side} ${LOC_NAMES[loc] || ""}) — Deathwish: ${effect}.`, "combat-detail");
  if (effect === "dropQuest_badIntel") {
    // Drop a Bad Intel quest token into this side's action slot at this location. If the slot
    // is occupied, the new quest fizzles (no slot to occupy → ripped up immediately).
    const lc = L(side, loc);
    if (lc.action) {
      logEntry(`    Action slot occupied at ${LOC_NAMES[loc]} — Bad Intel quest fizzles.`, "combat-detail");
      return;
    }
    const token = createQuestToken("badIntel", side);
    token.revealed = true;  // Tokens enter face-up per the token rule.
    lc.action = token;
    logEntry(`    Bad Intel quest token enters at ${side} @${LOC_NAMES[loc]}.`, "combat-detail");
    const qChip = emitFutureChip(token, side, loc, "action", committedStatTotal(side, loc, "tempo"));
    qChip.state = "resolved";
    qChip.faceUp = true;
    qChip.resolvedTurn = state.turn;
    emitOutcome("summon", { instId: token.instId, name: token.name, side, loc, pos: "action" });
  } else if (effect === "moveFriendlyHere") {
    // g1 Rebel Scout: move one of your creatures from another location to this slot. By the time
    // deathwish fires, the dying card has been removed from its slot, so the slot at (side, loc)
    // is empty. Random pick from legal candidates (creatures on the same side at a different loc).
    const lc = L(side, loc);
    const candidates = [];
    for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
      if (l2 === loc) continue;
      const otherLoc = L(side, l2);
      for (const p of ["fl","fr","bl","br"]) {
        const c = otherLoc.creatures[p];
        if (c && c.revealed !== false) candidates.push({ loc: l2, pos: p, c });
      }
    }
    if (candidates.length === 0) {
      logEntry(`    No friendly creature at another location — fizzles.`, "combat-detail");
      return;
    }
    // Find an empty slot at this location to land in. Pillar 10 random pick among empties.
    const empties = ["fl","fr","bl","br"].filter(p => !lc.creatures[p]);
    if (empties.length === 0) {
      logEntry(`    No empty slot at ${LOC_NAMES[loc]} — fizzles.`, "combat-detail");
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const destPos = empties[Math.floor(Math.random() * empties.length)];
    L(side, pick.loc).creatures[pick.pos] = null;
    lc.creatures[destPos] = pick.c;
    logEntry(`    ${pick.c.name} moves from ${LOC_NAMES[pick.loc]} ${pick.pos} → ${LOC_NAMES[loc]} ${destPos}.`, "combat-detail");
  } else if (effect === "dropTrapFront") {
    // g3 Rebel Skirmisher: drop an Explosive Trap token in your front row at this location.
    dropExplosiveTrap(side, loc);
  } else if (effect === "explosiveTrap") {
    // The Trap's own deathwish: damage same-side adjacent creatures + creatures that hit this
    // with melee damage this turn. "Adjacent" = same-side only (same row other column + same
    // column back row).
    explosiveTrapDeathwish(card, side, loc);
  }
}

// Drop an Explosive Trap token into a side's front row at a location. Pillar 10 random empty
// slot pick; fizzles if both front slots are occupied. Returns the placed token or null.
export function dropExplosiveTrap(side, loc) {
  const lc = L(side, loc);
  const empties = ["fl","fr"].filter(p => !lc.creatures[p]);
  if (empties.length === 0) {
    logEntry(`    Explosive Trap: front row full on ${side} ${LOC_NAMES[loc]} — fizzles.`, "combat-detail");
    return null;
  }
  const destPos = empties[Math.floor(Math.random() * empties.length)];
  const trap = createCard("g_trap", side);
  trap.isToken = true;
  trap.revealed = true;  // Tokens enter face-up.
  lc.creatures[destPos] = trap;
  logEntry(`    Explosive Trap drops at ${side} ${LOC_NAMES[loc]} ${destPos}.`, "combat-detail");
  // Token enters face-up — emit a resolved-state chip and an outcome.
  const trapChip = emitFutureChip(trap, side, loc, destPos, trap.tempo || 0);
  trapChip.state = "resolved";
  trapChip.faceUp = true;
  trapChip.resolvedTurn = state.turn;
  emitOutcome("summon", { instId: trap.instId, name: trap.name, side, loc, pos: destPos });
  return trap;
}

// Trap's deathwish resolution: damage same-side adjacents + any creature that dealt melee damage
// to this trap on this turn (tracked via card.meleeAttackersThisTurn).
export function explosiveTrapDeathwish(trap, side, loc) {
  // Adjacency map: same-side, geographic neighbors. The trap's position when it dies is unknown
  // here (already removed from slot), so check meleeAttackersThisTurn and scan same-side slots
  // adjacent to where it WAS. We need the position to compute adjacency — store it on the trap
  // when placed and at every position change.
  // For now: damage every same-side creature touching its last-known position.
  const lc = L(side, loc);
  const ADJACENT = { fl: ["fr","bl"], fr: ["fl","br"], bl: ["fl","br"], br: ["fr","bl"] };
  const adjacents = ADJACENT[trap.lastPos || "fl"] || [];
  const hits = [];
  for (const p of adjacents) {
    const target = lc.creatures[p];
    if (target) hits.push({ target, where: { side, loc, pos: p } });
  }
  // Add melee attackers from this turn (other side of board, by definition — melee comes from
  // enemy creatures). They may still be alive or already destroyed/moved.
  const attackerIds = trap.meleeAttackersThisTurn || [];
  for (const id of attackerIds) {
    // Find this attacker on the board by instId.
    for (const s2 of ["player","ai"]) {
      for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
        const lc2 = L(s2, l2);
        for (const p of ["fl","fr","bl","br"]) {
          const c = lc2.creatures[p];
          if (c && c.instId === id) {
            // Avoid double-hit if the attacker was also a same-side adjacent (won't happen across
            // sides, but defensive).
            if (!hits.some(h => h.target === c)) hits.push({ target: c, where: { side: s2, loc: l2, pos: p } });
          }
        }
      }
    }
  }
  if (hits.length === 0) {
    logEntry(`    Explosive Trap: no targets in range.`, "combat-detail");
    return;
  }
  for (const h of hits) {
    applyCombatDamage(h.where.side, h.where.loc, h.where.pos, 2, `Explosive Trap`);
  }
}

// Attach an equipment card to a host (creature or structure). Equipment's granted attack
// patterns are appended to the host's. Equipment is stored in host.equipment for tracking.
// When the host leaves play, equipment goes to the host-side's junkyard via detachAllEquipment.
// Hard rule: one equipment per host. Returns true on success, false if the cap blocks the attach.
export const EQUIPMENT_CAP_PER_HOST = 1;
export function attachEquipmentToHost(equipment, host, hostSide) {
  if (!host.equipment) host.equipment = [];
  if (host.equipment.length >= EQUIPMENT_CAP_PER_HOST) return false;
  host.equipment.push(equipment);
  equipment.attachedTo = host.instId;
  equipment.attachedSide = hostSide;
  // Equipment landing on a player-side host is acquired — joins the run-deck at encounter end.
  // Caught here so any path that attaches (pre-place, location-text rewire, future play-from-hand)
  // marks acquisition consistently.
  if (hostSide === "player") equipment.acquired = true;
  if (equipment.grantsAttackPatterns) {
    for (const p of equipment.grantsAttackPatterns) {
      host.attackPatterns.push({ ...p });
    }
  }
  return true;
}

// Detach all equipment from a host that's leaving play. Each equipment goes to the side's
// junkyard. (Magnetic override: returns to your-side's junkyard regardless. Not implemented for
// slice — equipment in slice is single-side only.)
//
// Fires the location-text `onEquipmentLeavesPlay(loc, equipment, hostSide)` hook for each piece of
// equipment, BEFORE pushing to the junkyard. Location text can intercept (e.g., Goblin Armaments
// attaches the equipment to a goblin instead of letting it go to the junkyard).
export function detachAllEquipmentFromHost(host, hostSide, loc) {
  if (!host.equipment || host.equipment.length === 0) return;
  const equipment = host.equipment;
  host.equipment = [];
  for (const eq of equipment) {
    // Fire location-text hook for this equipment leaving play at this location. Hook may
    // re-attach the equipment to a different host instead of going to junkyard. If the hook
    // returns truthy ("handled"), skip the default junkyard push.
    let handled = false;
    if (loc != null) {
      const key = LOC_TEXT_KEYS[loc];
      if (key && LOCATION_TEXTS[key] && typeof LOCATION_TEXTS[key].onEquipmentLeavesPlay === "function") {
        handled = LOCATION_TEXTS[key].onEquipmentLeavesPlay(loc, eq, hostSide);
      }
    }
    if (!handled) {
      logEntry(`    ${eq.name} (equipment on ${host.name}) → ${hostSide} junkyard.`, "combat-detail");
      sendToPile(eq, hostSide, "junkyard");
    }
  }
}

// Called when a creature takes damage from any source (combat, action, Battle Driver, etc.).
// Fires per-damage-instance triggers like Enraged. `amount` is the damage instance size.
export function onCreatureTookDamage(card, side, loc, amount) {
  if (!card || amount <= 0) return;
  // Damage wakes a sleeper. The wake-in-phase flag gates awake-actions (attack, move) for the
  // remainder of the current phase. Self-clears by phase comparison — no explicit reset needed.
  if (card.sleepCounter > 0) {
    card.sleepCounter = 0;
    card.wokeInPhase = state.phase;
    logEntry(`  ${card.name} wakes up from damage (groggy this ${state.phase} phase).`, "combat-detail");
  }
  if (card.enraged) {
    grantUntilEndOfTurn(card, "force", 1);
    logEntry(`  ${card.name} is Enraged — gains +1 Force this turn.`, "combat-detail");
  }
}

// Sacrifice a creature on a side at a location. Sends the creature directly to the graveyard
// (death event — leave-play triggers fire normally). Returns the sacrificed card, or null if no
// creature matched the filter. `filterFn(card)` is optional — returns true for legal sacrifice
// targets. If multiple candidates, picks one at random (Pillar 10).
export function sacrificeCreatureOnSide(side, loc, filterFn, sourceName) {
  const lc = L(side, loc);
  const candidates = [];
  for (const pos of ["fl","fr","bl","br"]) {
    const c = lc.creatures[pos];
    if (!c) continue;
    if (c.revealed === false) continue;  // face-down cards are not legal targets
    if (filterFn && !filterFn(c)) continue;
    candidates.push({ pos, c });
  }
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const reason = candidates.length === 1 ? "[only legal target]" : `[random pick from ${candidates.length}]`;
  logEntry(`  ${sourceName} sacrifices ${pick.c.name} (${side} ${pick.pos}). ${reason}`, "combat-detail");
  // Sacrifice is sync (no damage→checkpoint pattern — there's no intermediate state to show).
  // We still emit death + leave-play events for visual continuity.
  const pos = pick.pos;
  emitOutcome("death", { instId: pick.c.instId, name: pick.c.name, side, loc, pos, killerInstId: null, isToken: !!pick.c.isToken });
  lc.creatures[pos] = null;
  fireLeavePlayTriggers(pick.c, side, loc, pos);
  detachAllEquipmentFromHost(pick.c, side, loc);
  emitOutcome("leave-play", { instId: pick.c.instId, name: pick.c.name, side, loc, pos, toPile: "graveyard" });
  sendToPile(pick.c, side, "graveyard");
  return pick.c;
}

// Run the Recruit conversion verb at a location for a side. Used by the Recruit action card and
// by Goblin Recruiter's alone-conditional flip-up. Force-superiority check: front-row Force on
// caster's side > front-row Force on the other side. If yes, pick a creature in the front row on
// the other side at random (Pillar 10) and move it to the caster's same-column front slot.
// Fizzles if Force not superior, no front-row creatures opposite, or destination slot occupied.
// On success, the taken creature is marked `acquired` and joins the caster's piles at encounter end.
export function runRecruitConversion(side, loc, sourceName) {
  const otherSide = other(side);
  const casterLoc = L(side, loc);
  const otherLoc = L(otherSide, loc);
  // Force at a location = front-row creatures' effective Force (per design).
  const casterFrontForce = committedStatTotal(side, loc, "force");
  const otherFrontForce = committedStatTotal(otherSide, loc, "force");
  if (casterFrontForce <= otherFrontForce) {
    logEntry(`  ${sourceName} (${side} @${LOC_NAMES[loc]}) — Force ${casterFrontForce} not greater than ${otherFrontForce}. Fizzles.`, "combat-detail");
    return false;
  }
  const candidates = [];
  for (const pos of ["fl", "fr"]) {
    const c = otherLoc.creatures[pos];
    if (!c) continue;
    if (c.revealed === false) continue;  // face-down cards are not legal targets (unified rule)
    candidates.push({ pos, c });
  }
  if (candidates.length === 0) {
    logEntry(`  ${sourceName} (${side} @${LOC_NAMES[loc]}) — no legal creatures in front on the other side. Fizzles.`, "combat-detail");
    return false;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  // Destination: any open front-row slot on the caster's side at this location. Per Pillar 10,
  // pick randomly among open front slots. Fizzles only if BOTH front slots are occupied.
  const openDests = ["fl", "fr"].filter(p => !casterLoc.creatures[p]);
  if (openDests.length === 0) {
    logEntry(`  ${sourceName} (${side} @${LOC_NAMES[loc]}) — both front slots occupied. Fizzles.`, "combat-detail");
    return false;
  }
  const destPos = openDests[Math.floor(Math.random() * openDests.length)];
  otherLoc.creatures[pick.pos] = null;
  pick.c.owner = side;
  pick.c.acquired = true;
  casterLoc.creatures[destPos] = pick.c;
  const sourceReason = candidates.length === 1 ? "[only legal target]" : `[random pick from ${candidates.length}]`;
  const destReason = openDests.length === 1 ? "" : ` [random open front slot from ${openDests.length}]`;
  logEntry(`  ${sourceName} (${side} @${LOC_NAMES[loc]}) → ${pick.c.name} moves to ${side} ${destPos}. Joins your piles at encounter end. ${sourceReason}${destReason}`, "combat-detail");
  return true;
}

// Called at end of cleanup to revert any "until end of turn" buffs.
export function revertEndOfTurnBuffs() {
  if (!state.endOfTurnReverts) return;
  for (const r of state.endOfTurnReverts) {
    r.card[r.stat] = (r.card[r.stat] || 0) - r.amount;
  }
  state.endOfTurnReverts = [];
}

export function dealDamageAtLoc(sourceSide, loc, dmg, actionName, actionLocLabel) {
  const enemySide = other(sourceSide);
  const enemyLoc = L(enemySide, loc);
  // Build candidate pool with reveal status logged. Face-down cards are inert per the unified
  // face-down rule and excluded from damage targets.
  const allSlots = ["fl", "fr", "bl", "br"]
    .map(pos => ({ pos, c: enemyLoc.creatures[pos] }))
    .filter(x => x.c);
  const targets = allSlots.filter(x => x.c.revealed !== false);
  const excluded = allSlots.filter(x => x.c.revealed === false);
  // Log the candidate pool so the random pick is auditable.
  if (allSlots.length === 0) {
    logEntry(`  ${actionName} (${sourceSide}${actionLocLabel}) targets at ${LOC_NAMES[loc]}: none (board empty).`, "combat-detail");
  } else {
    const inLabel = targets.map(x => `${x.c.name}(${x.pos})`).join(", ") || "—";
    const exLabel = excluded.length ? ` | excluded face-down: ${excluded.map(x => `${x.c.name}(${x.pos})`).join(", ")}` : "";
    logEntry(`  ${actionName} (${sourceSide}${actionLocLabel}) targets at ${LOC_NAMES[loc]}: [${inLabel}]${exLabel}`, "combat-detail");
  }
  if (targets.length === 0) {
    // Fall-through: no face-up creatures here, damage hits the opposing summoner (if any).
    damageSummoner(enemySide, dmg, `${actionName} (${sourceSide}${actionLocLabel}) [fall-through]`, loc);
    return;
  }
  const pick = targets[Math.floor(Math.random() * targets.length)];
  // Skip already-pending-death targets (defensive).
  if (pick.c.pendingLeavePile) return;
  pick.c.durability -= dmg;
  const pickReason = targets.length === 1 ? "[only legal target]" : `[random pick from ${targets.length}]`;
  logEntry(`  ${actionName} (${sourceSide}${actionLocLabel}) → ${pick.c.name} (${enemySide} ${LOC_NAMES[loc]} ${pick.pos}) for ${dmg}. ${pickReason}`, "combat-detail");
  emitOutcome("damage", { targetInstId: pick.c.instId, targetName: pick.c.name, targetSide: enemySide, loc, pos: pick.pos, amount: dmg, source: actionName });
  // Fire damage-taken triggers (Enraged etc.).
  onCreatureTookDamage(pick.c, enemySide, loc, dmg);
  if (pick.c.durability <= 0) {
    logEntry(`    ${pick.c.name} is destroyed.`, "combat-detail");
    // Deferred-death pattern: emit death + set pendingLeavePile. The orchestrator (the reveal
    // queue's drain in timeline.js) will finalize this in a follow-up beat — that's where the
    // deathwish fires and the card slides to the graveyard.
    emitOutcome("death", {
      instId: pick.c.instId,
      name: pick.c.name,
      side: enemySide,
      loc, pos: pick.pos,
      killerInstId: null,
      isToken: !!pick.c.isToken
    });
    pick.c.pendingLeavePile = "graveyard";
  }
}

