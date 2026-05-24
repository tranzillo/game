import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // happy-dom gives us document/Element stubs so render.js can be imported without crashing.
    // Engine tests don't render, but several engine modules transitively import render.js.
    environment: "happy-dom",
    include: ["tests/**/*.test.js"],
    globals: false
  }
});
