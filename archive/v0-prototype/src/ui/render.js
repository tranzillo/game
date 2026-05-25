import { state, L } from "../engine/state.js";
import { LOCATION_COUNT, LOC_NAMES, LOC_TEXT_KEYS } from "../engine/config.js";
import { logEntry } from "../engine/log.js";
import { committedStatTotal, effectiveStat, globalStatTotal, visibleStatTotal } from "../engine/stats.js";
import {
  LOCATION_TEXTS,
  computeCombatOrder,
  effectiveCosts,
  canPay,
  cardHasAnyLegalPlay,
  slotOccupied,
  placeCard,
  cancelPendingPlacement,
  moveCommittedCreature,
  isAdjacent,
  isCommitWindowFor,
  computeCombatPreview,
  EQUIPMENT_CAP_PER_HOST,
  advancePhase
} from "../engine/core.js";
import {
  chooseDeckAndStartRun,
  getNode,
  legalMovesFromPawn,
  moveTo,
  endEncounter
} from "../engine/run.js";
import { _cardRegistry, _chipRegistry } from "./registries.js";
import {
  captureChipRects,
  applyChipFlipAnimations
} from "./animations.js";

// ---------- UI: rendering ----------
const $ = (id) => document.getElementById(id);

// Most recent combat preview, computed at start of each render during main phase.
let _combatPreview = null;

// Build the initiative tracker's items for the current phase. Each item describes one queued
// event (flip, action-resolve, equipment-flip, attack), with ordering metadata (Tempo, side,
// position) and presentation (face-up/face-down to the player). The tracker shows everything
// that's lined up to resolve in this phase, with already-resolved items left in but faded.
export function buildInitiativeQueue() {
  if (!state.sides) return [];
  const items = [];
  const phase = state.phase;
  // POS_RANK matches endOfPhaseRevealAndResolve's tiebreak ordering.
  const POS_RANK = { fl: 0, fr: 1, bl: 2, br: 3, structure: 4, action: 5 };

  if (phase === "combat" || phase === "combat-reveal") {
    // Combat-reveal preview / combat phase: show the attack queue. Per-location combat orders
    // concatenated; each location resolves in its own Tempo order. For tracker display we flatten
    // them by Tempo, side, location, pos. In combat-reveal, this is a preview of what's about to
    // fire when the player advances; in combat, items mark resolved as they swing.
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const order = computeCombatOrder(loc);
      for (const c of order) {
        items.push({
          id: `attack-${c.creature.instId}`,
          kind: "attack",
          side: c.side,
          loc, pos: c.pos,
          tempo: c.creature.tempo || 0,
          card: c.creature,
          faceUp: c.creature.revealed !== false || c.side === "player"
        });
      }
    }
  } else {
    // Interactive / flip phases: collect what endOfPhaseRevealAndResolve would queue.
    for (const sideName of ["player", "ai"]) {
      for (let loc = 0; loc < LOCATION_COUNT; loc++) {
        const lc = L(sideName, loc);
        // Face-down committed creatures → flip events.
        for (const pos of ["fl","fr","bl","br"]) {
          const c = lc.creatures[pos];
          if (c && c.revealed === false) {
            items.push({ id: `flip-${c.instId}`, kind: "flip", side: sideName, loc, pos, tempo: c.tempo || 0, card: c, faceUp: sideName === "player" });
          }
        }
        // Non-creature reveal order uses the location's Tempo (caster's side) — see CARD_DESIGN.md.
        const locTempo = committedStatTotal(sideName, loc, "tempo");
        // Face-down committed structure.
        if (lc.structure && lc.structure.revealed === false) {
          items.push({ id: `flip-${lc.structure.instId}`, kind: "flip", side: sideName, loc, pos: "structure", tempo: locTempo, card: lc.structure, faceUp: sideName === "player" });
        }
        // Action in slot (action queue — non-quest, or face-down quest). Location text may
        // suppress the action (chip stays in future, not flipped this phase). Re-checked each
        // render so the player sees suppression status live.
        const locTextKey = LOC_TEXT_KEYS[loc];
        const locText = locTextKey ? LOCATION_TEXTS[locTextKey] : null;
        if (lc.action) {
          const isQuest = lc.action.subtype === "quest";
          const suppressed = locText && typeof locText.shouldSuppressAction === "function"
            ? locText.shouldSuppressAction(lc.action, loc) : false;
          if (!suppressed && (!isQuest || lc.action.revealed === false)) {
            items.push({ id: `action-${lc.action.instId}`, kind: "action", side: sideName, loc, pos: "action", tempo: locTempo, card: lc.action, faceUp: sideName === "player" || lc.action.revealed !== false });
          }
        }
        // Pending equipment.
        for (const pos of ["fl","fr","bl","br"]) {
          const arr = lc.pending.equipment[pos];
          if (!arr) continue;
          for (const eq of arr) {
            items.push({ id: `equip-${eq.instId}`, kind: "equipment", side: sideName, loc, pos, tempo: locTempo, card: eq, faceUp: sideName === "player" || eq.revealed !== false });
          }
        }
        // Pending creature commits (visible to player; AI's pending isn't visible — but per
        // design, after end-of-main both sides' pending become committed face-down, so during
        // main the player's pending creatures preview their tracker position).
        if (sideName === "player") {
          for (const pos of ["fl","fr","bl","br"]) {
            const c = lc.pending.creatures[pos];
            if (c) items.push({ id: `pending-${c.instId}`, kind: "pending", side: sideName, loc, pos, tempo: c.tempo || 0, card: c, faceUp: true });
          }
          if (lc.pending.structure) items.push({ id: `pending-${lc.pending.structure.instId}`, kind: "pending", side: sideName, loc, pos: "structure", tempo: lc.pending.structure.tempo || 0, card: lc.pending.structure, faceUp: true });
          if (lc.pending.action) items.push({ id: `pending-${lc.pending.action.instId}`, kind: "pending", side: sideName, loc, pos: "action", tempo: lc.pending.action.tempo || 0, card: lc.pending.action, faceUp: true });
        }
      }
    }
  }

  // Sort: Tempo desc → side priority → loc → pos.
  items.sort((a, b) => {
    if (a.tempo !== b.tempo) return b.tempo - a.tempo;
    if (a.side !== b.side) return a.side === state.firstSide ? -1 : 1;
    if (a.loc !== b.loc) return a.loc - b.loc;
    return (POS_RANK[a.pos] ?? 99) - (POS_RANK[b.pos] ?? 99);
  });
  return items;
}

// Phase 2a — unified Future → Present → Past timeline renderer. Reads `state.timeline` (chips
// emitted by emitFutureChip + resolveChipForCard). The future bar shows pending chips marching
// right→left in Tempo order (high Tempo = leftmost = closest to present). The past column shows
// resolved chips stacked newest-first below the present node.
//
// Chip face-up rule for display: own-side chips render face-up to the player; opposing-side chips
// render face-down (showing `?`) unless they've already resolved (passed through the present —
// at which point everyone sees them). Marks show on both face-up and face-down chips by design
// (marks leak through fog).
//
// Pending player commits (during main, before commit-fires) also need to show in the future bar
// so the player can preview Tempo position. These don't have chips yet (commit emits the chip).
// To preview: render pending creatures/structures/actions/equipment from state.sides.player as
// pseudo-chips alongside the real timeline.
// Tracks each chip's last-seen state. Used to detect future→resolved transitions: a chip that
// JUST resolved gets rendered into the present (NOW) node for this beat instead of past, so the
// player sees it pass through the present visually. Next render, it goes to past.
const _chipLastState = new Map();

