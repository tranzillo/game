// Timeline — the persistent L-frame that WRAPS both zoom views (DECISIONS 2026-06-13).
//
// ONE persistent chip per face-down card travels the whole L — Future → Present → Past — like a
// board card moving hand → slot → graveyard. Each chip is a single DOM element with a shared
// layoutId; as its `state` changes it relocates between the L's zone containers and Framer
// animates the move (the literal "fall" into the Past is Framer's layout animation of that one
// element). All zones live in one LayoutGroup so the handoff measures old→new position.
//
// Geometry: the Present is the top-left elbow. The FUTURE flows in from the right along the top
// edge toward it (soonest-to-resolve nearest the Present). When a chip resolves it falls down
// the left edge into the PAST — a Tetris well that builds UP FROM THE FLOOR, packed in courses
// of ≤3, a new course per phase. The chips are run-scoped (state.timeline); resolved chips ARE
// the Past and persist for the whole run.
//
// Two-axis zoom (coupled to the location view): encounter view scopes the well to the current
// encounter (clears at a new encounter; fullness = how long it's run); map view shows the full
// run. Older entries remain scroll-reachable.

import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { getCardDef } from "../../engine/cards.ts";
import { buildPendingPreviewChips } from "../../engine/timeline.ts";
import { sortChipQueueInPlace } from "../../engine/flip-order.ts";
import type { GameState, Phase, TimelineChip } from "../../engine/types.ts";

interface TimelineProps {
  state: GameState;
  view: "map" | "encounter";
  children: ReactNode;
}

