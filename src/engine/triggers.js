import { state, L, createCard } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES, LOC_TEXT_KEYS } from "./config.js";
import { logEntry } from "./log.js";
import { other } from "./stats.js";
import { LOCATION_TEXTS } from "./location-texts.js";
import { spawnTokenAt } from "./tokens.js";
import { grantUntilEndOfTurn, runRecruitConversion, dealDamageAtLoc, dropExplosiveTrap, sendToPile } from "./marks.js";
import { emitFutureChip, emitOutcome } from "./timeline.js";

// ---------- Flip-up trigger dispatcher ----------
// Called from endOfPhaseRevealAndResolve when a face-down creature/structure flips face-up.
// The card may print an `onFlipUp` effect key — looked up by string and executed here. Flip-up
// triggers fire after the card transitions revealed=false → revealed=true, so the card itself is
// face-up and on the board for the trigger.
//
// Per the unified face-down rule, flip-up triggers fire EVERY time a card transitions face-down to
// face-up — not just the first time. Stealth-and-re-flip combos rely on this.
export function fireFlipUpTrigger(side, loc, card) {
  // Location-text onFlipUp runs first — it sees the freshly-flipped card and can adjust state
  // (e.g., Ogre Hideaway puts ogres to sleep) before the card's own flip-up trigger fires.
  const locKey = LOC_TEXT_KEYS[loc];
  if (locKey && LOCATION_TEXTS[locKey] && typeof LOCATION_TEXTS[locKey].onFlipUp === "function") {
    LOCATION_TEXTS[locKey].onFlipUp(loc, side, card);
  }
  const effect = card.onFlipUp;
  if (!effect) return;
  // Emit a generic trigger outcome so the UI animation layer can shake the card AFTER the flip
  // settles. Specific effects also emit their own outcomes (summon/damage/etc) which the UI plays
  // alongside this shake — they don't conflict because the targets are different elements.
  emitOutcome("trigger", { instId: card.instId, name: card.name, side, loc, kind: "flipUp" });
  if (effect === "spawnSandbag") {
    // Combat Engineer: create a Sandbag token at an empty front-row slot here.
    const result = spawnTokenAt(side, loc, "sandbag", ["fl", "fr"]);
    if (result) {
      logEntry(`  ${card.name} drops a Sandbag at ${LOC_NAMES[loc]} ${result.pos}.`, "combat-detail");
    } else {
      logEntry(`  ${card.name} can't drop a Sandbag — front row full.`, "combat-detail");
    }
  } else if (effect === "buffFriendlyForceHere") {
    // Herald (engine demo): a friendly creature here gains +1 Force until end of turn.
    // Per Pillar 10 (no resolve-time targeting), pick from the legal random pool. The pool is
    // friendly face-up creatures here, EXCLUDING self. If self is the only candidate, the buff
    // lands on self.
    const lc = L(side, loc);
    const candidates = ["fl","fr","bl","br"]
      .map(pos => ({ pos, c: lc.creatures[pos] }))
      .filter(x => x.c && x.c.revealed !== false && x.c !== card);
    if (candidates.length === 0) {
      // Self-only target.
      grantUntilEndOfTurn(card, "force", 1);
      logEntry(`  ${card.name} buffs itself +1 Force (no other friendly here).`, "combat-detail");
    } else {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      grantUntilEndOfTurn(pick.c, "force", 1);
      logEntry(`  ${card.name} grants +1 Force to ${pick.c.name} (${side} ${LOC_NAMES[loc]} ${pick.pos}) until end of turn.`, "combat-detail");
    }
  } else if (effect === "damage1Here") {
    // Sapper (engine demo): deal 1 damage here. Per universal damage rule: hits a face-up creature
    // here at random (non-neutral preferred for player-cast effects? actually no — damage hits any
    // creature including neutral ones since they're targetable per design). Falls through to
    // opposing summoner if no valid target.
    dealDamageAtLoc(side, loc, 1, card.name, ` (flip-up)`);
  } else if (effect === "loneChampionBrawler") {
    // R1 Goblin Brawler: if this is the only creature on your side here, gain +1 Force.
    // Default-duration buff (lasts as long as this card is in play). One-time check at flip-up;
    // doesn't recheck if conditions change.
    const lc = L(side, loc);
    let othersHere = 0;
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.creatures[pos];
      if (c && c !== card) othersHere++;
    }
    if (othersHere === 0) {
      card.force = (card.force || 0) + 1;
      logEntry(`  ${card.name} is alone here — gains +1 Force.`, "combat-detail");
    } else {
      logEntry(`  ${card.name} not alone (${othersHere} other${othersHere === 1 ? "" : "s"} here) — no bonus.`, "combat-detail");
    }
  } else if (effect === "bruiserChargeBuff") {
    // R3 Orc Bruiser: gains +1 Force this turn (always fires; no conditional).
    grantUntilEndOfTurn(card, "force", 1);
    logEntry(`  ${card.name} charges in — +1 Force this turn.`, "combat-detail");
  } else if (effect === "recruiterAloneRecruit") {
    // R6 Goblin Recruiter: if this is the only creature on your side here, fire Recruit.
    const lc = L(side, loc);
    let othersHere = 0;
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.creatures[pos];
      if (c && c !== card) othersHere++;
    }
    if (othersHere === 0) {
      logEntry(`  ${card.name} is alone — attempting Recruit.`, "combat-detail");
      runRecruitConversion(side, loc, card.name);
    } else {
      logEntry(`  ${card.name} not alone (${othersHere} other${othersHere === 1 ? "" : "s"} here) — Recruit gated off.`, "combat-detail");
    }
  } else if (effect === "bullyPush") {
    // RR1 Goblin Bully: push the creature across from this Bully (same column, other side, front
    // row) from front to back. Push fizzles if Bully isn't in the front row (no across slot to
    // push from), if the across slot is empty, or if the back-row destination is occupied.
    // Find Bully's position on its side.
    const lc = L(side, loc);
    let bullyPos = null;
    for (const pos of ["fl","fr","bl","br"]) {
      if (lc.creatures[pos] === card) { bullyPos = pos; break; }
    }
    if (bullyPos !== "fl" && bullyPos !== "fr") {
      logEntry(`  ${card.name} not in front — push fizzles.`, "combat-detail");
    } else {
      const otherSide = other(side);
      const otherLoc = L(otherSide, loc);
      const target = otherLoc.creatures[bullyPos];      // creature across from Bully
      const destPos = bullyPos === "fl" ? "bl" : "br";  // same column, back row
      if (!target) {
        logEntry(`  ${card.name} — no creature across from ${bullyPos} on the other side. Push fizzles.`, "combat-detail");
      } else if (otherLoc.creatures[destPos]) {
        logEntry(`  ${card.name} — back-row ${destPos} on the other side is occupied. Push fizzles.`, "combat-detail");
      } else {
        otherLoc.creatures[bullyPos] = null;
        otherLoc.creatures[destPos] = target;
        logEntry(`  ${card.name} pushes ${target.name} (${otherSide}) from ${bullyPos} to ${destPos}.`, "combat-detail");
      }
    }
  } else if (effect === "stealthRowAdjacentFriendlies") {
    // g5 Rebel Outrider: re-stealth friendly creatures in the same row on this side. They go
    // face-down and will re-flip at end of current phase via the unified rule, firing flip-up
    // triggers a second time.
    const lc = L(side, loc);
    let selfPos = null;
    for (const pos of ["fl","fr","bl","br"]) {
      if (lc.creatures[pos] === card) { selfPos = pos; break; }
    }
    if (!selfPos) return;
    const sameRowAdjacent = { fl: ["fr"], fr: ["fl"], bl: ["br"], br: ["bl"] }[selfPos] || [];
    let stealthed = 0;
    for (const p of sameRowAdjacent) {
      const target = lc.creatures[p];
      if (!target) continue;
      if (target.revealed === false) continue;  // already face-down — no effect
      stealth(target);
      logEntry(`  ${card.name} stealths ${target.name} (${side} ${p}).`, "combat-detail");
      stealthed++;
    }
    if (stealthed === 0) logEntry(`  ${card.name}: no same-row friendlies to stealth.`, "combat-detail");
  } else if (effect === "sendFriendlyAway") {
    // g7 Rebel Runner: move a friendly creature here to another location. Pillar 10 random pick
    // from candidates (friendlies at this location, excluding self) and from destinations.
    const lc = L(side, loc);
    const candidates = [];
    for (const p of ["fl","fr","bl","br"]) {
      const c = lc.creatures[p];
      if (!c || c === card) continue;
      if (c.revealed === false) continue;
      candidates.push({ pos: p, c });
    }
    if (candidates.length === 0) {
      logEntry(`  ${card.name}: no other friendly creature here to send.`, "combat-detail");
      return;
    }
    const dests = [];
    for (let l2 = 0; l2 < LOCATION_COUNT; l2++) {
      if (l2 === loc) continue;
      const lc2 = L(side, l2);
      for (const p of ["fl","fr","bl","br"]) {
        if (!lc2.creatures[p]) dests.push({ loc: l2, pos: p });
      }
    }
    if (dests.length === 0) {
      logEntry(`  ${card.name}: no empty destination slot at other locations — fizzles.`, "combat-detail");
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const dest = dests[Math.floor(Math.random() * dests.length)];
    lc.creatures[pick.pos] = null;
    L(side, dest.loc).creatures[dest.pos] = pick.c;
    logEntry(`  ${card.name} sends ${pick.c.name} from ${LOC_NAMES[loc]} ${pick.pos} → ${LOC_NAMES[dest.loc]} ${dest.pos}.`, "combat-detail");
  } else if (effect === "dropTrapOpposingFront") {
    // g8 Rebel Saboteur: plant an Explosive Trap on the opposing side's front row at this location.
    dropExplosiveTrap(other(side), loc);
  } else if (effect === "keeperFlame") {
    keeperSummon(card, side, loc, "b_fire_golem", "b_pyroblast");
  } else if (effect === "keeperFont") {
    keeperSummon(card, side, loc, "b_water_golem", "b_blizzard");
  } else if (effect === "echoFromPast") {
    // b10 Magus of Echoes: add a token copy of a random action from The Past to your discard.
    // The Past is shared (both sides); the Magus can copy your own actions or the opponent's.
    const pool = (state.past || []).filter(p => p);
    if (pool.length === 0) {
      logEntry(`  ${card.name}: The Past is empty — nothing to echo.`, "combat-detail");
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const copy = createCard(pick.defKey, side);
    copy.isToken = true;
    copy.revealed = true;
    state.sides[side].discard.push(copy);
    logEntry(`  ${card.name}: echoes ${pick.name} (from turn ${pick.turn}) → ${side} discard.`, "combat-detail");
  }
}

// Keeper flip-up shape: summon a token creature in the slot directly in front of the keeper
// (same column, front row). If that slot is occupied, the entire flip-up fizzles — no creature
// summoned AND no action token added. Otherwise: creature placed, action token added to discard.
export function keeperSummon(keeperCard, side, loc, golemKey, actionKey) {
  const lc = L(side, loc);
  let keeperPos = null;
  for (const p of ["fl","fr","bl","br"]) {
    if (lc.creatures[p] === keeperCard) { keeperPos = p; break; }
  }
  if (!keeperPos) return;
  // "In front of this" = same column, front row. fl/bl → fl. fr/br → fr.
  const column = (keeperPos === "fl" || keeperPos === "bl") ? "fl" : "fr";
  const frontSlot = column;
  if (lc.creatures[frontSlot]) {
    logEntry(`  ${keeperCard.name}: slot ${frontSlot} occupied — fizzles.`, "combat-detail");
    return;
  }
  // Summon the golem token.
  const golem = createCard(golemKey, side);
  golem.isToken = true;
  golem.revealed = true;
  lc.creatures[frontSlot] = golem;
  logEntry(`  ${keeperCard.name}: summons ${golem.name} at ${LOC_NAMES[loc]} ${frontSlot}.`, "combat-detail");
  // Tokens entering face-up resolve at their summon moment — emit a chip already in resolved state.
  const golemChip = emitFutureChip(golem, side, loc, frontSlot, golem.tempo || 0);
  golemChip.state = "resolved";
  golemChip.faceUp = true;
  golemChip.resolvedTurn = state.turn;
  emitOutcome("summon", { instId: golem.instId, name: golem.name, side, loc, pos: frontSlot });
  // Add the action token to discard.
  const actionToken = createCard(actionKey, side);
  actionToken.isToken = true;
  actionToken.revealed = true;
  state.sides[side].discard.push(actionToken);
  logEntry(`  ${keeperCard.name}: adds ${actionToken.name} token to discard.`, "combat-detail");
  // Direct-to-discard action token: no timeline chip (never passes through play).
  emitOutcome("token-to-discard", { instId: actionToken.instId, name: actionToken.name, side });
}

// Stealth: flip a face-up card face-down. Per the unified face-down rule, the card becomes
// inert (no stats, no combat, not targetable, triggers dormant) until it flips up again at the
// next end-of-phase reveal. Clears flippedThisTurn so the re-flip will set it again. Does NOT
// detach equipment or wake sleepers — only changes revealed state.
export function stealth(card) {
  if (!card || card.revealed === false) return;
  card.revealed = false;
  card.flippedThisTurn = false;
}

// Spellbook (b9): when an opposing action flips at the equipped creature's location, every
// Spellbook on the OTHER side at this location loses 1 page and copies the action into its
// owner's discard. At 0 pages, the Spellbook is destroyed (junkyard).
export function triggerSpellbooksOnActionFlip(actionCard, actionSide, loc) {
  const bookSide = other(actionSide);
  const lc = L(bookSide, loc);
  // Walk every creature's equipment looking for spellbooks.
  for (const pos of ["fl","fr","bl","br"]) {
    const host = lc.creatures[pos];
    if (!host || !host.equipment || host.equipment.length === 0) continue;
    for (let i = host.equipment.length - 1; i >= 0; i--) {
      const eq = host.equipment[i];
      if (eq.defKey !== "b9" || eq.revealed === false) continue;
      // Lose a page.
      eq.spellbookPages = (eq.spellbookPages || 0) - 1;
      // Copy the action to the spellbook side's discard.
      const copy = createCard(actionCard.defKey, bookSide);
      copy.isToken = true;
      copy.revealed = true;
      state.sides[bookSide].discard.push(copy);
      // The spellbook (or its host) telegraphs the trigger via a shake.
      emitOutcome("trigger", { instId: host.instId, name: host.name, side: bookSide, loc, kind: "spellbook" });
      logEntry(`  Spellbook (${bookSide} ${LOC_NAMES[loc]} ${pos}): copies ${actionCard.name} to discard. Pages left: ${eq.spellbookPages}.`, "combat-detail");
      if (eq.spellbookPages <= 0) {
        // Destroy the spellbook — junkyard.
        host.equipment.splice(i, 1);
        // Equipment leaves play: pile via sendToPile (handles reroute marks too).
        sendToPile(eq, bookSide, "junkyard");
        logEntry(`    Spellbook destroyed — to ${bookSide} junkyard.`, "combat-detail");
      }
    }
  }
}
