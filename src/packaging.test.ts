import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import pkg from "../package.json";

/**
 * How this package declares its xterm dependency, and how a consumer loads the
 * stylesheet.
 *
 * Both are packaging facts, so neither is reachable from a unit test of the
 * components — and both were wrong in 0.5.1 in a way nothing reported.
 *
 * **The peer ranges were unbounded** (`@xterm/xterm: ">=5.0.0"`), and that was
 * not theoretical: `@xterm/xterm@6.0.0` and `@xterm/addon-fit@0.11.0` are both
 * `latest` on npm as of 2026-10-10, so the range admitted a MAJOR this package
 * has never been built against. The pairing made it worse rather than better —
 * `addon-fit@0.10.0` declares `peerDependencies: {"@xterm/xterm": "^5.0.0"}`,
 * which accidentally held the line, while **`0.11.0` declares no peer at all**.
 * So `>=0.10.0` + `>=5.0.0` let a resolver pick xterm 6 with addon-fit 0.11 —
 * an untested combination, with no warning from npm, from us, or from xterm.
 *
 * `>=X <2.0` is correct for a FIRST-PARTY sibling, because we cut the sibling's
 * releases and the upper bound is a promise we keep. On third-party it is a
 * promise someone else makes, so an unbounded `>=` pre-approves every future
 * major sight-unseen.
 *
 * **The bound is DERIVED from `devDependencies`, not typed in**, because the
 * devDependency is the only version this suite ever actually builds against —
 * it is what turns the peer range from a hope into a tested claim. Bump the
 * devDependency to a new major and these tests fail until the peer range is
 * widened deliberately, which is the conversation that should happen.
 */

const peers: Record<string, string> = pkg.peerDependencies;
const devs: Record<string, string> = pkg.devDependencies;
const exports_: Record<string, unknown> = pkg.exports;

/** `^5.5.0` -> `{ major: 5, minor: 5 }`. Throws rather than guessing. */
function parseCaret(range: string): { major: number; minor: number } {
    const m = /^\^(\d+)\.(\d+)\.\d+$/.exec(range);
    if (!m) throw new Error(`expected a caret range like ^5.5.0, got ${range}`);
    return { major: Number(m[1]), minor: Number(m[2]) };
}

/**
 * The range we expect, given what we build against.
 *
 * A caret on a `0.x` version locks the MINOR — `^0.10.0` admits `0.10.x` only —
 * because a `0.x` package may break in a minor. So the peer bound has to follow
 * the same seam the caret does, or the range would claim more than the suite
 * proves.
 */
function expectedPeerRange(caret: string): string {
    const { major, minor } = parseCaret(caret);
    return major === 0 ? `>=0.${minor}.0 <0.${minor + 1}` : `>=${major}.0.0 <${major + 1}`;
}

describe("third-party peer ranges are bounded at the version we build against", () => {
    for (const name of ["@xterm/xterm", "@xterm/addon-fit"] as const) {
        it(`${name} is bounded above`, () => {
            // Guard: a renamed or removed peer would otherwise pass by reading
            // `undefined` and asserting nothing about it.
            expect(peers[name], `${name} must be declared as a peer`).toBeTypeOf("string");
            expect(devs[name], `${name} must stay a devDependency — it is the tested version`).toBeTypeOf("string");

            expect(peers[name]).toContain("<");
            expect(peers[name]).toBe(expectedPeerRange(devs[name]));
        });
    }

    it("derives the bound from the caret's own seam", () => {
        // A 0.x caret locks the minor, so the bound must too — otherwise the
        // range claims compatibility the devDependency never exercised.
        expect(expectedPeerRange("^5.5.0")).toBe(">=5.0.0 <6");
        expect(expectedPeerRange("^0.10.0")).toBe(">=0.10.0 <0.11");
        expect(() => parseCaret(">=5.0.0")).toThrow();
    });

    it("excludes the untested majors that were reachable in 0.5.1", () => {
        // The specific hole, pinned so a future widen is deliberate rather than
        // accidental. These are real published versions, not hypotheticals.
        expect(peers["@xterm/xterm"]).not.toBe(">=5.0.0");
        expect(peers["@xterm/addon-fit"]).not.toBe(">=0.10.0");
        expect(peers["@xterm/xterm"]).toBe(">=5.0.0 <6"); // not 6.0.0
        expect(peers["@xterm/addon-fit"]).toBe(">=0.10.0 <0.11"); // not 0.11.0
    });

    it("leaves react a peer, which is the same argument", () => {
        // <Terminal> hands the live XTerm instance to the consumer, exactly as a
        // React component must not own React. Recorded here so a later sweep of
        // "tidy the peers into dependencies" meets the reason first.
        expect(peers["react"]).toBe("^19.0.0");
        expect(peers["react-dom"]).toBe("^19.0.0");
    });
});

describe("the stylesheet is loadable without naming xterm", () => {
    it("is exported as ./xterm.css and shipped in the tarball", () => {
        expect(exports_["./xterm.css"]).toBe("./xterm.css");
        expect(pkg.files).toContain("xterm.css");
    });

    it("RE-EXPORTS xterm's stylesheet rather than vendoring a copy of it", () => {
        // Strip comments, then require that NOTHING but the @import remains.
        //
        // Two earlier versions of this test were wrong, both instructively.
        // Matching /\.xterm\s*\{/ to catch a pasted copy tripped on the prose
        // in xterm.css explaining the rule. Reading the file through Vite's
        // `?raw` returned an EMPTY STRING — its CSS plugin intercepts
        // `*.css?raw` — against which a `.not.toMatch()` assertion passes
        // vacuously while reporting coverage of a file it never read.
        //
        // Asserting the whole stripped body is stricter (a second rule of any
        // shape fails), immune to comments, and cannot pass on empty input.
        const xtermCss = readFileSync(new URL("../xterm.css", import.meta.url), "utf8");
        const code = xtermCss.replace(/\/\*[\s\S]*?\*\//g, "").trim();

        expect(code).toBe('@import "@xterm/xterm/css/xterm.css";');
    });
});
