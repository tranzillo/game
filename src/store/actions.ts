// Store-level actions — the engine's external entry points for the UI.
//
// Contract: ENGINE_SKETCH.md Phase F + Phase G.
//
// Each action wraps engine mutations and calls notifyStateChanged() so React rerenders.
// Orchestrated multi-beat actions (advancePhase) use runBeatN from beats.ts.

import { createCardInstance, getCardDef } from "../engine/cards.ts";
import { freshNodeState } from "../engine/state.ts";
import { removeFrom } from "../engine/slots.ts";
import { placeAt } from "../engine/slots.ts";
import type {
  CardInstance,
  GameState,
  InstId,
  PositionKey,
  Side,
  SlotKind,
} from "../engine/types.ts";
import { getEngineState, setEngineState } from "./engine-state.ts";
import { notifyStateChanged } from "./index.ts";
import { cancelAll } from "../engine/scheduler.ts";
import { defaultProfile } from "../engine/profile.ts";
import {
  adjacentLocationsFor,
  startEncounterFromCurrentNode,
} from "../engine/overworld.ts";
import { evaluateCost } from "../engine/costs.ts";
import { shuffleDeck } from "../engine/piles.ts";

// ---------- Selection (UI-local state inside engine.encounter for convenience) ----------
//
// Per ENGINE_SKETCH Phase F note: UI-only state like "selected card" belongs in store/UI layer,
// not in EncounterState. For Phase G simplicity we track selection in a module-local cell.
// Phase G+ can promote this to a small dedicated UI store if other UI state appears.

let selectedCardId: InstId | null = null;

export function getSelectedCardId(): InstId | null {
  return selectedCardId;
}

export function actionSelectCard(instId: InstId | null): void {
  selectedCardId = instId;
  notifyStateChanged();
}

// ---------- Slice run setup ----------

/**
 * Start a new run on the slice's hand-authored map. Resets all state, builds the world graph,
 * authors per-node initial content (AI placements at hostile nodes, boss summoner at the end
 * node), populates the player's starting hand + deck, and triggers the first encounter at the
 * unvisited neighbors of the pawn's start position.
 *
 * Slice map shape (Phase L slice 7):
 *   N0 (start, pawn here) — N1 (hostile) — N2 (hostile) — N3 (end/boss)
 *                                              |
 *                                              N4 (neutral side path off N2)
 *
 * First encounter resolves at N1. After clearing, player travels to N1; next encounter at N2.
 * After clearing N2, player travels to N2; next encounter is N3 (boss) + N4 (neutral) together.
 */
