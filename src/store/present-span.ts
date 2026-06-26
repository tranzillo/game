// Present-span machine — the chip's dwell in the Present is the card's resolution.
//
// Per REBUILD_PLAN §32 + design conversation: the chip IS the visual representation of the card
// resolving. The chip stays in Present until the card's full resolution chain — flip-up trigger,
// downstream subscribers, cascading triggers, board animations the resolution generates — has
// fully drained. Only then does the chip drop to Past.
//
// Model: when a chip enters Present, we open a span. Resolution code calls queueResolutionBeat
// to append beats to the span. The orchestrator pulls beats off one at a time (via the engine's
// single-slot scheduler) until the queue is empty. A minimum-dwell floor is enforced as a tail
// beat so vanilla flips with no downstream work still let the player see the chip in Present.
//
// One chip in Present at a time — enforced by the singleton currentSpan.

import { runBeat } from "../engine/scheduler.ts";
import { notifyStateChanged } from "./index.ts";
import type { TimelineChip } from "../engine/types.ts";

interface QueuedBeat {
  durationMs: number;
  fn: () => void;
}

interface PresentSpan {
  chip: TimelineChip;
  queue: QueuedBeat[];
  elapsedMs: number;
  onClose: () => void;
}

let currentSpan: PresentSpan | null = null;

// Minimum visual dwell for any present span (ms). Floor for cards whose resolution generates
// no downstream work. A real cascading resolution will extend the span well past this.
const MIN_DWELL_MS = 380;

/**
 * Open a present span for a chip. The chip is already marked present and its immediate
 * resolution work (flip card, write past, fire onFlipUp, fire subscribers) has run.
 *
 * Any of that synchronous work may have queued resolution beats via queueResolutionBeat —
 * those are now in the span's queue. openPresentSpan starts draining them. When the queue is
 * empty AND the minimum dwell has elapsed, onClose fires.
 *
 * Throws if a span is already open.
 */
export function openPresentSpan(chip: TimelineChip, onClose: () => void): void {
  if (currentSpan != null) {
    throw new Error(
      `openPresentSpan: span already open for chip ${currentSpan.chip.chipId}; cannot open for ${chip.chipId}`,
    );
  }
  // The span may already have beats queued by the synchronous resolution code that ran before
  // openPresentSpan was called. We capture and replace its queue below; new beats queued by
  // those beats' fns get appended to the new queue, etc.
  const initialQueue = pendingPreOpenQueue;
  pendingPreOpenQueue = [];

  currentSpan = {
    chip,
    queue: initialQueue,
    elapsedMs: 0,
    onClose,
  };
  drainNextBeat();
}

/**
 * Queue a resolution beat. Valid both *before* openPresentSpan (during the synchronous
 * resolution-entry work, which queues beats before the span formally opens) and *during* the
 * span (downstream trigger handlers cascading).
 *
 * The fn runs after durationMs from when its turn in the queue arrives. Any new beats it
 * queues are appended to the same span — the chip stays in Present until they all drain.
 */
export function queueResolutionBeat(durationMs: number, fn: () => void): void {
  const beat: QueuedBeat = { durationMs, fn };
  if (currentSpan == null) {
    pendingPreOpenQueue.push(beat);
  } else {
    currentSpan.queue.push(beat);
  }
}

/**
 * Test/reset helper.
 */
export function _resetPresentSpan(): void {
  currentSpan = null;
  pendingPreOpenQueue = [];
}

/**
 * Inspector for the UI / debug — null if no span is open.
 */
export function activePresentChipId(): number | null {
  return currentSpan?.chip.chipId ?? null;
}

// Beats queued by synchronous resolution code that runs before openPresentSpan formally opens
// the span. openPresentSpan consumes this buffer.
let pendingPreOpenQueue: QueuedBeat[] = [];

function drainNextBeat(): void {
  if (currentSpan == null) return;

  const next = currentSpan.queue.shift();
  if (next != null) {
    const dur = next.durationMs;
    runBeat(dur, () => {
      if (currentSpan == null) return;
      currentSpan.elapsedMs += dur;
      try {
        next.fn();
      } finally {
        notifyStateChanged();
        drainNextBeat();
      }
    });
    return;
  }

  // Queue empty — enforce minimum dwell as a tail beat if we haven't met it yet.
  const remaining = MIN_DWELL_MS - currentSpan.elapsedMs;
  if (remaining > 0) {
    runBeat(remaining, () => {
      if (currentSpan == null) return;
      currentSpan.elapsedMs += remaining;
      // A tail-dwell tick might have triggered more queued beats (defensive) — re-drain.
      drainNextBeat();
    });
    return;
  }

  // Span closes.
  const onClose = currentSpan.onClose;
  currentSpan = null;
  onClose();
}
