// DevTracePanel — in-app surface for the divergence trace.
//
// A read-only overlay that shows the live trace produced by devtrace.ts. Toggle with the backtick
// (`) key. Copy puts the whole transcript on the clipboard so it can be pasted back verbatim;
// Clear resets the buffer. Purely a viewer — it never touches engine state.

import { useEffect, useState, useSyncExternalStore } from "react";
import { clearTrace, getTraceLines, getTraceText, subscribeTrace } from "../devtrace.ts";

export function DevTracePanel() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toggle on backtick. Ignore when typing in an input (none exist today, but be safe).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "`" && !(e.target instanceof HTMLInputElement)) {
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const lines = useSyncExternalStore(subscribeTrace, getTraceLines);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open dev trace (`)"
        style={{
          position: "fixed",
          bottom: 6,
          right: 6,
          zIndex: 50,
          background: "#11111a",
          color: "#7a7a8a",
          border: "1px solid #2a2a35",
          borderRadius: 4,
          padding: "2px 8px",
          fontSize: 10,
          fontFamily: "monospace",
          cursor: "pointer",
        }}
      >
        trace `
      </button>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(getTraceText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable (insecure context). Fall back to selecting the text.
      setCopied(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 520,
        height: "100%",
        zIndex: 50,
        background: "rgba(8,8,14,0.97)",
        borderLeft: "1px solid #2a2a35",
        display: "flex",
        flexDirection: "column",
        boxShadow: "-8px 0 24px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderBottom: "1px solid #2a2a35",
          fontSize: 11,
          fontFamily: "monospace",
          color: "#9a9aaa",
        }}
      >
        <strong style={{ color: "#cfcfe0" }}>dev trace</strong>
        <span style={{ color: "#555" }}>{lines.length} lines</span>
        <div style={{ flex: 1 }} />
        <button onClick={copy} style={miniBtn}>
          {copied ? "copied ✓" : "copy"}
        </button>
        <button onClick={() => clearTrace()} style={miniBtn}>
          clear
        </button>
        <button onClick={() => setOpen(false)} style={miniBtn}>
          close `
        </button>
      </div>
      <TraceBody lines={lines} />
    </div>
  );
}

function TraceBody({ lines }: { lines: readonly string[] }) {
  // Auto-scroll to bottom as new lines arrive, unless the user has scrolled up.
  const [stick, setStick] = useState(true);
  const ref = (el: HTMLPreElement | null) => {
    if (el && stick) el.scrollTop = el.scrollHeight;
  };
  return (
    <pre
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        setStick(atBottom);
      }}
      style={{
        margin: 0,
        flex: 1,
        overflow: "auto",
        padding: "8px 10px",
        fontSize: 10.5,
        lineHeight: 1.45,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        color: "#c8c8d4",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {lines.join("\n")}
    </pre>
  );
}

const miniBtn = {
  background: "#1a1a22",
  color: "#c8c8d4",
  border: "1px solid #2a2a35",
  borderRadius: 3,
  padding: "2px 8px",
  fontSize: 10,
  fontFamily: "monospace",
  cursor: "pointer",
} as const;
