import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <div style={{ padding: 24, fontFamily: "system-ui" }}>v1 — empty</div>;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
