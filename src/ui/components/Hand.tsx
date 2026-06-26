// Player hand. Each card uses key={instId} so a card moving from hand to slot preserves
// its DOM node and Framer animates the slide.
//
// Only PLAYABLE cards are selectable: a card with no legal placement anywhere right now
// (wrong phase for its type, cost unmet everywhere, no empty slot, locations cleared) renders
// dimmed and unclickable. Same predicate as placement legality (actions.ts isCardPlayable).

import { motion } from "framer-motion";
import { Card } from "./Card.tsx";
import {
  actionSelectCard,
  getSelectedCardId,
  getState,
  isCardPlayable,
} from "../../store/actions.ts";
import { useGameState } from "../../store/index.ts";
import type { CardInstance } from "../../engine/types.ts";

interface HandProps {
  hand: CardInstance[];
}

export function Hand({ hand }: HandProps) {
  useGameState();
  const selectedId = getSelectedCardId();
  const state = getState();

  return (
    // Hand is just another pile in the node-floor row — no chrome of its own (App supplies the
    // label). minHeight reserves the band height so an empty hand doesn't collapse the floor.
    <div style={{ display: "flex", alignItems: "center", minHeight: 150 }}>
      <motion.div layout style={{ display: "flex", gap: 8 }}>
        {hand.map((card) => {
          const playable = isCardPlayable(state, card);
          return (
            <div key={card.instId} style={{ opacity: playable ? 1 : 0.45 }}>
              {playable ? (
                <Card
                  card={card}
                  selected={card.instId === selectedId}
                  onClick={() => actionSelectCard(card.instId === selectedId ? null : card.instId)}
                />
              ) : (
                <Card card={card} selected={false} />
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
