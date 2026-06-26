// AI summoner play logic — the heuristic scorer + legal-placement enumeration.
//
// Per DESIGN Pillar 10 + the prototype's ai.js: the AI picks the highest-scoring legal
// (card, location, position) tuple and commits it, repeating until nothing scores. There is NO
// search or learning — intelligence is designer-authored deck composition + a small scoring
// function (+ per-card hints later). The AI cheats transparently.
//
// This is the MINIMAL first-cut scorer (DECISIONS 2026-06-13 build choice): cost-magnitude
// weight + front-row bias + fill-empty-slots. No per-card aiHints yet — that's a later pass.
//
// Placement model (§29): the AI does NOT use the pending map. Its commits go straight to
// committed-face-down with a future chip, synchronously during the player's advance. So the
// legality here checks COMMITTED slots only (no pending), and the caller commits directly.

import { getCardDef } from "./cards.ts";
import { evaluateCost } from "./costs.ts";
import { isAiPresentAt } from "./presence.ts";
import { positionsOf } from "./profile.ts";
import type { CardInstance, GameState, PositionKey, SlotKind } from "./types.ts";

export interface AiPlay {
  card: CardInstance;
  loc: string;
  kind: SlotKind;
  pos: PositionKey;
  score: number;
}

/**
 * The kind of slot a card occupies. Equipment has no AI commit flow yet (mirrors the player's
 * isCardPlayable, which also excludes equipment).
 */
function slotKindOf(card: CardInstance): SlotKind | null {
  const t = getCardDef(card.defKey).type;
  if (t === "creature") return "creature";
  if (t === "structure") return "structure";
  if (t === "action") return "action";
  return null; // equipment — deferred
}

/**
 * Can the AI commit `card` at this committed slot right now? AI-side analogue of canPlaceAt,
 * but checks COMMITTED slots only (the AI has no pending) and gates on the AI side.
 *
 * Gates: AI present at this location · kind matches · commit window (§28: permanents in main
 * only, actions any phase) · location not player-cleared · cost met at this loc for the AI ·
 * committed slot empty.
 */
export function canAiPlaceAt(
  state: GameState,
  card: CardInstance,
  loc: string,
  kind: SlotKind,
  pos: PositionKey,
): boolean {
  const enc = state.currentEncounter;
  if (!enc || !enc.aiSide) return false;
  // The AI may only commit at locations where its summoner is PRESENT — i.e. where it already has
  // aiDeck-origin cards (REBUILD_PLAN §29: "a summoner is present at a location iff their
  // summoner-position is adjacent to that location"; §3: neutral = no opposing summoner present).
  // Pre-authored biome content on AI slots does NOT make the AI present (isAiPresentAt gates on
  // origin === "aiDeck"), so a location the player reads as neutral stays AI-free — the AI never
  // plays cards into a neutral location. (Adjacency-spread into reachable-but-not-yet-present
  // locations is a later layer; today presence is "has aiDeck cards here".)
  if (!isAiPresentAt(state, loc)) return false;
  if (slotKindOf(card) !== kind) return false;
  const def = getCardDef(card.defKey);
  if (def.type !== "action" && enc.phase !== "main") return false;
  // A location the player has CLEARED (persistent flag, set at end of cleanup) is closed. Use the
  // flag, not isLocationClearedByPlayer — the latter reads "no AI creatures here right now", which
  // is true of any not-yet-occupied location the AI is about to play into.
  if (enc.playerLocationCleared[loc]) return false;
  if (!evaluateCost(state, card, "ai", loc)) return false;

  const ns = state.world.nodeState[loc];
  if (!ns) return false;
  const map =
    kind === "creature"
      ? ns.sideSlots.ai.creatures
      : kind === "structure"
        ? ns.sideSlots.ai.structures
        : ns.sideSlots.ai.actions;
  return map[pos] == null;
}

/**
 * Minimal scorer: favor expensive plays (commit value), prefer the front row (pressure), and
 * lightly prefer filling empty columns. Returns null to disqualify a tuple.
 */
export function scoreAiPlay(
  state: GameState,
  card: CardInstance,
  loc: string,
  kind: SlotKind,
  pos: PositionKey,
): number {
  const def = getCardDef(card.defKey);
  let score = 0;

  // Cost magnitude — spend big plays first. Absolute costs weight by their threshold; comparative
  // costs (">F opp" etc.) have no numeric amount, so count as a flat unit of commitment.
  for (const c of def.costs) score += (c.kind === "absolute" ? c.amount : 1) * 2;

  if (kind === "creature") {
    const ns = state.world.nodeState[loc];
    const coord = ns?.profile.creatures.coords[pos];
    const isFront = coord?.r === 0;
    if (isFront) score += 3; // front row applies pressure / blocks
    // Light bias to contest where the player is committed: more enemy creatures here → higher.
    if (ns) {
      let playerHere = 0;
      for (const p of positionsOf(ns.profile, "creature")) {
        if (ns.sideSlots.player.creatures[p] != null) playerHere++;
      }
      score += playerHere * 0.5;
    }
  } else if (kind === "structure") {
    score += 2; // structures are generally fine to drop
  }
  // Stable tiebreak so behavior is deterministic given identical scores.
  return score;
}

/**
 * Enumerate every legal AI placement and return the highest-scoring one, or null if none.
 * Considers each card in the AI's hand against every (loc, position) of its kind.
 */
export function aiPickBestPlay(state: GameState): AiPlay | null {
  const enc = state.currentEncounter;
  if (!enc || !enc.aiSide) return null;
  let best: AiPlay | null = null;

  for (const instId of enc.aiSide.hand) {
    const card = state.cards[instId];
    if (!card) continue;
    const kind = slotKindOf(card);
    if (kind == null) continue; // equipment etc. — no AI commit flow yet

    for (const loc of enc.locationNodeIds) {
      const ns = state.world.nodeState[loc];
      if (!ns) continue;
      for (const pos of positionsOf(ns.profile, kind)) {
        if (!canAiPlaceAt(state, card, loc, kind, pos)) continue;
        const score = scoreAiPlay(state, card, loc, kind, pos);
        if (best == null || score > best.score) {
          best = { card, loc, kind, pos, score };
        }
      }
    }
  }
  return best;
}
