# Rebuild plan

The contract for v1 of the game. Built together via Q&A — each section captures the user's literal statements, not AI inference. Old docs (DESIGN.md, DECISIONS.md, CARD_DESIGN.md, ARCHITECTURE.md, etc.) are reference material from earlier conversations; they contain a mix of user decisions and AI elaboration and are not authoritative. This doc is.

Capture discipline:
- Only the user's literal answers go into the body of a section.
- AI clarifying questions and their answers are recorded as Q/A.
- If a question is partially answered, the unanswered part stays as an open question.
- AI does not synthesize, elaborate, or fill in.

---

## Section index (built incrementally)

1. Player experience — moment to moment
2. (open)

---

## 1. Player experience — moment to moment

### The kinds of decisions per turn

The player is potentially making decisions in every phase of the game, but certain phases are designed to be much more "crowded" with events and state changes. The rules make it so cards can be played in any phase, but certain card types that involve adding permanents to the gameboard (creatures, structures, equipment — things that "live" and exist in the world and through time) can only be played from hand during the **main** phase. The other phases around the main phase affect the player in more meta ways, like drawing and discarding, or may affect the board state, like upkeep and combat. Each of the phases has different scopes that impact the game in different ways.

Actions are an important card type in that they should be playable in any phase, because they have a different kind of scope from the other permanent card types. They don't exist through time like the other cards. They represent a single moment in time where an event occurs. When they "happen" in the game (when they're put in play), they act like every other card in that they flip up, but when they do, they do not stay in play like other cards — they resolve immediately, and they go to the discard pile rather than the graveyard like a creature would when it leaves play. So actions-as-events can be played over and over again, but permanents enter and stay in play until they are destroyed, at which point they go to a pile outside the draw/discard cycle.

The bulk of the interaction happens in the main and combat phases where all the user's decisions about the implications of the board state around movement and placement of creatures live. Combat is all about positioning: you have to position your board optimally through playing cards and shifting their position to optimize combat damage, protection, and to fulfill future targeting requirements for ally effects and avoid enemy effects.

In **main** you are really "setting up" the turn by moving things and putting things into play in specific optimal locations. The cards you play flip up, as do the opponent's. Their effects trigger or don't. Then you have one last chance to position and commit an action before the most important automated "scene" occurs: the automated combat that has to feel paced and satisfying — your decisions playing out.

After combat is the **upkeep** step where you have one last chance to play an action and then are forced to discard. Then the next turn's upkeep...

### The dominant visual

It should feel like one cohesive ecosystem where cards move from visible piles on screen, from the draw pile to hand to board, seamlessly. Every card in the game needs to be something you can see, represented in the UI even if it's face down in a pile. The timeline should surround the board and be presented as part of it. The chips which represent cards should also persist in the same way cards do and feel part of the board the cards are sitting on.

### Active vs. watched events

The player watches things resolve. The player never does anything directly other than play cards into slots. The only expression of play is putting cards in slots and committing, and then moving those cards around in those slots. It's literally all you do. There's no choosing anything except dragging cards to legal slots. When cards flip up when they come into play they may do something, and when things are on the board, they may attack each other during the combat phase. That's it.

### Pacing of automated scenes

It's the speed we decide feels right. It should be possible to tune the timing and expose that to the player as an option, but not a huge concern.

### Phase structure

Phases are not always in the same order every turn — there are special exceptions caused by the text on cards or locations we print.

The player explicitly advances phases, but only if they have legal plays they could make. Cards that could be played should show that visually, and if the player interacts with a card they should see the legal slots where it could be played visually indicated.

The "one last chance to play an action before combat / before cleanup" framing isn't separate phases. Think of the phase cycle as the narrative arc of a day. Each turn is a day: you get up, draw a hand, see your options, make your decisions, see the outcomes, and throw away what's leftover. At cleanup you need to play a card you have if you can, unless you'd rather just discard it.

### Input mechanism

Both drag and click-to-target / click-to-select interactions exist. The player can undo a placement before committing. To commit, they play cards, then click a button to go to the next phase.

---

## 2. The encounter

### What it is

Encounters are the part of the game where players play the cards. They consist of locations which directly represent each overworld node connected to the player's current position.

### Start and end conditions

