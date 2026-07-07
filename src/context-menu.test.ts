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

  // #2 — the built-in Copy must act on the selection snapshotted when the menu
  // opened, not a click-time re-read (which is already cleared over a
  // mouse-reporting TUI). The menu invokes `onSelect(ctx)`; Copy's onSelect IS
  // the copy action, so the action receives that ctx and can use ctx.selection.
  it("Copy forwards the menu-open ctx (with its snapshotted selection) to actions.copy", () => {
    const received: TerminalContextMenuContext[] = [];
    const spied: TerminalMenuActions = { ...actions, copy: (c) => received.push(c) };
    const menuCtx = ctx({ selection: "snapshotted at open" });
    const copy = defaultMenuItems(menuCtx, spied).find((i) => i.id === "copy");
    copy?.onSelect?.(menuCtx);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(menuCtx);
    expect(received[0].selection).toBe("snapshotted at open");
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
