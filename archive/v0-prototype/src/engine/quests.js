import { L, nextInstId } from "./state.js";
import { LOCATION_COUNT, LOC_NAMES } from "./config.js";
import { logEntry } from "./log.js";
import { applyMark, sendToPile } from "./marks.js";
import { appendToPast } from "./timeline.js";

// ---------- Quest definitions ----------
// Quest is a persistent-action archetype. The card defines a `questKey` pointing here, and the
// engine handles the completion-watch and reward-resolve via this registry. A quest can also be
// created as a token (no card def needed) — see createQuestToken below.
//
// Each quest def declares:
//   - name, text: display
//   - checkCompletion(quest, side, loc, event): returns true to complete on this trigger
//   - reward(quest, side, loc): fires when complete; the quest then exits the slot
//   - events: list of trigger kinds the quest listens for (e.g., ["flipUp"])
export const QUEST_DEFS = {
  // Bad Intel — Pathfinder's deathwish token. Watches for any card flipping up at this location;
  // marks that card for reroute (Green's conversion). One-shot: completes on first flip-up.
  badIntel: {
    name: "Bad Intel",
    text: "When a card flips up here, mark it for reroute. (Token — exiles on completion.)",
    events: ["flipUp"],
    checkCompletion: function(quest, side, loc, event) {
      return event.kind === "flipUp" && event.loc === loc;
    },
    reward: function(quest, side, loc, event) {
      applyMark(event.card, "reroute", side);
    }
  }
};

// Create a quest token. defKey is optional — token quests don't need a CARD_DEFS entry. The
// returned card has type="action", subtype="quest", isToken=true, questKey set.
export function createQuestToken(questKey, owner) {
  const qd = QUEST_DEFS[questKey];
  if (!qd) return null;
  const card = {
    instId: nextInstId(),
    defKey: `quest_${questKey}`,
    owner,
    name: qd.name,
    type: "action",
    cost: 0,
    costStat: "force",
    force: 0,
    tempo: 0,
    insight: 0,
    durabilityMax: null,
    durability: null,
    effect: null,
    onFlipUp: null,
    deathwish: null,
    subtype: "quest",
    questKey,
    inert: false,
    pitFighterWhileAlone: false,
    provocationChallenger: false,
    enraged: false,
    tribe: null,
    attackPatterns: [],
    grantsAttackPatterns: null,
    grantsStats: null,
    equipment: [],
    sleepCounter: 0,
    wokeInPhase: null,
    flippedThisTurn: false,
    marks: [],
    text: qd.text,
    aiHints: {},
    revealed: false,
    isToken: true
  };
  return card;
}

// Check all active quests in play; if any completes on the given event, resolve its reward and
// exit it from the slot. Called from event-firing sites (flip-up, etc.).
export function checkQuestsForEvent(event) {
  for (const sideName of ["player", "ai"]) {
    for (let loc = 0; loc < LOCATION_COUNT; loc++) {
      const lc = L(sideName, loc);
      const q = lc.action;
      if (!q || q.subtype !== "quest" || q.revealed === false) continue;
      const qd = QUEST_DEFS[q.questKey];
      if (!qd || !qd.events.includes(event.kind)) continue;
      if (!qd.checkCompletion(q, sideName, loc, event)) continue;
      // Quest completes — fire reward, then exit slot (tokens exile, non-tokens discard).
      logEntry(`  ${q.name} (${sideName} @${LOC_NAMES[loc]}) — Quest complete.`, "combat-detail");
      qd.reward(q, sideName, loc, event);
      // Quest reward firing is an action resolution — log it to The Past.
      appendToPast(q, sideName, loc);
      lc.action = null;
      sendToPile(q, sideName, "discard");  // tokens auto-route to exile via sendToPile
    }
  }
}
