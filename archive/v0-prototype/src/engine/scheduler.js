// Beat scheduler — the timer-driven heartbeat of the engine.
//
// Per REBUILD_PLAN.md section 20:
// - The engine is reactive. It does nothing on its own. When an input arrives (player click
//   or scheduled beat continuation), it processes one beat, then either ends OR schedules
//   the next beat via runBeat().
// - Each beat is a synchronous function. After it runs, it may call runBeat(durationMs, next)
//   to schedule itself.
// - The engine NEVER awaits anything. Every continuation is a setTimeout.
//
// This is the ONLY place setTimeout is called for engine-internal pacing. Animations may
// use their own setTimeouts in the UI; that's separate.
//
// The isPlaying flag distinguishes "engine is mid-sequence" from "engine is waiting for
// player input." Click handlers gate on this flag.

let _isPlaying = false;
let _pendingTimer = null;
let _speedMult = 1;

// Read flag. UI click handlers call this and bail if true.
export function isPlaying() { return _isPlaying; }

// Set global speed multiplier. 1 = normal, 0.5 = double speed, 2 = half speed, 0.01 = nearly
// instant. Per-event duration tables in the UI side scale by this.
export function setSpeed(mult) {
  const n = parseFloat(mult);
  if (!Number.isFinite(n) || n <= 0) return;
  _speedMult = n;
}
export function getSpeed() { return _speedMult; }

// Schedule the next beat. After `durationMs * speed` ms, call nextBeatFn synchronously.
//
// startSequence(): mark engine as playing. Required before the first runBeat in a chain so
// click gating kicks in immediately.
//
// runBeat(): the recurring scheduler step. Sets _isPlaying = true (in case caller forgot
// startSequence), schedules nextBeatFn after duration.
//
// endSequence(): mark engine as idle. Called by terminal beats (e.g., the beat that lands
// in interactive main phase) to release click gating.
//
// All three are simple — no fancy promise plumbing.

export function startSequence() {
  _isPlaying = true;
}

export function runBeat(durationMs, nextBeatFn) {
  _isPlaying = true;
  if (_pendingTimer != null) clearTimeout(_pendingTimer);
  const wait = Math.max(0, durationMs * _speedMult);
  _pendingTimer = setTimeout(() => {
    _pendingTimer = null;
    try {
      nextBeatFn();
    } catch (e) {
      // Don't let a beat error stall future beats forever — the sequence will end on the
      // next user click. Log so we can debug.
      console.error("Beat error:", e);
      _isPlaying = false;
    }
  }, wait);
}

export function endSequence() {
  _isPlaying = false;
}

// Cancel any pending beat. Used when state is reset (encounter end, restart) to avoid
// stray beats firing after the state they referenced is gone.
export function cancelAll() {
  if (_pendingTimer != null) {
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
  }
  _isPlaying = false;
}
