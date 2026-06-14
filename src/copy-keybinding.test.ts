import { describe, it, expect } from "vitest";
import { shouldCopyEvent } from "./copy-keybinding";

const ev = (over: Partial<Parameters<typeof shouldCopyEvent>[0]> = {}) => ({
  type: "keydown",
  key: "c",
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  ...over,
});

describe("shouldCopyEvent", () => {
  it("copies on Ctrl+Shift+C (with or without a selection)", () => {
    expect(shouldCopyEvent(ev({ ctrlKey: true, shiftKey: true }), true)).toBe(true);
    expect(shouldCopyEvent(ev({ ctrlKey: true, shiftKey: true, key: "C" }), false)).toBe(true);
  });

  it("NEVER copies on plain Ctrl+C — stays SIGINT", () => {
    expect(shouldCopyEvent(ev({ ctrlKey: true }), true)).toBe(false);
    expect(shouldCopyEvent(ev({ ctrlKey: true }), false)).toBe(false);
  });

  it("copies on Cmd/Meta+C only when there is a selection (macOS)", () => {
    expect(shouldCopyEvent(ev({ metaKey: true }), true)).toBe(true);
    expect(shouldCopyEvent(ev({ metaKey: true }), false)).toBe(false);
  });

  it("ignores non-keydown, non-C, and odd combos", () => {
    expect(shouldCopyEvent(ev({ type: "keyup", ctrlKey: true, shiftKey: true }), true)).toBe(false);
    expect(shouldCopyEvent(ev({ key: "v", ctrlKey: true, shiftKey: true }), true)).toBe(false);
    expect(shouldCopyEvent(ev({ ctrlKey: true, shiftKey: true, metaKey: true }), true)).toBe(false);
  });
});
