// xterm's addon UMD shim references the browser `self` global at module-load.
// We only server-render (no real terminal mounts in tests), so a minimal stub is
// enough to let the modules import under vitest's node environment.
const g = globalThis as Record<string, unknown>;
if (typeof g.self === "undefined") g.self = globalThis;
if (typeof g.window === "undefined") g.window = globalThis;
