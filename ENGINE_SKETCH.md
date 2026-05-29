# Engine sketch

Implementation-level architecture sketches per build phase. Companion to REBUILD_PLAN.md §24, which defines the build order and stopping rules. REBUILD_PLAN §25–§33 are the design contract; this doc translates those surfaces into engine module types and primitive operations.

Capture discipline: the types and primitives below were worked through in conversation as the contract for engine implementation. They're the AL #9 architecture-sketches-before-code step. Code written should match these shapes; if implementation discovers a constraint that requires a different shape, stop and update this doc before changing code.

## Phase index

- Phase A — Slot profiles + state shape
- Phase B — Stats layer (effective reads, buffs, equipment grants)
- Phase C — Marks
- Phase D — Piles + routing + acquisition
- Phase E — Phases + sub-phases + flip queues + chips
- Phase F — Engine→store→UI boundary
- Phase G — Vertical slice (architecture validation)
- Phase H — Combat
- Phase I — Triggers + event subscriptions + persistent actions
- Phase J — Multi-location encounters
- Phase K — Win conditions + per-location clearing + shuffle-back
- Phase L — Run shape (overworld + run state)
- Phase M — Content port
- Phase N — Polish

---

## Phase A — Slot profiles + state shape

Implements §25. Foundation: every later phase depends on profiles being first-class and state shape being correct.

### Identifiers

```ts
type InstId = number;             // unique per card instance, monotonic per run
type PositionKey = string;        // opaque per-profile slot identifier
type Side = "player" | "ai";
type SlotKind = "creature" | "structure" | "action";
type CardOrigin = "playerDeck" | "aiDeck" | "biome";
type StatKind = "force" | "tempo" | "insight" | "resolve" | "spite";
type Phase = "upkeep" | "draw" | "main" | "combat" | "cleanup";
type PileZone = "deck" | "hand" | "discard" | "graveyard" | "junkyard" | "trash";
```

`PositionKey` is opaque. Default profile uses `"r0c0"`-style internally; consumers never parse it. The profile owns the relationship from `PositionKey` to `{r, c}` coordinates.

### Profiles

```ts
interface GridShape {
  rows: number;                                            // 1..3
  cols: number;                                            // 1..3
  positions: PositionKey[];                                // unlocked positions in canonical iteration order
  coords: Record<PositionKey, { r: number; c: number }>;
  locked: Set<PositionKey>;                                // locked cells (NOT included in positions[])
}

interface LocationProfile {
  creatures: GridShape;
  structures: GridShape;
  actions: GridShape;
}
```

Invariants:
- Both sides of a location share the profile.
- The profile is immutable for the encounter.
- `positions[]` is the canonical iteration order. `locked` is informational (for UI, profile authoring); locked cells are not in `positions`.
- Every iteration over creature positions goes through `creaturePositions(state, loc)` or the equivalent. No hardcoded position arrays.

### Card defs

```ts
interface CardDef {
  defKey: string;
  name: string;
  type: "creature" | "structure" | "action" | "equipment";
  tribe?: string;
  text: string;
  costs: CostRequirement[];

  // CREATURE-ONLY printed stats
  force?: number;
  tempo?: number;
  insight?: number;
  resolve?: number;
  spite?: number;
  durability?: number;

  // CREATURE-ONLY behavior flags (conditional buffs)
  pitFighterWhileAlone?: boolean;
  provocationChallenger?: boolean;
  apprenticeInsightFromActions?: boolean;
  manaRockAura?: boolean;
  inert?: boolean;
  enraged?: boolean;
  // ... (additional flags as content grows)

  // STRUCTURE / multi-slot — footprint as offsets from anchor
  footprint?: { r: number; c: number }[];   // default: [{r:0, c:0}]

  // EQUIPMENT — how it modifies the wielder
  grantsAttackPatterns?: AttackPattern[];
  grantsStats?: EquipmentGrant[];

  // ALL card types: effect dispatcher tags
  effect?: string;                          // action effect resolution handler
  onFlipUp?: string;                        // flip-up trigger handler
  onLeavePlay?: string;                     // leave-play trigger (deathwish) handler
  hooks?: Partial<Record<PhaseBoundary, string>>;
  aura?: { handlerTag: string };
  eventSubscriptions?: Array<{
    eventKind: string;
    handler: string;
    filter?: string;
  }>;
  exitTo?: "discard" | "graveyard" | "trash";  // action exit pile (default discard)

  // AI scoring hints
  aiHints?: AiHints;
}

type CostRequirement =
  | { kind: "absolute"; stat: StatKind; amount: number }
  | { kind: "comparativeMore"; stat: StatKind }
  | { kind: "comparativeLess"; stat: StatKind }
  | { kind: "comparativeEqual"; stat: StatKind };

interface AttackPattern {
  kind: string;          // "default" | "cleave" | "pierce" | "ranged" | etc.
  value?: number;        // pattern-specific (cleave 1 → secondaries take 1 damage; pierce 1 → behind takes 1)
  ammoCost?: number;     // ranged patterns; default 1
}

interface EquipmentGrant {
  stat: StatKind;
  amount: number;
  kind: "add" | "set";   // set overrides all other contributions to the stat
}
```

Invariants:
- Only creature defs carry stat fields. Non-creatures have no `force`, `tempo`, `insight`, `resolve`, or `spite` on their def.
- Structures, equipment, actions modify stats only via auras / hooks / equipment grants — not via printed stats.
- Set-grants override printed base, scoped buffs, conditional buffs, and add-grants for that stat. Inert always wins (locks stat to 0).
- Multiple set-grants on the same stat are avoided in content; engine doesn't define a tiebreaker.

### Card instances

