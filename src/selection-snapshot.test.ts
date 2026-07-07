import { describe, it, expect } from "vitest";
import { nextSelectionSnapshot } from "./selection-snapshot";

describe("nextSelectionSnapshot", () => {
  it("captures the selection when a drag-select completes (left mouseup)", () => {
    expect(nextSelectionSnapshot("", { type: "mouseup", button: 0 }, "picked text")).toBe(
      "picked text",
    );
  });

  it("keeps the snapshot when the live selection was cleared under us (the TUI case)", () => {
    // Selected → TUI redraw cleared xterm's selection → right-click.
    expect(nextSelectionSnapshot("picked text", { type: "mousedown", button: 2 }, "")).toBe(
      "picked text",
    );
    expect(nextSelectionSnapshot("picked text", { type: "mouseup", button: 2 }, "")).toBe(
      "picked text",
    );
  });

  it("re-captures on right press while the selection is still alive", () => {
    expect(nextSelectionSnapshot("stale", { type: "mousedown", button: 2 }, "fresh")).toBe(
      "fresh",
    );
  });

  it("resets on a fresh left press — even though the live selection still reads the old text", () => {
    // At capture time xterm hasn't processed the press yet, so the OLD
    // selection is still readable; it must not survive into the new gesture.
    expect(nextSelectionSnapshot("old", { type: "mousedown", button: 0 }, "old")).toBe("");
  });

  it("does not resurrect a deliberately cleared selection", () => {
    // Left click elsewhere (deselect): mousedown resets, mouseup finds nothing.
    const afterDown = nextSelectionSnapshot("old", { type: "mousedown", button: 0 }, "old");
    expect(nextSelectionSnapshot(afterDown, { type: "mouseup", button: 0 }, "")).toBe("");
  });

  it("middle-click leaves the snapshot alone when nothing is selected", () => {
    expect(nextSelectionSnapshot("kept", { type: "mousedown", button: 1 }, "")).toBe("kept");
  });
});
