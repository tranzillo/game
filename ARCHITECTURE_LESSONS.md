# Architecture lessons

Meta-principles for *how* the code is structured, distilled from real iteration. Distinct from `DESIGN_LESSONS.md` (which is about game-design meta-principles). These are about implementation.

The biggest meta-lesson, holding the rest together:

> **One source of truth per piece of state.** When two systems independently track "the same thing" — what's happening, what's where, what's animating — diagnosing problems collapses. Every state machine needs exactly one writer and one home.

The rest of this doc unpacks specific principles, with worked examples from sessions that did and didn't follow them.

## 1. Mechanical refactors first, behavior changes second

When the codebase needs restructuring, don't bundle restructuring with new features. The two changes can't be verified together — if something breaks, you don't know which change caused it.

**Worked example:** splitting the 6500-line `index.html` into modules went well because it was a *pure mechanical move*. Every function ended up in a different file, but no logic changed. The 52-test suite stayed green throughout. Verification was trivial: same tests, same outputs.

**Counter-example:** the scene queue refactor mixed (a) splitting `playOutcomes` into a queue, (b) adding new outcome kinds (`deathwish-trigger`, `leave-play`), (c) reordering when state mutations happen in `applyCombatDamage`, and (d) coordinating FLIP with deferred animation. Four behavior changes layered together. When combat froze mid-encounter, none of the four could be ruled out as the cause; the tangle made it impossible to bisect.

**The rule:** every refactor should be one of (a) move code without changing it, or (b) change behavior in one well-defined dimension. Don't mix.

## 2. Tests are a safety net for refactors, not a verification of features

The Vitest suite (52 tests) was set up explicitly so the next refactor could be done with confidence. That's the right framing: tests catch *regressions in behavior we already had working*, not *bugs in behavior we just wrote*.

The tests didn't catch the scene queue freeze because the freeze was a new interaction that no test covered. But the tests also gave a clear signal that the engine's existing logic was untouched by the refactor — that's the *intended* use.

**The discipline:** when adding tests, target *load-bearing behavior we don't want to lose* (mark double-exile, face-down rule, combat ordering). Don't test things still in flux. Tests on flux-state lock in design decisions prematurely.

## 3. Live bindings + ES module cycles are fine for *function references*, not for state

ES modules' "live bindings" mean an `import { state } from "./state.js"` updates when `state` is reassigned via `setState()`. This works for the engine's shared mutable globals (`state`, `LOCATION_COUNT`).

But live bindings are *not* a license to have multiple modules write to the same state from different places. In the scene queue work, both `scene.js` (`_dyingInstIds.add()`) and the engine's `applyCombatDamage` (emits `death` outcome) had to coordinate so that FLIP's read of "is this card dying" matched the actual game state. Two writers, one piece of state, and the coordination wasn't centralized.

**The rule:** if a piece of state has multiple writers across modules, that's a code smell. The state belongs in one module that owns it, with explicit setter/getter API. Other modules call the API; they don't touch the storage.

## 4. Engine → UI is a clean direction; UI → engine for control flow is a code smell

The natural direction is: engine mutates state, emits events, calls render. UI reads state, draws.

In the scene queue attempt, this got inverted: the engine's beat loops called into `scene.drainScene(callback)` to gate when the *engine* could continue. The UI was driving the engine's pace. This is the inversion that made debugging impossible — when combat froze, was it the engine's fault or the UI's?

**A cleaner shape:** the engine produces a complete description of a "beat" (a Scene with timed steps) and hands it to the UI. The UI plays it; the engine waits on a *single* promise. The engine has no other knowledge of UI internals. The UI has no callbacks back into the engine. This direction enforces the single-direction data flow that makes the engine debuggable in isolation.

**Diagnostic:** if you find yourself writing `engine.js → import("./ui/...")` for anything other than `render()`, ask whether the UI should instead pull from the engine.

## 5. CSS animations on `transform` conflict with FLIP — design CSS around FLIP from the start

