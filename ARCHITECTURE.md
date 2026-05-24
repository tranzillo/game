# Architecture

The implementation contract for the game engine and its UI. Companion to `DESIGN.md` (what the game IS) and `DESIGN_LESSONS.md` (how to design for it). This doc covers *how the code is structured* — the boundaries, the data flow, the extension points.

Read alongside `ARCHITECTURE_LESSONS.md`, which captures the meta-principles distilled from prior iteration; this doc is the concrete shape those principles produce.

## Foundations

### State ownership

Two stores, no overlap.

**Engine state** (`state`) owns the game model. Cards in slots. Hand contents. Run progress. Outcomes log. Anything that affects gameplay or game-rules truth lives here. The engine is the only writer.

**UI state** (`ui` module-internal) owns the visual model. The persistent DOM registry (`_cardRegistry`, `_chipRegistry`). The currently-playing event sequence. The animation handler registry. The UI is the only writer to this state; the engine never touches it.

A piece of state has exactly one writer module. If two modules need to write the "same thing," that's a code smell — refactor so one owns it and the other reads via API.

### Data flow

```
                 EVENTS
   ENGINE  ────────────────────►  UI
   (game state)                   (DOM + animations)
       ▲                              │
       │  reads state for render      │
       └──────────────────────────────┘

       ◄────── async resolve ──────────
            (single promise per beat)
```

Engine mutates state, emits events, yields once per beat by `await ui.playEvents(eventBatch)`. UI consumes events serially, plays animations, resolves the promise.

The UI has **no callbacks back into the engine**. Game-input clicks (a player committing a card, ending a phase, moving a creature) go through normal handler functions that mutate engine state and trigger a fresh render — they don't reach into the event pipeline.

### One-direction control flow

Never `engine.js → import("./ui/scene.js")` for anything beyond `render()`. The engine doesn't pace itself off UI conditions; it just emits events and awaits the UI's signal.

If you find yourself reaching from the engine into a UI control function, ask whether the UI should *observe* the engine state instead.

---

## Location profiles

Locations vary in shape. The slot profile defines that shape.

### Data model

A location profile is per-encounter-location data attached at encounter load:

```
location.profile = {
  creatures: { rows, cols, locked },
  structures: { rows, cols, locked },
  actions: { rows, cols, locked }
}
```

Each kind has its own coordinate grid. Dimensions: `rows ∈ {1, 2, 3}`, `cols ∈ {1, 2, 3}`. Cells outside the grid don't exist. Cells inside the grid but in `locked` are present-but-unusable (visually shown as inaccessible).

Slot kinds are kept separate (creatures / structures / actions) per the Option A choice. Each kind has its own coordinate grid; cards never blur the kind boundary.

### Coordinate positions

A position is `{r, c}` — row and column indices into the profile's grid. Row 0 is the **front row** (combat-eligible without ranged). The highest-indexed row is the **back row**. With 1 row, every slot is front-row.

For storage, positions stringify as `"r0c0"`, `"r1c0"`, etc. Cards in play live in `lc[kind][positionKey]`:

```
lc.creatures = {
  "r0c0": cardA,   // front-left
  "r0c1": cardB,   // front-right
  "r1c0": cardC    // back-left (back-right is locked or empty)
}
```

Iteration is always `Object.keys(profile.kind.slots)` or grid math — never a hardcoded enum.

### Spatial queries (grid math, not metadata)

Because grids are bounded rectangular, all spatial queries are coordinate arithmetic. No graph traversal, no edge lists.

- **Adjacent** (Manhattan-1): `Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1`
- **Same row**: `a.r === b.r`
- **Same column**: `a.c === b.c`
- **Front row**: `r === 0`
- **Back row**: `r === profile.rows - 1` (and `r !== 0` for grids ≥ 2 rows)
- **Opposite-column on the other side** (combat targeting): the attacker at `{r, c}` targets enemy column `c`, scanning from row 0 (front) backward through enemy slots.
- **Behind** (for pierce): the slot at `{r+1, c}` on the same side.

Card effects expressed in these terms compose with any profile. "Cleave hits adjacent same-row" works on a 1x2 grid (one adjacent slot) and a 3x3 grid (up to two adjacent slots) without code change.

