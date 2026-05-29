// Engine event boundary — synchronous emit, single subscriber.
//
// Contract: ENGINE_SKETCH.md Phase F, REBUILD_PLAN §21.
//
// Per §21:
// - emit(state, kind, payload) creates an envelope (id, kind, turn, phase, payload), pushes
//   it to state.currentEncounter.outcomes (the encounter event log), and calls the
//   registered handler synchronously.
// - One handler may be subscribed at boot. subscribe replaces any previous registration.
// - Handler must not block. Add a CSS class, kick off a Framer transition, then return.
// - Headless mode (no handler): events still push to outcomes for the log.
// - The engine NEVER awaits the UI; the engine NEVER reads UI state.
//
// Reset: resetEvents() clears the monotonic event id counter at encounter start.

import type { EngineEvent, GameState } from "./types.ts";

// ---------- Internal singletons ----------

let nextEventId = 1;
let handler: ((ev: EngineEvent) => void) | null = null;

// ---------- Public API ----------

/**
 * Register the single event handler. Replaces any previous registration.
 * Pass null to unregister (useful for headless tests).
 */
export function subscribe(h: ((ev: EngineEvent) => void) | null): void {
  handler = h;
}

/**
 * Emit a synchronous event. Pushes to state.currentEncounter.outcomes and calls the handler.
 *
 * Returns the constructed event so callers can chain/observe.
 *
 * If no encounter is active, the event is still constructed and the handler is still called,
 * but the outcomes log isn't appended to (no encounter container exists). Turn/phase fields
 * are 0 / "upkeep" by default when no encounter is active.
 */
export function emit(
  state: GameState,
  kind: string,
  payload: Record<string, unknown> = {},
): EngineEvent {
  const enc = state.currentEncounter;
  const ev: EngineEvent = {
    id: nextEventId++,
    kind,
    turn: enc?.turn ?? 0,
    phase: enc?.phase ?? "upkeep",
    payload,
  };
  if (enc) enc.outcomes.push(ev);
  if (handler) {
    try {
      handler(ev);
    } catch (e) {
      // Handler errors must not break the engine. Log and continue.
      // eslint-disable-next-line no-console
      console.error("Engine event handler error:", e, ev);
    }
  }
  return ev;
}

/**
 * Reset the event id counter. Called at encounter start.
 */
export function resetEvents(): void {
  nextEventId = 1;
}

/**
 * Test-only: read the current handler (or null). Used by Phase F tests to verify subscription.
 */
export function _getCurrentHandler(): ((ev: EngineEvent) => void) | null {
  return handler;
}
