// Red card content — Phase M.1 port.
//
// Contract: REBUILD_PLAN Phase M. Each card defined here ports from
// archive/v0-prototype/src/data/cards.js as reference, but is re-implemented to match the
// locked design in DESIGN.md / DECISIONS.md / REBUILD_PLAN.md §25-§32. Cards whose mechanics
// depend on un-built primitives (Movement, Recruit, sacrifice, cleave/pierce patterns) are
// deferred to later Phase M sub-slices.
//
// Ported subset (Phase M.1):
//   r1  Goblin Brawler           — lone-champion +1F turn-buff on flip-up
//   r3  Orc Bruiser              — +1F turn-buff on flip-up
//   r5  Ogre Pit-Fighter         — pitFighterWhileAlone (+2F passive)
//   r8  Goblin Berserker         — enraged flag (+1F per damage this turn)
//   r9  Ogre Challenger          — provocationChallenger (+1F per opposing here; opposing +1F)
//   r10 Battle Driver            — action: 1 damage to a friendly creature here + that creature +1F
//   r13 Proof of the Champion    — action: a creature here gains +1F permanent, then trash this
//   r14 Warbanner                — structure: +1F PRESENCE at this location (meets Force reqs;
//                                   NOT an aura — does not buff creature stats)
//
// Deferred to Phase M.2:
//   r2 Crude Axe (needs cleave pattern)
//   r4 Recruit (needs acquisition verb primitive)
//   r6 Goblin Recruiter (needs Recruit)
//   r7 Goblin Bully (needs movement primitive)
//   r11 Goblin Pike (needs pierce pattern)
//   r12 Goblin Bombardment (needs sacrifice primitive)

import { registerCardDef } from "../engine/cards.ts";
import {
  registerFlipUpHandler,
} from "../engine/triggers.ts";
import { applyBuff } from "../engine/buffs.ts";
import { applyDamage } from "../engine/damage.ts";
import { behind, frontRowPositions } from "../engine/profile.ts";
import { opponentOf } from "../engine/sides.ts";
import {
  allCreatureTargets,
  countOccupiedCreatureSlots,
  enemyCreatureTargets,
  enemyFrontRowTargets,
  friendlyCreatureTargets,
  primaryTargetInFront,
} from "../engine/targeting.ts";
import { acquireCardTo, firstEmptyPosition } from "../engine/acquisition.ts";
import { locationStatTotal } from "../engine/location-totals.ts";
import { moveCreature } from "../engine/movement.ts";
import { sacrificeCreature } from "../engine/sacrifice.ts";
import { getCardDef } from "../engine/cards.ts";
import { queueResolutionBeat } from "../store/present-span.ts";
import { queueDeathDrain } from "../store/death-drain.ts";

let registered = false;

export function _resetRedContentFlag(): void {
  registered = false;
}

