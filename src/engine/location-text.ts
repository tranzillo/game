// Location text — the registry + dispatch for printed location effects.
//
// Contract: REBUILD §26 ("no terrain stats — if a location grants stat presence, the location
// text declares a hook that modifies reads"), §34 (war/peace text modes; location text is the
// run-planning surface, visible whole-map through fog), DECISIONS 2026-06-12 (stats are
// creature-only; locations and structures contribute presence via printed text).
//
// A location text def carries:
//  - peaceText / warText: the two display modes. Fogged or peaceful nodes show peaceText; a
//    revealed node with AI presence shows warText (falls back to peaceText if no war variant).
//  - statPresence: hook adding to locationStatTotal reads — the "add 1 Tempo here" mechanic.
//    Joins the total for ALL stats uniformly: presence pays costs, feeds action flip-tempo,
//    feeds per-location Spite (summoner thorns), Bombardment-style "your Force here" effects.
//    Combat swing damage is unchanged (per-attacker effectiveStat) — text presence never swings.
//  - onFlipUp: fires when a card flips face-up at this location, BEFORE the card's own
//    onFlipUp (the location sees the freshly-flipped card first — prototype rule, preserved).
//  - hooks: phase-boundary handlers, fired by the orchestrator alongside card hooks.
//
// Deferred (noted, not built): shouldSuppressAction predicate (Champion's Rest) — the suppress
// machinery in the flip drain isn't wired yet.

import type {
  CardInstance,
  GameState,
  PhaseBoundary,
  Side,
  StatKind,
} from "./types.ts";
import { isLocationInWarMode } from "./overworld.ts";

export interface LocationTextFlipUpContext {
  state: GameState;
  card: CardInstance;
  side: Side;
  loc: string;
}

export interface LocationTextBoundaryContext {
  state: GameState;
  loc: string;
  boundary: PhaseBoundary;
}

export interface LocationTextDef {
  key: string;
  name?: string;
  peaceText: string;
  warText?: string;
  // Additive contribution to locationStatTotal(side, loc, stat). Side-aware: the handler
  // decides whether it grants to one side or both ("add 1 Tempo here" typically both).
  statPresence?: (state: GameState, side: Side, loc: string, stat: StatKind) => number;
  // Fires when any card flips face-up at this location, BEFORE the card's own onFlipUp.
  onFlipUp?: (ctx: LocationTextFlipUpContext) => void;
  // Phase-boundary hooks, fired alongside card hooks at each boundary.
  hooks?: Partial<Record<PhaseBoundary, (ctx: LocationTextBoundaryContext) => void>>;
}

const LOCATION_TEXTS: Record<string, LocationTextDef> = {};

export function registerLocationText(def: LocationTextDef): void {
  if (LOCATION_TEXTS[def.key] != null) {
    throw new Error(`Duplicate location text registered: ${def.key}`);
  }
  LOCATION_TEXTS[def.key] = def;
}

export function getLocationText(key: string): LocationTextDef | null {
  return LOCATION_TEXTS[key] ?? null;
}

export function _resetLocationTexts(): void {
  for (const k of Object.keys(LOCATION_TEXTS)) delete LOCATION_TEXTS[k];
}

/**
 * Resolve the location text def for a node, or null if the node has no locationTextKey or the
 * key isn't registered.
 */
export function locationTextFor(state: GameState, loc: string): LocationTextDef | null {
  const node = state.world.nodes.find((n) => n.id === loc);
  if (!node?.locationTextKey) return null;
  return getLocationText(node.locationTextKey);
}

/**
 * The display text for a node per §34 fog rules: location text is NEVER fogged. Fogged or
 * peaceful nodes show peace-time text; a revealed node with AI presence shows war text
 * (falling back to peaceText when no war variant is printed).
 */
export function displayTextFor(state: GameState, loc: string): string | null {
  const def = locationTextFor(state, loc);
  if (!def) return null;
  if (isLocationInWarMode(state, loc) && def.warText) return def.warText;
  return def.peaceText;
}

/**
 * Sum the location text's statPresence contribution for a read. 0 when the node has no text or
 * the text grants nothing for this stat/side.
 */
export function locationTextStatPresence(
  state: GameState,
  side: Side,
  loc: string,
  stat: StatKind,
): number {
  const def = locationTextFor(state, loc);
  if (!def?.statPresence) return 0;
  return def.statPresence(state, side, loc, stat);
}

/**
 * Fire the location text's onFlipUp for a freshly-flipped card. No-op when no text / no hook.
 * Called by fireFlipUpTrigger BEFORE the card's own onFlipUp handler.
 */
export function fireLocationTextFlipUp(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
): void {
  const def = locationTextFor(state, loc);
  if (!def?.onFlipUp) return;
  def.onFlipUp({ state, card, side, loc });
}

/**
 * Fire location-text boundary hooks for every encounter location. Called by the orchestrator's
 * firePhaseBoundary pass.
 */
export function fireLocationTextBoundary(state: GameState, boundary: PhaseBoundary): void {
  if (!state.currentEncounter) return;
  for (const loc of state.currentEncounter.locationNodeIds) {
    const def = locationTextFor(state, loc);
    const handler = def?.hooks?.[boundary];
    if (handler) handler({ state, loc, boundary });
  }
}
