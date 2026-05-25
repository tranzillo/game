// Barrel module — re-exports every public name from the engine sub-modules.
// External consumers (render.js, run.js, export.js) can keep importing from core.js;
// internally each sub-module imports directly from its peer.
export * from "./legality.js";
export * from "./tokens.js";
export * from "./marks.js";
export * from "./triggers.js";
export * from "./quests.js";
export * from "./location-texts.js";
export * from "./combat.js";
export * from "./timeline.js";
export * from "./ai.js";
export * from "./phases.js";
