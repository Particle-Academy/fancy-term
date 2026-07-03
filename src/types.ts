import type { HTMLAttributes } from "react";
import type { ITheme, Terminal as XTerm } from "@xterm/xterm";
import type { ClipboardOption, ClipboardPayload } from "./clipboard";
import type { CopyPasteMode } from "./copy-paste-mode";
import type { Osc52Mode } from "./osc52";
import type { TerminalContextMenuConfig } from "./context-menu";

/** xterm.js color theme (re-exported for ergonomic typing). */
export type TerminalTheme = ITheme;

export type CursorStyle = "block" | "underline" | "bar";

/**
 * A selectable shell / profile. Fully JSON-friendly (primitives only) so an agent
 * can emit it. fancy-term owns the *selected-shell state + UI + events*; the
 * `command` / `args` / `cwd` fields are **host hints** — fancy-term never spawns a
 * shell, the host reconnects its PTY/command backend to the chosen profile.
 */
export interface ShellProfile {
  /** Stable key, e.g. `"powershell"`. */
  id: string;
  /** Display label, e.g. `"PowerShell"`. */
  label: string;
  /** Optional short glyph / emoji / single char (kept JSON-friendly — no ReactNode). */
  icon?: string;
  /** Host hint — the executable, e.g. `"pwsh"` / `"cmd.exe"`. */
  command?: string;
  /** Host hint — launch args. */
  args?: string[];
  /** Host hint — working directory. */
  cwd?: string;
}

/**
 * Imperative handle exposed via the `<Terminal>` ref and returned by
 * {@link useTerminal}. The same surface an MCP bridge drives so an embedded
 * agent reads the buffer + writes input without DOM-scraping.
 */
export interface TerminalHandle {
  /** The underlying xterm.js instance — escape hatch for addons / advanced use. Null before mount. */
  readonly xterm: XTerm | null;
  /**
   * Resolves with the xterm instance once it's opened + measured. Because
   * `xterm` is null until the container lays out, a consumer that must wire an
   * addon can `await handle.ready` instead of polling. Re-armed if the terminal
   * is torn down + recreated (e.g. a container change).
   */
  readonly ready: Promise<XTerm>;
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
  /** Copy the current selection to the system clipboard. Resolves false when there's nothing selected or the clipboard is unavailable. */
  copySelection: () => Promise<boolean>;
  /** Paste text into the terminal. With no argument, reads the system clipboard. Honors xterm's bracketed-paste mode. */
  paste: (text?: string) => Promise<void>;
  /** Select the entire buffer. */
  selectAll: () => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /**
   * Switch the active shell by id. Resolves the matching {@link ShellProfile}
   * from `shells` and fires `onShellChange`; in uncontrolled mode it also updates
   * the internal selection. No-op when the id isn't in `shells`.
   */
  setShell: (id: string) => void;
  /** The active shell id, or `undefined` when no shell is selected. */
  getShell: () => string | undefined;
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
  /**
   * Clipboard wiring — gates the Ctrl+Shift+C / Cmd+C copy chord, the paste
   * interceptor ({@link onPaste}), the context-menu copy/paste, and OSC 52.
   *
   * - `true` / omitted — enabled, backed by `navigator.clipboard`.
   * - `false` — disabled (no copy chord / OSC 52; native text paste still works).
   * - a `{ writeText, readText }` **provider** — every copy/paste path routes
   *   through it. Supply this in a sandboxed Electron renderer, where
   *   `navigator.clipboard` silently no-ops, to bridge to the main-process
   *   clipboard over IPC.
   */
  clipboard?: ClipboardOption;
  /**
   * OSC 52 clipboard policy — lets terminal programs (Claude Code, tmux, vim)
   * set/read the system clipboard via `ESC ] 52`. `"copy"` (default) allows
   * writes only; `"read"` / `"both"` also answer read requests (an exfiltration
   * risk — opt in deliberately); `false` disables it. Routed through the same
   * clipboard provider as {@link clipboard}; a no-op when clipboard is `false`.
   * Default `"copy"`.
   */
  osc52?: Osc52Mode;
  /**
   * Copy/paste UX convention: `"contextmenu"` (menu + Ctrl+Shift+C),
   * `"linux"` (highlight-to-copy + middle-click paste), or `"winmac"`
   * (Ctrl/Cmd+C copies the selection, Ctrl/Cmd+V pastes). Omit for the historical
   * default (Ctrl+Shift+C + Cmd+C-with-selection). Ctrl+Shift+C always copies.
   */
  copyPaste?: CopyPasteMode;
  /**
   * Called once the xterm instance is opened + attached — the imperative twin of
   * {@link TerminalHandle.ready}. Use it to load an addon without racing the
   * container layout (where `handle.xterm` is still null).
   */
  onReady?: (xterm: XTerm) => void;
  /**
   * Fired on every paste with the clipboard payload — `{ text, files, images }`.
   * Plain text still pastes into the terminal natively; this is where a host
   * receives pasted **images** (a shell can't render them) to upload / hand to an
   * agent / write a path. Return `false` to fully consume the paste (suppress the
   * default text paste — e.g. to transform it, then call `handle.paste(...)`).
   */
  onPaste?: (payload: ClipboardPayload) => void | boolean;
}

