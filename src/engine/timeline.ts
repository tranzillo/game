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
 * The chip is appended to the run-scoped state.timeline AND to the active sub-phase queue. The
 * two serve different roles — timeline is the persistent visual stream (chips live there for the
 * whole run; resolved chips ARE the Past), the queue is this encounter's transient drain order.
 *
 * The chip is stamped with the current {encounter, turn, phase} timestamp and cardType, so the
 * Past can be grouped/scoped/queried without a parallel PastEntry object.
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
  const enc = state.currentEncounter;
  if (!enc) {
    throw new Error("emitFutureChip: no current encounter");
  }
  const chipId = state.nextChipId++;
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
    encounter: enc.encounterNo,
    turn: enc.turn,
    phase: enc.phase,
    cardType: getCardDef(card.defKey).type,
    ...(hostInstId != null ? { hostInstId } : {}),
  };
  state.timeline.push(chip);
  routeChipToActiveSubPhaseQueue(enc, chip);
  return chip;
}

function computeCachedTempo(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): number {
  const def = getCardDef(card.defKey);
  // Permanents flip on their own Tempo (DECISIONS 2026-06-12): creatures use the full effective
  // read; structures/equipment use printed Tempo (effectiveStat returns 0 for non-creatures).
  if (def.type === "creature") {
    return effectiveStat(state, card, side, loc, "tempo");
  }
  if (def.type === "structure" || def.type === "equipment") {
    return def.tempo ?? 0;
  }
  // Actions don't print stats — their tempo is the committing side's total Tempo at the
  // location at commit moment.
  return locationStatTotal(state, side, loc, "tempo");
}

// ---------- Pending preview chips ----------

/**
 * Preview chips for the player's PENDING placements, per the design: "the future updates in
 * real time with the player's card placement choices — the player should see the order of the
 * cards before they commit to that order."
 *
 * These are ephemeral objects for display only (negative chipIds, never stored in
 * state.timeline). Tempo is computed with the SAME formula commit uses (computeCachedTempo),
 * so the previewed order matches what the real chips will get at commit. Canceling a pending
 * placement makes its preview vanish on the next render; advancing replaces previews with the
 * real chips.
 */
export function buildPendingPreviewChips(state: GameState): TimelineChip[] {
  const enc = state.currentEncounter;
  if (!enc) return [];
  const out: TimelineChip[] = [];
  let previewId = -1;
  for (const loc of enc.locationNodeIds) {
    const locData = enc.locationData[loc];
    if (!locData) continue;
    for (const kind of ["creature", "structure", "action"] as const) {
      const map =
        kind === "creature"
          ? locData.pending.creatures
          : kind === "structure"
            ? locData.pending.structures
            : locData.pending.actions;
      const seen = new Set<InstId>();
      for (const pos of Object.keys(map)) {
        const instId = map[pos];
        if (instId == null || seen.has(instId)) continue;
        seen.add(instId);
        const card = state.cards[instId];
        if (!card) continue;
        out.push({
          chipId: previewId--,
          cardInstId: instId,
          side: "player", // only the player has pending placements (§29)
          loc,
          kind,
          posKey: card.slots[0] ?? pos,
          state: "future",
          cachedTempo: computeCachedTempo(state, card, "player", loc),
          encounter: enc.encounterNo,
          turn: enc.turn,
          phase: enc.phase,
          cardType: getCardDef(card.defKey).type,
        });
      }
    }
  }
  return out;
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
 * Mark a chip as "present" — actively flipping right now. Removes it from its sub-phase queue
 * (so the next pop sees the chip behind it) but leaves it in state.timeline so the UI's present
 * zone can render it. The orchestrator then drives the reveal + onFlipUp + markChipResolved.
 */
export function markChipPresent(state: GameState, chip: TimelineChip): void {
  chip.state = "present";
  if (!state.currentEncounter) return;
  removeChipFromAllSubPhaseQueues(state.currentEncounter, chip.chipId);
}

/**
 * Mark a chip as resolved. Idempotent against queue removal (a chip already in "present" has
 * already been popped). Leaves the chip in state.timeline with state "resolved" so the UI's past
 * column can render it.
 *
 * Stamps the chip's resolveSeq with a monotonic counter so the Past reads in FLIP order, not
 * commit order: state.timeline is appended in commit order, but chips flip in sorted
 * Tempo/initiative order — without this stamp the Past would mis-order resolved chips. Idempotent:
 * a chip already stamped keeps its original sequence.
 *
 * Caller should have already mutated the underlying card (revealed = true, etc.). This primitive
 * is otherwise pure state mutation on the chip.
 */
export function markChipResolved(state: GameState, chip: TimelineChip): void {
  chip.state = "resolved";
  if (chip.resolveSeq == null) {
    chip.resolveSeq = state.nextResolveSeq++;
  }
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
  state.timeline = state.timeline.filter((c) => c.cardInstId !== cardInstId);
  if (!state.currentEncounter) return;
  const enc = state.currentEncounter;
  for (const queueName of ["startOfPhase", "midPhase", "endOfPhase"] as const) {
    enc.flipQueues[queueName] = enc.flipQueues[queueName].filter(
      (c) => c.cardInstId !== cardInstId,
    );
  }
}

// ---------- The Past ----------
//
// The Past is no longer a parallel object list — the RESOLVED chips in the run-scoped
// state.timeline ARE the Past (DECISIONS 2026-06-13). A chip flipping up is recorded simply by
// markChipResolved setting its state to "resolved"; it already carries its {encounter, turn,
// phase, loc, side, cardType} timestamp from emission. Querying the Past = filtering resolved
// chips.

export interface PastFilter {
  side?: Side;
  loc?: string;
  cardType?: TimelineChip["cardType"];
  // The Past is run-scoped. Most current-encounter content filters to the active encounter via
  // `encounter`; omit it to reach the whole run (the gated cross-encounter reach, per §34).
  encounter?: number;
}

/**
 * Return resolved chips matching a filter — the Past, queryable. Ordered oldest → newest by
 * FLIP order (resolveSeq), NOT by commit/append order: chips are appended to state.timeline when
 * committed, but the Past is the record of flip-ups in the order they resolved. Used by
 * Pillar-10-compliant content (random pick, oldest/newest, N-back).
 *
 * Callers that mean "this encounter only" pass `encounter: state.currentEncounter.encounterNo`;
 * callers reaching across the run omit it.
 */
export function pastEntriesMatchingFilter(
  state: GameState,
  filter: PastFilter,
): TimelineChip[] {
  let entries = state.timeline.filter((c) => c.state === "resolved");
  if (filter.encounter != null) entries = entries.filter((e) => e.encounter === filter.encounter);
  if (filter.side != null) entries = entries.filter((e) => e.side === filter.side);
  if (filter.loc != null) entries = entries.filter((e) => e.loc === filter.loc);
  if (filter.cardType != null) entries = entries.filter((e) => e.cardType === filter.cardType);
  // Sort by resolution order (flip order). resolveSeq is always set on resolved chips; the ?? 0
  // guard is defensive for any chip mutated to "resolved" outside markChipResolved.
  return entries.sort((a, b) => (a.resolveSeq ?? 0) - (b.resolveSeq ?? 0));
}
