import { describe, expect, it } from "vitest";
import { Terminal as XTerm, type ILink } from "@xterm/xterm";
import { findUrls, registerUrlLinks, urlLinkProvider } from "./links";

/** A real xterm buffer — its core runs under Node, wrapping included. */
function terminal(text: string, cols = 80): Promise<XTerm> {
  const term = new XTerm({ cols, rows: 6, allowProposedApi: true });
  return new Promise((resolve) => term.write(text, () => resolve(term)));
}

/** What the provider reports for a 1-based buffer row. */
function linksAt(term: XTerm, row: number, onActivate = () => {}): Promise<ILink[]> {
  const provider = urlLinkProvider(term, { onActivate });
  return new Promise((resolve) => provider.provideLinks(row, (links) => resolve(links ?? [])));
}

const range = (l: ILink) =>
  `${l.range.start.x},${l.range.start.y}-${l.range.end.x},${l.range.end.y}`;

/**
 * Genie 2 (Tynn #763, Genie 1 parity): URLs in terminal output could not be
 * clicked. xterm has a link-provider API but detects nothing itself, and the
 * web-links addon is a separate third-party package — so detection lives here.
 */
describe("findUrls", () => {
  it("finds an http(s) URL with its exact span", () => {
    const text = "see https://example.com/x for details";
    expect(findUrls(text)).toEqual([{ url: "https://example.com/x", start: 4, end: 25 }]);
  });

  it("finds nothing in a line with no URL", () => {
    expect(findUrls("compiled 42 files in 3.1s")).toEqual([]);
  });

  it("leaves the sentence's punctuation out", () => {
    expect(findUrls("docs: https://example.com/a.").map((m) => m.url)).toEqual(["https://example.com/a"]);
    expect(findUrls("(see https://example.com/b)").map((m) => m.url)).toEqual(["https://example.com/b"]);
  });

  it("keeps a closing bracket the URL itself opened", () => {
    expect(findUrls("https://en.wikipedia.org/wiki/Foo_(bar)").map((m) => m.url)).toEqual([
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    ]);
  });

  it("finds several, and ignores a bare scheme", () => {
    expect(findUrls("http://a.example https:// https://b.example").map((m) => m.url)).toEqual([
      "http://a.example",
      "https://b.example",
    ]);
  });

  it("only http and https", () => {
    expect(findUrls("file:///etc/passwd javascript:alert(1) ftp://x.example")).toEqual([]);
  });
});

describe("urlLinkProvider — on a real terminal buffer", () => {
  it("reports exactly one link, with its cell range", async () => {
    const term = await terminal("see https://example.com/x for details");

    const links = await linksAt(term, 1);

    expect(links.map((l) => l.text)).toEqual(["https://example.com/x"]);
    // 1-based, inclusive: "https" starts in column 5 of row 1, ends in column 25.
    expect(links.map(range)).toEqual(["5,1-25,1"]);
  });

  it("reports nothing for a line with no URL", async () => {
    const term = await terminal("compiled 42 files in 3.1s");

    expect(await linksAt(term, 1)).toEqual([]);
  });

  it("joins a URL that wraps across rows into one link, reported on each row it touches", async () => {
    const term = await terminal("see https://example.com/a/very/long/path for details", 20);

    const [first] = await linksAt(term, 1);
    const [second] = await linksAt(term, 2);

    expect(first.text).toBe("https://example.com/a/very/long/path");
    expect(range(first)).toBe("5,1-20,2");
    expect(second.text).toBe(first.text);
    expect(await linksAt(term, 3)).toEqual([]);
  });

  it("keeps cells right after a wide character", async () => {
    // Each CJK character takes TWO cells; a mapping by string index would be off by 2.
    const term = await terminal("日本 https://example.com/jp");

    const [link] = await linksAt(term, 1);

    expect(link.text).toBe("https://example.com/jp");
    expect(link.range.start.x).toBe(6);
  });

  it("keeps a URL whole when it CONTAINS a wide character", async () => {
    // The trailing half of a wide cell has no text. Counted as a space, it would
    // split an internationalised host in two.
    const term = await terminal("go https://例え.jp/x now");

    const links = await linksAt(term, 1);

    expect(links.map((l) => l.text)).toEqual(["https://例え.jp/x"]);
  });

  it("activation calls the host with the URL and nothing else", async () => {
    const term = await terminal("see https://example.com/x for details");
    const calls: unknown[][] = [];
    const [link] = await linksAt(term, 1, (...args: unknown[]) => calls.push(args));
    const event = { type: "click" } as unknown as MouseEvent;

    link.activate(event, link.text);

    expect(calls).toEqual([["https://example.com/x", event]]);
  });

  it("underlines on hover with a pointer cursor, unless told not to", async () => {
    const term = await terminal("https://example.com");
    const [decorated] = await linksAt(term, 1);
    expect(decorated.decorations).toEqual({ underline: true, pointerCursor: true });

    const plain = urlLinkProvider(term, { onActivate: () => {}, decorate: false });
    const links = await new Promise<ILink[]>((r) => plain.provideLinks(1, (l) => r(l ?? [])));
    expect(links[0].decorations).toBeUndefined();
  });
});

describe("registerUrlLinks", () => {
  it("registers with xterm and is removed on dispose", async () => {
    const term = await terminal("x");
    let registered = 0;
    let disposed = 0;
    const original = term.registerLinkProvider.bind(term);
    term.registerLinkProvider = (provider) => {
      registered++;
      const handle = original(provider);
      return { dispose: () => { disposed++; handle.dispose(); } };
    };

    const handle = registerUrlLinks(term, { onActivate: () => {} });
    expect(registered).toBe(1);
    handle.dispose();
    expect(disposed).toBe(1);
  });
});
