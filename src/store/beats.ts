// Beat helper that auto-notifies the store after each beat's callback runs.
//
// Contract: ENGINE_SKETCH.md Phase F.
//
// Use this wrapper for all store-level beat chains. The raw engine runBeat() doesn't notify
// the store — that's a store layer responsibility. runBeatN handles both concerns: schedules
// the beat via the engine scheduler, then calls notifyStateChanged after the callback runs.

import { runBeat } from "../engine/scheduler.ts";
import { notifyStateChanged } from "./index.ts";

/**
 * Schedule a beat that auto-notifies the store after running.
 *
 * Use this instead of engine's raw runBeat() in store-layer orchestrators.
 */
export function runBeatN(durationMs: number, next: () => void): void {
  runBeat(durationMs, () => {
    next();
    notifyStateChanged();
  });
}
