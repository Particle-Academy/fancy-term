// Components
export { Terminal } from "./components/Terminal";
export { ShellSwitcher } from "./components/ShellSwitcher";
export type { ShellSwitcherProps } from "./components/ShellSwitcher";

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
