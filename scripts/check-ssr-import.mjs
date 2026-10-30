/**
 * Load the BUILT package in a real Node process with NO DOM, in both module
 * formats, and server-render <Terminal>. This is the SSR contract.
 *
 * 0.8.0 and earlier imported `@xterm/xterm` and `@xterm/addon-fit` at module
 * top level. addon-fit is a UMD bundle whose wrapper reads `self` the moment it
 * is evaluated, so merely importing this package on a server threw
 *
 *   ReferenceError: self is not defined
 *
 * and took down every Inertia SSR page that bundled a <Terminal> anywhere in its
 * module graph (ui.particle.academy /inspiration/* — the gallery page bundles
 * every style, and one of them imports fancy-term). Fixed in 0.8.1 by loading
 * xterm and its addons lazily, inside the client-only mount effect.
 *
 * Deliberately NOT stubbed: `self`, `window`, `document`. The previous smoke
 * test (check-esm-import.mjs) stubbed `self` to isolate a different defect, and
 * that stub is exactly why this one shipped. This script fails if any of those
 * globals exist, so a future stub cannot make it pass vacuously.
 *
 * Exits non-zero on failure, and non-zero (never "skip") when dist is missing.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const failures = [];
const fail = (msg) => failures.push(msg);

for (const g of ["self", "window", "document"]) {
    if (typeof globalThis[g] !== "undefined") {
        console.error(`[ssr-smoke] FAIL: global \`${g}\` is defined — this check must run with no DOM.`);
        process.exit(1);
    }
}

const esmPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const cjsPath = fileURLToPath(new URL("../dist/index.cjs", import.meta.url));
for (const p of [esmPath, cjsPath]) {
    if (!existsSync(p)) {
        console.error(`[ssr-smoke] FAIL: ${p} does not exist — build before running this.`);
        process.exit(1);
    }
}

function firstLine(err) {
    return `${err?.constructor?.name ?? "Error"}: ${String(err?.message ?? err).split("\n")[0]}`;
}

function checkSurface(label, mod) {
    if (!mod) return;
    // Positive control: a "successful" import that yields nothing must not pass.
    if (typeof mod.useTerminal !== "function") fail(`${label}: \`useTerminal\` is ${typeof mod.useTerminal}`);
    const t = mod.Terminal;
    const ok = typeof t === "function" || (typeof t === "object" && t !== null && "$$typeof" in t);
    if (!ok) fail(`${label}: \`Terminal\` is not a React component (${typeof t})`);
}

let esm = null;
try {
    esm = await import(pathToFileURL(esmPath).href);
    checkSurface("ESM dist/index.js", esm);
} catch (err) {
    fail(`ESM dist/index.js threw at import — ${firstLine(err)}`);
}

let cjs = null;
try {
    const require = createRequire(import.meta.url);
    cjs = require(cjsPath);
    checkSurface("CJS dist/index.cjs", cjs);
} catch (err) {
    fail(`CJS dist/index.cjs threw at require — ${firstLine(err)}`);
}

// Server render: must succeed and yield the stable placeholder the client
// renders before xterm mounts (the same container + data attributes).
const React = (await import("react")).default;
const { renderToString } = await import("react-dom/server");
for (const [label, mod] of [["ESM", esm], ["CJS", cjs]]) {
    if (!mod?.Terminal) continue;
    try {
        const html = renderToString(React.createElement(mod.Terminal, { readOnly: true, initialOutput: "hi" }));
        if (!html.includes("data-fancy-terminal=")) fail(`${label} renderToString: no data-fancy-terminal container in ${html}`);
        if (!html.includes("data-readonly=")) fail(`${label} renderToString: props not reflected on the placeholder: ${html}`);
        if (html.includes("xterm")) fail(`${label} renderToString: xterm markup leaked into SSR output: ${html}`);
    } catch (err) {
        fail(`${label} renderToString threw — ${firstLine(err)}`);
    }
}

if (failures.length) {
    console.error("[ssr-smoke] FAIL: the package is not safe to import/render on the server.");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
}
console.log("[ssr-smoke] OK — ESM + CJS load with no DOM, and <Terminal> server-renders its placeholder.");
