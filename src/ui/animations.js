// UI animations and event handler.
//
// Per REBUILD_PLAN.md sections 18, 20–21:
// - Time-based pacing: animations are decoration; the engine doesn't wait for them.
// - Single handler registered with engine/events.js. The handler dispatches by event.kind
//   to per-kind animation logic. Always returns synchronously.
// - The per-event-kind duration table that the ENGINE uses (for runBeat) is exported here
//   as DURATIONS_MS — engine modules import it to know how long to sleep between beats.
//
// CSS discipline: card-event animations use ONLY non-transform CSS properties (outline,
// box-shadow, filter, opacity, background) so they compose with FLIP's transform-based
// position interpolation. Reserve `transform` for FLIP exclusively.

import { _cardRegistry, _chipRegistry } from "./registries.js";
import { subscribe } from "../engine/events.js";

// ---------- Per-event duration table ----------
//
// This is the SINGLE source of truth for "how long does this beat take." Both the engine
// (when chaining beats via scheduler.runBeat) and the UI (when fitting an animation into
// the beat duration) read from here.
//
// Tuning these numbers tunes the game's pace. The global speed multiplier in scheduler.js
// scales these values down (faster) or up (slower).

export const DURATIONS_MS = {
  // Player-facing event animations
  attack: 360,
  damage: 280,
  death: 420,
  "deathwish-trigger": 320,
  summon: 320,
  "leave-play": 380,   // long enough for the FLIP slide from slot to pile to complete
  "mark-applied": 320,
  "mark-tear": 380,
  trigger: 320,
  move: 320,
  "summoner-damage": 240,
  "summoner-damage-fizzle": 120,
  "token-to-discard": 240,
  flip: 320,
  "action-resolve": 240,
  commit: 0,           // commit is the moment of player action; no UI pause

  // Engine-internal pacing beats (no specific event kind)
  "phase-divider": 500,
  "no-attack": 240,    // attacker can't swing (asleep, no force, etc.)
  "default": 200       // fallback for unhandled event kinds
};

export function durationFor(kind) {
  return DURATIONS_MS[kind] != null ? DURATIONS_MS[kind] : DURATIONS_MS.default;
}

// ---------- Primitive animation helpers ----------

const ANIM_CSS_DURATION = {
  shake: 320,
  pulse: 380,
  damage: 280,
  death: 420
};

function playClass(el, cls, duration) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;   // force reflow so re-adding the class restarts the keyframe
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), duration);
}

export function animateCardEvent(instId, kind) {
  const el = _cardRegistry.get(instId);
  if (!el) return;
  switch (kind) {
    case "shake":  return playClass(el, "anim-shake", ANIM_CSS_DURATION.shake);
    case "pulse":  return playClass(el, "anim-pulse", ANIM_CSS_DURATION.pulse);
    case "damage": return playClass(el, "anim-damage", ANIM_CSS_DURATION.damage);
    case "death":  return playClass(el, "anim-death", ANIM_CSS_DURATION.death);
  }
}

// Crash: attacker lurches toward defender, snaps back. Uses transform on the attacker
// only (attacker stays in its slot — no FLIP conflict since the attacker isn't moving zones).
export function animateCrash(attackerInstId, defenderInstId) {
  const attEl = _cardRegistry.get(attackerInstId);
  if (!attEl) return;
  const defEl = defenderInstId != null ? _cardRegistry.get(defenderInstId) : null;
  if (!defEl) {
    playClass(attEl, "anim-shake", ANIM_CSS_DURATION.shake);
    return;
  }
  const attRect = attEl.getBoundingClientRect();
  const defRect = defEl.getBoundingClientRect();
  const dx = (defRect.left + defRect.width / 2) - (attRect.left + attRect.width / 2);
  const dy = (defRect.top + defRect.height / 2) - (attRect.top + attRect.height / 2);
  const scale = 0.4;
  const tx = dx * scale;
  const ty = dy * scale;
  attEl.style.transition = "none";
  attEl.style.zIndex = "20";
  void attEl.offsetWidth;
  attEl.style.transition = `transform 140ms cubic-bezier(0.4, 0, 0.6, 1)`;
  attEl.style.transform = `translate(${tx}px, ${ty}px)`;
  setTimeout(() => {
    attEl.style.transition = `transform 180ms cubic-bezier(0.2, 0.8, 0.3, 1)`;
    attEl.style.transform = "";
    setTimeout(() => {
      attEl.style.transition = "";
      attEl.style.zIndex = "";
    }, 200);
  }, 140);
  if (defenderInstId != null) {
    setTimeout(() => animateCardEvent(defenderInstId, "damage"), 130);
  }
}

// ---------- Chip strip FLIP (between renders, not part of event handler) ----------

export function captureChipRects() {
  const rects = new Map();
  for (const [id, el] of _chipRegistry) {
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    rects.set(id, r);
  }
  return rects;
}

const CHIP_FLIP_DURATION_MS = 320;

export function applyChipFlipAnimations(preRects) {
  for (const [id, el] of _chipRegistry) {
    if (!el.isConnected) continue;
    const oldRect = preRects.get(id);
    if (!oldRect) continue;
    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.zIndex = "5";
    void el.offsetWidth;
    el.style.transition = `transform ${CHIP_FLIP_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    el.style.transform = "";
    const onDone = () => {
      el.style.zIndex = "";
      el.style.transition = "";
      el.removeEventListener("transitionend", onDone);
    };
    el.addEventListener("transitionend", onDone);
  }
}

// ---------- Event dispatcher (THE handler) ----------
//
// One handler. Registered with engine/events.js at module load. Synchronous. Dispatches by
// event.kind. Each branch fires whatever CSS animations / DOM updates are appropriate.
// Never blocks, never awaits, never schedules engine state changes.

function handleEvent(ev) {
  switch (ev.kind) {
    case "attack":
      if (ev.ranged) animateCardEvent(ev.instId, "shake");
      else animateCrash(ev.instId, ev.targetInstId);
      break;
    case "damage":
      if (ev.targetInstId != null) animateCardEvent(ev.targetInstId, "damage");
      break;
    case "death":
      animateCardEvent(ev.instId, "death");
      break;
    case "deathwish-trigger":
      animateCardEvent(ev.instId, "pulse");
      break;
    case "summon":
      // The new token's DOM element is registered on the next render. Defer one tick.
      setTimeout(() => animateCardEvent(ev.instId, "pulse"), 0);
      break;
    case "leave-play":
      // FLIP slide handles the slot-to-pile move via the next render's preRects diff.
      // No additional animation needed here.
      break;
    case "mark-applied":
    case "mark-tear":
      animateCardEvent(ev.instId, "pulse");
      break;
    case "trigger":
      animateCardEvent(ev.instId, "shake");
      break;
    case "move":
    case "flip":
    case "action-resolve":
    case "commit":
    case "summoner-damage":
    case "summoner-damage-fizzle":
    case "token-to-discard":
      // No card-specific animation here; the renders + FLIP handle visual updates.
      break;
    default:
      // Unknown kinds: no-op. Engine still paces per DURATIONS_MS.default.
      break;
  }
}

subscribe(handleEvent);

// Re-export setSpeed from scheduler so the UI's speed-control dropdown can drive it
// without importing the scheduler directly.
export { setSpeed, getSpeed } from "../engine/scheduler.js";
