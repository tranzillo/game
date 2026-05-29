// Chip strip — the visual timeline. Future + Past chips share one stream (state.timeline).
// Each chip is a Framer Motion box keyed by chipId; when chip.state transitions future →
// resolved, the chip moves between the future and past zones automatically (because we
// partition by chip.state and Framer handles the layout slide).

import { motion } from "framer-motion";
import { getCardDef } from "../../engine/cards.ts";
import type { TimelineChip, GameState } from "../../engine/types.ts";

interface ChipStripProps {
  state: GameState;
  timeline: TimelineChip[];
}

export function ChipStrip({ state, timeline }: ChipStripProps) {
  const future = timeline
    .filter((c) => c.state === "future")
    .sort((a, b) => b.cachedTempo - a.cachedTempo);
  const past = timeline.filter((c) => c.state === "resolved");

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 8,
        background: "#0e0e14",
        border: "1px solid #2a2a35",
        borderRadius: 4,
        minHeight: 60,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 9, color: "#666", letterSpacing: 1 }}>PAST</span>
        <motion.div layout style={{ display: "flex", gap: 4 }}>
          {past.map((chip) => (
            <Chip key={chip.chipId} chip={chip} state={state} zone="past" />
          ))}
          {past.length === 0 && <span style={{ color: "#444", fontSize: 11 }}>—</span>}
        </motion.div>
      </div>

      <div style={{ width: 1, height: 30, background: "#2a2a35" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 9, color: "#f0c040", letterSpacing: 1 }}>FUTURE → NEXT</span>
        <motion.div layout style={{ display: "flex", gap: 4 }}>
          {future.map((chip, i) => (
            <Chip
              key={chip.chipId}
              chip={chip}
              state={state}
              zone={i === 0 ? "present" : "future"}
            />
          ))}
          {future.length === 0 && <span style={{ color: "#444", fontSize: 11 }}>—</span>}
        </motion.div>
      </div>
    </div>
  );
}

interface ChipProps {
  chip: TimelineChip;
  state: GameState;
  zone: "future" | "present" | "past";
}

function Chip({ chip, state, zone }: ChipProps) {
  const bg = zone === "present" ? "#f0c040" : zone === "past" ? "#3a3a45" : "#1a1a22";
  const fg = zone === "present" ? "#000" : "#aaa";
  const card = state.cards[chip.cardInstId];
  const label = card ? getCardDef(card.defKey).name.slice(0, 3).toUpperCase() : "?";
  // Show identity for own-side chips, opaque "?" for opposing-side face-down (fog leak rule)
  const showIdentity = chip.side === "player" || chip.state === "resolved";
  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.8 }}
      style={{
        width: 36,
        height: 36,
        background: bg,
        color: fg,
        borderRadius: 4,
        border: `1px solid ${zone === "present" ? "#f0c040" : "#2a2a35"}`,
        display: "grid",
        placeItems: "center",
        fontSize: 10,
        fontWeight: 600,
      }}
      title={`${card ? getCardDef(card.defKey).name : "?"} (${chip.side} ${chip.loc} ${chip.posKey ?? "—"}, tempo ${chip.cachedTempo})`}
    >
      {showIdentity ? label : "?"}
    </motion.div>
  );
}
