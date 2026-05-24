// Location slot profiles.
//
// Each encounter location has a profile that defines its spatial shape. The profile is the
// authority on what positions exist, what shape the grid is, and which cells are locked.
// All spatial queries (adjacency, front/back row, opposite column, etc.) consult the profile.
//
// Per ARCHITECTURE.md, profiles are bounded rectangular grids:
//   - rows ∈ {1, 2, 3}, cols ∈ {1, 2, 3}
//   - cells inside the grid can be `locked` (present but unusable)
//   - kinds (creatures, structures, actions) each have their own grid
//
// Position keys are opaque strings. The default profile uses the legacy "fl"/"fr"/"bl"/"br"
// names so the existing codebase (card defs, tests, exports, run-deck mods) keeps working
// without sweeping renames. The profile maps position strings ↔ {row, col} coordinates;
// spatial queries are pure grid math against coordinates.
//
// Variant profiles can use whatever position strings make sense — the strings are opaque
// keys; only the profile knows their geometry.

// --- Default profile (today's 2x2 creatures + 1 structure + 1 action) ---
//
// Coordinate convention: row 0 = front, row 1 = back. Column 0 = left, column 1 = right.
// Position key naming preserves the legacy mnemonic: f=front, b=back, l=left, r=right.

const DEFAULT_CREATURE_COORDS = {
  fl: { r: 0, c: 0 },
  fr: { r: 0, c: 1 },
  bl: { r: 1, c: 0 },
  br: { r: 1, c: 1 }
};

const DEFAULT_STRUCTURE_COORDS = {
  // Single structure slot at row 0, col 0. The legacy code uses lc.structure (a scalar),
  // so the slot key here is informational; the profile's spatial helpers don't drive
  // structure layout yet (single slot is unambiguous).
  s1: { r: 0, c: 0 }
};

const DEFAULT_ACTION_COORDS = {
  a1: { r: 0, c: 0 }
};

export const DEFAULT_PROFILE = {
  creatures: {
    rows: 2,
    cols: 2,
    locked: new Set(),                       // no locked cells
    positions: Object.keys(DEFAULT_CREATURE_COORDS),   // ordered list of position keys
    coords: DEFAULT_CREATURE_COORDS          // pos → {r, c}
  },
  structures: {
    rows: 1,
    cols: 1,
    locked: new Set(),
    positions: Object.keys(DEFAULT_STRUCTURE_COORDS),
    coords: DEFAULT_STRUCTURE_COORDS
  },
  actions: {
    rows: 1,
    cols: 1,
    locked: new Set(),
    positions: Object.keys(DEFAULT_ACTION_COORDS),
    coords: DEFAULT_ACTION_COORDS
  }
};

// --- Profile lookup ---
//
// Locations carry a profile at encounter-load time. Until variant profiles ship, every
// location uses DEFAULT_PROFILE. The state.locationProfiles array is parallel to LOC_NAMES.

// Returns the profile for a given location index. Falls back to DEFAULT_PROFILE if no
// profile is set (transitional safety while variant profiles roll in).
export function profileFor(state, loc) {
  if (state && state.locationProfiles && state.locationProfiles[loc]) {
    return state.locationProfiles[loc];
  }
  return DEFAULT_PROFILE;
}

// Convenience: get the creature-slot position list for a location. Used wherever code
// currently iterates ["fl","fr","bl","br"] for creature slots.
export function creaturePositions(state, loc) {
  return profileFor(state, loc).creatures.positions;
}

// Front-row positions: positions whose row coordinate is 0.
export function frontRowPositions(state, loc) {
  const prof = profileFor(state, loc).creatures;
  return prof.positions.filter(p => prof.coords[p].r === 0);
}

// Back-row positions: positions whose row coordinate is the highest row index. With 1 row,
// this returns the same as front-row (every slot is both front and back).
export function backRowPositions(state, loc) {
  const prof = profileFor(state, loc).creatures;
  const maxRow = prof.rows - 1;
  return prof.positions.filter(p => prof.coords[p].r === maxRow);
}

// True if the given position is in the front row.
export function isFrontRow(state, loc, pos) {
  const prof = profileFor(state, loc).creatures;
  return prof.coords[pos] && prof.coords[pos].r === 0;
}

// True if two creature positions on the same location are adjacent (Manhattan-1).
// Used by cleave, aura, trap-adjacency.
export function areAdjacent(state, loc, posA, posB) {
  const prof = profileFor(state, loc).creatures;
  const a = prof.coords[posA];
  const b = prof.coords[posB];
  if (!a || !b) return false;
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

// Same-row neighbor: the other position in the same row, same column-different. With 2 cols
// returns the single neighbor; with 3 cols returns whichever neighbor is adjacent (usually
// only one, since "same-row neighbor" is typically interpreted as horizontally adjacent).
// For multi-column rows, returns all same-row positions other than `pos`.
export function sameRowNeighbors(state, loc, pos) {
  const prof = profileFor(state, loc).creatures;
  const here = prof.coords[pos];
  if (!here) return [];
  return prof.positions.filter(p => p !== pos && prof.coords[p].r === here.r);
}

// Same-column behind (for pierce): the position directly behind `pos` (r+1, same col).
// Returns null if `pos` is already in the back row.
export function behind(state, loc, pos) {
  const prof = profileFor(state, loc).creatures;
  const here = prof.coords[pos];
  if (!here) return null;
  const target = prof.positions.find(p => prof.coords[p].r === here.r + 1 && prof.coords[p].c === here.c);
  return target || null;
}

// Combat targeting: an attacker at column C on its own side targets the enemy's column C,
// scanning from front row (r=0) backward. Returns the first occupied enemy position in that
// column, or null if the column is empty.
//
// `enemyLc` is the L(otherSide, loc) creature container; we need it to check occupancy.
export function combatTargetInColumn(state, loc, attackerPos, enemyLc) {
  const prof = profileFor(state, loc).creatures;
  const attackerCoord = prof.coords[attackerPos];
  if (!attackerCoord) return null;
  // Scan enemy column from front to back.
  for (let r = 0; r < prof.rows; r++) {
    const target = prof.positions.find(p =>
      prof.coords[p].r === r &&
      prof.coords[p].c === attackerCoord.c
    );
    if (target && enemyLc.creatures[target]) return target;
  }
  return null;
}

// Init helper: install profiles on state at encounter load. Caller passes an array indexed
// by location. Entries can be `null` to use the default. Mutates `state`.
export function setLocationProfiles(state, profiles) {
  state.locationProfiles = profiles.map(p => p || DEFAULT_PROFILE);
}
