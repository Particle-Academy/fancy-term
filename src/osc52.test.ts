import { describe, it, expect } from "vitest";
import { parseOsc52, encodeBase64, decodeBase64, osc52Response } from "./osc52";

describe("base64 codec", () => {
  it("round-trips ASCII + UTF-8", () => {
    for (const s of ["", "hello", "a b\tc", "café ☕ — 日本語", "line1\nline2"]) {
      expect(decodeBase64(encodeBase64(s))).toBe(s);
    }
  });

  it("encodes a known vector", () => {
    expect(encodeBase64("hello")).toBe("aGVsbG8=");
    expect(decodeBase64("aGVsbG8=")).toBe("hello");
  });

  it("returns '' for malformed base64 rather than throwing", () => {
    expect(decodeBase64("!!!not base64!!!")).toBe("");
  });
});

describe("parseOsc52", () => {
  it("parses a write request (base64 payload)", () => {
    const req = parseOsc52(`c;${encodeBase64("copied text")}`);
    expect(req).toEqual({ selection: "c", kind: "write", data: "copied text" });
  });

  it("parses a read request (?)", () => {
    expect(parseOsc52("c;?")).toEqual({ selection: "c", kind: "read", data: "" });
  });

  it("keeps the selection field verbatim (primary, combined)", () => {
    expect(parseOsc52("p;?")?.selection).toBe("p");
    expect(parseOsc52(`cp;${encodeBase64("x")}`)?.selection).toBe("cp");
  });

  it("returns null when there is no separator", () => {
    expect(parseOsc52("garbage")).toBeNull();
  });

  it("decodes UTF-8 payloads", () => {
    const req = parseOsc52(`c;${encodeBase64("café ☕")}`);
    expect(req?.data).toBe("café ☕");
  });
});

describe("osc52Response", () => {
  it("wraps the base64 in ESC ] 52 ; <Pc> ; <b64> BEL", () => {
    expect(osc52Response("c", "hi")).toBe(`\x1b]52;c;${encodeBase64("hi")}\x07`);
  });
});
