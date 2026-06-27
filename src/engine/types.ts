// Engine type definitions — Phase A foundation.
//
// Contract: ENGINE_SKETCH.md Phase A. Don't extend types beyond what Phase A needs without
// updating the sketch first.
//
// Discipline:
// - No `owner` field on CardInstance. Side membership is read from container (per REBUILD_PLAN §29).
// - No `acquired` flag. Acquisition is positional.
// - Origin distinguishes AI-deck cards from biome from player-deck cards; it's metadata, not ownership.

// ---------- Identifiers ----------

export type InstId = number;
export type PositionKey = string;
export type Side = "player" | "ai";
export type SlotKind = "creature" | "structure" | "action";
export type CardOrigin = "playerDeck" | "aiDeck" | "biome";
export type StatKind = "force" | "tempo" | "insight" | "resolve" | "spite";
export type Phase = "upkeep" | "draw" | "main" | "combat" | "cleanup";
export type SubPhase = "start" | "phase" | "end";

// Pile zones. Each side has its own; locations have a subset; trash is global.
export type SidePileZone = "deck" | "hand" | "discard" | "graveyard" | "junkyard";
export type LocationPileZone = "graveyard" | "junkyard";
export type PileZone = SidePileZone | "trash";

// ---------- Profiles ----------

export interface GridShape {
  rows: number; // 1..3
  cols: number; // 1..3
  positions: PositionKey[]; // unlocked positions in canonical iteration order
  coords: Record<PositionKey, { r: number; c: number }>;
  locked: Set<PositionKey>; // not in positions[]; UI/profile-authoring only
}

export interface LocationProfile {
  creatures: GridShape;
  structures: GridShape;
  actions: GridShape;
}

// Profile authoring input shape.
export interface GridSpec {
  rows: number;
  cols: number;
  locked?: Array<{ r: number; c: number }>;
}

export interface ProfileSpec {
  creatures: GridSpec;
  structures?: GridSpec; // default 1x1
  actions?: GridSpec; // default 1x1
}

// ---------- Costs ----------

export type CostRequirement =
  | { kind: "absolute"; stat: StatKind; amount: number }
  | { kind: "comparativeMore"; stat: StatKind }
  | { kind: "comparativeLess"; stat: StatKind }
  | { kind: "comparativeEqual"; stat: StatKind };

// ---------- Attack patterns ----------

export interface AttackPattern {
  kind: string; // "default" | "cleave" | "pierce" | "ranged" | ... (string-tag dispatch)
  value?: number; // pattern-specific: cleave 1 → secondaries take 1; pierce 1 → behind takes 1
  ammoCost?: number; // ranged only; default 1
  // setDamage: when present, this pattern deals exactly this much damage per target regardless
  // of the wielder's Force. Used by ranged equipment per §30: "A Bow with Force 1 turns a 0-Force
  // creature into a 1-damage ranged unit and a 4-Force giant into a 1-damage ranged unit." Only
  // applies to the printed pattern carrying setDamage — other patterns on the same wielder
  // (e.g., the wielder's own melee) still use their normal damage.
  setDamage?: number;
}

// ---------- Present-event subscriptions ----------
//
// Per REBUILD §32 / DECISIONS 2026-05-29: a card in play subscribes to "present-enter" events
// at a scope and (optional) filter. When a chip transits the Present, the dispatcher matches
// every face-up card's subscriptions against the event and fires handlers.

export interface PresentSubscription {
  // Where the event has to happen for this subscription to fire.
  //  - "this-location": event loc === subscriber loc
  //  - "this-side": event side === subscriber side (location-agnostic)
  //  - "opposing-side": event side !== subscriber side (location-agnostic)
  //  - "anywhere": no location/side filter
  scope: "this-location" | "this-side" | "opposing-side" | "anywhere";
  // Optional filter on the event card.
  filter?: {
    cardType?: "creature" | "structure" | "action" | "equipment";
    // Exclude the subscriber from triggering on its own flip-up. Default false — useful when a
    // card's onPresent would otherwise self-trigger on its own flip.
    excludeSelf?: boolean;
  };
  // Handler tag — same registry idea as onFlipUp / onLeavePlay.
  handler: string;
}