An encounter starts when the player enters a new node on the overworld. It ends when there are no creatures left on the other side of the board at any location.

### Between encounters

The player chooses the next connected consecutive node to travel to.

### Composition

Encounters can be opponent (boss), neutral, or a mix — all of these.

### Locations in the encounter

The encounter's locations are the connected NEXT nodes — the nodes the player could travel to from their current position. The current node itself is NOT a location in the encounter.

### Where the summoner sits

The summoner is conceptually "behind" the encounter, at the most recently traversed node — the node connected to all the locations. The player is pulling the strings from that nearest connected location they've already traveled to. The supply-line mechanic (where cards present on previously traversed connected nodes can impact the location you're currently on) enforces this.

The player views the locations in the encounter from the perspective of the node they just got to.

The screen layout maintains the overworld's shape during the encounter:
- The player's durability, hand, piles, and any ongoing supply-line effects sit at the **bottom** of the screen, below the locations in the encounter — because the player-summoner is "behind" the front line.
- If a boss is present, they sit **above** the locations, maintaining the same consistency. The boss always sits on the exit node.

### Win condition

- No boss present → clear the board (no creatures left on the other side at any location).
- Boss present → reduce the boss summoner to 0 Durability. The boss is a stand-in for a thinking opposition; they play by the same rules the player does.

### Travel between encounters

After the encounter ends, the player moves to one of the locations from that encounter. That node becomes the new current node. The next encounter's locations are the nodes connected to it.

Clearing is not destroying. Acquisition mechanics let the player build their deck by taking cards from neutral locations or the opponent's deck through gameplay. Players can also lose or intentionally cut cards this way. But clearing the way is the only way the player can continue.

### How the boss plays during a run

The boss plays cards every turn the player does, just not always at the same locations the player is interacting with. There is meant to be a natural flow: the player starts on one side, the boss on the other. Both play cards at neutral adjacent locations. The player moves; the boss does not. Instead the boss can play cards at any location where it has an adjacent presence. The player builds a supply line out; the boss builds one back to it; the two start clashing around the middle.

### Supply lines and persistent permanents

Committed permanents at previously-traversed nodes stay active and can affect the current encounter. This is a fundamental part of the game that has been discussed extensively but has not been built yet. Structures specifically are not supposed to get shuffled back into the deck when the encounter ends — they stay on the board, and if they are scoped, their text can be relevant when on connected nodes.

### Open follow-ups

- Boss turn cadence vs. player turn cadence — does the boss play a turn for every player turn, even when the player isn't at a location adjacent to the boss's seat? Or only during encounters that include a boss-adjacent location?
- When the boss plays cards at a location the player is NOT currently encountering, does the player see/hear about it? How does that information flow?
- Player creatures vs. structures vs. equipment between encounters — creatures presumably leave play and shuffle back (cycle), but structures persist. What about equipment? What about creatures wielding equipment?
- Acquisition: how does a player take a card from a neutral location vs. from the opponent's deck? Mechanically what's the verb?
- Losing/cutting cards intentionally — what's the mechanic?
- A player who chooses to not engage (no creatures on either side, can they just travel)? Or is engagement forced once they enter a node?

---

## 3. The overworld

### What it is

The overworld is a map. On the map there are a network of connected nodes with one start and a number of exits, with opposing summoners at those exits, based on the floor number the player is on.

- Floor 1: 1 exit with 1 opposing summoner.
- Floor 2: 2 exits with 2 opposing summoners.
- The idea is that game difficulty scales by pressuring the player sooner when the spread starts from 2 locations.

### Node meaning

A node represents a location in an encounter.

### Run size

Dozens of nodes per floor, maybe 20. Any number of floors.

### The boss / opposing summoner — practical model

The player can't see beyond the "fog" of the locations they are connected to. The opposing summoner being a continuously-playing AI building a supply line is the *experiential* model. It can be **faked** through authored locations — the player shows up and sees what's next to them but not before they arrive, so the result is just "cards at a location" and we can author that experience instead of actually building the spreading AI. Randomness in node authoring will be important.

Locked for v1: the AI plays only at encounters where it has presence. It does NOT simulate off-screen turns at nodes the player isn't at.

### Why every node is a fight

"What happens at a node that isn't a fight" is the wrong framing. Every node requires clearing the board. How the player clears it is their choice — they can move things to their side, or remove things in some way. Once clear, they can move ahead.