```ts
interface CardInstance {
  instId: InstId;
  defKey: string;
  origin: CardOrigin;

  // No `owner` field. Side membership is read from container.
  // No `acquired` flag. Acquisition is positional.

  revealed: boolean;
  slots: PositionKey[];         // positions occupied in play; empty when not in play

  markCount: number;            // 0 or 1; 2 triggers exile

  // Per-instance mutable state
  durability?: number;          // creatures only
  sleepCounter: number;
  wokeInPhase: Phase | null;
  flippedThisTurn: boolean;
  skipAttackThisTurn: boolean;

  buffs: Buff[];                // stored buffs (turn / encounter / permanent / equipped scopes)

  // Equipment-related
  equipment: InstId[];          // for hosts: attached equipment instIds
  attachedTo?: InstId;          // for equipment: host instId
  grantedPatterns: Array<{ pattern: AttackPattern; sourceInstId: InstId }>;  // equipment grants to host

  // Run-deck linkage
  runDeckEntryRef?: number;     // index into runDeck for persistent mod write-back

  // Per-instance counters (escalating costs)
  forageCasts?: number;
  mirrorCasts?: number;

  meleeAttackersThisTurn: InstId[];

  pendingLeavePile: PileZone | null;
}

interface Buff {
  stat: StatKind;
  amount: number;               // can be negative
  scope: "turn" | "encounter" | "permanent" | "equipped";
  sourceInstId?: InstId;        // required for "equipped" scope; identifies the equipment that granted it
}
```

Invariants:
- A card with `slots: []` is not in play (in hand, pile, or trash).
- A multi-slot card has `slots` containing all positions it occupies (same `InstId` appears at each in the slot map).
- `origin` is set at instance creation and never mutates.
- `equipped`-scoped buffs require `sourceInstId` and are swept atomically when their equipment detaches.

### Location and side state

```ts
interface NodeState {
  // Persistent across encounters
  profile: LocationProfile;
  sideSlots: { player: SlotMap; ai: SlotMap };
  locationPiles: { graveyard: InstId[]; junkyard: InstId[] };
  ammo: { player: number; ai: number };     // per-side per-location, persists across encounters
}

interface SlotMap {
  creatures: Record<PositionKey, InstId | null>;
  structures: Record<PositionKey, InstId | null>;
  actions: Record<PositionKey, InstId | null>;
}

interface EncounterLocationData {
  // Transient — cleared at encounter end
  pending: PendingSlotMap;       // only player has pending; AI commits go straight to face-down
  movedThisTurn: Set<InstId>;    // resets at upkeep
}

interface PendingSlotMap {
  creatures: Record<PositionKey, InstId | null>;
  structures: Record<PositionKey, InstId | null>;
  actions: Record<PositionKey, InstId | null>;
  equipment: Record<InstId, InstId[]>;  // keyed by host instId, NOT position
}

interface SideState {
  deck: InstId[];
  hand: InstId[];
  discard: InstId[];
  graveyard: InstId[];
  junkyard: InstId[];
  durability: number;
  actionsThisTurn: number;
}
```

Invariants:
- `NodeState` lives in `WorldState.nodeState`. Persistent across encounters.
- `EncounterLocationData` lives in `EncounterState.locationData`. Transient.
- Equipment pending is keyed by host `InstId`, not by slot position — if the host moves, equipment follows.
- Per-side `ammo` persists across encounters as part of the location's run-state.

### Top-level game state

```ts
interface WorldState {
  pawnAt: string;
  nodes: WorldNode[];
  edges: [string, string][];
  nodeState: Record<string, NodeState>;
}

interface EncounterState {
  locationNodeIds: string[];
  encounterKind: "hostile" | "neutral" | "boss" | "mixed";
  turn: number;
  phase: Phase;
  subPhase: "start" | "phase" | "end";        // three sub-phases per phase, see Phase E
  phaseQueue: Phase[];                         // remaining phases this turn (mutable)
  firstSide: Side;                              // priority alternation per turn
  playerSide: SideState;                        // always present
  aiSide: SideState | null;                     // null when no AI-origin presence at encounter start
  timeline: TimelineChip[];                     // see Phase E
  past: PastEntry[];                            // see Phase E
  flipQueues: {
    startOfPhase: TimelineChip[];               // chips committed during start-of-phase
    midPhase: TimelineChip[];                   // chips spawned during phase substantive action
    endOfPhase: TimelineChip[];                 // chips spawned during end-of-phase hooks
  };
  nextChipId: number;
  playerLocationCleared: Record<string, boolean>;  // per §31; set at end of cleanup
  outcome: EncounterOutcome | null;
  locationData: Record<string, EncounterLocationData>;
  outcomes: EngineEvent[];                      // encounter event log
  activeSubscriptions: ActiveSubscription[];    // see Phase I
}

interface GameState {
  runDeck: RunDeckEntry[];
  runDurability: number;
  starterSeed: string;                          // "starter:red" today; extensible per §L
  world: WorldState;
  cards: Record<InstId, CardInstance>;           // global instance registry
  trash: InstId[];
  currentEncounter: EncounterState | null;
  runOver: "playerWin" | "playerLose" | null;
}

interface RunDeckEntry {
  defKey: string;
  mods: {
    markCount?: number;
    buffs?: Buff[];                             // permanent-scoped buffs
    // (additional persistent state as content grows)
  };
}
```

Invariants:
- `cards` is the canonical instance registry. Containers (slots, piles, hand) hold `InstId` only. This makes multi-slot cards trivially share identity and makes the engine's state shape easy to serialize.
- The engine reads `world.nodeState[nodeId]` during encounters; mutations land there directly (no encounter copy).
- `aiSide` is `null` when no AI-origin presence exists at any encounter location at setup. Once set, persists for the encounter.

### Phase A primitives