// ---------- Equipment grants ----------

export interface EquipmentGrant {
  stat: StatKind;
  amount: number;
  kind: "add" | "set"; // set overrides; Inert always wins
}

// ---------- Buffs ----------

export interface Buff {
  stat: StatKind;
  amount: number; // can be negative
  scope: "turn" | "encounter" | "permanent" | "equipped";
  sourceInstId?: InstId; // required for "equipped"; identifies the equipment that granted it
}

// ---------- Card defs ----------

export interface AiHints {
  preferFront?: boolean;
  preferBack?: boolean;
  // Free-form additions allowed; AI scoring reads optional fields.
  [k: string]: unknown;
}

export interface CardDef {
  defKey: string;
  name: string;
  type: "creature" | "structure" | "action" | "equipment";
  tribe?: string;
  text: string;
  costs: CostRequirement[];

  // CREATURE-ONLY printed stats (all optional, default 0)
  force?: number;
  tempo?: number;
  insight?: number;
  resolve?: number;
  spite?: number;
  durability?: number;

  // CREATURE-ONLY conditional buff flags
  pitFighterWhileAlone?: boolean;
  provocationChallenger?: boolean;
  apprenticeInsightFromActions?: boolean;
  manaRockAura?: boolean;
  inert?: boolean;
  enraged?: boolean;

  // STRUCTURE / multi-slot — footprint offsets from anchor (default [{r:0,c:0}])
  footprint?: Array<{ r: number; c: number }>;

  // EQUIPMENT
  grantsAttackPatterns?: AttackPattern[];
  grantsStats?: EquipmentGrant[];

  // Effect tags (string-tag dispatch)
  effect?: string; // action effect resolution
  onFlipUp?: string;
  onLeavePlay?: string;
  hooks?: Partial<Record<PhaseBoundary, string>>;
  aura?: { handlerTag: string };
  // Present-event subscriptions per REBUILD §32. When a chip enters the Present, the dispatcher
  // checks each in-play card's onPresent subscription against the event and fires matching
  // handlers inside the originating chip's span. Multiple subscriptions allowed; a card can
  // react to multiple kinds of present events.
  onPresent?: PresentSubscription[];
  // Legacy generic event subscription scaffold (Phase A). Reserved for onFutureEnter / onPast /
  // etc. once those land. Phase I uses onPresent specifically.
  eventSubscriptions?: Array<{
    eventKind: string;
    handler: string;
    filter?: string;
  }>;

  // STRUCTURE presence text per DECISIONS 2026-06-12 (stats are creature-only): a structure's
  // "+1 Force here" is a printed text-effect contributing flat presence to its OWN side's
  // location stat totals while face-up in play. NOT a stat field, NOT an aura.
  presenceGrants?: Array<{ stat: StatKind; amount: number }>;

  // Where the card exits to on resolve (actions only). Default discard.
  exitTo?: "discard" | "graveyard" | "trash";

  // Persistent action flag. When true, the action does NOT exit its slot after its onFlipUp
  // resolves. Instead it stays face-up in the action slot across turns, watching for its
  // persistence condition (printed elsewhere — Pray-N channel, Quest completion, Curse
  // migration, etc.). When the condition resolves, content code calls exitPersistentAction
  // to retire it. Per REBUILD §29: no new chip is emitted on exit (the Past entry from the
  // original flip already records the flip-up event).
  persistent?: boolean;

  // Built-in attack patterns on the card itself
  attackPatterns?: AttackPattern[];

  aiHints?: AiHints;
}

export type PhaseBoundary =
  | "onUpkeepStart"
  | "onUpkeepEnd"
  | "onDrawStart"
  | "onDrawEnd"
  | "onMainStart"
  | "onMainEnd"
  | "onCombatStart"
  | "onCombatEnd"
  | "onCleanupStart"
  | "onCleanupEnd";

// ---------- Card instances ----------

export interface CardInstance {
  instId: InstId;
  defKey: string;
  origin: CardOrigin;

  revealed: boolean;
  slots: PositionKey[]; // positions occupied in play; [] when not in play

  markCount: number; // 0 or 1; 2 triggers exile