export function actionStartRun(): void {
  cancelAll();

  const state = getEngineState();
  // Reset all encounter / run state.
  state.cards = {};
  state.trash = [];
  state.currentEncounter = null;
  state.runOver = null;
  state.runDeck = [];
  state.runDurability = 20;
  state.enemyDurability = 20; // run-scoped enemy summoner Durability (DECISIONS 2026-06-13)
  state.aiRunDeck = []; // run-scoped enemy summoner deck
  // The timeline (and thus the Past) is run-scoped (DECISIONS 2026-06-13): a fresh run starts
  // with an empty timeline, chip-id source reset, and encounter counter reset.
  state.timeline = [];
  state.nextChipId = 1;
  state.nextResolveSeq = 1;
  state.encounterCount = 0;

  // Author the world map as a tiered grid per §34: y = tier (boss at top, start at bottom per
  // §2's spatial consistency), x = column. Edges connect adjacent tiers only — forward-only
  // branching routes.
  //
  //   tier 3 (y=0):        Boss (end)
  //   tier 2 (y=1):   B1 (neutral)   B2 (hostile)
  //   tier 1 (y=2):   A1 (hostile)   A2 (neutral)
  //   tier 0 (y=3):        Start
  //
  // B1 carries a big biome body (r5 Pit-Fighter): killed at a neutral loc with no AI summoner
  // present, it dies into the LOCATION's graveyard — the §34 "control" example seed.
  state.world.nodes = [
    { id: "N0", x: 1, y: 3, kind: "start", label: "Start", status: "encountered", revealed: true },
    {
      id: "A1",
      x: 0,
      y: 2,
      kind: "hostile",
      label: "A1",
      status: "unvisited",
      initialContent: {
        placements: [
          { side: "ai", kind: "creature", anchor: { r: 0, c: 0 }, defKey: "r1", origin: "aiDeck" },
          { side: "ai", kind: "creature", anchor: { r: 0, c: 1 }, defKey: "r3", origin: "aiDeck" },
        ],
      },
    },
    {
      id: "A2",
      x: 2,
      y: 2,
      kind: "neutral",
      label: "A2",
      locationTextKey: "ogreHideaway",
      status: "unvisited",
      initialContent: {
        placements: [
          { side: "ai", kind: "creature", anchor: { r: 0, c: 0 }, defKey: "r9", origin: "biome" },
        ],
      },
    },
    {
      id: "B1",
      x: 0,
      y: 1,
      kind: "neutral",
      label: "B1",
      status: "unvisited",
      initialContent: {
        placements: [
          { side: "ai", kind: "creature", anchor: { r: 0, c: 0 }, defKey: "r5", origin: "biome" },
        ],
      },
    },
    {
      id: "B2",
      x: 2,
      y: 1,
      kind: "hostile",
      label: "B2",
      status: "unvisited",
      initialContent: {
        placements: [
          { side: "ai", kind: "creature", anchor: { r: 0, c: 0 }, defKey: "r3", origin: "aiDeck" },
          { side: "ai", kind: "creature", anchor: { r: 0, c: 1 }, defKey: "r7", origin: "aiDeck" },
        ],
      },
    },
    {
      id: "BOSS",
      x: 1,
      y: 0,
      kind: "end",
      label: "Boss",
      status: "unvisited",
      initialContent: {
        placements: [
          { side: "ai", kind: "creature", anchor: { r: 0, c: 0 }, defKey: "r3", origin: "aiDeck" },
          { side: "ai", kind: "creature", anchor: { r: 0, c: 1 }, defKey: "r9", origin: "aiDeck" },
        ],
      },
    },
  ];
  state.world.edges = [
    ["N0", "A1"],
    ["N0", "A2"],
    ["A1", "B1"],
    ["A1", "B2"],
    ["A2", "B1"],
    ["A2", "B2"],
    ["B1", "BOSS"],
    ["B2", "BOSS"],
  ];
  state.world.nodeState = {};
  for (const node of state.world.nodes) {
    state.world.nodeState[node.id] = freshNodeState(defaultProfile());
  }
  state.world.pawnAt = "N0";

  // The full run deck — Phase M.1-M.3 ported Red + Green cards + slice scaffolding content.
  // The hand starts EMPTY per the prototype: turn 1's draw phase deals the opening hand (up to
  // 5 + Insight). Equipment (r2, r11) stays out — no equipment-commit UI yet.
  const deckDefKeys = [
    "r1", "r1", "r3", "r3", "r5", "r7", "r8", "r9", "r10", "r12", "r13", "r14",
    "g3", "g4", "g6", "g8",
    "spark", "spark", "watcher",
  ];

  // Seed the AI summoner's run-deck once (same list as the player for now — the player doesn't
  // choose a color yet, so the AI mirrors it; custom AI decks are later content). aiDeck-origin
  // so presence/clearing checks classify these as enemy cards.
  for (const k of deckDefKeys) {
    state.aiRunDeck.push(createCardInstance(state, k, "aiDeck"));
  }

  const enc = startEncounterFromCurrentNode(state);
  if (enc) {
    for (const k of deckDefKeys) {
      const id = createCardInstance(state, k, "playerDeck");
      enc.playerSide.deck.push(id);
    }
    shuffleDeck(state, "player");
    // If the summoner is present this encounter, hand it the run-deck so it draws + plays.
    if (enc.aiSide) {
      enc.aiSide.deck = [...state.aiRunDeck];
      shuffleDeck(state, "ai");
    }
  }

  selectedCardId = null;
  notifyStateChanged();
}