The FLIP animation pattern uses `transform: translate(dx, dy)` to make a reparented element *look* like it's still at its old position, then transitions to identity. Any CSS animation that ALSO writes to `transform` (shake, scale, rotate) will override FLIP mid-animation.

This caused two visible bugs:
- Cards moving from board to graveyard appeared to "jump" instead of slide, because `anim-death` keyframes were setting `transform: scale + rotate`, clobbering FLIP's translate.
- Shake animations on cards that also moved zones canceled the slide.

**The fix:** event animations use only non-transform properties — `outline`, `box-shadow`, `filter`, `opacity`, `background-color`. They compose with FLIP because they touch different properties.

**The rule for new animations:** reserve `transform` for FLIP exclusively. If an animation needs to scale or rotate, do it via a child element or via `filter: blur()` / `opacity` instead.

## 6. Persistent DOM identity is load-bearing for "the same card moved"

The persistent card DOM registry (`_cardRegistry: Map<instId, HTMLElement>`) is one of the highest-leverage architectural decisions in the codebase. Every card has *one* DOM element that survives across renders. When the card moves from slot to hand to graveyard, the same `<div>` reparents.

This is what makes FLIP work without any per-zone animation glue. The element's old screen position is captured, the DOM mutates, the element's new screen position is measured, and FLIP slides it from old to new — all without knowing or caring about the semantic move.

**The principle:** for any "thing in the game world" whose visual continuity matters across state changes, use a persistent DOM identity keyed by a stable ID. The DOM becomes the visual cache; the engine state is the source of truth.

This also implies: **don't render piles as separate "mini card" placeholders.** Render real card elements. Anything else loses the visual cycle that lets the player understand what's happening.

## 7. Diagnosability is a design constraint

The scene queue freeze couldn't be diagnosed because there was no single place to inspect "what is currently playing, what is queued, what is the engine waiting on." Four state machines had to be read together: outcomes, dying set, FLIP holds, played-outcome cursor. Worse, each was mutated from a different module.

**The diagnostic-first design:**

- Every queue should expose `current()`, `pending()`, and `history()` for inspection.
- Every state machine should have a single canonical representation that can be printed in one query.
- When a system blocks, it should be obvious *what it's waiting on* — typically by exposing the wait condition explicitly.

**The rule:** if you find yourself adding a watchdog timeout to break a freeze, stop. The watchdog is hiding a structural problem. Make the system diagnosable first.

## 8. Animation timing is design, not decoration

The instinct to "add animations as polish" is wrong for this game. Combat resolution, deathwishes, chip transit through the present — these aren't decorations on top of the engine's results. They are *how the player understands what happened.*

A creature dying without an in-place death beat and a slide-to-pile transition reads as "everything happened at once" — the player can't tell the order of events, which cards triggered, which cards were targeted. The animation IS the explanation.

This means animations need to be designed alongside the engine, not bolted on. The engine's beat structure (when does damage land? when does deathwish fire? when does the card leave the slot?) is also the animation's beat structure.

**The discipline:** when designing a new mechanic, ask *what does the player see happen, in what order, with what pacing?* If the answer isn't immediately clear, the mechanic isn't ready to print.

## 9. Architecture sketches before code, for non-trivial systems

The scene queue should have started as a written design — what data structure, what API, who owns what — before any code. Writing the code first led to a design that emerged from local fixes rather than coherent intent. Each addition (deathwish trigger, FLIP hold, dying set) made sense in isolation; together they tangled.

**The discipline:** for any system bigger than a few hundred lines that crosses module boundaries, write the architecture in conversation or in a doc first. Names of types, direction of data flow, ownership of state. Then implement. This is the equivalent of the design-conversation pattern from game design, applied to code.

## 10. Duplication is where rule-violations hide — one rule, one primitive

A game rule that must hold at many call sites (e.g. "face-down cards aren't valid targets") cannot be enforced by convention — by inlining the same `if (!card.revealed) continue` at each site. Every new call site is a chance to forget it, and the forgotten ones are silent: the code still runs, it just violates the rule.

