// Persistent DOM registries. Keyed by stable IDs so DOM elements survive re-renders.
//
//   _cardRegistry: card instId → outer DOM element. Lets FLIP animations and per-card animation
//   primitives find a card's element across re-renders.
//
//   _chipRegistry: timeline chip id → DOM element. Same idea for the future/past chip strip.
//
// These were originally declared inside render.js but extracted so animations.js can import them
// without creating a render.js ↔ animations.js cycle.

export const _cardRegistry = new Map();
export const _chipRegistry = new Map();