export function renderTimeline() {
  const futureEl = $("timeline-future");
  const pastEl = $("timeline-past");
  const presentChipsEl = $("timeline-present-chips");
  if (!futureEl || !pastEl) return;
  futureEl.innerHTML = "";
  pastEl.innerHTML = "";
  if (presentChipsEl) presentChipsEl.innerHTML = "";
  const top = $("timeline-top");
  const pastCol = $("timeline-past-column");
  if (state.view !== "encounter" || !state.sides) {
    if (top) top.style.display = "none";
    if (pastCol) pastCol.style.display = "none";
    return;
  }
  if (top) top.style.display = "flex";
  if (pastCol) pastCol.style.display = "flex";

  const tl = state.timeline || [];

  // Detect chips currently transiting through the present: a chip whose last-seen state was
  // "future" and is now "resolved" gets rendered in the NOW node this beat instead of past.
  // Next render it'll fall into past normally. This is UI-only; engine state goes directly
  // future → resolved.
  const transiting = new Set();
  for (const c of tl) {
    const prev = _chipLastState.get(c.id);
    if (prev === "future" && c.state === "resolved") {
      transiting.add(c.id);
    }
  }

  // Build pending pseudo-chips for player commits not yet committed (show in future bar so the
  // player can see what their commits will look like in Tempo order before pressing Advance).
  const pseudoFuture = [];
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("player", loc);
    const locTempo = committedStatTotal("player", loc, "tempo");
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.pending.creatures[pos];
      if (c) pseudoFuture.push({ pseudo: true, card: c, side: "player", loc, pos, tempo: c.tempo || 0, faceUp: true, kind: "creature", marks: c.marks || [] });
    }
    if (lc.pending.structure) pseudoFuture.push({ pseudo: true, card: lc.pending.structure, side: "player", loc, pos: "structure", tempo: locTempo, faceUp: true, kind: "structure", marks: lc.pending.structure.marks || [] });
    if (lc.pending.action) pseudoFuture.push({ pseudo: true, card: lc.pending.action, side: "player", loc, pos: "action", tempo: locTempo, faceUp: true, kind: "action", marks: lc.pending.action.marks || [] });
    for (const pos of ["fl","fr","bl","br"]) {
      const arr = lc.pending.equipment[pos];
      if (!arr) continue;
      for (const eq of arr) {
        pseudoFuture.push({ pseudo: true, card: eq, side: "player", loc, pos, tempo: locTempo, faceUp: true, kind: "equipment", marks: eq.marks || [] });
      }
    }
  }

  // Real future chips from state.timeline (state === "future"). Render face-up if owner is
  // player; face-down otherwise.
  const futureChips = tl.filter(c => c.state === "future").map(c => ({
    pseudo: false,
    chip: c,
    side: c.side,
    tempo: c.tempo,
    faceUp: c.side === "player",
    name: c.name,
    kind: c.kind,
    marks: c.marks || []
  }));

  // Sort all future chips by Tempo desc → side priority → loc → pos.
  const POS_RANK = { fl: 0, fr: 1, bl: 2, br: 3, structure: 4, action: 5 };
  const allFuture = [...pseudoFuture.map(p => ({ ...p, isPseudo: true })), ...futureChips.map(c => ({ ...c, isPseudo: false }))];
  allFuture.sort((a, b) => {
    if (a.tempo !== b.tempo) return b.tempo - a.tempo;
    if (a.side !== b.side) return a.side === state.firstSide ? -1 : 1;
    const aLoc = a.loc != null ? a.loc : (a.chip ? a.chip.loc : 99);
    const bLoc = b.loc != null ? b.loc : (b.chip ? b.chip.loc : 99);
    if (aLoc !== bLoc) return aLoc - bLoc;
    const aPos = a.pos || (a.chip ? a.chip.pos : "");
    const bPos = b.pos || (b.chip ? b.chip.pos : "");
    return (POS_RANK[aPos] ?? 99) - (POS_RANK[bPos] ?? 99);
  });

  // Render future chips. Container uses flex-direction: row-reverse so array[0] (highest Tempo)
  // ends up rightmost in DOM order, but visually appears leftmost (closest to present).
  for (const item of allFuture) {
    const el = makeTimelineChipEl(item, /* resolved */ false);
    if (item.isPseudo) el.classList.add("pending-commit");
    futureEl.appendChild(el);
  }

  // Past chips: filter resolved, newest first. Transiting chips skip past — they render in
  // the present container instead.
  const pastChips = tl.filter(c => c.state === "resolved" && !transiting.has(c.id));
  for (let i = pastChips.length - 1; i >= 0; i--) {
    const c = pastChips[i];
    const item = {
      side: c.side,
      tempo: c.tempo,
      faceUp: true,  // resolved chips are face-up by definition (they passed through the present)
      name: c.name,
      kind: c.kind,
      marks: c.marks || [],
      chip: c,
      loc: c.loc,
      pos: c.pos,
      turn: c.turn,
      resolvedTurn: c.resolvedTurn
    };
    // Per REBUILD_PLAN sec 12: chips look the same in all three zones. The container is the
    // only indicator of zone — no zone-specific styling on the chip itself.
    const el = makeTimelineChipEl(item, /* resolved */ false);
    pastEl.appendChild(el);
  }

  // Transiting chips: render into the present (NOW) container for one beat. Same chip element
  // (via _chipRegistry) — FLIP slides it from future-strip → present, then on the next render
  // from present → past column.
  if (presentChipsEl) {
    for (const c of tl) {
      if (!transiting.has(c.id)) continue;
      const item = {
        side: c.side,
        tempo: c.tempo,
        faceUp: true,
        name: c.name,
        kind: c.kind,
        marks: c.marks || [],
        chip: c,
        loc: c.loc,
        pos: c.pos,
        turn: c.turn,
        resolvedTurn: c.resolvedTurn
      };
      const el = makeTimelineChipEl(item, /* resolved */ false);
      presentChipsEl.appendChild(el);
    }
  }

  // Snapshot the current state of every chip for next render's transition detection.
  // Done at the end so this render's "transiting" check has the previous state.
  _chipLastState.clear();
  for (const c of tl) {
    _chipLastState.set(c.id, c.state);
  }
}

// Build a chip DOM element for the timeline. `item` is a normalized chip shape (either a
// state.timeline entry or a pseudo-chip for pending commits).
//
// For real chips (item.chip with a stable id), we reuse the persistent DOM element across
// renders via _chipRegistry — that's what lets FLIP animate the chip sliding seamlessly
// between zones. Pseudo-chips (pending commits) get a fresh element each render.
//
// Per REBUILD_PLAN sec 12: a chip looks the same in all 3 timeline zones (future / present /
// past). The container is the only indicator of zone — no `.resolved` or `.in-present`
// modifier classes applied here.
export function makeTimelineChipEl(item, _unusedResolved) {
  const chipId = item.chip ? item.chip.id : null;
  let el = chipId != null ? _chipRegistry.get(chipId) : null;
  if (el) {
    el.innerHTML = "";
    el.className = "";
    // Clear inline styles that any prior FLIP or zone-specific styling may have left.
  } else {
    el = document.createElement("div");
    if (chipId != null) _chipRegistry.set(chipId, el);
  }
  el.className = `timeline-chip ${item.side || "neutral"}`;
  if (!item.faceUp) el.classList.add("face-down");
  const name = document.createElement("div");
  name.className = "chip-name";
  name.textContent = item.faceUp ? (item.name || (item.card && item.card.name) || "?") : "?";
  el.appendChild(name);
  const meta = document.createElement("div");
  meta.className = "chip-meta";
  const kindStr = item.kind ? item.kind.charAt(0).toUpperCase() + item.kind.slice(1, 4) : "";
  const locStr = item.loc != null ? (LOC_NAMES[item.loc] || "?").slice(0, 6) : "";
  const turnStr = item.resolvedTurn ? ` · t${item.resolvedTurn}` : "";
  meta.textContent = `T${item.tempo} · ${kindStr}${turnStr}`;
  el.appendChild(meta);
  // Marks: visible on face-up AND face-down chips (marks are physical alterations that leak info).
  if (item.marks && item.marks.length > 0) {
    const marksRow = document.createElement("div");
    marksRow.className = "chip-marks";
    for (const m of item.marks) {
      const mEl = document.createElement("span");
      mEl.className = `chip-mark ${m.kind}`;
      mEl.textContent = m.kind.charAt(0).toUpperCase();
      marksRow.appendChild(mEl);
    }
    el.appendChild(marksRow);
  }
  return el;
}

// Phase 2a — pile renderer. Shows the player's piles (deck, discard, graveyard, junkyard, exile)
// as stacked visual references with count and top-card name. Cards aren't yet persistent DOM
// objects that fly between piles (that's Phase 2c) — for now this is a count+identity display.
export function renderPiles() {
  if (state.view !== "encounter" || !state.sides) {
    const bottom = $("player-bottom");
    if (bottom) bottom.style.display = "none";
    return;
  }
  const bottom = $("player-bottom");
  if (bottom) bottom.style.display = "flex";
  const p = state.sides.player;
  fillPile("pile-deck-cards", p.deck, /* faceDown */ true);
  fillPile("pile-discard-cards", p.discard, false);
  fillPile("pile-graveyard-cards", p.graveyard, false);
  fillPile("pile-junkyard-cards", p.junkyard, false);
  fillPile("pile-exile-cards", p.exile, false);
}