export function registerRedContent(): void {
  if (registered) return;
  registered = true;

  // ---------- Creatures ----------

  // r1 — Goblin Brawler. 1F/2D. Flip-up: if alone on your side here, +1 Force this turn.
  registerCardDef({
    defKey: "r1",
    name: "Goblin Brawler",
    type: "creature",
    tribe: "goblin",
    text: "On flip-up: if this is the only creature on your side here, +1 Force this turn.",
    costs: [],
    force: 1,
    durability: 2,
    onFlipUp: "loneChampionBrawler",
    attackPatterns: [{ kind: "default" }],
  });

  // r3 — Orc Bruiser. 2F/3D. Flip-up: +1 Force this turn.
  registerCardDef({
    defKey: "r3",
    name: "Orc Bruiser",
    type: "creature",
    tribe: "orc",
    text: "On flip-up: +1 Force this turn.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    force: 2,
    durability: 3,
    onFlipUp: "bruiserChargeBuff",
    attackPatterns: [{ kind: "default" }],
  });

  // r5 — Ogre Pit-Fighter. 1F/4D. +2 Force here while no other creature on your side is here.
  registerCardDef({
    defKey: "r5",
    name: "Ogre Pit-Fighter",
    type: "creature",
    tribe: "ogre",
    text: "+2 Force here while no other creature on your side is here.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    force: 1,
    durability: 4,
    pitFighterWhileAlone: true,
    attackPatterns: [{ kind: "default" }],
  });

  // r8 — Goblin Berserker. 1F/3D. Enraged: +1F this turn per damage taken this turn. The
  // `enraged` def flag is read by the conditional-buff system (or applied via the damage path
  // adding a turn-buff when an enraged creature takes damage).
  // For Phase M.1, the engine flag is the surface; the per-damage application is wired below
  // via a present-subscriber that watches its own swing-hits. (Simpler: a leave-play / damage
  // observer pattern. We'll implement the "increment per damage taken this turn" via
  // applyBuff each time damage lands on this card.)
  registerCardDef({
    defKey: "r8",
    name: "Goblin Berserker",
    type: "creature",
    tribe: "goblin",
    text: "Enraged: gains +1 Force this turn each time it takes damage this turn.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    force: 1,
    durability: 3,
    enraged: true,
    attackPatterns: [{ kind: "default" }],
  });

  // r6 — Goblin Recruiter. 1F/2D goblin. On flip-up: if alone on side here, fire Recruit.
  // Phase M.2c — reuses the recruitConversion handler.
  registerCardDef({
    defKey: "r6",
    name: "Goblin Recruiter",
    type: "creature",
    tribe: "goblin",
    text: "On flip-up: if alone on your side here, recruit.",
    costs: [],
    force: 1,
    durability: 2,
    onFlipUp: "recruiterAloneRecruit",
    attackPatterns: [{ kind: "default" }],
  });

  // r7 — Goblin Bully. 1F/2D. On flip-up: push the creature directly across this from front to
  // back row. Programmatic move via movement primitive (bypasses per-turn move counter — forced).
  // Phase M.2d.
  registerCardDef({
    defKey: "r7",
    name: "Goblin Bully",
    type: "creature",
    tribe: "goblin",
    text: "On flip-up: push the creature across from this from front to back.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    force: 1,
    durability: 2,
    onFlipUp: "bullyPush",
    attackPatterns: [{ kind: "default" }],
  });

  // r9 — Ogre Challenger. 1F/3D. provocationChallenger: +1F per opposing creature here;
  // opposing creatures here gain +1F.
  registerCardDef({
    defKey: "r9",
    name: "Ogre Challenger",
    type: "creature",
    tribe: "ogre",
    text: "+1 Force per creature on the other side here. Creatures on the other side here gain +1 Force.",
    costs: [{ kind: "absolute", stat: "force", amount: 2 }],
    force: 1,
    durability: 3,
    provocationChallenger: true,
    attackPatterns: [{ kind: "default" }],
  });

  // ---------- Actions ----------

  // r10 — Battle Driver. Action. Deal 1 damage to a friendly creature here + that creature +1F this turn.
  registerCardDef({
    defKey: "r10",
    name: "Battle Driver",
    type: "action",
    text: "Deal 1 damage to a creature on your side here. That creature gains +1 Force this turn.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    onFlipUp: "battleDriver",
  });

  // r12 — Goblin Bombardment. Action. Sacrifice a goblin on your side here; deal damage equal to
  // your Force here to a creature here (Pillar 10 random pick, includes both sides per the
  // "deal damage here" universal rule). Phase M.2e — sacrifice primitive.
  registerCardDef({
    defKey: "r12",
    name: "Goblin Bombardment",
    type: "action",
    text: "Sacrifice a goblin on your side here. Deal damage equal to your Force here.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    onFlipUp: "goblinBombardment",
  });

  // r4 — Recruit. Action. Force-superiority front-row swap. Phase M.2c — acquisition primitive.
  registerCardDef({
    defKey: "r4",
    name: "Recruit",
    type: "action",
    text:
      "If you have more Force here, a creature in front on the other side moves to the front on your side.",
    costs: [],
    onFlipUp: "recruitConversion",
  });

  // r13 — Proof of the Champion. Action. A creature here gains +1 Force permanently. Then trash.
  // Engine note: actions normally exit to discard; r13 trashes via def.exitTo = "trash".
  registerCardDef({
    defKey: "r13",
    name: "Proof of the Champion",
    type: "action",
    text: "A creature here gains +1 Force permanently. Tear up this card.",
    costs: [],
    exitTo: "trash",
    onFlipUp: "permPlus1ForceHere",
  });

  // ---------- Structures ----------

  // r14 — Warbanner. Structure. "+1 Force here."
  //
  // Structures have no stats (DECISIONS 2026-06-12) — this is a printed text-effect: a flat
  // +1 Force PRESENCE contribution to its own side's location total via presenceGrants. Pays
  // costs, feeds "your Force here" effects; never adds swing damage (combat damage is
  // per-attacker effectiveStat). NOT an aura — it does not buff creatures.
  registerCardDef({
    defKey: "r14",
    name: "Warbanner",
    type: "structure",
    text: "+1 Force here.",
    costs: [],
    presenceGrants: [{ stat: "force", amount: 1 }],
  });

  // ---------- Equipment ----------

  // r2 — Crude Axe. Equipment granting cleave to the wielder. Phase M.2a — cleave pattern wired.
  registerCardDef({
    defKey: "r2",
    name: "Crude Axe",
    type: "equipment",
    text: "Equip. The wielder's attacks gain cleave.",
    costs: [],
    grantsAttackPatterns: [{ kind: "cleave" }],
  });

  // r11 — Goblin Pike. Equipment granting pierce. Phase M.2b — pierce pattern wired.
  registerCardDef({
    defKey: "r11",
    name: "Goblin Pike",
    type: "equipment",
    text: "Equip. The wielder's attacks gain pierce.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    grantsAttackPatterns: [{ kind: "pierce", value: 1 }],
  });

  // ---------- Handlers ----------

  // loneChampionBrawler — on flip-up, if this card is the only creature on its side at this
  // location, apply +1 Force this-turn-buff to itself.
  registerFlipUpHandler("loneChampionBrawler", (ctx) => {
    const ns = ctx.state.world.nodeState[ctx.loc];
    if (!ns) return;
    if (countCreaturesOnSide(ctx) === 1) {
      // We are the only creature on our side here (this card itself counted).
      queueResolutionBeat(220, () => {
        applyBuff(ctx.state, ctx.card, { stat: "force", amount: 1, scope: "turn" });
      });
    }
  });

  // bruiserChargeBuff — on flip-up, +1 Force this turn (unconditional).
  registerFlipUpHandler("bruiserChargeBuff", (ctx) => {
    queueResolutionBeat(220, () => {
      applyBuff(ctx.state, ctx.card, { stat: "force", amount: 1, scope: "turn" });
    });
  });

  // battleDriver — action. Pick a friendly creature here at random (Pillar 10), deal 1 damage,
  // grant +1F this turn. Per §30: friendly damage on empty board fizzles (no fall-through to
  // friendly summoner).
  registerFlipUpHandler("battleDriver", (ctx) => {
    const ns = ctx.state.world.nodeState[ctx.loc];
    if (!ns) return;
    // Face-up friendly creatures only (face-down haven't entered play, can't be targeted).
    const candidates = friendlyCreatureTargets(ctx.state, ctx.side, ctx.loc);
    queueResolutionBeat(280, () => {
      if (candidates.length === 0) return; // friendly-fire on empty fizzles
      const result = applyDamage({
        state: ctx.state,
        amount: 1,
        attackerSide: ctx.side,
        attackerInstId: null,
        loc: ctx.loc,
        damageKind: "action",
        candidateCreatureTargets: candidates,
        enemySide: ctx.side, // same side as attacker
        isFriendlyFire: true,
      });
      if (result.target.kind === "creature" && result.target.creatureInstId != null) {
        const buffed = ctx.state.cards[result.target.creatureInstId];
        if (buffed) applyBuff(ctx.state, buffed, { stat: "force", amount: 1, scope: "turn" });
      }
      queueDeathDrain();
    });
  });

  // permPlus1ForceHere — action. A creature here (any side) gains +1 Force permanently. Pillar 10
  // random pick; if no targets, fizzle. Note: this is a buff effect, not damage — does NOT
  // fall through to summoner. Then the card trashes itself via def.exitTo (handled by the
  // orchestrator's action-exit closer).
  registerFlipUpHandler("permPlus1ForceHere", (ctx) => {
    const ns = ctx.state.world.nodeState[ctx.loc];
    if (!ns) return;
    // Face-up creatures here, either side, Pillar 10 (face-down can't be targeted).
    const candidates = allCreatureTargets(ctx.state, ctx.loc);
    queueResolutionBeat(280, () => {
      if (candidates.length === 0) return;
      const idx = Math.floor(Math.random() * candidates.length);
      const target = ctx.state.cards[candidates[idx]!];
      if (target) applyBuff(ctx.state, target, { stat: "force", amount: 1, scope: "permanent" });
    });
  });

  // recruitConversion — action / creature-flipup helper. If the acting side has strictly more
  // Force at this location than the opposing side, pick a random front-row enemy creature
  // (Pillar 10) and move it to an empty front-row slot on the acting side. Fizzles if no
  // legal target / no empty destination.
  registerFlipUpHandler("recruitConversion", (ctx) => {
    queueResolutionBeat(280, () => runRecruit(ctx.state, ctx.side, ctx.loc));
  });

  // recruiterAloneRecruit — r6 Goblin Recruiter. On flip-up: if alone on side here, run recruit.
  registerFlipUpHandler("recruiterAloneRecruit", (ctx) => {
    if (countCreaturesOnSide(ctx) !== 1) return; // not alone
    queueResolutionBeat(280, () => runRecruit(ctx.state, ctx.side, ctx.loc));
  });

  // goblinBombardment — r12. Sacrifice a goblin on your side here, then deal damage equal to
  // your Force here. Damage uses the universal damage rule (Pillar 10 random pick from enemies
  // at this loc; fall-through to summoner if none). The sacrifice happens FIRST so the goblin's
  // Force is no longer part of the location total when the damage amount is computed.
  registerFlipUpHandler("goblinBombardment", (ctx) => {
    queueResolutionBeat(220, () => {
      // Find face-up friendly goblins at this loc (a face-down card hasn't entered play and can't
      // be sacrificed). Filter the canonical face-up gather by tribe.
      const ns = ctx.state.world.nodeState[ctx.loc];
      if (!ns) return;
      const goblins = friendlyCreatureTargets(ctx.state, ctx.side, ctx.loc).filter(
        (id) => getCardDef(ctx.state.cards[id]!.defKey).tribe === "goblin",
      );
      if (goblins.length === 0) return; // fizzle — no goblin to sacrifice

      // Pillar 10 random pick.
      const idx = Math.floor(Math.random() * goblins.length);
      const sac = ctx.state.cards[goblins[idx]!];
      if (!sac) return;
      sacrificeCreature(ctx.state, sac, ctx.side, ctx.loc);

      // Damage = our Force here AFTER the sacrifice (the goblin's Force is no longer included).
      const dmg = locationStatTotal(ctx.state, ctx.side, ctx.loc, "force");
      if (dmg <= 0) return; // no damage to deal

      // Collect face-up enemy creature candidates at this loc (face-down can't be targeted).
      const enemySide = opponentOf(ctx.side);
      const enemies = enemyCreatureTargets(ctx.state, ctx.side, ctx.loc);

      applyDamage({
        state: ctx.state,
        amount: dmg,
        attackerSide: ctx.side,
        attackerInstId: null, // action damage, no Spite trigger
        loc: ctx.loc,
        damageKind: "action",
        candidateCreatureTargets: enemies,
        enemySide,
      });
      queueDeathDrain();
    });
  });

  // bullyPush — r7. On flip-up: push the creature directly across this from front to back.
  // "Across" = same column on the opposing side, in front row. Push moves it to the back row
  // (same column). Fizzles if (a) no creature across in front row, (b) back-row destination is
  // occupied. Forced move — bypasses the per-turn move counter (enforceTurnLimit: false).
  registerFlipUpHandler("bullyPush", (ctx) => {
    queueResolutionBeat(260, () => runBullyPush(ctx.state, ctx.card, ctx.side, ctx.loc));
  });
}

