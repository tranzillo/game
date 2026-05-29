// Slice controls — Load Slice / Advance Phase / speed.

import { actionLoadSlice } from "../../store/actions.ts";
import { actionAdvancePhase } from "../../store/orchestrator.ts";
import { isPlaying, setSpeed, getSpeed } from "../../engine/scheduler.ts";

interface ControlsProps {
  turn: number;
  phase: string;
  subPhase: string;
  hasEncounter: boolean;
}

export function Controls({ turn, phase, subPhase, hasEncounter }: ControlsProps) {
  const busy = isPlaying();

  function load() {
    actionLoadSlice({
      handDefKeys: ["r1", "r3", "scribe"],
      deckDefKeys: ["r1", "r1", "r3", "scribe", "scribe"],
    });
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: 12,
        background: "#0e0e14",
        border: "1px solid #2a2a35",
        borderRadius: 4,
      }}
    >
      <div style={{ color: "#aaa", fontSize: 12 }}>
        Turn {turn} · {phase} ({subPhase})
      </div>
      {!hasEncounter ? (
        <button onClick={load} style={btn}>
          Load slice
        </button>
      ) : (
        <button
          onClick={() => {
            if (!busy) actionAdvancePhase();
          }}
          disabled={busy}
          style={{ ...btn, opacity: busy ? 0.5 : 1 }}
        >
          {busy ? "Resolving…" : "Advance phase"}
        </button>
      )}
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ color: "#666", fontSize: 11 }}>Speed</span>
        <select
          defaultValue={String(getSpeed())}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{
            background: "#1a1a22",
            color: "#e8e8e8",
            border: "1px solid #2a2a35",
            padding: "4px 6px",
            fontSize: 11,
          }}
        >
          <option value="2">0.5x</option>
          <option value="1">1x</option>
          <option value="0.5">2x</option>
          <option value="0.1">10x</option>
        </select>
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
