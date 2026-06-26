// One location column. Profile-driven: reads the node's profile to determine which positions
// exist and renders a Slot per position. Per ENGINE_SKETCH §G and REBUILD_PLAN §25, the layout
// uses the profile.positions iteration order; for the AI half, we flip the row visually so the
// front row (r0) sits closest to the centerline.

import { Slot } from "./Slot.tsx";
import { Pile } from "./Pile.tsx";
import { kindColor } from "./NodeTile.tsx";
import { isLocationInWarMode } from "../../engine/overworld.ts";
import { displayTextFor } from "../../engine/location-text.ts";
import { locationStatTotal, pendingStatTotal } from "../../engine/location-totals.ts";
import { positionsOf } from "../../engine/profile.ts";
import type {
  CardInstance,
  InstId,
  NodeState,
  SlotKind,
  GameState,
  Side,
  PositionKey,
  WorldNode,
} from "../../engine/types.ts";

interface LocationProps {
  state: GameState;
  loc: string;
  node: NodeState;
  name: string;
  kind?: WorldNode["kind"];
  cleared?: boolean;
}

export function Location({ state, loc, node, name, kind = "neutral", cleared = false }: LocationProps) {
  const profile = node.profile;
  const creaturePositions = positionsOf(profile, "creature");

  // Group positions by row. The profile knows the coords.
  const rowsByR = groupByRow(creaturePositions, profile);

  // For the AI half: render rows in reverse order so r0 (front) sits at the bottom,
  // closest to the centerline.
  const aiRowOrder = [...rowsByR.keys()].sort((a, b) => b - a);
  const playerRowOrder = [...rowsByR.keys()].sort((a, b) => a - b);

  // Same identity language as the map's NodeTile (§34 one-world): kind-colored accent,
  // war-mode flip when AI presence is revealed here.
  const warMode = isLocationInWarMode(state, loc);
  const accent = cleared ? "#6fcf6f" : kindColor(kind, warMode);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 12,
        gap: 8,
        background: cleared ? "#0d1810" : "#15151c",
        border: `1px solid ${cleared ? "#6fcf6f" : "#2a2a35"}`,
        borderTop: `3px solid ${accent}`,
        borderRadius: 6,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: accent }}>
        {name}
        {warMode && !cleared && <span style={{ marginLeft: 6, fontSize: 10 }}>WAR</span>}
        {cleared && <span style={{ marginLeft: 6, fontSize: 10 }}>CLEARED</span>}
      </div>
      {displayTextFor(state, loc) && (
        <div style={{ fontSize: 10, color: warMode ? "#cf8a8a" : "#888", textAlign: "center" }}>
          {displayTextFor(state, loc)}
        </div>
      )}

      {/* Board + location piles: the location's own graveyard/junkyard sit in a column to the
          RIGHT of the structure/action columns, spanning both halves — they belong to the
          location, not a side. Always visible, even empty (§29: run-spanning record of what's
          happened here). */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {/* AI half: stats | creature grid (back row top, FRONT row at the bottom, flush against
              the centerline) | structure + action stacked. Melee reads as front-vs-front contact. */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <StatTotalsColumn state={state} loc={loc} side="ai" />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SlotsForKind state={state} loc={loc} node={node} kind="structure" side="ai" />
              <SlotsForKind state={state} loc={loc} node={node} kind="action" side="ai" />
            </div>
          </div>

          {/* Centerline — a hairline only; the two front rows touch across it. */}
          <div style={{ height: 1, width: "100%", background: "#3a3a45", margin: "1px 0" }} />

          {/* Player half: mirror — FRONT row at the top (flush against the centerline). */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <StatTotalsColumn state={state} loc={loc} side="player" />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SlotsForKind state={state} loc={loc} node={node} kind="structure" side="player" />
              <SlotsForKind state={state} loc={loc} node={node} kind="action" side="player" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Pile label="Grave" cards={resolveCards(state, node.locationPiles.graveyard)} />
          <Pile label="Junk" cards={resolveCards(state, node.locationPiles.junkyard)} />
        </div>
      </div>
    </div>
  );
}

function resolveCards(state: GameState, ids: InstId[]): CardInstance[] {
  return ids.map((id) => state.cards[id]).filter((c): c is CardInstance => c != null);
}

/**
 * Per-side stat totals at this location, as a vertical column on the left of the creature grid.
 * Committed totals are what cost checks read (§26 single check at cast, committed-only); the
 * player's own pending commits show as a "(+n)" preview via pendingStatTotal. Force and Tempo
 * always shown (the workhorse currencies); Insight and Spite only when nonzero.
 */
function StatTotalsColumn({ state, loc, side }: { state: GameState; loc: string; side: Side }) {
  const stats = [
    { key: "force" as const, label: "F", color: "#ef5a5a", always: true },
    { key: "tempo" as const, label: "T", color: "#6fcf6f", always: true },
    { key: "insight" as const, label: "I", color: "#4a8aef", always: false },
    { key: "spite" as const, label: "S", color: "#b08adf", always: false },
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 10,
        minWidth: 44,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: "#555", fontSize: 9 }}>{side === "player" ? "you" : "them"}</span>
      {stats.map(({ key, label, color, always }) => {
        const committed = locationStatTotal(state, side, loc, key);
        const visible = side === "player" ? pendingStatTotal(state, side, loc, key) : committed;
        const pending = visible - committed;
        if (!always && committed === 0 && pending === 0) return null;
        return (
          <span key={key} style={{ color }}>
            {label} {committed}
            {pending > 0 && <span style={{ color: "#888" }}>+{pending}</span>}
          </span>
        );
      })}
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
