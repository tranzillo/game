// Animation primitives for card-level events. Each function is a thin wrapper that adds a CSS
// class to the card's DOM element for a fixed duration, then removes it. The class drives the
// actual animation via @keyframes in styles.css.
//
// Looking up the card's DOM is done via _cardRegistry (the persistent card-DOM map keyed by
// instId). If the card isn't currently rendered (no DOM element), the call silently no-ops —
// this is fine: an animation is feedback, not state.

import { _cardRegistry, _chipRegistry } from "./registries.js";

// How long each animation kind runs. Keep in sync with the CSS @keyframes durations in styles.css.
export const ANIM_DURATION = {
  shake: 320,
  crash: 320,
  pulse: 380,
  damage: 320,
  death: 400
};

// Generic helper: add a class, remove it after `duration` ms. Multiple animations on the same
// element stack the classes; if the same kind is re-applied while running, we restart it cleanly.
function playClass(el, cls, duration) {
  if (!el) return;
  // Restart trick: remove + force reflow + re-add so re-applying the same class restarts the keyframe.
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), duration);
}

export function animateCardEvent(instId, kind) {
  const el = _cardRegistry.get(instId);
  if (!el) return;
  switch (kind) {
    case "shake":  return playClass(el, "anim-shake", ANIM_DURATION.shake);
    case "pulse":  return playClass(el, "anim-pulse", ANIM_DURATION.pulse);
    case "damage": return playClass(el, "anim-damage", ANIM_DURATION.damage);
    case "death":  return playClass(el, "anim-death", ANIM_DURATION.death);
  }
}

// Crash animation: attacker lurches toward defender, snaps back. The translate vector is
// computed from screen rects. By the time this runs, the defender may have ALREADY moved to the
// graveyard pile (the engine resolved the kill before the UI got to animate). So we accept a
// preRects map (the rects captured at the start of this render pass) and prefer the defender's
// pre-render position over its current one — that's where the defender was visually when the
// attack actually happened.
export function animateCrash(attackerInstId, defenderInstId, preRects = null) {
  const attEl = _cardRegistry.get(attackerInstId);
  if (!attEl) return;
  const defEl = defenderInstId != null ? _cardRegistry.get(defenderInstId) : null;

  if (!defEl) {
    // Fallback: just shake forward.
    playClass(attEl, "anim-shake", ANIM_DURATION.shake);
    return;
  }

  // Prefer the attacker's and defender's pre-render rects (where they were when the attack
  // happened) so the crash vector points to the slot the defender was in, not the pile they
  // already moved to. Fall back to live rects if a preRect isn't available.
  const attRect = (preRects && preRects.get(attackerInstId)) || attEl.getBoundingClientRect();
  const defRect = (preRects && preRects.get(defenderInstId)) || defEl.getBoundingClientRect();
  // Vector from attacker center to defender center, scaled down so the attacker only travels
  // ~40% of the way (otherwise the visual overshoots into the defender's slot and looks weird).
  const dx = (defRect.left + defRect.width / 2) - (attRect.left + attRect.width / 2);
  const dy = (defRect.top + defRect.height / 2) - (attRect.top + attRect.height / 2);
  const scale = 0.4;
  const tx = dx * scale;
  const ty = dy * scale;

  attEl.style.transition = "none";
  attEl.style.zIndex = "20";
  void attEl.offsetWidth;
  // Two-stage: rush in, then snap back. Use a single keyframe by chaining transitions.
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

  // Defender takes a damage-flash in sync with the crash impact (when attacker is at peak).
  if (defenderInstId != null) {
    setTimeout(() => animateCardEvent(defenderInstId, "damage"), 130);
  }
}

// Outcome → animation dispatcher. Called by render() at the end of each render pass with a list
// of outcomes that were emitted *since the last render*. Plays one animation per outcome.
//
// This is intentionally low-tech: no queueing, no scheduling. The engine already sequences beats
// (combat is one-attacker-per-COMBAT_STEP_MS, reveals are one-flip-per-REVEAL_STEP_MS), so within
// a single render pass there's usually only 1-3 outcomes. They all fire concurrently, which is
// fine — they're brief and visually distinct.
//
// Returns a Set of card instIds that just died this beat — render uses this to delay FLIP for
// those cards so the death animation plays in the slot before the card slides to the graveyard.
//
// `preRects` is the rect snapshot captured BEFORE the engine mutated state and renderEncounter
// ran — passed in so crash animations point to where the defender VISUALLY WAS when the attack
// happened, not where it is now (which might be the graveyard pile after a kill).
export function playOutcomes(outcomes, preRects = null) {
  const dyingInstIds = new Set();
  if (!outcomes || outcomes.length === 0) return dyingInstIds;
  for (const o of outcomes) {
    switch (o.kind) {
      case "attack":
        // Melee = crash toward target; ranged = shake in place.
        if (o.ranged) {
          animateCardEvent(o.instId, "shake");
        } else {
          animateCrash(o.instId, o.targetInstId, preRects);
        }
        break;
      case "damage":
        // damage outcome alone (no preceding attack) — e.g. Pyroblast hitting multiple creatures.
        // We still want the targets to flash. Attack outcomes already animate damage via crash;
        // this catches the standalone case.
        if (!o._handledByAttack) {
          animateCardEvent(o.targetInstId, "damage");
        }
        break;
      case "death":
        animateCardEvent(o.instId, "death");
        dyingInstIds.add(o.instId);
        break;
      case "mark-applied":
      case "mark-tear":
        animateCardEvent(o.instId, "pulse");
        break;
      case "summoner-damage":
        // No card to animate; the durability number update is enough.
        break;
      case "summon":
        // The new token will appear via FLIP-from-nowhere; pulse it once it's in the DOM.
        // Defer one tick so the registry has the new element.
        setTimeout(() => animateCardEvent(o.instId, "pulse"), 0);
        break;
      case "trigger":
        // Generic "this card just did something" — used by flip-up effects with no other visible
        // outcome (e.g., gainBuff). Shake telegraphs the trigger fire. We defer slightly because
        // a flip-up trigger fires in the same render pass as the flip-in animation, and CSS
        // animations compete — the shake would clobber the flip. The delay lets the flip-in
        // settle before the shake starts.
        setTimeout(() => animateCardEvent(o.instId, "shake"), 450);
        break;
    }
  }
  return dyingInstIds;
}

// How long FLIP holds the card at its pre-render position when the card is dying this beat.
// Long enough for the death animation (anim-death is 400ms) to play in the slot before the card
// slides to the graveyard pile.
export const DEATH_FLIP_HOLD_MS = 380;

// Chip-strip animation: chips slide between future → present → past zones using the same FLIP
// pattern as cards. The chip registry is keyed by chipId. We expose capture/apply helpers that
// match the card-side ones.
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

const CHIP_FLIP_DURATION_MS = 380;

export function applyChipFlipAnimations(preRects) {
  for (const [id, el] of _chipRegistry) {
    if (!el.isConnected) continue;
    const oldRect = preRects.get(id);
    if (!oldRect) continue;  // newly created
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
