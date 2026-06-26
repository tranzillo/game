// One slot in a location's grid. Renders whatever's there (committed or pending) or empty
// placeholder. Profile-driven: position keys are opaque per §25.

import { Card } from "./Card.tsx";
import {
  actionPlaceSelectedCard,
  actionCancelPending,
  canPlaceAt,
  getSelectedCardId,
  getState,
} from "../../store/actions.ts";
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
}

export function Slot({ loc, side, kind, posKey, committedCard, pendingCard }: SlotProps) {
  // Subscribe to engine state so selection changes rerender.
  useGameState();
  const selectedId = getSelectedCardId();
  const state = getState();
  const selectedCard = selectedId != null ? state.cards[selectedId] : null;

  // Legal target highlight: EXACTLY the slots where the selected card can actually be placed —
  // same predicate the place action enforces (kind match, commit window, cost, cleared-loc,
  // emptiness). No selected card → no highlights.
  const isLegalTarget =
    selectedCard != null && canPlaceAt(state, selectedCard, { loc, side, kind, pos: posKey });

  function onClick() {
    if (pendingCard) {
      actionCancelPending({ loc, side, kind, pos: posKey });
      return;
    }
    if (isLegalTarget) {
      actionPlaceSelectedCard({ loc, side, kind, pos: posKey });
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: 110,
        minHeight: 150,
        border: `1px dashed ${isLegalTarget ? "#f0c040" : "#333"}`,
        borderRadius: 4,
        background: isLegalTarget ? "rgba(240, 192, 64, 0.06)" : "transparent",
        display: "grid",
        placeItems: "center",
        cursor: isLegalTarget || pendingCard ? "pointer" : "default",
      }}
    >
      {committedCard ? (
        <Card
          card={committedCard}
          inSlot
          faceMode={committedCard.origin === "playerDeck" ? "owner" : "fog"}
          layoutCarrier={isAnchorRender(committedCard, posKey)}
        />
      ) : pendingCard ? (
        <Card
          card={pendingCard}
          inSlot
          faceMode="owner"
          layoutCarrier={isAnchorRender(pendingCard, posKey)}
        />
      ) : (
        <span style={{ color: "#444", fontSize: 11 }}>{posKey}</span>
      )}
    </div>
  );
}
