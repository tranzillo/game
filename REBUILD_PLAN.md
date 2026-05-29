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

## 23. Tech stack and directory layout

### Tech stack

- **TypeScript** — non-negotiable. Card defs, marks, stats, effect dispatch by string tag — the data shapes are polymorphic enough that TS catches whole classes of prototype bugs at compile time (e.g., the "neutral creature whose owner is 'neutral' but spatially side 'ai'" ambiguity becomes a discriminated union).
- **React** — view layer. Persistent DOM identity per card via `<Card key={card.instId} />` — the React reconciler keeps the same DOM node across renders, which is exactly what §17's "cards visibly slide between zones" requires. We know React; the marginal correctness gains of Solid or Svelte are real but not worth the learning cost or ecosystem loss for this project.
- **Framer Motion** — animation layer. Its `layout` prop is the FLIP pattern as a library primitive. When a card changes parent (slot → hand → graveyard), Framer measures old and new positions and animates the transform automatically. **Framer owns `transform` exclusively.** Per AL #5, our own CSS animations only touch non-transform properties (opacity, filter, box-shadow, background) so they compose. Crash/shake/damage flash/death fade are declarative Framer variants.
- **Zustand** — state container. Plain TS object store, works outside React (so engine tests run headless without React loaded). React subscribes via hooks; the engine reads/writes via store.getState / store.setState. No reducer boilerplate.
- **Vite** — dev server + bundler. Native ESM, TS support, fast HMR.
- **Vitest** — kept from the prototype. Tests stay headless; no DOM, no timers.

### Library responsibilities, in plain terms

- The **engine** is pure functions. `(state, input) → { newState, events[] }`. No React, no DOM, no timers. Testable in vitest with no setup.
- **Zustand** is just where the state object lives. The engine writes the state; React reads it.
- **React** subscribes to the store and renders the DOM. It owns the structure of the page.
- **Framer Motion** owns animation. When the DOM structure changes (cards moving between parents), Framer Motion animates the transition. The engine doesn't know Framer Motion exists.
- The **scheduler** runs setTimeout-chained beats. Between beats the engine is dormant. The engine emits events to subscribers; one subscriber is the animation layer (CSS class flashes for shake/pulse/damage), another is React via Zustand.

### Directory layout

```
src/
  main.tsx                 — boot: mount React, register engine event handlers, render <App />

  engine/                  — pure game logic. No React, no DOM, no timers. Tested with vitest.
    state.ts               — the state shape, createCard, freshState, setState
    events.ts              — emit(), subscribe() — the synchronous engine→world boundary
    scheduler.ts           — runBeat() / scheduleBeat() — setTimeout-chained beats, isPlaying flag
    config.ts              — per-event-kind duration table; global speed multiplier

    run.ts                 — overworld map, floor progression, encounter setup/teardown,
                             between-encounter persistence (deck, durability, structures)
    encounter.ts           — encounter loop: phases, turn flow, win condition check
    profile.ts             — slot profiles + spatial query helpers

    cards.ts               — CARD_DEFS template, instance fields, level/xp progression layer
    stats.ts               — effectiveStat layered reads (base + level + buffs + grants + conditionals)
    legality.ts            — canPay, legal targets, placement, commit window rules
    marks.ts               — applyMark, sendToPile, reroute/convert/damage behaviors

    combat.ts              — combat order + pure attack resolution (returns events; no render calls)
    triggers.ts            — flip-up dispatcher, on-leave triggers, deathwish dispatcher,
                             string-tag→handler map for all card effects
    actions.ts             — action effect handlers (resolveAction by effect tag)

    ai.ts                  — AI hand-to-board placement during hostile encounter main phases

    locations.ts           — LOCATION_TEXTS registry (location-text behaviors + slot profile per key)

    types.ts               — shared TS types (Card, Side, Phase, Event, etc.) used across engine

  store/
    index.ts               — Zustand store: holds engine state, exposes selectors + actions
                             (actions are thin wrappers that call into engine/* and persist results)

  ui/
    App.tsx                — top-level component, routes between menu/overworld/encounter
    handlers.ts            — engine event → animation dispatcher; subscribed at boot

    components/
      Hand.tsx
      Board.tsx
      Location.tsx
      Slot.tsx
      Card.tsx             — the persistent-identity card component. Framer Motion `layout` here.
      Pile.tsx
      ChipStrip.tsx
      Chip.tsx             — persistent identity per chip; Framer `layout` for transit through present
      SummonerBar.tsx
      Controls.tsx
      Overworld.tsx
      StartMenu.tsx
      GameOver.tsx

    animations/
      events.ts            — engine-event → animation handler (adds CSS classes for shake/pulse/damage)
      variants.ts          — Framer Motion variants (crash, shake, damage flash, death fade)

  data/                    — card defs, world defs, location-text content. Pure data, no logic.
    cards/                 — CARD_DEFS split by color
      red.ts
      green.ts
      blue.ts
      tokens.ts
    worlds.ts              — map definition (nodes, edges, contents per node)
    locations.ts           — concrete location-text content referenced by key

  styles.css               — global CSS; non-transform animation classes only
```

### Notes on the layout