### The default profile

The current 2x2 creatures + 1 structure + 1 action layout is the **default profile**, applied to any location that doesn't declare its own. Migration to profile-aware code starts with all locations using the default — visible behavior unchanged — then variant profiles ship by being declared per-node.

### Per-card effects that referenced positions

Existing card text often says "back row" or "front row" or "the creature across from this." All of those re-express in profile-aware terms:

- "Push to back row" → move to row `profile.creatures.rows - 1`, same column.
- "Across from this on the other side" → enemy slot at `{r: 0, c: this.c}` first, falling through.
- "Adjacent same-side creatures" → all creature slots within Manhattan-1 of the source position, same side.
- "Same row neighbor" → creature slot at `{r: this.r, c: other column}` on the same side.

Card text doesn't need to change. The engine resolves the spatial query at trigger time using the profile.

---

## The event contract

The engine's communication channel to the UI. The vocabulary that grows as new mechanics are built.

### Envelope shape

Every event has the same envelope:

```
{
  id,          // monotonic int, unique per encounter
  kind,        // string tag — see vocabulary
  turn,        // turn number when emitted
  phase,       // phase name when emitted
  chainId,     // optional — links related events from one source
  ...payload   // kind-specific data
}
```

`kind` is a free-form string. New kinds can be added without engine changes — see *Extension points*.

`payload` is whatever the kind needs. Convention: include `instId` for card events, `{side, loc, pos}` for spatial events, and any kind-specific numeric values (damage amount, etc.).

