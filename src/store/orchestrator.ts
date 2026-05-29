// Orchestrator — beat-chained advance flow for the Phase G slice.
//
// Contract: ENGINE_SKETCH.md Phase G, REBUILD_PLAN §20/§28.
//
// Phase G scope: main → flip queue → next turn loop. No combat, no win condition, no piles
// routing beyond what flip-up resolution itself needs.
//
// Sequence when player clicks advance from main/start:
//   1. Close play window. Commit pending: for each pending slot, set card.revealed=false and
//      move it to the committed slot map. Emit a chip into the active sub-phase queue
//      (startOfPhase for main/start).
//   2. Sort the startOfPhase queue per the four-level hierarchy (Phase E).
//   3. For each chip: beat → flip card face-up (revealed=true), fire onFlipUp via Phase G's
//      trigger dispatcher, write past entry, mark chip resolved → wait → next chip.
//   4. After queue drains: advance to subPhase "phase". Main's substantive action is a no-op,
//      so jump to subPhase "end" → next phase. For the slice we wrap around to next turn.

import { commitPendingForAdvance, popNextChipFromStartQueue, startNewTurn } from "./advance-helpers.ts";
import { fireFlipUpTrigger } from "../engine/triggers.ts";
import { markChipResolved, writePastEntry } from "../engine/timeline.ts";
import { sortChipQueueInPlace } from "../engine/flip-order.ts";
import { emit } from "../engine/events.ts";
import { endSequence, startSequence, isPlaying } from "../engine/scheduler.ts";
import { runBeatN } from "./beats.ts";
import { getEngineState } from "./engine-state.ts";
import { notifyStateChanged } from "./index.ts";

// Beat durations (ms). Phase N tunes these.
const BEAT_MS = {
  commit: 280,
  flipReveal: 320,
  flipResolve: 240,
  phaseDivider: 400,
};

/**
 * Player clicks "Advance Phase".
 *
 * If the engine is already mid-beat-chain (isPlaying), do nothing. Else start the flow.
 */
export function actionAdvancePhase(): void {
  const state = getEngineState();
  if (!state.currentEncounter) return;
  if (isPlaying()) return;

  startSequence();
  emit(state, "phase-divider", { from: state.currentEncounter.phase });

  // 1. Commit pending plays into the committed slot map. Emit chips.
  commitPendingForAdvance(state);
  notifyStateChanged();

  // 2. Sort the flip queue for this sub-phase.
  sortChipQueueInPlace(state, state.currentEncounter.flipQueues.startOfPhase);

  // 3. Beat-chained flip drain.
  runBeatN(BEAT_MS.commit, () => {
    drainNextChipBeat();
  });
}

function drainNextChipBeat(): void {
  const state = getEngineState();
  if (!state.currentEncounter) {
    endSequence();
    return;
  }

  const chip = popNextChipFromStartQueue(state);
  if (!chip) {
    // Queue empty. Slice flow: just start the next turn.
    startNewTurn(state);
    notifyStateChanged();
    endSequence();
    return;
  }

  // Flip the card.
  const card = state.cards[chip.cardInstId];
  if (!card) {
    drainNextChipBeat();
    return;
  }
  card.revealed = true;
  emit(state, "flip", {
    instId: card.instId,
    side: chip.side,
    loc: chip.loc,
    posKey: chip.posKey,
  });
  writePastEntry(state, card, chip.side, chip.loc);
  notifyStateChanged();

  runBeatN(BEAT_MS.flipReveal, () => {
    // Fire onFlipUp trigger.
    fireFlipUpTrigger(state, card, chip.side, chip.loc);
    markChipResolved(state, chip);
    notifyStateChanged();

    runBeatN(BEAT_MS.flipResolve, () => {
      drainNextChipBeat();
    });
  });
}
