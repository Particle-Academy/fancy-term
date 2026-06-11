// Component
export { Terminal } from "./components/Terminal";

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

// Types
export type {
  TerminalProps,
  TerminalOptions,
  TerminalHandle,
  TerminalTheme,
  CursorStyle,
} from "./types";

// NOTE — xterm.js styles are required for the terminal to render. Import them
// once in your app: `import "@xterm/xterm/css/xterm.css";`
