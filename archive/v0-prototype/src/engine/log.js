import { state } from "./state.js";

// ---------- Logging ----------
export function logEntry(msg, kind = "") {
  state.log.push({ msg, kind });
  if (state.log.length > 200) state.log.shift();
}
