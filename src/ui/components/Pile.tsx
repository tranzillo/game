// Pile — a stack of real card elements, per REBUILD_PLAN §12 / §29 and the prototype's
// pile-layout shape (archive render.js fillPile):
//
//   - EVERY card in the pile is a discrete UI element (no placeholder counts). Each card sits
//     at a slight diagonal offset from the one below, so the pile reads as a physical stack —
//     you can see how big a pile is by how many edges are visible.
//   - All piles are face-up EXCEPT the draw pile (deck): face-down, order hidden.
//   - Cards keep their shared layoutId in piles, so a card visibly slides hand → discard,
//     slot → graveyard, deck → hand, etc. when its container changes.
//
// `cards` is ordered bottom → top (callers: push-piles pass the array as-is — newest arrival
// is on top; the deck passes itself reversed, since deck[0] is the next card drawn).

import { Card } from "./Card.tsx";
import type { CardInstance } from "../../engine/types.ts";

const CARD_W = 64;
const CARD_H = 84;
const OFFSET = 1.5; // px per card of diagonal spread — pile height readable from the edges

interface PileProps {
  label: string;
  cards: CardInstance[]; // bottom → top
  faceDown?: boolean;
}

export function Pile({ label, cards, faceDown = false }: PileProps) {
  const spread = Math.max(0, cards.length - 1) * OFFSET;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ position: "relative", width: CARD_W + spread, height: CARD_H + spread }}>
        {cards.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "1px dashed #333",
              borderRadius: 4,
              display: "grid",
              placeItems: "center",
              color: "#3a3a45",
              fontSize: 9,
            }}
          >
            —
          </div>
        )}
        {cards.map((card, i) => (
          <div
            key={card.instId}
            style={{
              position: "absolute",
              // Stack climbs up-and-right: bottom card sits low-left, top card high-right.
              left: i * OFFSET,
              top: spread - i * OFFSET,
              zIndex: i,
            }}
          >
            <Card card={card} mini faceMode={faceDown ? "back" : "owner"} />
          </div>
        ))}
      </div>
      <span style={{ fontSize: 9, color: "#666", whiteSpace: "nowrap" }}>
        {label} {cards.length}
      </span>
    </div>
  );
}