```ts
// Profile authoring
function defaultProfile(): LocationProfile;
function makeProfile(spec: ProfileSpec): LocationProfile;

// Position iteration
function positionsOf(profile: LocationProfile, kind: SlotKind): PositionKey[];
function frontRowPositions(profile: LocationProfile, kind: SlotKind): PositionKey[];
function backRowPositions(profile: LocationProfile, kind: SlotKind): PositionKey[];

// Spatial queries (grid math, all profile-aware)
function adjacentSameSide(profile, kind, pos): PositionKey[];
function sameRowNeighbors(profile, kind, pos): PositionKey[];
function behind(profile, kind, pos): PositionKey | null;
function column(profile, kind, pos): PositionKey[];
function across(profile, kind, pos, otherLc: SlotMap): PositionKey | null;

// Multi-slot placement
function footprintFitsAt(
  profile: LocationProfile,
  kind: SlotKind,
  footprint: { r: number; c: number }[],
  anchor: PositionKey,
  occupancy: SlotMap | PendingSlotMap,
): PositionKey[] | null;

// Slot reads against state
function slotOccupied(loc: NodeState, side: Side, kind: SlotKind, pos: PositionKey): boolean;
function cardAt(loc: NodeState, side: Side, kind: SlotKind, pos: PositionKey, cards: CardRegistry): CardInstance | null;
function allCardsAt(loc: NodeState, side: Side, kind: SlotKind, cards: CardRegistry): CardInstance[];  // deduped by instId

// Mutations
function placeAt(loc: NodeState, side: Side, kind: SlotKind, positions: PositionKey[], card: CardInstance, pending: boolean): void;
function removeFrom(loc: NodeState, side: Side, kind: SlotKind, card: CardInstance): void;

// Card instance creation
function createCardInstance(state: GameState, defKey: string, origin: CardOrigin): InstId;

// AI presence (per-location, dynamic — per §29)
function isAiPresentAt(state: GameState, nodeId: string): boolean;
// True iff any AI-origin card occupies AI's side slots at this location.

// Location accessor
function locationView(state: GameState, nodeId: string): {
  node: NodeState;
  enc: EncounterLocationData;
};

// Card location resolver
type CardLocation =
  | { container: "hand" | "deck" | "discard" | "graveyard" | "junkyard"; side: Side }
  | { container: "trash" }
  | { container: "slot"; side: Side; loc: string; kind: SlotKind; positions: PositionKey[] }
  | { container: "locationPile"; loc: string; pile: "graveyard" | "junkyard" }
  | { container: "pending"; side: Side; loc: string; kind: SlotKind; positions: PositionKey[] }
  | { container: "pendingEquipment"; side: Side; loc: string; hostInstId: InstId }
  | { container: "attachedTo"; hostInstId: InstId };

function findCardLocation(state: GameState, instId: InstId): CardLocation | null;
```

---

## Phase B — Stats layer

Implements §26. Layered, on-demand stat reads. No cached stat values.

### Effective stat read

```ts
function effectiveStat(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
  stat: StatKind,
): number;
```

Algorithm:
1. Non-creature → return 0.
2. Inert (any flag implies Inert behavior) → return 0 for F/T/I/R/S regardless of any other layer.
3. Start with printed base from def (`def[stat] ?? 0`).
4. Apply scoped buffs (sum `b.amount for b in card.buffs if b.stat === stat`).
5. Apply equipment add-grants from `grantedPatterns`-tracked equipment grants.
6. Apply conditional buffs from per-card flags (Pit-Fighter alone, Challenger, Apprentice, Mana Rock).
7. Apply reverse-buffs from opposing cards (Challenger reverse-buff).
8. Apply aura contributions via the aura-handler dispatch (sum contributions for matching auras).
9. Apply equipment set-grants — if any, override the running total with the set amount.
10. Sleep filter: if `card.sleepCounter > 0` and `stat === "force"`, return 0.

Pure; no side effects.

### Cost evaluation

```ts
function effectiveCosts(card: CardInstance, def: CardDef): CostRequirement[];
// Reads def.costs, applies per-instance escalation (forageCasts, mirrorCasts).

function evaluateCost(state, card, side, loc): boolean;
// True iff all of card's effective costs are satisfied at this side+location at commit moment.
// Absolute: committedStatTotal(side, loc, stat) >= amount.
// Comparative: committedStatTotal(side, loc, stat) vs committedStatTotal(other(side), loc, stat).
// Comparative-vs-opponent uses currently visible state; face-down opponent cards count as 0.
// Single check at cast — no resolve-time recheck.
```

### Per-location stat totals

```ts
function locationStatTotal(state: GameState, side: Side, loc: string, stat: StatKind): number;
```

For Force: sum of `effectiveStat(c, side, loc, "force")` over creatures passing the combat-eligibility predicate (face-up, not sleeping, not just-woke, positive Force, attack-clean, position-pattern-compatible).

For Tempo, Insight, Spite: sum of `effectiveStat(c, side, loc, stat)` over all face-up creatures at the location. Equipment grants flow through the creature's effective stat. Auras (from structures, location text, equipment) contribute via the aura layer in `effectiveStat`.

Resolve: not a per-location stat. Returns 0 if queried per-location.

```ts
function pendingStatTotal(state, side, loc, stat): number;
// Same shape but counts pending plays too. For display only.

function globalStatTotal(state: GameState, side: Side, stat: StatKind): number;
// Sums locationStatTotal across all encounter locations. Used for Insight (draw) and Resolve (kept hand size).
```

### Combat eligibility

```ts
function combatEligible(state: GameState, card: CardInstance, side: Side, loc: string): boolean;
// Same predicate that drives Force-at-location:
//   - revealed
//   - sleepCounter === 0
//   - wokeInPhase !== currentPhase
//   - effectiveStat(force) > 0
//   - !skipAttackThisTurn
//   - position-pattern compatible (melee front-row OR ranged back-row with ammo)
```

### Buff lifecycle

```ts
function applyBuff(state: GameState, card: CardInstance, buff: Buff): void;
// Mutates card.buffs. For permanent: also writes to card.runDeckEntry.mods.buffs.
// Inert filter: F/T/I/R/S buffs to Inert cards are silently dropped.
// For "equipped" scope: buff.sourceInstId must be set.

function revertTurnScopedBuffs(state: GameState): void;
// Filters scope === "turn" buffs from every CardInstance. Called at end of cleanup.

function revertEncounterScopedBuffs(card: CardInstance): void;
// Filters scope === "encounter" buffs. Called when card leaves play.

function sweepEquippedBuffs(state: GameState, equipmentInstId: InstId): void;
// Filters scope === "equipped" AND sourceInstId === equipmentInstId from every CardInstance.
// Called on equipment detach.
```

