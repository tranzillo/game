// Trigger handler registry — Phase G's thin version. Phase I expands this with full event
// subscriptions (onPresent / onFutureEnter / onPast), deathwish, action effects, etc.
//
// Contract: ENGINE_SKETCH.md Phase G + Phase I, REBUILD_PLAN §28/§29/§32.
//
// For Phase G: just the flip-up self-trigger dispatcher (FLIP_UP_HANDLERS).
// Each card def can declare onFlipUp: string; the engine looks up the tagged handler and calls
// it when the card flips face-up during the flip queue drain. onFlipUp is the *self*-subscriber
// species — the card subscribes to "I entered the Present."
//
// Phase I adds the cross-card subscriber species: cards in play declare onPresent / onFutureEnter
// / onPast subscriptions with scope+filter, and the dispatcher iterates active subscribers on
// each event. See REBUILD_PLAN §32 "The Present as a trigger surface" for the model.
//
// Handlers may call queueResolutionBeat (from store/present-span.ts) to pace work inside the
// resolving card's present span. The chip stays in Present until the span's beat queue drains.

import { getCardDef } from "./cards.ts";
import { fireLocationTextBoundary, fireLocationTextFlipUp } from "./location-text.ts";
import { positionsOf } from "./profile.ts";
import type {
  CardInstance,
  GameState,
  PhaseBoundary,
  PresentSubscription,
  Side,
} from "./types.ts";
import type { LeavePlayReason } from "./routing.ts";

// ---------- Flip-up handler context ----------

export interface FlipUpContext {
  state: GameState;
  card: CardInstance;
  side: Side;
  loc: string;
}

export type FlipUpHandler = (ctx: FlipUpContext) => void;

const FLIP_UP_HANDLERS: Record<string, FlipUpHandler> = {};

export function registerFlipUpHandler(tag: string, handler: FlipUpHandler): void {
  if (FLIP_UP_HANDLERS[tag] != null) {
    throw new Error(`Duplicate flip-up handler registered: ${tag}`);
  }
  FLIP_UP_HANDLERS[tag] = handler;
}

export function getFlipUpHandler(tag: string): FlipUpHandler | null {
  return FLIP_UP_HANDLERS[tag] ?? null;
}

export function _resetFlipUpHandlers(): void {
  for (const k of Object.keys(FLIP_UP_HANDLERS)) delete FLIP_UP_HANDLERS[k];
}

/**
 * Fire flip-up triggers for a freshly-flipped card. Location text's onFlipUp runs FIRST — the
 * location sees the flipped card and can adjust state (e.g., Ogre Hideaway sleeping ogres)
 * before the card's own trigger fires. Then the card's onFlipUp tag dispatches.
 */
export function fireFlipUpTrigger(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): void {
  fireLocationTextFlipUp(state, card, side, loc);
  const def = getCardDef(card.defKey);
  if (!def.onFlipUp) return;
  const handler = getFlipUpHandler(def.onFlipUp);
  if (!handler) return;
  handler({ state, card, side, loc });
}

// ---------- Leave-play handler context (deathwish + structure destruction + equipment detach) ----------
//
// Per REBUILD §17 / §30, the two-beat death sequence is:
//   1. Damage hit lands. Durability → 0. pendingLeavePile set.
//   2. Next beat: deathwish (onLeavePlay) fires. Card slides to destination pile.
//
// `onLeavePlay` handlers fire BEFORE the card moves to its pile. They see the card still at its
// original side and location (per DECISIONS 2026-05-12 line 241 "leave-play triggers fire first
// from the card's original-side perspective; destination modifies after").
//
// Handlers may queueResolutionBeat to pace work inside the active span (swing or chip), so
// deathwish cascades (deathwish kills another creature → that creature's deathwish fires) flow
// through the same span as a single cascade.

export interface LeavePlayContext {
  state: GameState;
  card: CardInstance;
  side: Side;
  loc: string;
  reason: LeavePlayReason;
}

export type LeavePlayHandler = (ctx: LeavePlayContext) => void;

const LEAVE_PLAY_HANDLERS: Record<string, LeavePlayHandler> = {};

export function registerLeavePlayHandler(tag: string, handler: LeavePlayHandler): void {
  if (LEAVE_PLAY_HANDLERS[tag] != null) {
    throw new Error(`Duplicate leave-play handler registered: ${tag}`);
  }
  LEAVE_PLAY_HANDLERS[tag] = handler;
}

