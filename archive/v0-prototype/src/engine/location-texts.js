import { L } from "./state.js";
import { LOC_NAMES } from "./config.js";
import { logEntry } from "./log.js";
import { EQUIPMENT_CAP_PER_HOST, attachEquipmentToHost } from "./marks.js";

// Location-text registry. Each entry is a node's printed rules effect for one mode (peace/war).
// In the slice, peace/war is hard-coded per-node — locations don't flip dynamically. Each location
// text declares which engine hooks it cares about; the engine consults the per-location text at
// the relevant moments. Null/missing fields are skipped.
//
// Hooks:
//   shouldSuppressAction: function(card, loc) — return true to suppress the action at end of
//     phase (chip stays in the future, doesn't flip). Re-checked at every end-of-phase pass; when
//     the function returns false, the action flips normally on that pass.
//   onUpkeepStart/End, onDrawStart/End, onMainStart/End, onCombatStart/End, onCleanupStart/End(loc)
//     — phase-boundary hooks fired by firePhaseHook.
//   onEquipmentLeavesPlay(loc, equipment, hostSide) — fires when equipment leaves play here.
//     Returns truthy if the hook handled the equipment's destination (skip default junkyard push).
//   desc: string — display text for the UI
export const LOCATION_TEXTS = {
  // Champion's Rest (Red, tall-rewarding peace location).
  // Actions don't flip up by default. If at end of cleanup only ONE creature is at this location,
  // all actions here flip up and resolve. Player engineers "exactly one creature here" to extract
  // a permanent buff via a one-shot exiling action.
  locP1: {
    label: "Champion's Rest",
    desc: "Actions here are suppressed unless only one creature is here.",
    // Suppression rule: actions in slots at this location are face-down and skip the end-of-phase
    // flip queue UNLESS at the queue-build moment there is exactly one creature here (either side
    // counts). When the condition is met at any end-of-phase, suppression lifts for that pass and
    // the action flips normally through the present in Tempo order.
    shouldSuppressAction: function (card, loc) {
      let creatureCount = 0;
      for (const sideName of ["player", "ai"]) {
        const lc = L(sideName, loc);
        for (const pos of ["fl","fr","bl","br"]) {
          if (lc.creatures[pos]) creatureCount++;
        }
      }
      return creatureCount !== 1;  // suppress unless exactly one creature here
    }
  },
  // Goblin Armaments (Red, tribal-training-grounds peace location).
  // When equipment leaves play here, attach it to a goblin here. Per Pillar 10, the goblin is
  // picked at random from legal candidates: any goblin on either side at this location that
  // isn't already at the equipment cap. Equipment cycles between dying goblins until no legal
  // host remains. Equipment cap (1 per host) bounds the cycling and creates slot-pressure.
  locP2: {
    label: "Goblin Armaments (peace)",
    desc: "When equipment leaves play here, attach it to a goblin here.",
    onEquipmentLeavesPlay: function (loc, equipment, hostSide) {
      // Find legal host candidates: any goblin on either side at this location with an empty
      // equipment slot (cap = 1 per host).
      const candidates = [];
      for (const side of ["player", "ai"]) {
        const lc = L(side, loc);
        for (const pos of ["fl","fr","bl","br"]) {
          const c = lc.creatures[pos];
          if (!c) continue;
          if (c.revealed === false) continue;  // face-down cards are not legal targets
          if (c.tribe !== "goblin") continue;
          if (c.equipment && c.equipment.length >= EQUIPMENT_CAP_PER_HOST) continue;  // equipment cap
          candidates.push({ side, pos, c });
        }
      }
      if (candidates.length === 0) {
        // No legal goblin host. Equipment falls through to the default (host-side junkyard).
        return false;
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const reason = candidates.length === 1 ? "[only legal goblin]" : `[random pick from ${candidates.length} goblins]`;
      attachEquipmentToHost(equipment, pick.c, pick.side);
      logEntry(`  Goblin Armaments: ${equipment.name} cycles to ${pick.c.name} (${pick.side} ${pick.pos}). ${reason}`, "combat-detail");
      return true;  // handled — skip the default junkyard push
    }
  },
  // Ogre Hideaway (Red, peace). Recruit-bait location: when an ogre flips up here, it goes to sleep
  // for 2 turns. Sleeping = 0 effective Force, no combat, no movement. Player can recruit easily
  // (no Force-superiority hurdle) or poke the ogre awake and trade combat.
  locP3: {
    label: "Ogre Hideaway",
    desc: "When an ogre flips up here, it sleeps for 2.",
    onFlipUp: function (loc, side, card) {
      if (card.tribe !== "ogre") return;
      if (card.sleepCounter > 0) return;  // already asleep — don't refresh
      card.sleepCounter = 2;
      logEntry(`  Ogre Hideaway: ${card.name} (${side} ${LOC_NAMES[loc]}) falls asleep (Sleep 2).`, "combat-detail");
    }
  }
};
