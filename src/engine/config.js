// ---------- Multi-location config ----------
// v3: each encounter is a SINGLE LOCATION (the destination node). Multi-location-per-encounter
// returns in a slice prototype increment that mixes peace and war locations. LOCATION_COUNT is
// a runtime variable: set per-encounter from the node's `locations` array. Default 1 for nodes
// authored as single-location; 2 for the slice's multi-location encounters.
export let LOCATION_COUNT = 1;
export let LOC_NAMES = ["Encounter"]; // overwritten per-encounter when an encounter is loaded
export let LOC_TEXT_KEYS = [null]; // per-location key into LOCATION_TEXTS; null = no text at this location

export function setLocationConfig(count, names, textKeys) {
  LOCATION_COUNT = count;
  LOC_NAMES = names;
  LOC_TEXT_KEYS = textKeys;
}
