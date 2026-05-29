// Timeline + chip + Past primitives.
//
// Contract: ENGINE_SKETCH.md Phase E, REBUILD_PLAN §32.
//
// Three temporal states of a card during an encounter:
//   - future: chip exists, card is face-down in its slot, awaiting flip.
//   - present: transient moment of flip — the chip transits through the present node visually.
//   - past: chip is resolved; the card is face-up (or, for actions, has resolved and exited).
//
// Two distinct things:
//   - Chips: visual one-per-face-down-card marker. Each chip references a CardInstance via instId.
//   - The Past: append-only log of every flip-up event, regardless of card type. Encounter-scoped.
//     Cleared at encounter start. Targetable resource per §32.
//
// Tempo caching at commit:
//   - Creature chips cache effectiveStat(card, "tempo").
//   - Non-creature chips cache locationStatTotal(side, loc, "tempo").
// Once cached, tempo doesn't re-evaluate before sort.

import { effectiveStat } from "./stats.ts";
import { locationStatTotal } from "./location-totals.ts";
import { getCardDef } from "./cards.ts";
import type {
  CardInstance,
  EncounterState,
  GameState,
  InstId,
  PastEntry,
  PositionKey,
  Side,
  TimelineChip,
} from "./types.ts";

// ---------- Chip kind ----------

type ChipKind = TimelineChip["kind"];

// ---------- Chip emission ----------

/**
 * Create a new future chip for a card just committed face-down. The chip routes to the active
 * sub-phase's queue per the EncounterState's current subPhase.
 *
 * Tempo caching:
 *   - Creature card: effectiveStat(card, ..., "tempo") at commit moment.
 *   - Non-creature (structure / action / equipment): locationStatTotal(side, loc, "tempo") at commit.
 *
 * The chip is appended to state.timeline AND to the active sub-phase queue. The two collections
 * serve different roles — timeline is the unified visual stream, the queue is what flips next.
 *
 * Equipment chips: posKey is null (equipment attaches to a host, not a slot); hostInstId
 * identifies the host.
 */
export function emitFutureChip(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
  kind: ChipKind,
  posKey: PositionKey | null,
  hostInstId: InstId | null,
): TimelineChip {
  if (!state.currentEncounter) {
    throw new Error("emitFutureChip: no current encounter");
  }
  const chipId = state.currentEncounter.nextChipId++;
  const cachedTempo = computeCachedTempo(state, card, side, loc);
  const chip: TimelineChip = {
    chipId,
    cardInstId: card.instId,
    side,
    loc,
    kind,
    posKey,
    state: "future",
    cachedTempo,
    ...(hostInstId != null ? { hostInstId } : {}),
  };
  state.currentEncounter.timeline.push(chip);
  routeChipToActiveSubPhaseQueue(state.currentEncounter, chip);
  return chip;
}

function computeCachedTempo(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): number {
  const def = getCardDef(card.defKey);
  if (def.type === "creature") {
    return effectiveStat(state, card, side, loc, "tempo");
  }
  // Non-creature: use the location's total Tempo on the committing side at commit moment.
  return locationStatTotal(state, side, loc, "tempo");
}

function routeChipToActiveSubPhaseQueue(enc: EncounterState, chip: TimelineChip): void {
  switch (enc.subPhase) {
    case "start":
      enc.flipQueues.startOfPhase.push(chip);
      return;
    case "phase":
      enc.flipQueues.midPhase.push(chip);
      return;
    case "end":
      enc.flipQueues.endOfPhase.push(chip);
      return;
  }
}

// ---------- Chip lifecycle ----------

/**
 * Mark a chip as resolved. Removes it from its sub-phase queue and leaves it in state.timeline
 * with state "resolved" (so the UI's past column can render it).
 *
 * Caller should have already mutated the underlying card (revealed = true, etc.) and written
 * the Past entry. This primitive is pure state mutation on the chip.
 */
export function markChipResolved(state: GameState, chip: TimelineChip): void {
  chip.state = "resolved";
  if (!state.currentEncounter) return;
  removeChipFromAllSubPhaseQueues(state.currentEncounter, chip.chipId);
}

function removeChipFromAllSubPhaseQueues(enc: EncounterState, chipId: number): void {
  for (const queueName of ["startOfPhase", "midPhase", "endOfPhase"] as const) {
    const queue = enc.flipQueues[queueName];
    const idx = queue.findIndex((c) => c.chipId === chipId);
    if (idx !== -1) queue.splice(idx, 1);
  }
}

/**
 * Remove a chip entirely from the encounter (timeline + queues). Used when the underlying card
 * leaves play before flipping (e.g., a face-down card torn by double-mark exile via some
 * theoretical effect that marks face-down cards).
 *
 * Phase E doesn't itself produce this case — it's hookable for future content.
 */
export function removeChipForCard(state: GameState, cardInstId: InstId): void {
  if (!state.currentEncounter) return;
  const enc = state.currentEncounter;
  enc.timeline = enc.timeline.filter((c) => c.cardInstId !== cardInstId);
  for (const queueName of ["startOfPhase", "midPhase", "endOfPhase"] as const) {
    enc.flipQueues[queueName] = enc.flipQueues[queueName].filter(
      (c) => c.cardInstId !== cardInstId,
    );
  }
}

// ---------- The Past ----------

/**
 * Append a Past entry. Called whenever a card flips face-up. Per §32: universal, all card types.
 *
 * Each entry records defKey, side, loc, turn, cardType — minimal snapshot. No tempo (ordering is
 * implicit by append order).
 */
export function writePastEntry(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): PastEntry {
  if (!state.currentEncounter) {
    throw new Error("writePastEntry: no current encounter");
  }
  const def = getCardDef(card.defKey);
  const entry: PastEntry = {
    defKey: card.defKey,
    side,
    loc,
    turn: state.currentEncounter.turn,
    cardType: def.type,
  };
  state.currentEncounter.past.push(entry);
  return entry;
}

// ---------- Past querying ----------

export interface PastFilter {
  side?: Side;
  loc?: string;
  cardType?: PastEntry["cardType"];
}

/**
 * Return Past entries matching a filter. Order preserved (oldest → newest by append order).
 * Used by Pillar-10-compliant content (random pick, oldest/newest, N-back).
 */
export function pastEntriesMatchingFilter(
  state: GameState,
  filter: PastFilter,
): PastEntry[] {
  if (!state.currentEncounter) return [];
  let entries = state.currentEncounter.past;
  if (filter.side != null) entries = entries.filter((e) => e.side === filter.side);
  if (filter.loc != null) entries = entries.filter((e) => e.loc === filter.loc);
  if (filter.cardType != null) entries = entries.filter((e) => e.cardType === filter.cardType);
  return entries;
}
