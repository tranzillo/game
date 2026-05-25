import { CARD_DEFS } from "../data/cards.js";
import { LOCATION_COUNT } from "./config.js";

// ---------- State ----------
export function createCard(defKey, owner) {
  const def = CARD_DEFS[defKey];
  return {
    instId: nextInstId(),
    defKey,
    owner,
    name: def.name,
    type: def.type,
    cost: def.cost,
    costStat: def.costStat || "force", // legacy: single-stat cost (kept for display compatibility)
    // Unified cost shape: `{ force: 2, tempo: 1 }` etc. Built from def.costs (new shape) OR from
    // def.cost + def.costStat (legacy single-stat). Empty object = no cost.
    costs: def.costs ? { ...def.costs } : (def.cost > 0 ? { [def.costStat || "force"]: def.cost } : {}),
    force: def.force || 0,
    tempo: def.tempo || 0,
    insight: def.insight || 0,
    durabilityMax: def.durability,
    durability: def.durability, // current durability for creatures
    effect: def.effect,
    onFlipUp: def.onFlipUp,    // optional flip-up trigger effect key (see fireFlipUpTrigger)
    deathwish: def.deathwish || null, // Deathwish keyword: effect key fired when this leaves play.
    subtype: def.subtype || null, // For actions: "quest" marks persistent-action archetype.
    questKey: def.questKey || null, // For quests: identifies which quest definition is in play.
    ranged: def.ranged || false, // Ranged keyword: attacks from any row, consumes ammo per shot.
                                 // Ranged creatures cannot melee — they only fire (ammo-gated).
    ammoCost: def.ammoCost || 0, // For ranged creatures: ammo consumed per attack (printed as "Ammo N").
    forageCasts: 0, // Per-instance Forage cast counter (escalating cost). Resets at encounter end.
    mirrorCasts: 0, // Per-instance Mirror Image cast counter (escalating Insight). Resets per encounter.
    inert: def.inert || false, // Inert keyword: cannot gain Force/Tempo/Insight/Resolve
    pitFighterWhileAlone: def.pitFighterWhileAlone || false, // Pit-Fighter's while-alone flag
    provocationChallenger: def.provocationChallenger || false, // Challenger's while-vs-opposing flag
    apprenticeInsightFromActions: def.apprenticeInsightFromActions || false, // Apprentice's per-action Insight
    manaRockAura: def.manaRockAura || false, // Mana Rock: same-row same-side aura grants +1 Insight to neighbors
    spellbookPages: def.spellbookPages || 0, // Spellbook: page counter, destroyed at 0
    enraged: def.enraged || false, // Enraged keyword: +1 Force this turn per damage instance taken
    tribe: def.tribe || null,  // creature tribe (e.g., "goblin") — used by tribal-as-resource effects
    attackPatterns: def.attackPatterns ? [...def.attackPatterns] : [], // copied — equipment may mutate
    grantsAttackPatterns: def.grantsAttackPatterns || null, // equipment: patterns granted to host
    grantsStats: def.grantsStats || null, // equipment: stats granted to host (read by effectiveStat)
    equipment: [], // for creatures/structures: array of equipment attached to this host
    sleepCounter: 0,    // Sleeping keyword: turns remaining asleep. 0 = awake.
    wokeInPhase: null,  // phase name where damage woke this sleeper. Gates awake-actions (attack,
                        // move) while state.phase === wokeInPhase. Self-clears via the phase compare.
    flippedThisTurn: false, // true the turn a creature flips up; blocks movement that turn.
    skipAttackThisTurn: false, // set by Blizzard etc.; cleared at upkeep. Suppresses combat attack.
    meleeAttackersThisTurn: [], // instIds of creatures that dealt melee damage to this this turn.
                                // Read by Explosive Trap's deathwish. Reset at upkeep start.
    lastPos: null,      // last known position in a slot; recorded by fireLeavePlayTriggers so
                        // position-dependent leave-play effects (e.g., trap adjacency) work.
    marks: [],          // Marks system: per-instance permanent state. Each mark = { kind, side }.
                        // Persists through pile cycling and across encounters. Same-kind double
                        // mark = exile (handled in applyMark). Visible in all zones.
    text: def.text,
    aiHints: def.aiHints || {},
    revealed: true
  };
}

export let _instCounter = 0;
export function nextInstId() { return ++_instCounter; }

// Build a fresh per-location slot bundle. Each location holds its own creatures/structure/action,
// plus pending versions during a commit window, plus a per-location movement-tracker.
export function freshLocation() {
  return {
    creatures: { fl: null, fr: null, bl: null, br: null },
    structure: null,
    action: null,
    pending: {
      creatures: { fl: null, fr: null, bl: null, br: null },
      structure: null,
      action: null,
      // Equipment played from hand: keyed by host position (fl/fr/bl/br). Each entry is an array
      // of pending equipment cards for that host. Resolves on end-of-phase flip; fizzles to your-side
      // junkyard if the host is gone by then.
      equipment: { fl: [], fr: [], bl: [], br: [] }
    },
    movedThisTurn: new Set(),
    // Ammo stockpile for this side at this location. Resets to 0 per encounter ("the wilderness
    // is fresh" — per CARD_DESIGN.md). Forage adds; ranged creatures consume on attack.
    ammo: 0,
    // Per-location piles. The location itself owns these — when a creature dies on a side that
    // has no summoner present (non-boss AI encounters, neutral encounters), the body stays here
    // rather than vanishing into a global summoner pile. If a summoner later arrives, future
    // deaths route to the summoner pile, but the existing location piles are not retroactively
    // absorbed.
    piles: { graveyard: [], junkyard: [], exile: [] }
  };
}

export function freshSide(deckKeys, owner) {
  const locations = [];
  for (let i = 0; i < LOCATION_COUNT; i++) locations.push(freshLocation());
  return {
    durability: 20,
    deck: shuffle(deckKeys.map(k => createCard(k, owner))),
    hand: [],          // hand is global to the side
    discard: [],       // discard is global to the side
    graveyard: [],     // graveyard is global to the side
    junkyard: [],      // junkyard zone — structures and equipment that have left play
    exile: [],         // exile zone — torn-up cards (permanent stat-buff actions, etc.); cannot be recovered
    locations          // per-location committed/pending state lives here
  };
}

// Convenience accessor: side.locations[loc].
export function L(sideName, loc) { return state.sides[sideName].locations[loc]; }

// True iff the given side has a summoner conceptually present in this encounter.
// Player: always present (the player is the summoner). AI: present only at boss encounters.
// In a hostile (non-boss) AI encounter there is no AI summoner — the faction is a wave of
// pre-placed forces with no central commander, so their dead don't get scooped into a pile.
export function summonerPresent(sideName) {
  if (sideName === "player") return true;
  return state && state.encounterKind === "boss";
}

export let state = null;

export function setState(newState) {
  state = newState;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
