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

export interface UrlLinkOptions {
  /** Called when a link is clicked. fancy-term opens nothing itself. */
  onActivate: (url: string, event: MouseEvent) => void;
  /** Underline on hover and a pointer cursor. Default `true`. */
  decorate?: boolean;
}

/**
 * An xterm link provider for http(s) URLs. Register it with
 * `xterm.registerLinkProvider(...)`, or use {@link registerUrlLinks}.
 */
export function urlLinkProvider(xterm: XTerm, options: UrlLinkOptions): ILinkProvider {
  return {
    provideLinks(bufferLineNumber, callback) {
      const row = bufferLineNumber - 1;
      const line = logicalLine(xterm, row);
      if (!line) return callback(undefined);

      const links: ILink[] = [];
      for (const match of findUrls(line.text)) {
        const start = line.cells[match.start];
        const end = line.cells[match.end - 1];
        if (!start || !end) continue;
        // Asked per row; report only links that touch this one, or a wrapped URL
        // would be reported once for every row it spans.
        if (end.y < bufferLineNumber || start.y > bufferLineNumber) continue;
        links.push({
          range: { start, end },
          text: match.url,
          decorations: options.decorate === false ? undefined : { underline: true, pointerCursor: true },
          activate: (event) => options.onActivate(match.url, event),
        });
      }
      callback(links.length > 0 ? links : undefined);
    },
  };
}

/** Make http(s) URLs in this terminal clickable. Dispose to remove. */
export function registerUrlLinks(xterm: XTerm, options: UrlLinkOptions): IDisposable {
  return xterm.registerLinkProvider(urlLinkProvider(xterm, options));
}
