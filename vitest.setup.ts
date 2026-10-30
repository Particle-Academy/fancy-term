// Intentionally NO browser-global stubs here.
//
// Up to 0.8.0 this file set `globalThis.self` and `globalThis.window` so the
// package could be imported under the node environment at all — which hid the
// fact that importing it on a real server threw `ReferenceError: self is not
// defined` (xterm's addon UMD preamble). The suite stayed green while every
// Inertia SSR page that bundled <Terminal> crashed in production. Node-env tests
// must see exactly what a server sees; DOM tests opt into jsdom per file with
// `// @vitest-environment jsdom`.
export {};