  // Per-instance mutable state
  durability: number | null; // creatures only; null otherwise
  sleepCounter: number;
  wokeInPhase: Phase | null;
  skipAttackThisTurn: boolean;

  buffs: Buff[]; // stored buffs (turn / encounter / permanent / equipped scopes)

  // Equipment relationships
  equipment: InstId[]; // for hosts: attached equipment instIds
  attachedTo?: InstId; // for equipment: host instId
  grantedPatterns: Array<{ pattern: AttackPattern; sourceInstId: InstId }>;

  // Run-deck linkage (Phase L will use this; field exists for write-back)
  runDeckEntryRef?: number;

  // Escalating cost counters
  forageCasts?: number;
  mirrorCasts?: number;

  meleeAttackersThisTurn: InstId[];

  // Death pipeline
  pendingLeavePile: PileZone | null;
}

// ---------- Location state ----------

export interface SlotMap {
  creatures: Record<PositionKey, InstId | null>;
  structures: Record<PositionKey, InstId | null>;
  actions: Record<PositionKey, InstId | null>;
}

export interface PendingSlotMap {
  creatures: Record<PositionKey, InstId | null>;
  structures: Record<PositionKey, InstId | null>;
  actions: Record<PositionKey, InstId | null>;
  equipment: Record<InstId, InstId[]>; // keyed by host instId
}

// Persistent per-node state. Survives across encounters at that node.
export interface NodeState {
  profile: LocationProfile;
  sideSlots: { player: SlotMap; ai: SlotMap };
  locationPiles: { graveyard: InstId[]; junkyard: InstId[] };
  ammo: { player: number; ai: number };
}

// Transient encounter-scoped per-location state. Cleared on encounter end.
export interface EncounterLocationData {
  pending: PendingSlotMap;
  movedThisTurn: Set<InstId>;
  // Pending creature moves committed this main phase: creature instId → destination posKey.
  // A pending move is a "pending occupation" of the destination slot (same legality status as a
  // pending card placement — blocks other commits there) while the creature stays solid at its
  // source slot. Resolved in Tempo order at end of main; cleared each turn alongside movedThisTurn.
  pendingMoves: Map<InstId, PositionKey>;
}

// One entry in the end-of-main move-resolution queue. Exposes the ResolutionSortKey fields
// (cachedTempo / side / loc / posKey) so moves interleave with flip chips in one Tempo order.
export interface MoveResolutionEntry {
  instId: InstId;
  side: Side;
  loc: string;
  fromPos: PositionKey;
  toPos: PositionKey;
  cachedTempo: number;
  posKey: PositionKey;
}

// ---------- Side state ----------

export interface SideState {
  deck: InstId[];
  hand: InstId[];
  discard: InstId[];
  graveyard: InstId[];
  junkyard: InstId[];
  durability: number;
  actionsThisTurn: number;
}

// ---------- World ----------

export interface WorldNode {
  id: string;
  // Map grid coordinates per §34: y = tier (row of the run), x = column within the tier.
  // The map is a tiered grid; encounter locations are always next-tier nodes, rendered in
  // column (x) order at both zoom levels.
  x: number;
  y: number;
  biome?: string;
  kind: "start" | "neutral" | "hostile" | "end";
  label: string;
  locationTextKey?: string;
  initialContent?: NodeInitialContent;
  status?: "unvisited" | "encountered";
  initialized?: boolean; // set true after materializeInitialNodeContent runs
  // Overworld fog per §34: fog hides the CARDS at a location, never its text. Fog lifts at
  // encounter start, at exactly the encounter's locations; once lifted it doesn't return.
  // undefined/false = fogged (cards hidden); true = revealed.
  revealed?: boolean;
}

export interface NodeInitialContent {
  placements?: Array<{
    side: Side;
    kind: SlotKind;
    anchor: { r: number; c: number };
    defKey: string;
    origin: CardOrigin;
    equipWith?: string[];
  }>;
  initialPiles?: {
    graveyard?: string[];
    junkyard?: string[];
  };
}

export interface WorldState {
  pawnAt: string;
  nodes: WorldNode[];
  edges: Array<[string, string]>;
  nodeState: Record<string, NodeState>;
}