- **Engine ↔ UI direction:** `engine/*` never imports from `ui/*` or `store/*`. The store imports from `engine/*` to expose actions/selectors. UI imports from `store/*` (and `engine/*` for types and pure helpers). The boundary is enforced by import direction and by TS.
- **`engine/scheduler.ts` is the single owner of "is the engine busy."** Every engine function that produces beats schedules them through here. Click handlers check the flag and bail if set.
- **`ui/components/Card.tsx` owns the persistent-DOM-per-card contract.** Mount it with `<Card key={card.instId} layout />` and Framer Motion handles the slide animation when its parent changes. No manual FLIP, no `getBoundingClientRect`, no className wars.
- **`triggers.ts` and `actions.ts` are the two effect dispatch points.** A new card with a novel behavior adds a string tag and a handler in one of these.
- **`data/cards/` is split by color** to keep files small as content grows.

### What the prototype taught us about the boundary

The prototype had `getCardOuterEl(card)` which stripped `className` and `style` on every render — silently destroying any animation state added by the event handler. That bug was an emergent property of two writers (event handler, renderer) touching the same persistent DOM node with no contract. The new architecture removes both writers:
- The renderer (React) only sets props on `<Card />`. It never touches `style.transform` or `className` directly.
- The event handler triggers Framer Motion variants via state changes (e.g., set `cardState.isAttacking = true`, the component renders with the attack variant, Framer plays it, the engine moves on).

This is what AL #1, #4, and #5 prescribe, made concrete by the framework choice.

---

## 24. Implementation plan

The original §24 ("port forward 14 modules + tests, then add UI") was attempted, failed for the reasons captured in §25–§32 (the prototype carried forward many design simplifications that conflict with the locked design), and reverted. Failed work preserved on branch `archive/2026-05-25-failed-port`. Current `main` is at the Phase 0 scaffold (Vite + React + TS + Framer Motion + Zustand + Vitest installed, `src/main.tsx` placeholder, no engine, no tests, no UI components).

This revised §24 describes the build from here forward. **Design surfaces §25–§32 are the contract.** No prototype carryover; each piece is built against the locked design.

### Approach

Feature-driven, not module-driven. Each "phase" below corresponds to a design surface (or small group of related surfaces) and builds the engine code + tests for that surface to a working state before moving on. UI work happens after the engine layer for the relevant feature exists, never before.

Each phase ends at a runnable, testable state:
- `npm test` passes (with new tests written against the design).
- `npm run typecheck` clean.
- `npm run build` clean.
- Where the phase has UI scope: dev server boots cleanly and the new affordance works in the browser.

Tests are written against the **design contract** (the relevant §25–§32 sections), not against any prototype behavior. The 52 prototype tests in `archive/v0-prototype/tests/` are reference material only — they may inform new test names or coverage areas, but their assertions are not copied forward without re-verification against the design.

### Phase sequence

Each phase is engine-first, then store-actions, then UI when appropriate.

**Phase A — Foundation: slot profiles + state shape.** Builds the type system for cards, locations, profiles, and basic state. Engine primitives for spatial queries against profiles. Tests cover profile authoring, position iteration, spatial query results against default and variant profiles, multi-slot placement. No UI.

**Phase B — Stats layer.** All five stats first-class on card defs and instances. `effectiveStat` with layered reads (printed + conditional + scoped + equipment). Scoped buffs with turn/encounter/permanent. Per-location stat totals using combat-eligibility for Force. Comparative cost evaluation at cast. Tests cover layer composition, scope reverts, the Inert filter, comparative cost paths. No UI.

**Phase C — Marks.** `markCount` on cards, `applyMark` with double-mark exile to trash. Tests cover the count progression, exile path, persistence into `runDeckEntry.mods`. No UI yet.

**Phase D — Pile model + ownership-by-position.** All pile types (per-side, per-location, global trash). Routing rules on leave-play based on summoner presence. Acquisition as positional move (no `owner` field). Encounter-end pile resolution. Tests cover routing into the right pile under each summoner-presence scenario and the end-of-encounter shuffle. No UI yet.

**Phase E — Phase model + flip queue + chip primitives.** Phase queue data structure with default 5-phase ordering. Play window → flip queue → substantive action shape per phase. Universal flip-up writes to The Past. Chip + Past data shapes per §32. Tests cover the flip ordering hierarchy, multi-side flip resolution, suppressed actions staying in future. No UI yet.

**Phase F — Boundary scaffold.** Engine→store→UI boundary wired with the now-richer engine. Zustand store with notify tick, store actions for the operations we have so far. React `App` renders state diagnostically. Engine event subscriber stub.

**Phase G — First vertical slice.** Smallest playable loop: one default-profile location, one creature card, one phase (main → flip). Player clicks card → pending → advance → flip-up trigger → card on board → next turn. Per AL #5/#6: Card with Framer `layout`, persistent React key by instId, slide animations work, no teleport, no className clobber. **This is the architecture validation moment.** If anything fails here, stop and find the architectural cause before continuing.

**Phase H — Combat.** Combat phase per §30: pattern dispatcher, Tempo ordering, damage application + fall-through, Spite thorns, ranged + ammo, equipment-set-Force, the two-beat death sequence. Tests cover attack pattern resolution, fall-through specifics, death sequencing, thorns triggering only on melee.

**Phase I — Triggers, deathwish, persistent actions, multi-effect cards.** Card-level + location-text-level trigger registries. Phase boundary dispatch. Deathwish in the death sequence. Persistent action lifecycle. Token spawning as standard committed-face-down. Cascade resolution.

**Phase J — Multi-location encounters.** Lift to N > 1 locations. Locations row layout. Cross-location combat order, cross-location flip ordering.

**Phase K — Win conditions + encounter end.** End-of-turn checks for clear/lose/retreat. Per-damage check for boss durability. End-of-encounter pile reshuffling. Overworld navigation between encounters. Boss encounter shape.

