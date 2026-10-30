import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

/**
 * SSR contract, inside the suite: under the node environment (no DOM, no
 * `self`/`window` stubs — see vitest.setup.ts) the package entry must import
 * and <Terminal> must server-render its placeholder. 0.8.0 threw
 * `ReferenceError: self is not defined` at import. The built-bundle twin of
 * this test is scripts/check-ssr-import.mjs (ESM + CJS in plain Node).
 */
describe("server-side import + render", () => {
    it("runs with no browser globals (vacuity guard)", () => {
        const g = globalThis as Record<string, unknown>;
        expect(g.self).toBeUndefined();
        expect(g.window).toBeUndefined();
        expect(g.document).toBeUndefined();
    });

    it("imports the package entry without touching xterm", async () => {
        const mod = await import("./index");
        expect(typeof mod.useTerminal).toBe("function");
        expect(mod.Terminal).toBeTruthy();
    });

    it("renderToString yields the stable placeholder container", async () => {
        const { Terminal } = await import("./index");
        const html = renderToString(
            createElement(Terminal, { readOnly: true, initialOutput: "hello", "aria-label": "term" }),
        );
        expect(html).toContain('data-fancy-terminal=""');
        expect(html).toContain('data-readonly=""');
        expect(html).toContain('aria-label="term"');
        // Nothing xterm renders may appear server-side — it mounts on the client.
        expect(html).not.toContain("xterm");
        expect(html).not.toContain("hello");
    });
});
