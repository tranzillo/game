// Top-level component — Phase F scaffold.
//
// Renders a diagnostic state snapshot to confirm the engine→store→UI boundary works.
// Phase G+ replaces this with the actual game UI components.

import { useGameState, useTickStore, notifyStateChanged } from "../store/index.ts";
import { emit } from "../engine/events.ts";

export function App() {
  const state = useGameState();
  const tick = useTickStore((s) => s.tick);

  function smokeTest(): void {
    // Smoke-test the boundary: emit an event + bump the tick.
    emit(state, "smokeTest", { source: "App button" });
    notifyStateChanged();
  }

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        lineHeight: 1.5,
        color: "#e8e8e8",
        background: "#08080c",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 20, marginTop: 0 }}>v1 — Phase F scaffold</h1>
      <p style={{ color: "#aaa", marginTop: 0 }}>
        Engine → Zustand → React boundary is wired. The engine owns state. The store carries a
        tick that bumps on every <code>notifyStateChanged()</code>. React reads engine state
        directly. No encounter is loaded yet — Phase G builds the vertical slice.
      </p>
      <pre
        style={{
          background: "#15151c",
          padding: 12,
          borderRadius: 4,
          fontSize: 12,
          border: "1px solid #2a2a35",
        }}
      >
        {[
          `tick:           ${tick}`,
          `runDurability:  ${state.runDurability}`,
          `cards in registry: ${Object.keys(state.cards).length}`,
          `currentEncounter: ${state.currentEncounter ? "loaded" : "null"}`,
          `trash:          ${state.trash.length} cards`,
          `runOver:        ${state.runOver ?? "null"}`,
        ].join("\n")}
      </pre>
      <button
        onClick={smokeTest}
        style={{
          background: "#1a1a22",
          color: "#e8e8e8",
          border: "1px solid #2a2a35",
          padding: "8px 14px",
          fontSize: 12,
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Smoke test: emit + notify
      </button>
      <p style={{ color: "#666", fontSize: 11, marginTop: 16 }}>
        Open the dev console. Each click should log an <code>[engine event]</code> line AND
        bump the tick value above.
      </p>
    </div>
  );
}
