import { describe, it, expect } from "vitest";
import { copyPasteBehavior, resolveKeyAction, type KeyEventLike } from "./copy-paste-mode";

const key = (over: Partial<KeyEventLike>): KeyEventLike => ({
  type: "keydown",
  key: "c",
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  ...over,
});

describe("copyPasteBehavior", () => {
  it("maps each mode to its behavior flags", () => {
    expect(copyPasteBehavior("linux")).toEqual({ selectToCopy: true, middleClickPaste: true, keyCopy: false, keyPaste: false });
    expect(copyPasteBehavior("winmac")).toEqual({ selectToCopy: false, middleClickPaste: false, keyCopy: true, keyPaste: true });
    expect(copyPasteBehavior("contextmenu")).toEqual({ selectToCopy: false, middleClickPaste: false, keyCopy: false, keyPaste: false });
    expect(copyPasteBehavior(undefined)).toEqual({ selectToCopy: false, middleClickPaste: false, keyCopy: false, keyPaste: false });
  });
});

describe("resolveKeyAction", () => {
  const dflt = copyPasteBehavior(undefined);
  const winmac = copyPasteBehavior("winmac");

  it("copies on Ctrl+Shift+C in every mode", () => {
    expect(resolveKeyAction(key({ ctrlKey: true, shiftKey: true }), false, dflt)).toBe("copy");
    expect(resolveKeyAction(key({ ctrlKey: true, shiftKey: true }), false, winmac)).toBe("copy");
  });

  it("never copies on plain Ctrl+C without a selection (stays SIGINT)", () => {
    expect(resolveKeyAction(key({ ctrlKey: true }), false, dflt)).toBeNull();
    expect(resolveKeyAction(key({ ctrlKey: true }), false, winmac)).toBeNull();
  });

  it("copies on Cmd+C only with a selection (default)", () => {
    expect(resolveKeyAction(key({ metaKey: true }), true, dflt)).toBe("copy");
    expect(resolveKeyAction(key({ metaKey: true }), false, dflt)).toBeNull();
  });

  it("winmac copies on plain Ctrl+C with a selection", () => {
    expect(resolveKeyAction(key({ ctrlKey: true }), true, winmac)).toBe("copy");
    expect(resolveKeyAction(key({ ctrlKey: true }), false, winmac)).toBeNull(); // no selection → SIGINT
  });

  it("winmac pastes on Ctrl/Cmd+V and Ctrl+Shift+V", () => {
    expect(resolveKeyAction(key({ key: "v", ctrlKey: true }), false, winmac)).toBe("paste");
    expect(resolveKeyAction(key({ key: "v", metaKey: true }), false, winmac)).toBe("paste");
    expect(resolveKeyAction(key({ key: "v", ctrlKey: true, shiftKey: true }), false, winmac)).toBe("paste");
  });

  it("does not bind paste keys outside winmac", () => {
    expect(resolveKeyAction(key({ key: "v", ctrlKey: true }), false, dflt)).toBeNull();
    expect(resolveKeyAction(key({ key: "v", ctrlKey: true }), false, copyPasteBehavior("linux"))).toBeNull();
  });

  it("ignores non-keydown events", () => {
    expect(resolveKeyAction(key({ type: "keyup", ctrlKey: true, shiftKey: true }), true, dflt)).toBeNull();
  });
});
