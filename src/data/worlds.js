import { state } from "../engine/state.js";

// ---------- Slice prototype overworld config ----------
// Bipartite chain: each "stage" is a pair of parallel nodes the player engages with as a
// 2-location encounter. After clearing the pair, the player picks one to move to. From there,
// the next pair is the encounter's two locations.
//
// Stage 1: A1, A2  — both peace (Champion's Rest content)
// Stage 2: B1, B2  — mixed (one peace, one hostile)
// Stage 3: C1, C2  — both hostile (final encounter)
//
// Edges connect every Stage-N node to every Stage-(N+1) node (full bipartite per stage),
// guaranteeing a 2-location encounter at each step.
//
// Each node has *one* location's worth of contents — `contents` (and optional `locationTextKey`).
// Multi-location encounters come from adjacency in the graph, not from arrays inside a node.
export const WORLD_DEFS = {
  nodes: [
    { id: "start", x: 1, y: 2, biome: "Crossroads",  kind: "start",
      label: "Crossroads (start)",
      contents: null },

    // Stage 1 — both peace. A1 Ogre Hideaway, A2 Champion's Rest.
    { id: "A1", x: 2, y: 1, biome: "Mountain", kind: "neutral",
      label: "Ogre Hideaway",
      locationTextKey: "locP3",
      contents: { neutralPlacements: [
        { defKey: "r9", slot: { kind: "creature", pos: "fl" } }
      ]}
    },
    { id: "A2", x: 2, y: 3, biome: "Mountain", kind: "neutral",
      label: "Champion's Rest",
      locationTextKey: "locP1",
      contents: { neutralPlacements: [
        { defKey: "r3", slot: { kind: "creature", pos: "fl" } },
        { defKey: "r13", slot: { kind: "action" } }
      ]}
    },

    // Stage 2 — mixed. B1 peace (Goblin Armaments), B2 hostile (Skirmish Line).
    { id: "B1", x: 3, y: 1, biome: "Mountain", kind: "neutral",
      label: "Goblin Armaments",
      locationTextKey: "locP2",
      contents: { neutralPlacements: [
        { defKey: "r1", slot: { kind: "creature", pos: "fl" }, equipWith: ["r2"] },
        { defKey: "r1", slot: { kind: "creature", pos: "fr" }, equipWith: ["r11"] },
        { defKey: "r1", slot: { kind: "creature", pos: "bl" } },
        { defKey: "r1", slot: { kind: "creature", pos: "br" } }
      ]}
    },
    { id: "B2", x: 3, y: 3, biome: "Mountain", kind: "hostile",
      label: "Skirmish Line",
      contents: { aiPlacements: [
        { defKey: "r1", slot: { kind: "creature", pos: "fl" } },
        { defKey: "r7", slot: { kind: "creature", pos: "fr" } },
        { defKey: "r6", slot: { kind: "creature", pos: "bl" } }
      ]}
    },

    // Stage 3 — both hostile. C1 Forward Line, C2 Rear Camp. Both adjacent to the end node where
    // the boss summoner sits — pulled in to form a 3-location boss encounter.
    { id: "C1", x: 4, y: 1, biome: "Mountain", kind: "hostile",
      label: "Forward Line",
      contents: { aiPlacements: [
        { defKey: "r8", slot: { kind: "creature", pos: "fl" }, equipWith: ["r2"] },
        { defKey: "r3", slot: { kind: "creature", pos: "fr" }, equipWith: ["r11"] }
      ]}
    },
    { id: "C2", x: 4, y: 3, biome: "Mountain", kind: "hostile",
      label: "Rear Camp",
      contents: { aiPlacements: [
        { defKey: "r9", slot: { kind: "creature", pos: "fl" } },
        { defKey: "r1", slot: { kind: "creature", pos: "br" } }
      ]}
    },
    // End node — the boss summoner's seat. Sits behind C1/C2 on the map. Not pulled into the
    // T3 encounter; instead the boss is the AI summoner of T3, detected via end-adjacency on
    // the encounter's locations. Walking onto end after winning T3 ends the run.
    { id: "end", x: 5, y: 2, biome: "Mountain", kind: "end",
      label: "Boss's Seat",
      contents: null
    }
  ],
  edges: [
    // start → Stage 1
    ["start", "A1"], ["start", "A2"],
    // Stage 1 → Stage 2 (full bipartite)
    ["A1", "B1"], ["A1", "B2"],
    ["A2", "B1"], ["A2", "B2"],
    // Stage 2 → Stage 3 (full bipartite)
    ["B1", "C1"], ["B1", "C2"],
    ["B2", "C1"], ["B2", "C2"],
    // Stage 3 → end node. End is the boss's seat, connected to C1/C2 only. The boss is the
    // AI summoner for the T3 encounter (presence detected by any pulled-in node being adjacent
    // to an `end`-kind node — see loadEncounterFromPawn). End is not pulled into the encounter;
    // it sits behind C as the boss's spatial location and the run-win destination.
    ["C1", "end"], ["C2", "end"]
  ],
  startNode: "start",
  bossNode: "end"
};

// Per-color starter decks. Player picks one in the start menu; the AI uses the same list as
// the chosen color (custom AI decks land later).
export const DECKS = {
  red: ["r1", "r2", "r3", "r4", "r5", "r6", "r10", "r12", "r14"],
  green: ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"],
  // Blue: spread of the printed pool. b1 Apprentice (Insight engine), b2/b5 Keepers (token engines),
  // b3 Study (draw), b4 Spark (damage), b6 Mana Rock (aura), b7 Mirror Image (copy), b8 Tome Golem
  // (deck-top stack), b9 Spellbook (counter-equipment).
  blue: ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10"]
};

export function buildStartingDeck() {
  const key = state.deckKey || "red";
  return DECKS[key] ? [...DECKS[key]] : [...DECKS.red];
}