/**
 * Back-compat alias for code that still calls actionLoadSlice. Routes to actionStartRun.
 */
export function actionLoadSlice(_opts?: unknown): void {
  actionStartRun();
}

// ---------- Placement legality (single source of truth for action + UI) ----------

/**
 * Can `card` (from the player's hand) legally be committed at this slot right now? ALL the
 * placement gates live here — the place action enforces them and the UI highlights from them,
 * so what's clickable and what's legal can never drift apart.
 *
 * Gates: in hand · kind matches card type · player side only · commit window (§28: permanents
 * in main only, actions any phase) · location not cleared (§31) · cost met at this loc (§26) ·
 * slot empty (committed AND pending).
 */
export function canPlaceAt(
  state: GameState,
  card: CardInstance,
  opts: { loc: string; side: Side; kind: SlotKind; pos: PositionKey },
): boolean {
  const enc = state.currentEncounter;
  if (!enc) return false;
  if (opts.side !== "player") return false;
  if (!enc.playerSide.hand.includes(card.instId)) return false;
  if (!matchesKind(card, opts.kind)) return false;
  const def = getCardDef(card.defKey);
  if (def.type !== "action" && enc.phase !== "main") return false;
  if (enc.playerLocationCleared[opts.loc]) return false;
  if (!evaluateCost(state, card, "player", opts.loc)) return false;

  // Slot must be empty: committed map AND pending map.
  const ns = state.world.nodeState[opts.loc];
  if (!ns) return false;
  const committedMap =
    opts.kind === "creature"
      ? ns.sideSlots.player.creatures
      : opts.kind === "structure"
        ? ns.sideSlots.player.structures
        : ns.sideSlots.player.actions;
  if (committedMap[opts.pos] != null) return false;
  const locData = enc.locationData[opts.loc];
  if (locData) {
    const pendingMap =
      opts.kind === "creature"
        ? locData.pending.creatures
        : opts.kind === "structure"
          ? locData.pending.structures
          : locData.pending.actions;
    if (pendingMap[opts.pos] != null) return false;
  }
  return true;
}

/**
 * Is there ANY legal placement for this hand card right now? Drives hand-card selectability —
 * unplayable cards render dimmed and unclickable.
 */
export function isCardPlayable(state: GameState, card: CardInstance): boolean {
  const enc = state.currentEncounter;
  if (!enc) return false;
  const def = getCardDef(card.defKey);
  const kind: SlotKind =
    def.type === "creature" ? "creature" : def.type === "structure" ? "structure" : "action";
  if (def.type === "equipment") return false; // no equipment-commit flow yet
  for (const loc of enc.locationNodeIds) {
    const ns = state.world.nodeState[loc];
    if (!ns) continue;
    for (const pos of Object.keys(
      kind === "creature"
        ? ns.sideSlots.player.creatures
        : kind === "structure"
          ? ns.sideSlots.player.structures
          : ns.sideSlots.player.actions,
    )) {
      if (canPlaceAt(state, card, { loc, side: "player", kind, pos })) return true;
    }
  }
  return false;
}

// ---------- Placement ----------

/**
 * Place the selected card from the player's hand into a pending slot. All legality gates run
 * through canPlaceAt — the same predicate the UI highlights from.
 *
 * Returns true on success, false otherwise.
 */
