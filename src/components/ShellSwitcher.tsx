import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { resolveShell, type ShellProfile } from "../types";

export interface ShellSwitcherProps {
  /** The available shells / profiles. */
  shells: ShellProfile[];
  /** Controlled selected shell id. */
  value?: string;
  /** Fired when a shell is picked. */
  onChange: (id: string, profile: ShellProfile) => void;
  className?: string;
  style?: CSSProperties;
  /** Disable the control. */
  disabled?: boolean;
}

const PANEL_BG = "#18181b"; // zinc-900
const BORDER = "#3f3f46"; // zinc-700
const FG = "#e4e4e7"; // zinc-200
const MUTED = "#a1a1aa"; // zinc-400
const ACCENT = "#8b5cf6"; // violet-500
const HOVER_BG = "#27272a"; // zinc-800

/**
 * Compact, accessible shell picker styled to the Fancy dark theme. Self-contained
 * (zero third-party deps) — a button that toggles a listbox of `shells`.
 *
 * Stable handles for agents: the root carries `data-fancy-shell-switcher` and each
 * option carries `data-shell-id`, so a bridge can pick a shell without DOM-guessing.
 *
 * Controlled: pass `value` + `onChange`. Keyboard accessible (Arrow / Enter / Esc).
 */
export function ShellSwitcher({
  shells,
  value,
  onChange,
  className,
  style,
  disabled,
}: ShellSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = resolveShell(shells, value);
  const selectedIndex = selected ? shells.indexOf(selected) : -1;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const pick = useCallback(
    (i: number) => {
      const profile = shells[i];
      if (!profile) return;
      onChange(profile.id, profile);
      setOpen(false);
    },
    [shells, onChange],
  );

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(shells.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(shells.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(activeIndex);
    }
  };

  const buttonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 26,
    padding: "0 8px",
    fontSize: 12,
    lineHeight: 1,
    fontFamily: "inherit",
    color: FG,
    background: PANEL_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    userSelect: "none",
  };

  return (
    <div
      ref={rootRef}
      data-fancy-shell-switcher=""
      data-active-shell={value ?? undefined}
      className={className}
      style={{ position: "relative", display: "inline-block", ...style }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select shell"
        disabled={disabled}
        style={buttonStyle}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        {selected?.icon ? (
          <span aria-hidden="true" style={{ color: ACCENT }}>
            {selected.icon}
          </span>
        ) : null}
        <span>{selected?.label ?? "Select shell"}</span>
        <span aria-hidden="true" style={{ color: MUTED, fontSize: 9 }}>
          ▼
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          id={listId}
          aria-label="Shells"
          tabIndex={-1}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onKeyDown={onListKeyDown}
          ref={(el) => el?.focus()}
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            outline: "none",
          }}
        >
          {shells.map((s, i) => {
            const isSelected = s.id === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={s.id}
                role="option"
                aria-selected={isSelected}
                data-shell-id={s.id}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                  borderRadius: 5,
                  color: FG,
                  cursor: "pointer",
                  background: isActive ? HOVER_BG : "transparent",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    textAlign: "center",
                    color: isSelected ? ACCENT : MUTED,
                  }}
                >
                  {s.icon ?? ""}
                </span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {isSelected ? (
                  <span aria-hidden="true" style={{ color: ACCENT, fontSize: 11 }}>
                    ✓
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