export interface TerminalProps extends TerminalOptions, Omit<HTMLAttributes<HTMLDivElement>, "onInput" | "onResize" | "onPaste" | "contextMenu" | "children"> {
  /**
   * The controlled output buffer. The component diffs against the previous value
   * and writes only the appended delta, so a host can drive the terminal from
   * React state — e.g. streaming command output via fancy-query's
   * `useFancyStream`. Replacing it with a non-extending string resets + rewrites.
   */
  output?: string;

  /**
   * The shells / profiles a host offers. fancy-term renders the selector and
   * tracks the choice; the host reacts (reconnects its PTY to the chosen shell).
   * Spread {@link BUILTIN_SHELLS} for sensible presets, but the host owns the list.
   */
  shells?: ShellProfile[];
  /** Controlled active-shell id. Omit for uncontrolled (internal) selection. */
  activeShell?: string;
  /** Fired when the user (or `setShell`) switches shells. */
  onShellChange?: (id: string, profile: ShellProfile) => void;
  /**
   * Render the built-in `<ShellSwitcher>` toolbar above the xterm surface when
   * `shells` is provided. Default `false` — opt-in so existing layout is unchanged.
   */
  showShellBar?: boolean;

  /**
   * The right-click selection context menu. `false` disables it; `true` / omitted
   * gives the default Copy / Paste / Select all / Clear menu; an array replaces
   * the items; a `(ctx, defaults) => items` function lets you add/remove/reorder
   * (e.g. append a "Send to agent" item). See {@link TerminalContextMenuConfig}.
   */
  contextMenu?: TerminalContextMenuConfig;
}

/**
 * Resolve a shell id to its {@link ShellProfile} within a list. Pure helper —
 * the single place `setShell` / `<ShellSwitcher>` / the session hook agree on
 * what "switch to id X" means.
 */
export function resolveShell(
  shells: ShellProfile[] | undefined,
  id: string | undefined,
): ShellProfile | undefined {
  if (!shells || id === undefined) return undefined;
  return shells.find((s) => s.id === id);
}

/**
 * A small set of sensible built-in shell presets a host can spread / filter.
 * `command` / `args` are host hints only — fancy-term never spawns them.
 */
export const BUILTIN_SHELLS: readonly ShellProfile[] = [
  { id: "cmd", label: "Command Prompt", icon: ">_", command: "cmd.exe" },
  { id: "powershell", label: "Windows PowerShell", icon: "PS", command: "powershell.exe" },
  { id: "pwsh", label: "PowerShell", icon: "PS", command: "pwsh" },
  {
    id: "git-bash",
    label: "Git Bash",
    icon: "",
    command: "C:\\Program Files\\Git\\bin\\bash.exe",
    args: ["--login", "-i"],
  },
  { id: "bash", label: "Bash", icon: "$", command: "bash" },
  { id: "zsh", label: "Zsh", icon: "%", command: "zsh" },
] as const;
