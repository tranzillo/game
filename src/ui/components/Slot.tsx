// One slot in a location's grid. Renders whatever's there (committed or pending) or empty
// placeholder. Profile-driven: position keys are opaque per §25.

import { Card } from "./Card.tsx";
import {
  actionPlaceSelectedCard,
  actionCancelPending,
  getSelectedCardId,
  getState,
} from "../../store/actions.ts";
import { useGameState } from "../../store/index.ts";
import type { CardInstance, PositionKey, Side, SlotKind } from "../../engine/types.ts";

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

  // Legal target highlight: a card is selected, slot is empty, slot kind matches selected
  // card's type, and slot is on the player side (Phase G slice).
  const isLegalTarget =
    selectedCard != null &&
    !committedCard &&
    !pendingCard &&
    side === "player";

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
        />
      ) : pendingCard ? (
        <Card card={pendingCard} inSlot faceMode="owner" />
      ) : (
        <span style={{ color: "#444", fontSize: 11 }}>{posKey}</span>
      )}
    </div>
  );
}