export function getLeavePlayHandler(tag: string): LeavePlayHandler | null {
  return LEAVE_PLAY_HANDLERS[tag] ?? null;
}

export function _resetLeavePlayHandlers(): void {
  for (const k of Object.keys(LEAVE_PLAY_HANDLERS)) delete LEAVE_PLAY_HANDLERS[k];
}

/**
 * Fire the card's onLeavePlay handler if it has one. No-op if the card doesn't declare
 * onLeavePlay or the tag isn't registered.
 *
 * Called from completeDeath / leavePlay sequence BEFORE the card moves to its destination pile.
 */
export function fireLeavePlayTrigger(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
  reason: LeavePlayReason,
): void {
  const def = getCardDef(card.defKey);
  if (!def.onLeavePlay) return;
  const handler = getLeavePlayHandler(def.onLeavePlay);
  if (!handler) return;
  handler({ state, card, side, loc, reason });
}

// ---------- Present-event subscriber handlers ----------
//
// Per REBUILD §32 / DECISIONS 2026-05-29: when a chip transits the Present, cards in play that
// declared onPresent subscriptions get a chance to react. The dispatcher walks face-up cards on
// the board, matches each card's subscriptions against the event, and fires the handler tag.
//
// Self-triggers (onFlipUp on the flipping card) are a separate dispatch — they fire from the
// flipping card's own def. onPresent is for OTHER cards in play reacting to a flip event.
// A subscription with filter.excludeSelf is the safety hatch for cards whose onPresent could
// fire on their own flip.

export interface PresentEvent {
  // The card that just entered Present (the flipping card).
  card: CardInstance;
  // The side it flipped on.
  side: Side;
  // The location it flipped at.
  loc: string;
  // The card's type for filter matching.
  cardType: "creature" | "structure" | "action" | "equipment";
}

export interface PresentSubscriberContext {
  state: GameState;
  // The subscribing card (the one whose def has the onPresent entry).
  subscriber: CardInstance;
  subscriberSide: Side;
  subscriberLoc: string;
  // The event that matched.
  event: PresentEvent;
}

export type PresentSubscriberHandler = (ctx: PresentSubscriberContext) => void;

const PRESENT_HANDLERS: Record<string, PresentSubscriberHandler> = {};

export function registerPresentHandler(tag: string, handler: PresentSubscriberHandler): void {
  if (PRESENT_HANDLERS[tag] != null) {
    throw new Error(`Duplicate present-subscriber handler registered: ${tag}`);
  }
  PRESENT_HANDLERS[tag] = handler;
}

export function getPresentHandler(tag: string): PresentSubscriberHandler | null {
  return PRESENT_HANDLERS[tag] ?? null;
}

export function _resetPresentHandlers(): void {
  for (const k of Object.keys(PRESENT_HANDLERS)) delete PRESENT_HANDLERS[k];
}

/**
 * Fire all matching onPresent subscriptions across the board for the given present event.
 * Iterates face-up creatures and structures on the board (face-down cards are inert per the
 * unified face-down rule and don't trigger subscriptions).
 *
 * Called from the chip-flip-up moment in the orchestrator, AFTER fireFlipUpTrigger so the
 * flipping card's self-triggers run first (per REBUILD §17 the self triggers are the canonical
 * cause; subscriber reactions are responses).
 */
export function firePresentSubscribers(state: GameState, event: PresentEvent): void {
  if (!state.currentEncounter) return;
  // Walk every location's slots, both sides, both creature and structure slot maps.
  for (const loc of state.currentEncounter.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    for (const side of ["player", "ai"] as const) {
      const sideSlots = ns.sideSlots[side];
      for (const kind of ["creatures", "structures"] as const) {
        const slotMap = kind === "creatures" ? sideSlots.creatures : sideSlots.structures;
        const seen = new Set<number>();
        const profileKind = kind === "creatures" ? "creature" : "structure";
        for (const pos of positionsOf(ns.profile, profileKind)) {
          const instId = slotMap[pos];
          if (instId == null) continue;
          if (seen.has(instId)) continue;
          seen.add(instId);
          const card = state.cards[instId];
          if (!card) continue;
          if (!card.revealed) continue; // face-down cards are inert
          const def = getCardDef(card.defKey);
          if (!def.onPresent || def.onPresent.length === 0) continue;
          for (const subscription of def.onPresent) {
            if (!matchesScope(subscription, side, loc, event)) continue;
            if (!matchesFilter(subscription, card, event)) continue;
            const handler = getPresentHandler(subscription.handler);
            if (!handler) continue;
            handler({
              state,
              subscriber: card,
              subscriberSide: side,
              subscriberLoc: loc,
              event,
            });
          }
        }
      }
    }
  }
}

