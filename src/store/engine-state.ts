// Engine state singleton accessor.
//
// Contract: ENGINE_SKETCH.md Phase F.
//
// The engine state itself (the GameState object) is held here as a mutable singleton.
// The store doesn't own state — it owns a tick counter that bumps on every notifyStateChanged.
// React components read state directly via useGameState() (which subscribes to the tick).
//
// This file is the bridge: it owns the GameState reference and exposes setEngineState /
// getEngineState. The Zustand store imports from here.

import type { GameState } from "../engine/types.ts";
import { freshGameState } from "../engine/state.ts";

let current: GameState | null = null;

export function getEngineState(): GameState {
  if (!current) {
    current = freshGameState();
  }
  return current;
}

export function setEngineState(state: GameState | null): void {
  current = state;
}

/**
 * Reset the engine state to a fresh one. Useful for tests and for restart flows.
 */
export function resetEngineState(): GameState {
  current = freshGameState();
  return current;
}
