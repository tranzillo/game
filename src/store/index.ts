// Store layer — Zustand bridge to engine state.
//
// Contract: ENGINE_SKETCH.md Phase F, REBUILD_PLAN §19/§23.
//
// The store does not own engine state. It owns a tick counter that bumps every time the engine
// mutates state. React components subscribe to the tick via useGameState() and re-render when
// the tick changes; the actual data lives in the engine state singleton.
//
// This shape:
// - Keeps the engine pure (engine doesn't know about React or Zustand).
// - Gives React a stable subscription point (the tick).
// - Avoids the "two writers" problem from the failed port: engine writes engine state, store
//   notifies, React reads. No reverse flow.

import { create } from "zustand";
import { getEngineState } from "./engine-state.ts";
import type { GameState } from "../engine/types.ts";

// ---------- Tick store (Zustand) ----------

interface StoreShape {
  tick: number;
  notify: () => void;
}

export const useTickStore = create<StoreShape>((set) => ({
  tick: 0,
  notify: () => set((s) => ({ tick: s.tick + 1 })),
}));

/**
 * Bump the tick. Call after any engine mutation that React should reflect.
 *
 * The engine itself doesn't call this — engine functions are pure mutations on state. Store
 * actions (the wrappers React click handlers call) call this after their engine work.
 *
 * Phase F is the scaffold; Phase G+ introduces real store actions.
 */
export function notifyStateChanged(): void {
  useTickStore.getState().notify();
}

// ---------- Subscription hook ----------

/**
 * Subscribe to engine state. Re-renders the calling component whenever notifyStateChanged is
 * called. Returns the current GameState reference.
 *
 * The "snapshot" is the current GameState reference; the engine treats state as mutable so
 * the reference is stable across renders. React rerenders are driven by the tick counter, not
 * by reference equality.
 */
export function useGameState(): GameState {
  // Subscribe to the Zustand tick to trigger re-renders. The returned value is unused — we
  // read state via getEngineState() below — but subscribing to s.tick wires the rerender.
  useTickStore((s) => s.tick);
  return getEngineState();
}

/**
 * Get the current GameState without subscribing (for use outside React, e.g., in store actions
 * or event handlers).
 */
export function getState(): GameState {
  return getEngineState();
}
