import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App.tsx";
import { registerAnimationHandler } from "./ui/animations/events.ts";
import { registerSliceContent } from "./data/slice-content.ts";

// Register the engine event handler once at boot (per REBUILD_PLAN §21 — single subscriber).
registerAnimationHandler();
// Register slice content (Phase G validation).
registerSliceContent();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
