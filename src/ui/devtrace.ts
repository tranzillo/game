// DevTrace — read-only divergence recorder.
//
// A pure observer of the engine event stream. It subscribes ALONGSIDE the animation handler
// (composed in main.tsx — it never replaces the single engine subscriber) and it NEVER writes to
// engine state. Every value it logs is read on demand from the live state passed by the engine
// at emit time. This respects the engine→UI one-direction rule (AL #4): the tracer is just
// another read-only consumer of the outcome stream, exactly like the animation layer.
//
// Goal (per the user): a rich, neutral, annotated transcript the player can read while playing
// and paste back to demonstrate where the implementation diverges from the design. NEUTRAL means
// we log facts (target row, node kind, flip order, Past order, board snapshots) and add NO
// "this looks like a bug" judgments — the reader decides what's a divergence.
//
// The two highest-signal annotations, surfaced as plain facts:
//   - FLIP lines record the running flip order AND the resulting Past (resolved-chip) order, so a
//     reader can see directly whether they match.
//   - SWING lines record the chosen target's row and whether a front-row target existed, and
//     AI-COMMIT lines record each touched location's world `kind` (neutral / hostile / …).

import type {
  EncounterState,
  EngineEvent,
  GameState,
  InstId,
  Side,
  SlotMap,
  TimelineChip,
} from "../engine/types.ts";
import { getCardDef } from "../engine/cards.ts";
import { effectiveStat } from "../engine/stats.ts";

// ---------- Ring buffer ----------

const MAX_LINES = 4000;
let lines: string[] = [];
let listeners: Array<() => void> = [];

function push(line: string): void {
  lines.push(line);
  if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES);
  for (const l of listeners) l();
}

export function getTraceLines(): readonly string[] {
  return lines;
}

export function getTraceText(): string {
  return lines.join("\n");
}

export function clearTrace(): void {
  lines = [];
  lastPhaseKey = null;
  for (const l of listeners) l();
}

