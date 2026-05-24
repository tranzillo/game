import { state, L } from "../engine/state.js";
import { LOCATION_COUNT, LOC_NAMES } from "../engine/config.js";
import { committedStatTotal } from "../engine/stats.js";
import { advancePhase } from "../engine/core.js";
import { endEncounter } from "../engine/run.js";
import { flashLog } from "./render.js";
import { logEntry } from "../engine/log.js";
import { start } from "../main.js";
import { setSpeed } from "./scene.js";

// ---------- Export ----------
export function buildExport() {
  const ts = new Date().toISOString();
  const lines = [];
  lines.push(`=== Game v2 export (${ts}) ===`);
  if (!state.sides) {
    lines.push(`View: ${state.view}. No active encounter.`);
    return lines.join("\n");
  }
  lines.push(`Turn ${state.turn} · Phase: ${state.phase} · Priority: ${state.firstSide}`);
  // AI Durability is meaningful only at the boss encounter (boss is a summoner). At non-boss
  // hostile encounters there's no AI summoner — show — instead of a misleading number.
  const aiDurabilityDisplay = state.encounterKind === "boss" ? state.sides.ai.durability : "—";
  lines.push(`Player Durability: ${state.sides.player.durability} · AI Durability: ${aiDurabilityDisplay}`);
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    lines.push(`@ ${LOC_NAMES[loc]} — Player Force/Tempo/Insight (committed): ${committedStatTotal("player",loc,"force")}/${committedStatTotal("player",loc,"tempo")}/${committedStatTotal("player",loc,"insight")}`);
    lines.push(`@ ${LOC_NAMES[loc]} — AI     Force/Tempo/Insight (committed): ${committedStatTotal("ai",loc,"force")}/${committedStatTotal("ai",loc,"tempo")}/${committedStatTotal("ai",loc,"insight")}`);
  }
  lines.push(``);

  // Compact human-readable per-location, per-side board.
  function describeSide(name) {
    const s = state.sides[name];
    const out = [];
    out.push(`  ${name.toUpperCase()}:`);
    out.push(`    Hand (${s.hand.length}): ${s.hand.map(c => c.name).join(", ") || "—"}`);
    out.push(`    Deck ${s.deck.length} · Discard ${s.discard.length} · Graveyard ${s.graveyard.length}`);
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(name, loc);
      out.push(`    @ ${LOC_NAMES[loc]}:`);
      const cs = ["fl","fr","bl","br"].map(p => {
        const c = lc.creatures[p];
        const pc = lc.pending.creatures[p];
        if (c) return `${p}=${c.name}[F${c.force || 0}/T${c.tempo || 0}/I${c.insight || 0}/D${c.durability}/${c.durabilityMax}${c.revealed === false ? " face-down" : ""}]`;
        if (pc) return `${p}=(pending)${pc.name}`;
        return `${p}=—`;
      });
      out.push(`      Creatures: ${cs.join("  ")}`);
      out.push(`      Structure: ${lc.structure ? lc.structure.name : (lc.pending.structure ? "(pending)"+lc.pending.structure.name : "—")}`);
      out.push(`      Action:    ${lc.action ? lc.action.name : (lc.pending.action ? "(pending)"+lc.pending.action.name : "—")}`);
    }
    return out.join("\n");
  }
  lines.push(describeSide("player"));
  lines.push(describeSide("ai"));
  lines.push(``);

  // Full log.
  lines.push(`=== Log ===`);
  for (const e of state.log) {
    lines.push(`[${e.kind || "info"}] ${e.msg}`);
  }
  lines.push(``);

  // JSON snapshot for full reconstruction. Strip cyclic / Set fields.
  function serializableLocation(lc) {
    return {
      creatures: Object.fromEntries(["fl","fr","bl","br"].map(p => [p, lc.creatures[p] ? serializableCard(lc.creatures[p]) : null])),
      structure: lc.structure ? serializableCard(lc.structure) : null,
      action: lc.action ? serializableCard(lc.action) : null,
      pending: {
        creatures: Object.fromEntries(["fl","fr","bl","br"].map(p => [p, lc.pending.creatures[p] ? serializableCard(lc.pending.creatures[p]) : null])),
        structure: lc.pending.structure ? serializableCard(lc.pending.structure) : null,
        action: lc.pending.action ? serializableCard(lc.pending.action) : null
      },
      movedThisTurn: Array.from(lc.movedThisTurn || [])
    };
  }
  function serializableSide(s) {
    return {
      durability: s.durability,
      deck: s.deck.map(serializableCard),
      hand: s.hand.map(serializableCard),
      discard: s.discard.map(serializableCard),
      graveyard: s.graveyard.map(serializableCard),
      locations: s.locations.map(serializableLocation)
    };
  }
  function serializableCard(c) {
    return {
      instId: c.instId, defKey: c.defKey, name: c.name, type: c.type,
      cost: c.cost, costStat: c.costStat, force: c.force, tempo: c.tempo, insight: c.insight,
      durability: c.durability, durabilityMax: c.durabilityMax, effect: c.effect, revealed: c.revealed
    };
  }
  const snapshot = {
    turn: state.turn,
    phase: state.phase,
    firstSide: state.firstSide,
    gameOver: state.gameOver,
    locationNames: LOC_NAMES,
    sides: {
      player: serializableSide(state.sides.player),
      ai: serializableSide(state.sides.ai)
    }
  };
  lines.push(`=== JSON snapshot ===`);
  lines.push(JSON.stringify(snapshot, null, 2));
  return lines.join("\n");
}

export function exportToClipboard() {
  const text = buildExport();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => flashLog("Game state copied to clipboard."),
      () => fallbackExport(text)
    );
  } else {
    fallbackExport(text);
  }
}

export function fallbackExport(text) {
  // Older browsers without clipboard API: drop into a textarea and let user copy.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.top = "10px";
  ta.style.left = "10px";
  ta.style.width = "80vw";
  ta.style.height = "60vh";
  ta.style.zIndex = "1000";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  flashLog("Clipboard not available — manually copy the text shown, then click anywhere to dismiss.");
  const dismiss = () => { ta.remove(); document.removeEventListener("click", dismiss, true); };
  setTimeout(() => document.addEventListener("click", dismiss, true), 100);
}

export function exportToFile() {
  const text = buildExport();
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `game-export-turn${state.turn}-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flashLog("Game state downloaded.");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-advance").addEventListener("click", advancePhase);
  document.getElementById("btn-restart").addEventListener("click", start);
  document.getElementById("btn-go-restart").addEventListener("click", start);
  document.getElementById("btn-leave-encounter").addEventListener("click", () => {
    if (state.view !== "encounter") return;
    if (state.encounterKind !== "neutral") return;
    logEntry(`You leave the encounter without claiming the reward.`, "phase");
    endEncounter("playerLeft");
  });
  document.getElementById("btn-export").addEventListener("click", (e) => {
    if (e.shiftKey) exportToFile();
    else exportToClipboard();
  });
  const speedSel = document.getElementById("speed-select");
  if (speedSel) {
    speedSel.addEventListener("change", () => {
      setSpeed(parseFloat(speedSel.value));
    });
  }
  start();
});
