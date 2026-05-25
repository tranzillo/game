import { L, createCard } from "./state.js";
import { CARD_DEFS } from "../data/cards.js";

// ---------- Tokens ----------
// A token is a permanent generated mid-encounter by another card's effect (e.g., a flip-up trigger).
// Tokens behave on the battlefield like any other permanent — they occupy slots, contribute stats,
// can be destroyed by combat or effects — but they have NO representation in any zone outside the
// battlefield. They aren't in any deck, hand, discard, graveyard, or exile. When destroyed they
// cease to exist. (Per DESIGN.md "Tokens" section.)
//
// In code: tokens are normal card objects with `isToken: true`. They use the existing slot grid
// and combat code unchanged. The differences are in lifecycle: tokens are NOT shuffled into the
// run deck, NOT placed in graveyard on death — they just disappear.
export function createToken(defKey, owner) {
  const card = createCard(defKey, owner);
  card.isToken = true;
  card.revealed = true; // Tokens enter face-up (skip the play queue / face-down beat).
  return card;
}

// Try to spawn a token of `defKey` at the first empty slot matching the given filter, on the same
// side as `owner` at the given location. Returns the token if placed, null if no empty slot was
// found. Used by flip-up triggers and other generators.
export function spawnTokenAt(owner, loc, defKey, slotFilter) {
  const lc = L(owner, loc);
  const def = CARD_DEFS[defKey];
  if (!def) return null;
  // Default slot search: empty creature slots in front-then-back, left-then-right order.
  const positions = slotFilter || ["fl", "fr", "bl", "br"];
  if (def.type === "creature") {
    for (const pos of positions) {
      if (!lc.creatures[pos]) {
        const tok = createToken(defKey, owner);
        lc.creatures[pos] = tok;
        return { card: tok, where: "creature", pos };
      }
    }
  } else if (def.type === "structure") {
    if (!lc.structure) {
      const tok = createToken(defKey, owner);
      lc.structure = tok;
      return { card: tok, where: "structure" };
    }
  }
  return null;
}
