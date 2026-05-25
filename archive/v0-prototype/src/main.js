import { setState } from "./engine/state.js";
import { freshState } from "./engine/run.js";
import { logEntry } from "./engine/log.js";
import { render, hideGameOver } from "./ui/render.js";

// ---------- Init / wiring ----------
export function start() {
  setState(freshState());
  hideGameOver();
  logEntry(`v3 prototype — pick a starter deck to begin.`);
  render();
}

// Import for side effects: registers the DOMContentLoaded handler that wires buttons
// and calls start(). The button-wiring lived in the old Export section; preserved here.
import "./ui/export.js";