**Phase L — Run shape.** Overworld map, node graph, pawn movement, summoner presence by adjacency, war/peace location-text modes, location pile persistence across encounters.

**Phase M — Content.** Card defs ported from `archive/v0-prototype/src/data/cards.js` as reference, each re-implemented to match the locked design. Location-text content ported the same way.

**Phase N — Polish.** XP / leveling. Speed multiplier tuning. CSS polish. Any remaining UI affordances.

### Order rationale

The phases are ordered so each builds on the previous without circular dependencies. Profiles before everything because every spatial query depends on them. Stats before piles because piles need cost-context for some routing decisions. Marks before piles because trash routing needs the exile path. Pile model before phases because phase-end flip queue needs to know where face-up cards go on resolution. Phase model + chip primitives before any UI because the timeline is part of the engine state. Boundary scaffold before the first slice. The slice (Phase G) is the architecture validation moment per AL #6/#9.

### Stopping rule

If at any point in any phase we hit a hang, a teleporting card, an animation clobber, a contract violation between engine and UI, or any of the prototype's failure patterns: **stop**. Don't patch. Read the relevant §25–§32 section, find the architectural lapse, fix it. The whole point of this rebuild is that the architecture should make those failure patterns structurally impossible.

If the design itself is unclear in a moment, **stop and have a design conversation**, do not extrapolate. Capture the answer back into §25–§32 with the user's literal words.

---

# Locked design surfaces (§25–§33)

After the failed v1 port (archived in `archive/2026-05-25-failed-port`), the design surfaces below were worked through and locked in conversation as the contract for the engine rewrite. Same capture discipline as §1–§24: user's literal answers locked; AI extrapolation flagged or excluded.

These supersede any earlier prototype assumptions where they conflict. Anything in §1–§24 not explicitly contradicted here still stands.

---

## 25. Slot profiles

### What a profile is

A location in an encounter has a **profile**. The profile defines the *shape of the play space* at that location. The profile is structural — it's part of what makes a location *that* location, not just a featureless arena. Terrain destruction effects can wipe a location's stat line and rules text, but **never the profile itself**.

A profile has three independent grids — one per **kind**: creatures, structures, actions. Kinds stay separate. Cards never blur the kind boundary.

Each grid is a rectangular arrangement bounded by `rows ∈ {1, 2, 3}` and `cols ∈ {1, 2, 3}`. Cells outside the grid don't exist. Cells inside the grid but marked **locked** are present-but-unusable (visually shown as inaccessible).

Both sides of a location share the same profile.

### Positions

A position is `{r, c}` — row and column indices into the profile's grid. Row 0 is the **front row** (closest to the centerline between the two sides). The highest-indexed row is the back row.

When `rows === 1`, every slot is both front and back.

Position keys are opaque to consumers. The default profile uses `"r0c0"`-style strings internally, but **every iteration over positions goes through the profile** (`creaturePositions(state, loc)`, `frontRowPositions(state, loc)`, etc.). No hardcoded position names anywhere in engine or UI.

### Spatial queries

Because grids are bounded rectangles, all spatial queries are coordinate arithmetic. No edge lists, no graph traversal.

Engine primitives (named in conversation; final names settled during code sketch):
- "Front row" / "back row" position lists
- "Adjacent same-side" (Manhattan-1)
- "Same row neighbor"
- "Behind" (same column, next row)
- "Column" (all positions in same column)
- "Across" (enemy column, scanning front-to-back)

Card text expressed in these terms composes with any profile. "Cleave hits adjacent same-row" works on a 1×2 grid (one neighbor) and a 3×3 grid (up to two neighbors) without code change. The engine resolves the spatial query at trigger time against the location's profile.

### Multi-slot cards

A card may occupy more than one position. A card carries `slots: PositionKey[]` — its footprint in play. Single-slot cards have one entry; multi-slot cards have 2+.

Multi-slot footprints are declared as offsets from an anchor in the card def. Placement uses a `footprintFitsAt(profile, anchor)` query that returns the actual positions or null if any footprint position is locked / outside / occupied.

Representation: every position in a multi-slot card's footprint maps to the same `CardInstance` reference (shared reference, not duplication). Iterations that need unique cards dedupe by `instId`.

V1 content caps at 2-slot footprints; engine doesn't enforce the cap.

A multi-slot card committed face-down occupies all of its footprint slots simultaneously and gets one chip (not N). It flips up in all slots at once. Same on leave-play — all slots vacated together.

Combat targeting of multi-slot creatures follows DESIGN.md's existing rules: row-spanners get hit by both opposing columns; column-spanners by one. Damage is per-attacker, not per-slot-occupied.

### Profile data location

Profiles are paired with the **location-text key**. A location-text definition declares the profile (or omits it to use default). Locations without text use the **default profile**: 2×2 creatures + 1×1 structures + 1×1 actions, no locked cells.

### Ammo as per-side per-location state

Ranged combat consumes ammo from a per-side stockpile at the location. The opponent cannot use your stockpile.

Ammo **persists across encounters** as part of the location's run-state. A side's stockpile at a node is part of the node's persistent state, alongside structures and location piles.

### Equipment pending references the host, not a position

When equipment is committed pending, it carries a reference to its intended host's `instId`. If the host moves between play windows, the equipment follows. If the host dies before equipment flips up, the equipment fizzles to junkyard.

### What this rejects from the prototype

