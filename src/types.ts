import type { HTMLAttributes } from "react";
import type { ITheme, Terminal as XTerm } from "@xterm/xterm";

/** xterm.js color theme (re-exported for ergonomic typing). */
export type TerminalTheme = ITheme;

export type CursorStyle = "block" | "underline" | "bar";

/**
 * Imperative handle exposed via the `<Terminal>` ref and returned by
 * {@link useTerminal}. The same surface an MCP bridge drives so an embedded
 * agent reads the buffer + writes input without DOM-scraping.
 */
export interface TerminalHandle {
  /** The underlying xterm.js instance — escape hatch for addons / advanced use. Null before mount. */
  readonly xterm: XTerm | null;
  /** Write raw data (ANSI escape sequences honored) to the terminal. */
  write: (data: string) => void;
  /** Write data followed by CRLF. */
  writeln: (data: string) => void;
  /** Clear the viewport (keeps scrollback). */
  clear: () => void;
  /** Full reset — clears scrollback + terminal state. */
  reset: () => void;
  /** Re-fit to the container (no-op when the box is 0-size or fit is off). */
  fit: () => void;
  /** Focus the terminal input. */
  focus: () => void;
  /** The full buffer as plain text — what an agent "sees". */
  getBuffer: () => string;
  /** The current text selection, or "" when nothing is selected. */
  getSelection: () => string;
}

/** Engine options shared by `<Terminal>` and {@link useTerminal}. */
export interface TerminalOptions {
  /** xterm color theme. Omit for the built-in Fancy dark theme. */
  theme?: TerminalTheme;
  /** Fixed grid size. Omit + leave `fit` on to size from the container. */
  rows?: number;
  cols?: number;
  /** Auto-fit to the container via the fit addon + ResizeObserver. Default true. */
  fit?: boolean;
  /** Block stdin (display-only terminal). Default false. */
  readOnly?: boolean;
  /** Blink the cursor. Default true. */
  cursorBlink?: boolean;
  /** Cursor shape. Default "block". */
  cursorStyle?: CursorStyle;
  /** Monospace font stack. */
  fontFamily?: string;
  /** Font size in px. Default 13. */
  fontSize?: number;
  /** Scrollback lines. Default 1000. */
  scrollback?: number;
  /** Data written once on mount, before any controlled `output`. */
  initialOutput?: string;
  /** User keystrokes / paste data (xterm `onData`). Wire to your PTY/command backend. */
  onData?: (data: string) => void;
  /** Notified on terminal resize. */
  onResize?: (size: { cols: number; rows: number }) => void;
}

export interface TerminalProps extends TerminalOptions, Omit<HTMLAttributes<HTMLDivElement>, "onInput" | "onResize" | "children"> {
  /**
   * The controlled output buffer. The component diffs against the previous value
   * and writes only the appended delta, so a host can drive the terminal from
   * React state — e.g. streaming command output via fancy-query's
   * `useFancyStream`. Replacing it with a non-extending string resets + rewrites.
   */
  output?: string;
}
