import { describe, it, expect } from "vitest";
import { diffOutput } from "./output-diff";

describe("diffOutput", () => {
  it("returns null when nothing changed", () => {
    expect(diffOutput("hello", "hello")).toBeNull();
  });

  it("writes only the appended delta when output grows", () => {
    expect(diffOutput("hel", "hello")).toEqual({ reset: false, write: "lo" });
  });

  it("treats the first write as a full append from empty", () => {
    expect(diffOutput("", "$ ls\n")).toEqual({ reset: false, write: "$ ls\n" });
  });

  it("resets + rewrites when the value diverges (wholesale replace)", () => {
    expect(diffOutput("old output", "brand new")).toEqual({ reset: true, write: "brand new" });
  });

  it("resets + rewrites when the value shrinks", () => {
    expect(diffOutput("hello world", "hello")).toEqual({ reset: true, write: "hello" });
  });
});
