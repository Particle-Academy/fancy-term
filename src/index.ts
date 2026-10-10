// Components
export { Terminal } from "./components/Terminal";
export { ShellSwitcher } from "./components/ShellSwitcher";
export type { ShellSwitcherProps } from "./components/ShellSwitcher";
export { TerminalContextMenu } from "./components/TerminalContextMenu";

// Hooks — the headless engine layer
export { useTerminal } from "./hooks/use-terminal";
export { useTerminalFit } from "./hooks/use-terminal-fit";
export { useTerminalSession } from "./hooks/use-terminal-session";
export type {
  TerminalSessionTransport,
  UseTerminalSessionOptions,
  TerminalSessionApi,
} from "./hooks/use-terminal-session";

// Theme
export { fancyDarkTheme } from "./theme";

// Shells
export { BUILTIN_SHELLS, resolveShell } from "./types";

// Clipboard helpers (text + image paste) + the injectable provider
export { isImageFile, navigatorClipboard, resolveClipboard } from "./clipboard";
export type { ClipboardPayload, ClipboardProvider, ClipboardOption } from "./clipboard";

// OSC 52 (terminal-program clipboard) — pure parse/codec exported for reuse/testing
export { parseOsc52, encodeBase64, decodeBase64, osc52Response, registerOsc52 } from "./osc52";
export type { Osc52Mode, Osc52Request } from "./osc52";

// Copy/paste UX modes — pure decision helpers
export { copyPasteBehavior, resolveKeyAction } from "./copy-paste-mode";
export type { CopyPasteMode, CopyPasteBehavior, KeyEventLike } from "./copy-paste-mode";

// Selection context menu (customizable)
export { defaultMenuItems, resolveMenuItems } from "./context-menu";
export type {
  TerminalContextMenuConfig,
  TerminalContextMenuItem,
  TerminalContextMenuContext,
  TerminalMenuActions,
} from "./context-menu";

// Pure helpers (the copy chord decision + menu clamp + selection snapshot) —
// exported for reuse/testing
export { shouldCopyEvent } from "./copy-keybinding";
export type { CopyKeyEvent } from "./copy-keybinding";
export { clampMenuPosition } from "./menu-position";
export { nextSelectionSnapshot } from "./selection-snapshot";
export type { SnapshotPointerEvent } from "./selection-snapshot";

// Types
export type {
  TerminalProps,
  TerminalOptions,
  TerminalHandle,
  TerminalTheme,
  CursorStyle,
  ShellProfile,
} from "./types";

// NOTE — the terminal does not render without xterm's stylesheet (its
// character-measurement helper must stay out of layout, or the cell size comes
// out wrong). Import it once in your app, from here rather than from xterm:
//
//     import "@particle-academy/fancy-term/xterm.css";
//
// That re-exports xterm's own stylesheet via `@import`, so it still resolves to
// the single copy in your tree — xterm stays a PEER on purpose, because
// <Terminal> hands the live XTerm instance out through `handle.xterm`,
// `handle.ready` and `onReady`, and a second copy would break addons and
// `instanceof` silently. `import "@xterm/xterm/css/xterm.css"` still works and
// is identical in effect; the subpath exists so a Fancy-only app has no reason
// to name a third-party package in its own source.
