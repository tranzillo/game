// One location column. Profile-driven: reads the node's profile to determine which positions
// exist and renders a Slot per position. Per ENGINE_SKETCH §G and REBUILD_PLAN §25, the layout
// uses the profile.positions iteration order; for the AI half, we flip the row visually so the
// front row (r0) sits closest to the centerline.

import { Slot } from "./Slot.tsx";
import { positionsOf } from "../../engine/profile.ts";
import type { NodeState, SlotKind, GameState, Side, PositionKey } from "../../engine/types.ts";

interface LocationProps {
  state: GameState;
  loc: string;
  node: NodeState;
  name: string;
}

export function Location({ state, loc, node, name }: LocationProps) {
  const profile = node.profile;
  const creaturePositions = positionsOf(profile, "creature");

  // Group positions by row. The profile knows the coords.
  const rowsByR = groupByRow(creaturePositions, profile);

  // For the AI half: render rows in reverse order so r0 (front) sits at the bottom,
  // closest to the centerline.
  const aiRowOrder = [...rowsByR.keys()].sort((a, b) => b - a);
  const playerRowOrder = [...rowsByR.keys()].sort((a, b) => a - b);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 12,
        gap: 8,
        background: "#15151c",
        border: "1px solid #2a2a35",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>{name}</div>

      {/* AI structure */}
      <SlotsForKind state={state} loc={loc} node={node} kind="structure" side="ai" />

      {/* AI creature grid */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols(profile.creatures.cols), gap: 6 }}>
        {aiRowOrder.map((r) =>
          rowsByR.get(r)!.map((posKey) => (
            <Slot
              key={`ai-${posKey}`}
              loc={loc}
              side="ai"
              kind="creature"
              posKey={posKey}
              committedCard={getCardAtSlot(state, node, "ai", "creature", posKey)}
              pendingCard={null} // AI doesn't have pending in slice
            />
          )),
        )}
      </div>

      {/* AI action */}
      <SlotsForKind state={state} loc={loc} node={node} kind="action" side="ai" />

      <div style={{ height: 2, width: "100%", background: "#2a2a35", margin: "4px 0" }} />

      {/* Player action */}
      <SlotsForKind state={state} loc={loc} node={node} kind="action" side="player" />

      {/* Player creature grid */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols(profile.creatures.cols), gap: 6 }}>
        {playerRowOrder.map((r) =>
          rowsByR.get(r)!.map((posKey) => (
            <Slot
              key={`player-${posKey}`}
              loc={loc}
              side="player"
              kind="creature"
              posKey={posKey}
              committedCard={getCardAtSlot(state, node, "player", "creature", posKey)}
              pendingCard={getPendingCardAtSlot(state, loc, "creature", posKey)}
            />
          )),
        )}
      </div>

      {/* Player structure */}
      <SlotsForKind state={state} loc={loc} node={node} kind="structure" side="player" />
    </div>
  );
}

function SlotsForKind({
  state,
  loc,
  node,
  kind,
  side,
}: {
  state: GameState;
  loc: string;
  node: NodeState;
  kind: "structure" | "action";
  side: Side;
}) {
  const positions = positionsOf(node.profile, kind);
  return (
    <div style={{ display: "grid", gridTemplateColumns: gridCols(positions.length), gap: 6 }}>
      {positions.map((posKey) => (
        <Slot
          key={`${side}-${kind}-${posKey}`}
          loc={loc}
          side={side}
          kind={kind}
          posKey={posKey}
          committedCard={getCardAtSlot(state, node, side, kind, posKey)}
          pendingCard={side === "player" ? getPendingCardAtSlot(state, loc, kind, posKey) : null}
        />
      ))}
    </div>
  );
}

function gridCols(n: number): string {
  return new Array(n).fill("auto").join(" ");
}

function groupByRow(positions: PositionKey[], profile: NodeState["profile"]) {
  const map = new Map<number, PositionKey[]>();
  for (const pos of positions) {
    const r = profile.creatures.coords[pos]!.r;
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(pos);
  }
  return map;
}

function getCardAtSlot(
  state: GameState,
  node: NodeState,
  side: Side,
  kind: SlotKind,
  posKey: PositionKey,
) {
  const map =
    kind === "creature"
      ? node.sideSlots[side].creatures
      : kind === "structure"
        ? node.sideSlots[side].structures
        : node.sideSlots[side].actions;
  const instId = map[posKey];
  if (instId == null) return null;
  return state.cards[instId] ?? null;
}

function getPendingCardAtSlot(
  state: GameState,
  loc: string,
  kind: SlotKind,
  posKey: PositionKey,
) {
  if (!state.currentEncounter) return null;
  const locData = state.currentEncounter.locationData[loc];
  if (!locData) return null;
  const map =
    kind === "creature"
      ? locData.pending.creatures
      : kind === "structure"
        ? locData.pending.structures
        : locData.pending.actions;
  const instId = map[posKey];
  if (instId == null) return null;
  return state.cards[instId] ?? null;
}