- The hardcoded `["fl","fr","bl","br"]` position model (and the `CreaturePos` union type).
- The `LocationSlots.structure: CardInstance | null` scalar field (and same for `action`) — these must be grids per the kind, matching the profile.
- Equipment pending keyed by position rather than by host instId.
- Per-encounter ammo (must persist run-wide).

---

## 26. Stats and effective-stat reads

### Five first-class stats

`Force`, `Tempo`, `Insight`, `Resolve`, `Spite`. Every card type (creature, structure, action, equipment) can print any of these. A `CardDef` has all five as optional fields (default 0). A creature with `resolve: 1` is fine. An action with `spite: 0` is fine (no Spite printed).

Durability is a separately printed value, not a stat. Only creatures (and possibly some structures by future content) have it.

### Effective-stat read

Reading a stat off a card-in-play is always on-demand, never cached. The function is `effectiveStat(card, side, loc, stat) → number`. Pure: same inputs, same output, no side effects.

Layered computation:
1. Printed base stat from the def.
2. Conditional buffs computed from current board state (Pit-Fighter alone, Challenger, Apprentice, Mana Rock — flag-on-def + reader logic, not data-driven).
3. Scoped buffs recorded on the card.
4. Equipment grants from attached equipment.
5. Inert filter: cards with `inert: true` cannot gain Force/Tempo/Insight/Resolve/Spite from any source. Base stats stay; bonuses filtered out. Durability is not on the no-grow list — Inert cards can be healed.

Sleep zeros Force on the read (a sleeping creature has no Force contribution).

### Buff scopes

Per REBUILD_PLAN §6, scope is always explicit:
- `turn` — until end of current turn. Reverts at cleanup.
- `encounter` — until the card leaves play. **Default unprinted scope** for in-encounter buffs ("while in play" effects).
- `permanent` — persists across encounters via `runDeckEntry.mods`. Doesn't auto-revert.

Anything not explicitly `permanent` reverts on leave-play.

### Per-location stat totals

"Force at a location" is the sum of effective Force over creatures that pass the **combat-eligibility predicate**: face-up, not sleeping, not just-woke, positive effective Force, attack flags clean, and either front-row melee or back-row ranged with available ammo. The Force-total IS the combat damage available at the location. Sleeping ogres or back-row melee creatures contribute 0 to Force-at-the-location even though they're "on the side."

For Tempo, Insight, and Spite at a location: sum the effective stat over all face-up creatures + structures at the location, regardless of row.

Resolve is not a per-location stat.

### Global stat totals

