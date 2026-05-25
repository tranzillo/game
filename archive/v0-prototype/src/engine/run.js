import { state, setState, createCard, freshLocation, L, shuffle } from "./state.js";
import { buildStartingDeck, WORLD_DEFS } from "../data/worlds.js";
import { LOCATION_COUNT, LOC_NAMES, setLocationConfig } from "./config.js";
import { logEntry } from "./log.js";
import { render } from "../ui/render.js";
import { _cardRegistry, _chipRegistry } from "../ui/registries.js";
import { resetEvents } from "./events.js";
import { cancelAll as cancelAllBeats } from "./scheduler.js";
import { attachEquipmentToHost, emitFutureChip, startNewTurn } from "./core.js";

// ---------- v3 run / overworld state ----------
// state.runDeck is the persistent player deck across encounters. It's a list of "deck entries":
// { defKey, mods: { force?: +N, ... } } so neutral encounters can permanently modify cards
// (Forge: +1 Force) or remove them (Siren: removed from this list entirely).
// A fresh card instance is created from each entry at encounter start.
export function buildRunDeck() {
  return buildStartingDeck().map(defKey => ({ defKey, mods: {} }));
}

// Apply per-instance mods baked into the deck entry to a card object.
export function applyRunMods(card, mods) {
  if (!mods) return card;
  if (mods.force) {
    card.force = (card.force || 0) + mods.force;
  }
  if (mods.tempo) {
    card.tempo = (card.tempo || 0) + mods.tempo;
  }
  if (mods.insight) {
    card.insight = (card.insight || 0) + mods.insight;
  }
  if (mods.durability && card.durability != null) {
    card.durability += mods.durability;
    card.durabilityMax = (card.durabilityMax || 0) + mods.durability;
  }
  // Marks persist across encounters via the run-deck entry. Each entry can carry an array of
  // { kind, side } marks that re-apply to the new instance when it enters a new encounter.
  if (mods.marks && mods.marks.length > 0) {
    card.marks = mods.marks.map(m => ({ kind: m.kind, side: m.side }));
  }
  return card;
}

export function freshState() {
  return {
    // Run-scoped (persists across encounters):
    deckKey: null,                // chosen starter ("red" | "green"); null until picked at menu
    runDeck: [],                  // populated when deck is chosen
    runDurability: 20,            // player Durability persists across encounters
    world: makeFreshWorld(),     // overworld nodes/edges/pawn
    view: "menu",                 // "menu" | "overworld" | "encounter"
    runOver: null,                // null | "playerWin" | "playerLose"
    // Encounter-scoped (rebuilt at each encounter-load; null when on the overworld):
    turn: 1,
    phase: "setup",
    activeSide: "player",
    firstSide: "player",
    sides: null,                  // { player, ai } — built per encounter
    currentNodeId: null,          // destination node id (where pawn moves after clearing)
    encounterNodeIds: null,       // all node ids in the active encounter (locations)
    encounterDestId: null,        // node id the player chose to walk to after clearing
    encounterKind: null,          // "hostile" | "neutral" | "boss"
    encounterEndPending: null,    // null | "playerCleared" | "playerLeft" | "bossKilled" — set mid-turn, resolved at end of cleanup
    selectedCardId: null,
    selectedCommittedId: null,
    gameOver: null,               // encounter-scoped result before run-scoped runOver is updated
    log: [],
    // The Past: shared encounter-scoped log of action resolutions. Each entry:
    //   { defKey, side, loc, name, tempo, turn }
    // Appended on every resolveAction + quest reward firing. Cleared at encounter start.
    // Cards (Blue mostly; future Black erases) target Past entries positionally or randomly.
    past: [],
    // Unified Future → Present → Past timeline. Each chip represents a card resolving in play —
    // entering face-down (commits, token creation) or flipping face-up (the present moment).
    // Chip fields: { id, defKey, instId, kind, side, loc, pos, tempo, faceUp, marks, state, turn }
    // where state is "future" (waiting), "resolved" (passed through present, now in past).
    // Suppressed chips stay at the right edge of the future indefinitely until released.
    // Cleared per encounter. Drives Future/Past UI strips.
    timeline: [],
    // Narrative outcomes — anything that *happened* in the encounter that isn't a card resolution.
    // Damage, deaths, movement, attacks, mark applications, sleep ticks, etc. Drives the
    // narrative-history view (replacement for the combat log).
    outcomes: []
  };
}