### Sleep / wake

```ts
function applySleep(card: CardInstance, turns: number): void;
function tickSleep(card: CardInstance): void;           // called at end of cleanup
function wakeFromDamage(card: CardInstance, phase: Phase): void;
```

### Effective attack patterns

```ts
function effectiveAttackPatterns(card: CardInstance, cards: CardRegistry): AttackPattern[];
// Returns def.attackPatterns + grantedPatterns (filtering by attached-still-equipped).
```

### Equipment attach / detach

```ts
function attachEquipment(state, equipment: CardInstance, host: CardInstance): void;
// Adds equipment.instId to host.equipment. Sets equipment.attachedTo = host.instId.
// For each grant in equipment.def.grantsStats: applyBuff(host, { stat, amount, kind, scope: "equipped", sourceInstId: equipment.instId }).
// For each pattern in def.grantsAttackPatterns: push to host.grantedPatterns with sourceInstId.

function detachEquipment(state, equipment: CardInstance, reason: "hostLeavePlay" | "explicit"): void;
// Removes from host.equipment. Clears attachedTo.
// sweepEquippedBuffs(state, equipment.instId).
// Filters host.grantedPatterns by sourceInstId.
// equipment routes to junkyard (unless location-text overrides).
```

---

## Phase C — Marks

Implements §27. Marks are a count. No kind. No marker. No intrinsic behavior.

```ts
function applyMark(state: GameState, card: CardInstance): "marked" | "exiled";
// If card.markCount === 0: increment to 1. Mirror to runDeckEntry.mods.markCount.
// If card.markCount === 1: exile path.
//   - Locate card via findCardLocation.
//   - Remove from current container (vacates slots if in play; splices if in pile/hand).
//   - addCardToTrash.
//   - If runDeckEntry: remove that entry from runDeck (permanent removal).
//   - Emit "mark-tear" event.
//   - No leave-play triggers.
```

Supporting:

```ts
function removeCardFromContainer(state, card, location: CardLocation): void;
function addCardToTrash(state, card): void;
```

Effects that read marks: query `card.markCount > 0` directly. No mark dispatcher.

Persistence: `runDeckEntry.mods.markCount` survives encounter cycle.

---

## Phase D — Piles + routing + acquisition

Implements §29's piles and routing rules.

### Pile zones

```ts
type SidePileZone = "deck" | "hand" | "discard" | "graveyard" | "junkyard";
type LocationPileZone = "graveyard" | "junkyard";

type PileTarget =
  | { kind: "sidePile"; side: Side; zone: SidePileZone }
  | { kind: "locationPile"; loc: string; zone: LocationPileZone }
  | { kind: "trash" };
```

### Routing decision

```ts
function routeOnLeavePlay(
  state: GameState,
  card: CardInstance,
  fromSide: Side,
  fromLoc: string,
  reason: LeavePlayReason,
): PileTarget;

type LeavePlayReason =
  | "creatureDied"
  | "structureDestroyed"
  | "equipmentDetached"
  | "actionResolved"
  | "explicitTrash"
  | "fromHandDiscard";
```

Algorithm:
1. If `reason === "explicitTrash"` → `{ kind: "trash" }`.
2. Compute base zone from reason:
   - `creatureDied` → graveyard.
   - `structureDestroyed`, `equipmentDetached` → junkyard.
   - `actionResolved` → discard (or override per `def.exitTo`).
   - `fromHandDiscard` → discard.
