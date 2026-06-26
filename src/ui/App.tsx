// Top-level component — the "one world, two zooms" view machine (DECISIONS 2026-06-13).
//
// The map and the encounter are two zoom levels of one space; never shown at once. The Timeline
// L-frame (top + left edges) WRAPS whichever view is active and never redraws across the zoom.
// View follows decision type: tactical (playing cards) → encounter; meta (travel) → map.
// Transitions are cuts, not a camera zoom. Phase-advance lives only in the encounter view; zoom
// and advance both gate off while resolution animates (isPlaying()).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LayoutGroup } from "framer-motion";
import { useGameState } from "../store/index.ts";
import { isPlaying } from "../engine/scheduler.ts";
import { Controls } from "./components/Controls.tsx";
import { Timeline } from "./components/Timeline.tsx";
import { Hand } from "./components/Hand.tsx";
import { Location } from "./components/Location.tsx";
import { OverworldMap } from "./components/OverworldMap.tsx";
import { Pile } from "./components/Pile.tsx";
import { DevTracePanel } from "./components/DevTracePanel.tsx";
import { actionStartRun } from "../store/actions.ts";
import type { CardInstance, EncounterOutcome, GameState, InstId } from "../engine/types.ts";

type View = "map" | "encounter";

function pileCards(state: GameState, ids: InstId[]): CardInstance[] {
  return ids.map((id) => state.cards[id]).filter((c): c is CardInstance => c != null);
}

export function App() {
  const state = useGameState();
  const enc = state.currentEncounter;
  const busy = isPlaying();

  // View machine. Default to map (the run starts at the overworld). Auto-transitions fire at
  // lifecycle boundaries; the player can also toggle manually at quiescent points.
  const [view, setView] = useState<View>("map");

  // Auto-zoom-IN when a fresh encounter begins (no outcome yet): clicking a node started a fight,
  // so we drop into the tactical view. Auto-zoom-OUT when the encounter ends (outcome set): the
  // player now makes the meta decision of where to travel, which is a map decision.
  const prevEncKey = useRef<string | null>(null);
  const encKey = enc ? `${enc.encounterNo}` : null;
  useEffect(() => {
    if (encKey && encKey !== prevEncKey.current && !enc?.outcome) {
      setView("encounter"); // a new encounter just started → zoom in
    }
    prevEncKey.current = encKey;
  }, [encKey, enc?.outcome]);

  // Auto-zoom-OUT when the encounter ends — but only once resolution has fully settled (the
  // encounter-end sweep cascade holds isPlaying() true while cards fly back into the Draw pile).
  // Gating on !busy keeps the player in the encounter view to WATCH the sweep, then zooms out
  // when it's done. (Firing on `outcome` alone zoomed out instantly, hiding the sweep.)
  const didZoomOutForOutcome = useRef<EncounterOutcome | null>(null);
  useEffect(() => {
    const outcome = enc?.outcome ?? null;
    if (outcome && !busy && outcome !== didZoomOutForOutcome.current) {
      setView("map");
      didZoomOutForOutcome.current = outcome;
    }
    if (!outcome) didZoomOutForOutcome.current = null;
  }, [enc?.outcome, busy]);

  const canZoomToEncounter = enc != null;

  return (
    // ONE LayoutGroup over the whole app so every persistent object — board cards AND timeline
    // chips — animates through a single shared layout context. A card sliding hand → slot →
    // graveyard and a chip falling Present → Past are the same mechanism (shared layoutId, no
    // teleport); coordinating them in one group keeps the feel consistent and continuous.
    <LayoutGroup>
      <div
        style={{
          height: "100%", // fills #root (which is 100% of the viewport); no scroll at the app level
          background: "#08080c",
          color: "#e8e8e8",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Timeline state={state} view={view}>
        {/* Zoom toggle: between map and the live encounter. Disabled while resolution animates
            (you may zoom only at quiescent points, coupled with phase-advance availability). */}
        {state.world.nodes.length > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "6px 12px", alignItems: "center" }}>
            <ZoomTab
              label="Map"
              active={view === "map"}
              disabled={busy}
              onClick={() => setView("map")}
            />
            <ZoomTab
              label="Encounter"
              active={view === "encounter"}
              disabled={busy || !canZoomToEncounter}
              onClick={() => canZoomToEncounter && setView("encounter")}
            />
            {busy && <span style={{ fontSize: 10, color: "#666" }}>resolving — zoom locked</span>}
          </div>
        )}

          {view === "map" ? (
            <MapView state={state} />
          ) : (
            <EncounterView state={state} />
          )}
        </Timeline>

        {state.runOver && <RunOverBanner runOver={state.runOver} />}
      </div>
      <DevTracePanel />
    </LayoutGroup>
  );
}

// ---------- Map view (zoomed out — meta decisions) ----------