export function fillPile(elOrId, cards, faceDown) {
  const el = typeof elOrId === "string" ? $(elOrId) : elOrId;
  if (!el) return;
  el.innerHTML = "";
  if (!cards || cards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "pile-empty";
    empty.textContent = "—";
    el.appendChild(empty);
    return;
  }
  // Render the actual card elements (persistent DOM via _cardRegistry) so a card moving from a
  // slot into a pile visibly FLIP-slides into place. We render every card in the pile, but stack
  // them via absolute positioning + small offsets so the pile looks like a stack of physical cards
  // rather than a vertical list.
  //
  // Only the TOP card (last in array) is shown at full size; cards beneath get the
  // `.card.in-pile-stacked` modifier which shrinks/clips them to outlines via CSS.
  const stack = document.createElement("div");
  stack.className = "pile-stack-inner";
  // Cap the number of physically-rendered cards beneath the top to keep DOM cost bounded.
  // Cards beyond the cap stay in the registry — they just don't appear in the pile DOM (the count
  // badge below shows total).
  const STACK_RENDER_CAP = 4;
  const startIdx = Math.max(0, cards.length - STACK_RENDER_CAP);
  for (let i = startIdx; i < cards.length; i++) {
    const card = cards[i];
    const offsetFromTop = cards.length - 1 - i; // 0 for top card, 1+ for cards beneath
    const cardEl = makeCardEl(card, /* inSlot */ false);
    cardEl.classList.add("in-pile");
    if (faceDown) cardEl.classList.add("face-down-pile");
    if (offsetFromTop > 0) cardEl.classList.add("in-pile-stacked");
    // Stack offset: 2px shift per layer down. Top card (offsetFromTop=0) is at (0,0).
    cardEl.style.left = `${offsetFromTop * 2}px`;
    cardEl.style.top = `${offsetFromTop * 2}px`;
    cardEl.style.zIndex = String(STACK_RENDER_CAP - offsetFromTop);
    stack.appendChild(cardEl);
  }
  el.appendChild(stack);
  // Count badge.
  const count = document.createElement("div");
  count.className = "pile-count";
  count.textContent = cards.length;
  el.appendChild(count);
}

// FLIP animation: capture each persistent card's screen rect before the renderer mutates the DOM.
// After rendering, compute deltas and apply inverse transforms so each card *appears* to be in its
// old position, then transition the transform to identity — the card visibly slides from old to new.
const FLIP_DURATION_MS = 280;

export function capturePreRenderRects() {
  const rects = new Map();
  for (const [id, el] of _cardRegistry) {
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    // Skip degenerate rects (element offscreen, 0x0). Still record so we can animate appearance.
    if (r.width === 0 && r.height === 0) continue;
    rects.set(id, r);
  }
  return rects;
}

// Per-card FLIP duration multipliers. Cards taking longer journeys (board → graveyard) feel
// better with a slower transition so the player tracks the movement; cards just shifting one
// slot animate quickly.
function flipDurationFor(dx, dy) {
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Base 280ms for short moves. Distances over ~300px get up to 480ms.
  let ms = 280;
  if (dist > 200) ms = 380;
  if (dist > 400) ms = 480;
  return ms;
}

// FLIP: for every persistent card element that has a previous rect AND a different current rect,
// inverse-transform and transition to identity. The card visibly slides from old to new position.
//
// Per REBUILD_PLAN sec 17: this is the mechanism that makes "cards move seamlessly between
// piles" work. The persistent DOM (one element per card.instId, kept across renders) plus FLIP
// gives the visible card-cycle from board → graveyard, hand → discard, deck → hand, etc.
export function applyFlipAnimations(preRects) {
  for (const [id, el] of _cardRegistry) {
    if (!el.isConnected) continue;
    const oldRect = preRects.get(id);
    if (!oldRect) continue;  // newly created, no prior position to animate from
    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    const duration = flipDurationFor(dx, dy);
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.zIndex = "10";
    void el.offsetWidth;  // reflow so the transform takes effect before the transition starts
    el.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    el.style.transform = "";
    const onDone = () => {
      el.style.zIndex = "";
      el.style.transition = "";
      el.removeEventListener("transitionend", onDone);
    };
    el.addEventListener("transitionend", onDone);
  }
}

export function render() {
  // Branch by view mode. Menu → Overworld → Encounter.
  if (state.runOver) {
    showGameOver();
  }
  if (state.view === "menu") {
    renderMenu();
    return;
  }
  if (state.view === "overworld") {
    renderOverworld();
    return;
  }
  // Encounter view — FLIP wraps the render: capture rects before, mutate DOM, apply inverse
  // transforms, transition to identity. Cards visibly slide between zones (slot ↔ pile ↔ hand).
  // Per REBUILD_PLAN sec 17 — this is the load-bearing visual mechanism. Engine events trigger
  // their own animations (shake/pulse/etc.) via the subscribe handler in animations.js — those
  // use non-transform CSS properties so they compose with FLIP.
  const preRects = capturePreRenderRects();
  const preChipRects = captureChipRects();
  renderEncounter();
  sweepCardRegistry();
  sweepChipRegistry();
  applyFlipAnimations(preRects);
  applyChipFlipAnimations(preChipRects);
}

// Sweep chip registry: remove entries whose chips are no longer in state.timeline.
function sweepChipRegistry() {
  const liveIds = new Set();
  for (const c of (state.timeline || [])) liveIds.add(c.id);
  for (const [id, el] of _chipRegistry) {
    if (!liveIds.has(id)) {
      _chipRegistry.delete(id);
    }
  }
}

// Start menu: pick a starter deck (Red or Green) before the run begins.
export function renderMenu() {
  $("locations-row").innerHTML = "";
  $("hand").innerHTML = "";
  $("ai-hand-info").textContent = "";
  $("phase-info").textContent = "Choose your starter";
  $("turn-info").textContent = "";
  $("player-summoner").style.display = "none";
  $("ai-summoner").style.display = "none";
  const tlTop = $("timeline-top"); if (tlTop) tlTop.style.display = "none";
  const tlPast = $("timeline-past-column"); if (tlPast) tlPast.style.display = "none";
  const playArea = $("play-area"); if (playArea) playArea.style.display = "none";
  const playerBottom = $("player-bottom"); if (playerBottom) playerBottom.style.display = "none";
  const overworldEl = $("overworld") || createOverworldHost();
  overworldEl.innerHTML = "";
  overworldEl.style.display = "flex";
  const menu = document.createElement("div");
  menu.className = "start-menu";
  const title = document.createElement("h2");
  title.textContent = "Pick a starter";
  menu.appendChild(title);
  const row = document.createElement("div");
  row.className = "start-menu-row";
  const decks = [
    { key: "red", label: "Red", tag: "Force / melee combat", color: "var(--ai)" },
    { key: "green", label: "Green", tag: "Tempo / movement / ranged / traps", color: "var(--ok)" },
    { key: "blue", label: "Blue", tag: "Insight engine / draw / Study (work-in-progress)", color: "#60c0e0" }
  ];
  for (const d of decks) {
    const btn = document.createElement("button");
    btn.className = "start-menu-card";
    btn.style.borderColor = d.color;
    btn.innerHTML = `<div class="start-menu-label" style="color:${d.color}">${d.label}</div><div class="start-menu-tag">${d.tag}</div>`;
    btn.addEventListener("click", () => chooseDeckAndStartRun(d.key));
    row.appendChild(btn);
  }
  menu.appendChild(row);
  overworldEl.appendChild(menu);
  renderLog();
  renderControls();
}

// Render the overworld view: map of nodes + edges, pawn marker, legal-move highlights.
export function renderOverworld() {
  // Hide encounter-only widgets (durability, stat rows, hand, etc.) by clearing their containers.
  $("locations-row").innerHTML = "";
  $("hand").innerHTML = "";
  $("ai-hand-info").textContent = "";
  $("phase-info").textContent = "Overworld";
  $("turn-info").textContent = `Run Durability: ${state.runDurability}`;
  // Hide summoner widgets (player Durability shown via run Durability above instead).
  $("player-summoner").style.display = "none";
  $("ai-summoner").style.display = "none";
  // Hide the encounter-only Past strip.
  const tlTop = $("timeline-top"); if (tlTop) tlTop.style.display = "none";
  const tlPast = $("timeline-past-column"); if (tlPast) tlPast.style.display = "none";
  const playArea = $("play-area"); if (playArea) playArea.style.display = "none";
  const playerBottom = $("player-bottom"); if (playerBottom) playerBottom.style.display = "none";

  // Build the overworld panel.
  const overworldEl = $("overworld") || createOverworldHost();
  overworldEl.innerHTML = "";
  overworldEl.style.display = "flex";
  overworldEl.appendChild(buildOverworldSvg());
  overworldEl.appendChild(buildOverworldHelp());

  renderLog();
  renderControls();
}

