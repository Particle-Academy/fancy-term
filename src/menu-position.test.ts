import { describe, it, expect } from "vitest";
import { clampMenuPosition } from "./menu-position";

const VP = { width: 1000, height: 800 };
const MENU = { width: 180, height: 120 };

describe("clampMenuPosition", () => {
  it("leaves a comfortably-placed menu where it is", () => {
    expect(clampMenuPosition({ x: 100, y: 100 }, MENU, VP)).toEqual({ x: 100, y: 100 });
  });

  it("pushes left/up when it would overflow the right/bottom edge", () => {
    const p = clampMenuPosition({ x: 990, y: 790 }, MENU, VP);
    expect(p.x).toBe(1000 - 180 - 8);
    expect(p.y).toBe(800 - 120 - 8);
  });

  it("never goes past the top-left margin", () => {
    expect(clampMenuPosition({ x: -50, y: -50 }, MENU, VP)).toEqual({ x: 8, y: 8 });
  });

  it("floors at the margin when the menu is larger than the viewport", () => {
    expect(clampMenuPosition({ x: 500, y: 500 }, { width: 2000, height: 2000 }, VP)).toEqual({ x: 8, y: 8 });
  });
});