**Worked example (2026-06-26):** "face-down can't be targeted" was inlined in some target-gathering loops and missing from ~7 others (Spark, Bombardment, combat, Bully push, trap deathwish, …). A playtest trace showed Spark hitting a face-down card. Fixing it meant routing *every* candidate-gather through one primitive (`enemyCreatureTargets` et al. in `targeting.ts`) where the face-up filter lives once. That sweep uncovered **two latent correctness bugs** — Goblin Bully pushing a face-down enemy, Explosive Trap damaging face-down adjacents — that existed *precisely because* the logic was hand-rolled instead of routed through the primitive. The duplication wasn't just ugly; it was where the rule violations lived.

**The discipline:** when a rule applies across many sites, build the predicate/gatherer once and make every site call it. The payoff isn't only DRY — it's that the rule becomes *enforceable* (you can't have a site that silently skips it) and *findable* (changing the rule is one edit). A handful of hand-rolled loops doing "the same thing" is a standing invitation for them to drift apart.

## 11. "Is this a primitive, or a disguised single-use function?"

A helper named like infrastructure but hardcoding one card's specifics is not a primitive — it's that card's effect with a misleading name. `dropTrapInSlot(state, side, loc, positions)` looked generic but hardcoded `"g_trap"` and was usable by exactly one card. The genuinely reusable operation was already there (`spawnTokenAt`, which takes any defKey); the only thing the wrapper added was fizzle-on-occupied, which belonged *on the primitive* so every token-spawning card gets it.

**The test for any content helper:** strip the card-specific constants (defKeys, stat names, magic numbers). If nothing reusable remains, it's not a primitive — inline it and name the constant at the call site. If something reusable *does* remain (placement math, a gather, a side-flip), that piece becomes/uses the primitive, and the card-specific value stays at the call site where it's legible.

Corollary — **the right split:** generic operation in the primitive (`spawnTokenAt`, `frontRowInColumn`→`column()[0]`, `opponentOf`), card-specific knowledge (which token, which slot) as a one-liner in the handler. A periodic audit with this lens (read content against the engine's exported primitive surface; flag inline re-implementations and hardcoded-into-generic helpers) is cheap and high-yield.

## 12. Emit outcomes from the one chokepoint every path flows through

To make effect *outcomes* observable (for a trace, the animation layer, or debugging), emit the event from the shared primitive all sources route through — not from each call site. `applyDamage` emits one `damage` event, so combat / action / deathwish / thorns are all captured uniformly with zero per-handler wiring; same for `applyBuff`→`buff`, `acquireCardTo`→`acquire`, etc. Emitting per-handler is the same duplication trap as #10/#11 — a new handler silently goes unlogged. The chokepoint is also where you get the *result* for free (what was hit, how much, whether it died), since that's where the work happens. `emit` no-ops cleanly without a subscriber, so this is safe in headless tests.

This composes with the read-only divergence-trace tooling (`src/ui/devtrace.ts`): a pure subscriber that formats the event stream into a transcript with per-phase board snapshots. Building observability *first* and using it to find bugs (rather than guessing from symptoms) was the highest-leverage move of the session — every face-down/targeting/ordering bug was found by reading a trace, not by inspection.

---

## Working notes for collaboration

- **Don't bandage freezes with timeouts.** A freeze is a structural signal. Find the root cause; if you can't find it in 30 minutes of inspection, stop and reconsider the architecture rather than adding a watchdog.
- **Backup before destructive refactors.** Archive branches preserve work cheaply (no risk to `main`). When in doubt, snapshot.
- **Module split is almost always safe; behavior changes almost never are without tests.** The order of operations: split first, write tests for the locked behavior, then change behavior.
- **The user values understanding-the-engine-state.** Export of game state, the past/future timeline visualization, persistent DOM moving between zones — these are all *legibility* features. Architecture decisions that make state less legible (out-of-band sets, hidden coordination, multiple writers) work against the user's grain.