export function actionPlaceSelectedCard(opts: {
  loc: string;
  side: Side;
  kind: SlotKind;
  pos: PositionKey;
}): boolean {
  const state = getEngineState();
  if (selectedCardId == null) return false;
  if (!state.currentEncounter) return false;
  const enc = state.currentEncounter;

  const card = state.cards[selectedCardId];
  if (!card) return false;
  if (!canPlaceAt(state, card, opts)) return false;

  // Place. canPlaceAt verified emptiness; placeAt throws only on races we've excluded.
  try {
    placeAt(state, opts.side, opts.loc, opts.kind, [opts.pos], card, true /* pending */);
  } catch {
    return false;
  }

  // Remove from hand.
  const handIdx = enc.playerSide.hand.indexOf(card.instId);
  if (handIdx !== -1) enc.playerSide.hand.splice(handIdx, 1);

  // Deselect after placement.
  selectedCardId = null;

  notifyStateChanged();
  return true;
}

/**
 * Cancel a pending placement — return the card to the player's hand and free the slot.
 */
export function actionCancelPending(opts: {
  loc: string;
  side: Side;
  kind: SlotKind;
  pos: PositionKey;
}): boolean {
  const state = getEngineState();
  if (!state.currentEncounter) return false;
  const enc = state.currentEncounter;

  // Look up the pending card at the position
  const locData = enc.locationData[opts.loc];
  if (!locData) return false;
  const map =
    opts.kind === "creature"
      ? locData.pending.creatures
      : opts.kind === "structure"
        ? locData.pending.structures
        : locData.pending.actions;
  const instId = map[opts.pos];
  if (instId == null) return false;
  const card = state.cards[instId];
  if (!card) return false;

  // Remove from pending
  removeFrom(state, opts.side, opts.loc, opts.kind, card, true);

  // Return to player hand
  enc.playerSide.hand.push(card.instId);

  notifyStateChanged();
  return true;
}

// ---------- Travel between encounters ----------

/**
 * Player picks an adjacent unvisited node to travel to after an encounter ends with
 * outcome=playerCleared or aiRetreated. Per §2 line 99: "After the encounter ends, the player
 * moves to one of the locations from that encounter."
 *
 * Mechanics:
 *  1. Validate: nodeId must be an unvisited neighbor of the current pawn position.
 *  2. Mark the destination as encountered (status: "encountered").
 *  3. Move the pawn to the destination.
 *  4. Clear the prior encounter (state.currentEncounter = null).
 *  5. Start a new encounter at the new pawn position via startEncounterFromCurrentNode.
 *
 * Returns true on success, false on invalid input.
 */
export function actionTravelTo(nodeId: string): boolean {
  const state = getEngineState();
  cancelAll();

  const currentNode = state.world.pawnAt;
  if (!currentNode) return false;
  // Validate: destination must be an unvisited adjacent of the current pawn position.
  const validAdjacents = new Set(adjacentLocationsFor(state, currentNode));
  if (!validAdjacents.has(nodeId)) return false;

  // Mark destination encountered.
  const destNode = state.world.nodes.find((n) => n.id === nodeId);
  if (destNode) destNode.status = "encountered";

  // Move pawn.
  state.world.pawnAt = nodeId;

  // Start the next encounter at the new pawn position. The prior encounter object is left in
  // place until setup replaces it — setup carries the player's persistent deck (refilled by
  // endEncounterPiles) and run-state Durability forward from it (§29/§31).
  startEncounterFromCurrentNode(state);
  selectedCardId = null;
  notifyStateChanged();
  return true;
}

// ---------- Helpers ----------

function matchesKind(card: CardInstance, kind: SlotKind): boolean {
  const def = getCardDef(card.defKey);
  if (kind === "creature") return def.type === "creature";
  if (kind === "structure") return def.type === "structure";
  if (kind === "action") return def.type === "action";
  return false;
}

// Re-export getState for UI convenience (avoids reaching into engine-state directly).
export { getEngineState as getState };

// Type re-exports for components.
export type { GameState };

// _setEngineState only used by tests
export { setEngineState as _setEngineState };