// Render the encounter view (existing v2 layout). Called when state.view === "encounter".
export function renderEncounter() {
  // Show summoner widgets. Player always visible. AI bar only visible at boss encounters
  // (the AI is the only summoner-with-Durability we ever fight; non-boss "AI" is just a holder
  // for hostile/neutral content with no summoner to attack).
  $("player-summoner").style.display = "";
  $("ai-summoner").style.display = state.encounterKind === "boss" ? "" : "none";
  // Show encounter-only widgets.
  const playArea = $("play-area"); if (playArea) playArea.style.display = "flex";
  const playerBottom = $("player-bottom"); if (playerBottom) playerBottom.style.display = "flex";
  // Hide overworld panel during encounters.
  const overworldEl = $("overworld");
  if (overworldEl) { overworldEl.innerHTML = ""; overworldEl.style.display = "none"; }

  // Unified Future → Present → Past timeline (top + left).
  renderTimeline();
  renderPiles();

  // Combat preview is only meaningful during combat-reveal, after both sides have committed.
  _combatPreview = (state.phase === "combat-reveal") ? computeCombatPreview() : null;

  // Summoner durability and deck info (global per side).
  $("player-durability").textContent = state.sides.player.durability;
  $("ai-durability").textContent = state.encounterKind === "boss" ? state.sides.ai.durability : "—";
  $("player-deck-info").textContent = `deck ${state.sides.player.deck.length} · discard ${state.sides.player.discard.length} · grave ${state.sides.player.graveyard.length}`;
  $("ai-deck-info").textContent = `deck ${state.sides.ai.deck.length} · discard ${state.sides.ai.discard.length} · grave ${state.sides.ai.graveyard.length}`;
  $("ai-hand-info").textContent = `AI hand: ${state.sides.ai.hand.length} card${state.sides.ai.hand.length === 1 ? "" : "s"}`;

  const node = getNode(state.currentNodeId);
  $("phase-info").textContent = `${node ? node.label + " · " : ""}Phase: ${state.phase}`;
  $("turn-info").textContent = `Turn ${state.turn}`;

  // Priority highlight + incoming-damage indicator on each summoner.
  for (const sideName of ["player", "ai"]) {
    const summonerEl = $(sideName + "-summoner");
    const badge = $(sideName + "-priority-badge");
    if (state.firstSide === sideName) {
      summonerEl.classList.add("has-priority");
      badge.textContent = "First";
      badge.classList.add("show");
    } else {
      summonerEl.classList.remove("has-priority");
      badge.classList.remove("show");
    }
    const incoming = $(sideName + "-incoming");
    const dmg = _combatPreview ? _combatPreview.summonerHits[sideName] : 0;
    if (dmg > 0) {
      incoming.textContent = `−${dmg} incoming`;
      incoming.classList.add("show");
    } else {
      incoming.classList.remove("show");
    }
  }

  // Build the locations row from scratch each render — simpler than diffing for v2 scale.
  const locsRow = $("locations-row");
  locsRow.innerHTML = "";
  locsRow.style.setProperty("--loc-count", LOCATION_COUNT);
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    locsRow.appendChild(buildLocationColumn(loc));
  }

  renderHand();
  renderLog();
  renderControls();
}

// Lazy-init the overworld DOM host (placed inside #board, above #locations-row).
export function createOverworldHost() {
  // The overworld host is a top-level element (sibling of #play-area) so it remains visible when
  // #play-area is hidden during menu and overworld views.
  const el = document.createElement("div");
  el.id = "overworld";
  const playArea = $("play-area");
  if (playArea && playArea.parentNode) {
    playArea.parentNode.insertBefore(el, playArea);
  } else {
    document.body.appendChild(el);
  }
  return el;
}

// Build the overworld map as inline SVG: nodes as circles with labels, edges as lines, pawn marker.
export function buildOverworldSvg() {
  const W = 800, H = 360;
  const PAD = 60;
  const nodes = state.world.nodes;
  // Compute pixel positions from node x/y grid coords. Map x:[0..5], y:[0..4] to canvas.
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  function px(n) {
    const t = (n.x - xMin) / Math.max(1, xMax - xMin);
    return PAD + t * (W - 2 * PAD);
  }
  function py(n) {
    const t = (n.y - yMin) / Math.max(1, yMax - yMin);
    return PAD + t * (H - 2 * PAD);
  }
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "overworld-svg");

  // Edges first (under nodes).
  for (const [a, b] of state.world.edges) {
    const na = getNode(a), nb = getNode(b);
    const ln = document.createElementNS(ns, "line");
    ln.setAttribute("x1", px(na));
    ln.setAttribute("y1", py(na));
    ln.setAttribute("x2", px(nb));
    ln.setAttribute("y2", py(nb));
    ln.setAttribute("class", "ow-edge");
    svg.appendChild(ln);
  }

  const legalSet = new Set(legalMovesFromPawn());
  // Fog rule: a node's kind is revealed if it's the pawn's current node, has been completed, or
  // is directly adjacent to the pawn (i.e., it would be in an encounter if the pawn engages).
  const adjacentToPawn = new Set();
  for (const [a, b] of state.world.edges) {
    if (a === state.world.pawnAt) adjacentToPawn.add(b);
    if (b === state.world.pawnAt) adjacentToPawn.add(a);
  }
  function isRevealed(n) {
    if (n.id === state.world.pawnAt) return true;
    if (n.status === "completed") return true;
    if (adjacentToPawn.has(n.id)) return true;
    return false;
  }
  for (const n of nodes) {
    const cx = px(n), cy = py(n);
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "ow-node-group");

    const revealed = isRevealed(n);
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", 28);
    let cls = "ow-node ow-node-" + (revealed ? n.kind : "fog") + " ow-node-status-" + n.status;
    if (legalSet.has(n.id)) cls += " ow-node-legal";
    if (state.world.pawnAt === n.id) cls += " ow-node-pawn";
    c.setAttribute("class", cls);
    g.appendChild(c);

    // Kind icon: fully revealed (shows hostile vs neutral vs end) only when the node has been
    // approached. Fogged nodes show a `?` — the player knows the place but not whether the AI
    // has shown up there.
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", cx); t.setAttribute("y", cy + 4);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", "ow-node-label");
    if (revealed) {
      t.textContent = (n.kind === "end" ? "★" : n.kind === "neutral" ? "?" : n.kind === "hostile" ? "⚔" : "•");
    } else {
      t.textContent = "?";  // fogged — could be neutral or hostile
    }
    g.appendChild(t);

    // Node label is always visible — the player knows the *place*, just not whether the AI is
    // there. (Per design: peace-time text is the location's "name"; the war-time presence is what
    // fog hides.)
    const tl = document.createElementNS(ns, "text");
    tl.setAttribute("x", cx); tl.setAttribute("y", cy + 50);
    tl.setAttribute("text-anchor", "middle");
    tl.setAttribute("class", "ow-node-name");
    tl.textContent = n.label;
    g.appendChild(tl);

    if (legalSet.has(n.id) && !state.runOver) {
      g.style.cursor = "pointer";
      g.addEventListener("click", () => moveTo(n.id));
    }

    svg.appendChild(g);
  }

  return svg;
}

export function buildOverworldHelp() {
  const help = document.createElement("div");
  help.className = "overworld-help";
  const node = getNode(state.world.pawnAt);
  help.innerHTML = `
    <div><strong>Overworld.</strong> Click your pawn's node to engage with adjacent unvisited nodes. After clearing, click a cleared adjacent to walk there.</div>
    <div>You're at: <strong>${node ? node.label : "?"}</strong></div>
    <div>Run Durability: <strong>${state.runDurability}</strong> &nbsp;·&nbsp; Run deck: <strong>${state.runDeck.length}</strong> cards</div>
    <div class="muted">⚔ hostile · ? neutral · ★ boss · • start · fogged: name shown, presence hidden</div>
  `;
  return help;
}