// Called from the start menu when the player picks a deck. Builds the runDeck and transitions
// to the overworld view.
export function chooseDeckAndStartRun(deckKey) {
  state.deckKey = deckKey;
  state.runDeck = buildRunDeck();
  state.view = "overworld";
  render();
}

// Build a fresh world from WORLD_DEFS. Node status tracks per-node progress.
export function makeFreshWorld() {
  return {
    nodes: WORLD_DEFS.nodes.map(n => ({ ...n, status: n.kind === "start" ? "completed" : "unvisited" })),
    edges: WORLD_DEFS.edges.map(e => [...e]),
    pawnAt: WORLD_DEFS.startNode,
    startNode: WORLD_DEFS.startNode,
    bossNode: WORLD_DEFS.bossNode
  };
}

// Find a node by id.
export function getNode(nodeId) {
  return state.world.nodes.find(n => n.id === nodeId);
}

// Returns ids of nodes adjacent to the pawn that are legal targets to move to.
// Adjacent node ids of the pawn's current position.
export function adjacentToPawn() {
  const pawn = state.world.pawnAt;
  const adj = [];
  for (const [a, b] of state.world.edges) {
    if (a === pawn) adj.push(b);
    else if (b === pawn) adj.push(a);
  }
  return adj;
}

// Adjacent node ids that are still unvisited — these are the locations a pawn-node click pulls
// into the encounter.
export function unvisitedAdjacentsOfPawn() {
  return adjacentToPawn().filter(id => {
    const n = getNode(id);
    return n && n.status === "unvisited";
  });
}

// Returns the set of node ids that are *clickable* in the current overworld state.
// Two cases:
//   (A) The pawn's own node is clickable IFF there's at least one unvisited adjacent — clicking
//       it triggers an encounter that pulls in all those unvisited adjacents.
//   (B) Adjacent nodes are clickable IFF they are completed (cleared) — clicking walks the pawn
//       to that node, no encounter. Unvisited adjacents are not directly clickable; they get
//       engaged via the pawn-node click.
export function legalMovesFromPawn() {
  const legal = [];
  const pawn = state.world.pawnAt;
  if (unvisitedAdjacentsOfPawn().length > 0) legal.push(pawn);
  for (const id of adjacentToPawn()) {
    const n = getNode(id);
    if (n && n.status === "completed") legal.push(id);
  }
  return legal;
}

// Build a fresh player side from the persistent run deck.
export function freshPlayerSide() {
  const cards = state.runDeck.map(entry => {
    const c = createCard(entry.defKey, "player");
    applyRunMods(c, entry.mods);
    // Track which run-deck entry this instance came from so we can mutate the deck on Forge etc.
    c.runDeckEntry = entry;
    return c;
  });
  const locations = [];
  for (let i = 0; i < LOCATION_COUNT; i++) locations.push(freshLocation());
  return {
    durability: state.runDurability,  // carried over from previous encounters
    deck: shuffle(cards),
    hand: [],
    discard: [],
    graveyard: [],
    junkyard: [],      // junkyard zone — structures and equipment that have left play
    exile: [],
    locations
  };
}

// Build a fresh AI side. AI deck is the same starting deck for v3 (designer-tuned per-node decks
// arrive in v4+). Cards in the AI's slots are pre-placed from the node's contents and don't draw
// from this deck — but the deck still exists for reinforcements during the encounter.
export function freshAiSide() {
  const cards = buildStartingDeck().map(k => createCard(k, "ai"));
  const locations = [];
  for (let i = 0; i < LOCATION_COUNT; i++) locations.push(freshLocation());
  return {
    durability: 20,                   // boss only — for non-boss encounters this isn't used
    deck: shuffle(cards),
    hand: [],
    discard: [],
    graveyard: [],
    junkyard: [],
    exile: [],
    locations
  };
}

