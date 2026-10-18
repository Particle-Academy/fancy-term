import { describe, expect, it } from "vitest";
import { fileLinkUrl, resolveFilePath, resolveLinkHandlers, type FileLink } from "./links";

const BS = String.fromCharCode(92);
const ev = {} as MouseEvent;

/** Runs a click through a `links` config and records what would be opened. */
function clickFile(links: Parameters<typeof resolveLinkHandlers>[0], file: FileLink): string[] {
  const opened: string[] = [];
  resolveLinkHandlers(links, (u) => opened.push(u)).onFile?.(file, ev);
  return opened;
}

/**
 * Owner, 2026-10-18: "dev should be able to choose where those clicks go — open
 * in installed file editor or browser or handle them internally to trigger
 * another action like opening in their own UI."
 */
describe("where a click goes — the developer's choice", () => {
  it('url: "browser" opens the URL; a function receives it; "none" or unset links nothing', () => {
    const opened: string[] = [];
    resolveLinkHandlers({ url: "browser" }, (u) => opened.push(u)).onUrl?.("https://example.com", ev);
    expect(opened).toEqual(["https://example.com"]);

    const mine: string[] = [];
    resolveLinkHandlers({ url: (u) => mine.push(u) }).onUrl?.("https://example.com", ev);
    expect(mine).toEqual(["https://example.com"]);

    expect(resolveLinkHandlers({ url: "none" }).onUrl).toBeUndefined();
    expect(resolveLinkHandlers({}).onUrl).toBeUndefined();
    expect(resolveLinkHandlers(undefined).onFile).toBeUndefined();
  });

  it("file: an installed editor, by its URL scheme, at the line and column", () => {
    const file = { path: "src/app.ts", line: 42, column: 7 };
    expect(clickFile({ file: "vscode", root: "/home/me/project" }, file)).toEqual([
      "vscode://file/home/me/project/src/app.ts:42:7",
    ]);
    expect(clickFile({ file: "cursor", root: "/home/me/project" }, file)).toEqual([
      "cursor://file/home/me/project/src/app.ts:42:7",
    ]);
    expect(clickFile({ file: "windsurf", root: "/p" }, file)).toEqual(["windsurf://file/p/src/app.ts:42:7"]);
    expect(clickFile({ file: "vscode-insiders", root: "/p" }, file)).toEqual([
      "vscode-insiders://file/p/src/app.ts:42:7",
    ]);
  });

  it("file: a Windows project root, matching VS Code's own form (vscode://file/c:/...)", () => {
    const root = ["C:", "work", "app"].join(BS);
    expect(clickFile({ file: "vscode", root }, { path: "src/main.ts", line: 3 })).toEqual([
      "vscode://file/C:/work/app/src/main.ts:3:1",
    ]);
  });

  it("file: a template — any editor scheme, or a code host in the browser", () => {
    expect(
      clickFile(
        { file: { template: "https://github.com/org/repo/blob/main/{path}#L{line}" } },
        { path: "./src/app.ts", line: 9 },
      ),
    ).toEqual(["https://github.com/org/repo/blob/main/src/app.ts#L9"]);

    expect(
      clickFile({ file: { template: "idea://open?file={path}&line={line}" }, root: "/p" }, { path: "a.kt", line: 2 }),
    ).toEqual(["idea://open?file=/p/a.kt&line=2"]);
  });

  it("{path} is the path exactly; {slashPath} always has one leading slash", () => {
    const t = "x://{path}|{slashPath}";
    expect(clickFile({ file: { template: t }, root: "/p" }, { path: "a.ts" })).toEqual(["x:///p/a.ts|/p/a.ts"]);
    expect(clickFile({ file: { template: t } }, { path: "C:/w/a.ts" })).toEqual(["x://C:/w/a.ts|/C:/w/a.ts"]);
    expect(clickFile({ file: { template: t } }, { path: "src/a.ts" })).toEqual(["x://src/a.ts|/src/a.ts"]);
  });

  it("file: a function gets the link — plus the resolved absolute path when a root is set", () => {
    const got: unknown[] = [];
    resolveLinkHandlers({ file: (f) => got.push(f), root: "/home/me/project" }).onFile?.(
      { path: "../shared/x.ts", line: 5 },
      ev,
    );
    expect(got).toEqual([{ path: "../shared/x.ts", line: 5, absolutePath: "/home/me/shared/x.ts" }]);

    const bare: unknown[] = [];
    resolveLinkHandlers({ file: (f) => bare.push(f) }).onFile?.({ path: "a.ts" }, ev);
    expect(bare).toEqual([{ path: "a.ts" }]);
  });

  it('file: "none" links nothing', () => {
    expect(resolveLinkHandlers({ file: "none" }).onFile).toBeUndefined();
  });
});

describe("resolveFilePath / fileLinkUrl", () => {
  it("joins a relative path to the root and collapses . and ..", () => {
    expect(resolveFilePath("./src/../lib/a.ts", "/p/app")).toBe("/p/app/lib/a.ts");
    expect(resolveFilePath("src/a.ts", "/p/app/")).toBe("/p/app/src/a.ts");
  });

  it("keeps an absolute path, Windows ones included, with forward slashes", () => {
    expect(resolveFilePath("/etc/hosts", "/p")).toBe("/etc/hosts");
    expect(resolveFilePath(["C:", "x", "y.ts"].join(BS), "/p")).toBe("C:/x/y.ts");
  });

  it("leaves ~ for the host, which knows the home directory", () => {
    expect(resolveFilePath("~/notes/a.md", "/p")).toBe("~/notes/a.md");
  });

  it("encodes a space in the path", () => {
    expect(fileLinkUrl({ path: "/p/my file.ts" }, "vscode://file{slashPath}:{line}:{column}")).toBe(
      "vscode://file/p/my%20file.ts:1:1",
    );
  });
});