// ---------- Encounter state ----------

export type EncounterKind = "hostile" | "neutral" | "boss" | "mixed";
// `aiRetreated` was removed (DECISIONS 2026-06-13): summoner retreat is a state change / event
// (the summoner withdraws its presence + forces), NOT an encounter ending. Encounters end only
// via their locations (all non-summoner-defeat locations cleared / player lost) or a summoner
// defeat. `summonerDefeated` fires when an enemy summoner's run-scoped Durability hits 0 while
// cornered (retreat impossible — currently always, until the cornered-at-map-end gate is built).
export type EncounterOutcome =
  | "playerCleared"
  | "playerLost"
  | "bossKilled"
  | "summonerDefeated";

// Forward-declared shapes for fields Phase E+ will populate. Phase A keeps them empty/null-able.
// The single persistent timeline object (DECISIONS 2026-06-13). ONE chip element travels the
// whole L — Future → Present → Past — like a board card moving hand → slot → graveyard. It is
// run-scoped (lives in GameState.timeline, never cleared between encounters): a resolved chip
// stays forever as the same object and IS the Past record. It carries the timestamp axes
// (encounter, turn, phase) it needs for the Past headers / scope / cross-view link, stamped at
// emission.
export interface TimelineChip {
  chipId: number;
  cardInstId: InstId;
  side: Side;
  loc: string;
  kind: "creature" | "structure" | "action" | "equipment";
  posKey: PositionKey | null;
  hostInstId?: InstId;
  state: "future" | "present" | "resolved";
  cachedTempo: number;
  // Resolution order. Chips are appended to state.timeline in COMMIT order, but the Past must
  // read in FLIP (resolution) order — chips flip in sorted Tempo/initiative order, not commit
  // order. resolveSeq is a monotonic stamp assigned when the chip resolves (markChipResolved);
  // the Past query sorts resolved chips by it. Undefined until the chip resolves.
  resolveSeq?: number;
  // Timestamp axes, stamped at emitFutureChip. cardType lets the Past be queried like the old
  // PastEntry filter without re-deriving from the card def.
  encounter: number;
  turn: number;
  phase: Phase;
  cardType: "creature" | "structure" | "action" | "equipment";
}

export interface EngineEvent {
  id: number;
  kind: string;
  turn: number;
  phase: Phase;
  payload: Record<string, unknown>;
}

export interface ActiveSubscription {
  cardInstId: InstId;
  eventKind: string;
  handler: string;
  filter?: string;
}

export interface EncounterState {
  locationNodeIds: string[];
  encounterKind: EncounterKind;
  // This encounter's number on the run (= GameState.encounterCount at setup). Stamped onto
  // Past entries as the `encounter` timestamp axis.
  encounterNo: number;
  turn: number;
  phase: Phase;
  subPhase: SubPhase;
  phaseQueue: Phase[];
  firstSide: Side;

  playerSide: SideState;
  aiSide: SideState | null;

  // The timeline itself is run-scoped (GameState.timeline). The flip queues stay here — they're
  // transient resolution machinery holding chip references for THIS encounter's draining.
  flipQueues: {
    startOfPhase: TimelineChip[];
    midPhase: TimelineChip[];
    endOfPhase: TimelineChip[];
  };

  // Transient end-of-main move-resolution queue (sorted by the same Tempo comparator as flips).
  // Built when advancing out of main; drained INTERLEAVED with flipQueues.startOfPhase so moves
  // and flips resolve in one Tempo order. Empty outside the main-resolution drain.
  moveResolutionQueue: MoveResolutionEntry[];

  // The chip currently in the Present span (null when nothing is resolving). Both Card and
  // ChipStrip read this to render their synchronized "resolving" visual: the chip glows in
  // Present, and the card whose instId matches the present chip glows on the board. Set when
  // the orchestrator opens the present span; cleared when the span closes.
  resolvingChipId: number | null;

