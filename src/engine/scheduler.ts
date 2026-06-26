// Beat scheduler — the timer-driven heartbeat of the engine.
//
// Contract: ENGINE_SKETCH.md Phase F, REBUILD_PLAN §20.
//
// - The engine is reactive. It only acts when an input arrives (player click or scheduled
//   continuation).
// - Each beat is a synchronous function. After it runs, it may call runBeat(durationMs, next)
//   to schedule itself.
// - The engine NEVER awaits anything. Every continuation is a setTimeout.
// - This is the ONLY place setTimeout is called for engine-internal pacing. Animations may use
//   their own setTimeouts in the UI; that's separate.
//
// isPlaying flag: tells click handlers whether the engine is mid-sequence.
// setSpeed: global pacing multiplier. 1 = normal; 0.5 = double speed; 2 = half speed; very
// small = nearly instant. Tests can set 0 for sync-ish behavior.

let isPlayingFlag = false;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let speedMult = 1;

// Observers notified whenever the isPlaying flag transitions. The store registers one so the
// UI re-renders the moment resolution starts/ends — the view machine gates zoom + advance on
// isPlaying(), and a terminal beat that ends the sequence without its own notify would otherwise
// leave the UI gated. Engine→store import is forbidden (dependency direction), so the store
// pushes a callback in instead.
const idleObservers: Array<() => void> = [];

export function onPlayingChange(fn: () => void): void {
  idleObservers.push(fn);
}

function setPlaying(next: boolean): void {
  if (isPlayingFlag === next) return;
  isPlayingFlag = next;
  for (const fn of idleObservers) fn();
}

/**
 * True iff the engine is mid-beat-chain. UI click handlers should gate on this.
 */
export function isPlaying(): boolean {
  return isPlayingFlag;
}

/**
 * Mark the engine as playing without scheduling a beat. Used by orchestrators that want to
 * gate clicks before the first beat fires.
 */
export function startSequence(): void {
  setPlaying(true);
}

/**
 * Mark the engine as idle. Terminal beats call this so click handlers are re-enabled.
 */
export function endSequence(): void {
  setPlaying(false);
}

/**
 * Set the global speed multiplier. Values <= 0 are rejected.
 */
export function setSpeed(mult: number): void {
  if (!Number.isFinite(mult) || mult <= 0) return;
  speedMult = mult;
}

export function getSpeed(): number {
  return speedMult;
}

/**
 * Schedule the next beat after durationMs * speed. After the timer fires, nextBeatFn runs
 * synchronously. If nextBeatFn throws, the error is logged and the engine is marked idle.
 *
 * If a beat is already pending when runBeat is called, the pending beat is cancelled (the
 * caller's new beat replaces it). This is intentional — most orchestrators don't queue multiple
 * beats at once.
 */
export function runBeat(durationMs: number, nextBeatFn: () => void): void {
  setPlaying(true);
  if (pendingTimer != null) clearTimeout(pendingTimer);
  const wait = Math.max(0, durationMs * speedMult);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    try {
      nextBeatFn();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Beat error:", e);
      setPlaying(false);
    }
  }, wait);
}

/**
 * Cancel any pending beat and mark the engine as idle. Called at encounter end / reset.
 */
export function cancelAll(): void {
  if (pendingTimer != null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  setPlaying(false);
}

/**
 * Test-only: reset internal state between tests.
 */
export function _resetScheduler(): void {
  if (pendingTimer != null) clearTimeout(pendingTimer);
  pendingTimer = null;
  isPlayingFlag = false;
  speedMult = 1;
}
