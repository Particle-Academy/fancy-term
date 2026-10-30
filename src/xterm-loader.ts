// Lazy, client-only loader for xterm.js and its addons.
//
// NOTHING in this package may import `@xterm/xterm` or any `@xterm/addon-*` at
// module top level (type-only imports are fine — they are erased). The addon UMD
// bundles read `self` the moment they are evaluated, so a top-level import made
// `import "@particle-academy/fancy-term"` throw `ReferenceError: self is not
// defined` on any server: every Inertia SSR page that bundled a <Terminal>
// crashed (0.8.0 and earlier). Loading happens here instead, from inside the
// mount effect, which never runs on the server.
//
// Guarded by src/ssr.test.tsx and scripts/check-ssr-import.mjs (built ESM + CJS
// in plain Node, no DOM), and by the no-top-level-import rule in
// src/packaging.test.ts.
import type { Terminal as XTermClass } from "@xterm/xterm";
import type { FitAddon as FitAddonClass } from "@xterm/addon-fit";

export interface XtermModules {
  Terminal: typeof XTermClass;
  FitAddon: typeof FitAddonClass;
}

let loaded: XtermModules | null = null;
let loading: Promise<XtermModules> | null = null;

/**
 * Read a named export off a dynamically imported module. The xterm packages are
 * CommonJS whose exports Node's cjs-module-lexer cannot detect, so under plain
 * Node ESM the namespace carries ONLY `default` (= module.exports); bundlers and
 * tsup's CJS interop also expose the name directly. Accept either.
 */
function pick<T>(mod: unknown, name: string): T {
  const m = mod as Record<string, unknown> & { default?: Record<string, unknown> };
  const value = m[name] ?? m.default?.[name];
  if (value === undefined) throw new Error(`[fancy-term] ${name} not found in the loaded xterm module`);
  return value as T;
}

/** The xterm modules if they have already been loaded, else null (synchronous). */
export function loadedXterm(): XtermModules | null {
  return loaded;
}

/** Load xterm + addon-fit once; concurrent callers share the same promise. A failed load may be retried. */
export function loadXterm(): Promise<XtermModules> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(
    ([xterm, fit]) => {
      loaded = {
        Terminal: pick<typeof XTermClass>(xterm, "Terminal"),
        FitAddon: pick<typeof FitAddonClass>(fit, "FitAddon"),
      };
      return loaded;
    },
    (err: unknown) => {
      loading = null;
      throw err;
    },
  );
  return loading;
}
