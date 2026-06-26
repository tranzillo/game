// OverworldMap — the zoomed-out view of the one world state (§34).
//
// Renders the tiered grid: y = tier (boss row at top, start at bottom per §2's spatial
// consistency), x = column. Each node renders as a NodeTile — the same identity concept the
// encounter view's Location headers use. Edges draw as an SVG underlay between tile centers.
//
// Fog per §34 is handled inside NodeTile: location text/identity always visible, cards
// (footprint badges) hidden until the node's fog lifts at encounter start.

import { NodeTile, TILE_W, TILE_H } from "./NodeTile.tsx";
import { actionTravelTo } from "../../store/actions.ts";
import { adjacentLocationsFor } from "../../engine/overworld.ts";
import type { GameState, WorldNode } from "../../engine/types.ts";

interface OverworldMapProps {
  state: GameState;
}

const X_STEP = TILE_W + 28;
const Y_STEP = TILE_H + 26;
const PAD = 14;

export function OverworldMap({ state }: OverworldMapProps) {
  const nodes = state.world.nodes;
  const edges = state.world.edges;
  if (nodes.length === 0) return null;

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = (maxX - minX + 1) * X_STEP - (X_STEP - TILE_W) + PAD * 2;
  const height = (maxY - minY + 1) * Y_STEP - (Y_STEP - TILE_H) + PAD * 2;

  const tilePos = (n: WorldNode) => ({
    left: (n.x - minX) * X_STEP + PAD,
    top: (n.y - minY) * Y_STEP + PAD,
  });
  const center = (n: WorldNode) => {
    const p = tilePos(n);
    return { cx: p.left + TILE_W / 2, cy: p.top + TILE_H / 2 };
  };

  const pawnId = state.world.pawnAt;
  const activeLocs = new Set(state.currentEncounter?.locationNodeIds ?? []);

  // Travel = clicking a node on the map (never a menu). Legal exactly when the current
  // encounter has ended in a continue-the-run outcome: the unvisited next-tier neighbors of
  // the pawn highlight and become clickable.
  const outcome = state.currentEncounter?.outcome;
  // playerCleared is the mid-run continue outcome; summonerDefeated/bossKilled set runOver so
  // they won't reach here. (aiRetreated removed — retreat no longer ends an encounter.)
  const travelOpen = !state.runOver && outcome === "playerCleared";
  const travelTargets = new Set(travelOpen ? adjacentLocationsFor(state, pawnId) : []);

  return (
    <div
      style={{
        background: "#0e0e14",
        border: "1px solid #2a2a35",
        borderRadius: 4,
        padding: 8,
        overflowX: "auto",
      }}
    >
      <div style={{ position: "relative", width, height }}>
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          {edges.map(([a, b], i) => {
            const na = nodes.find((n) => n.id === a);
            const nb = nodes.find((n) => n.id === b);
            if (!na || !nb) return null;
            const pa = center(na);
            const pb = center(nb);
            return (
              <line
                key={i}
                x1={pa.cx}
                y1={pa.cy}
                x2={pb.cx}
                y2={pb.cy}
                stroke="#2a2a35"
                strokeWidth={2}
              />
            );
          })}
        </svg>
        {nodes.map((n) => {
          const p = tilePos(n);
          return (
            <div key={n.id} style={{ position: "absolute", left: p.left, top: p.top }}>
              <NodeTile
                state={state}
                node={n}
                isPawn={n.id === pawnId}
                isActive={activeLocs.has(n.id)}
                isTravelTarget={travelTargets.has(n.id)}
                onTravel={() => actionTravelTo(n.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