// Build a single .location column for index `loc`. Internal layout: header label, AI structure
// row, AI side (stat-row + creature grid + action slot), player side (mirror), player structure.
export function buildLocationColumn(loc) {
  const col = document.createElement("div");
  col.className = "location";
  col.dataset.loc = String(loc);

  // Location label.
  const label = document.createElement("div");
  label.className = "location-label";
  label.textContent = LOC_NAMES[loc] || `Location ${loc + 1}`;
  col.appendChild(label);

  // Location text (if this location has any printed rules effect).
  const textKey = LOC_TEXT_KEYS[loc];
  if (textKey && LOCATION_TEXTS[textKey]) {
    const txt = document.createElement("div");
    txt.className = "location-text";
    txt.textContent = LOCATION_TEXTS[textKey].desc;
    col.appendChild(txt);
  }

  // AI structure row (above the AI side).
  const aiStructRow = document.createElement("div");
  aiStructRow.className = "ai-structure-row";
  const aiStructLabel = document.createElement("div");
  aiStructLabel.className = "structure-row-label";
  aiStructLabel.textContent = "AI structure";
  aiStructRow.appendChild(aiStructLabel);
  aiStructRow.appendChild(buildSimpleSlot("ai", loc, "structure"));
  aiStructRow.appendChild(document.createElement("div")); // spacer right column
  col.appendChild(aiStructRow);

  // AI info (stat row).
  const aiInfo = document.createElement("div");
  aiInfo.className = "side-info ai-info";
  aiInfo.appendChild(buildStatRow("ai", loc));
  col.appendChild(aiInfo);

  // AI side (creature grid 2x2, back row first so front row is closer to centerline).
  const aiSide = document.createElement("div");
  aiSide.className = "ai-side";
  aiSide.appendChild(buildCreatureGrid("ai", loc));
  col.appendChild(aiSide);

  // AI action slot.
  const aiAction = buildSimpleSlot("ai", loc, "action");
  aiAction.classList.add("ai-action-slot");
  col.appendChild(aiAction);

  // Player info (stat row).
  const playerInfo = document.createElement("div");
  playerInfo.className = "side-info player-info";
  playerInfo.appendChild(buildStatRow("player", loc));
  col.appendChild(playerInfo);

  // Player side (creature grid).
  const playerSide = document.createElement("div");
  playerSide.className = "player-side";
  playerSide.appendChild(buildCreatureGrid("player", loc));
  col.appendChild(playerSide);

  // Player action slot.
  const playerAction = buildSimpleSlot("player", loc, "action");
  playerAction.classList.add("player-action-slot");
  col.appendChild(playerAction);

  // Player structure row (below the player side).
  const playerStructRow = document.createElement("div");
  playerStructRow.className = "player-structure-row";
  const playerStructLabel = document.createElement("div");
  playerStructLabel.className = "structure-row-label";
  playerStructLabel.textContent = "Your structure";
  playerStructRow.appendChild(playerStructLabel);
  playerStructRow.appendChild(buildSimpleSlot("player", loc, "structure"));
  playerStructRow.appendChild(document.createElement("div"));
  col.appendChild(playerStructRow);

  // Per-location piles row (graveyard / junkyard / exile that belong to the location itself).
  // Populated when a card dies on a side with no summoner present. Renders nothing when all
  // zones are empty.
  const locPiles = buildLocationPileRow(loc);
  if (locPiles) col.appendChild(locPiles);

  return col;
}

// Build a row of compact pile slots for one location's own piles. Returns null when all zones
// are empty (so the row collapses out of layout entirely). Each non-empty zone is rendered as
// a small pile via fillPile, reusing the persistent-card-DOM + FLIP-on-arrival behavior the
// side-root piles already use. Slot ids follow `loc-pile-{loc}-{zone}` so subsequent renders
// find the same container.
export function buildLocationPileRow(loc) {
  if (!state.sides) return null;
  // Pull piles off either side's location — they share the location data via shared structure.
  // (Both sides' `locations[loc].piles` should be the same per-location pile, but in the current
  // model each side keeps its own location object, so we read from "ai" by convention.)
  const lc = L("ai", loc);
  if (!lc || !lc.piles) return null;
  const zones = ["graveyard", "junkyard", "exile"];
  const nonEmpty = zones.filter(z => lc.piles[z].length > 0);
  if (nonEmpty.length === 0) return null;
  const row = document.createElement("div");
  row.className = "location-pile-row";
  for (const zone of nonEmpty) {
    const slot = document.createElement("div");
    slot.className = "pile-stack loc-pile-stack";
    const label = document.createElement("div");
    label.className = "pile-label";
    label.textContent = zone.toUpperCase().slice(0, 4);  // GRAV / JUNK / EXIL
    slot.appendChild(label);
    const cards = document.createElement("div");
    cards.className = "pile-cards loc-pile-cards";
    cards.id = `loc-pile-${loc}-${zone}`;
    slot.appendChild(cards);
    row.appendChild(slot);
    fillPile(cards, lc.piles[zone], false);
  }
  return row;
}

export function buildStatRow(side, loc) {
  const row = document.createElement("div");
  row.className = "stat-row";
  for (const stat of ["force", "tempo", "insight"]) {
    const cmt = committedStatTotal(side, loc, stat);
    const vis = visibleStatTotal(side, loc, stat);
    const cell = document.createElement("div");
    cell.className = "stat-cell stat-" + stat;
    cell.innerHTML = `<div class="stat-cell-label">${stat.charAt(0).toUpperCase() + stat.slice(1)}</div><div class="stat-cell-value">${cmt}${vis > cmt ? `<span class="stat-pending">+${vis - cmt}</span>` : ""}</div>`;
    row.appendChild(cell);
  }
  // Ammo stockpile for this side at this location. Only show when nonzero to avoid clutter.
  const ammo = L(side, loc).ammo || 0;
  if (ammo > 0) {
    const cell = document.createElement("div");
    cell.className = "stat-cell stat-ammo";
    cell.innerHTML = `<div class="stat-cell-label">Ammo</div><div class="stat-cell-value">${ammo}</div>`;
    row.appendChild(cell);
  }
  return row;
}

export function buildCreatureGrid(side, loc) {
  const grid = document.createElement("div");
  grid.className = "creature-grid";
  // Player: front-row at top (closer to centerline). AI: back row first so front row is at bottom.
  const order = side === "player" ? ["fl", "fr", "bl", "br"] : ["bl", "br", "fl", "fr"];
  const lc = L(side, loc);

  for (const pos of order) {
    const committedCard = lc.creatures[pos];
    const pendingCard = lc.pending.creatures[pos];
    const cell = document.createElement("div");
    cell.className = "slot";
    cell.dataset.side = side;
    cell.dataset.loc = String(loc);
    cell.dataset.pos = pos;
    cell.dataset.kind = "creature";

    if (committedCard) {
      cell.classList.add("has-card");
      const cardEl = makeCardEl(committedCard, true);
      if (side === "player" && state.selectedCommittedId === committedCard.instId) {
        cardEl.classList.add("selected");
      }
      if (lc.movedThisTurn.has(committedCard.instId)) cardEl.classList.add("moved");
      cell.appendChild(cardEl);
    } else if (pendingCard) {
      cell.classList.add("has-card", "pending");
      const cardEl = makeCardEl(pendingCard, true);
      cardEl.classList.add("pending-card");
      cell.appendChild(cardEl);
    } else {
      const lbl = document.createElement("span");
      lbl.className = "slot-label";
      lbl.textContent = pos;
      cell.appendChild(lbl);
    }

    if (side === "player") {
      const inMain = state.phase === "main";
      // Movement allowed in any interactive phase. The moveCommittedCreature engine call applies
      // the per-card per-turn budget plus the flipped-this-turn and sleep/groggy gates.
      const movementAllowed = ["upkeep","draw","main","combat-reveal","cleanup"].includes(state.phase);

      // Hand-card placement (creatures only commit during main).
      if (inMain) {
        const sel = state.selectedCardId ? findHandCard(state.selectedCardId) : null;
        if (sel && sel.type === "creature" && !slotOccupied("player", loc, "creature", pos) && canPay("player", loc, sel)) {
          cell.classList.add("legal-target");
          cell.addEventListener("click", () => placeSelectedAt({ loc, kind: "creature", pos }));
        }
        // Pending creature cancel.
        if (pendingCard && !sel && !state.selectedCommittedId) {
          cell.classList.add("can-cancel");
          cell.addEventListener("click", () => {
            cancelPendingPlacement("player", loc, "creature", pos);
            render();
          });
        }
      }
      // Equipment placement: available in any interactive phase. Target a slot that has a
      // face-up committed creature here. Pending or face-down hosts don't qualify — equipment
      // needs a landed host. Cap: skip hosts already at the per-host equipment cap.
      if (isCommitWindowFor("equipment")) {
        const sel = state.selectedCardId ? findHandCard(state.selectedCardId) : null;
        if (sel && sel.type === "equipment" && committedCard && committedCard.revealed !== false && canPay("player", loc, sel) && (committedCard.equipment || []).length < EQUIPMENT_CAP_PER_HOST) {
          cell.classList.add("legal-target");
          cell.addEventListener("click", () => placeSelectedAt({ loc, kind: "equipment", pos }));
        }
      }

      // Committed-creature selection for movement (within this location only — v2 scope).
      if (movementAllowed && committedCard && !state.selectedCardId) {
        if (state.selectedCommittedId === committedCard.instId) {
          cell.addEventListener("click", () => {
            state.selectedCommittedId = null;
            render();
          });
        } else if (
          committedCard.revealed !== false &&
          !committedCard.flippedThisTurn &&
          !lc.movedThisTurn.has(committedCard.instId) &&
          committedCard.sleepCounter === 0 &&
          committedCard.wokeInPhase !== state.phase
        ) {
          cell.classList.add("can-select-move");
          cell.addEventListener("click", () => {
            state.selectedCommittedId = committedCard.instId;
            state.selectedCardId = null;
            render();
          });
        }
      }

      // Movement target: empty adjacent slot at the same location as the selected creature.
      if (movementAllowed && state.selectedCommittedId && !committedCard && !pendingCard) {
        const found = findCommittedCreatureAndLoc("player", state.selectedCommittedId);
        if (found && found.loc === loc) { // same-location moves only in v2
          if (isAdjacent(found.pos, pos)) {
            cell.classList.add("legal-target");
            cell.addEventListener("click", () => {
              moveCommittedCreature("player", loc, found.pos, pos);
              state.selectedCommittedId = null;
              render();
            });
          }
        }
      }
    }
    grid.appendChild(cell);
  }
  return grid;
}

