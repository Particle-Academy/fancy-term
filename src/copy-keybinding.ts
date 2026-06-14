// copy-keybinding.ts — the pure "should this key event copy the selection?"
// decision, kept separate (like shell-select.ts) so it's unit-testable without
// a DOM or a live xterm.

/** The subset of a KeyboardEvent the copy decision reads. */
export interface CopyKeyEvent {
  type: string;
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/**
 * Whether a key event should copy the current selection to the clipboard.
 *
 * - **Ctrl+Shift+C** (Windows / Linux terminal convention) — always.
 * - **Cmd / Meta+C** (macOS) — only when there is a selection.
 * - **Plain Ctrl+C is never a copy** — it must stay SIGINT.
 *
 * Only fires on `keydown`. When this returns true the caller copies the
 * selection and consumes the event (returns `false` from xterm's
 * `attachCustomKeyEventHandler` so no control byte is sent).
 */
export function shouldCopyEvent(e: CopyKeyEvent, hasSelection: boolean): boolean {
  if (e.type !== "keydown") return false;
  if (e.key !== "c" && e.key !== "C") return false;
  // Ctrl+Shift+C — the terminal-safe copy chord (plain Ctrl+C stays SIGINT).
  if (e.ctrlKey && e.shiftKey && !e.metaKey) return true;
  // Cmd+C on macOS — only with a selection, so it never swallows an empty copy.
  if (e.metaKey && !e.ctrlKey && hasSelection) return true;
  return false;
}
