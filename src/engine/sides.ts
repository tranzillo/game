// Side helpers — trivial operations on the two-sided model.
//
// `Side` is "player" | "ai". The opponent-flip (`side === "player" ? "ai" : "player"`) was
// duplicated across many content handlers and engine gatherers; this is its one home.

import type { Side } from "./types.ts";

/** The opposing side. */
export function opponentOf(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

/** Alias kept for existing callers (costs.ts, tests). Prefer `opponentOf`. */
export const other = opponentOf;
