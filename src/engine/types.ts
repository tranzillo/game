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
  eventSubscriptions?: Array<{
    eventKind: string;
    handler: string;
    filter?: string;
  }>;

  // Where the card exits to on resolve (actions only). Default discard.
  exitTo?: "discard" | "graveyard" | "trash";

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
  flippedThisTurn: boolean;
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
  x: number;
  y: number;
  biome?: string;
  kind: "start" | "neutral" | "hostile" | "end";
  label: string;
  locationTextKey?: string;
  initialContent?: NodeInitialContent;
  status?: "unvisited" | "encountered";
  initialized?: boolean; // set true after materializeInitialNodeContent runs
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
export type EncounterOutcome = "playerCleared" | "playerLost" | "bossKilled" | "aiRetreated";

// Forward-declared shapes for fields Phase E+ will populate. Phase A keeps them empty/null-able.
export interface TimelineChip {
  chipId: number;
  cardInstId: InstId;
  side: Side;
  loc: string;
  kind: "creature" | "structure" | "action" | "equipment";
  posKey: PositionKey | null;
  hostInstId?: InstId;
  state: "future" | "resolved";
  cachedTempo: number;
}

export interface PastEntry {
  defKey: string;
  side: Side;
  loc: string;
  turn: number;
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
  turn: number;
  phase: Phase;
  subPhase: SubPhase;
  phaseQueue: Phase[];
  firstSide: Side;

  playerSide: SideState;
  aiSide: SideState | null;

  timeline: TimelineChip[];
  past: PastEntry[];

  flipQueues: {
    startOfPhase: TimelineChip[];
    midPhase: TimelineChip[];
    endOfPhase: TimelineChip[];
  };
  nextChipId: number;

  playerLocationCleared: Record<string, boolean>;
  outcome: EncounterOutcome | null;

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
  starterSeed: string;
  world: WorldState;
  cards: CardRegistry;
  trash: InstId[];
  currentEncounter: EncounterState | null;
  runOver: "playerWin" | "playerLose" | null;
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
