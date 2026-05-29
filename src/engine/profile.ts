// Slot profiles — authoring + spatial queries.
//
// Contract: ENGINE_SKETCH.md Phase A, REBUILD_PLAN §25.
//
// Position keys are opaque strings. Default profile uses "r0c0"-style internally; consumers
// MUST go through this module's iteration and query primitives. No hardcoded position arrays
// anywhere outside this file.

import type {
  GridShape,
  GridSpec,
  LocationProfile,
  PositionKey,
  ProfileSpec,
  SlotKind,
  SlotMap,
} from "./types.ts";

// ---------- Internal helpers ----------

function posKey(r: number, c: number): PositionKey {
  return `r${r}c${c}`;
}

function buildGridShape(spec: GridSpec): GridShape {
  const { rows, cols } = spec;
  if (rows < 1 || rows > 3 || cols < 1 || cols > 3) {
    throw new Error(`GridShape rows/cols must be 1..3; got ${rows}x${cols}`);
  }
  const locked = new Set<PositionKey>();
  if (spec.locked) {
    for (const { r, c } of spec.locked) locked.add(posKey(r, c));
  }
  const positions: PositionKey[] = [];
  const coords: Record<PositionKey, { r: number; c: number }> = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = posKey(r, c);
      coords[key] = { r, c };
      if (!locked.has(key)) positions.push(key);
    }
  }
  return { rows, cols, positions, coords, locked };
}

// ---------- Profile authoring ----------

/**
 * Build a profile from a spec. `structures` and `actions` default to 1×1 each.
 */
export function makeProfile(spec: ProfileSpec): LocationProfile {
  return {
    creatures: buildGridShape(spec.creatures),
    structures: buildGridShape(spec.structures ?? { rows: 1, cols: 1 }),
    actions: buildGridShape(spec.actions ?? { rows: 1, cols: 1 }),
  };
}

/**
 * The default profile per REBUILD_PLAN §10 / §25: 2×2 creatures + 1×1 structure + 1×1 action,
 * no locked cells.
 */
export function defaultProfile(): LocationProfile {
  return makeProfile({
    creatures: { rows: 2, cols: 2 },
  });
}

// ---------- Grid access by kind ----------

export function gridOf(profile: LocationProfile, kind: SlotKind): GridShape {
  switch (kind) {
    case "creature":
      return profile.creatures;
    case "structure":
      return profile.structures;
    case "action":
      return profile.actions;
  }
}

// ---------- Position iteration ----------

export function positionsOf(profile: LocationProfile, kind: SlotKind): PositionKey[] {
  return gridOf(profile, kind).positions;
}

export function frontRowPositions(profile: LocationProfile, kind: SlotKind): PositionKey[] {
  const g = gridOf(profile, kind);
  return g.positions.filter((p) => g.coords[p]!.r === 0);
}

export function backRowPositions(profile: LocationProfile, kind: SlotKind): PositionKey[] {
  const g = gridOf(profile, kind);
  const maxRow = g.rows - 1;
  return g.positions.filter((p) => g.coords[p]!.r === maxRow);
}

// ---------- Spatial queries (grid math) ----------

export function adjacentSameSide(
  profile: LocationProfile,
  kind: SlotKind,
  pos: PositionKey,
): PositionKey[] {
  const g = gridOf(profile, kind);
  const here = g.coords[pos];
  if (!here) return [];
  // Manhattan-1 neighbors that are in `positions` (unlocked).
  return g.positions.filter((p) => {
    if (p === pos) return false;
    const co = g.coords[p]!;
    return Math.abs(co.r - here.r) + Math.abs(co.c - here.c) === 1;
  });
}

export function sameRowNeighbors(
  profile: LocationProfile,
  kind: SlotKind,
  pos: PositionKey,
): PositionKey[] {
  const g = gridOf(profile, kind);
  const here = g.coords[pos];
  if (!here) return [];
  return g.positions.filter((p) => p !== pos && g.coords[p]!.r === here.r);
}

/**
 * Returns the position directly behind `pos` (same column, next row down). null if `pos` is
 * already in the back row, or the behind cell is locked.
 */
export function behind(
  profile: LocationProfile,
  kind: SlotKind,
  pos: PositionKey,
): PositionKey | null {
  const g = gridOf(profile, kind);
  const here = g.coords[pos];
  if (!here) return null;
  const targetR = here.r + 1;
  if (targetR >= g.rows) return null;
  const targetKey = `r${targetR}c${here.c}`;
  if (!g.positions.includes(targetKey)) return null;
  return targetKey;
}

/**
 * Returns all positions in the same column as `pos`, ordered front-to-back. Excludes locked cells.
 */
export function column(profile: LocationProfile, kind: SlotKind, pos: PositionKey): PositionKey[] {
  const g = gridOf(profile, kind);
  const here = g.coords[pos];
  if (!here) return [];
  const result: PositionKey[] = [];
  for (let r = 0; r < g.rows; r++) {
    const key = `r${r}c${here.c}`;
    if (g.positions.includes(key)) result.push(key);
  }
  return result;
}

/**
 * Combat targeting: scan enemy's column (same column index as `pos`) front-to-back; return the
 * first occupied position, or null if column is empty.
 *
 * Notes:
 * - `otherLc` is the SlotMap for the OPPOSING side at the same location.
 * - The profile is the SHARED profile (both sides share it per §25).
 * - Caller already knows the attacker is at `pos`; this returns the target POSITION KEY, not the InstId.
 */
export function across(
  profile: LocationProfile,
  kind: SlotKind,
  pos: PositionKey,
  otherLc: SlotMap,
): PositionKey | null {
  const g = gridOf(profile, kind);
  const here = g.coords[pos];
  if (!here) return null;
  const slots = kind === "creature" ? otherLc.creatures : kind === "structure" ? otherLc.structures : otherLc.actions;
  for (let r = 0; r < g.rows; r++) {
    const key = `r${r}c${here.c}`;
    if (!g.positions.includes(key)) continue;
    if (slots[key] != null) return key;
  }
  return null;
}

// ---------- Multi-slot footprint placement ----------

/**
 * Check whether a card's footprint (offsets from anchor) lands on a contiguous block of empty,
 * unlocked positions when anchored at `anchor`. Returns the actual position list, or null if any
 * position is locked / outside / occupied.
 *
 * `occupancy` is the SlotMap for the kind (or PendingSlotMap-compatible — same shape for the
 * field we use).
 */
export function footprintFitsAt(
  profile: LocationProfile,
  kind: SlotKind,
  footprint: Array<{ r: number; c: number }>,
  anchor: PositionKey,
  occupancy: SlotMap,
): PositionKey[] | null {
  const g = gridOf(profile, kind);
  const anchorCoord = g.coords[anchor];
  if (!anchorCoord) return null;
  const positions: PositionKey[] = [];
  for (const off of footprint) {
    const targetR = anchorCoord.r + off.r;
    const targetC = anchorCoord.c + off.c;
    if (targetR < 0 || targetR >= g.rows || targetC < 0 || targetC >= g.cols) return null;
    const key = `r${targetR}c${targetC}`;
    if (g.locked.has(key)) return null;
    if (!g.positions.includes(key)) return null;
    const slots = kind === "creature" ? occupancy.creatures : kind === "structure" ? occupancy.structures : occupancy.actions;
    if (slots[key] != null) return null;
    positions.push(key);
  }
  return positions;
}