// Locate a committed creature anywhere on a side. Returns { loc, pos, creature } or null.
export function findCommittedCreatureAndLoc(side, instId) {
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L(side, loc);
    for (const pos of ["fl", "fr", "bl", "br"]) {
      const c = lc.creatures[pos];
      if (c && c.instId === instId) return { loc, pos, creature: c };
    }
  }
  return null;
}

// Locate a card's in-play position (any side, creature or structure). Returns { side, loc, pos }
// or null. Used by the renderer to read live `effectiveStat` for stat badges.
export function findCardInPlay(card) {
  if (!state.sides) return null;
  for (const side of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(side, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        if (lc.creatures[pos] === card) return { side, loc, pos };
      }
      if (lc.structure === card) return { side, loc, pos: "structure" };
    }
  }
  return null;
}

// Build a structure or action slot at a location. Returns the slot element.
export function buildSimpleSlot(side, loc, kind) {
  const slot = document.createElement("div");
  slot.className = "slot";
  if (kind === "structure") slot.classList.add("structure-slot");
  slot.dataset.side = side;
  slot.dataset.loc = String(loc);
  slot.dataset.kind = kind;

  const lc = L(side, loc);
  const committed = lc[kind];
  const pending = lc.pending[kind];

  if (committed) {
    slot.classList.add("has-card");
    slot.appendChild(makeCardEl(committed, true));
  } else if (pending) {
    slot.classList.add("has-card", "pending");
    const el = makeCardEl(pending, true);
    el.classList.add("pending-card");
    slot.appendChild(el);
    if (side === "player" && isCommitWindowFor(kind) && !state.selectedCardId && !state.selectedCommittedId) {
      slot.classList.add("can-cancel");
      slot.addEventListener("click", () => {
        cancelPendingPlacement("player", loc, kind);
        render();
      });
    }
  } else {
    const lbl = document.createElement("span");
    lbl.className = "slot-label";
    lbl.textContent = kind;
    slot.appendChild(lbl);

    // Legal target if the selected hand card matches type, can pay at this location, and we're in
    // a commit window for that type.
    if (side === "player" && isCommitWindowFor(kind)) {
      const sel = state.selectedCardId ? findHandCard(state.selectedCardId) : null;
      if (sel && sel.type === kind && canPay("player", loc, sel)) {
        slot.classList.add("legal-target");
        slot.addEventListener("click", () => placeSelectedAt({ loc, kind }));
      }
    }
  }
  return slot;
}

// ---------- Persistent card DOM registry (Phase 2c-step-1) ----------
// Each card instance keeps a stable outer DOM element across renders, keyed by instId. This
// is the foundation for the FLIP animation work (Phase 2c-step-2): because the element is the
// same node when the card moves between zones, we can measure old vs new screen positions and
// animate the transform. Inner content + event listeners are still rebuilt each render.
// (Registry itself lives in ./registries.js so animations.js can share it.)
// Tracks the last-seen `revealed` state per card instance. When it transitions false→true
// across renders, we add a transient `flipping-up` class so the card animates a face-down →
// face-up reveal via CSS rotateY.
export const _lastRevealed = new Map();
// Tracks the last-seen mark count per card instance. When a new mark appears, the rendered
// mark badge gets a transient `mark-new` class so it fades + scales in.
export const _lastMarkCount = new Map();

// Get or create the persistent outer element for a card. Returns a div with the card's instId
// in dataset. Inner content is cleared so the caller can rebuild fresh. Caller is responsible
// for placing the element in the right container and setting classes/listeners.
export function getCardOuterEl(card) {
  let el = _cardRegistry.get(card.instId);
  if (!el) {
    el = document.createElement("div");
    el.dataset.instId = String(card.instId);
    _cardRegistry.set(card.instId, el);
  }
  // Clear listeners by cloning (lightweight: we re-bind everything on each render). Clones
  // share no listeners but copy attributes/dataset. The registry holds the clone.
  // Actually — for FLIP we want the same node identity. Listeners get removed by clearing
  // innerHTML below; outer-level listeners we'll explicitly remove via cloning if needed.
  // For now, the strategy is: clear innerHTML + remove all event listeners by replacing the
  // element with a clone of itself (cheap, preserves attrs). But replacing breaks identity —
  // so instead we track listeners separately. Simplest: use removeEventListener with named fns,
  // or accept that outer-level listeners are added each render and rely on the fact that we
  // remove the element from its old parent (which also unbinds inherited listeners).
  // For this step we just clear innerHTML and re-attach handlers; the previous handlers will
  // still fire on the old DOM-detached element, which is harmless (the user can't click an
  // element not in the document).
  el.innerHTML = "";
  // Preserve in-flight animation state across renders. The event-handler in animations.js fires
  // synchronously from emit(), then the engine calls render() immediately — without this
  // preservation, the className wipe + style strip would erase the anim-* keyframe classes and
  // any inline transform/transition (e.g., the attack lurch) before they could paint.
  const preservedAnims = [];
  for (const cls of el.classList) {
    if (cls.startsWith("anim-")) preservedAnims.push(cls);
  }
  const preservedTransform = el.style.transform;
  const preservedTransition = el.style.transition;
  const preservedZIndex = el.style.zIndex;
  el.className = "";
  el.removeAttribute("style");
  for (const cls of preservedAnims) el.classList.add(cls);
  if (preservedTransform) el.style.transform = preservedTransform;
  if (preservedTransition) el.style.transition = preservedTransition;
  if (preservedZIndex) el.style.zIndex = preservedZIndex;
  el.draggable = false;
  return el;
}

// Sweep the registry: any element whose card is no longer in any tracked zone is removed.
// Called at the end of render to keep the registry from growing unboundedly.
export function sweepCardRegistry() {
  if (!state.sides) {
    // Off-encounter — no card state is meaningful. Keep registry for now; encounter load resets.
    return;
  }
  const alive = new Set();
  for (const sideName of ["player", "ai"]) {
    const s = state.sides[sideName];
    for (const c of s.hand) alive.add(c.instId);
    for (const c of s.deck) alive.add(c.instId);
    for (const c of s.discard) alive.add(c.instId);
    for (const c of s.graveyard) alive.add(c.instId);
    for (const c of s.junkyard) alive.add(c.instId);
    for (const c of s.exile) alive.add(c.instId);
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      for (const pos of ["fl","fr","bl","br"]) {
        if (lc.creatures[pos]) alive.add(lc.creatures[pos].instId);
        if (lc.pending.creatures[pos]) alive.add(lc.pending.creatures[pos].instId);
      }
      if (lc.structure) alive.add(lc.structure.instId);
      if (lc.action) alive.add(lc.action.instId);
      if (lc.pending.structure) alive.add(lc.pending.structure.instId);
      if (lc.pending.action) alive.add(lc.pending.action.instId);
      for (const pos of ["fl","fr","bl","br"]) {
        const arr = lc.pending.equipment[pos];
        if (arr) for (const eq of arr) alive.add(eq.instId);
      }
      // Per-location piles (cards that died here when no summoner was present).
      if (lc.piles) {
        for (const zone of ["graveyard", "junkyard", "exile"]) {
          for (const c of lc.piles[zone]) alive.add(c.instId);
        }
      }
      // Attached equipment.
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (c && c.equipment) for (const eq of c.equipment) alive.add(eq.instId);
      }
    }
  }
  for (const [id, el] of _cardRegistry) {
    if (!alive.has(id)) {
      if (el.parentNode) el.parentNode.removeChild(el);
      _cardRegistry.delete(id);
    }
  }
}

// Append the marks-row to a card element. Newly-appeared marks (compared to the last render of
// this card-instance) get a transient `mark-new` class so they fade + scale in.
export function appendMarksRow(parentEl, card) {
  const prev = _lastMarkCount.get(card.instId) || 0;
  const cur = card.marks ? card.marks.length : 0;
  const newCount = Math.max(0, cur - prev);
  _lastMarkCount.set(card.instId, cur);
  const marksRow = document.createElement("div");
  marksRow.className = "marks-row";
  for (let i = 0; i < cur; i++) {
    const m = card.marks[i];
    const tag = document.createElement("span");
    tag.className = `badge mark mark-${m.kind}`;
    // The trailing `newCount` marks are the just-added ones — animate them.
    if (i >= cur - newCount) {
      tag.classList.add("mark-new");
      setTimeout(((t) => () => t.classList.remove("mark-new"))(tag), 600);
    }
    tag.textContent = `${m.kind} (${m.side})`;
    marksRow.appendChild(tag);
  }
  parentEl.appendChild(marksRow);
}

