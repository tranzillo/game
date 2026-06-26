// Green card content — Phase M.3 port (slice 1).
//
// Contract: REBUILD_PLAN Phase M. Ported from archive/v0-prototype/src/data/cards.js, re-
// implemented per the locked design.
//
// Ported subset (Phase M.3 slice 1):
//   g3  Rebel Sapper           — deathwish: spawn Explosive Trap on friendly front row
//   g4  Rebel Slinger          — ranged-only creature; consumes ammo from this side's stockpile
//   g6  Forage                 — action: add 1 ammo to friendly stockpile here; escalating cost
//   g8  Rebel Saboteur         — flip-up: spawn Explosive Trap on opposing front row
//   g_trap Explosive Trap      — token. Inert. Deathwish: damage same-side adjacents + melee
//                                attackers this turn.
//
// Deferred:
//   g1  Rebel Scout    — deathwish: move friendly from another loc to this slot. Needs cross-
//                        location move primitive.
//   g2  Pathfinder     — deathwish: drop Bad Intel quest. Needs Reroute mark mechanic.
//   g5  Rebel Outrider — flip-up: stealth row-adjacent friendlies. Needs stealth (re-flip) primitive.
//   g7  Rebel Runner   — flip-up: send friendly here to another loc. Needs cross-location move.

import { registerCardDef } from "../engine/cards.ts";
import {
  registerFlipUpHandler,
  registerLeavePlayHandler,
} from "../engine/triggers.ts";
import { queueResolutionBeat } from "../store/present-span.ts";
import { applyDamage } from "../engine/damage.ts";
import { adjacentSameSide, column } from "../engine/profile.ts";
import { opponentOf } from "../engine/sides.ts";
import { isTargetableId } from "../engine/targeting.ts";
import { spawnTokenAt } from "../engine/tokens.ts";
import { queueDeathDrain } from "../store/death-drain.ts";

let registered = false;

export function _resetGreenContentFlag(): void {
  registered = false;
}

