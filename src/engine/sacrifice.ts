// Sacrifice primitive — voluntarily route a friendly creature to its pile, treating it as a
// death event so deathwish (onLeavePlay) fires normally.
//
// Contract: matches the prototype's r12 Goblin Bombardment ("Sacrifice a goblin on your side
// here. Deal damage equal to your Force here.") and is the engine surface for any "sacrifice"
// effect in later content (Black death-feed cards, evolution gates per DESIGN line 492, etc.).
//
// Sacrifice IS a death — leavePlay fires deathwish, routes to the side's graveyard (or location
// pile if no summoner is present per §29). The sacrifice handler treats the creature as
// "creatureDied" because mechanically it died. (Per §17, the two-beat death sequence applies:
// pendingLeavePile is set so the orchestrator can pace the linger + sweep. Callers may bypass
// the linger by routing immediately — Phase M sacrifice handlers do this for simplicity.)

import { emit } from "./events.ts";
import { leavePlay } from "./piles.ts";
import type { CardInstance, GameState, Side } from "./types.ts";

/**
 * Sacrifice a creature on the given side at the given location. The card immediately routes
 * via leavePlay with reason "creatureDied" — deathwish fires, then the card goes to its pile.
 *
 * Returns true on success, false if the card isn't on the named side at the named loc (defensive).
 */
export function sacrificeCreature(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): boolean {
  const ns = state.world.nodeState[loc];
  if (!ns) return false;
  // Verify the card is on the named side's slots at this loc.
  const slots = ns.sideSlots[side].creatures;
  let found = false;
  for (const pos of card.slots) {
    if (slots[pos] === card.instId) {
      found = true;
      break;
    }
  }
  if (!found) return false;

  // Outcome event (before routing, so the card's side/loc are still its pre-death values).
  emit(state, "sacrifice", { instId: card.instId, side, loc });

  // Route via leavePlay — this fires onLeavePlay and sends the card to the appropriate pile.
  leavePlay(state, card, side, loc, "creatureDied");
  // Clear pendingLeavePile to match completeDeath's invariant (sacrifice does the whole death
  // in one step rather than the orchestrator's two-beat split).
  card.pendingLeavePile = null;
  return true;
}
