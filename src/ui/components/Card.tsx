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
import { effectiveStat } from "../../engine/stats.ts";
import { findCardLocation } from "../../engine/presence.ts";
import { getState } from "../../store/actions.ts";
import type { CardInstance, CostRequirement } from "../../engine/types.ts";

const STAT_LETTER: Record<CostRequirement["stat"], string> = {
  force: "F",
  tempo: "T",
  insight: "I",
  resolve: "R",
  spite: "S",
};

/**
 * Stat line. For creatures IN PLAY (face-up, in a slot), Force/Tempo display as EFFECTIVE
 * values — buffs, conditional bonuses, and auras are visible (a permanent +1 from Proof of the
 * Champion actually shows). A "*" marks values differing from the printed base. Cards in hand
 * show printed values.
 */
function CardStats({ card }: { card: CardInstance }) {
  const def = getCardDef(card.defKey);
  const state = getState();

  let force = def.force ?? 0;
  let tempo = def.tempo ?? 0;
  let effective = false;
  if (def.type === "creature" && card.revealed && card.slots.length > 0) {
    const where = findCardLocation(state, card.instId);
    if (where && where.container === "slot") {
      force = effectiveStat(state, card, where.side, where.loc, "force");
      tempo = effectiveStat(state, card, where.side, where.loc, "tempo");
      effective = true;
    }
  }
  const forceMod = effective && force !== (def.force ?? 0);
  const tempoMod = effective && tempo !== (def.tempo ?? 0);

  return (
    <div style={{ display: "flex", gap: 6, fontSize: 10, marginTop: "auto" }}>
      {(force > 0 || (def.force ?? 0) > 0) && (
        <span style={{ color: "#ef5a5a", fontWeight: forceMod ? 700 : 400 }}>
          {force}
          {forceMod ? "*" : ""} F
        </span>
      )}
      {card.durability != null && def.durability != null && (
        <span style={{ color: "#4a8aef" }}>
          {card.durability}/{def.durability} D
        </span>
      )}
      {(tempo !== 0 || (def.tempo ?? 0) !== 0) && (
        <span style={{ color: "#6fcf6f", fontWeight: tempoMod ? 700 : 400 }}>
          {tempo}
          {tempoMod ? "*" : ""} T
        </span>
      )}
    </div>
  );
}

// Cost chip per §26 card-text language: absolute = "≥1F here"; comparative = vs opponent.
function costLabel(cost: CostRequirement): string {
  const letter = STAT_LETTER[cost.stat];
  switch (cost.kind) {
    case "absolute":
      return `≥${cost.amount}${letter}`;
    case "comparativeMore":
      return `>${letter} opp`;
    case "comparativeLess":
      return `<${letter} opp`;
    case "comparativeEqual":
      return `=${letter} opp`;
  }
}

interface CardProps {
  card: CardInstance;
  inSlot?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /**
   * "owner" — render the card face-up to its owner (the player) even if revealed=false.
   * "fog" — render face-down card-back style to opponents.
   * "back" — always render the card back, regardless of revealed (deck pile: order is hidden).
   */
  faceMode?: "owner" | "fog" | "back";
  // Mini render for pile stacks — name + stats only, no body text.
  mini?: boolean;
  /**
   * Whether this render carries the card's shared layoutId. Exactly ONE render of a card
   * instance may carry it (multi-slot cards render once per footprint slot — only the anchor
   * slot carries identity, or Framer's shared-layout crossfade fights itself).
   */
  layoutCarrier?: boolean;
  /**
   * "ghost" — a PENDING occupation, not yet real: a card placed-but-not-committed, or a creature's
   * pending-move destination preview. Renders translucent with a dashed border. The player reads
   * the board as two layers: solid (real, in play) vs ghost (declared this turn, resolves on
   * advance). The pending→face-down→face-up lifecycle: ghost is the pre-advance stage.
   */
  ghost?: boolean;
}

