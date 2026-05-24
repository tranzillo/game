// Scene queue — coordinates timed visual playback of engine outcomes.
//
// The engine emits outcomes synchronously (damage → death → summon → leave-play → ...) but the
// player needs to see them play out in time. The Scene queue takes outcomes after each engine
// beat, decomposes them into ordered steps, plays each step with its own animation + duration,
// then signals the engine to advance to the next beat.
//
// Design goals:
//   - Each step holds its own captured DOM rects at the moment it was enqueued, so animations
//     reference the visual world at the time the outcome happened (not the world as it exists
//     when the step actually plays — by then the engine has moved on).
//   - Steps are queued in outcome order. New outcomes appended during a step's animation are
//     appended to the queue; they play after the current step finishes.
//   - Engine yields control via `await drainScene()`. Encoded as a callback for now since the
//     engine's beat loops use callback-style.
//
// Each step is: { id, animate(done), duration } where animate may call done() early or rely on
// the duration timeout. Steps are NOT a typed enum — they're closures emitted by the outcome
// dispatcher. Callers can also enqueue arbitrary steps.

import { _cardRegistry } from "./registries.js";
import { animateCardEvent, animateCrash } from "./animations.js";
import { releaseDyingSlide } from "./render.js";

// Cards whose death scene step has been queued (or played) but whose leave-play step has NOT
// yet played. Used by FLIP to keep the dying card visually held at its slot until the leave-play
// step actually fires.
const _dyingInstIds = new Set();
export function isDyingForFlip(instId) { return _dyingInstIds.has(instId); }

// Global pacing multiplier. 1 = default. Slower (e.g. 1.5) makes animations more deliberate;
// faster (0.6) makes them quicker. Per-step durations are scaled by this.
let _speed = 1;
export function getSpeed() { return _speed; }
export function setSpeed(mult) { _speed = mult; }

// Internal queue state. The scene processes one step at a time; while a step is playing, the
// engine is blocked from advancing. Subsequent outcomes from the engine append more steps.
const _steps = [];
let _playingStep = null;
let _drainCallbacks = [];

// Enqueue a step. `animate` is a function that takes a `done` callback; call done() when the
// animation completes (or the engine should advance). `duration` is the *expected* duration
// in ms — scaled by global speed. If `animate` does not call done(), the queue advances after
// `duration * speed` ms.
export function enqueue(step) {
  _steps.push(step);
  _maybeStartNext();
}

// Drain: register a callback to fire when the queue is empty AND no step is playing.
// If the queue is already empty, fires synchronously on the next microtask.
export function drainScene(onDone) {
  if (_steps.length === 0 && !_playingStep) {
    queueMicrotask(onDone);
    return;
  }
  _drainCallbacks.push(onDone);
}

function _maybeStartNext() {
  if (_playingStep) return;
  if (_steps.length === 0) {
    // Drained — fire any pending callbacks.
    const cbs = _drainCallbacks.slice();
    _drainCallbacks = [];
    for (const cb of cbs) cb();
    return;
  }
  const step = _steps.shift();
  _playingStep = step;
  const scaledDuration = Math.round((step.duration || 0) * _speed);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    _playingStep = null;
    _maybeStartNext();
  };
  // Wire a fallback timer so a step that forgets to call done() doesn't stall the queue.
  let timer = null;
  if (scaledDuration > 0) {
    timer = setTimeout(finish, scaledDuration);
  }
  try {
    step.animate(() => {
      if (timer) clearTimeout(timer);
      finish();
    });
  } catch (e) {
    console.error("Scene step error:", e, step);
    if (timer) clearTimeout(timer);
    finish();
  }
}

// Step factories — each takes the outcome + preRects snapshot and returns a Step object.
//
// Important: preRects is the BEFORE state snapshot captured when the outcome was emitted. By
// the time the step actually plays, the engine state may have moved on (e.g., the dying card
// is already in the graveyard). The step must use preRects, not live geometry.

// Default duration table per outcome kind. Tuned for readability.
export const DURATIONS = {
  attack: 360,
  damage: 360,
  death: 600,            // in-place fade + hold so deathwish can play before slide
  "deathwish-trigger": 320,
  summon: 420,
  "leave-play": 480,     // slide from slot to graveyard (FLIP fires inside this duration)
  "mark-applied": 380,
  "mark-tear": 480,
  "summoner-damage": 280,
  trigger: 360,
  move: 360,
  "token-to-discard": 360,
  "summoner-damage-fizzle": 0
};

