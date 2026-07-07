// selection-snapshot.ts — pure decision layer for the context-menu selection
// snapshot (#2). Over a mouse-reporting TUI (Claude Code, tmux, vim with mouse
// mode) a right-click is forwarded to the app, whose redraw asynchronously
// clears xterm's selection — often between the selecting drag and the menu
// opening, and almost always before the user clicks Copy. So the component
// keeps a snapshot of the selection, maintained at pointer time (capture
// phase, before xterm or the app can react), and the menu falls back to it
// whenever the live selection has already been cleared.

/** The bits of a pointer event the snapshot decision needs. */
export interface SnapshotPointerEvent {
  type: "mousedown" | "mouseup";
  /** 0 = left, 1 = middle, 2 = right. */
  button: number;
}

/**
 * Compute the next selection snapshot after a pointer event on the terminal
 * surface.
 *
 * - A fresh **left press** starts a new gesture — drop the snapshot (the live
 *   selection still reads the *old* text at capture time, so it must not win).
 * - Otherwise a **non-empty live selection** always refreshes the snapshot
 *   (drag-select completes on left mouseup; a right press re-captures while
 *   the selection is still alive).
 * - An **empty** live selection keeps the previous snapshot — that's exactly
 *   the TUI-cleared-it-under-us case the snapshot exists for.
 */
export function nextSelectionSnapshot(
  prev: string,
  event: SnapshotPointerEvent,
  liveSelection: string,
): string {
  if (event.type === "mousedown" && event.button === 0) return "";
  return liveSelection || prev;
}
