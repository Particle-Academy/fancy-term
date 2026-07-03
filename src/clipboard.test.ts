import { describe, it, expect } from "vitest";
import {
  readDataTransfer,
  isImageFile,
  resolveClipboard,
  navigatorClipboard,
  providerRead,
  providerWrite,
  type ClipboardProvider,
} from "./clipboard";

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

describe("resolveClipboard", () => {
  it("false → disabled, with the navigator provider as a placeholder", () => {
    const r = resolveClipboard(false);
    expect(r.enabled).toBe(false);
    expect(r.provider).toBe(navigatorClipboard);
  });

  it("true / undefined → enabled with the navigator provider", () => {
    expect(resolveClipboard(true)).toEqual({ enabled: true, provider: navigatorClipboard });
    expect(resolveClipboard(undefined)).toEqual({ enabled: true, provider: navigatorClipboard });
  });

  it("an object → enabled with that injected provider", () => {
    const custom: ClipboardProvider = { writeText: () => {}, readText: () => "x" };
    const r = resolveClipboard(custom);
    expect(r.enabled).toBe(true);
    expect(r.provider).toBe(custom);
  });
});

describe("providerWrite / providerRead", () => {
  it("routes through the injected provider", async () => {
    let written = "";
    const provider: ClipboardProvider = {
      writeText: async (t) => {
        written = t;
      },
      readText: async () => "from host",
    };
    expect(await providerWrite(provider, "hi")).toBe(true);
    expect(written).toBe("hi");
    expect(await providerRead(provider)).toBe("from host");
  });

  it("providerWrite resolves false when the provider throws", async () => {
    const provider: ClipboardProvider = {
      writeText: () => {
        throw new Error("no clipboard");
      },
      readText: () => "",
    };
    expect(await providerWrite(provider, "hi")).toBe(false);
  });

  it("providerRead resolves '' when the provider rejects", async () => {
    const provider: ClipboardProvider = {
      writeText: () => {},
      readText: async () => {
        throw new Error("denied");
      },
    };
    expect(await providerRead(provider)).toBe("");
  });
});
