// Token spawning — creates a card instance face-down at a target slot, emits a Future chip.
//
// Contract: REBUILD_PLAN §29 — "A token card spawned by an effect is created and placed
// face-down into a target slot. It gets a future chip. From there it follows standard rules.
// No special token lifecycle."
//
// Callable by any handler (flip-up, leave-play, present-subscriber, phase-boundary). The chip
// goes into the active sub-phase queue per state.currentEncounter.subPhase, so it will flip
// during the next drain pass (typically still inside the current phase).
//
// Tokens have origin "biome" so they can never be acquired back into a deck — they exist only
// while on the battlefield.

import { createCardInstance, getCardDef } from "./cards.ts";
import { slotsOfKind } from "./state.ts";
import { placeAt } from "./slots.ts";
import { emitFutureChip } from "./timeline.ts";
import type {
  CardInstance,
  GameState,
  InstId,
  PositionKey,
  Side,
  SlotKind,
  TimelineChip,
} from "./types.ts";

export interface SpawnTokenResult {
  card: CardInstance;
  chip: TimelineChip;
}

/**
 * Create a token at the given slot(s). The defKey must already be registered. The token is placed
 * face-down (revealed=false) and committed (pending=false), so a chip goes into the active
 * sub-phase queue to flip up during the next drain.
 *
 * positions: which positions to occupy. For single-slot tokens pass [posKey]. For multi-slot
 * tokens pass all footprint positions.
 *
 * Fizzles (returns null, spawns nothing) if any target position doesn't exist in the profile,
 * is locked, or is already occupied — token-spawn effects "do nothing" when they can't place,
 * rather than crashing. Callers that want to know whether it landed check the return value.
 */
export function spawnTokenAt(
  state: GameState,
  defKey: string,
  side: Side,
  loc: string,
  kind: SlotKind,
  positions: PositionKey[],
): SpawnTokenResult | null {
  const ns = state.world.nodeState[loc];
  if (!ns) return null;
  if (positions.length === 0) return null;

  // Pre-check placement before creating the instance: every target position must exist in the
  // profile (unlocked) and be empty. Bail with null (fizzle) otherwise — no card is created.
  const slotMap = slotsOfKind(ns.sideSlots[side], kind);
  const valid = new Set(profilePositionsFor(ns.profile, kind));
  for (const p of positions) {
    if (!valid.has(p)) return null;
    if (slotMap[p] != null) return null;
  }

  // Token origin is "biome" — they can't return to any deck.
  const instId: InstId = createCardInstance(state, defKey, "biome");
  const card = state.cards[instId];
  if (!card) return null;

  // Place face-down committed.
  placeAt(state, side, loc, kind, positions, card, false /* pending */);
  card.revealed = false;

  // Emit a chip into the active sub-phase queue. For tokens the chip kind matches the card type.
  const def = getCardDef(card.defKey);
  const chipKind: TimelineChip["kind"] = def.type === "equipment" ? "equipment" : def.type;
  const posKey = positions[0] ?? null;
  const chip = emitFutureChip(state, card, side, loc, chipKind, posKey, null);

  return { card, chip };
}

function profilePositionsFor(
  profile: GameState["world"]["nodeState"][string]["profile"],
  kind: SlotKind,
): PositionKey[] {
  return kind === "creature"
    ? profile.creatures.positions
    : kind === "structure"
      ? profile.structures.positions
      : profile.actions.positions;
}
