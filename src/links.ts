// links.ts — clickable URLs in terminal output.
//
// xterm.js has a link-provider API in its core but detects nothing on its own;
// the official web-links addon is a separate third-party package. Detection is
// small, so it lives here: `findUrls` is pure (testable without a terminal) and
// `urlLinkProvider` maps its matches onto buffer cells, joining a line that
// wrapped across rows so a long URL is one link, not two halves.
//
// fancy-term never opens anything itself. Activation is the host's: Genie opens
// http(s) with its shell; another host may open a panel, or refuse.

import type { IBufferCell, IDisposable, ILink, ILinkProvider, Terminal as XTerm } from "@xterm/xterm";

/** A URL found in a string: `start` inclusive, `end` exclusive (string indices). */
export interface UrlMatch {
  url: string;
  start: number;
  end: number;
}

// http(s), then everything up to whitespace or a character that cannot end a URL
// in running text. Trailing punctuation is trimmed afterwards, not here, so a
// closing bracket can be kept when the URL itself opened one.
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g;

/** Characters that end a sentence, not a URL: "see https://example.com." */
const TRAILING = ".,;:!?";

/** Drop trailing punctuation, and a closing bracket the URL did not open. */
function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url[url.length - 1];
    if (last === undefined) return url;
    if (TRAILING.includes(last)) {
      url = url.slice(0, -1);
      continue;
    }
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    const open = pairs[last];
    if (open) {
      const opened = url.split(open).length - 1;
      const closed = url.split(last).length - 1;
      if (closed > opened) {
        url = url.slice(0, -1);
        continue;
      }
    }
    return url;
  }
}

/** Every http(s) URL in `text`, in order. */
export function findUrls(text: string): UrlMatch[] {
  const out: UrlMatch[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = trimUrl(match[0]);
    // "https://" alone is not a link.
    if (url.length <= url.indexOf("//") + 2) continue;
    out.push({ url, start, end: start + url.length });
  }
  return out;
}

/** A file reference found in a string: where it is, and what to open. */
export interface FileMatch {
  /** The path as printed (relative paths are the host's to resolve: it knows the cwd). */
  path: string;
  /** 1-based line, when the output gave one (`:42`, `(42,7)`). */
  line?: number;
  /** 1-based column, when the output gave one. */
  column?: number;
  /** What was matched, suffix included — `src/app.ts:42:7`. */
  text: string;
  start: number;
  end: number;
}

/** What a file link hands the host on click. */
export interface FileLink {
  path: string;
  line?: number;
  column?: number;
}

// An optional root (drive, ./, ../, ~/, /), directory segments, and a file name
// ending in an extension that starts with a letter (so `1.2.3` is not a file).
// Then an optional `:line[:col]` or `(line,col)` suffix. The lookbehind stops a
// match starting in the middle of a token — inside a URL, an email, a word.
const FILE_PATTERN =
  /(?<![\w.@~/\\:-])((?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|~[\\/]|[\\/])?(?:[\w@+-][\w.@+-]*[\\/])*[\w@+-][\w.@+-]*\.[A-Za-z][A-Za-z0-9]{0,9})(?::(\d+)(?::(\d+))?|\((\d+),(\d+)\))?/g;

/**
 * File references in `text` — compiler errors, stack frames, test output.
 *
 * Linked only with a directory part (`src/a.ts`, `./a.ts`, `C:\x\a.ts`) or a line
 * number (`app.ts:3`). A bare `package.json` or `e.g.` in prose stays plain text:
 * an underline that opens nothing useful is worse than no underline. A path that
 * is part of a URL is never a second link.
 */
