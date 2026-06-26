// AI summoner commit loop — places the AI's main-phase plays.
//
// Per §29: the AI does NOT use the pending map. Its commits go straight to committed-face-down
// with a future chip, synchronously during the player's advance out of main. So this mirrors
// commitPendingForAdvance, but sourced from the scorer (aiPickBestPlay) rather than a pending map,
// and it commits one best play at a time until nothing scores.

import { aiPickBestPlay } from "../engine/ai.ts";
import { getCardDef } from "../engine/cards.ts";
import { emitFutureChip } from "../engine/timeline.ts";
import type { GameState, TimelineChip } from "../engine/types.ts";

const AI_SAFETY_CAP = 64; // backstop against a scorer bug looping forever

/**
 * Commit the AI summoner's main-phase plays: repeatedly pick the best legal (card, loc, pos) and
 * commit it face-down (emit a future chip), removing the card from the AI's hand. Stops when no
 * play scores (or the safety cap trips). No-op if the summoner isn't present (no aiSide).
 *
 * Returns the number of cards committed (for logging / tests).
 */
export function aiCommitMainPlays(state: GameState): number {
  const enc = state.currentEncounter;
  if (!enc || !enc.aiSide) return 0;

  let committed = 0;
  let safety = AI_SAFETY_CAP;
  while (safety-- > 0) {
    const best = aiPickBestPlay(state);
    if (!best) break;
    commitAiCardFaceDown(state, best.card.instId, best.loc, best.kind, best.pos);
    committed++;
  }
  return committed;
}

/**
 * Move one AI card from hand → committed face-down at a single slot, and emit its future chip.
 * Single-slot only for now (the minimal scorer never picks multi-slot footprints; multi-slot AI
 * placement is a later pass).
 */
function commitAiCardFaceDown(
  state: GameState,
  instId: number,
  loc: string,
  kind: "creature" | "structure" | "action",
  pos: string,
): void {
  const enc = state.currentEncounter;
  if (!enc || !enc.aiSide) return;
  const card = state.cards[instId];
  if (!card) return;
  const ns = state.world.nodeState[loc];
  if (!ns) return;

  // Remove from the AI hand.
  const handIdx = enc.aiSide.hand.indexOf(instId);
  if (handIdx !== -1) enc.aiSide.hand.splice(handIdx, 1);

  // Place committed face-down.
  card.revealed = false;
  card.slots = [pos];
  const map =
    kind === "creature"
      ? ns.sideSlots.ai.creatures
      : kind === "structure"
        ? ns.sideSlots.ai.structures
        : ns.sideSlots.ai.actions;
  map[pos] = instId;

  // Emit the future chip (same path the player's commit uses).
  const def = getCardDef(card.defKey);
  const chipKind: TimelineChip["kind"] = def.type === "equipment" ? "equipment" : def.type;
  emitFutureChip(state, card, "ai", loc, chipKind, pos, null);
}