export function stepFromOutcome(o, preRects) {
  const d = DURATIONS[o.kind] ?? 0;
  switch (o.kind) {
    case "attack":
      return {
        id: `attack-${o.instId}`,
        duration: d,
        animate(done) {
          if (o.ranged) {
            animateCardEvent(o.instId, "shake");
          } else {
            animateCrash(o.instId, o.targetInstId, preRects);
          }
          // The animation runs ~320ms; let the duration timer finish the step.
        }
      };
    case "damage":
      return {
        id: `damage-${o.targetInstId || "?"}`,
        duration: d,
        animate(done) {
          if (o.targetInstId != null) animateCardEvent(o.targetInstId, "damage");
        }
      };
    case "death":
      return {
        id: `death-${o.instId}`,
        duration: d,
        animate(done) {
          // Plays a fade animation on the dying card in its slot position (FLIP will hold it
          // there until the leave-play step releases).
          animateCardEvent(o.instId, "death");
        }
      };
    case "deathwish-trigger":
      return {
        id: `deathwish-${o.instId}`,
        duration: d,
        animate(done) {
          // Pulse the dying card to signal its deathwish is firing.
          animateCardEvent(o.instId, "pulse");
        }
      };
    case "summon":
      return {
        id: `summon-${o.instId}`,
        duration: d,
        animate(done) {
          // The token's element is registered on the next render; pulse it briefly. Defer one
          // microtask to give the DOM time to mount the new element.
          queueMicrotask(() => animateCardEvent(o.instId, "pulse"));
        }
      };
    case "leave-play":
      return {
        id: `leaveplay-${o.instId}`,
        duration: d,
        animate(done) {
          // Trigger the deferred FLIP slide for the dying card. The card's element has been
          // held at its slot position via FLIP's inverse transform since render time; now we
          // clear the transform with a transition so it slides into the graveyard pile.
          _dyingInstIds.delete(o.instId);
          releaseDyingSlide(o.instId);
        }
      };
    case "mark-applied":
    case "mark-tear":
      return {
        id: `mark-${o.instId}`,
        duration: d,
        animate(done) {
          animateCardEvent(o.instId, "pulse");
        }
      };
    case "trigger":
      return {
        id: `trigger-${o.instId}`,
        duration: d,
        animate(done) {
          // Trigger shake — the dispatcher used to delay this 450ms after the flip-up so the
          // flip animation finishes first. Now the scene queue handles ordering, so we can
          // shake immediately — flip-up has its own scene step ahead of this one.
          animateCardEvent(o.instId, "shake");
        }
      };
    case "move":
      return {
        id: `move-${o.instId}`,
        duration: d,
        animate(done) {
          // FLIP handles the actual slide between slots when the next render runs; the step
          // just paces the engine.
        }
      };
    case "token-to-discard":
      return {
        id: `tokentodiscard-${o.instId}`,
        duration: d,
        animate(done) {
          // The token slides into the discard pile via FLIP-from-new-render.
        }
      };
    case "summoner-damage":
    case "summoner-damage-fizzle":
      return {
        id: `summonerdmg-${o.side}`,
        duration: d,
        animate(done) {
          // No card-level animation; durability number flashes in render. (Could add a screen
          // shake or red flash on the summoner bar later.)
        }
      };
    default:
      return null;
  }
}

// Bulk-enqueue all outcomes emitted since the last render. Captures preRects once for the
// whole batch — every step references the same snapshot.
//
// Also updates the _dyingInstIds set so FLIP knows which cards to hold at slot position. Death
// outcomes mark the card as dying; leave-play outcomes will clear that mark when their step
// actually plays (not when it's enqueued).
export function enqueueOutcomes(outcomes, preRects) {
  for (const o of outcomes) {
    if (o.kind === "death") _dyingInstIds.add(o.instId);
    const step = stepFromOutcome(o, preRects);
    if (step) enqueue(step);
  }
}

// Enqueue a "hold" step that does nothing but advance the queue after `duration` ms. Used by
// the engine beat loops to enforce a minimum visible duration per beat (so the player gets to
// see e.g. a chip transit through the present even when no outcomes fire animations).
export function enqueueHold(duration) {
  enqueue({
    id: "hold",
    duration,
    animate(_done) { /* no-op */ }
  });
}

// For test/diagnostic use.
export function isPlaying() { return !!_playingStep || _steps.length > 0; }
export function queueLength() { return _steps.length; }
export function clearQueue() {
  _steps.length = 0;
  _drainCallbacks = [];
  _playingStep = null;
}
