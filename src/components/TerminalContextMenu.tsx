import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampMenuPosition } from "../menu-position";
import type {
  TerminalContextMenuContext,
  TerminalContextMenuItem,
} from "../context-menu";

/**
 * The terminal selection context menu. Deliberately plain React + inline styles
 * (fancy-term has no react-fancy dependency) styled to match the shell bar. It
 * closes on click-outside + Escape, and clamps itself inside the viewport on
 * mount so a right-click near an edge never spills off-screen.
 */
export function TerminalContextMenu({
  at,
  items,
  ctx,
  onClose,
}: {
  at: { x: number; y: number };
  items: TerminalContextMenuItem[];
  ctx: TerminalContextMenuContext;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);

  // Clamp once we can measure the rendered menu.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    setPos(
      clampMenuPosition(
        at,
        { width: r.width, height: r.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [at]);

  // Dismiss on click-outside + Escape (capture so it wins over the surface).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-fancy-terminal-menu=""
      role="menu"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 2147483000,
        minWidth: 176,
        padding: 4,
        background: "#18181b",
        border: "1px solid #3f3f46",
        borderRadius: 8,
        boxShadow: "0 10px 32px -8px rgba(0,0,0,.6)",
        color: "#e4e4e7",
        font: '13px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        userSelect: "none",
      }}
    >
      {items.map((it) =>
        it.separator ? (
          <div
            key={it.id}
            role="separator"
            style={{ height: 1, margin: "4px 6px", background: "#3f3f46" }}
          />
        ) : (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            data-menu-item={it.id}
            disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return;
              it.onSelect?.(ctx);
              onClose();
            }}
            onMouseEnter={(e) => {
              if (!it.disabled) e.currentTarget.style.background = "#27272a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              textAlign: "left",
              padding: "6px 9px",
              border: "none",
              borderRadius: 5,
              background: "transparent",
              color: it.disabled ? "#52525b" : "inherit",
              cursor: it.disabled ? "default" : "pointer",
              font: "inherit",
            }}
          >
            <span style={{ width: 16, textAlign: "center", opacity: 0.8 }}>
              {it.icon ?? ""}
            </span>
            <span style={{ flex: 1 }}>{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
