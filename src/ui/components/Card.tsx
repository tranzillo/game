// Card component — the load-bearing piece of the slice's visual contract.
//
// Per REBUILD_PLAN §17 + AL #6: cards slide seamlessly between zones via persistent DOM
// identity (React key={card.instId}) + Framer Motion `layout` prop. When a card moves
// between parents (hand → slot, etc.), Framer measures old and new positions and animates
// the transform automatically. Framer owns `transform` exclusively (per AL #5).
//
// Other visual effects (flip, mark badge pulse, damage flash) use non-transform properties so
// they compose with Framer's layout slide.

import { motion } from "framer-motion";
import { getCardDef } from "../../engine/cards.ts";
import type { CardInstance } from "../../engine/types.ts";

interface CardProps {
  card: CardInstance;
  inSlot?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /**
   * "owner" — render the card face-up to its owner (the player) even if revealed=false.
   * "fog" — render face-down card-back style to opponents.
   */
  faceMode?: "owner" | "fog";
}

export function Card({ card, inSlot = false, selected = false, onClick, faceMode = "owner" }: CardProps) {
  const def = getCardDef(card.defKey);
  const isFaceDownVisual = !card.revealed && faceMode === "fog";

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.8 }}
      onClick={onClick}
      style={{
        width: inSlot ? 100 : 110,
        height: inSlot ? 130 : 150,
        padding: 6,
        borderRadius: 4,
        background: isFaceDownVisual
          ? "repeating-linear-gradient(45deg, #2a2a35 0 4px, #1f1f2a 4px 8px)"
          : "#1a1a22",
        border: `1px solid ${selected ? "#f0c040" : !card.revealed ? "#6a5a20" : "#2a2a35"}`,
        outline: selected ? "2px solid #f0c040" : "none",
        color: "#e8e8e8",
        fontSize: 11,
        lineHeight: 1.25,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        boxShadow: !card.revealed && faceMode === "owner" ? "inset 0 0 0 1px rgba(240,192,64,0.2)" : "none",
      }}
    >
      {isFaceDownVisual ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", fontSize: 24, color: "#444" }}>
          ?
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 600 }}>{def.name}</div>
          {def.text && <div style={{ color: "#aaa", fontSize: 10, flex: 1 }}>{def.text}</div>}
          <div style={{ display: "flex", gap: 6, fontSize: 10, marginTop: "auto" }}>
            {(def.force ?? 0) > 0 && (
              <span style={{ color: "#ef5a5a" }}>{def.force} F</span>
            )}
            {card.durability != null && def.durability != null && (
              <span style={{ color: "#4a8aef" }}>
                {card.durability}/{def.durability} D
              </span>
            )}
            {(def.tempo ?? 0) !== 0 && (
              <span style={{ color: "#6fcf6f" }}>{def.tempo} T</span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
