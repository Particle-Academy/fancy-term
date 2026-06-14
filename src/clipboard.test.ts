import { describe, it, expect } from "vitest";
import { readDataTransfer, isImageFile } from "./clipboard";

const file = (type: string, name = "f"): File => ({ type, name }) as unknown as File;

function dt(opts: { text?: string; files?: File[] }): DataTransfer {
  const files = opts.files ?? [];
  const items = files.map((f) => ({ kind: "file", getAsFile: () => f }));
  return {
    getData: (t: string) => (t === "text/plain" ? (opts.text ?? "") : ""),
    items,
    files,
  } as unknown as DataTransfer;
}

describe("isImageFile", () => {
  it("matches image/* MIME types only", () => {
    expect(isImageFile(file("image/png"))).toBe(true);
    expect(isImageFile(file("image/jpeg"))).toBe(true);
    expect(isImageFile(file("text/plain"))).toBe(false);
    expect(isImageFile({} as File)).toBe(false);
  });
});

describe("readDataTransfer", () => {
  it("pulls text + files + just the images", () => {
    const png = file("image/png", "shot.png");
    const txt = file("text/plain", "a.txt");
    const p = readDataTransfer(dt({ text: "hello", files: [png, txt] }));
    expect(p.text).toBe("hello");
    expect(p.files).toHaveLength(2);
    expect(p.images).toEqual([png]);
  });

  it("is null-safe", () => {
    expect(readDataTransfer(null)).toEqual({ text: "", files: [], images: [] });
  });

  it("survives a throwing getData", () => {
    const bad = {
      getData: () => {
        throw new Error("denied");
      },
      items: [],
      files: [],
    } as unknown as DataTransfer;
    expect(readDataTransfer(bad)).toEqual({ text: "", files: [], images: [] });
  });
});
