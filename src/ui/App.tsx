// Top-level component — Phase G vertical slice.
//
// Layout: Controls + ChipStrip across the top, Location row, Hand at the bottom.

import { useGameState } from "../store/index.ts";
import { Controls } from "./components/Controls.tsx";
import { ChipStrip } from "./components/ChipStrip.tsx";
import { Hand } from "./components/Hand.tsx";
import { Location } from "./components/Location.tsx";

export function App() {
  const state = useGameState();
  const enc = state.currentEncounter;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080c",
        color: "#e8e8e8",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: 12 }}>
        <Controls
          turn={enc?.turn ?? 0}
          phase={enc?.phase ?? "—"}
          subPhase={enc?.subPhase ?? "—"}
          hasEncounter={enc != null}
        />
      </div>

      {enc ? (
        <>
          <div style={{ padding: 12 }}>
            <ChipStrip state={state} timeline={enc.timeline} />
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              gap: 12,
              padding: 12,
              justifyContent: "center",
            }}
          >
            {enc.locationNodeIds.map((loc) => (
              <Location
                key={loc}
                state={state}
                loc={loc}
                node={state.world.nodeState[loc]!}
                name={state.world.nodes.find((n) => n.id === loc)?.label ?? loc}
              />
            ))}
          </div>

          <Hand
            hand={enc.playerSide.hand
              .map((id) => state.cards[id])
              .filter((c): c is NonNullable<typeof c> => c != null)}
          />
        </>
      ) : (
        <div style={{ padding: 24, color: "#888" }}>
          Click <em>Load slice</em> to start the Phase G test encounter.
        </div>
      )}
    </div>
  );
}
