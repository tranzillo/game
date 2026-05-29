// Phase G slice content — minimal card defs + handlers for the validation slice.
//
// Phase M ports the full v1 content. This module exists only to validate the engine→store→UI
// boundary end-to-end with the smallest playable loop.
//
// Slice deck: a few creatures, one with a "draw 1 on flip-up" trigger to exercise the
// flip-up dispatch + deck-to-hand cycle.

import { registerCardDef } from "../engine/cards.ts";
import { registerFlipUpHandler } from "../engine/triggers.ts";

let registered = false;

/**
 * Register the slice's defs and handlers. Idempotent.
 */
export function registerSliceContent(): void {
  if (registered) return;
  registered = true;

  // r1: Goblin Brawler. 1F/2D. No trigger.
  registerCardDef({
    defKey: "r1",
    name: "Goblin Brawler",
    type: "creature",
    text: "1 Force.",
    costs: [],
    force: 1,
    durability: 2,
    attackPatterns: [{ kind: "default" }],
  });

  // r3: Orc Bruiser. 2F/3D. No trigger.
  registerCardDef({
    defKey: "r3",
    name: "Orc Bruiser",
    type: "creature",
    text: "2 Force.",
    costs: [],
    force: 2,
    durability: 3,
    attackPatterns: [{ kind: "default" }],
  });

  // scribe: 0F/1D. Flip-up: draw 1. Exercises the trigger dispatcher.
  registerCardDef({
    defKey: "scribe",
    name: "Scribe",
    type: "creature",
    text: "On flip-up: draw 1.",
    costs: [],
    force: 0,
    durability: 1,
    onFlipUp: "drawOne",
    attackPatterns: [{ kind: "default" }],
  });

  // Handler: drawOne — move the top of the side's deck into hand.
  registerFlipUpHandler("drawOne", (ctx) => {
    if (!ctx.state.currentEncounter) return;
    const sideState =
      ctx.side === "player"
        ? ctx.state.currentEncounter.playerSide
        : ctx.state.currentEncounter.aiSide;
    if (!sideState) return;
    if (sideState.deck.length === 0) return;
    const drawn = sideState.deck.shift()!;
    sideState.hand.push(drawn);
  });
}
