/**
 * Import the built ESM bundle in a REAL Node process, with no bundler.
 *
 * This cannot be a vitest test, and that is the point: vitest runs through Vite,
 * whose CommonJS interop rewrites a named import from a CJS dependency into
 * something that works. The defect below is therefore INVISIBLE to every test in
 * this repo's suite — the runner cannot represent the failure.
 *
 * WHAT THIS GUARDS, exactly — our own import statements:
 *
 *   0.6.1 emitted  `import { Terminal } from '@xterm/xterm'`  into dist/index.js.
 *
 * `@xterm/xterm` ships CommonJS whose exports Node's cjs-module-lexer cannot
 * statically detect, so under plain Node ESM that threw
 * `SyntaxError: Named export 'Terminal' not found`, while
 * `require('@xterm/xterm')` worked — which is why it read as our bug rather than
 * a lexer limit. It bit any consumer importing this package without a bundler.
 * Reported by `claude · genie2`, whose SSR render tests died at import. Fixed in
 * 0.6.2 by importing the default and destructuring.
 *
 * WHAT THIS DELIBERATELY DOES NOT GUARD — and why `self` is stubbed below:
 *
 * `@xterm/addon-fit` is a UMD bundle whose wrapper references `self`, so it
 * throws `ReferenceError: self is not defined` when EVALUATED in Node, no matter
 * how we import it. Measured:
 *
 *   import('@xterm/xterm')      -> OK
 *   import('@xterm/addon-fit')  -> ReferenceError: self is not defined
 *
 * That is upstream packaging, not our import style, and the two failures are
 * easy to conflate — the first attempt at this script did. Stubbing `self`
 * isolates the thing we control. It is NOT a claim that this package is
 * SSR-safe: a server render that evaluates the module graph still loads
 * addon-fit and still dies. Making it genuinely SSR-safe means loading
 * addon-fit lazily at mount, which is a design change, not a packaging fix, and
 * is written up rather than smuggled in here.
 *
 * Exits non-zero on failure, and non-zero (never "skip") when dist is missing —
 * a check that quietly passes because it had nothing to look at is worse than no
 * check at all.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// See the header: isolates addon-fit's browser-only UMD preamble from the thing
// under test, which is whether OUR import statements load under Node.
globalThis.self = globalThis;

const dist = fileURLToPath(new URL("../dist/index.js", import.meta.url));

if (!existsSync(dist)) {
    console.error(`[esm-smoke] FAIL: ${dist} does not exist — build before running this.`);
    process.exit(1);
}

try {
    const mod = await import(pathToFileURL(dist).href);

    // Positive control: a successful import must actually yield the surface.
    // Without it, a bundle that imported nothing at all would pass.
    //
    // `Terminal` is a forwardRef component, so it is an OBJECT carrying
    // `$$typeof`, not a function — the first version of this check asserted
    // `typeof === "function"` and failed on correct code, which is the better
    // outcome than a control so loose it passes on anything.
    if (typeof mod.useTerminal !== "function") {
        console.error(`[esm-smoke] FAIL: \`useTerminal\` is ${typeof mod.useTerminal}, not a function.`);
        process.exit(1);
    }
    const isComponent =
        typeof mod.Terminal === "function" ||
        (typeof mod.Terminal === "object" && mod.Terminal !== null && "$$typeof" in mod.Terminal);
    if (!isComponent) {
        console.error(`[esm-smoke] FAIL: \`Terminal\` is not a React component (${typeof mod.Terminal}).`);
        process.exit(1);
    }

    console.log("[esm-smoke] OK — dist/index.js loads under plain Node ESM and exports Terminal + useTerminal.");
} catch (err) {
    const first = String(err.message).split("\n")[0];
    console.error("[esm-smoke] FAIL: dist/index.js does not load under plain Node ESM.");
    console.error(`  ${err.constructor.name}: ${first}`);

    if (err instanceof SyntaxError && /Named export/.test(first)) {
        console.error(
            "  This is the 0.6.1 defect: a NAMED import from a CommonJS-only peer.\n" +
                "  Use a default import and destructure:\n" +
                "    import pkg from '@xterm/xterm';\n" +
                "    const { Terminal } = pkg;",
        );
    }
    process.exit(1);
}
