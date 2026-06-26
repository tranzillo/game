// Summoner retreat — self-preservation, not defeat (DECISIONS 2026-06-13).
//
// The enemy summoner withdraws rather than die when pressed. Two triggers (a combination):
//   1. Instant tier-scaled damage cap: if cumulative unblocked summoner damage THIS encounter
//      exceeds the cap, it retreats immediately. The cap is LOW early (guards against one-turn
//      early wins — you can't burst it down before you've earned the right to corner it) and
//      scales UP as the player progresses (proxied by encounterNo — deeper = higher cap).
//   2. End-of-turn evaluation: if the summoner is exposed (took damage this encounter and has no
//      living forces left to block) at end of cleanup, it withdraws.
//
// Retreat is a STATE CHANGE, not an encounter ending: the summoner's forces are removed and it is
// no longer present (no more fall-through lands on it), but the encounter continues — locations
// drive the ending. Durability already lost stays lost (run-scoped). At the map's end retreat is
// impossible (the cornered gate) — that's Slice 4; this module exposes `canRetreat` for it.

import { reclaimOneCardToDeck } from "./piles.ts";
import { isAiPresentAt } from "./presence.ts";
import { neighborNodeIds } from "./overworld.ts";
import type { GameState } from "./types.ts";

// Tier-scaled instant cap: base tolerance + growth per encounter depth. Tuning placeholders —
// the SHAPE (low early, rising) is what matters now (DECISIONS 2026-06-13).
const RETREAT_CAP_BASE = 2;
const RETREAT_CAP_PER_ENCOUNTER = 2;

/**
 * The instant damage cap for the current encounter. Exceeding cumulative summoner damage past
 * this triggers immediate retreat. Scales with how deep the player is (encounterNo).
 */
export function retreatDamageCap(state: GameState): number {
  const enc = state.currentEncounter;
  const depth = enc ? Math.max(0, enc.encounterNo - 1) : 0;
  return RETREAT_CAP_BASE + depth * RETREAT_CAP_PER_ENCOUNTER;
}

/**
 * Is this a CORNERING encounter — one at the map's end, where the summoner has nowhere left to
 * flee? True iff some encounter location is a dead end: it has no onward node to travel to (every
 * neighbor is the node we came from / already encountered, or it's a terminal `end` node). At
 * such an encounter the summoner is trapped and cannot retreat — it must be fought to defeat.
 */
export function isCorneringEncounter(state: GameState): boolean {
  const enc = state.currentEncounter;
  if (!enc) return false;
  for (const loc of enc.locationNodeIds) {
    const node = state.world.nodes.find((n) => n.id === loc);
    if (!node) continue;
    // A terminal node (the map's exit) corners the summoner.
    if (node.kind === "end") return true;
    // Otherwise: any onward, not-yet-encountered neighbor means there's somewhere to flee to.
    const onward = neighborNodeIds(state, loc).some((id) => {
      const n = state.world.nodes.find((x) => x.id === id);
      return n != null && n.status !== "encountered" && n.id !== state.world.pawnAt;
    });
    if (!onward) return true;
  }
  return false;
}

/**
 * Whether the summoner is ALLOWED to retreat right now. False once cornered at the map's end
 * (DECISIONS 2026-06-13 — retreat impossible there; the summoner must be defeated).
 */
export function canRetreat(state: GameState): boolean {
  return !isCorneringEncounter(state);
}

/**
 * Record `amount` of unblocked damage that landed on the summoner this encounter. Call from the
 * damage path AFTER applying a summoner-fall-through hit. Returns true if this pushes cumulative
 * damage past the instant cap (caller should then trigger retreat).
 */
export function recordSummonerDamage(state: GameState, amount: number): boolean {
  const enc = state.currentEncounter;
  if (!enc || amount <= 0) return false;
  enc.summonerDamageThisEncounter += amount;
  return enc.summonerDamageThisEncounter > retreatDamageCap(state);
}

/**
 * Should the summoner retreat at the end-of-turn evaluation? The combination of triggers
 * (DECISIONS 2026-06-13), checked once it has taken any damage this encounter:
 *   - Instant tier-scaled cap: cumulative summoner damage this encounter exceeds the cap, OR
 *   - Exposed: no location still has AI presence (no forces left to block fall-through).
 * Never retreats if already retreated, no summoner, or cornering forbids it (Slice 4).
 */
export function shouldRetreatAtEndOfTurn(state: GameState): boolean {
  const enc = state.currentEncounter;
  if (!enc || !enc.aiSide || enc.summonerRetreated) return false;
  if (!canRetreat(state)) return false;
  if (enc.summonerDamageThisEncounter <= 0) return false;
  const overCap = enc.summonerDamageThisEncounter > retreatDamageCap(state);
  const exposed = !enc.locationNodeIds.some((loc) => isAiPresentAt(state, loc));
  return overCap || exposed;
}

/**
 * Execute the retreat: the summoner "shuffles up everywhere it's present and withdraws" — its
 * in-play AI-origin forces are reclaimed into the AI deck (not killed — it's a withdrawal), and it
 * is marked retreated so it's no longer a fall-through target. The encounter does NOT end here
 * (locations drive that). Biome/neutral content (origin != aiDeck) is NOT withdrawn — it's not
 * the summoner's force; it stays as the player's puzzle.
 *
 * Returns the instIds withdrawn (for logging / chip cleanup by the caller).
 */
export function executeRetreat(state: GameState): number[] {
  const enc = state.currentEncounter;
  if (!enc || !enc.aiSide || enc.summonerRetreated) return [];

  const removed: number[] = [];
  for (const loc of enc.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    const slots = ns.sideSlots.ai;
    const ids = new Set<number>();
    for (const map of [slots.creatures, slots.structures, slots.actions]) {
      for (const pos of Object.keys(map)) {
        const id = map[pos];
        if (id == null) continue;
        const card = state.cards[id];
        if (card && card.origin === "aiDeck") ids.add(id);
      }
    }
    for (const id of ids) {
      reclaimOneCardToDeck(state, "ai", id); // withdraw → back to the summoner's deck
      removed.push(id);
    }
  }
  enc.summonerRetreated = true;
  return removed;
}
