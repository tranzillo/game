// Card definitions.
// Each definition is a template; instances are created with createCard() in engine/state.js.
// `aiHints` is per-card metadata used by the AI scoring function (DECISIONS.md, AI architecture).
// CARD_DEFS uses flat shorthand keys per color: r1 through r12 for Red, with no
// starter/reward distinction in the keys — that distinction is just *which slice of the pool
// goes in the player's starting deck*. Other cards live at encounter locations until acquired.
// Multi-color cards use both letters (e.g., rb1 for Red/Blue). Display names on each def are
// for UI only and will change as the design firms; engine references stay stable as keys.
//
// Effect-handler tags (the strings in `effect` / `onFlipUp`) are *behavior tags*, not card-identity
// tags. Multiple cards can use the same effect tag if they share behavior; renaming a card key
// doesn't affect them.
export const CARD_DEFS = {
  // r1 — Free 1F/2D goblin. Flip-up: if alone on your side here, +1 Force.
  r1: {
    name: "Goblin Brawler",
    type: "creature",
    tribe: "goblin",
    cost: 0,
    force: 1,
    tempo: 0,
    durability: 2,
    onFlipUp: "loneChampionBrawler",
    text: "On flip-up: if this is the only creature on your side here, gain +1 Force.",
    aiHints: { preferFront: true }
  },
  // r2 — Free equipment. Grants cleave.
  r2: {
    name: "Crude Axe",
    type: "equipment",
    cost: 0,
    costStat: "force",
    force: 0,
    tempo: 0,
    durability: null,
    grantsAttackPatterns: [{ type: "cleave" }],
    text: "Equip. The wielder's attacks gain cleave.",
    aiHints: {}
  },
  // r3 — ≥1F ramp creature. 2F/3D. Flip-up: +1 Force this turn.
  r3: {
    name: "Orc Bruiser",
    type: "creature",
    cost: 1,
    costStat: "force",
    force: 2,
    tempo: 0,
    durability: 3,
    onFlipUp: "bruiserChargeBuff",
    text: "On flip-up: this gains +1 Force this turn.",
    aiHints: { preferFront: true }
  },
  // r4 — Recruit conversion verb. Action. Force-superiority swap on resolve.
  r4: {
    name: "Recruit",
    type: "action",
    cost: 0,
    costStat: "force",
    force: 0,
    tempo: 0,
    durability: null,
    effect: "recruitConversion",
    text: "If you have more Force here, a creature in front on the other side moves to the front on your side.",
    aiHints: {}
  },
  // r5 — ≥1F payoff creature. 1F/4D, +2F while alone on your side here.
  r5: {
    name: "Ogre Pit-Fighter",
    type: "creature",
    tribe: "ogre",
    cost: 1,
    costStat: "force",
    force: 1,
    tempo: 0,
    durability: 4,
    pitFighterWhileAlone: true,
    text: "+2 Force here while no other creature on your side is here.",
    aiHints: { preferFront: true }
  },
  // r6 — Free 1F/2D goblin. Flip-up: if alone on your side here, fire Recruit.
  r6: {
    name: "Goblin Recruiter",
    type: "creature",
    tribe: "goblin",
    cost: 0,
    force: 1,
    tempo: 0,
    durability: 2,
    onFlipUp: "recruiterAloneRecruit",
    text: "On flip-up: if this is the only creature on your side here, recruit.",
    aiHints: { preferFront: true }
  },
  // r7 — ≥1F goblin. Flip-up: push the creature across to back row. Isolation tool for r4.
  r7: {
    name: "Goblin Bully",
    type: "creature",
    tribe: "goblin",
    cost: 1,
    costStat: "force",
    force: 1,
    tempo: 0,
    durability: 2,
    onFlipUp: "bullyPush",
    text: "On flip-up: push the creature across from this from front to back.",
    aiHints: { preferFront: true }
  },
  // r8 — ≥1F goblin. Enraged: +1 Force this turn each time it takes damage this turn.
  r8: {
    name: "Goblin Berserker",
    type: "creature",
    tribe: "goblin",
    cost: 1,
    costStat: "force",
    force: 1,
    tempo: 0,
    durability: 3,
    enraged: true,
    text: "Enraged. *(Gains +1 Force this turn each time it takes damage this turn.)*",
    aiHints: { preferFront: true }
  },
  // r9 — ≥2F Ogre with Provocation. +1F per opposing creature here; opposing creatures here gain +1F.
  r9: {
    name: "Ogre Challenger",
    type: "creature",
    tribe: "ogre",
    cost: 2,
    costStat: "force",
    force: 1,
    tempo: 0,
    durability: 3,
    provocationChallenger: true,
    text: "+1 Force per creature on the other side here. Creatures on the other side here gain +1 Force.",
    aiHints: { preferFront: true }
  },
  // r10 — ≥1F action. Deal 1 damage to a creature on your side here; that creature +1F this turn.
  r10: {
    name: "Battle Driver",
    type: "action",
    cost: 1,
    costStat: "force",
    force: 0,
    tempo: 0,
    durability: null,
    effect: "battleDriver",
    text: "Deal 1 damage to a creature on your side here. That creature gains +1 Force this turn.",
    aiHints: {}
  },
  // r11 — ≥1F equipment. Grants pierce 1.
  r11: {
    name: "Goblin Pike",
    type: "equipment",
    cost: 1,
    costStat: "force",
    force: 0,
    tempo: 0,
    durability: null,
    grantsAttackPatterns: [{ type: "pierce", value: 1 }],
    text: "Equip. The wielder's attacks gain pierce 1.",
    aiHints: {}
  },
  // r12 — ≥1F action. Sacrifice a goblin on your side here; deal damage equal to Force here.
  r12: {
    name: "Goblin Bombardment",
    type: "action",
    cost: 1,
    costStat: "force",
    force: 0,
    tempo: 0,
    durability: null,
    effect: "goblinBombardment",
    text: "Sacrifice a goblin on your side here. Deal damage equal to your Force here.",
    aiHints: {}
  },
  // r13 — Action used as Champion's Rest content. +1 Force permanently; tear up this card on resolve.
  r13: {
    name: "Proof of the Champion",
    type: "action",
    cost: 0,
    costStat: "force",
    force: 0,
    tempo: 0,
    durability: null,
    effect: "permPlus1ForceHere",
    text: "A creature here gains +1 Force permanently. Tear up this card.",
    aiHints: {}
  },
  // r14 — Warbanner. Structure printing 1 Force at the location. Structures don't take combat
  // damage; removed only by named effects.
  r14: {
    name: "Warbanner",
    type: "structure",
    cost: 0,
    costStat: "force",
    force: 1,
    tempo: 0,
    durability: null,
    text: "+1 Force here.",
    aiHints: {}
  },
  // g2 — Pathfinder. 0F/2T/2D off-pattern creature, no tribe. Deathwish drops a Bad Intel quest
  // token into the action slot. The quest watches for the next flip-up here and marks that card
  // for Reroute (sending it to the player's pile on its eventual leave-play). Theme: an outsider
  // feeding misinformation; in death, the bad intel still lands.
  g2: {
    name: "Pathfinder",
    type: "creature",
    cost: 0,
    costStat: "tempo",
    force: 0,
    tempo: 2,
    durability: 2,
    deathwish: "dropQuest_badIntel",
    text: "Deathwish: drop a Bad Intel quest into your action slot here.",
    aiHints: {}
  },
  // g5 — Rebel Outrider. Compound-cost ramp creature: ≥2F AND ≥1T. 2F/2T/3D. The compound gate
  // is the design point — it ties Force and Tempo together, pushing two-stat presence.
  // Flip-up stealths same-row-adjacent friendlies, re-flipping them for a second flip-up trigger.
  g5: {
    name: "Rebel Outrider",
    type: "creature",
    tribe: "rebel",
    costs: { force: 2, tempo: 1 },
    force: 2,
    tempo: 2,
    durability: 3,
    onFlipUp: "stealthRowAdjacentFriendlies",
    text: "Flip-up: stealth friendly creatures in the same row.",
    aiHints: { preferFront: true }
  },
  // g4 — Rebel Slinger. Ranged. 1F/1T/2D. Fires from any row; needs 1 ammo per shot from this
  // side's stockpile at this location. Ranged-only: never melees. Forage feeds the stockpile.
  g4: {
    name: "Rebel Slinger",
    type: "creature",
    tribe: "rebel",
    cost: 0,
    costStat: "tempo",
    force: 1,
    tempo: 1,
    durability: 2,
    ranged: true,
    ammoCost: 1,
    text: "Ranged (consumes 1 ammo per shot from this side's stockpile here).",
    aiHints: {}
  },
  // g6 — Forage. Action: add 1 ammo to your stockpile here. Cost: 0 base, escalating +1 Tempo
  // for each previous cast of this same card-instance this encounter. Counter resets per encounter.
  g6: {
    name: "Forage",
    type: "action",
    cost: 0,
    costStat: "tempo",
    force: 0,
    tempo: 0,
    durability: null,
    effect: "forageAddAmmo",
    text: "Add 1 ammo to your stockpile here. Each subsequent cast of this card needs +1 Tempo here (this encounter).",
    aiHints: {}
  },
  // g1 — Rebel Scout. Cheap deathwish: relocate one of your creatures from elsewhere to this slot.
  g1: {
    name: "Rebel Scout",
    type: "creature",
    tribe: "rebel",
    cost: 0,
    costStat: "force",
    force: 1,
    tempo: 1,
    durability: 2,
    deathwish: "moveFriendlyHere",
    text: "Deathwish: move a friendly creature from another location to this slot.",
    aiHints: {}
  },
  // g3 — Rebel Sapper. Force ramp; deathwish plants a trap on your front row here.
  g3: {
    name: "Rebel Sapper",
    type: "creature",
    tribe: "rebel",
    cost: 1,
    costStat: "force",
    force: 1,
    tempo: 0,
    durability: 2,
    deathwish: "dropTrapFront",
    text: "Deathwish: drop a token Explosive Trap to your front row here.",
    aiHints: { preferFront: true }
  },
  // g7 — Rebel Runner. Flip-up sends a friendly creature here to another location. Repositions.
  g7: {
    name: "Rebel Runner",
    type: "creature",
    tribe: "rebel",
    cost: 0,
    costStat: "tempo",
    force: 1,
    tempo: 1,
    durability: 3,
    onFlipUp: "sendFriendlyAway",
    text: "Flip-up: move a friendly creature here to another location.",
    aiHints: {}
  },
  // g8 — Rebel Saboteur. Flip-up plants a trap on the opposing front row here.
  g8: {
    name: "Rebel Saboteur",
    type: "creature",
    tribe: "rebel",
    cost: 1,
    costStat: "force",
    force: 1,
    tempo: 1,
    durability: 2,
    onFlipUp: "dropTrapOpposingFront",
    text: "Flip-up: drop a token Explosive Trap to the opposing front row here.",
    aiHints: {}
  },
  // Explosive Trap (g_trap). Token-only — created by g3 deathwish and g8 flip-up. Inert.
  // Deathwish: deal 2 damage to same-side adjacent creatures + creatures that dealt melee damage
  // to this trap this turn.
  g_trap: {
    name: "Explosive Trap",
    type: "creature",
    inert: true,
    cost: 0,
    costStat: "force",
    force: 0,
    tempo: 0,
    durability: 1,
    deathwish: "explosiveTrap",
    text: "Inert. Deathwish: deal 2 damage to adjacent friendlies and any creature that melee'd this on this turn.",
    aiHints: {}
  },
  // b1 — Magus Apprentice. Fragile 1-Durability creature that prints +1 Insight here per action
  // this side has resolved this turn. The history-tracking engine that defines Blue's identity.
  b1: {
    name: "Magus Apprentice",
    type: "creature",
    cost: 0,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: 1,
    apprenticeInsightFromActions: true,
    text: "+1 Insight here for each action you've resolved this turn.",
    aiHints: {}
  },
  // b3 — Study. Action: draw 1. Also counts as an action played this turn, feeding Apprentice's
  // Insight (so Study and Apprentice ramp together).
  b3: {
    name: "Study",
    type: "action",
    cost: 0,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: null,
    effect: "study",
    text: "Draw 1.",
    aiHints: {}
  },
  // b2 — Keeper of the Flame. Fragile flip-up engine: summons a Fire Golem token in front + adds
  // a Pyroblast action token to your discard. If the slot in front is occupied, the entire
  // flip-up fizzles.
  b2: {
    name: "Keeper of the Flame",
    type: "creature",
    cost: 0,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: 1,
    onFlipUp: "keeperFlame",
    text: "Flip-up: summon a Fire Golem token in front of this; add a Pyroblast token to your discard pile.",
    aiHints: {}
  },
  // b5 — Keeper of the Font. Same shape as b2 but the water variant.
  b5: {
    name: "Keeper of the Font",
    type: "creature",
    cost: 0,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: 1,
    onFlipUp: "keeperFont",
    text: "Flip-up: summon a Water Golem token in front of this; add a Blizzard token to your discard pile.",
    aiHints: {}
  },
  // b4 — Spark. ≥1 Insight. Deal 1 damage to a creature on the other side here.
  b4: {
    name: "Spark",
    type: "action",
    costs: { insight: 1 },
    cost: 1,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: null,
    effect: "spark",
    text: "Deal 1 damage to a creature on the other side here.",
    aiHints: {}
  },
  // b6 — Mana Rock. Inert 0/0/2D. Same-side, same-row creatures gain +1 Insight (aura).
  // Inert: can't be equipped, can't gain stats.
  b6: {
    name: "Mana Rock",
    type: "creature",
    cost: 0,
    costStat: "insight",
    inert: true,
    force: 0,
    tempo: 0,
    insight: 0,
    durability: 2,
    manaRockAura: true,
    text: "Inert. Creatures in the same row gain +1 Insight.",
    aiHints: {}
  },
  // b7 — Mirror Image. Escalating +1 Insight per cast of this instance per encounter. Add a
  // token copy of any face-up creature here (either side) to your discard.
  b7: {
    name: "Mirror Image",
    type: "action",
    cost: 0,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: null,
    effect: "mirrorImage",
    text: "Add a token copy of a creature here to your discard. Each subsequent cast of this card needs +1 Insight here (this encounter).",
    aiHints: {}
  },
  // b8 — Tome Golem. 2F/2D Golem creature. At start of cleanup, the leftmost action in your
  // hand goes on top of your draw pile (Resolve-bypass for one action per turn).
  b8: {
    name: "Tome Golem",
    type: "creature",
    tribe: "golem",
    cost: 0,
    costStat: "insight",
    force: 2,
    tempo: 0,
    insight: 0,
    durability: 2,
    text: "At the start of cleanup, put the leftmost action in your hand on top of your draw pile.",
    aiHints: {}
  },
  // b9 — Spellbook. ≥1 Insight equipment. 3 pages. When an action on the other side flips at
  // this location, the spellbook loses 1 page and adds a copy of that action to your discard.
  // At 0 pages the spellbook is destroyed (junkyard).
  b9: {
    name: "Spellbook",
    type: "equipment",
    costs: { insight: 1 },
    cost: 1,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: null,
    spellbookPages: 3,
    text: "Equip. 3 pages. When an opposing action flips here: lose 1 page; add a copy of that action to your discard. At 0 pages: destroyed.",
    aiHints: {}
  },
  // Token creature defs — created dynamically by Keeper flip-ups. Not in any deck.
  b_fire_golem: {
    name: "Fire Golem",
    type: "creature",
    tribe: "golem",
    cost: 0,
    costStat: "insight",
    force: 3,
    tempo: 0,
    insight: 0,
    durability: 1,
    text: "",
    aiHints: {}
  },
  b_water_golem: {
    name: "Water Golem",
    type: "creature",
    tribe: "golem",
    cost: 0,
    costStat: "insight",
    force: 1,
    tempo: 0,
    insight: 0,
    durability: 3,
    text: "",
    aiHints: {}
  },
  // Token action defs — added to discard by Keeper flip-ups. Exile on resolve (token rule).
  b_pyroblast: {
    name: "Pyroblast",
    type: "action",
    costs: { insight: 2 },
    cost: 2,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: null,
    effect: "pyroblast",
    text: "Deal 1 damage to each creature on the other side here.",
    aiHints: {}
  },
  b_blizzard: {
    name: "Blizzard",
    type: "action",
    costs: { insight: 2 },
    cost: 2,
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: null,
    effect: "blizzard",
    text: "A creature in the front on the other side at each location does not attack this turn.",
    aiHints: {}
  },
  // b10 — Magus of Echoes. 1F/0T/2D creature. Flip-up: add a token copy of a random action
  // from The Past to your discard. The Past is shared (both sides); the Magus can copy your
  // own actions or the opponent's. (Recall as a keyword — "trigger an action from the past
  // ignoring its requirements" — is reserved for a future premium card; this is the cheaper
  // copy-to-discard variant.)
  b10: {
    name: "Magus of Echoes",
    type: "creature",
    costs: { insight: 2 },
    costStat: "insight",
    force: 0,
    tempo: 0,
    insight: 0,
    durability: 1,
    onFlipUp: "echoFromPast",
    text: "Flip-up: add a token copy of a random action from the past to your discard.",
    aiHints: {}
  }
};