  // The attacker InstId currently swinging in combat resolution (null when not swinging).
  // Combat is a sibling resolution model to the Present span: each swing has its own glow
  // moment on the attacker. Set when the orchestrator opens a swing; cleared between swings.
  swingingAttackerInstId: number | null;
  // The target InstId currently taking the hit (null when not hitting). Read by Card.tsx to
  // flash damage. Set during the damage beat; cleared between swings.
  swingHitTargetInstId: number | null;
  // A creature whose pending move just FIZZLED (destination occupied at resolution). Set during the
  // move-resolution beat; cleared on a short follow-up beat. Read by Card.tsx for a recoil/dim — the
  // creature visibly "tried to move and got blocked" rather than silently staying put.
  fizzledMoveInstId: number | null;

  playerLocationCleared: Record<string, boolean>;
  outcome: EncounterOutcome | null;

  // Summoner retreat (DECISIONS 2026-06-13). The enemy summoner withdraws to survive rather than
  // die. `summonerDamageThisEncounter` accumulates unblocked fall-through damage to the summoner
  // this encounter (drives the instant tier-scaled cap). `summonerRetreated` is set once it
  // withdraws — its forces are removed and it is no longer present (no more fall-through to it),
  // but the encounter continues (locations drive the ending, not summoner presence).
  summonerDamageThisEncounter: number;
  summonerRetreated: boolean;

  locationData: Record<string, EncounterLocationData>;
  outcomes: EngineEvent[];
  activeSubscriptions: ActiveSubscription[];
}

// ---------- Run-deck entry ----------

export interface RunDeckEntry {
  defKey: string;
  mods: {
    markCount?: number;
    buffs?: Buff[];
    [k: string]: unknown;
  };
}

// ---------- Top-level game state ----------

export type CardRegistry = Record<InstId, CardInstance>;

export interface GameState {
  runDeck: RunDeckEntry[];
  runDurability: number;
  // Enemy summoner Durability — run-scoped (DECISIONS 2026-06-13: one summoner across zone 1,
  // damageable wherever present, Durability persists across encounters). The per-encounter aiSide
  // is seeded from this at setup and writes its survivor back at encounter end. Later zones track
  // Durability per live summoner; zone 1 is this single value.
  enemyDurability: number;
  // The enemy summoner's run-scoped deck (instIds). Like the player's, it persists across
  // encounters and cycles. Seeded once at run start; carried into aiSide at each encounter where
  // the summoner is present. Zone 1 = one summoner = this one deck.
  aiRunDeck: InstId[];
  starterSeed: string;
  world: WorldState;
  cards: CardRegistry;
  trash: InstId[];
  currentEncounter: EncounterState | null;
  runOver: "playerWin" | "playerLose" | null;
  // The timeline is run-scoped (DECISIONS 2026-06-13): ONE persistent chip per face-down card,
  // never cleared between encounters. A chip travels future → present → resolved and stays
  // forever — resolved chips ARE the Past. Replaces the old separate PastEntry list.
  timeline: TimelineChip[];
  // Monotonic chip id source — unique across the whole run (chips persist run-long).
  nextChipId: number;
  // Monotonic resolution-order source. Stamped onto a chip's resolveSeq when it resolves, so the
  // Past reads in flip order rather than commit order. Run-scoped like nextChipId.
  nextResolveSeq: number;
  // Monotonic counter stamped onto each new encounter at setup; the `encounter` timestamp axis.
  // Starts at 0; first encounter is 1.
  encounterCount: number;
}

// ---------- Card-location resolver ----------

export type CardLocation =
  | { container: "hand"; side: Side }
  | { container: "deck"; side: Side }
  | { container: "discard"; side: Side }
  | { container: "graveyard"; side: Side }
  | { container: "junkyard"; side: Side }
  | { container: "trash" }
  | {
      container: "slot";
      side: Side;
      loc: string;
      kind: SlotKind;
      positions: PositionKey[];
    }
  | {
      container: "locationPile";
      loc: string;
      pile: "graveyard" | "junkyard";
    }
  | {
      container: "pending";
      side: Side;
      loc: string;
      kind: SlotKind;
      positions: PositionKey[];
    }
  | {
      container: "pendingEquipment";
      side: Side;
      loc: string;
      hostInstId: InstId;
    }
  | { container: "attachedTo"; hostInstId: InstId };
