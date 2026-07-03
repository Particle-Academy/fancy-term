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

// Pure helpers (the copy chord decision + menu clamp) — exported for reuse/testing
export { shouldCopyEvent } from "./copy-keybinding";
export type { CopyKeyEvent } from "./copy-keybinding";
export { clampMenuPosition } from "./menu-position";

// Types
export type {
  TerminalProps,
  TerminalOptions,
  TerminalHandle,
  TerminalTheme,
  CursorStyle,
  ShellProfile,
} from "./types";

// NOTE — xterm.js styles are required for the terminal to render. Import them
// once in your app: `import "@xterm/xterm/css/xterm.css";`