export function Timeline({ state, view, children }: TimelineProps) {
  // The shared LayoutGroup lives at the App root (covers chips AND board cards in one context),
  // so chips animate Future → Present → Past as their element relocates between these zones.
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <TopEdge state={state} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <PastWell state={state} view={view} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Top edge: Present elbow (left) + Future flowing in from the right ----------

function TopEdge({ state }: { state: GameState }) {
  // Live chips come from the run-scoped timeline, scoped to the current encounter for the
  // top edge (Future/Present are inherently about the active encounter).
  const enc = state.currentEncounter;
  const encNo = enc?.encounterNo ?? null;
  const live = encNo != null ? state.timeline.filter((c) => c.encounter === encNo) : [];

  const previewIds = new Set<number>();
  const previews = buildPendingPreviewChips(state);
  for (const p of previews) previewIds.add(p.chipId);

  // Soonest-first nearest the Present (left): Future flows leftward into the elbow.
  const future = sortChipQueueInPlace(state, [
    ...live.filter((c) => c.state === "future"),
    ...previews,
  ]);
  const present = live.filter((c) => c.state === "present");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 8,
        background: "#0e0e14",
        borderBottom: "1px solid #2a2a35",
        minHeight: 58,
      }}
    >
      {/* The Present elbow — fixed at the top-left, the anchor both arms hang from. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, width: 88 }}>
        <span style={{ fontSize: 9, color: "#f0c040", letterSpacing: 1 }}>PRESENT</span>
        <div style={{ display: "flex", gap: 4, minHeight: 36 }}>
          {present.length > 0 ? (
            present.map((chip) => <Chip key={chip.chipId} chip={chip} state={state} zone="present" />)
          ) : (
            <Empty />
          )}
        </div>
      </div>

      <div style={{ width: 1, height: 30, background: "#2a2a35", flexShrink: 0 }} />

      {/* Future: soonest-first nearest the Present (left). Flows in from the right. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 9, color: "#aaa", letterSpacing: 1 }}>← FUTURE</span>
        <div style={{ display: "flex", gap: 4, minHeight: 36, overflowX: "auto" }}>
          {future.length > 0 ? (
            future.map((chip) => (
              <Chip
                key={chip.chipId}
                chip={chip}
                state={state}
                zone="future"
                preview={previewIds.has(chip.chipId)}
              />
            ))
          ) : (
            <Empty />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Left edge: the Past well, falling from the elbow ----------

function PastWell({ state, view }: { state: GameState; view: "map" | "encounter" }) {
  // The Past is the RESOLVED chips in the run-scoped timeline. Time-zoom scope coupled to
  // location-zoom: encounter view → current encounter only (clears at a new one); map → full run.
  const currentEnc = state.currentEncounter?.encounterNo ?? null;
  // Order by resolution (flip) order, not the timeline's commit/append order — chips flip in
  // sorted Tempo/initiative order, so the Past must read by resolveSeq to match what flipped.
  const resolved = state.timeline
    .filter((c) => c.state === "resolved")
    .slice()
    .sort((a, b) => (a.resolveSeq ?? 0) - (b.resolveSeq ?? 0));
  const scoped =
    view === "encounter" && currentEnc != null
      ? resolved.filter((c) => c.encounter === currentEnc)
      : resolved;

  // Pack into courses of ≤3, a new course per phase (partial rows stay partial).
  const courses = buildCourses(scoped);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep the floor (bottom, where chips land) in view as the pile grows past the viewport.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scoped.length]);

  return (
    // Outer column: fixed PAST header (does NOT scroll) + a scroll region that fills the rest of
    // the map/encounter area height. Splitting the header out means the scroll region's height is
    // exactly the available space, so the well only scrolls once chips actually exceed it — not
    // before (the sticky header inside the scroller was forcing content > window before).
    <div
      style={{
        width: 110,
        flexShrink: 0,
        background: "#0e0e14",
        borderRight: "1px solid #2a2a35",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "6px 6px 4px",
          fontSize: 9,
          color: "#666",
          letterSpacing: 1,
          borderBottom: "1px solid #1d1d26",
        }}
      >
        PAST {view === "map" ? "· run" : ""}
      </div>

      {/* Scroll region — fills the remaining height (the map/encounter area minus the header). */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* The well fills the scroll region exactly (minHeight:100%); the pile sits on the floor
            and only overflows — and thus scrolls — once there are enough chips. column-reverse
            stacks courses floor-up: oldest on the floor, newest the top brick. */}
        <div
          style={{
            minHeight: "100%",
            padding: 6,
            display: "flex",
            flexDirection: "column-reverse",
            justifyContent: "flex-start",
            gap: 3,
          }}
        >
          {scoped.length === 0 && <span style={{ color: "#444", fontSize: 11 }}>—</span>}
          {courses.map((c) => (
            <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {c.chips.map((chip) => (
                  <Chip key={chip.chipId} chip={chip} state={state} zone="past" />
                ))}
              </div>
              {c.isPhaseStart && (
                <div
                  style={{
                    fontSize: 8,
                    color: c.isEncounterStart ? "#4a8aef" : "#555",
                    borderTop: `1px solid ${c.isEncounterStart ? "#2a3a55" : "#1d1d26"}`,
                    paddingTop: 1,
                    lineHeight: 1.2,
                  }}
                >
                  {c.label}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Course {
  key: string;
  label: string;
  isPhaseStart: boolean;
  isEncounterStart: boolean;
  chips: TimelineChip[];
}

// Pack resolved chips (oldest → newest) into courses of ≤3, breaking at every phase boundary
// (new phase = new row always). Oldest-first; the well renders column-reverse so the oldest
// course is on the floor and the newest is the top brick.
function buildCourses(resolved: TimelineChip[]): Course[] {
  const courses: Course[] = [];
  let lastPhaseKey: string | null = null;
  let lastEncounter: number | null = null;

  for (const chip of resolved) {
    const phaseKey = `e${chip.encounter}-t${chip.turn}-${chip.phase}`;
    const phaseChanged = phaseKey !== lastPhaseKey;
    const last = courses[courses.length - 1];
    if (last && !phaseChanged && last.chips.length < 3) {
      last.chips.push(chip);
    } else {
      courses.push({
        key: `${phaseKey}-${courses.length}`,
        label: `Enc ${chip.encounter} · T${chip.turn} · ${phaseAbbr(chip.phase)}`,
        isPhaseStart: phaseChanged,
        isEncounterStart: chip.encounter !== lastEncounter,
        chips: [chip],
      });
    }
    lastPhaseKey = phaseKey;
    lastEncounter = chip.encounter;
  }
  return courses;
}

function phaseAbbr(phase: Phase): string {
  switch (phase) {
    case "upkeep":
      return "up";
    case "draw":
      return "draw";
    case "main":
      return "main";
    case "combat":
      return "cbt";
    case "cleanup":
      return "clr";
  }
}

// ---------- The one persistent chip element ----------

function Empty() {
  return <span style={{ color: "#444", fontSize: 11, alignSelf: "center" }}>—</span>;
}

interface ChipProps {
  chip: TimelineChip;
  state: GameState;
  zone: "future" | "present" | "past";
  preview?: boolean;
}

function Chip({ chip, state, zone, preview = false }: ChipProps) {
  // Present chips are gold; future/past are dark. Past chips are slightly smaller (settled
  // bricks). The SAME element animates between zones via the shared layoutId, so the size/zone
  // change is a Framer transition, not a swap.
  const isPast = zone === "past";
  const bg = zone === "present" ? "#f0c040" : "#1a1a22";
  const fg = zone === "present" ? "#000" : "#aaa";
  const card = state.cards[chip.cardInstId];
  const label = card ? getCardDef(card.defKey).name.slice(0, 3).toUpperCase() : "?";
  const sideBorder = chip.side === "player" ? "#4a8aef" : "#ef5a5a";
  const showIdentity = chip.side === "player" || chip.state === "resolved";
  const size = isPast ? 26 : 36;
  return (
    <motion.div
      layoutId={`chip-${preview ? `preview-${chip.cardInstId}` : chip.chipId}`}
      transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.9 }}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: bg,
        color: fg,
        borderRadius: isPast ? 3 : 4,
        border: preview
          ? "1px dashed #f0c040"
          : `1px solid ${zone === "present" ? "#f0c040" : isPast ? sideBorder : "#2a2a35"}`,
        opacity: preview ? 0.65 : 1,
        display: "grid",
        placeItems: "center",
        fontSize: isPast ? 8 : 10,
        fontWeight: 600,
      }}
      title={`${card ? getCardDef(card.defKey).name : "?"} (${chip.side} ${chip.loc} ${chip.posKey ?? "—"}, tempo ${chip.cachedTempo}) — Enc ${chip.encounter} T${chip.turn} ${chip.phase}${preview ? " · pending" : ""}`}
    >
      {showIdentity ? label : "?"}
    </motion.div>
  );
}