### Hostile vs. neutral encounters

When an opposing summoner is present at the encounter, an AI opponent is actually playing cards in real time — this is a **hostile** encounter. When no opposing summoner is present, the encounter is **neutral**: the location's contents were pre-authored or pre-populated, but no AI is taking turns.

The opposing summoner sits at an exit node — they're a summoner like the player, meant to be defeated by the same rules the player plays by. Boss encounters are a special encounter type in that sense.

The AI does not actually need to "spread" on the overworld between player visits. There's no reason to simulate encounters where the player is not present. Instead, the outcome of off-screen progress can be imagined — pre-authored content at locations represents what the AI "would have" placed during off-screen turns. Whether v1 keeps this fully pre-authored or eventually models real spreading is an open question.

### How clearing works

The encounter is cleared when every creature slot on the opposing side at every location in the encounter is empty. The player can clear by:

- Combat damage that destroys creatures (sending them to the graveyard pile)
- Other effects that move cards out of slots into other piles
- Moving opposing cards to the player's own side (deckbuilding via acquisition — Recruit/Convert/Stealswap-style verbs)

"Empty creature slots" is the win condition — any mechanism that empties the slots works, not just killing.

### Floor progression

A floor is cleared when the player reaches an exit. The presence of multiple exits on higher floors increases difficulty by doubling the opposing resources against the player from 2 opponents.

### Open follow-ups

### Between-floor persistence

Everything persists between floors. Deck, durability, structures on the map, marks on cards — all carry forward.

### Map randomness

The randomness is in the neutral encounters.

### Open follow-ups

- Multiple-summoner floor mechanics — when 2 opposing summoners are at 2 exits, do they both play during the same encounter? Or only one AI is active at a time depending on which side of the map the player is on?
- A neutral encounter with a single creature on the other side: is that still "neutral" (no opposing summoner), or does any opposing presence make it hostile?

---

## 4. Things confirmed by the prototype

The following high-level decisions in the prototype reflect collaborative work and the user's intent — they are not AI extrapolation:

- **Stats:** Force / Tempo / Insight / Resolve / Spite — as named, as wired in.
- **Phases:** the phase order and rough scope of each (upkeep, draw, main, combat, cleanup).
- **Combat:** the automated scene with positioning, Tempo-ordered attacks, front-row-targets-front-row, fall-through to summoner, damage destroying creatures.
- **Colors:** Red / Green / Blue / White / Black — the identities and rough mechanical archetypes as expressed by the implemented cards and references in the prototype.

This is a pointer, not a re-statement. When the rebuild plan reaches the implementation stage, these are pulled from the prototype as-built rather than re-derived from the old DESIGN.md / DECISIONS.md (which mixes user decisions with AI elaboration).

**What is NOT confirmed and needs case-by-case verification:**
- Specific card rules text and behaviors (need pass-through with user)
- Anything claimed by old docs to be "locked" — needs user confirmation before being treated as a constraint
- Anything I extrapolated beyond what was implemented in the prototype

---

## 5. Deckbuilding via acquisition

The mechanism is built and works. Acquisition verbs are generally available to the player in every encounter. Neutral encounters lean toward making it easier to add new cards, cut cards, or buff cards.

The blocker for richer expression is content — there are not many printed cards yet.

---

## 6. Persistence (between encounters and between floors)

Cards in your deck stay in your deck until they leave your deck. All of this happens in encounters.

Effects can change card stats and text, but the **scope is always explicit**:
- This turn
- This encounter (the default, unsaid condition)
- Permanently
- (Other scopes as printed)

---

## 7. Map-level persistence and supply lines

Cross-encounter persistence exists, and it lives **outside the deck**.

### What persists on the map

**Structures** stay on the map even when the player leaves. All other card types — creatures, equipment, actions — get shuffled back into the player's deck to be played again in the future.

### How the supply line works

Structures create a supply line by staying at locations *linked* to the player's current location — not just immediately adjacent. The path the player has travelled and the structures they left behind impact them as long as:
1. The structures in the line are **scoped** to be relevant, AND
2. The player is standing at a node *in the line*.

### One-way travel

The player can't go back. There can never be another encounter at a previous location.

