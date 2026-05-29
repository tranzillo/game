// Aura handler registry — string-tag dispatched.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §26.
//
// An aura is a read-time contribution from a card in play to a stat read. Auras re-evaluate
// continuously — there's no cached buff applied "when the source enters play." Instead, every
// time `effectiveStat` runs, it walks every card in play with an aura def and asks each
// "do you contribute to this read, and how much?"
//
// Aura handlers live here as a registry. Content modules register handlers at boot; the engine
// dispatches by tag.

import { getCardDef } from "./cards.ts";
import type { CardInstance, GameState, Side, StatKind } from "./types.ts";

// Read context — what stat is being read against what target.
export interface AuraReadContext {
  targetCard?: CardInstance | undefined; // for per-card reads; undefined for location-level reads
  targetSide?: Side | undefined;
  targetLoc: string;
  stat: StatKind;
}

// The handler shape. Pure: returns the contribution this aura makes to the read.
// Returns 0 if the aura doesn't contribute to this particular read.
export type AuraHandler = (
  state: GameState,
  source: CardInstance,
  sourceSide: Side,
  sourceLoc: string,
  ctx: AuraReadContext,
) => number;

const AURA_HANDLERS: Record<string, AuraHandler> = {};

export function registerAuraHandler(tag: string, handler: AuraHandler): void {
  if (AURA_HANDLERS[tag] != null) {
    throw new Error(`Duplicate aura handler registered: ${tag}`);
  }
  AURA_HANDLERS[tag] = handler;
}

export function getAuraHandler(tag: string): AuraHandler | null {
  return AURA_HANDLERS[tag] ?? null;
}

/**
 * Clear all aura handlers. Used in tests for isolation.
 */
export function _resetAuraHandlers(): void {
  for (const k of Object.keys(AURA_HANDLERS)) delete AURA_HANDLERS[k];
}

// ---------- Aura dispatch ----------

/**
 * Sum contributions from every active aura source for the given read context.
 *
 * "Active aura source" = a card currently in play (its `slots.length > 0`, revealed, on either side
 * at any location in the current encounter) whose def has an `aura.handlerTag`.
 *
 * For each candidate, look up its handler in the registry; call it with the read context; sum
 * the contributions.
 *
 * Pure. No side effects.
 */
export function sumAuraContributions(state: GameState, ctx: AuraReadContext): number {
  if (!state.currentEncounter) return 0;

  let total = 0;
  // Iterate the registry's view of cards-in-play. For Phase B we don't have an explicit
  // "in-play index"; iterate cards and check via the card's `slots` array (set by Phase A's
  // placeAt mechanism).
  for (const instId of Object.keys(state.cards)) {
    const source = state.cards[Number(instId)];
    if (!source) continue;
    if (!source.revealed) continue;
    if (source.slots.length === 0) continue;

    const def = getCardDef(source.defKey);
    if (!def.aura) continue;

    const handler = getAuraHandler(def.aura.handlerTag);
    if (!handler) continue;

    // Determine the aura source's side + loc by scanning sideSlots. This is O(locations).
    // Phase B+ may add an index if profiles get expensive; v1 board sizes make this fine.
    const sourceLocation = findSourceLocation(state, source);
    if (!sourceLocation) continue;

    total += handler(state, source, sourceLocation.side, sourceLocation.loc, ctx);
  }
  return total;
}

// Helper: find where a card in play is. Returns side + loc (the card's first-placed location).
// For multi-slot cards confined to one location, this is unambiguous.
function findSourceLocation(
  state: GameState,
  source: CardInstance,
): { side: Side; loc: string } | null {
  for (const loc of Object.keys(state.world.nodeState)) {
    const ns = state.world.nodeState[loc]!;
    for (const side of ["player", "ai"] as const) {
      const sides = ns.sideSlots[side];
      for (const kind of ["creatures", "structures", "actions"] as const) {
        for (const key of source.slots) {
          if (sides[kind][key] === source.instId) return { side, loc };
        }
      }
    }
  }
  return null;
}

