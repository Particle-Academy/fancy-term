import { describe, it, expect } from "vitest";
import {
  defaultMenuItems,
  resolveMenuItems,
  type TerminalContextMenuContext,
  type TerminalMenuActions,
} from "./context-menu";

const actions: TerminalMenuActions = {
  copy() {},
  paste() {},
  selectAll() {},
  clear() {},
};
const ctx = (over: Partial<TerminalContextMenuContext> = {}): TerminalContextMenuContext => ({
  hasSelection: true,
  selection: "x",
  readOnly: false,
  ...over,
});

describe("defaultMenuItems", () => {
  it("disables Copy without a selection", () => {
    const noSel = defaultMenuItems(ctx({ hasSelection: false, selection: "" }), actions);
    expect(noSel.find((i) => i.id === "copy")?.disabled).toBe(true);
    expect(defaultMenuItems(ctx(), actions).find((i) => i.id === "copy")?.disabled).toBe(false);
  });

  it("drops Paste + Clear when read-only", () => {
    const ids = defaultMenuItems(ctx({ readOnly: true }), actions).map((i) => i.id);
    expect(ids).toContain("copy");
    expect(ids).toContain("select-all");
    expect(ids).not.toContain("paste");
    expect(ids).not.toContain("clear");
  });
});

describe("resolveMenuItems", () => {
  it("false disables the menu", () => {
    expect(resolveMenuItems(false, ctx(), actions)).toBeNull();
  });

  it("true / undefined → default items", () => {
    expect(resolveMenuItems(undefined, ctx(), actions)?.length).toBeGreaterThan(0);
    expect(resolveMenuItems(true, ctx(), actions)?.length).toBeGreaterThan(0);
  });

  it("an array replaces the items wholesale", () => {
    const items = [{ id: "x", label: "X" }];
    expect(resolveMenuItems(items, ctx(), actions)).toBe(items);
  });

  it("a function receives the defaults and can extend them", () => {
    const out = resolveMenuItems(
      (_c, defaults) => [...defaults, { id: "agent", label: "Send to agent" }],
      ctx(),
      actions,
    );
    expect(out?.some((i) => i.id === "agent")).toBe(true);
    expect(out?.some((i) => i.id === "copy")).toBe(true);
  });

  it("an empty result resolves to null (don't open an empty menu)", () => {
    expect(resolveMenuItems(() => [], ctx(), actions)).toBeNull();
  });
});