function matchesScope(
  subscription: PresentSubscription,
  subscriberSide: Side,
  subscriberLoc: string,
  event: PresentEvent,
): boolean {
  switch (subscription.scope) {
    case "this-location":
      return event.loc === subscriberLoc;
    case "this-side":
      return event.side === subscriberSide;
    case "opposing-side":
      return event.side !== subscriberSide;
    case "anywhere":
      return true;
  }
}

function matchesFilter(
  subscription: PresentSubscription,
  subscriber: CardInstance,
  event: PresentEvent,
): boolean {
  const f = subscription.filter;
  if (!f) return true;
  if (f.cardType != null && event.cardType !== f.cardType) return false;
  if (f.excludeSelf && event.card.instId === subscriber.instId) return false;
  return true;
}

// ---------- Phase boundary handler dispatch ----------
//
// Per REBUILD §28: each phase has 10 named boundaries (onUpkeepStart, onUpkeepEnd, onDrawStart,
// ..., onCleanupEnd). Cards and location text declare `hooks: { onCombatStart: "handlerTag" }`
// and the dispatcher fires them at each boundary.
//
// The orchestrator already emits these as engine events; this dispatcher is what makes those
// events actually do something. It iterates face-up cards on the board (and location text in
// later phases) and fires each card's hook for the named boundary.

export interface PhaseBoundaryContext {
  state: GameState;
  card: CardInstance;
  side: Side;
  loc: string;
  boundary: PhaseBoundary;
}

export type PhaseBoundaryHandler = (ctx: PhaseBoundaryContext) => void;

const PHASE_BOUNDARY_HANDLERS: Record<string, PhaseBoundaryHandler> = {};

export function registerPhaseBoundaryHandler(tag: string, handler: PhaseBoundaryHandler): void {
  if (PHASE_BOUNDARY_HANDLERS[tag] != null) {
    throw new Error(`Duplicate phase-boundary handler registered: ${tag}`);
  }
  PHASE_BOUNDARY_HANDLERS[tag] = handler;
}

export function getPhaseBoundaryHandler(tag: string): PhaseBoundaryHandler | null {
  return PHASE_BOUNDARY_HANDLERS[tag] ?? null;
}

export function _resetPhaseBoundaryHandlers(): void {
  for (const k of Object.keys(PHASE_BOUNDARY_HANDLERS)) delete PHASE_BOUNDARY_HANDLERS[k];
}

/**
 * Fire all in-play cards' hooks for the named phase boundary. Iterates face-up creatures and
 * structures (face-down cards inert per unified face-down rule). Actions in slots also fire
 * their hooks if face-up — persistent actions in particular (Prayer / Curse / Quest) tick at
 * phase boundaries.
 *
 * Location-text boundary hooks fire FIRST (the location frames the moment), then card hooks.
 *
 * Called by the orchestrator at each boundary transition.
 */
export function firePhaseBoundary(state: GameState, boundary: PhaseBoundary): void {
  if (!state.currentEncounter) return;
  fireLocationTextBoundary(state, boundary);
  for (const loc of state.currentEncounter.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    for (const side of ["player", "ai"] as const) {
      const sideSlots = ns.sideSlots[side];
      for (const kind of ["creature", "structure", "action"] as const) {
        const slotMap =
          kind === "creature"
            ? sideSlots.creatures
            : kind === "structure"
              ? sideSlots.structures
              : sideSlots.actions;
        const seen = new Set<number>();
        for (const pos of positionsOf(ns.profile, kind)) {
          const instId = slotMap[pos];
          if (instId == null) continue;
          if (seen.has(instId)) continue;
          seen.add(instId);
          const card = state.cards[instId];
          if (!card) continue;
          if (!card.revealed) continue;
          const def = getCardDef(card.defKey);
          const tag = def.hooks?.[boundary];
          if (!tag) continue;
          const handler = getPhaseBoundaryHandler(tag);
          if (!handler) continue;
          handler({ state, card, side, loc, boundary });
        }
      }
    }
  }
}