3. Determine target side. For death routing it's the side where the card is. For acquisitions: routing follows current side (no rerouting via origin).
4. If side has a SideState in this encounter AND the side is "present" at the location (per §29 / Phase A's `isAiPresentAt`) → `{ kind: "sidePile", side, zone }`.
5. Else → `{ kind: "locationPile", loc, zone }`.

For equipment with location-text override (`onEquipmentLeavesPlay` hook): consult the hook before defaulting. The hook can route the equipment to a different host's attachment instead of a pile.

### Apply routing

```ts
function sendToPile(state: GameState, card: CardInstance, target: PileTarget): void;
// Pushes card.instId onto target pile. Does NOT remove from current container; caller handles that.

function leavePlay(
  state: GameState,
  card: CardInstance,
  fromSide: Side,
  fromLoc: string,
  reason: LeavePlayReason,
): EngineEvent[];
// Full sequence:
//   1. Determine target via routeOnLeavePlay.
//   2. If card has equipment: detachEquipment for each.
//   3. Vacate card.slots positions.
//   4. revertEncounterScopedBuffs(card).
//   5. Fire leave-play triggers (deathwish via Phase I dispatch).
//   6. sendToPile(card, target).
//   7. Emit "leave-play" event.
```

### Acquisition

No `acquireCard` primitive. Acquisition is positional — the slot mutation that moves a card from one side's container to another's IS the acquisition. Per Phase A's `placeAt` / `removeFrom`.

### Encounter end pile resolution

```ts
function endEncounterPiles(state: GameState): void;
// For each side with a SideState:
//   - Walk in-play creatures + equipment in slots across all encounter locations.
//   - Walk hand + discard + graveyard + junkyard.
//   - Push InstIds back into deck. Shuffle.
//   - Write back persistent state (markCount, permanent buffs) to runDeckEntry.mods.
//   - Clear in-play slots.
// Structures stay where they are in nodeState.
// Location piles stay where they are.
// Trash stays.
// Per §31's shuffle-back is a turn-level mechanic (see Phase K); encounter-end is the broader cycle.
```

### Pre-authored content materialization

```ts
function materializeInitialNodeContent(state: GameState, nodeId: string): void;
// Idempotent on a node's `initialized` flag. Reads node.initialContent.
//   - For each placement: createCardInstance with the right origin. placeAt the slot.
//   - For each initialPiles entry: createCardInstance and push to locationPile.
```

### Within-encounter reshuffle

```ts
function reshuffleDiscardIntoDeck(state: GameState, side: Side): void;
// When deck is empty and a card needs to be drawn: discard → deck → shuffle → draw proceeds.
// Other piles (graveyard, junkyard) do NOT reshuffle mid-encounter.
```

---

## Phase E — Phases + sub-phases + flip queues + chips

Implements §28 with the three-sub-phase refinement and §32's chip + Past primitives.

### Phase model (corrected)

Each phase has three sub-phases:
1. **start** — interactive commit window. Both summoners commit cards (player via UI; AI synchronously at advance). Cards committed during this sub-phase emit chips to `flipQueues.startOfPhase`.
2. **phase** — automated substantive action. The phase's specific thing happens (upkeep ticks, draw cards, combat resolves, cleanup discards). Cards entering play via triggers during this sub-phase emit chips to `flipQueues.midPhase`. Player cannot commit from hand here.
3. **end** — non-interactive trigger window. End-of-phase hooks fire. Cards entering play via these hooks emit chips to `flipQueues.endOfPhase`.

At each sub-phase boundary, the corresponding flip queue drains. Order of drain: per the four-level hierarchy from §28 (Tempo desc → side priority by location Tempo total → location order → position rank).

Default phase queue per turn: `["draw", "main", "combat", "cleanup"]` (upkeep is the starting phase; the queue holds what follows). Mutable — cards/locations can insert/remove/reorder entries (no v1 content does this).

### Chip type

```ts
interface TimelineChip {
  chipId: number;
  cardInstId: InstId;
  side: Side;
  loc: string;
  kind: "creature" | "structure" | "action" | "equipment";
  posKey: PositionKey | null;     // null for equipment (no slot position; attached to host)
  hostInstId?: InstId;             // equipment only
  state: "future" | "resolved";
  cachedTempo: number;             // for sort; captured at commit
}
```

Tempo caching at commit:
- Creature chips: `effectiveStat(card, "tempo")` at commit.
- Non-creature chips: `locationStatTotal(side, loc, "tempo")` at commit.
- Once cached, tempo doesn't re-evaluate before sort.

### Past entry

```ts
interface PastEntry {
  defKey: string;
  side: Side;
  loc: string;
  turn: number;
  cardType: "creature" | "structure" | "action" | "equipment";
}
```

Order is implicit (append order). Encounter-scoped (cleared at encounter start).

### Primitives

```ts
function emitFutureChip(
  state: GameState,
  card: CardInstance,
  side: Side,
  loc: string,
  kind: TimelineChip["kind"],
  posKey: PositionKey | null,
  hostInstId: InstId | null,
): TimelineChip;
// Computes cachedTempo per the rule above. Routes the chip to the active sub-phase's queue
// (flipQueues.startOfPhase / midPhase / endOfPhase based on current state.encounter.subPhase).
// Appends to state.timeline (the unified chip stream) AND to the active sub-phase queue.

function resolveChip(state: GameState, chip: TimelineChip): EngineEvent[];
// 1. Look up card via cardInstId.
// 2. card.revealed = true.
// 3. chip.state = "resolved".
// 4. writePastEntry.
// 5. Fire flip-up trigger (Phase I dispatch).
// 6. If action: resolve action effect (Phase I). Route exit pile.
// 7. If persistent action: don't route; stays in slot face-up. Activate event subscriptions.
// 8. If equipment: attachEquipment to host (or fizzle to junkyard if host gone).
// 9. If creature/structure: stays in slot face-up. Activate event subscriptions.
// Returns events.

function runFlipQueue(state: GameState, queue: TimelineChip[]): EngineEvent[];
// Sorts queue by [tempo desc, side priority, location index, position rank].
// For each chip in order:
//   - Check suppression: if action AND location text declares suppressAction returning true → skip
//     (chip stays in queue; re-checked next sub-phase boundary).
//   - resolveChip.
// Returns collected events.

function writePastEntry(state: GameState, card: CardInstance, side: Side, loc: string): void;

function pastEntriesMatchingFilter(state: GameState, filter: PastFilter): PastEntry[];
```

### Phase advance orchestration

```ts
// Engine-level pure functions:
function setSubPhase(state: GameState, subPhase: "start" | "phase" | "end"): void;
function popPhase(state: GameState): void;                  // dequeues next phase
function startNewTurn(state: GameState): void;              // sets turn++, firstSide alternates, phase = "upkeep", phaseQueue = standard 4

// Store-level orchestrator (per §24 — pure engine functions called from store layer):
// advancePhase() drives the sub-phase transitions via beat chain.
```

### Phase boundary firing

Per Phase I (event subscriptions and trigger handlers), these fire at sub-phase boundaries:
- Start of phase boundary: `on{Phase}Start` hooks fire BEFORE play window opens.
- End-of-start-sub-phase → drain `startOfPhase` queue.
- End-of-phase-sub-phase → drain `midPhase` queue.
- Start of end-sub-phase: `on{Phase}End` hooks fire BEFORE end queue drains.
- End-of-end-sub-phase → drain `endOfPhase` queue → transition to next phase.

---

## Phase F — Engine→store→UI boundary

Implements §19 / §21. Three layers with strict contracts.

### Engine event boundary

```ts
interface EngineEvent {
  id: number;
  kind: string;
  turn: number;
  phase: Phase;
  payload: Record<string, unknown>;
}

type EventHandler = (ev: EngineEvent) => void;

function subscribe(handler: EventHandler): void;            // single handler, registered at boot
function emit(state: GameState, kind: string, payload: Record<string, unknown>): EngineEvent;
function resetEvents(state: GameState): void;               // called at encounter start
```

Per §21:
- Synchronous emit. Handler runs to completion before emit returns.
- Single handler — replaces previous on subsequent subscribe calls.
- Handler must not block; can dispatch to internal multiplexers if needed.
- Headless mode (no handler): events still push to state.outcomes for the log.

### Store (Zustand)

```ts
interface StoreShape {
  tick: number;
  notify: () => void;
}

function getState(): GameState | null;                      // returns engine state
function notifyStateChanged(): void;                         // bumps tick
function useGameState(): GameState | null;                   // React hook

// Store-level actions wrap engine calls + bump tick:
function actionSelectCard(instId: InstId | null): void;
function actionPlaceCard(card: CardInstance, target: PlacementTarget): boolean;
function actionCancelPending(side, loc, kind, posKey?, hostInstId?): void;
function actionAdvancePhase(): void;
function actionLoadEncounter(nodeIds: string[]): void;
function actionLoadRun(deckColor: string): void;
```

### Beat scheduler

```ts
function isPlaying(): boolean;
function setSpeed(mult: number): void;
function getSpeed(): number;
function runBeat(durationMs: number, next: () => void): void;
function cancelAllBeats(): void;

// Store-level helper:
function runBeatN(durationMs: number, next: () => void): void;
// Wraps runBeat; calls notifyStateChanged after next() runs.
```

### Animation handler

```ts
interface AnimationState {
  cardAnimations: Map<InstId, { shake?: boolean; damage?: boolean; death?: boolean; flip?: boolean }>;
}

function registerAnimationHandler(): void;
// Subscribes single handler. Dispatches by ev.kind to AnimationState mutations.
// Components read AnimationState via small reactive layer (separate from gameState).
```

### UI selection state

UI-only state (e.g., selectedCardId) lives in the store layer, NOT in EncounterState. Game state is pure rules truth.

---

## Phase G — Vertical slice

The architecture validation moment. Per §24's stopping rule, must pass before Phase H+.

Scope:
- One default-profile location.
- 2–3 creature defs in hand (one with a tiny `onFlipUp`, like "draw 1").
- One phase (main → flip → main loop).
- No combat, no piles routing, no AI presence, no win conditions.

Components built (from Phases F primitives):
- `App.tsx`, `Location.tsx`, `Slot.tsx`, `Card.tsx` (Framer Motion `layout`), `Hand.tsx`, `ChipStrip.tsx`, `Controls.tsx`.

Validation criteria:
1. Persistent DOM identity via `<Card key={instId} layout />`.
2. Framer slide between hand and slot.
3. No teleports.
4. No animation clobber (CSS animations use non-transform properties; Framer owns transform).
5. Beat chain doesn't hang.
6. Click-gate via `isPlaying()` works.

Validation method: manual playtest in dev server. Stopping rule applies — if validation criteria fail, find the architectural cause and fix before Phase H+.

---

## Phase H — Combat

Implements §30. Pure damage application + attack resolution.

### Attack pattern handlers

```ts
type AttackPatternHandler = (
  state: GameState,
  attacker: CardInstance,
  attackerSide: Side,
  attackerLoc: string,
  attackerPos: PositionKey,
  pattern: AttackPattern,
) => DamageInstance[];

interface DamageInstance {
  targetSide: Side;
  targetLoc: string;
  targetPos?: PositionKey;       // null for fall-through to summoner
  amount: number;                 // can be negative (healing)
  kind: "melee" | "ranged" | "spite" | "action";
  sourceLabel: string;
}

const PATTERN_HANDLERS: Record<string, AttackPatternHandler> = {
  default(state, attacker, ...): DamageInstance[] { /* across-column, front-to-back; fall-through */ },
  cleave(state, attacker, ...): DamageInstance[] { /* main + adjacent same-row, secondaries take pattern.value */ },
  pierce(state, attacker, ...): DamageInstance[] { /* main + behind, behind takes pattern.value */ },
  ranged(state, attacker, ...): DamageInstance[] { /* same column targeting; bypasses front block */ },
};
```

### Combat order

```ts
interface CombatAttacker {
  instId: InstId;
  side: Side;
  loc: string;
  pos: PositionKey;
  effectiveTempo: number;
}

function computeCombatOrder(state: GameState): CombatAttacker[];
// Per §28: tempo desc → location index → position rank → side priority on remaining ties.
```

### Damage application (batch, simultaneous)

```ts
function applyAttackPattern(state, attacker, pattern): EngineEvent[];
// 1. Handler computes batch of DamageInstance against pre-damage state.
// 2. If ranged: decrement ammo at location for attackerSide.
// 3. Apply all damage instances simultaneously:
//    - For each: subtract amount from durability (clamped to 0 on min; clamped to durabilityMax on heal).
//    - Apply damage modifier handlers (consulted from aura layer; e.g., mark-payoff effects).
//    - Apply Enraged on damage (wakeFromDamage; +1 Force per damage instance taken).
//    - If durability drops to ≤ 0: set pendingLeavePile = "graveyard". Emit "death" event.
//    - Negative damage (heal): durability += abs(amount), clamped. No death check.
// 4. Compute Spite retaliations after batch:
//    - For each defender in the batch whose durability dropped (positive damage that didn't kill):
//      - If dmg.kind === "melee" AND defender.alive after batch:
//        - Apply per-instance Spite damage on attacker (effective Spite of the defender).
//        - Spite damage doesn't trigger Spite (kind: "spite").
// 5. Summoner fall-through:
//    - If batch had damage routed to opposing summoner AND opposing side has summoner with Durability:
//      - Apply that damage to durability.
//      - If kind: "melee": also apply per-location Spite total damage on attacker (sum of all face-up creatures' + structures' effective Spite at the location).
//    - If no opposing summoner with Durability (hostile non-boss, neutral): fall-through fizzles.
//      No damage event. No Spite.
// 6. Emit events; return.
```

Damage modifiers (mark-payoff, future content):

```ts
type DamageModifierHandler = (
  state: GameState,
  source: CardInstance,
  sourceSide: Side,
  sourceLoc: string,
  damage: DamageInstance,
  context: { isMarked: boolean; targetType: string },
) => number;

const DAMAGE_MODIFIER_HANDLERS: Record<string, DamageModifierHandler> = {};
```

Applied during the damage application step before durability mutation. Multiple modifiers sum.

### Death finalization (two-beat)

```ts
function finalizeDeath(state: GameState, card: CardInstance): EngineEvent[];
// Phase D's leavePlay with reason: "creatureDied". Fires deathwish before slide.
// Called by store orchestrator one beat after damage applied (the two-beat death from §17).
```

### Movement during phases

Per §28: movement allowed in main and combat phases. One move per creature per turn. Tracked via `nodeState.movedThisTurn`.

```ts
function moveCreature(state, card, fromLoc, fromPos, toLoc, toPos): boolean;
// Validates same-side move, target slot empty, hasn't moved this turn. Mutates slot maps.
```

---

## Phase I — Triggers + event subscriptions + persistent actions

Implements trigger / handler infrastructure shared by all later content.

### Handler context

```ts
interface HandlerContext {
  state: GameState;
  sourceInstId: InstId | null;
  sourceSide?: Side;
  sourceLoc?: string;
  trigger?: string;
  eventData?: Record<string, unknown>;
}
```

### Registries

```ts
const FLIP_UP_HANDLERS: Record<string, (ctx: HandlerContext) => void> = {};
const PHASE_HOOK_HANDLERS: Record<string, (ctx: HandlerContext) => void> = {};
const LEAVE_PLAY_HANDLERS: Record<string, (ctx: HandlerContext) => void> = {};
const ACTION_EFFECT_HANDLERS: Record<string, (ctx: HandlerContext) => void> = {};
const AURA_HANDLERS: Record<string, AuraHandler> = {};
const EVENT_SUBSCRIPTION_HANDLERS: Record<string, (ctx: HandlerContext) => void> = {};
const EVENT_SUBSCRIPTION_FILTERS: Record<string, (ctx: HandlerContext) => boolean> = {};
```

Content modules populate these at boot.

### Trigger dispatchers

```ts
function fireFlipUpTrigger(state: GameState, card: CardInstance, side: Side, loc: string): EngineEvent[];
// Calls FLIP_UP_HANDLERS[card.def.onFlipUp] if defined.
// Also fires location text's onFlipUp hook.
// Emits "trigger-fire" event.

function fireLeavePlayTrigger(state: GameState, card: CardInstance, side: Side, loc: string): EngineEvent[];
function firePhaseBoundary(state: GameState, boundary: PhaseBoundary): EngineEvent[];
function resolveActionEffect(state: GameState, card: CardInstance, side: Side, loc: string): EngineEvent[];
```

### Event subscriptions

```ts
interface ActiveSubscription {
  cardInstId: InstId;
  eventKind: string;
  handler: string;
  filter?: string;
}

function activateCardSubscriptions(state: GameState, card: CardInstance): void;
// Called when card enters play. Pushes def.eventSubscriptions to activeSubscriptions.

function deactivateCardSubscriptions(state: GameState, card: CardInstance): void;
// Called when card leaves play. Filters out this card's entries.

function fireMatchingSubscriptions(state: GameState, ev: EngineEvent): EngineEvent[];
// Called by emit() after the event is pushed.
// For each active subscription matching ev.kind:
//   - Check filter (if any).
//   - Call handler with HandlerContext.
// Subscriptions fire in combat-order: tempo + position + side priority.
// Cards in pile/hand can subscribe (design space) but v1 content doesn't use this.
```

### Persistent action lifecycle

```ts
function exitPersistentAction(state: GameState, card: CardInstance, side: Side, loc: string): EngineEvent[];
// 1. deactivateCardSubscriptions.
// 2. Vacate action slot.
// 3. Route to exit pile (default discard).
// 4. Emit "leave-play".
```

A persistent action's first flip resolves normally (chip → past). The action stays face-up in its slot. Its event subscriptions activate at flip. When the action's persistence condition is met (a subscription handler decides), `exitPersistentAction` fires.

---

## Phase J — Multi-location encounters

Lifts LOCATION_COUNT from 1 to N. Most primitives already loc-parameterized.

### Primitives

```ts
function locationIndex(state: GameState, nodeId: string): number;
function eachEncounterLocation(state: GameState): string[];
function isAiPresentAnywhere(state: GameState): boolean;

function activeLocationTextMode(state: GameState, loc: string): "peace" | "war";
// "war" iff AI is present at loc AND location text declares warMode override.

function effectiveLocationText(state: GameState, loc: string): LocationText;
// Returns location text with war mode overrides applied (war replaces peace entirely).
```

Combat order and flip queues already iterate across locations naturally — sorting by location index handles N>1.

War mode replaces peace mode entirely when AI present (per §J locked rule).

---

## Phase K — Win conditions + per-location clearing + shuffle-back

Implements §31 with the per-location-clearing refinement.

### State

```ts
interface EncounterState {
  // ...
  playerLocationCleared: Record<string, boolean>;  // per location; set at end of cleanup
  outcome: EncounterOutcome | null;
}

type EncounterOutcome = "playerCleared" | "playerLost" | "bossKilled" | "aiRetreated";
```

### Check functions

```ts
function checkPlayerCleared(state: GameState): boolean;
// True iff every encounter location is either:
//   (a) playerLocationCleared[loc] === true, OR
//   (b) part of a boss encounter where boss-killed has fired (rolled into "bossKilled").
// For pure non-boss encounters: all locations cleared.

function checkPlayerLost(state: GameState): boolean;
// player summoner durability ≤ 0.

function checkBossKilled(state: GameState): boolean;
// Boss encounter AND boss summoner durability ≤ 0.

function checkAiRetreat(state: GameState): boolean;
// Hostile encounter, no AI living creatures anywhere in encounter, no reinforcements this turn.
// Reinforcement tracked via per-turn flag: aiSide.committedThisTurn cleared at end of cleanup.

function clearStatusAtLocation(state: GameState, loc: string): boolean;
// True iff opposing side has no creatures at this location (positional check; origin irrelevant).
// Only applies to non-boss locations.
```

### End-of-cleanup orchestration

```ts
function runEndOfCleanup(state: GameState): EngineEvent[];
// 1. Revert turn buffs (Phase B).
// 2. Tick sleep (Phase B).
// 3. Reset per-turn counters (actionsThisTurn, committedThisTurn).
// 4. Discard down to Resolve-kept (per global Resolve).
// 5. Fire onCleanupEnd hooks.
// 6. Drain end-of-cleanup queue.
// 7. For each encounter location: clearStatusAtLocation → if newly true:
//    - Set playerLocationCleared[loc] = true.
//    - shuffleBackPlayerCommitsAtLocation(loc):
//      - For each player creature, equipment, persistent action at this location's player slots:
//        push instId back into playerSide.deck.
//      - Structures stay in nodeState.
//      - Vacate the slots.
//    - Emit "location-cleared" event.
// 8. Check outcomes:
//    - playerLost → outcome = "playerLost".
//    - All locations cleared / boss killed → outcome = "playerCleared" or "bossKilled".
//    - aiRetreated → outcome = "aiRetreated".
//    - Else turn advances.
```

### Per-damage boss check

```ts
function checkBossKilledImmediate(state: GameState): boolean;
// Called by orchestrator after every damage event in boss encounters.
// If true: set outcome, halt beat chain, transition to run-win flow.
```

### Encounter end transition

```ts
function endEncounter(state: GameState, outcome: EncounterOutcome): EngineEvent[];
// 1. If run-ending (bossKilled / playerLost): set state.runOver. Halt.
// 2. Else (playerCleared / aiRetreated): endEncounterPiles (Phase D).
// 3. Clear currentEncounter = null. Return to overworld.
```

---

## Phase L — Run shape

Implements §3, §7 (deferred), the overworld + run state.

### Run start

```ts
function startRun(state: GameState, seed: string): void;
// 1. Build world from template.
// 2. Build runDeck from seed (lookup "starter:red" → starter pool; future: seeded random decks per §L vision).
// 3. Set runDurability to start value (20).
// 4. Materialize initial node content for nodes with NodeInitialContent.
// 5. Set pawnAt = startNode.
// 6. currentEncounter = null. View = overworld.
```

### Overworld navigation

```ts
function legalMoves(state: GameState): string[];
// Adjacent nodes either unvisited (encounter trigger) or visited (walk only).

function moveTo(state: GameState, nodeId: string): void;
// If nodeId === pawnAt → trigger encounter (unvisited adjacents pulled in).
// Else if visited → walk pawn there (no encounter).
// Else → illegal.

function startEncounter(state: GameState, fromNodeId: string): void;
// Per Phase A's startEncounter. Pulls in unvisited adjacents from fromNodeId.
// Builds EncounterState; sets currentEncounter; view = encounter.
```

### Supply lines (deferred)

V1 does not implement supply-line effects. Engine data shape supports it (structures persist in `nodeState`); future implementation walks the pawn's traversed path and applies scoped structures to current encounter reads.

### AI pre-spread (deferred)

V1 uses pre-authored `NodeInitialContent`. Future may add simulated spread mutating `nodeState` between encounters.

### Seeded decks (long-term vision)

V1: `seed: "starter:red"` → lookup table.

Future: seed encoding for color-picker positions, randomized decks, bookmarked seeds. Engine consumes the seed identifier; deck-building logic is pluggable.

---

## Phase M — Content port

Mechanical port of `archive/v0-prototype/src/data/*.js` to TS modules matching the locked types.

### Module layout

```
src/data/
  cards/red.ts        # r1-r14
  cards/green.ts      # g1-g8
  cards/blue.ts       # b1-b10
  cards/tokens.ts     # g_trap, b_fire_golem, etc.
  worlds.ts           # bipartite map per §22
  location-texts.ts   # locP1, locP2, locP3 starters
  starter-decks.ts    # seed lookups
  effects.ts          # ACTION_EFFECT_HANDLERS
  triggers.ts         # FLIP_UP_HANDLERS, LEAVE_PLAY_HANDLERS
  auras.ts            # AURA_HANDLERS
  subscriptions.ts    # EVENT_SUBSCRIPTION_HANDLERS, FILTERS
```

### Per-card verification

For each card def being ported:
1. Verify card text matches a locked design surface.
2. Verify each handler tag has an implementation in the relevant registry.
3. Apply shape changes (e.g., ranged equipment moves from pattern `setsForce` to grant `kind: "set"`).
4. If a card relies on a removed concept (e.g., reroute-as-baked-into-marks): **stop and have a design conversation**. Capture decision into REBUILD_PLAN. Then resume.

Phase M discipline (per AL #9): if the design doesn't cover a card's mechanic, stop — don't extrapolate. Per the user's confirmation: option (c) — design conversation per problem card.

---

## Phase N — Polish

- XP / leveling per REBUILD_PLAN §8 (in scope for v1).
- Speed multiplier tuning.
- CSS polish.
- UI affordances: drag-to-place, pile click-to-view, legal-target highlights, tooltips.
- Persistence: save/load to localStorage (not required for v1 but quality-of-life).

No new design surface; refinement of existing.

---

## Cross-references

- Design contract: REBUILD_PLAN.md §25–§33.
- Architectural lessons that shaped these sketches: ARCHITECTURE_LESSONS.md (AL #1 mechanical-vs-behavior split, AL #3 single-source-of-truth, AL #5 transform-ownership, AL #6 persistent-DOM-identity, AL #9 sketches-before-code).
- Phase build order, stopping rules: REBUILD_PLAN.md §24.

## Update discipline

This doc is the contract for engine code. Code should match these shapes; if implementation discovers a constraint requiring a different shape, the stopping rule applies — update this doc before writing code that diverges. Diff-and-decide, never silently drift.