// ---------- Shared push logic ----------

export function runBullyPush(
  state: import("../engine/types.ts").GameState,
  bully: import("../engine/types.ts").CardInstance,
  bullySide: import("../engine/types.ts").Side,
  loc: string,
): void {
  const ns = state.world.nodeState[loc];
  if (!ns) return;

  // The creature directly across (front-first within the bully's column) — the same default
  // primary-target rule combat uses, which correctly skips face-down occupants (a face-down
  // card hasn't entered play and can't be pushed).
  const primary = primaryTargetInFront(state, bully, bullySide, loc);
  if (primary == null) return; // nothing to push

  // The push only fires on a FRONT-ROW target ("push from front to back" per the card text).
  if (!frontRowPositions(ns.profile, "creature").includes(primary.pos)) return;

  // Destination = the slot directly behind the target (same column, next row back).
  const dest = behind(ns.profile, "creature", primary.pos);
  if (dest == null) return; // no back row in this profile (1-row profile)

  const target = state.cards[primary.instId];
  if (!target) return;

  // Forced move — bypass per-turn move limit.
  moveCreature({
    state,
    card: target,
    side: opponentOf(bullySide),
    loc,
    toPositions: [dest],
    kind: "creature",
    enforceTurnLimit: false,
  });
}

// ---------- Shared Recruit logic ----------