`chainId` groups events that flow from a single cause. A combat hit that triggers death-then-deathwish-then-summon-then-leavePlay shares one chainId. The UI can use this to pace the chain as one continuous beat (or treat each as separate; that's a UI decision).

### Today's vocabulary (the starting set)

These are the event kinds the engine currently emits or has explicit precedent for. New kinds can be added freely; this list documents what's already in use.

| kind | payload | meaning |
|---|---|---|
| `commit` | `{instId, side, loc, pos, kind}` | A card committed face-down to a slot. |
| `flip` | `{instId, side, loc, pos}` | A face-down card just flipped face-up. |
| `action-resolve` | `{instId, side, loc, defKey, name, tempo}` | An action card resolved its effect. |
| `attack` | `{instId, name, side, loc, pos, force, ranged, targetInstId}` | A creature swings. `targetInstId` is the defender or null if no target. |
| `damage` | `{targetInstId, targetName, targetSide, loc, pos, amount, source}` | A creature took damage. |
| `death` | `{instId, name, side, loc, pos, killerInstId, isToken}` | A creature died in its slot (before leaving play). |
| `deathwish-trigger` | `{instId, name, side, loc, effect}` | A dying card's deathwish is firing — telegraph for the player. |
| `summon` | `{instId, name, side, loc, pos, source}` | A new card entered the board (token or otherwise). |
| `leave-play` | `{instId, name, side, loc, pos, toPile}` | A card just left its slot, on its way to a pile. |
| `move` | `{instId, name, side, loc, fromPos, toPos}` | A creature changed slots. |
| `mark-applied` | `{instId, name, kind, side}` | A mark was placed on a card. |
| `mark-tear` | `{instId, name, kind}` | Same-kind double-mark — the card is torn (exiled). |
| `summoner-damage` | `{side, amount, source, loc, newDurability}` | Summoner Durability dropped. |
| `summoner-damage-fizzle` | `{side, amount, source, loc}` | Damage fell through to a non-summoner side and dissipated. |
| `token-to-discard` | `{instId, side, name}` | A token effect produced a card into a discard pile. |
| `trigger` | `{instId, name, side, loc, kind}` | A card's printed trigger fired — generic telegraph for "this card just did something." |

This is the seed. Mechanics yet to be built (XP gain, level-up, slot-profile-specific effects, future Blue/Black/White verbs) will add their own kinds.

### The principle of beat-worthy events

Not every state change emits an event. Events are for things the player needs to **observe happen**, with a brief pause to process.

Examples of state changes that are **NOT** events:
- A counter ticking (e.g., XP added on a kill — the counter updates silently; only the level-up emit is beat-worthy).
- An internal flag flipping (`flippedThisTurn = true`).
- A `movedThisTurn` set adding an entry.
- A re-shuffle of the deck (the resulting top-card draw is the event, not the shuffle itself).

Examples of state changes that **ARE** events:
- A card visibly moving zones.
- A card visibly changing state (flipping, dying, leveling).
- A mark being applied.
- Damage landing.

The engine decides what's beat-worthy at the moment it writes the change. The discipline: ask "would a player want a brief pause to see this?" If yes, emit. If no, just mutate state.

### Causation chains

When a single game-event causes a sequence of follow-up effects, those effects share a `chainId`. The engine assigns the chainId at the source.

Example: a combat hit that kills the target.
- `attack { chainId: A1 }`
- `damage { chainId: A1 }`
- `death { chainId: A1 }`
- `deathwish-trigger { chainId: A1 }` (if applicable)
- `summon { chainId: A1 }` (if the deathwish summoned something)
- `leave-play { chainId: A1 }`

The UI sees the chain and can pace it as one continuous narrative ("this attacker killed this defender, which triggered its deathwish, which spawned this trap, and then the body went to the graveyard"). All within one engine beat.

A second attack starts a new chain (`A2`). The UI can decide whether to merge or separate the visualization.

### Reading and writing events

The engine writes events via `emit(kind, payload)`:

```
emit("damage", { targetInstId: target.instId, amount: dmg, source: attackerLabel, ... })
```

`emit` appends to a buffer for the current beat. At the end of the beat, the engine yields with `await ui.playEvents(bufferedEvents)` and clears the buffer for the next beat.

`state.outcomes` is the persistent event log (across the encounter). The engine appends every emit to it. The UI consumes a slice ("new events since last play"). The export reads the full log.

---

## The async engine

The engine pauses for visualization at well-defined beats. Implementation is `async/await`.

### Engine functions become async

`runCombat`, `endOfPhaseRevealAndResolve`, `applyCombatDamage`, `fireDeathwish`, `resolveAction`, `endMainPhase`, `resolveCombatPhase`, `endCleanupPhase`, `startNewTurn` — all become async.

Calls to them become `await`. The synchronous `setTimeout` chains we have today get replaced by linear async code:

```
// today (setTimeout chain)
function runCombat(onDone) {
  function processOne(idx) {
    if (idx >= queue.length) { finish(); onDone(); return; }
    // ... process attack ...
    render();
    setTimeout(() => processOne(idx + 1), COMBAT_STEP_MS);
  }
  processOne(0);
}

// rebuilt (async)
async function runCombat() {
  for (let idx = 0; idx < queue.length; idx++) {
    const events = [];
    processAttack(queue[idx], events);   // engine mutates state, pushes to events
    render();
    await ui.playEvents(events);          // single yield point
  }
  firePhaseHook("onCombatEnd");
  checkGameOver();
}
```

The structure is the same; the pacing mechanism is different. `setTimeout` becomes `await`. The UI controls timing via its event playback.

### Yield points (one per beat)

The engine yields at phase-meaningful boundaries. A "beat" is one logical resolution unit:

- **One attacker swinging** (in `runCombat`). The full chain — damage, death, deathwish, summon, leave-play — happens synchronously in engine state, emitting events. The yield happens AFTER the chain completes, with all events batched. The UI plays them serially.
- **One reveal event** (in `endOfPhaseRevealAndResolve`). One flip, one action, one equipment attach. Same pattern: event chain emitted synchronously, single yield after.
- **One creature movement** during interactive phases. Player clicks; engine moves; emits `move`; yields once.
- **One auto-advance** in `maybeAutoAdvance`. The auto-advance fires after a single yield.

There is **never** a yield in the middle of resolving a single beat. The engine doesn't pause halfway through an effect to wait for animation. Effect resolution is atomic from the engine's perspective; the UI's view of pacing is what gives the *appearance* of mid-effect pauses.

### What "playEvents" does

The UI's `playEvents(events)` is async, returns a promise that resolves when all events finish their animations.

```
async function playEvents(events) {
  for (const ev of events) {
    const handler = HANDLERS[ev.kind] || defaultHandler;
    const step = handler(ev);
    render();
    await runStep(step);   // plays animation, awaits duration
  }
}
```

Two cases:
- A handler exists for the kind → its returned step describes the animation and duration.
- No handler → default step runs (a brief 200ms hold), so an unknown kind doesn't break the engine flow.

After each event plays, render runs — so any FLIP transitions for state changes between events animate naturally.

### Player input during async beats

While the engine is `awaiting` a `playEvents`, player click handlers still fire (they're event listeners). To prevent the player from interacting during a multi-step resolution:

- Click handlers check a single flag: `engine.busy()`. If true, the click is rejected (or queued, but rejection is simpler).
- The flag is set at the start of an `await playEvents` and cleared after.
- Interactive phases naturally have no pending events (the engine isn't awaiting), so clicks work normally.

This is the single source of truth for "can the player interact right now": the engine's busy flag. The UI doesn't need to track its own input gate.

---

## The UI play system

How the UI plays events back at a watchable pace.

### Handler registry

Each event kind maps to a handler function that returns a step descriptor:

```
const HANDLERS = {
  "attack": (event) => ({
    duration: 360,
    play(done) {
      if (event.ranged) animateShake(event.instId);
      else animateCrash(event.instId, event.targetInstId);
    }
  }),
  "damage": (event) => ({
    duration: 320,
    play(done) {
      animateDamage(event.targetInstId);
    }
  }),
  // ...
}
```

The handler is **stateless** — it produces a fresh step each time. State (which animations are running, which DOM elements exist) lives in the UI modules; the handler just describes what to play for THIS event.

### Default step

For unknown event kinds, a default step runs:

```
const defaultStep = {
  duration: 200,
  play(done) { /* no-op */ }
};
```

200ms is enough that the player notices a beat pause but not so long that unknown events stall the game. Adding a custom handler when you ship the new mechanic upgrades the experience from "brief pause" to "specific animation."

### Persistent DOM identity

Cards have a stable DOM element per `instId` (`_cardRegistry`). Reparenting between zones is FLIP-animated automatically. Chips have a stable element per `chipId` (`_chipRegistry`); same pattern.

Animations on a card target its registered element by `instId`. Effect-specific animations (shake, pulse, damage flash, death fade) use non-transform CSS properties so they compose with FLIP translations.

### Pile rendering

Piles render the real card elements via the registry, not placeholder mini-cards. The cycle is observable: a card visibly moves from hand → slot → graveyard → (next encounter) → deck → hand, all via FLIP slides as state advances.

The visible cycle is load-bearing for player comprehension. Mini-card placeholders break the cycle and are not used.

### CSS discipline for animations

Reserve `transform` for FLIP. Effect animations use `outline`, `box-shadow`, `filter`, `opacity`, `background-color` — properties that compose with FLIP's `transform: translate()`.

If an effect needs scale or rotate, layer it via a child element or `filter` so the outer element's transform stays free.

---

## Extension points

How to add new things without modifying the architecture.

### Adding a new event kind

1. In the engine, wherever the new state change happens, call `emit("new-kind", {payload})`.
2. In `ui/animations.js`, add a handler: `HANDLERS["new-kind"] = (event) => ({...})`.
3. Document the kind in this doc's vocabulary table.

That's it. Three files touched; no engine refactor.

If you ship step 1 without step 2, the default 200ms step plays and the game still works.

### Adding a new card progression (XP stress test)

Per the design conversation, creatures may gain XP, level up, and have stat or text changes per level.

1. **Card def gains progression data:**
   ```
   r3: {
     name: "Orc Bruiser",
     // ... existing fields ...
     progression: {
       xpCurve: [2, 5, 12],   // xp needed for each level up
       perLevel: { force: 1, durability: 1 },   // default stat deltas
       textByLevel: ["base text", "level 2 text", ...]   // optional
     }
   }
   ```

2. **Card instance gains state:** `card.xp = 0`, `card.level = 0`.

3. **XP gain hook:** in `applyCombatDamage`, when a death event fires with a `killerInstId`, the engine looks up the killer's card def, checks `def.progression?.xpGainPredicate || defaultXpGainOnKill`, and applies XP. If the gain crosses a threshold, emit `level-up` event.

4. **Level-up applies:** stat deltas added to the instance's effective stats (read at query time, not mutated into base). Text replaced at render time, similar to how `effectiveStat` already layers conditional buffs.

5. **Persistence:** `card.runDeckEntry.mods.xp` and `mods.level` ride the existing mods system — XP/level survive across encounters.

6. **UI:** an XP bar / level badge renders on the card. A `level-up` handler animates a pulse + stat-number-change.

What didn't need to change:
- The event contract (just one new kind).
- The async engine.
- The UI handler registry pattern.
- The location profile model.
- Any existing card's logic.

This is the test passing: a major mechanic adds via data + one event + one handler.

### Adding a new location profile

A node declares its profile at encounter setup:

```
nodes: [
  {
    id: "A1",
    label: "Sanctum",
    profile: {
      creatures: { rows: 1, cols: 1, locked: [] },   // 1 creature slot
      structures: { rows: 1, cols: 1, locked: [] },
      actions: { rows: 1, cols: 2, locked: [] }      // 2 action slots
    },
    // ... existing fields ...
  }
]
```

If `profile` is omitted, the default profile is used (today's 2x2 + 1 + 1).

The engine reads the profile at encounter load and stores it on `lc.profile`. All spatial queries route through the profile. No card or effect needs to know what shape the location is.

### Per-def predicates as the standard extension pattern

When a mechanic needs per-card behavior (XP gain rate, special targeting, conditional triggers), store the predicate on the card def, not the instance.

```
def.xpGainPredicate = function(event, card) { ... }
def.shouldSuppressAction = function(card, loc) { ... }   // location text already does this
def.targetFilter = function(candidate, source) { ... }
```

The engine calls the predicate at a well-defined point with well-defined arguments. If the def doesn't declare it, the default applies.

Instances stay simple: they carry data (xp, marks, durability), not behavior. Behavior lives on the def. This separation makes save/load, serialization, and reasoning about state much easier.

---

## What this architecture does NOT cover

These are explicitly out of scope for this doc:

- **Card-design vocabulary.** What "Recruit" means, what "Stealth" means — that's `DESIGN.md`.
- **Game-design principles.** When to print a card vs. use location text — that's `DESIGN_LESSONS.md`.
- **Specific card defs.** The cards that ship — that's `CARD_DESIGN.md` and `src/data/cards.js`.
- **Specific events emitted by specific effects.** Documented in the vocabulary table and per-mechanic notes — added as mechanics ship.

Update this doc when the architecture changes (new event semantics, new state-flow rules, new extension points). Don't update it for individual card additions.

---

## Migration plan from current code

The current `src/` has the scene queue attempt that hangs mid-combat. Rebuilding from a clean slate within the existing module structure:

**Phase 1 — keep:**
- `src/data/` (cards, worlds).
- `src/engine/state.js`, `config.js`, `log.js`, `stats.js`.
- `src/engine/legality.js`, `marks.js`, `quests.js`, `location-texts.js`, `tokens.js` — game logic, untouched.
- `src/engine/run.js` — overworld and encounter setup.
- The 52-test Vitest suite.
- `src/ui/registries.js` — persistent DOM identity.
- The FLIP machinery in `render.js` (capture / apply).
- Pile rendering using real card elements.

**Phase 2 — rewrite:**
- `src/engine/combat.js` — async runCombat with single yield per attacker.
- `src/engine/timeline.js` — async endOfPhaseRevealAndResolve with single yield per reveal event.
- `src/engine/phases.js` — async phase transitions.
- `src/engine/triggers.js` — fireFlipUpTrigger emits events along the way.
- `src/ui/animations.js` — handler registry, playEvents function.
- Delete `src/ui/scene.js` (replaced by the new playEvents in animations.js).

**Phase 3 — new:**
- `src/engine/profile.js` — slot profile data model and spatial query helpers.
- Apply default profile to all locations; verify behavior unchanged.
- Variant profiles per node, as new encounters are designed.

Tests guard the engine logic. Anything the existing tests cover (mark double-exile, face-down rule, combat ordering, suppress predicate, cost checking, stat math) continues to pass after the rewrite — that's the safety net.
