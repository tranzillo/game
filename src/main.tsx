import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App.tsx";
import { registerAnimationHandler } from "./ui/animations/events.ts";

// Register the engine event handler once at boot (per REBUILD_PLAN §21 — single subscriber).
registerAnimationHandler();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