export function registerGreenContent(): void {
  if (registered) return;
  registered = true;

  // ---------- Creatures ----------

  // g3 — Rebel Sapper. 1F/2D. Deathwish: leave an Explosive Trap in its slot (the trap IS the
  // corpse — it takes the slot the Sapper died in, whatever row that was).
  registerCardDef({
    defKey: "g3",
    name: "Rebel Sapper",
    type: "creature",
    tribe: "rebel",
    text: "Deathwish: leave an Explosive Trap in this slot.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    force: 1,
    tempo: 0,
    durability: 2,
    onLeavePlay: "sapperDropTrap",
    attackPatterns: [{ kind: "default" }],
  });

  // g4 — Rebel Slinger. 1F/1T/2D. Ranged. Fires from any row with ammo at this loc.
  registerCardDef({
    defKey: "g4",
    name: "Rebel Slinger",
    type: "creature",
    tribe: "rebel",
    text: "Ranged (consumes 1 ammo per shot from this side's stockpile here).",
    costs: [],
    force: 1,
    tempo: 1,
    durability: 2,
    attackPatterns: [{ kind: "ranged", ammoCost: 1 }],
  });

  // g8 — Rebel Saboteur. 1F/1T/2D. Flip-up: drop an Explosive Trap on the opposing front row.
  registerCardDef({
    defKey: "g8",
    name: "Rebel Saboteur",
    type: "creature",
    tribe: "rebel",
    text: "Flip-up: drop an Explosive Trap on the opposing front row here.",
    costs: [{ kind: "absolute", stat: "force", amount: 1 }],
    force: 1,
    tempo: 1,
    durability: 2,
    onFlipUp: "saboteurDropTrap",
    attackPatterns: [{ kind: "default" }],
  });

  // g_trap — Explosive Trap. Inert token, 1D. Deathwish: damage adjacent friendlies + any creature
  // that melee'd this trap this turn.
  registerCardDef({
    defKey: "g_trap",
    name: "Explosive Trap",
    type: "creature",
    text: "Inert. Deathwish: deal 2 to adjacent friendlies + any creature that melee'd this on this turn.",
    costs: [],
    force: 0,
    tempo: 0,
    durability: 1,
    inert: true,
    onLeavePlay: "explosiveTrapDeathwish",
    attackPatterns: [{ kind: "default" }],
  });

  // ---------- Actions ----------

  // g6 — Forage. Action. Add 1 ammo to your stockpile here. Escalating cost: each subsequent
  // cast of this card-instance needs +1 Tempo here (this encounter). Counter on instance.
  // Phase A's CardDef has `forageCasts` field on CardInstance — we'll use it for the counter.
  registerCardDef({
    defKey: "g6",
    name: "Forage",
    type: "action",
    text: "Add 1 ammo to your stockpile here. Each subsequent cast of this card needs +1 Tempo here this encounter.",
    costs: [],
    // effect tag matches what costs.ts effectiveCosts() checks for the escalating-cost rule —
    // without it the +1-Tempo-per-cast escalation never engages (2026-06-12 audit fix).
    effect: "forageAddAmmo",
    onFlipUp: "forageAddAmmo",
  });

  // ---------- Handlers ----------

  // sapperDropTrap — g3 deathwish. The trap IS the corpse: spawn a g_trap in the exact slot the
  // Sapper left play from (its own side, same position) — wherever it died, not front-row-anchored.
  // The slot is captured now (the leave-play trigger fires before slot removal); the spawn runs on
  // a later beat, after the Sapper has vacated, so the slot is free. spawnTokenAt fizzles if it
  // somehow got re-occupied.
  registerLeavePlayHandler("sapperDropTrap", (ctx) => {
    const vacatedSlots = [...ctx.card.slots];
    queueResolutionBeat(260, () => {
      spawnTokenAt(ctx.state, "g_trap", ctx.side, ctx.loc, "creature", vacatedSlots);
    });
  });

  // saboteurDropTrap — g8 flip-up. Spawn a g_trap on the OPPOSING front row, in the Saboteur's
  // column (across), per the same column-anchored "here" rule combat targeting uses. spawnTokenAt
  // fizzles if that slot is occupied.
  registerFlipUpHandler("saboteurDropTrap", (ctx) => {
    const anchor = ctx.card.slots[0];
    queueResolutionBeat(280, () => {
      const ns = ctx.state.world.nodeState[ctx.loc];
      if (!ns || anchor == null) return;
      // The front-row cell in the Saboteur's column (across-targeting "here"): column() returns
      // the column front-to-back, so [0] is its front-row position.
      const dest = column(ns.profile, "creature", anchor)[0];
      if (dest == null) return;
      spawnTokenAt(ctx.state, "g_trap", opponentOf(ctx.side), ctx.loc, "creature", [dest]);
    });
  });

  // explosiveTrapDeathwish — g_trap leave-play. Deal 2 damage to:
  //   - same-side creatures adjacent to where the trap was, AND
  //   - any creature that dealt melee damage to this trap this turn (regardless of position).
  // The trap is still in its slot when the deathwish fires (per leavePlay ordering: trigger
  // fires before container removal), so we can read its position to compute adjacency.
  registerLeavePlayHandler("explosiveTrapDeathwish", (ctx) => {
    const ns = ctx.state.world.nodeState[ctx.loc];
    if (!ns) return;
    // Compute adjacency from the trap's current slot positions (multi-slot would expand here;
    // g_trap is single-slot).
    const friendlySlots = ns.sideSlots[ctx.side].creatures;
    const targets = new Set<number>();
    for (const pos of ctx.card.slots) {
      for (const adj of adjacentSameSide(ns.profile, "creature", pos)) {
        const id = friendlySlots[adj];
        // Only face-up adjacents are valid targets — a face-down committed neighbor hasn't
        // entered play and can't be damaged (targetability rule).
        if (id != null && id !== ctx.card.instId && isTargetableId(ctx.state, id)) targets.add(id);
      }
    }
    // Add any melee attackers this turn.
    for (const id of ctx.card.meleeAttackersThisTurn) {
      if (id !== ctx.card.instId) targets.add(id);
    }
    if (targets.size === 0) return;

    queueResolutionBeat(280, () => {
      // Apply 2 damage to each target. Use single-target applyDamage per target (not multi-each)
      // since each hit is its own damage event.
      for (const targetId of targets) {
        applyDamage({
          state: ctx.state,
          amount: 2,
          attackerSide: ctx.side,
          attackerInstId: null, // trap is the source but treated as sourceless (no thorns)
          loc: ctx.loc,
          damageKind: "deathwish",
          candidateCreatureTargets: [targetId],
          enemySide: ctx.side, // same-side adjacents = friendly fire; enemy-side attackers handled below
          isFriendlyFire: true,
        });
      }
      queueDeathDrain();
    });
  });

  // forageAddAmmo — g6 action. Add 1 ammo to your stockpile at this loc.
  // The escalating cost (forageCasts counter) increments here for cost-gating on future casts;
  // the cost check itself happens at cast time (legality.ts in prototype; Phase M cost system
  // wires this when costs are enforced. For now: just bump the counter so future casts can
  // see it).
  registerFlipUpHandler("forageAddAmmo", (ctx) => {
    queueResolutionBeat(240, () => {
      const ns = ctx.state.world.nodeState[ctx.loc];
      if (!ns) return;
      ns.ammo[ctx.side] += 1;
      ctx.card.forageCasts = (ctx.card.forageCasts ?? 0) + 1;
    });
  });
}