export function Card({
  card,
  inSlot = false,
  selected = false,
  onClick,
  faceMode = "owner",
  mini = false,
  layoutCarrier = true,
  ghost = false,
}: CardProps) {
  const def = getCardDef(card.defKey);
  const isFaceDownVisual = faceMode === "back" || (!card.revealed && faceMode === "fog");

  // Is THIS card the one currently resolving (chip in Present)? When true, the card and the
  // chip render their paired "resolving" visual — the card glows and scales, the chip pulses
  // gold in the Present zone. They open and close together because they read the same field.
  const gs = getState();
  const enc = gs.currentEncounter;
  const resolvingChip =
    enc?.resolvingChipId != null
      ? gs.timeline.find((c) => c.chipId === enc.resolvingChipId)
      : null;
  const isResolving = resolvingChip != null && resolvingChip.cardInstId === card.instId;

  // Combat visuals: the swinging attacker glows red; the hit target flashes white briefly.
  // A creature with pendingLeavePile is dying — drained look until the second beat sweeps it.
  const isSwinging = enc?.swingingAttackerInstId === card.instId;
  const isHit = enc?.swingHitTargetInstId === card.instId;
  const isDying = card.pendingLeavePile != null;
  // A move that just fizzled (destination was occupied): a brief amber "blocked" flash on the
  // creature that stayed put. Non-transform (box-shadow/border) so it composes with Framer's
  // layout animation per AL #5.
  const isFizzledMove = enc?.fizzledMoveInstId === card.instId;

  const borderColor = selected
    ? "#f0c040"
    : isResolving
      ? "#f0c040"
      : isSwinging
        ? "#ef5a5a"
        : isHit
          ? "#ffffff"
          : isFizzledMove
            ? "#e08a40"
            : ghost
              ? "#5a6a8a"
              : !card.revealed
                ? "#6a5a20"
                : "#2a2a35";

  const glowShadow = isResolving
    ? "0 0 14px 2px rgba(240,192,64,0.55)"
    : isSwinging
      ? "0 0 14px 2px rgba(239,90,90,0.65)"
      : isHit
        ? "0 0 16px 3px rgba(255,255,255,0.75)"
        : isFizzledMove
          ? "0 0 12px 2px rgba(224,138,64,0.7)"
          : !card.revealed && faceMode === "owner"
            ? "inset 0 0 0 1px rgba(240,192,64,0.2)"
            : "none";

  return (
    <motion.div
      layout
      {...(layoutCarrier ? { layoutId: `card-${card.instId}` } : {})}
      animate={{
        scale: isResolving || isSwinging ? 1.06 : 1,
        opacity: isDying ? 0.45 : ghost ? 0.5 : 1,
      }}
      transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.8 }}
      onClick={onClick}
      style={{
        // border-box: width/height are the real rendered box. Without it, padding + border
        // spill past pile container outlines and cover the pile labels.
        boxSizing: "border-box",
        width: mini ? 64 : inSlot ? 100 : 110,
        height: mini ? 84 : inSlot ? 130 : 150,
        padding: mini ? 4 : 6,
        borderRadius: 4,
        background: isFaceDownVisual
          ? "repeating-linear-gradient(45deg, #2a2a35 0 4px, #1f1f2a 4px 8px)"
          : isDying
            ? "#251515"
            : "#1a1a22",
        border: `1px ${ghost ? "dashed" : "solid"} ${borderColor}`,
        outline: selected ? "2px solid #f0c040" : "none",
        color: "#e8e8e8",
        fontSize: 11,
        lineHeight: 1.25,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        boxShadow: glowShadow,
        zIndex: isResolving || isSwinging || isHit ? 2 : "auto",
      }}
    >
      {isFaceDownVisual ? (
        <div
          style={{
            flex: 1,
            display: "grid",
            placeItems: "center",
            fontSize: mini ? 16 : 24,
            color: "#444",
          }}
        >
          ?
        </div>
      ) : mini ? (
        <>
          <span
            style={{
              fontWeight: 600,
              fontSize: 9,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {def.name}
          </span>
          <CardStats card={card} />
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 600 }}>{def.name}</span>
            {def.costs.length > 0 && (
              <span style={{ fontSize: 9, color: "#f0c040", whiteSpace: "nowrap" }}>
                {def.costs.map(costLabel).join(" ")}
              </span>
            )}
          </div>
          {def.text && <div style={{ color: "#aaa", fontSize: 10, flex: 1 }}>{def.text}</div>}
          <CardStats card={card} />
        </>
      )}
    </motion.div>
  );
}