function runRecruit(
  state: import("../engine/types.ts").GameState,
  recruitingSide: import("../engine/types.ts").Side,
  loc: string,
): void {
  const ns = state.world.nodeState[loc];
  if (!ns) return;
  const enemySide = opponentOf(recruitingSide);

  // Force superiority: strict greater-than per prototype text "more Force here".
  const myForce = locationStatTotal(state, recruitingSide, loc, "force");
  const theirForce = locationStatTotal(state, enemySide, loc, "force");
  if (myForce <= theirForce) return; // fizzle

  // Pick a random FACE-UP front-row enemy creature (Pillar 10; face-down can't be targeted).
  const candidates = enemyFrontRowTargets(state, recruitingSide, loc);
  if (candidates.length === 0) return; // fizzle

  // Find an empty front-row position on our side.
  const dest = firstEmptyPosition(state, recruitingSide, loc, "creature", "front");
  if (dest == null) return; // fizzle — nowhere to land

  const idx = Math.floor(Math.random() * candidates.length);
  const targetInstId = candidates[idx]!;
  const targetCard = state.cards[targetInstId];
  if (!targetCard) return;

  // Multi-slot target needs multi-position destination. For simplicity, recruit only fires on
  // single-slot creatures in this slice — multi-slot Recruit needs the destination to match the
  // footprint, which is out of scope for Phase M.2c.
  if (targetCard.slots.length !== 1) return;

  acquireCardTo(state, targetCard, enemySide, loc, [dest], "creature");
}

// ---------- Local helpers ----------

function countCreaturesOnSide(ctx: {
  state: import("../engine/types.ts").GameState;
  side: import("../engine/types.ts").Side;
  loc: string;
}): number {
  // SLOT OCCUPANCY — a face-down committed card occupies its slot, so it counts toward "alone" /
  // creature-count checks (the body is present; whether it has flipped is irrelevant). This is
  // distinct from targetability. See targeting.ts's two-axis note.
  return countOccupiedCreatureSlots(ctx.state, ctx.side, ctx.loc);
}
