// Slice content — Spark and Vengeful Watcher. Confirmed REAL content by the user (2026-06-12):
// Spark is a design-doc card (the canonical combat-trick action per REBUILD §30 "the player
// commits a Spark in combat → it fires before attacks"); Vengeful Watcher is confirmed content.
//
// Scrubbed 2026-06-12 per user direction: Scribe, Sapper Bomber, Goblin Breeder (+ Goblin Pup
// token), and Watchful Vigil removed entirely — those were invented scaffolding.

import { registerCardDef } from "../engine/cards.ts";
import {
  registerFlipUpHandler,
  registerPresentHandler,
} from "../engine/triggers.ts";
import { queueResolutionBeat } from "../store/present-span.ts";
import { applyDamage } from "../engine/damage.ts";
import { applyBuff } from "../engine/buffs.ts";
import { opponentOf } from "../engine/sides.ts";
import { enemyCreatureTargets } from "../engine/targeting.ts";
import { queueDeathDrain } from "../store/death-drain.ts";

let registered = false;

/**
 * Register the slice's scaffolding defs and handlers. Idempotent.
 */
export function registerSliceContent(): void {
  if (registered) return;
  registered = true;

  // spark: action. "Deal 1 damage here" — exercises the action commit window + universal
  // damage fall-through (Pillar 10 random pick from creatures here; summoner fall-through if
  // empty).
  registerCardDef({
    defKey: "spark",
    name: "Spark",
    type: "action",
    text: "Deal 1 damage here.",
    costs: [],
    onFlipUp: "sparkOne",
  });

  // watcher: creature with an onPresent subscription. Exercises cross-card present-event
  // subscriptions with scope + filter + counter-style accumulation via turn-buffs.
  registerCardDef({
    defKey: "watcher",
    name: "Vengeful Watcher",
    type: "creature",
    text: "When an enemy creature flips here, gain +1 Force this turn.",
    costs: [],
    force: 0,
    durability: 3,
    onPresent: [
      {
        scope: "this-location",
        filter: { cardType: "creature", excludeSelf: true },
        handler: "watcherEnrage",
      },
    ],
    attackPatterns: [{ kind: "default" }],
  });

  // Handler: sparkOne — deal 1 damage to an enemy creature at this location, or fall through
  // to the enemy summoner per the universal damage rule. Paced inside the action's resolution
  // span so the player sees the damage land before the chip drops to Past.
  registerFlipUpHandler("sparkOne", (ctx) => {
    if (!ctx.state.currentEncounter) return;
    const ns = ctx.state.world.nodeState[ctx.loc];
    if (!ns) return;
    const enemySide = opponentOf(ctx.side);
    // Face-up enemy creatures only — face-down cards haven't entered play and can't be targeted.
    const candidates = enemyCreatureTargets(ctx.state, ctx.side, ctx.loc);

    queueResolutionBeat(280, () => {
      const enc = ctx.state.currentEncounter;
      if (!enc) return;
      const result = applyDamage({
        state: ctx.state,
        amount: 1,
        attackerSide: ctx.side,
        attackerInstId: null, // action damage has no attacker — Spite does NOT trigger per §26
        loc: ctx.loc,
        damageKind: "action",
        candidateCreatureTargets: candidates,
        enemySide,
      });
      if (result.target.kind === "creature" && result.target.creatureInstId != null) {
        enc.swingHitTargetInstId = result.target.creatureInstId;
        // Clear the flash on a short follow-up beat.
        queueResolutionBeat(220, () => {
          const e = ctx.state.currentEncounter;
          if (e) e.swingHitTargetInstId = null;
        });
      }
      // Drain any death the damage caused — cascades inside the same span per §32.
      queueDeathDrain();
    });
  });

  // Handler: watcherEnrage — apply +1 Force this-turn buff to the watcher when an enemy creature
  // flips up at this location. Stackable: each event adds +1.
  registerPresentHandler("watcherEnrage", (ctx) => {
    applyBuff(ctx.state, ctx.subscriber, { stat: "force", amount: 1, scope: "turn" });
  });
}
