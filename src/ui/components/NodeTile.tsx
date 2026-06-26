// NodeTile — the unified node/location identity per §34 "one world, two zooms."
//
// One rendering concept for a location at both zoom levels: the overworld map renders NodeTiles
// in a tiered grid; the encounter view's Location header shares the same identity language
// (kind color, label treatment) so a node and a location read as the same object.
//
// Fog per §34: a fogged tile hides the CARDS (footprint badges) but never the location's
// identity/text. War mode (revealed + AI presence) flips the accent to the danger color.

import { isLocationInWarMode } from "../../engine/overworld.ts";
import { displayTextFor } from "../../engine/location-text.ts";
import type { GameState, WorldNode } from "../../engine/types.ts";

// Kind accent colors — shared by map tiles and encounter Location headers.
export function kindColor(kind: WorldNode["kind"], warMode = false): string {
  if (warMode) return "#ef5a5a";
  switch (kind) {
    case "start":
      return "#4a8aef";
    case "end":
      return "#f0c040";
    case "hostile":
      return "#ef5a5a";
    case "neutral":
      return "#6fcf6f";
  }
}

export const TILE_W = 124;
export const TILE_H = 92;

interface NodeTileProps {
  state: GameState;
  node: WorldNode;
  isPawn: boolean;
  isActive: boolean; // part of the current encounter
  // Travel happens HERE — clicking a legal next node on the map (never via a menu/dialog).
  isTravelTarget?: boolean;
  onTravel?: () => void;
}

export function NodeTile({
  state,
  node,
  isPawn,
  isActive,
  isTravelTarget = false,
  onTravel,
}: NodeTileProps) {
  const revealed = node.revealed === true;
  const controlled = node.status === "encountered";
  const warMode = isLocationInWarMode(state, node.id);
  const accent = kindColor(node.kind, warMode);

  // Persistent footprint at the node, as the unified chip-pile state (DECISIONS 2026-06-13):
  // every node renders the same vocabulary — stacked chips split by pile type (in-play here /
  // graveyard here / junkyard here). Visible only once fog has lifted. The ACTIVE encounter
  // node expands its in-play pile into the real board (Location.tsx); inactive nodes show only
  // these chip stacks; fogged or all-empty → location text only.
  const ns = state.world.nodeState[node.id];
  let inPlayCount = 0;
  if (ns) {
    const seen = new Set<number>();
    for (const side of ["player", "ai"] as const) {
      const slots = ns.sideSlots[side];
      for (const map of [slots.creatures, slots.structures, slots.actions]) {
        for (const v of Object.values(map)) {
          if (v != null && !seen.has(v)) seen.add(v);
        }
      }
    }
    inPlayCount = seen.size;
  }
  const graveCount = ns?.locationPiles.graveyard.length ?? 0;
  const junkCount = ns?.locationPiles.junkyard.length ?? 0;

  return (
    <div
      onClick={isTravelTarget ? onTravel : undefined}
      style={{
        width: TILE_W,
        height: TILE_H,
        boxSizing: "border-box",
        padding: "6px 8px",
        borderRadius: 6,
        background: controlled ? "#101a12" : revealed ? "#14141c" : "#0d0d12",
        border: `1px solid ${isActive ? "#ef5a5a" : accent}`,
        borderTopWidth: 3,
        outline: isTravelTarget ? "2px solid #f0c040" : "none",
        opacity: revealed || controlled ? 1 : 0.75,
        boxShadow: isTravelTarget
          ? "0 0 12px rgba(240,192,64,0.45)"
          : isActive
            ? "0 0 12px rgba(239,90,90,0.4)"
            : "none",
        cursor: isTravelTarget ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isPawn && (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#4a8aef",
              border: "1.5px solid #e8e8e8",
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{node.label}</span>
        {warMode && <span style={{ fontSize: 9, color: "#ef5a5a" }}>WAR</span>}
      </div>

      {/* Location text line — never fogged per §34. War text appears only once revealed with
          AI presence (displayTextFor handles the mode); fogged nodes lure with peace text. */}
      <div style={{ fontSize: 9, color: warMode ? "#cf8a8a" : "#888", lineHeight: 1.2 }}>
        {displayTextFor(state, node.id) ?? node.kind}
      </div>

      {/* Chip-pile state — the CARDS at the node as stacked chips, split by pile type. Hidden
          while fogged; nothing shown when all piles are empty (most nodes at run start). */}
      <div style={{ marginTop: "auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
        {revealed ? (
          inPlayCount + graveCount + junkCount === 0 ? null : (
            <>
              <ChipPile count={inPlayCount} color="#6fcf6f" label="play" />
              <ChipPile count={graveCount} color="#b08adf" label="grave" />
              <ChipPile count={junkCount} color="#888" label="junk" />
            </>
          )
        ) : (
          <span style={{ fontSize: 9, color: "#666", fontStyle: "italic" }}>fogged</span>
        )}
      </div>
    </div>
  );
}

// A compact stacked-chip pile: a few offset chip outlines so the pile's SIZE reads from the
// edges (the same "how big is the pile" affordance as the encounter piles, miniaturized for
// the map). Renders nothing when empty. Caps the visible stack; the count tells the truth.
function ChipPile({ count, color, label }: { count: number; color: string; label: string }) {
  if (count <= 0) return null;
  const shown = Math.min(count, 5);
  const offset = 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <div style={{ position: "relative", width: 12 + (shown - 1) * offset, height: 14 }}>
        {Array.from({ length: shown }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * offset,
              top: (shown - 1 - i) * offset * 0.5,
              width: 11,
              height: 13,
              borderRadius: 2,
              background: "#14141c",
              border: `1px solid ${color}`,
              zIndex: i,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 7, color: "#666" }}>
        {label} {count}
      </span>
    </div>
  );
}
