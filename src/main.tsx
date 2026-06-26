import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App.tsx";
import { onPlayingChange } from "./engine/scheduler.ts";
import { notifyStateChanged } from "./store/index.ts";
import { registerAnimationHandler } from "./ui/animations/events.ts";
import { registerSliceContent } from "./data/slice-content.ts";
import { registerRedContent } from "./data/red-content.ts";
import { registerGreenContent } from "./data/green-content.ts";
import { registerLocationContent } from "./data/location-content.ts";

// Register the engine event handler once at boot (per REBUILD_PLAN §21 — single subscriber).
registerAnimationHandler();
// Re-render the UI whenever the engine starts/finishes resolving, so the view machine's
// zoom + advance gating (which reads isPlaying()) always reflects the current beat state.
onPlayingChange(() => notifyStateChanged());
// Register Red content (Phase M.1 + M.2 — full prototype Red roster r1-r14).
registerRedContent();
// Register Green content (Phase M.3 slice 1 — g3 Sapper, g4 Slinger, g6 Forage, g8 Saboteur,
// g_trap Explosive Trap). Deferred: g1, g2, g5, g7 (need cross-loc movement / Reroute / stealth).
registerGreenContent();
// Register location texts (§34 slice 4 — ogreHideaway; locP1/locP2 ports deferred).
registerLocationContent();
// Register slice content (Spark, Vengeful Watcher — confirmed real content).
registerSliceContent();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