### Deckbuilding side effect

Past locations can cut a card from the player's deck and add a persistent buff. In that sense, the deckbuilding effects of past encounters persist — but the *only* live cross-encounter map-state being remembered is what structures were "left" at past nodes, so their text can be applied if appropriate.

### Scope of linked structures

A structure being in the linked chain back to the player's current node is necessary but not sufficient for it to apply. Its **printed scope** also has to be relevant. A structure with text scoped to "here" was only relevant during the encounter it was played in — it's still in the chain but doesn't reach the player now. A structure with broader scope (e.g., a supply-line keyword) is what makes the chain meaningfully reach forward.

### Symmetric supply lines

Boss-side structures persist on the map the same way the player's do. The opposing summoner has their own supply line stretching from the exit node forward through locations they've established presence at. The player needs to disrupt the opposing supply line by removing structures they encounter, powering down the opponent before the player arrives at the exit.

---

## 8. Card data shape

Card data shape is well-established from the prototype. Specific details for v1 are pulled from the prototype as built, except for the open follow-ups below.

### Effect dispatch (string-tag, AI decision)

Effects are dispatched by **string tag**, as the prototype does. `def.effect = "spark"`, `def.onFlipUp = "keeperFlame"`, etc. A dispatcher function looks up the tag and runs the corresponding JS code. New cards either reuse existing tags or add a new tag + handler.

Rationale: data-driven effects look cleaner but require designing the effect grammar up front, which is premature for a game still finding its mechanics. String tags let you write a card's behavior in plain JS the first time, then notice patterns and extract them to data later if they repeat. This matches the design discipline of "print cards, see what works, refactor later" rather than locking a content schema before content exists.

### Card instances vs. defs

Same distinction as prototype: CARD_DEFS as templates, runtime instances with instId and mutable state.

### Per-card progression (XP / levels)

In scope for v1. Card defs gain a progression curve; instances carry xp and level. Stat changes per level apply via the same layered-read pattern as conditional buffs. Persistence per the prototype's mods-on-runDeckEntry mechanism.

---

## 9. The Past / Future timeline

### What writes to the timeline

Any time any card flips up, it enters the past. Any time a card flips down, it enters the future. The most common way to enter face-down is from hand, but other effects can cause a face-down card in play. When this happens, it flips up by the rules of the game and goes from future, to present, to past, as it goes from face-down to face-up.

The "resolveAction writes to the past" framing in the prototype is confusing and incorrect. Quest reward firing should not write to the past either — that was an extrapolation.

### One unified timeline