export function findFilePaths(text: string): FileMatch[] {
  const urls = findUrls(text);
  const out: FileMatch[] = [];

  for (const match of text.matchAll(FILE_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const path = match[1];
    const lineText = match[2] ?? match[4];
    const columnText = match[3] ?? match[5];

    const hasDirectory = path.includes("/") || path.includes(String.fromCharCode(92));
    if (!hasDirectory && lineText === undefined) continue;
    if (urls.some((u) => start < u.end && end > u.start)) continue;

    out.push({
      path,
      line: lineText === undefined ? undefined : Number(lineText),
      column: columnText === undefined ? undefined : Number(columnText),
      text: match[0],
      start,
      end,
    });
  }
  return out;
}

/** A cell position, 1-based as xterm's link ranges are. */
interface CellPos {
  x: number;
  y: number;
}

/**
 * The logical line containing buffer row `row` (0-based): its first row, and its
 * text with, for every character, the 1-based cell it starts in.
 *
 * Built from cells rather than `translateToString` because a wide character
 * (CJK, many emoji) takes two cells and one string index; mapping by string
 * index would put every link after one in the wrong place.
 */
function logicalLine(xterm: XTerm, row: number): { text: string; cells: CellPos[] } | null {
  const buffer = xterm.buffer.active;
  let first = row;
  while (first > 0 && buffer.getLine(first)?.isWrapped) first--;

  let text = "";
  const cells: CellPos[] = [];
  let reusable: IBufferCell | undefined;

  for (let y = first; ; y++) {
    const line = buffer.getLine(y);
    if (!line) break;
    if (y > first && !line.isWrapped) break;

    for (let x = 0; x < line.length; x++) {
      const cell = line.getCell(x, reusable);
      if (!cell) break;
      reusable = cell;
      // The trailing half of a wide character has width 0 and no chars. Counted
      // as a space it would split a URL that contains one (an IDN host) in two.
      if (cell.getWidth() === 0) continue;
      const chars = cell.getChars() || " ";
      for (let i = 0; i < chars.length; i++) {
        text += chars[i];
        cells.push({ x: x + 1, y: y + 1 });
      }
    }
  }

  return cells.length > 0 ? { text, cells } : null;
}

export interface TerminalLinkOptions {
  /** Called when an http(s) link is clicked. Omit and URLs are not linked. */
  onUrl?: (url: string, event: MouseEvent) => void;
  /** Called when a file link is clicked. Omit and file paths are not linked. */
  onFile?: (file: FileLink, event: MouseEvent) => void;
  /** Underline on hover and a pointer cursor. Default `true`. */
  decorate?: boolean;
}

/**
 * An xterm link provider for http(s) URLs and file references. Each kind is
 * linked only when its handler is given. fancy-term opens nothing itself.
 */
export function terminalLinkProvider(xterm: XTerm, options: TerminalLinkOptions): ILinkProvider {
  const decorations = options.decorate === false ? undefined : { underline: true, pointerCursor: true };
  return {
    provideLinks(bufferLineNumber, callback) {
      if (!options.onUrl && !options.onFile) return callback(undefined);
      const line = logicalLine(xterm, bufferLineNumber - 1);
      if (!line) return callback(undefined);

      const found: Array<{ start: number; end: number; text: string; activate: (e: MouseEvent) => void }> = [];
      if (options.onUrl) {
        const onUrl = options.onUrl;
        for (const m of findUrls(line.text)) {
          found.push({ start: m.start, end: m.end, text: m.url, activate: (e) => onUrl(m.url, e) });
        }
      }
      if (options.onFile) {
        const onFile = options.onFile;
        for (const m of findFilePaths(line.text)) {
          const file: FileLink = { path: m.path };
          if (m.line !== undefined) file.line = m.line;
          if (m.column !== undefined) file.column = m.column;
          found.push({ start: m.start, end: m.end, text: m.text, activate: (e) => onFile(file, e) });
        }
      }
      found.sort((a, b) => a.start - b.start);

      const links: ILink[] = [];
      for (const f of found) {
        const start = line.cells[f.start];
        const end = line.cells[f.end - 1];
        if (!start || !end) continue;
        // Asked per row; report only links that touch this one, or a wrapped link
        // would be reported once for every row it spans.
        if (end.y < bufferLineNumber || start.y > bufferLineNumber) continue;
        links.push({ range: { start, end }, text: f.text, decorations, activate: (event) => f.activate(event) });
      }
      callback(links.length > 0 ? links : undefined);
    },
  };
}

export interface UrlLinkOptions {
  /** Called when a link is clicked. fancy-term opens nothing itself. */
  onActivate: (url: string, event: MouseEvent) => void;
  /** Underline on hover and a pointer cursor. Default `true`. */
  decorate?: boolean;
}

/** An xterm link provider for http(s) URLs only (0.7.0's API). */
export function urlLinkProvider(xterm: XTerm, options: UrlLinkOptions): ILinkProvider {
  return terminalLinkProvider(xterm, { onUrl: options.onActivate, decorate: options.decorate });
}

/** Make http(s) URLs in this terminal clickable. Dispose to remove. */
export function registerUrlLinks(xterm: XTerm, options: UrlLinkOptions): IDisposable {
  return xterm.registerLinkProvider(urlLinkProvider(xterm, options));
}

// ---------------------------------------------------------------------------
// Where a click goes — the developer's choice
// ---------------------------------------------------------------------------

/** Where an http(s) link goes: a new browser tab, nowhere, or your own handler. */
export type UrlLinkTarget = "browser" | "none" | ((url: string, event: MouseEvent) => void);

/**
 * Where a file link goes:
 * - an installed editor, through its URL scheme (`"vscode"`, `"vscode-insiders"`,
 *   `"cursor"`, `"windsurf"`) — these need an absolute path, so set `root`;
 * - `{ template }` — any URL, with `{path}`, `{line}` and `{column}` filled in:
 *   another editor's scheme, or a code host in the browser
 *   (`"https://github.com/org/repo/blob/main/{path}#L{line}"`);
 * - your own handler — open it in your UI, run an action, anything;
 * - `"none"`.
 */
export type FileLinkTarget =
  | "vscode"
  | "vscode-insiders"
  | "cursor"
  | "windsurf"
  | "none"
  | { template: string }
  | ((file: FileLink & { absolutePath?: string }, event: MouseEvent) => void);

export interface TerminalLinks {
  /** http(s) links. Omit for no URL links. */
  url?: UrlLinkTarget;
  /** File references. Omit for no file links. */
  file?: FileLinkTarget;
  /**
   * The directory relative paths are relative to — the shell's working
   * directory. Editors need absolute paths; without `root` a relative path is
   * handed over as printed.
   */
  root?: string;
}

const EDITOR_TEMPLATES: Record<string, string> = {
  // VS Code's documented form: vscode://file/c:/project/a.ts:5:4 — one slash
  // before the path, drive or not. Its forks take the same.
  vscode: "vscode://file{slashPath}:{line}:{column}",
  "vscode-insiders": "vscode-insiders://file{slashPath}:{line}:{column}",
  cursor: "cursor://file{slashPath}:{line}:{column}",
  windsurf: "windsurf://file{slashPath}:{line}:{column}",
};

const BACKSLASH = String.fromCharCode(92);

function isAbsolute(path: string): boolean {
  return path.startsWith("/") || path.startsWith(BACKSLASH) || /^[A-Za-z]:[/]/.test(path.split(BACKSLASH).join("/"));
}

/**
 * `path` resolved against `root`, with forward slashes and `.` / `..` collapsed.
 * Absolute paths are kept (only their slashes change); `~` is left for the host,
 * which knows the home directory.
 */
export function resolveFilePath(path: string, root?: string): string {
  const slashed = path.split(BACKSLASH).join("/");
  if (slashed.startsWith("~")) return slashed;
  const joined = isAbsolute(slashed) || !root ? slashed : `${root.split(BACKSLASH).join("/").replace(/[/]+$/, "")}/${slashed}`;

  const leadingSlash = joined.startsWith("/");
  const out: string[] = [];
  for (const part of joined.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === ".." && out.length > 0 && out[out.length - 1] !== ".." && !/^[A-Za-z]:$/.test(out[out.length - 1])) {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return (leadingSlash ? "/" : "") + out.join("/");
}

/**
 * The URL a template-style target opens for `file`. Tokens, URI-encoded:
 *
 * - `{path}` — the resolved path exactly: `/home/me/a.ts`, `C:/w/a.ts`, `src/a.ts`.
 * - `{slashPath}` — the same with exactly ONE leading slash: `/home/me/a.ts`,
 *   `/C:/w/a.ts`. The editor presets use it, matching VS Code's documented form
 *   `vscode://file/c:/project/a.ts:5:4` — `{path}` there would give a Windows
 *   path no slash and a POSIX one two.
 * - `{line}`, `{column}` — default 1.
 */
export function fileLinkUrl(file: FileLink, template: string, root?: string): string {
  const path = resolveFilePath(file.path, root);
  const slashPath = "/" + path.replace(/^[/]+/, "");
  return template
    .split("{slashPath}")
    .join(encodeURI(slashPath))
    .split("{path}")
    .join(encodeURI(path))
    .split("{line}")
    .join(String(file.line ?? 1))
    .split("{column}")
    .join(String(file.column ?? 1));
}

/** Opens a URL outside the page: a new tab for http(s), the OS handler for any other scheme. */
export function openExternal(url: string): void {
  if (typeof document === "undefined") return;
  if (/^https?:/i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  // A custom scheme (vscode://…) is handed to the OS; an anchor click does that
  // without leaving a blank tab behind, which window.open would.
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * The link handlers a {@link TerminalLinks} config means. `open` is injectable
 * so a host (or a test) can intercept where things go.
 */
export function resolveLinkHandlers(
  links: TerminalLinks | undefined,
  open: (url: string) => void = openExternal,
): Pick<TerminalLinkOptions, "onUrl" | "onFile"> {
  const out: Pick<TerminalLinkOptions, "onUrl" | "onFile"> = {};
  const url = links?.url;
  if (typeof url === "function") out.onUrl = url;
  else if (url === "browser") out.onUrl = (u) => open(u);

  const file = links?.file;
  const root = links?.root;
  if (typeof file === "function") {
    out.onFile = (f, e) => file(root ? { ...f, absolutePath: resolveFilePath(f.path, root) } : f, e);
  } else if (typeof file === "string" && file !== "none") {
    const template = EDITOR_TEMPLATES[file];
    if (template) out.onFile = (f) => open(fileLinkUrl(f, template, root));
  } else if (file && typeof file === "object") {
    const template = file.template;
    out.onFile = (f) => open(fileLinkUrl(f, template, root));
  }
  return out;
}