// Load an encounter triggered by the player attempting to advance from their current pawn node.
// Per the unified-encounter framework: an encounter pulls in *all unvisited nodes adjacent to
// the pawn* as the encounter's locations. Each adjacent node contributes one location's worth of
// contents. After clearing, all those nodes become visited; the player picks one to walk to.
//
// `clickedNodeId` is the adjacent the player clicked (used as the destination after clearing).
export function loadEncounterFromPawn(clickedNodeId) {
  const pawnNodeId = state.world.pawnAt;
  // Gather unvisited adjacents of the current pawn node (the encounter's locations).
  const encounterNodeIds = [];
  for (const [a, b] of state.world.edges) {
    let other = null;
    if (a === pawnNodeId) other = b;
    else if (b === pawnNodeId) other = a;
    if (!other) continue;
    const n = getNode(other);
    if (n && n.status === "unvisited" && !encounterNodeIds.includes(other)) {
      encounterNodeIds.push(other);
    }
  }
  if (encounterNodeIds.length === 0) {
    // No unvisited adjacents — just walk to the clicked node, no encounter.
    state.world.pawnAt = clickedNodeId;
    state.view = "overworld";
    render();
    return;
  }
  // Ensure the clicked node is included (it should be, since the player clicked an adjacent).
  if (!encounterNodeIds.includes(clickedNodeId)) {
    encounterNodeIds.unshift(clickedNodeId);
  }

  // Build per-location bookkeeping arrays from the pulled-in nodes.
  setLocationConfig(
    encounterNodeIds.length,
    encounterNodeIds.map(id => getNode(id).label),
    encounterNodeIds.map(id => getNode(id).locationTextKey || null)
  );

  // Determine the encounter's overall kind. Boss: any pulled-in node is adjacent to an `end`
  // node (the boss is the AI summoner behind C). Hostile: any pulled-in node is kind hostile.
  // Else neutral.
  let encounterKind = "neutral";
  function nodeIsBossAdjacent(nodeId) {
    for (const [a, b] of state.world.edges) {
      if (a === nodeId && getNode(b)?.kind === "end") return true;
      if (b === nodeId && getNode(a)?.kind === "end") return true;
    }
    return false;
  }
  if (encounterNodeIds.some(nodeIsBossAdjacent)) encounterKind = "boss";
  else if (encounterNodeIds.some(id => getNode(id).kind === "hostile")) encounterKind = "hostile";

  state.sides = { player: freshPlayerSide(), ai: freshAiSide() };
  state.encounterNodeIds = encounterNodeIds;     // tracks which nodes are this encounter's locations
  state.encounterDestId = clickedNodeId;          // where the pawn moves after clearing
  state.currentNodeId = clickedNodeId;            // for legacy code paths that read this
  state.encounterKind = encounterKind;
  state.turn = 1;
  state.phase = "setup";
  state.firstSide = "player";
  state.gameOver = null;
  state.encounterEndPending = null;
  state.selectedCardId = null;
  state.selectedCommittedId = null;
  state.log = [];
  state.past = [];  // The Past resets per encounter.
  state.timeline = [];  // Future + Past chip stream resets per encounter.
  state.outcomes = [];  // Narrative outcomes reset per encounter.
  // Reset the persistent-card-DOM registry: fresh encounter, no carry-over elements.
  for (const el of _cardRegistry.values()) {
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  _cardRegistry.clear();
  // Same reset for the timeline chip registry.
  _chipRegistry.clear();
  // Reset the engine→UI event id counter and cancel any pending beat from a prior encounter.
  resetEvents();
  cancelAllBeats();

  // Place each node's contents into the AI side's slot grid at that node's location index.
  for (let loc = 0; loc < encounterNodeIds.length; loc++) {
    const node = getNode(encounterNodeIds[loc]);
    const contents = node.contents;
    if (!contents) continue;
    if (contents.aiPlacements) {
      for (const placement of contents.aiPlacements) {
        const card = createCard(placement.defKey, "ai");
        card.revealed = false;
        placeIntoLocSlot(L("ai", loc), placement.slot, card);
        // Encounter-start placements enter face-down into the future — they flip at end of Round 1 upkeep.
        const slotPos = placement.slot.pos || placement.slot.kind;
        emitFutureChip(card, "ai", loc, slotPos, card.tempo || 0);
        // Pre-attach equipment if specified. `equipWith` is an array of equipment defKeys to
        // attach to this card on encounter-load. Equipment cards are owned by "ai" (same side
        // as the host) and apply their attack-pattern grants immediately.
        if (placement.equipWith && placement.slot.kind === "creature") {
          for (const eqKey of placement.equipWith) {
            const eq = createCard(eqKey, "ai");
            eq.revealed = false;
            attachEquipmentToHost(eq, card, "ai");
            emitFutureChip(eq, "ai", loc, placement.slot.pos, 0);
          }
        }
      }
    }
    // Multi-card neutral placements: same shape as aiPlacements but cards are owned by "neutral".
    // Used for biome-native neutral encounter content (Champion's Rest creature + action, etc.).
    if (contents.neutralPlacements) {
      for (const placement of contents.neutralPlacements) {
        const card = createCard(placement.defKey, "neutral");
        card.revealed = false;
        placeIntoLocSlot(L("ai", loc), placement.slot, card);
        const slotPos = placement.slot.pos || placement.slot.kind;
        emitFutureChip(card, "ai", loc, slotPos, card.tempo || 0);
        // Pre-attach equipment to neutral creatures too (e.g., Goblin Armaments' goblin-with-sword).
        if (placement.equipWith && placement.slot.kind === "creature") {
          for (const eqKey of placement.equipWith) {
            const eq = createCard(eqKey, "neutral");
            eq.revealed = false;
            attachEquipmentToHost(eq, card, "ai");  // hostSide is "ai" because neutrals occupy the AI side spatially
            emitFutureChip(eq, "ai", loc, placement.slot.pos, 0);
          }
        }
      }
    }
    // Legacy single-key path (Forge, Siren). Default slot inferred from card type.
    if (contents.neutralKey) {
      const neutralCard = createCard(contents.neutralKey, "neutral");
      neutralCard.revealed = false;
      const slot = neutralCard.type === "creature"
        ? { kind: "creature", pos: "fl" }
        : { kind: "structure" };
      placeIntoLocSlot(L("ai", loc), slot, neutralCard);
    }
  }

  state.view = "encounter";
  const labelsList = LOC_NAMES.join(" + ");
  logEntry(`— Encounter: ${labelsList} (${encounterKind}) —`, "phase");
  startNewTurn();
}

// Legacy: kept as an alias in case anything calls loadEncounterFromNode directly. Treats nodeId
// as both pawn-anchor *and* destination — simulates the old "encounter at this single node" flow.
export function loadEncounterFromNode(nodeId) {
  // Set pawn temporarily so adjacency pulls from here.
  state.world.pawnAt = nodeId;
  loadEncounterFromPawn(nodeId);
}

// Helper: place a card directly into a location's committed slot (bypasses the play queue).
// Used during encounter-load to set up pre-placed AI / neutral cards.
export function placeIntoLocSlot(lc, slot, card) {
  if (slot.kind === "creature") {
    lc.creatures[slot.pos] = card;
  } else if (slot.kind === "structure") {
    lc.structure = card;
  } else if (slot.kind === "action") {
    lc.action = card;
  }
}

// Click handler for overworld nodes. Two cases:
//  - Click the pawn's own node (with unvisited adjacents present) → trigger encounter pulling in
//    all unvisited adjacents as the encounter's locations.
//  - Click a cleared adjacent → walk pawn there (no encounter).
export function moveTo(nodeId) {
  const target = getNode(nodeId);
  if (!target) return;
  if (!legalMovesFromPawn().includes(nodeId)) return;

  // Click on the pawn node: trigger encounter.
  if (nodeId === state.world.pawnAt) {
    // The encounter pulls in all unvisited adjacents. The "destination" (which adjacent the pawn
    // walks to after clearing) is undefined here — the player chooses post-encounter by clicking
    // a cleared adjacent. For now we set destId to the first unvisited adjacent as a placeholder;
    // it's overwritten by the post-encounter walk-click flow.
    const unvisited = unvisitedAdjacentsOfPawn();
    if (unvisited.length === 0) return;
    loadEncounterFromPawn(unvisited[0]);  // any adjacent works as the temporary dest anchor
    return;
  }

  // Click on a cleared adjacent: walk the pawn there, no encounter.
  state.world.pawnAt = nodeId;
  render();
}

// End the current encounter and return to the overworld. Marks all encounter nodes completed.
// Pawn stays at the original starting node — the player walks to a cleared adjacent post-encounter
// by clicking on the overworld map.
export function endEncounter(result) {
  // result: "playerCleared" | "playerLeft" | "playerLost" | "bossKilled"
  const encounterNodeIds = state.encounterNodeIds || [];

  // Persist player Durability into run state.
  state.runDurability = state.sides.player.durability;

  // Acquisition: any card flagged `acquired` (taken via Recruit, Goblin Armaments rewire, etc.)
  // joins the run-deck for future encounters. Scan all zones — the card might be in slots, in
  // the player's graveyard, discard, hand, or junkyard. Equipment is scanned both attached to
  // player creatures and in the junkyard (where it goes when its host died).
  if (result !== "playerLost" && state.sides && state.sides.player) {
    const p = state.sides.player;
    const acquired = [];
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L("player", loc);
      for (const pos of ["fl","fr","bl","br"]) {
        const c = lc.creatures[pos];
        if (!c) continue;
        if (c.acquired) acquired.push(c);
        if (c.equipment) {
          for (const eq of c.equipment) {
            if (eq.acquired) acquired.push(eq);
          }
        }
      }
    }
    for (const c of [...p.hand, ...p.discard, ...p.graveyard, ...p.junkyard]) {
      if (c.acquired) acquired.push(c);
    }
    // Per-location piles: canonically stored on the AI side's location object. Acquired cards
    // can land here when a reroute mark sent the body to a summoner-less side.
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L("ai", loc);
      if (!lc.piles) continue;
      for (const zone of ["graveyard", "junkyard", "exile"]) {
        for (const c of lc.piles[zone]) {
          if (c.acquired) acquired.push(c);
        }
      }
    }
    for (const c of acquired) {
      const mods = {};
      if (c.marks && c.marks.length > 0) {
        mods.marks = c.marks.map(m => ({ kind: m.kind, side: m.side }));
      }
      state.runDeck.push({ defKey: c.defKey, mods });
      logEntry(`Acquired: ${c.name} joins your deck.`, "win");
    }
  }

  const cleanup = () => {
    state.view = "overworld";
    state.sides = null;
    state.currentNodeId = null;
    state.encounterKind = null;
    state.encounterNodeIds = null;
    state.encounterDestId = null;
    state.encounterEndPending = null;
    state.gameOver = null;
  };

  if (result === "playerLost") {
    state.runOver = "playerLose";
    cleanup();
    render();
    return;
  }
  // Mark every node in the encounter as completed. (Includes "bossKilled" — slice has no boss
  // so it's just here for future-proofing.)
  for (const id of encounterNodeIds) {
    const n = getNode(id);
    if (n) n.status = "completed";
  }
  if (result === "bossKilled") {
    state.runOver = "playerWin";
    // Visually move the pawn to the end node so the map shows the player reached the boss.
    if (WORLD_DEFS.bossNode) state.world.pawnAt = WORLD_DEFS.bossNode;
  }
  cleanup();
  render();
}

