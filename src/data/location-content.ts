// Location text content — ports from archive/v0-prototype/src/engine/location-texts.js ONLY.
// No invented content: every entry here must trace to the prototype, the design docs, or an
// explicit user decision (DECISIONS).
//
// Prototype location texts and their port status:
//   locP1 Champion's Rest   — "Actions here are suppressed unless only one creature is here."
//                             DEFERRED: needs the shouldSuppressAction machinery in the flip
//                             drain (not wired; lands with Future-chip targeting work).
//   locP2 Goblin Armaments  — "When equipment leaves play here, attach it to a goblin here."
//                             DEFERRED: needs an onEquipmentLeavesPlay hook in the leave-play
//                             path, and equipment isn't playable in the slice yet.
//   locP3 Ogre Hideaway     — "When an ogre flips up here, it sleeps for 2." PORTED below.

import { registerLocationText } from "../engine/location-text.ts";
import { applySleep } from "../engine/sleep.ts";
import { getCardDef } from "../engine/cards.ts";

let registered = false;

export function _resetLocationContentFlag(): void {
  registered = false;
}

export function registerLocationContent(): void {
  if (registered) return;
  registered = true;

  // Ogre Hideaway — prototype locP3, ported faithfully. Recruit-bait location: when an ogre
  // flips up here, it sleeps for 2 turns (0 effective Force, no combat). Per the prototype:
  // an already-sleeping ogre does NOT refresh its counter.
  registerLocationText({
    key: "ogreHideaway",
    name: "Ogre Hideaway",
    peaceText: "When an ogre flips up here, it sleeps for 2.",
    onFlipUp: (ctx) => {
      const def = getCardDef(ctx.card.defKey);
      if (def.tribe !== "ogre") return;
      if (ctx.card.sleepCounter > 0) return; // already asleep — don't refresh
      applySleep(ctx.card, 2);
    },
  });
}