function MapView({ state }: { state: GameState }) {
  if (state.world.nodes.length === 0) {
    return (
      <div style={{ flex: 1, padding: 24, color: "#888" }}>
        Click <em>Start run</em> to begin.
        <div style={{ marginTop: 12 }}>
          <button onClick={() => actionStartRun()} style={btn}>
            Start run
          </button>
        </div>
      </div>
    );
  }
  const enc = state.currentEncounter;
  return (
    <div style={{ flex: 1, padding: 12, overflow: "auto" }}>
      <OverworldMap state={state} />
      {enc?.outcome && !state.runOver && (
        <div style={{ padding: "8px 4px", fontSize: 12, color: outcomeColor(enc.outcome) }}>
          {outcomeText(enc.outcome)} Click a highlighted node to travel.
        </div>
      )}
    </div>
  );
}

// ---------- Encounter view (zoomed in — tactical play) ----------
// The active locations are the front line; the player's node-floor (hand + piles + durability +
// controls, unified) spans the bottom band as the ground they stand on.

function EncounterView({ state }: { state: GameState }) {
  const enc = state.currentEncounter;
  if (!enc) {
    return <div style={{ flex: 1, padding: 24, color: "#888" }}>No active encounter.</div>;
  }

  return (
    <>
      {/* Front line — the active location boards, in map column order. */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 12,
          padding: 12,
          justifyContent: "center",
          alignItems: "flex-start",
          overflow: "auto",
        }}
      >
        {enc.locationNodeIds.map((loc) => {
          const worldNode = state.world.nodes.find((n) => n.id === loc);
          return (
            <Location
              key={loc}
              state={state}
              loc={loc}
              node={state.world.nodeState[loc]!}
              name={worldNode?.label ?? loc}
              kind={worldNode?.kind ?? "neutral"}
              cleared={enc.playerLocationCleared[loc] ?? false}
            />
          );
        })}
      </div>

      {/* The node-floor: your position made spatial. The whole band IS the node you stand on.
          Two rows of consistent height: the piles row (Draw · Hand · Discard · Graveyard ·
          Junkyard — all uniform labeled piles, Hand included), then a THIN control strip below
          (turn / durability / Advance / speed). Band height is consistent with or without a
          hand — the Hand pile reserves its height. */}
      <div
        style={{
          borderTop: "2px solid #2a2a35",
          background: "#0b0b11",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 18,
            padding: "8px 12px",
          }}
        >
          <Pile label="Draw" faceDown cards={pileCards(state, [...enc.playerSide.deck].reverse())} />
          <FloorLabel label="Hand">
            <Hand
              hand={enc.playerSide.hand
                .map((id) => state.cards[id])
                .filter((c): c is NonNullable<typeof c> => c != null)}
            />
          </FloorLabel>
          <Pile label="Discard" cards={pileCards(state, enc.playerSide.discard)} />
          <Pile label="Graveyard" cards={pileCards(state, enc.playerSide.graveyard)} />
          <Pile label="Junkyard" cards={pileCards(state, enc.playerSide.junkyard)} />
        </div>

        {/* Thin control strip below the piles. */}
        <Controls
          turn={enc.turn}
          phase={enc.phase}
          subPhase={enc.subPhase}
          hasEncounter
          playerDurability={enc.playerSide.durability}
          aiDurability={enc.aiSide?.durability ?? null}
        />
      </div>
    </>
  );
}

// Wraps a floor item with the SAME label treatment the Pile component uses, so Hand reads as
// just another labeled pile in the row (consistent label styling across Draw/Hand/Discard/…).
function FloorLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      {children}
      <span style={{ fontSize: 9, color: "#666", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

function ZoomTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: active ? "#1f1f2a" : "transparent",
        color: active ? "#e8e8e8" : "#888",
        border: `1px solid ${active ? "#4a8aef" : "#2a2a35"}`,
        borderRadius: 4,
        padding: "4px 14px",
        fontSize: 12,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !active ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function outcomeText(outcome: EncounterOutcome): string {
  const text: Record<EncounterOutcome, string> = {
    playerCleared: "You cleared the encounter.",
    playerLost: "You died.",
    bossKilled: "Summoner defeated.",
    summonerDefeated: "Summoner defeated.",
  };
  return text[outcome];
}

function outcomeColor(outcome: EncounterOutcome): string {
  const color: Record<EncounterOutcome, string> = {
    playerCleared: "#6fcf6f",
    playerLost: "#ef5a5a",
    bossKilled: "#f0c040",
    summonerDefeated: "#f0c040",
  };
  return color[outcome];
}

function RunOverBanner({ runOver }: { runOver: "playerWin" | "playerLose" }) {
  const text = runOver === "playerWin" ? "Run won." : "Run over.";
  const color = runOver === "playerWin" ? "#f0c040" : "#ef5a5a";
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.75)",
        display: "grid",
        placeItems: "center",
        zIndex: 20,
      }}
    >
      <div
        style={{
          padding: "32px 48px",
          background: "#0e0e14",
          border: `2px solid ${color}`,
          borderRadius: 6,
          color,
          textAlign: "center",
          boxShadow: `0 0 48px ${color}55`,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>{text}</div>
        <button
          onClick={() => actionStartRun()}
          style={{
            padding: "8px 24px",
            background: "#1a1a22",
            color: "#e8e8e8",
            border: `1px solid ${color}`,
            borderRadius: 4,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          New Run
        </button>
      </div>
    </div>
  );
}

const btn = {
  background: "#1a1a22",
  color: "#e8e8e8",
  border: "1px solid #2a2a35",
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
  borderRadius: 4,
} as const;