The chip stream IS the past. There is one timeline of every face-down → face-up event, covering all card types. Verbs that target a specific subset (e.g., Blue's "copy an action from the past") filter by type at lookup time. There is no separate action-only log.

### Targeting the Past and Future

(These systems were discussed and the docs are correct for them — pull from existing docs at implementation time.)

---

## 10. Slot profiles

### Scope

Locked: rectangular grids up to 3×3 with locked cells, per-kind grids (creatures / structures / actions).

### Symmetry

Both sides of a location always use the same profile.

### Where profiles live

Profiles are paired with the location-text key. The location-text definition carries the profile.

---

## 11. Marks

### Same-kind double mark = exile

Confirmed for v1.

### Marks on tokens

Tokens can be marked while in play. Marks-leak-through-fog applies the same way.

### Mark visibility

Marks leak through fog of war — visible on face-down opposing cards.

### v1 mark set

Red (damage), Green (reroute), White (convert) — as the prototype currently has. Blue and Black marks are not part of v1; they're still being designed.

---

## 12. Visual ecosystem

### Pile visibility

Only the player's piles are visible on screen. Both **junkyard** and **graveyard** and **trash** are real, distinct, and important — each is its own pile. (The "exile" name from the prototype maps to "trash" — same concept.)

### Card identity in piles

Strict reading: every individual card is a discrete UI element somewhere — including cards in piles, even face-down ones. The deck (face-down pile) renders such that order is hidden — the player can't see the identity of cards from the top down. But **marked cards have their marked edges visible even face-down in the pile** — you don't see the card's identity, just that a marked card is N from the top.

Piles for cards that have already left play (graveyard, junkyard, trash) are **face-up** — their identities are visible.

### Spatial layout

What's there now is the right shape:
- **Future** chips along the top
- **Past** chips down the side edge
- **Narrative log** and user controls (next-phase button, etc.) below the board
- All part of a single cohesive board element

### Opposing summoner UI

The opposing summoner's durability and identity are shown. No piles.

### Pile layout

Reference the prototype's pile layout shape.

---

## 13. Architecture — click-to-state path

### Hand card click

The player clicks a card in their hand. The card lights up (selected). The legal target slots at each location light up.

---

## 14. Architecture — placement and commit

### Slot click after card selection

The card transitions from the player's hand onto the board, into the chosen slot. It's visually represented as a **ghostly temporary version** while the player is planning the play — not yet committed.

### Commit

The player commits by advancing phases. At that moment, all ghostly cards flip face-down and become "real" (committed to play).

### Flip-up resolution

Then each card flips up in rules order: by Tempo, then commit order.

---

## 15. Architecture — flip-up beat

### What the player sees

The card is face-down on the board. A chip represents it in the future strip. The chip's position in the future strip matches the flip order — high-Tempo / next-to-resolve chips are closer to the present node, lower priority farther away.

When a card's chip reaches the present, the card flips face-up on the board, and its chip falls into the past column.

If the card has a trigger on flip, the relevant animation fires on the card after it's face-up.

---

## 16. Architecture — combat phase

### Attack order

Creatures with a Force value attack in Tempo order: left to right, top to bottom, per location, left to right.

### Attack animations

- **Melee attacks**: the attacking creature gets a distinct animation where it "crashes" into the opposition it's attacking.
- **Ranged attacks**: a different animation that does NOT crash into the target.
- **Taking damage**: creatures trigger an animation when their durability is affected by combat.

### Pacing

Each card gets a moment to do its thing, in sequence, at a pace that's legible to the player.

### Cascading triggers

The effects of combat may result in a complex chain of triggers, each with animations — e.g., a deathwish that adds a token to play. As a result, each attack has a different length and a different number of triggers.

---

## 17. Architecture — death

### Hard constraint: cards move seamlessly between locations

**This is repeatedly emphasized and is not a polish detail.** When a card transitions between locations on screen (slot → graveyard, hand → slot, deck → hand, etc.), it moves through the space literally and continuously. The same DOM element representing the card visibly slides from its old position to its new position. Cards do NOT disappear and reappear. This is a load-bearing UI constraint that drives the persistent-DOM-per-card architecture.

### Death sequence

When a creature takes lethal damage in combat:

1. The creature takes the damage hit animation.
2. The creature does its **deathwish animation** (something special when it dies — varies by card).
3. The creature then slides from its slot into the graveyard pile in the most literal way.

The deathwish effects fire as part of step 2, before the move to the grave.

### Chip behavior

The dying creature's chip in the past does NOT change. The past does not care about subsequent state on the card.

---

## 18. Architecture — engine pacing model

### Time-based pacing, locked

The engine drives time on its own clock. Animations are decoration that play alongside.

**Engine never waits on the UI.** When processing a beat:
1. State mutates.
2. Engine emits an event describing what happened.
3. Engine renders the new state and sleeps for a fixed duration read from a per-event-kind table.
4. After the duration, the engine moves to the next beat — regardless of whether any animation completed.

**Consequence:** the game cannot get stuck waiting for an animation that failed to fire or never reported completion. If the UI is broken, the engine still advances. State is always correct; visual feedback degrades gracefully.

### Speed control

A single global speed multiplier scales the duration table. Tuning the player's experience is one knob. "Skip animations" is just setting the multiplier very low.

### Card movement is in the duration budget

Per the "cards move seamlessly between piles" hard constraint, beats that involve card movement (death → graveyard, hand → slot, etc.) have durations that include the slide animation time plus a small buffer. If a slide doesn't complete in its budget, the card snaps to its destination — the game keeps moving. Visual is degraded; state stays correct.

### Player input during a beat

The engine has an "is busy between beats / sleeping" state. Clicks during that window are dropped. No queue, no defer — just ignored.

### Testability

The engine is testable headlessly. No DOM, no timers, no UI needed — emit events, advance the engine, assert state.

---

## 19. Architecture — where state lives

### Two stores, no overlap

**Engine state** (`state`) — owned by the engine. Game truth. The engine is the only writer.

Contains:
- Run-scoped state: current floor, the map, the player's deck list, structures left on the map at past nodes, durability across encounters.
- Encounter-scoped state (set per encounter, cleared on encounter end): which locations are in this encounter, what's at each slot per side, hands, piles, turn number, phase, the timeline (chips for past/future).
- Per-card-instance state: where the card is, its mutable state (durability, marks, level/xp, sleep, etc.).

**UI state** (separate module) — owned by the UI. Visual truth. The UI never writes to engine state; the engine never reads UI state.

Contains:
- The DOM registry mapping `card.instId → DOM element` (persistent across renders so cards visually move).
- The chip registry mapping `chipId → DOM element`.
- Current playback speed multiplier.
- Animation timers in flight.

### Persistence boundaries

The engine owns persistence between encounters and floors. The UI's DOM registries get reset on encounter end (cards from the previous encounter are gone visually; their state has either left the deck or been shuffled back per the deck/pile rules).

### Save/load

Not in scope for v1. Engine state does not need to be serializable from the start. (Implication: state can hold non-serializable things like functions on def predicates, Sets, etc. without contortions.)

---

## 20. Architecture — engine main loop

### Reactive, not continuous

The engine is reactive. It does nothing on its own. It only acts when an input arrives. An input is either:
- A player click that fires an engine function (`playCard`, `cancelPlacement`, `advancePhase`, `moveCard`, etc.), or
- A natural continuation of a previous beat (the engine self-schedules the next beat via `setTimeout`)

Between inputs, the engine is dormant.

### Beat shape

Every engine function follows the same shape:

1. Validate the input. If invalid, do nothing.
2. Mutate state.
3. Emit one or more events describing what happened.
4. Render.
5. If further beats are needed, schedule the next beat via `setTimeout(thisDuration)` (duration from the per-event-kind table, scaled by the global speed multiplier).
6. Return.

The engine never `await`s anything. It schedules its own continuation.

### Phase sequence as a beat chain

A phase advance is a chain of self-scheduled beats. Player clicks "Advance Phase," `endMainPhase` runs, commits become face-down, schedule the first reveal. Each reveal beat runs and schedules the next. Eventually a beat lands on "we're back in main, clear isPlaying, wait for player input."

**The engine is a state machine where each state schedules its own successor.**

### AI turns

The AI's commits happen as sync work inside the player's `advancePhase` call. The AI picks cards from its hand and places them at slots before either side's commits go face-down. Then both sides' commits reveal together in Tempo order. There is no separate "AI turn."

### Deathwish cascades

A creature dies → engine fires the deathwish (mutates state, emits events, may damage other creatures). Damaged creatures that die get queued as pending deaths. After the deathwish duration, the engine fires the next pending death. The chain plays out via the same self-scheduling beat mechanism.

**Deathwish and the move-to-graveyard are separate beats with separate durations.**

### Player input during a beat sequence

The engine has an `isPlaying` flag, set when a beat sequence starts and cleared when it ends. Click handlers check the flag and bail if set.

### Why hangs are structurally impossible

Every beat ends with `setTimeout`. The browser fires it. There is no `await` on anything UI-side, no callback that could fail to fire and stall the engine.

---

## 21. Architecture — engine→UI event flow

### Subscriber model

The engine has a synchronous `emit(event)` function. The UI calls `subscribe(handler)` once at startup, registering a single handler. When the engine emits an event, the handler runs synchronously.

The handler dispatches by `event.kind` and plays the corresponding animation. It must not block — adding a CSS class and returning is fine; awaiting anything is not. CSS animations play out in the browser's compositor while the engine moves on.

### Two channels: events and renders

- **Events** — point-in-time things ("a creature took damage"). Flow through `emit` → subscriber handler → animations.
- **Renders** — snapshots of engine state. The engine calls `render()` directly. The UI reads state and updates DOM (pile contents, hand contents, board, chip strip).

A beat typically does both: mutate state → emit events → render → schedule next beat. But they're independent — a beat may emit without rendering, or render without emitting events.

### Hang impossibility, restated

Synchronous `emit` means the engine never awaits the UI. CSS animations run in the browser independently of the engine. The engine's `setTimeout`-chained beats fire on the browser's clock, not on animation completion. No promise chain to break.

---

## 22. v1 scope

v1 matches the scope of the current prototype, rebuilt on the architecture in this doc.

Concretely (taken from the prototype as built):

- The bipartite-chain slice map: 3 stages (A, B, C), 2 nodes per stage, edges connecting every Stage-N to every Stage-(N+1) — and an `end` node behind C with a boss summoner.
- The Red, Green, and Blue starter pools as currently printed.
- The neutral location types currently authored (Champion's Rest, Goblin Armaments, Ogre Hideaway).
- All five stats (Force, Tempo, Insight, Resolve, Spite) wired up with their current per-color effects.
- The AI as it exists in the prototype: during hostile encounters where it has presence, it picks cards from its hand each main phase, scores legal (card, location, target) tuples, and places real plays. Retreat behavior when it has no creatures left and couldn't bring in reinforcements.
- Default 2×2 slot profile, structures and actions as today. No slot-profile variants in v1.
- The Past/Future timeline (chip stream as the unified past), marks (reroute / convert / damage), tokens that exile on death, deathwish triggers.
- The visual ecosystem: persistent DOM per card, real cards in piles (not placeholders), seamless slides between zones, chips in the L-shape around the board.
- Boss encounter at C-stage adjacent locations — boss summoner with Durability, reduce to 0 = run win.

What's deliberately NOT in v1 (deferred):
- Variant slot profiles (1×1, 3×3, locked cells, etc.).
- Supply lines / persistent structures across encounters.
- Multiple floors. v1 is one floor.
- XP / leveling.
- Real AI spread on the overworld between encounters (the AI in v1 plays during hostile encounters where it has presence, as the prototype already does — it doesn't simulate off-screen turns at nodes the player isn't at).
- Recall (Blue keyword), Black erase-the-past, any non-prototype-implemented Black/White content.
- Save/load.

The bet: rebuilding the prototype's scope on the new architecture should be possible in a focused stretch, will validate the architecture, and produces a v1 the user can play end-to-end.

---

## 23. Directory and module layout

The rebuilt code lives in `src/`. Module boundaries match the architecture sections.

```
src/
  main.js                  — boot, registers UI handler, kicks off the start menu

  engine/
    state.js               — the state shape, createCard, freshState, setState
    events.js              — emit(), subscribe() — the synchronous engine→UI boundary
    scheduler.js           — runBeat() / scheduleBeat() — the setTimeout-chained loop, isPlaying flag
    config.js              — per-event-kind duration table; global speed multiplier

    run.js                 — overworld map, floor progression, encounter setup/teardown,
                             between-encounter persistence (deck, durability, structures)
    encounter.js           — encounter loop: phases, turn flow, win condition check
    profile.js             — slot profiles + spatial query helpers

    cards.js               — CARD_DEFS template, instance fields, level/xp progression layer
    stats.js               — effectiveStat layered reads (base + level + buffs + grants + conditionals)
    legality.js            — canPay, legal targets, placement, commit window rules
    marks.js               — applyMark, sendToPile, reroute/convert/damage behaviors

    combat.js              — combat order, beat-by-beat attack resolution
    triggers.js            — flip-up dispatcher, on-leave triggers, deathwish dispatcher,
                             string-tag→handler map for all card effects
    actions.js             — action effect handlers (resolveAction by effect tag)

    ai.js                  — AI hand-to-board placement during hostile encounter main phases

    locations.js           — LOCATION_TEXTS registry (location-text behaviors + slot profile per key)

  data/
    cards/                 — CARD_DEFS split by color/role
      red.js
      green.js
      blue.js
      tokens.js
      ...
    worlds.js              — map definition (nodes, edges, contents per node)
    locations.js           — concrete location texts referenced by key

  ui/
    render.js              — pure render functions reading state, top-level render()
    registries.js          — _cardRegistry, _chipRegistry (persistent DOM per instId / chipId)
    animations.js          — the single subscribe handler that dispatches by event.kind;
                             playClass, FLIP, crash, shake, pulse helpers
    handlers.js            — click handlers, drag handlers; gate on isPlaying flag

    components/
      hand.js
      board.js
      pile.js
      chip-strip.js
      summoner-bar.js
      controls.js
      overworld.js
      start-menu.js
      game-over.js

  styles.css               — all CSS; FLIP-compatible animation classes
```

### Notes on the layout

- **Engine ↔ UI direction:** `engine/*` never imports from `ui/*`. `ui/*` may import from `engine/*` for reads (state, profiles) and event subscription. The boundary is enforced by import direction.
- **No `core.js` barrel:** unlike the prototype, there's no single barrel re-exporting everything. Each module is imported directly where needed. Cyclic imports are avoided by keeping the dependency direction strict.
- **`engine/scheduler.js` is new.** It owns `isPlaying`, the beat-chain, and the speed multiplier. Every engine function that produces beats schedules them through here. This is the single source of truth for "is the engine busy."
- **`triggers.js` and `actions.js` are the two effect dispatch points.** A new card with a novel behavior adds a tag and a handler in one of these.
- **`data/cards/` is split by color** to keep files small as content grows.

---

## 24. Implementation plan

Build order for v1, in phases that each end at a runnable, testable state.

### Phase 0 — Throw it all out

Delete `src/`, `tests/`, `index.html`. Keep `package.json`, `vitest.config.js`, `node_modules/`, the docs, the backup branch. Verify clean state.

### Phase 1 — The shell

Re-create `index.html` as a thin DOM shell. Re-create `src/main.js` that boots and renders a placeholder. Re-create `src/styles.css` with foundation styles. Goal: load the page, see "v1" or similar placeholder. No engine yet.

### Phase 2 — The architecture skeleton

Build `engine/state.js`, `engine/events.js`, `engine/scheduler.js`, `engine/config.js`. Build `ui/render.js` with a render-state function, `ui/registries.js`, `ui/animations.js` with the subscribe handler shell. Wire them: engine can emit, UI receives, scheduler can chain a fake beat. Goal: load page, console shows beat chain working, no game logic yet.

### Phase 3 — One vertical slice: commit and flip

Add minimal `cards.js` (one creature def), `legality.js` (can-place + commit), `triggers.js` (flip event, no triggers yet), `encounter.js` (main phase + reveal phase only). UI gains a hand display, a single slot, the chip strip. Goal: player clicks a card, it goes to the slot face-down, advance phase reveals it, chip moves future→past.

This is the moment where the architecture is validated. If this slice works without hangs and feels right, the rest is content + behavior layered on a proven foundation.

### Phase 4 — Add combat

`combat.js`, the death-and-slide-to-graveyard beat chain, the damage animation. Add a second slot (still default 2x2 profile). Two creatures, one attacks the other, watch the visual flow. Goal: combat reads cleanly end-to-end.

### Phase 5 — Add deathwish, triggers, multi-effect cards

Flip-up triggers, deathwish, the full string-tag dispatcher. Token spawning. The cascade pattern (death → deathwish → summon → slide). Goal: a card with a deathwish dies, plays its triggers in order, no hangs.

### Phase 6 — Multi-location encounters

Lift to LOCATION_COUNT > 1. Locations row layout. Verify combat order across locations, reveal order across locations, the chip strip showing both. Goal: a 2-location encounter plays the way the prototype did.

### Phase 7 — The full encounter and run

Add `run.js`, the overworld, encounter setup/teardown, between-encounter persistence (deck shuffles back, durability carries), neutral encounter content, hostile encounter with AI, boss encounter at C-adjacent nodes. Goal: complete a run.

### Phase 8 — Content

Port the Red, Green, Blue starter pools and the location texts. Verify each card's behavior. This is the longest phase by line count but mostly data + handler tags.

### Phase 9 — Polish

XP/leveling. Tuning the speed multiplier. CSS polish. Any remaining UI affordances (legal-target highlights, drag, pile click-to-view, etc.).

### Stopping rule

If at any point in phase 3+ we hit a hang or a structural problem, stop. Don't patch. Read this doc, find the architectural lapse, fix it. Then continue. The whole point of this rebuild is that the architecture should make hangs structurally impossible.

---

## Final note

This plan supersedes everything previous about how the code is structured. The old docs (DESIGN.md, DECISIONS.md, CARD_DESIGN.md, ARCHITECTURE.md, ARCHITECTURE_LESSONS.md) remain in the repo as reference material — they contain a mix of confirmed decisions and AI elaboration. Where this plan conflicts with them, this plan wins.

