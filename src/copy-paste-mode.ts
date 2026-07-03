// copy-paste-mode.ts — the pure decision layer for the `copyPaste` prop. Kept
// DOM-free (like copy-keybinding.ts / shell-select.ts) so the behavior is
// unit-testable without a live xterm. use-terminal.ts wires the resulting
// behavior to real events.

/**
 * The copy/paste convention the terminal follows:
 * - `contextmenu` — copy/paste via the right-click menu only (plus the always-on
 *   Ctrl+Shift+C copy chord).
 * - `linux` — highlight-to-copy (X11 primary-selection style) + middle-click
 *   paste. Right-click still opens the context menu.
 * - `winmac` — Ctrl/Cmd+C copies the selection (falling back to SIGINT when
 *   nothing is selected), Ctrl/Cmd+V pastes.
 *
 * Omitting the prop keeps the historical default: the Ctrl+Shift+C chord and
 * Cmd+C-with-selection, no auto-copy, no mouse paste.
 */
export type CopyPasteMode = "contextmenu" | "linux" | "winmac";

/** The resolved, event-agnostic behavior flags a {@link CopyPasteMode} implies. */
export interface CopyPasteBehavior {
  /** Auto-copy the selection to the clipboard as soon as it changes (linux). */
  selectToCopy: boolean;
  /** Paste on middle-mouse-button (linux). */
  middleClickPaste: boolean;
  /** (Ctrl|Cmd)+C copies the selection when one exists (winmac). */
  keyCopy: boolean;
  /** (Ctrl|Cmd)+V — and Ctrl+Shift+V — paste (winmac). */
  keyPaste: boolean;
}

export function copyPasteBehavior(mode: CopyPasteMode | undefined): CopyPasteBehavior {
  switch (mode) {
    case "linux":
      return { selectToCopy: true, middleClickPaste: true, keyCopy: false, keyPaste: false };
    case "winmac":
      return { selectToCopy: false, middleClickPaste: false, keyCopy: true, keyPaste: true };
    case "contextmenu":
    default:
      return { selectToCopy: false, middleClickPaste: false, keyCopy: false, keyPaste: false };
  }
}

/** The subset of a KeyboardEvent the copy/paste decision reads. */
export interface KeyEventLike {
  type: string;
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/**
 * Resolve a key event to a clipboard action, given the current selection state
 * and the active behavior. Returns `"copy"`, `"paste"`, or `null` (do nothing —
 * let the byte reach the shell). Only fires on `keydown`.
 *
 * Copy is honored across every mode for the terminal-safe **Ctrl+Shift+C** chord
 * and macOS **Cmd+C-with-selection**; `keyCopy` adds plain (Ctrl|Cmd)+C. Plain
 * Ctrl+C with no selection is never a copy — it stays SIGINT.
 */
export function resolveKeyAction(
  e: KeyEventLike,
  hasSelection: boolean,
  behavior: CopyPasteBehavior,
): "copy" | "paste" | null {
  if (e.type !== "keydown") return null;
  const key = e.key.toLowerCase();

  if (key === "c") {
    if (e.ctrlKey && e.shiftKey && !e.metaKey) return "copy"; // Ctrl+Shift+C — always
    if (e.metaKey && !e.ctrlKey && hasSelection) return "copy"; // Cmd+C w/ selection — always (macOS)
    if (behavior.keyCopy && (e.ctrlKey || e.metaKey) && !e.shiftKey && hasSelection) return "copy";
    return null;
  }

  if (key === "v" && behavior.keyPaste) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) return "paste"; // Ctrl/Cmd+V
    if (e.ctrlKey && e.shiftKey) return "paste"; // Ctrl+Shift+V (terminal-safe paste)
    return null;
  }

  return null;
}
