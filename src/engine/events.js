// Engine→UI event boundary. Single-handler subscriber model, synchronous emit.
//
// Per REBUILD_PLAN.md sections 20–21:
// - The engine emits events synchronously via emit(event).
// - The UI registers ONE handler at startup via subscribe(handler).
// - When the engine emits, the handler runs synchronously (no await, no promises crossing
//   the boundary). The handler is expected to schedule its own work (CSS animations, DOM
//   updates) and return immediately.
// - There is NO queue, NO buffering, NO replay. The handler sees events in emit order.
//
// The engine NEVER awaits the UI. The engine NEVER reads UI state. This boundary is the
// reason hangs are structurally impossible.
//
// In test/headless mode (no handler subscribed), emit is a no-op for the UI side; events
// still get pushed onto state.outcomes for the historical log.

import { state } from "./state.js";

// Monotonic event id; resets per encounter via resetEvents().
let _nextEventId = 1;

// Currently-registered handler. Single handler. Replaces any previous registration.
let _handler = null;

export function subscribe(handler) {
  _handler = handler;
}

// Emit an event. Synchronous. Pushes to state.outcomes (the persistent log) AND calls the
// registered handler (if any) with the event.
//
// Standard envelope fields (id, turn, phase) are added here. Callers only provide kind and
// payload fields.
export function emit(kind, payload = {}) {
  const event = {
    id: _nextEventId++,
    kind,
    turn: state ? state.turn : null,
    phase: state ? state.phase : null,
    ...payload
  };
  if (state && state.outcomes) state.outcomes.push(event);
  if (_handler) {
    try {
      _handler(event);
    } catch (e) {
      // Don't let UI errors break the engine. Log and continue.
      console.error("Event handler error:", e, event);
    }
  }
  return event;
}

// Reset the event id counter. Called at encounter start so each encounter's outcomes start
// at id 1 (consumer-friendly).
export function resetEvents() {
  _nextEventId = 1;
}
