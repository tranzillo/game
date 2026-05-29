// Engine event → animation dispatcher.
//
// Contract: ENGINE_SKETCH.md Phase F, REBUILD_PLAN §21.
//
// Phase F stub: subscribes the single handler to engine events at boot. The dispatch is just
// a console.log per event kind. Phase G+ replaces the dispatch with real animations (Framer
// Motion variant triggers + non-transform CSS class flashes per AL #5).
//
// The handler MUST NOT block. Add a CSS class, kick off a transition, then return.

import { subscribe } from "../../engine/events.ts";
import type { EngineEvent } from "../../engine/types.ts";

function handleEngineEvent(ev: EngineEvent): void {
  // Phase F stub — Phase H+ adds real per-kind animation dispatch.
  // eslint-disable-next-line no-console
  console.log(`[engine event] ${ev.kind}`, ev);
}

/**
 * Register the single event handler. Call once at boot from main.tsx.
 */
export function registerAnimationHandler(): void {
  subscribe(handleEngineEvent);
}
