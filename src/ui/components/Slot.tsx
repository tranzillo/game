// One slot in a location's grid. Renders whatever's there (committed / pending placement / pending-
// move-destination ghost) or empty placeholder. Profile-driven: position keys are opaque per §25.
//
// Two selection axes drive clicks here:
//  - A HAND CARD is selected → legal slots highlight; click places a pending card.
//  - An IN-PLAY CREATURE is selected for movement → its legal adjacent slots highlight; click
//    commits a pending move.
// Clicking an in-play player creature in main (with no hand card selected) selects it for movement.

import { Card } from "./Card.tsx";
import {
  actionPlaceSelectedCard,
  actionCancelPending,
  actionSelectCreatureForMove,
  actionCommitMove,
  actionCancelMove,
  canPlaceAt,
  getSelectedCardId,
  getSelectedMoveCreatureId,
  getState,
} from "../../store/actions.ts";
import { checkMove, legalMoveTargets } from "../../engine/movement.ts";
import { getCardDef } from "../../engine/cards.ts";
import { useGameState } from "../../store/index.ts";
import type { CardInstance, PositionKey, Side, SlotKind } from "../../engine/types.ts";

// A multi-slot card renders once per footprint slot; only the anchor slot (slots[0]) carries
// the shared layoutId so Framer has exactly one identity per card instance.
function isAnchorRender(card: CardInstance, posKey: PositionKey): boolean {
  return card.slots.length === 0 || card.slots[0] === posKey;
}

interface SlotProps {
  loc: string;
  side: Side;
  kind: SlotKind;
  posKey: PositionKey;
  committedCard: CardInstance | null;
  pendingCard: CardInstance | null;
  // The creature whose PENDING-MOVE DESTINATION is this slot (rendered ghosted here while it stays
  // solid at its source). Only meaningful for player creature slots. Null otherwise.
  pendingMoveGhostCard?: CardInstance | null;
}

export function Slot({
  loc,
  side,
  kind,
  posKey,
  committedCard,
  pendingCard,
  pendingMoveGhostCard = null,
}: SlotProps) {
  // Subscribe to engine state so selection changes rerender.
  useGameState();
  const state = getState();
  const selectedId = getSelectedCardId();
  const selectedCard = selectedId != null ? state.cards[selectedId] : null;
  const moveSelectedId = getSelectedMoveCreatureId();
  const moveSelectedCard = moveSelectedId != null ? state.cards[moveSelectedId] : null;

  // Legal HAND-CARD placement target: same predicate the place action enforces.
  const isPlaceTarget =
    selectedCard != null && canPlaceAt(state, selectedCard, { loc, side, kind, pos: posKey });

  // Legal MOVE destination for the move-selected creature (creature slots, player side only).
  const isMoveTarget =
    moveSelectedCard != null &&
    kind === "creature" &&
    side === "player" &&
    checkMove(state, moveSelectedCard, loc, posKey) === "ok";

  // Is THIS committed creature selectable for movement right now? (player creature, main, can move)
  const canSelectForMove =
    committedCard != null &&
    kind === "creature" &&
    side === "player" &&
    selectedCard == null && // not in the middle of a hand-card placement
    legalMoveTargets(state, committedCard, loc).length > 0;

  // Is THIS committed creature the one currently selected for move? (highlight its source)
  const isMoveSource = committedCard != null && committedCard.instId === moveSelectedId;
  // Does THIS committed creature have a pending move (source slot, awaiting resolution)?
  const hasPendingMove =
    committedCard != null &&
    (state.currentEncounter?.locationData[loc]?.pendingMoves.has(committedCard.instId) ?? false);

  const isHighlightTarget = isPlaceTarget || isMoveTarget;

  function onClick() {
    // 1. Committing a move to this legal destination.
    if (isMoveTarget) {
      actionCommitMove({ loc, pos: posKey });
      return;
    }
    // 2. Placing a hand card here.
    if (isPlaceTarget) {
      actionPlaceSelectedCard({ loc, side, kind, pos: posKey });
      return;
    }
    // 3. Cancel a pending placement by clicking its ghost.
    if (pendingCard) {
      actionCancelPending({ loc, side, kind, pos: posKey });
      return;
    }
    // 4. A committed creature: cancel its pending move (if any), else select it for movement.
    if (committedCard != null && kind === "creature" && side === "player") {
      if (hasPendingMove) {
        actionCancelMove({ instId: committedCard.instId, loc });
        return;
      }
      if (isMoveSource) {
        actionSelectCreatureForMove(null); // toggle off
        return;
      }
      if (canSelectForMove) {
        actionSelectCreatureForMove(committedCard.instId);
        return;
      }
    }
  }

  const clickable =
    isHighlightTarget || pendingCard != null || canSelectForMove || isMoveSource || hasPendingMove;

  const borderColor = isHighlightTarget
    ? "#f0c040"
    : isMoveSource
      ? "#4a8aef"
      : "#333";

  return (
    <div
      onClick={onClick}
      style={{
        width: 110,
        minHeight: 150,
        border: `1px dashed ${borderColor}`,
        borderRadius: 4,
        background: isHighlightTarget
          ? "rgba(240, 192, 64, 0.06)"
          : isMoveSource
            ? "rgba(74, 138, 239, 0.06)"
            : "transparent",
        display: "grid",
        placeItems: "center",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {committedCard ? (
        <Card
          card={committedCard}
          inSlot
          faceMode={committedCard.origin === "playerDeck" ? "owner" : "fog"}
          selected={isMoveSource}
          layoutCarrier={isAnchorRender(committedCard, posKey)}
        />
      ) : pendingMoveGhostCard ? (
        // Pending-move destination preview. CRITICAL: this is a plain <div>, NOT a <Card> carrying
        // the moving creature's identity. Rendering the same instId (with its layoutId) in two slots
        // at once makes Framer see the layoutId "appear in place" at the destination on resolution
        // instead of sliding from the source — the move teleports (verified 2026-06-26). The real
        // creature stays solid at its source slot and slides here cleanly when the move resolves.
        <MoveGhost card={pendingMoveGhostCard} />
      ) : pendingCard ? (
        <Card
          card={pendingCard}
          inSlot
          faceMode="owner"
          ghost
          layoutCarrier={isAnchorRender(pendingCard, posKey)}
        />
      ) : (
        <span style={{ color: "#444", fontSize: 11 }}>{posKey}</span>
      )}
    </div>
  );
}

// A pending-move destination preview — a translucent, dashed, card-shaped box naming the creature
// that's heading here. Intentionally a plain <div> (NOT a <Card>): rendering the moving creature's
// real identity here would block its layoutId slide from the source (see the note at the call site).
function MoveGhost({ card }: { card: CardInstance }) {
  const def = getCardDef(card.defKey);
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 100,
        height: 130,
        padding: 6,
        borderRadius: 4,
        border: "1px dashed #5a6a8a",
        background: "rgba(74, 138, 239, 0.05)",
        color: "#8a9ac0",
        opacity: 0.6,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 11,
        userSelect: "none",
      }}
    >
      <span style={{ fontWeight: 600 }}>{def.name}</span>
      <span style={{ fontSize: 9, marginTop: "auto" }}>↧ moving here</span>
    </div>
  );
}