export function makeCardEl(card, inSlot = false) {
  // Use the persistent registry: the outer element is stable across renders (keyed by instId),
  // which lets a future FLIP animation track its movement between zones. Inner content + listeners
  // are rebuilt each render.
  const el = getCardOuterEl(card);
  // Detect face-down → face-up transition (for the rotateY flip animation). We treat the AI's
  // face-down cards as "back-rendered" (showing `?`) and the player's own face-down cards as
  // "face-up to owner". A face-down→face-up transition for the player happens implicitly when
  // their face-down card becomes face-up state — there's no visual change, no animation needed.
  // For AI cards: false → true means the card just flipped at the present, so animate.
  const prevRevealed = _lastRevealed.has(card.instId) ? _lastRevealed.get(card.instId) : card.revealed;
  const justFlippedUp = prevRevealed === false && card.revealed !== false && card.owner !== "player";
  _lastRevealed.set(card.instId, card.revealed);
  // Preserve in-flight anim-* classes (getCardOuterEl stripped className above; re-add them
  // before we set the base `card ${type}` so the keyframe in progress survives.
  const preservedAnims = [];
  for (const cls of el.classList) {
    if (cls.startsWith("anim-")) preservedAnims.push(cls);
  }
  el.className = `card ${card.type}`;
  for (const cls of preservedAnims) el.classList.add(cls);
  if (card.owner === "ai") el.classList.add("ai-owned");
  if (inSlot) el.classList.add("in-slot");
  if (state.selectedCardId === card.instId) el.classList.add("selected");
  if (justFlippedUp) {
    el.classList.add("flipping-up");
    // Remove the class after the animation completes so it can fire again next time.
    setTimeout(() => el.classList.remove("flipping-up"), 500);
  }

  // Face-down rendering: show card back instead of identity for OPPOSING cards (AI). The player's
  // own face-down cards still display face-up to the owner — fog-of-war hides AI plays from the
  // player's view, not the player's own plays from themselves. (The underlying game state is the
  // same — `revealed: false` — until the unified end-of-phase flip-up rule fires; this is just the
  // owner-side render exception.)
  if (card.revealed === false && card.owner !== "player") {
    el.classList.add("face-down");
    const back = document.createElement("div");
    back.className = "card-back";
    back.textContent = "?";
    el.appendChild(back);
    // Marks leak through fog of war — visible even on face-down opposing cards.
    if (card.marks && card.marks.length > 0) {
      appendMarksRow(el, card);
    }
    return el;
  }
  // Player's own face-down cards: render normally but with a subtle "pending reveal" outline so
  // the player knows the card hasn't flipped up yet (and any flip-up triggers haven't fired).
  if (card.revealed === false && card.owner === "player") {
    el.classList.add("pre-flip");
  }

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = card.name;
  el.appendChild(nameEl);

  // Marks: visible in all zones, all sides, even through fog. Per-instance permanent.
  if (card.marks && card.marks.length > 0) {
    appendMarksRow(el, card);
  }

  // Top row: cost ("Requires:") badges, one color-coded badge per stat in the cost.
  // Use effectiveCosts so Forage's escalating cost shows the current cost, not the base.
  const costs = effectiveCosts(card);
  const costStats = Object.keys(costs);
  if (costStats.length > 0) {
    const reqRow = document.createElement("div");
    reqRow.className = "requires-row";
    const lbl = document.createElement("span");
    lbl.className = "requires-label";
    lbl.textContent = "Requires:";
    reqRow.appendChild(lbl);
    const letterMap = { force: "F", tempo: "T", insight: "I", resolve: "R", spite: "S" };
    for (const stat of costStats) {
      const letter = letterMap[stat] || stat.charAt(0).toUpperCase();
      const b = document.createElement("span");
      b.className = `badge ${stat}`;
      b.textContent = `${costs[stat]} ${letter}`;
      reqRow.appendChild(b);
    }
    el.appendChild(reqRow);
  }

  // Attached equipment list (for hosts that have any equipped).
  if (card.equipment && card.equipment.length > 0) {
    const eqRow = document.createElement("div");
    eqRow.className = "equipment-row";
    const lbl = document.createElement("span");
    lbl.className = "equipment-label";
    lbl.textContent = "Equipped:";
    eqRow.appendChild(lbl);
    for (const eq of card.equipment) {
      const tag = document.createElement("span");
      tag.className = "badge equipment-tag";
      tag.textContent = eq.name;
      eqRow.appendChild(tag);
    }
    el.appendChild(eqRow);
  }

  if (card.text) {
    const t = document.createElement("div");
    t.className = "text";
    t.textContent = card.text;
    el.appendChild(t);
  }

  // Combat preview lines (creatures in slots, during main phase).
  if (inSlot && card.type === "creature" && _combatPreview) {
    const atk = _combatPreview.attackers[card.instId];
    if (atk) {
      const previewEl = document.createElement("div");
      previewEl.className = "preview";
      let label = `→ ${atk.targetLabel} for ${atk.damage}`;
      if (atk.killsTarget) label += " (kills)";
      previewEl.textContent = label;
      el.appendChild(previewEl);
    } else if (card.owner === "player") {
      // Player-owned creature with no attacker entry — explain why.
      const why = (card.force <= 0) ? "no Force — won't attack" : "back row — won't attack";
      const previewEl = document.createElement("div");
      previewEl.className = "preview muted";
      previewEl.textContent = why;
      el.appendChild(previewEl);
    }
    if (_combatPreview.willDie.has(card.instId)) {
      const dieEl = document.createElement("div");
      dieEl.className = "preview die";
      dieEl.textContent = "will die in combat";
      el.appendChild(dieEl);
    }
  }

  // Bottom row: live stat badges. Creatures show Force/Tempo/Insight/Durability; structures show
  // nothing (their stats are conveyed via rules text); equipment/actions show nothing here.
  // Stats are computed via effectiveStat using the card's in-play location, so conditional buffs,
  // equipment grants, sleep zeroing, etc. are reflected. Cards in hand or pending use base stats.
  const statBadges = [];
  if (card.type === "creature") {
    const inPlay = findCardInPlay(card);
    const ctx = inPlay || { side: null, loc: null };
    const fVal = inPlay ? effectiveStat(card, ctx.side, ctx.loc, "force") : (card.force || 0);
    const tVal = inPlay ? effectiveStat(card, ctx.side, ctx.loc, "tempo") : (card.tempo || 0);
    const iVal = inPlay ? effectiveStat(card, ctx.side, ctx.loc, "insight") : (card.insight || 0);
    if (fVal > 0) statBadges.push({ stat: "force", label: `${fVal} Force` });
    if (tVal > 0) statBadges.push({ stat: "tempo", label: `${tVal} Tempo` });
    if (iVal > 0) statBadges.push({ stat: "insight", label: `${iVal} Insight` });
    if (card.durabilityMax != null) statBadges.push({ stat: "durability", label: `${card.durability}/${card.durabilityMax} Durability` });
  }
  if (card.sleepCounter > 0) statBadges.push({ stat: "sleep", label: `${card.sleepCounter} Sleep` });
  if (card.wokeInPhase && card.wokeInPhase === state.phase) statBadges.push({ stat: "groggy", label: `Groggy (this ${state.phase})` });
  if (statBadges.length > 0) {
    const statsRow = document.createElement("div");
    statsRow.className = "stats-row";
    for (const sb of statBadges) {
      const b = document.createElement("span");
      b.className = `badge ${sb.stat}`;
      b.textContent = sb.label;
      statsRow.appendChild(b);
    }
    el.appendChild(statsRow);
  }

  return el;
}

