// Buffs — stored stat modifiers with explicit scope.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §26.
//
// Four scopes:
//   - "turn" — reverts at end of cleanup.
//   - "encounter" — reverts when the card leaves play (default unprinted scope).
//   - "permanent" — persists across encounters via runDeckEntry.mods.buffs.
//   - "equipped" — applies only while the source equipment is attached. Carries sourceInstId.
//
// Inert filter: a card with `inert: true` cannot gain F/T/I/R/S buffs from any source.
// `applyBuff` silently drops buffs of those stats on Inert cards (the buff isn't stored).
// `effectiveStat` also filters Inert at read time (defense in depth).

import { getCardDef } from "./cards.ts";
import type { Buff, CardInstance, CardRegistry, InstId } from "./types.ts";

// ---------- Apply ----------

/**
 * Apply a buff to a card. Mutates card.buffs.
 *
 * Validation:
 * - For "equipped" scope, buff.sourceInstId must be set.
 * - For "permanent" scope, the caller is responsible for mirroring into runDeckEntry.mods
 *   (handled at the engine entry points that grant permanent buffs, not at this primitive level).
 * - Inert filter: drops F/T/I/R/S buffs on Inert cards silently.
 */
export function applyBuff(card: CardInstance, buff: Buff): void {
  if (buff.scope === "equipped" && buff.sourceInstId == null) {
    throw new Error("equipped-scope buff requires sourceInstId");
  }
  const def = getCardDef(card.defKey);
  if (def.inert && isAffectedByInert(buff.stat)) {
    // Inert silently rejects buffs to F/T/I/R/S. Buff is dropped.
    return;
  }
  card.buffs.push({ ...buff });
}

function isAffectedByInert(stat: Buff["stat"]): boolean {
  return stat === "force" || stat === "tempo" || stat === "insight" || stat === "resolve" || stat === "spite";
}

// ---------- Read ----------

/**
 * Sum stored buffs on a card for a specific stat.
 *
 * Add-style summation: every matching buff's amount contributes. Note that equipment with
 * `kind: "set"` grants are NOT stored as buffs — they're handled directly in `effectiveStat`
 * via equipment's `grantedSetOverrides`. This function only sums stored Buff records.
 */
export function sumBuffsForStat(card: CardInstance, stat: Buff["stat"]): number {
  let total = 0;
  for (const b of card.buffs) {
    if (b.stat === stat) total += b.amount;
  }
  return total;
}

// ---------- Scope reverts ----------

/**
 * Remove all "turn"-scoped buffs from every card in the registry. Called at end of cleanup.
 */
export function revertTurnScopedBuffs(cards: CardRegistry): void {
  for (const id of Object.keys(cards)) {
    const c = cards[Number(id)];
    if (!c) continue;
    if (c.buffs.length === 0) continue;
    c.buffs = c.buffs.filter((b) => b.scope !== "turn");
  }
}

/**
 * Remove all "encounter"-scoped buffs from a single card. Called when the card leaves play.
 */
export function revertEncounterScopedBuffs(card: CardInstance): void {
  if (card.buffs.length === 0) return;
  card.buffs = card.buffs.filter((b) => b.scope !== "encounter");
}

/**
 * Remove all "equipped"-scoped buffs that were sourced from the given equipment instance.
 * Sweeps across every card in the registry (host could be anywhere).
 * Called when equipment detaches.
 */
export function sweepEquippedBuffs(cards: CardRegistry, equipmentInstId: InstId): void {
  for (const id of Object.keys(cards)) {
    const c = cards[Number(id)];
    if (!c) continue;
    if (c.buffs.length === 0) continue;
    c.buffs = c.buffs.filter(
      (b) => !(b.scope === "equipped" && b.sourceInstId === equipmentInstId),
    );
  }
}
