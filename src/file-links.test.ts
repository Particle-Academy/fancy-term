import { describe, expect, it } from "vitest";
import { Terminal as XTerm, type ILink } from "@xterm/xterm";
import { findFilePaths, terminalLinkProvider, type FileLink } from "./links";

function terminal(text: string, cols = 80): Promise<XTerm> {
  const term = new XTerm({ cols, rows: 6, allowProposedApi: true });
  return new Promise((resolve) => term.write(text, () => resolve(term)));
}

const paths = (text: string) =>
  findFilePaths(text).map((m) => [m.path, m.line, m.column].filter((v) => v !== undefined).join(":"));

// Built from a character code so no backslash ever has to be typed or escaped.
const BS = String.fromCharCode(92);
const win = (...parts: string[]) => parts.join(BS);

/**
 * Owner, 2026-10-18: "links to files need to be clickable as well." Compiler,
 * test-runner and stack-trace output names files with a line and column; a click
 * should open the file there (Genie's FileViewer takes a `line`).
 *
 * The risk is false positives — an underline under ordinary words — so a path is
 * linked only if it has a directory part or a line number.
 */
describe("findFilePaths", () => {
  it("relative paths with line and column", () => {
    expect(paths("src/app.ts:42:7 - error TS2322")).toEqual(["src/app.ts:42:7"]);
    expect(paths("at render (src/components/Card.tsx:10:3)")).toEqual(["src/components/Card.tsx:10:3"]);
  });

  it("./, ../, ~/ and absolute POSIX paths", () => {
    expect(paths("./scripts/build.mjs")).toEqual(["./scripts/build.mjs"]);
    expect(paths("../shared/util.ts:5")).toEqual(["../shared/util.ts:5"]);
    expect(paths("~/notes/todo.md")).toEqual(["~/notes/todo.md"]);
    expect(paths("loaded /usr/lib/libssl.so ok")).toEqual(["/usr/lib/libssl.so"]);
  });

  it("Windows paths, either slash", () => {
    expect(paths(`at ${win("C:", "work", "app", "main.ts")}:12:4`)).toEqual([`${win("C:", "work", "app", "main.ts")}:12:4`]);
    expect(paths("open C:/work/app/main.ts")).toEqual(["C:/work/app/main.ts"]);
    expect(paths(win("src", "Program.cs") + "(12,5): error CS1002")).toEqual([`${win("src", "Program.cs")}:12:5`]);
  });

  it("a bare file name only when it carries a line", () => {
    expect(paths("app.ts:3:1 unexpected token")).toEqual(["app.ts:3:1"]);
    expect(paths("edit package.json then retry")).toEqual([]);
  });

  it("does not underline ordinary words", () => {
    expect(paths("e.g. this and/or that, i.e. fine")).toEqual([]);
    expect(paths("version 1.2.3 released, ratio 3/4")).toEqual([]);
    expect(paths("mail bob@example.com")).toEqual([]);
  });

  it("leaves surrounding punctuation out", () => {
    expect(paths("see src/a.ts.")).toEqual(["src/a.ts"]);
    expect(paths("(src/a.ts:3)")).toEqual(["src/a.ts:3"]);
    expect(paths('"lib/b.js",')).toEqual(["lib/b.js"]);
  });

  it("never links a path that is part of a URL", () => {
    expect(paths("https://example.com/assets/app.js")).toEqual([]);
  });
});

describe("terminalLinkProvider — files on a real terminal buffer", () => {
  function linksAt(term: XTerm, row: number, onFile: (l: FileLink, e: MouseEvent) => void, onUrl?: (u: string) => void) {
    const provider = terminalLinkProvider(term, { onFile, onUrl: onUrl && ((u) => onUrl(u)) });
    return new Promise<ILink[]>((resolve) => provider.provideLinks(row, (links) => resolve(links ?? [])));
  }

  it("reports a file link with its cell range, and hands path, line and column to the host", async () => {
    const term = await terminal("src/app.ts:42:7 - error TS2322");
    const got: FileLink[] = [];
    const [link] = await linksAt(term, 1, (l) => got.push(l));

    expect(link.text).toBe("src/app.ts:42:7");
    expect(`${link.range.start.x},${link.range.start.y}-${link.range.end.x},${link.range.end.y}`).toBe("1,1-15,1");

    link.activate({} as MouseEvent, link.text);
    expect(got).toEqual([{ path: "src/app.ts", line: 42, column: 7 }]);
  });

  it("reports URLs and files on one line, each to its own handler", async () => {
    const term = await terminal("see https://example.com/x and src/a.ts:3");
    const files: string[] = [];
    const urls: string[] = [];
    const links = await linksAt(term, 1, (l) => files.push(l.path), (u) => urls.push(u));

    expect(links.map((l) => l.text)).toEqual(["https://example.com/x", "src/a.ts:3"]);
    for (const link of links) link.activate({} as MouseEvent, link.text);
    expect(urls).toEqual(["https://example.com/x"]);
    expect(files).toEqual(["src/a.ts"]);
  });

  it("files only when a file handler is given", async () => {
    const term = await terminal("src/a.ts:3 and https://example.com");
    const provider = terminalLinkProvider(term, { onUrl: () => {} });
    const links = await new Promise<ILink[]>((r) => provider.provideLinks(1, (l) => r(l ?? [])));

    expect(links.map((l) => l.text)).toEqual(["https://example.com"]);
  });
});