export function renderHand() {
  const hand = $("hand");
  hand.innerHTML = "";
  // Any interactive phase is a potential commit window for some card type.
  const inAnyCommitWindow = ["upkeep","draw","main","combat-reveal","cleanup"].includes(state.phase);
  // White Resolve: leftmost N cards survive cleanup. Player can drag to reorder; the leftmost
  // N get a visual marker so they know which will be kept.
  const resolveKeep = state.sides ? globalStatTotal("player", "resolve") : 0;
  const handArr = state.sides.player.hand;
  for (let i = 0; i < handArr.length; i++) {
    const card = handArr[i];
    const el = makeCardEl(card, false);
    const cardWindow = isCommitWindowFor(card.type);
    const playable = cardWindow && cardHasAnyLegalPlay("player", card);
    if (inAnyCommitWindow && !playable) el.classList.add("unplayable");
    if (i < resolveKeep) el.classList.add("will-keep");
    // Drag-to-reorder
    el.draggable = true;
    el.dataset.handIdx = String(i);
    // Use property-assignment style so each render REPLACES the handler instead of stacking
    // (addEventListener stacks; render runs many times per turn so listeners would multiply).
    el.ondragstart = (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", String(i));
      el.classList.add("dragging");
    };
    el.ondragend = () => {
      el.classList.remove("dragging");
    };
    el.ondragover = (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      el.classList.add("drag-over");
    };
    el.ondragleave = () => {
      el.classList.remove("drag-over");
    };
    el.ondrop = (ev) => {
      ev.preventDefault();
      el.classList.remove("drag-over");
      const fromIdx = parseInt(ev.dataTransfer.getData("text/plain"), 10);
      const toIdx = parseInt(el.dataset.handIdx, 10);
      if (Number.isInteger(fromIdx) && Number.isInteger(toIdx) && fromIdx !== toIdx) {
        const moved = handArr.splice(fromIdx, 1)[0];
        handArr.splice(toIdx, 0, moved);
        state.selectedCardId = null;
        render();
      }
    };
    el.onclick = () => {
      if (!inAnyCommitWindow) return;
      if (!cardWindow) {
        flashLog(`${card.name}: not playable in this phase.`);
        return;
      }
      if (!playable) {
        // Provide a useful message: do we have *any* location with all costs paid?
        const costs = card.costs || {};
        const costStats = Object.keys(costs);
        const costStr = costStats.length === 0 ? "no cost" :
          costStats.map(s => `${costs[s]} ${s.charAt(0).toUpperCase() + s.slice(1)}`).join(" + ");
        let canPayAnywhere = false;
        const reportByLoc = [];
        for (let loc = 0; loc < LOCATION_COUNT; loc++) {
          let payed = true;
          const parts = [];
          for (const s of costStats) {
            const have = committedStatTotal("player", loc, s);
            parts.push(`${have} ${s.charAt(0).toUpperCase() + s.slice(1)}`);
            if (have < costs[s]) payed = false;
          }
          reportByLoc.push(`${LOC_NAMES[loc]}: ${parts.join("/") || "—"}`);
          if (payed) canPayAnywhere = true;
        }
        if (!canPayAnywhere) {
          flashLog(`${card.name}: need ${costStr} at the target location. Committed — ${reportByLoc.join(" · ")}.`);
        } else {
          flashLog(`${card.name}: no legal target slot at any location where the cost is paid.`);
        }
        return;
      }
      state.selectedCardId = (state.selectedCardId === card.instId) ? null : card.instId;
      state.selectedCommittedId = null;
      render();
    };
    hand.appendChild(el);
  }
}

// Phase 2a — narrative history. Reframes the existing combat log as a richer scrollable view.
// Phase boundary lines render as bold dividers; combat / damage / death lines render with icons;
// other lines render as plain entries. Still driven by state.log (the migration to state.outcomes
// is Phase 2c work — we want to verify the timeline UI first while keeping log content stable).
export function renderLog() {
  const log = $("log");
  log.innerHTML = "";
  for (const e of state.log.slice(-120)) {
    const div = document.createElement("div");
    div.className = "entry " + (e.kind || "");
    const msg = e.msg || "";
    // Phase boundaries (lines like "— Upkeep, turn 3 —"): treat as section dividers.
    if (e.kind === "phase" && /— .+ —/.test(msg)) {
      div.classList.add("phase-divider");
      div.textContent = msg;
    } else {
      // Auto-prepend an icon for common event shapes.
      let icon = "";
      if (e.kind === "combat-header") icon = "⚔";
      else if (e.kind === "win") icon = "✦";
      else if (e.kind === "lose") icon = "✗";
      else if (e.kind === "draw") icon = "↻";
      else if (e.kind === "cleanup") icon = "•";
      else if (/destroyed|falls|killed/.test(msg)) icon = "✕";
      else if (/→.*summoner/.test(msg)) icon = "⚡";
      else if (/→/.test(msg)) icon = "→";
      else if (/flips up|revealed/i.test(msg)) icon = "↑";
      if (icon) {
        const iconSpan = document.createElement("span");
        iconSpan.className = "entry-icon";
        iconSpan.textContent = icon;
        div.appendChild(iconSpan);
        const txt = document.createElement("span");
        txt.textContent = " " + msg;
        div.appendChild(txt);
      } else {
        div.textContent = msg;
      }
    }
    log.appendChild(div);
  }
  log.scrollTop = log.scrollHeight;
  renderEventDebug();
}

// Phase 1 verification: show the timeline + outcomes streams as a raw debug strip below the
// main log. This will be removed once Phase 2 (the visual Future/Past/narrative UI) lands.
export function renderEventDebug() {
  const host = $("event-debug");
  if (!host) return;
  if (state.view !== "encounter" || !state.sides) {
    host.style.display = "none";
    return;
  }
  host.style.display = "block";
  const tl = $("event-debug-timeline");
  if (tl) {
    tl.innerHTML = "";
    const tlEvents = (state.timeline || []).slice(-40);
    for (const c of tlEvents) {
      const div = document.createElement("div");
      const stateMarker = c.state === "future" ? "[FUTURE]" : "[PAST]";
      const faceMarker = c.faceUp ? "" : " face-down";
      const markStr = c.marks && c.marks.length > 0 ? ` marks:${c.marks.map(m => m.kind).join(",")}` : "";
      div.textContent = `${stateMarker} ${c.side} T${c.tempo} ${c.name} @${LOC_NAMES[c.loc] || "?"}/${c.pos}${faceMarker}${markStr}`;
      div.style.color = c.state === "future" ? "#9c8" : "#888";
      tl.appendChild(div);
    }
    tl.scrollTop = tl.scrollHeight;
  }
  const oc = $("event-debug-outcomes");
  if (oc) {
    oc.innerHTML = "";
    const oEvents = (state.outcomes || []).slice(-40);
    for (const e of oEvents) {
      const div = document.createElement("div");
      div.textContent = `[${e.kind}] ${JSON.stringify(e).slice(0, 100)}`;
      div.style.color = "#888";
      oc.appendChild(div);
    }
    oc.scrollTop = oc.scrollHeight;
  }
}

export function renderControls() {
  const btn = $("btn-advance");
  const leaveBtn = $("btn-leave-encounter");
  // Menu or overworld view: hide both phase buttons.
  if (state.view === "menu" || state.view === "overworld") {
    btn.style.display = "none";
    if (leaveBtn) leaveBtn.style.display = "none";
    return;
  }
  // Encounter view.
  btn.style.display = "";
  if (leaveBtn) {
    // Show leave button only for neutral encounters where engaging is optional.
    leaveBtn.style.display = state.encounterKind === "neutral" ? "" : "none";
    leaveBtn.disabled = !!state.gameOver;
  }
  if (state.gameOver) {
    btn.disabled = true;
    btn.textContent = "Game Over";
    return;
  }
  switch (state.phase) {
    case "upkeep":
      btn.disabled = false;
      btn.textContent = "End Upkeep → Draw";
      break;
    case "draw":
      btn.disabled = false;
      btn.textContent = "End Draw → Main";
      break;
    case "main":
      btn.disabled = false;
      btn.textContent = "End Main → Combat";
      break;
    case "combat-reveal":
      btn.disabled = false;
      btn.textContent = "Resolve Combat";
      break;
    case "cleanup":
      btn.disabled = false;
      btn.textContent = "End Cleanup → Next Turn";
      break;
    case "reveal":
    case "combat-resolve":
      btn.disabled = true;
      btn.textContent = "…";
      break;
    default:
      btn.disabled = true;
      btn.textContent = "—";
  }
}

export function findHandCard(instId) {
  return state.sides.player.hand.find(c => c.instId === instId) || null;
}

export function placeSelectedAt(target) {
  const card = findHandCard(state.selectedCardId);
  if (!card) return;
  if (!canPay("player", target.loc, card)) return;
  placeCard("player", card, target);
  state.selectedCardId = null;
  render();
}

export function flashLog(msg) {
  logEntry(msg, "cleanup");
  renderLog();
}

// ---------- Game over ----------
export function showGameOver() {
  // v3: distinguish run-end (won/lost the whole run) from encounter-end (returns to overworld).
  // Encounter-end uses endEncounter() which doesn't show this modal — only the run-over shows it.
  if (state.runOver === "playerWin") {
    $("game-over-title").textContent = "You win the run";
  } else if (state.runOver === "playerLose") {
    $("game-over-title").textContent = "You fell";
  } else {
    return; // not a run-over event
  }
  $("game-over-text").textContent = `Run ended at ${getNode(state.world.pawnAt)?.label || "?"}. Run Durability: ${state.runDurability}.`;
  $("game-over").classList.add("show");
}

export function hideGameOver() {
  $("game-over").classList.remove("show");
}