Insight global (sum across all of a side's locations) adds to the side's draw count for the turn.

Resolve global (sum across all of a side's locations) sets the leftmost-N hand-size kept at cleanup.

### Spite as thorns damage

Spite is **retaliation damage triggered on melee combat damage only**.

- Per-card Spite: when a creature's Durability is lowered by *melee combat damage*, the attacker takes thorns damage equal to the defender's effective Spite.
- Per-location Spite total: when melee combat damage falls through to the summoner (no defender blocking), the attacker takes thorns damage equal to the location's Spite total.

Spite does **not** trigger on ranged damage, action damage, or any other source. Melee combat only.

### Comparative costs

Cost requirements can be comparative against the opponent's stat presence at the same location:
- "More Force here than your opponent."
- "Less Resolve here than your opponent."
- "Equal Insight."
- Compounds: "more Force AND less Resolve than your opponent."

### Single cost-check at cast

Cost is checked **once, at cast** (when the player commits the card to a slot). If the check passes, the card is committed; no second check at resolve.

Comparative costs evaluate against currently-visible opponent state at cast. Face-down opponent cards count as zero for the comparison.

The prototype's "double cost-check at resolve" model is rejected — too tricky to convey to players.

### No terrain stats

No separate "terrain stats" data field exists. A location's printed effect IS its location text. If a location grants stat presence ("+1 Force here"), the location text declares a hook that modifies reads.

### What this rejects from the prototype

- `CardInstance` only modeled three stats. All five are first-class.
- "Force is front-row only" as a positional rule. The real rule is combat-eligibility.
- Spite as armor / damage reduction. It's thorns.
- "Terrain stats" as a separate mechanic. Location text is the only place stat-granting at locations is expressed.
- Cost-check at resolve. One check, at cast.
- Buff scopes only modeling "this turn." All three scopes (turn / encounter / permanent) are real.

---

## 27. Marks

### What a mark is

A mark is a **visual alteration to a specific card instance** — torn, stamped, "cheated." It has no mechanical effect on its own. It exists so designers can print effects that target marked cards.

The original framing of "marks are color-tagged and each has its own behavior baked in" is rejected. Marks are color-agnostic, effect-agnostic, and provenance-agnostic.

Foundational properties:
- **Per-instance, permanent.** Lives on that one card. Persists through pile cycling and across encounters via `runDeckEntry.mods`.
- **Visible everywhere.** Shows in all zones — in play, in hand, face-down, in any pile, on either side. Marks leak through fog of war by design.
- **No intrinsic behavior.** The mark itself does nothing. Cards that target marked cards do the work.
- **No kind, no marker tracking.** Just a count.

### Representation

A card has `markCount: number`. That's it. No `kind` field. No `side` (marker) field.

`applyMark(card)`:
- If `markCount === 0`, increment to 1.
- If `markCount === 1`, exile the card (torn in half) — see below.

### Two marks tear the card

When a second mark would be applied to an already-marked card, the card is **exiled immediately** (torn in half). This is the conflict mechanic.

- Card goes to trash. Gone from the run entirely.
- No triggers fire. The card is torn, not killed. No leave-play, no deathwish.
- `runDeckEntry` is removed permanently if present.

### Effects that reference marks

Card text reads `card.markCount > 0` to filter targets. Effects that route a card to "the marker's piles" — there is no marker tracked. Effects that need to know "whose side does this go to" use the resolving card's owner (i.e., the side playing the effect).

### What this rejects from the prototype

- Marks with kinds (`reroute` / `convert` / `damage` as distinct mark types).
- "Reroute mark" as a thing — applying a mark mechanically caused the reroute. That's gone. Reroute is an effect, marks are just a tag.
- Marker side tracked on the mark.
- "A marked card stays yours by mark even if it changes sides" — fabricated, removed.

---

## 28. Phases and phase hooks

### Five phases in default order

1. Upkeep
2. Draw
3. Main
4. Combat
5. Cleanup

Each phase has the same structural shape:
1. **Play window opens.** Both summoners play. Player has UI control; AI's commits happen synchronously during the player's advance.
2. **Player advances** (manually, or auto-advances after a short pacing delay if no legal plays remain).
3. **Flip resolution.** Everything committed during this phase's play window flips up in Tempo order. Flip-up triggers fire; actions resolve; permanents enter play. Token spawning, mark-applying, all the per-card effects happen here.
4. **The phase's substantive action runs.** Upkeep ticks. Draw happens. Combat resolves. Cleanup discards. Main has no further substantive action — for main, playing IS the substantive thing.

Flip happens AFTER play window closes but BEFORE the phase's substantive action. So actions committed in combat flip and resolve their effects before combat begins resolving attacks; actions committed in draw flip before card draw; actions committed in cleanup flip before discard.

### Commit-window rules by card type

- **Creatures, structures, equipment** (permanents): main phase only.
- **Actions**: any phase.

### Priority and Tempo ordering

Priority alternates each turn. On Tempo ties in the flip queue or combat order, the side with priority resolves first.

Within a flip queue:
- Tempo descending (higher first; negative Tempo is legal).
- Tie: side priority.
- Tie: location order.
- Tie: position rank within the location's grid.

### Phase queue

The engine maintains a per-turn phase queue. Defaults to the standard 5-phase order. Cards/locations may print effects that mutate the queue (insert / skip / reorder); v1 content doesn't do this. Engine supports the data shape as an ordered list.

### Phase boundaries (trigger vocabulary)

Each phase has `start of X` and `end of X` boundaries. The full vocabulary for v1: `onUpkeepStart`, `onUpkeepEnd`, `onDrawStart`, `onDrawEnd`, `onMainStart`, `onMainEnd`, `onCombatStart`, `onCombatEnd`, `onCleanupStart`, `onCleanupEnd`. Card and location-text effects register hooks at these boundaries.

### What this rejects from the prototype

- A separate "Reveal" phase.
- Combat-declaration vs combat-resolution as sub-phases.
- "End of upkeep" as a special universal flip-up moment. Flips happen at the boundary of every phase that had commits.
- "Player must play a card in cleanup if they can" forced-play rule. Not real.

---

## 29. Cards entering, flipping, resolving (+ piles, routing, ownership)

### Cards are positional, not owned

There is **no `owner` field on a card instance**. There is no `acquired` flag. Side membership is read from container — where the card is. A card in a slot on the player's side is "the player's card." A card in a pile on the player's side is in the player's pile collection.

This is the heart of the game's design philosophy. "Your creatures" means "creatures in containers on your side." Acquisition is the act of moving a card from one side's containment to the other's.

### Neutrals are not a side

There is no third side called "neutral." A summoner is either present on a side or not — that's an encounter-level fact. Pre-placed biome content occupies AI-side slots spatially but doesn't make the AI "present"; what determines AI presence is overworld topology (see §30 combat, summoner presence).

### Lifecycle states

A card transitions through these states during an encounter:

1. **In hand** — face-up to owner. Selectable. Playable to a legal slot.
2. **Pending** — committed to a slot in the current phase's play window. Ghostly. The player can cancel and return to hand. AI commits never appear as pending — AI commits happen synchronously during the player's advance.
3. **Committed face-down** — when the play window closes, pending cards become committed face-down. Inert (per unified face-down rule): no stat presence, no combat, no triggers, not targetable. A chip enters the future timeline.
4. **Flipping up** — during flip queue, each face-down card flips face-up in Tempo order. Flip-up triggers fire; actions resolve immediately on flip; permanents enter play.
5. **In play** (permanents) — face-up in slot. Contributes stats. Combat-eligible (creatures). Holds equipment (creatures/structures).
6. **Resolved** (actions) — flipped up, effect fired, exited to destination pile.
7. **Leaving play** — combat or effect destroys; deathwish fires; card slides to destination pile.
8. **In a pile** — deck, hand, discard, graveyard, junkyard, location pile, or trash.

### Equipment

Equipment commits in main only. At commit, the player designates a host (a face-up friendly creature or structure with available equipment slot). Equipment is pending against the host's `instId` (not against a slot position) so the host can move between commit and flip without orphaning the equipment.

If the host is gone at equipment flip-up (died, exiled), the equipment **fizzles to junkyard**. Equipment in play attaches to its host until the host leaves play; on host leave-play, the equipment detaches and goes to junkyard (or wherever location text routes it).

### Multi-slot cards

A multi-slot card occupies multiple positions simultaneously. Same card reference appears at each position. Pending shows the card occupying all its footprint slots; cancel removes from all. Flips up in all slots at once; leaves all slots at once.

### Token spawning

A token card spawned by an effect is created and placed face-down into a target slot. It gets a future chip. From there it follows standard rules. No special token lifecycle.

### Persistent actions

Persistent actions (Quest, Prayer, etc.) sit in their action slot across turns. Their initial flip resolves like any flip — chip drops to past. The action then stays face-up in the slot, watching for its persistence condition. When the condition resolves and the action exits, no new chip is emitted (past entry already recorded the flip).

### Piles by scope

- **Per-side piles** (only exist when the side has a summoner at the location): deck, hand, discard, graveyard, junkyard.
- **Per-location piles** (always exist, run-spanning): graveyard, junkyard. Used when the dying side has no summoner present at the location.
- **Trash**: one global pile, run-spanning. Not rendered. Cards in trash are gone from the game entirely.

### Summoner presence is per-location

A summoner is "present" at a location iff their summoner-position is adjacent to that location in the overworld graph.

- **Player**: their summoner-position is the node they've traveled from. The locations in the current encounter are the unvisited nodes adjacent to that summoner-position. The player is therefore present at every location in the encounter.
- **AI**: present at a location iff the AI's reach (their summoner-position + spread) is adjacent to that location. Per-location, not per-encounter.

This gives the war/peace framing at the location text level — a location's text can shift based on whether the AI is present there. The text describes "war" (AI present) and "peace" (AI absent) modes.

### Routing on leave-play

When a card leaves play:
- If a summoner is present on the card's side at the location, route to that side's appropriate pile (graveyard for creatures, junkyard for equipment + structures, discard for resolved actions, exile/trash for trashed).
- If no summoner is present, route to the location's pile (graveyard or junkyard).
- Actions on a side with no summoner have no discard to go to — they go to trash.
- Mark-triggered effects (Reroute as a verb, etc.) can override routing per their text. (Marks themselves don't carry routing; the effects targeting marked cards do.)
- Trashed cards (premium one-shots with "exiled when this resolves", double-mark exile, etc.) go to global trash.

### Acquisition is in-encounter and positional

A card moves from one side's containment to another's by the act of being acquired. There is no end-of-encounter reconciliation pass. A Recruited creature is already on the player's side from the moment of the Recruit. If it dies on the player's side, it goes to the player's graveyard. At encounter end the player's graveyard reshuffles into the player's deck — the Recruited creature is now in the player's deck because it was in the player's containment.

### Location piles record the location's history

Location piles aren't "where bodies go when nobody can claim them." They're a **continuous record of what's happened at the location across the run.**

- Pre-authored content can populate location piles at run init (the AI conceptually fought neutrals here before the player arrived).
- During an encounter, summoner-less-side deaths and summoner-less-side action exits add to the location piles.
- Effects that target location piles (acquire-from-pile, damage-pile, etc.) can interact with them in current and future encounters.
- Location piles never reshuffle into anyone's deck. They sit at the location.
- Visiting a previously-cleared location doesn't trigger a new encounter (no backtracking), but supply-line effects can reach previous nodes; AI movement can interact with previous nodes; future encounter content can reference them.

For v1: the engine models location piles as first-class containers persisting across encounters at the location. V1 content uses them only via pre-authored content + summoner-less death routing. Acquire-from-pile and similar effects are future-content space the engine supports.

### Encounter-end pile resolution

For each side with a summoner:
- Shuffle deck + hand + discard + graveyard + junkyard + in-play creatures + in-play equipment into the side's deck.
- Structures in play stay on the map.
- Trash is excluded.

For each side without a summoner:
- Nothing. They have no deck to shuffle. Content stays where it is for next encounter (location piles, location slots).

Location piles stay at the location. Trash stays in trash (run-spanning, never returns). Structures stay on the map.

The player's hand reforms each encounter — at encounter setup, the deck shuffles fresh, a starting hand is drawn.

### AI deck is run-scoped

Same model as the player's. The AI has a persistent deck that cycles across encounters. Marks, deck-thinning, acquisitions persist on the AI's run-deck.

### What this rejects from the prototype

- `Owner` field on cards. Ownership is positional.
- `acquired: true` flag. Acquisition is positional.
- "Convert / Recruit marks the card as `owner: "player"`" — no, the card simply moves to a player container.
- Junkyard as the destination "for equipment leaving play permanently" — junkyard is just a pile within the encounter; at encounter end it shuffles back like everything else.
- End-of-encounter acquisition reconciliation pass.
- The AI's deck being encounter-scoped.
- A "Reveal" phase. Flips happen at every phase boundary that had commits.
- Forced-play rule at cleanup.

---

## 30. Combat

### Attack patterns are per-card

Combat targeting is determined by **attack patterns printed on the card** (or granted by equipment). The default pattern is "deal damage to one space directly in front." Cards may print custom patterns (cleave, pierce, ranged, etc.).

The engine has a pattern dispatcher (string-tagged). Adding a new pattern is a code change.

### Combat eligibility

A creature is eligible to attack iff:
- Face-up.
- Not sleeping.
- Did not just wake this phase.
- Has positive effective Force.
- Doesn't have skip-attack-this-turn set.
- Position-pattern compatible: melee in front row; ranged in back row with available ammo.

This predicate matches "creature contributes to Force-at-location" — they're the same set per §26.

### Tempo ordering (four-level)

1. Tempo descending. Higher first. Negative legal.
2. Within a Tempo tier: location order (left-to-right across rendered locations).
3. Within a location, within a tier: position rank (front-to-back, left-to-right).
4. Side priority on remaining ties: side with higher local Tempo total; further tie broken by alternating priority per overworld turn.

Action slot order tiebreaks Tempo ties for actions.

### Damage application

Damage targets only Durability. Creatures + summoners have Durability; structures do not. Structures are destroyed by structure-removal effects, not by damage.

**Fall-through:** damage looks for a valid creature target at the location; if none, falls through to the opposing summoner. Universal rule — combat damage, action damage, deathwish damage all follow it.

Specifics:
- Single-target damage with no creatures present → opposing summoner.
- Multi-target ("deal X to each") with no creatures present → opposing summoner once (not per phantom target).
- Scope-extended damage resolves per-location.
- Friendly-fire (cleave on empty board) → does nothing on the empty same-side targets. Only enemy-targeted damage falls through to the enemy summoner.
- Non-damage effects (buffs, debuffs, destroys, returns-to-hand) do not fall through. No target → fizzle.

### Spite (thorns)

Per §26: Spite triggers on melee combat damage only. Per-card on defender; per-location total on melee summoner fall-through. Spite is itself damage and can lethally damage the attacker.

### Ranged combat + ammo

Ranged attackers fire from the back row using ammo from their side's per-location stockpile. Ammo persists across encounters as part of `world.nodeState`.

- Ranged bypasses front-row blocking. Shoots over.
- Ranged bypasses thorns. Not engaged in melee.
- Each shot consumes ammo per the pattern's cost (default 1).
- No ammo → no ranged attack that phase. Other contributions continue.
- Fastest-Tempo on the side fires first; can dry the pool.

### Equipment-set-Force for ranged equipment

Ranged equipment with `setsForce: N` overrides the wielder's effective Force when computing ranged damage. A Bow with Force 1 turns a 0-Force creature into a 1-damage ranged unit (buff) and a 4-Force giant into a 1-damage ranged unit (nerf — trades melee for ranged option).

Non-ranged equipment adds patterns without replacing stats (e.g., Crude Axe grants cleave; the creature's own Force is unchanged).

### Movement during phases

Movement is allowed in **main and combat** phases. One move per creature per turn.

### Combat-trick actions

Actions committed during the combat phase's play window flip and resolve before combat resolution begins. The player commits a Spark in combat → it fires before attacks.

### Death sequence (two beats)

Per REBUILD_PLAN §17:
1. Damage hit lands. Creature's Durability drops to 0. `pendingLeavePile` is set. Creature stays in slot at 0 Durability — visible to the player.
2. Next beat: deathwish fires. Card slides to destination pile.

This split is what lets the player see the creature die in its slot before being swept away.

### Death cascade

Deaths from a single attacker's swing drain one-at-a-time after the swing completes. Each death is its own beat (damage hit → deathwish → slide).

### What this rejects from the prototype

- Hardcoded column / adjacency logic (must go through profile).
- "Force is front-row only" as the location-Force rule (it's combat-eligibility).
- Ranged equipment as an additive grant (it sets Force).
- Friendly-fire fall-through to friendly summoner.

---

## 31. Win conditions and encounter end

### Per-location clear status

Each location in an encounter independently tracks its **player-cleared** status. Clearing applies only at locations where the AI summoner is not present (neutral locations and hostile non-boss locations). Boss locations are not cleared — they're won by reducing the boss's Durability to 0.

A location is **cleared by the player** when there are no creatures on the opposing side's spatial slots at that location. Origin is irrelevant to this check — it's a positional check across all creatures on that side, regardless of whether they're AI-origin or biome.

The check fires at end of cleanup, once per turn. The clear-flag is set then.

**Consequences when a location clears (player-cleared at end of cleanup):**

1. **Shuffle-back at end of turn.** The player's commits at the cleared location shuffle back into the player's deck: creatures, equipment, persistent actions. Player structures stay at the location (per the supply-line rule from §7 / §29). The player's slots at the location empty.
2. **No further player commits at this location.** The player has won here; the cleared-flag closes the location to further player commits for the rest of the encounter.

There is no "AI-cleared" status. The AI does not have a per-location clearing concept. The AI's path to defeating the player is summoner damage — reducing player Durability to 0 — which is a single global condition, not per-location.

### Encounter outcomes

1. **Player cleared** — every encounter location is either player-cleared OR is a boss location whose boss has been killed. In pure non-boss encounters: every location's clear-flag is set. In mixed encounters with a boss + other locations: typically the boss-killed short-circuit fires first; if it didn't, all non-boss locations cleared while the boss is still alive doesn't end the encounter — the boss is still the win.
2. **Player lost** — player summoner's Durability reduced to 0.
3. **Boss killed** — boss encounter only. Boss summoner's Durability reduced to 0. Run win. Encounter ends immediately regardless of other locations' clear status.
4. **AI retreated** — hostile encounters only. AI has no living presence at any encounter location and brought in no reinforcements this turn. AI faction withdraws.

### When checks fire

- **Boss killed**: checked after every damage event. Fires immediately, short-circuits the active beat chain, runs the run-win flow.
- **All other outcomes**: checked once per turn at end of cleanup. The cleared-flag updates happen here too, alongside the shuffle-back for newly-cleared locations. If the win condition was met during the turn, the encounter still finishes the turn before transitioning.

### No voluntary leave

V1 does not have a "leave encounter" affordance. The player must clear or die.

### AI summoner durability is boss-only

In hostile encounters, the AI plays cards each main but has no summoner Durability. Combat fall-through to a side with no summoner-with-Durability fizzles — nothing to damage. The win path at non-boss hostile locations is clearing the opposing creatures (or AI retreat).

### One boss per run (v1)

V1 has one boss summoner at the exit node. Multi-boss runs are a later concern.

### Run-level vs encounter-level outcomes

- Run-over outcomes (player win / player lose) end the run immediately.
- Mid-run encounter outcomes (cleared / retreated) return the player to the overworld to choose the next node.

### Summoner durability persists across encounters

The player's summoner Durability is run-state. Carries from encounter to encounter. Damage taken is permanent unless cards explicitly heal.

### What this rejects from the prototype

- Win condition checks scattered throughout state mutations.
- AI summoner Durability mechanics in hostile (non-boss) encounters.
- A voluntary leave-encounter mechanism in v1.
- "Encounter ends only when all opposing creatures are gone across all locations at once" — encounter end is now per-location-cleared with end-of-turn shuffle-back, so the player isn't stuck with resources locked at a cleared location while still fighting elsewhere.

---

## 32. The Past, the Future, and the Present

### Three temporal states

A card during an encounter has a temporal status:
- **Future** — committed face-down. The card sits in its slot but is inert. A chip in the future bar represents it.
- **Present** — the moment of flip-up. Chip transits through the present node. Card flips face-up; flip-up trigger fires; if it's an action, its effect resolves.
- **Past** — after flipping. Chip falls into the past column. Card is now face-up on the board (or, for an action, has resolved and exited).

### Chips (visual) vs the Past (data)

These are two distinct things:
- **Chips** are visual. Every face-down committed card gets one. The chip transits future → present → past as the card flips up. Chips carry a reference to the live `CardInstance` (no snapshot — reads from current state).
- **The Past** is data. An append-only log of every flip-up event. Encounter-scoped. Clears at encounter start. Targetable by card effects.

### What writes to the Past

**Any time any card flips up, it writes to the Past.** Universal across all card types — creatures, structures, actions, equipment.

The prototype's "actions write to the past on resolve" framing is rejected. The Past is keyed to flip-up, not to action resolution.

Quest reward firing does NOT write to the Past.

### Past entry

Each Past entry records: `defKey`, `side`, `loc`, `turn`, `cardType`. Order is implicit (append-only list). Tempo is not stored — ordering of resolution affected ordering of entries in the list, but tempo isn't part of the record.

### Targeting the Past

Past entries are first-class targetable resources. Per Pillar 10:
- Random selection from legal entries.
- Positional (oldest / newest / N back).
- Filtered (e.g., "an action", "an action from your side").

Never on-resolve player choice.

Card archetypes targeting the Past:
- **Copy** (cheap): add a token copy of a Past action to your discard.
- **Recall** (premium): trigger a Past action directly, ignoring requirements. Reserved Blue keyword.
- **Erase** (planned Black): remove a Past entry. Not in v1.

### Suppressed actions

A face-down action whose location text declares it suppressed (`shouldSuppressAction(card, loc) → true`) keeps its chip in the future bar across passes. The chip stays unmoved until the predicate returns false at some end-of-phase pass — at that point, the chip transits to present and resolves.

### Chip and card lifecycle are coupled

A chip persists for its card's encounter lifetime. If a face-down card is removed before flipping (double-mark exile of a face-down card, etc.), its chip is removed from future too.

### Persistent action chips

On first flip, chip drops to past as normal. The persistent action sits face-up in the slot until exit. No new chip on exit.

### Token chips

Token cards spawned face-down get a future chip and write to the Past on flip-up like any card.

### Past is shared between sides

Both sides' flip-ups write to the same Past. Both sides can target it. This is what makes "Blue copies opposing actions" work — the Past is one log, not per-side.

### Future bar visibility (fog rules)

- Own-side chips render face-up (identity visible to owner).
- Opposing chips render face-down (`?`); Tempo and slot location leak through.
- Marks on chips leak through fog by design.

### What this rejects from the prototype

- "Actions write to past on resolve" framing. All flip-ups write.
- Quest reward firing writing to past. Doesn't.
- Tempo stored in Past entries. It's ordering, not data.

---

## 33. Open questions remaining after surfaces locked

These were raised in surface discussions but not directly answered, or are deliberately left open:

- **Color visual on marks.** Marks have no kind in the engine, but the design may still differentiate visually (a "Green-applied" mark may render differently from a "White-applied" mark, even though they behave identically). UI concern, not engine concern.
- **Multi-slot card UI representation.** The card spans multiple positions, rendered as one card straddling them. The exact visual treatment is design / UI.
- **AI pre-spread simulation.** V1 uses pre-authored node templates (no simulation). V2+ may add real spread simulation. The engine's `world.nodeState` shape supports either.
- **The "neutral" def-flag.** Whether biome-native cards carry a `neutral: true` flag on their def for visual / authorship purposes — settled informally as a card-def property if needed. Not load-bearing for engine logic since side membership is positional.
- **Action queue / slot-shifting.** The DESIGN.md "actions are not placed into specific slots by the player" passage is outdated; per the locked phases surface, action slots work like any other slot (you put actions into them). Whether DESIGN.md needs updating for this is a doc concern, not an engine one.

---

## Final note

This plan supersedes everything previous about how the code is structured. The old docs (DESIGN.md, DECISIONS.md, CARD_DESIGN.md, ARCHITECTURE.md, ARCHITECTURE_LESSONS.md) remain in the repo as reference material — they contain a mix of confirmed decisions and AI elaboration. Where this plan conflicts with them, this plan wins.

§25–§33 are the most recent layer. They were locked in conversation as direct corrections to prototype-era assumptions that had been silently carried forward. They are the contract for the engine rewrite per the revised §24.