// Check whether the current encounter has ended naturally and call endEncounter accordingly.
// For v3:
//   - Boss encounter: ends when boss-side has no creatures or structures left, OR when player Durability=0.
//     (No retreat condition — boss never retreats; you must clear the board.)
//   - Hostile encounter: ends when AI side has no creatures or structures (effectively "AI cleared").
//   - Neutral encounter: ends when the neutral card has consumed itself OR when the player presses
//     the leave-encounter button (handled separately in UI).
// Mid-turn check: if the encounter's win condition is met, mark it as pending end. The actual
// endEncounter call is deferred to the very end of cleanup so all phases of the current turn
// finish first (combat damage, location-text triggers like Champion's Rest, etc.). Player-lost
// is the one exception — if the player's summoner falls, the encounter ends immediately.
export function checkEncounterEnd() {
  if (!state.sides) return;
  if (state.sides.player.durability <= 0) {
    logEntry(`Your summoner falls. Run lost.`, "lose");
    endEncounter("playerLost");
    return;
  }
  if (state.encounterEndPending) return;  // already flagged
  // Count non-player presence at all locations.
  let aiCreatures = 0, neutralCards = 0, hasStructure = false;
  for (let loc = 0; loc < LOCATION_COUNT; loc++) {
    const lc = L("ai", loc);
    for (const pos of ["fl","fr","bl","br"]) {
      const c = lc.creatures[pos];
      if (!c) continue;
      if (c.owner === "neutral") neutralCards++;
      else aiCreatures++;
    }
    if (lc.structure) {
      if (lc.structure.owner === "neutral") neutralCards++;
      else hasStructure = true;
    }
  }
  if (state.encounterKind === "boss") {
    if (aiCreatures === 0 && !hasStructure) {
      logEntry(`The boss is defeated. (Encounter ends at end of turn.)`, "win");
      state.encounterEndPending = "bossKilled";
    }
    return;
  }
  if (state.encounterKind === "hostile") {
    if (aiCreatures === 0 && !hasStructure) {
      logEntry(`Hostile presence cleared. (Encounter ends at end of turn.)`, "win");
      state.encounterEndPending = "playerCleared";
    }
    return;
  }
  if (state.encounterKind === "neutral") {
    if (neutralCards === 0 && aiCreatures === 0 && !hasStructure) {
      logEntry(`Locations cleared. (Encounter ends at end of turn.)`, "phase");
      state.encounterEndPending = "playerLeft";
    }
    return;
  }
}