export function subscribeTrace(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

// Also mirror to the console so DevTools shows the same transcript.
let mirrorToConsole = true;
export function setConsoleMirror(on: boolean): void {
  mirrorToConsole = on;
}

// ---------- Naming / formatting helpers ----------

function cardName(state: GameState, instId: InstId | null | undefined): string {
  if (instId == null) return "—";
  const card = state.cards[instId];
  if (!card) return `#${instId}?`;
  return `${getCardDef(card.defKey).name}#${instId}`;
}

function ts(ev: EngineEvent): string {
  return `T${ev.turn} ${ev.phase}`;
}

/** Row label for a position key, read from the location profile (front row = r0). */
function rowOf(state: GameState, loc: string, posKey: string | null): string {
  if (posKey == null) return "—";
  const ns = state.world.nodeState[loc];
  const coord = ns?.profile.creatures.coords[posKey];
  if (!coord) return posKey;
  return coord.r === 0 ? "front" : "back";
}

function nodeKind(state: GameState, loc: string): string {
  return state.world.nodes.find((n) => n.id === loc)?.kind ?? "?";
}

/** Front-row enemy occupant InstIds at a location for the given attacker side. */
function frontRowOccupants(state: GameState, attackerSide: Side, loc: string): InstId[] {
  const ns = state.world.nodeState[loc];
  if (!ns) return [];
  const other: Side = attackerSide === "player" ? "ai" : "player";
  const slots = ns.sideSlots[other];
  const out: InstId[] = [];
  for (const [pos, instId] of Object.entries(slots.creatures)) {
    if (instId == null) continue;
    const coord = ns.profile.creatures.coords[pos];
    if (coord?.r === 0) out.push(instId);
  }
  return out;
}

// ---------- Per-event formatting ----------

// Running order trackers reset at encounter start / turn boundaries so a reader can compare the
// sequence chips actually flipped against the order the Past holds them.
let flipOrderThisPhase: number[] = [];

function formatEvent(ev: EngineEvent, state: GameState): string[] {
  const out: string[] = [];
  const p = ev.payload as Record<string, unknown>;

  switch (ev.kind) {
    case "turn-start": {
      flipOrderThisPhase = [];
      out.push("");
      out.push(`══════ TURN ${p.turn} ══════ (initiative: ${state.currentEncounter?.firstSide ?? "?"})`);
      break;
    }
    case "phase-advance-start": {
      flipOrderThisPhase = [];
      out.push(`── ${ts(ev)} · advance phase → ${p.phase} ──`);
      break;
    }
    case "ai-commit": {
      // Record each location the AI committed at, with the world's kind for that node, so the
      // reader can see whether the AI acted at a node presented as neutral.
      const enc = state.currentEncounter;
      const locs = enc
        ? enc.locationNodeIds
            .filter((loc) => aiHasCardsAt(state, loc))
            .map((loc) => `${loc}(${nodeKind(state, loc)})`)
        : [];
      out.push(`${ts(ev)} · AI-COMMIT ×${p.count}  locations-with-ai: [${locs.join(", ")}]`);
      break;
    }
    case "flip": {
      const instId = p.instId as InstId;
      const side = p.side as Side;
      const loc = p.loc as string;
      const posKey = (p.posKey as string | null) ?? null;
      flipOrderThisPhase.push(instId);
      const chip = chipForCard(state, instId);
      const tempo = chip?.cachedTempo ?? "?";
      const pastOrder = pastOrderForEncounter(state);
      out.push(
        `${ts(ev)} · FLIP ${side} ${cardName(state, instId)} @${loc}/${posKey ?? "—"} ` +
          `(tempo ${tempo})`,
      );
      // Neutral facts for the chip-order question: the order this phase's flips have happened in,
      // and the order the Past now holds resolved chips in. A reader compares them directly.
      out.push(`        flip-order-so-far: [${flipOrderThisPhase.map((i) => shortName(state, i)).join(" → ")}]`);
      out.push(`        past-order-now:    [${pastOrder.map((i) => shortName(state, i)).join(" → ")}]`);
      break;
    }
    case "swing-start": {
      const attacker = p.attackerInstId as InstId;
      const side = (p.side as Side) ?? "player";
      const loc = p.loc as string;
      const patternKind = (p.patternKind as string) ?? "?";
      const front = frontRowOccupants(state, side, loc);
      out.push(
        `${ts(ev)} · SWING ${side} ${cardName(state, attacker)} @${loc} ` +
          `pattern=${patternKind} force=${p.force ?? "?"}  ` +
          `front-row-enemies=[${front.map((i) => shortName(state, i)).join(", ") || "none"}]`,
      );
      break;
    }
    // The universal damage event — emitted by applyDamage for EVERY source (action, combat melee/
    // ranged, deathwish, thorns). This is where an effect's OUTCOME shows up: what Spark hit, what
    // a swing landed on, fall-through to summoner, or a fizzle.
    case "damage": {
      const dmgKind = (p.damageKind as string) ?? "?";
      const atkSide = (p.attackerSide as Side) ?? "?";
      const atkInst = p.attackerInstId as InstId | null;
      const loc = p.loc as string | undefined;
      const requested = p.amountRequested ?? "?";
      const result = p.result as
        | {
            target: { kind: string; creatureInstId?: InstId; summonerSide?: Side };
            damageDealt: number;
            targetDiedNow?: boolean;
          }
        | undefined;
      const src = atkInst != null ? cardName(state, atkInst) : `${atkSide} (sourceless)`;
      const head = `${ts(ev)} · DAMAGE[${dmgKind}] ${src} req=${requested}`;
      if (!result) {
        out.push(`${head} → (no result)`);
        break;
      }
      const t = result.target;
      if (t.kind === "creature" && t.creatureInstId != null && loc != null) {
        const row = rowOf(state, loc, posKeyOf(state, t.creatureInstId));
        const died = result.targetDiedNow ? " ✝DIED" : "";
        out.push(
          `${head} → hit ${cardName(state, t.creatureInstId)} @${loc} [${row} row] ` +
            `dealt=${result.damageDealt}${died}`,
        );
      } else if (t.kind === "summoner") {
        out.push(`${head} → ${t.summonerSide ?? "?"} SUMMONER (fall-through) dealt=${result.damageDealt}`);
      } else {
        out.push(`${head} → nothing (fizzle / no legal target)`);
      }
      break;
    }
    // swing-damage is now redundant with the universal `damage` event (applyDamage emits that for
    // every hit). Skip it in the trace to avoid double lines; swing-start still frames each swing.
    case "swing-damage":
      break;
    // Non-damage effect outcomes (emitted from the shared primitives — applyBuff, acquireCardTo,
    // moveCreature, sacrificeCreature, applyMark — so every occurrence is captured uniformly).
    case "buff": {
      const sign = (p.amount as number) >= 0 ? "+" : "";
      const src = p.sourceInstId != null ? ` from ${cardName(state, p.sourceInstId as InstId)}` : "";
      out.push(
        `${ts(ev)} · BUFF ${cardName(state, p.instId as InstId)} ${p.stat} ${sign}${p.amount} (${p.scope})${src}`,
      );
      break;
    }
    case "acquire": {
      out.push(
        `${ts(ev)} · ACQUIRE ${cardName(state, p.instId as InstId)} @${p.loc} ` +
          `${p.fromSide}→${p.toSide}`,
      );
      break;
    }
    case "move": {
      const from = (p.fromPositions as string[]).join(",");
      const to = (p.toPositions as string[]).join(",");
      out.push(
        `${ts(ev)} · MOVE ${p.side} ${cardName(state, p.instId as InstId)} @${p.loc} ${from}→${to}`,
      );
      break;
    }
    case "sacrifice": {
      out.push(`${ts(ev)} · SACRIFICE ${p.side} ${cardName(state, p.instId as InstId)} @${p.loc}`);
      break;
    }
    case "mark": {
      out.push(
        `${ts(ev)} · MARK ${cardName(state, p.instId as InstId)} → ${p.result} (count ${p.markCount})`,
      );
      break;
    }
    case "draw": {
      out.push(`${ts(ev)} · DRAW ${p.side} ${cardName(state, p.instId as InstId)}`);
      break;
    }
    case "cleanup-discard": {
      out.push(`${ts(ev)} · DISCARD ${p.side} ×${p.count}`);
      break;
    }
    case "location-cleared": {
      out.push(`${ts(ev)} · LOCATION CLEARED ${p.loc} (${nodeKind(state, p.loc as string)})`);
      break;
    }
    case "summoner-retreat": {
      out.push(`${ts(ev)} · SUMMONER RETREAT (withdrew ${p.count} forces)`);
      break;
    }
    case "thorns-hit": {
      out.push(`${ts(ev)} · THORNS ${JSON.stringify(p.result)}`);
      break;
    }
    case "encounter-end": {
      out.push(`${ts(ev)} · ENCOUNTER END → ${p.outcome}`);
      break;
    }
    case "combat-substantive-start": {
      out.push(`${ts(ev)} · COMBAT begins (${p.swingCount} swings queued)`);
      break;
    }
    // Low-signal lifecycle events: log terse so the stream stays readable.
    case "draw-substantive-start":
    case "draw-substantive-end":
    case "cleanup-substantive-start":
    case "combat-substantive-end":
      out.push(`${ts(ev)} · ${ev.kind}`);
      break;
    default:
      out.push(`${ts(ev)} · ${ev.kind} ${compactPayload(p)}`);
  }

  return out;
}

// ---------- Snapshot ----------

let lastPhaseKey: string | null = null;

function maybeSnapshot(state: GameState): void {
  const enc = state.currentEncounter;
  if (!enc) return;
  const key = `${enc.encounterNo}/${enc.turn}/${enc.phase}/${enc.subPhase}`;
  if (key === lastPhaseKey) return;
  lastPhaseKey = key;
  for (const line of snapshotLines(state, enc)) push(line);
  if (mirrorToConsole) {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`[devtrace] snapshot ${key}`);
    // eslint-disable-next-line no-console
    console.log(snapshotLines(state, enc).join("\n"));
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
}

function snapshotLines(state: GameState, enc: EncounterState): string[] {
  const out: string[] = [];
  out.push(
    `┌─ SNAPSHOT enc${enc.encounterNo} T${enc.turn} ${enc.phase}/${enc.subPhase} ` +
      `· player-dur ${enc.playerSide.durability}` +
      (enc.aiSide ? ` · ai-dur ${enc.aiSide.durability}` : " · (no ai summoner)") +
      ` · initiative ${enc.firstSide}`,
  );
  for (const loc of enc.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    const cleared = enc.playerLocationCleared[loc] ? " [CLEARED]" : "";
    out.push(`│ ${loc} (${nodeKind(state, loc)})${cleared}  ammo P${ns.ammo.player}/AI${ns.ammo.ai}`);
    out.push(`│   player: ${describeSide(state, loc, ns.sideSlots.player, "player")}`);
    out.push(`│   ai:     ${describeSide(state, loc, ns.sideSlots.ai, "ai")}`);
  }
  // Timeline: future chips (in current sorted queue order) and Past (resolved, in stored order).
  const future = enc.flipQueues.startOfPhase
    .map((c) => `${shortName(state, c.cardInstId)}@${c.loc}(t${c.cachedTempo})`)
    .join(" → ");
  const past = pastOrderForEncounter(state)
    .map((i) => shortName(state, i))
    .join(" → ");
  out.push(`│ future-queue: [${future || "empty"}]`);
  out.push(`│ past-order:   [${past || "empty"}]`);
  out.push(`└────────────────────────────────────────────`);
  return out;
}

function describeSide(state: GameState, loc: string, slots: SlotMap, side: Side): string {
  const ns = state.world.nodeState[loc];
  if (!ns) return "(none)";
  const parts: string[] = [];
  const seen = new Set<InstId>();
  for (const pos of ns.profile.creatures.positions) {
    const instId = slots.creatures[pos];
    if (instId == null || seen.has(instId)) continue;
    seen.add(instId);
    const card = state.cards[instId];
    if (!card) continue;
    const coord = ns.profile.creatures.coords[pos];
    const row = coord?.r === 0 ? "F" : "B";
    const fdown = card.revealed ? "" : "(fd)";
    const force = card.revealed ? effectiveStat(state, card, side, loc, "force") : "?";
    const dur = card.durability ?? "?";
    const origin = card.origin === "aiDeck" ? "ai" : card.origin === "biome" ? "biome" : "pl";
    parts.push(`${row}:${getCardDef(card.defKey).name}#${instId}${fdown}[${force}F/${dur}d·${origin}]`);
  }
  return parts.length ? parts.join("  ") : "(empty)";
}

// ---------- Small utilities ----------

function shortName(state: GameState, instId: InstId): string {
  const card = state.cards[instId];
  if (!card) return `#${instId}`;
  return `${getCardDef(card.defKey).name}#${instId}`;
}

function chipForCard(state: GameState, instId: InstId): TimelineChip | undefined {
  // The most recent chip for this card (a card flips once per commit).
  for (let i = state.timeline.length - 1; i >= 0; i--) {
    const chip = state.timeline[i];
    if (chip && chip.cardInstId === instId) return chip;
  }
  return undefined;
}

/** The resolved chips for the active encounter, in flip (resolveSeq) order — i.e. the Past. */
function pastOrderForEncounter(state: GameState): InstId[] {
  const encNo = state.currentEncounter?.encounterNo;
  return state.timeline
    .filter((c) => c.state === "resolved" && (encNo == null || c.encounter === encNo))
    .slice()
    .sort((a, b) => (a.resolveSeq ?? 0) - (b.resolveSeq ?? 0))
    .map((c) => c.cardInstId);
}

function posKeyOf(state: GameState, instId: InstId): string | null {
  const card = state.cards[instId];
  return card?.slots[0] ?? null;
}

function aiHasCardsAt(state: GameState, loc: string): boolean {
  const ns = state.world.nodeState[loc];
  if (!ns) return false;
  for (const map of [ns.sideSlots.ai.creatures, ns.sideSlots.ai.structures, ns.sideSlots.ai.actions]) {
    for (const instId of Object.values(map)) {
      if (instId == null) continue;
      const card = state.cards[instId];
      if (card && card.origin === "aiDeck") return true;
    }
  }
  return false;
}

function compactPayload(p: Record<string, unknown>): string {
  const keys = Object.keys(p);
  if (keys.length === 0) return "";
  try {
    return JSON.stringify(p);
  } catch {
    return `{${keys.join(",")}}`;
  }
}

// ---------- Public entry: called per engine event ----------

/**
 * Record one engine event. Called from the composite handler in main.tsx, AFTER the animation
 * handler. Reads the passed live state read-only. Never throws into the engine — wrapped by the
 * caller, but we also guard here.
 */
export function traceEvent(ev: EngineEvent, state: GameState): void {
  try {
    // Snapshot on phase/subphase change BEFORE formatting the event that may have caused it, so the
    // board state shown is the state as of this beat.
    maybeSnapshot(state);
    for (const line of formatEvent(ev, state)) {
      push(line);
      if (mirrorToConsole && line.trim().length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[devtrace] ${line}`);
      }
    }
  } catch (e) {
    // The tracer must never break the engine or the animation handler.
    // eslint-disable-next-line no-console
    console.error("[devtrace] formatting error", e, ev);
  }
}
