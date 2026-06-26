// Slice controls — Start run / Advance Phase / speed.

import { actionStartRun } from "../../store/actions.ts";
import { actionAdvancePhase } from "../../store/orchestrator.ts";
import { isPlaying, setSpeed, getSpeed } from "../../engine/scheduler.ts";

interface ControlsProps {
  turn: number;
  phase: string;
  subPhase: string;
  hasEncounter: boolean;
  playerDurability: number;
  aiDurability: number | null;
}

export function Controls({
  turn,
  phase,
  subPhase,
  hasEncounter,
  playerDurability,
  aiDurability,
}: ControlsProps) {
  const busy = isPlaying();

  return (
    // Thin control strip — sits below the piles in the node-floor. Slim bar, not a panel.
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "5px 12px",
        background: "#0e0e14",
        borderTop: "1px solid #2a2a35",
      }}
    >
      <div style={{ color: "#aaa", fontSize: 12 }}>
        Turn {turn} · {phase} ({subPhase})
      </div>
      {hasEncounter && (
        <div style={{ color: "#4a8aef", fontSize: 12 }}>
          You: {playerDurability} D
        </div>
      )}
      {hasEncounter && aiDurability != null && (
        <div style={{ color: "#f0c040", fontSize: 12 }}>
          Enemy: {aiDurability} D
        </div>
      )}
      {!hasEncounter ? (
        <button onClick={() => actionStartRun()} style={btn}>
          Start run
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
