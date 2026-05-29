// Player hand. Each card uses key={instId} so a card moving from hand to slot preserves
// its DOM node and Framer animates the slide.

import { motion } from "framer-motion";
import { Card } from "./Card.tsx";
import { actionSelectCard, getSelectedCardId } from "../../store/actions.ts";
import { useGameState } from "../../store/index.ts";
import type { CardInstance } from "../../engine/types.ts";

interface HandProps {
  hand: CardInstance[];
}

export function Hand({ hand }: HandProps) {
  useGameState();
  const selectedId = getSelectedCardId();

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 12,
        background: "#0e0e14",
        borderTop: "1px solid #2a2a35",
        alignItems: "center",
      }}
    >
      <span style={{ color: "#666", fontSize: 11, marginRight: 8 }}>Hand:</span>
      <motion.div layout style={{ display: "flex", gap: 8 }}>
        {hand.map((card) => (
          <Card
            key={card.instId}
            card={card}
            selected={card.instId === selectedId}
            onClick={() =>
              actionSelectCard(card.instId === selectedId ? null : card.instId)
            }
          />
        ))}
      </motion.div>
    </div>
  );
}
