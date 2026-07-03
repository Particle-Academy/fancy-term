// osc52.ts — OSC 52 clipboard handling. Modern TUIs (Claude Code, tmux, vim /
// neovim) copy their own selection with `ESC ] 52 ; <Pc> ; <Pd> BEL`. xterm.js
// drops OSC 52 by default, so a program shows "copied" but nothing reaches the
// system clipboard — a silent, confusing failure. We parse the sequence and
// route it through the injectable clipboard provider.
//
// The parse + base64 codec are pure so they're unit-testable without a live
// xterm; registerOsc52 wires them to an xterm instance.

import type { Terminal as XTerm } from "@xterm/xterm";
import type { IDisposable } from "@xterm/xterm";
import type { ClipboardProvider } from "./clipboard";
import { providerRead } from "./clipboard";

/**
 * OSC 52 policy: `copy` allows programs to WRITE the clipboard (the common TUI
 * case), `read` allows a program to READ it back (a `?` request), `both` allows
 * either, `false` disables OSC 52 entirely. Read is the real exfiltration risk
 * (arbitrary terminal output could siphon your clipboard), so it must be opted
 * into explicitly.
 */
export type Osc52Mode = "copy" | "read" | "both" | false;

/** A parsed OSC 52 request: which selection buffer, and write-a-payload vs read-request. */
export interface Osc52Request {
  /** The `Pc` field — clipboard selection(s), e.g. `"c"` (clipboard), `"p"` (primary). */
  selection: string;
  kind: "write" | "read";
  /** Decoded text for a write; `""` for a read request. */
  data: string;
}

/** UTF-8-safe base64 encode (browser `btoa` operates on binary strings). */
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === "function" ? btoa(binary) : binary;
}

/** UTF-8-safe base64 decode; returns `""` on malformed input. */
export function decodeBase64(b64: string): string {
  try {
    const binary = typeof atob === "function" ? atob(b64) : b64;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/**
 * Parse an OSC 52 payload (the part after `ESC ] 52 ;`, i.e. `<Pc> ; <Pd>`).
 * `Pd === "?"` is a read request; otherwise `Pd` is base64 to write. Returns
 * `null` for a malformed payload (no `;`).
 */
export function parseOsc52(payload: string): Osc52Request | null {
  const semi = payload.indexOf(";");
  if (semi < 0) return null;
  const selection = payload.slice(0, semi);
  const pd = payload.slice(semi + 1);
  if (pd === "?") return { selection, kind: "read", data: "" };
  return { selection, kind: "write", data: decodeBase64(pd) };
}

/** Build the OSC 52 response a `read` request expects: `ESC ] 52 ; <Pc> ; <base64> BEL`. */
export function osc52Response(selection: string, text: string): string {
  return `\x1b]52;${selection};${encodeBase64(text)}\x07`;
}

/**
 * Register an OSC 52 handler on an xterm instance, routing writes/reads through
 * `provider` per `mode`. Returns the {@link IDisposable} (or `null` when
 * `mode === false`). The handler always returns `true` (consumed) so a
 * disallowed direction is swallowed rather than echoed as garbage.
 */
export function registerOsc52(
  term: XTerm,
  provider: () => ClipboardProvider,
  mode: () => Osc52Mode,
): IDisposable | null {
  if (mode() === false) return null;

  return term.parser.registerOscHandler(52, (payload) => {
    const m = mode();
    if (m === false) return true;
    const req = parseOsc52(payload);
    if (!req) return false; // not ours / malformed — let xterm handle it

    if (req.kind === "write") {
      if (m === "copy" || m === "both") {
        void Promise.resolve(provider().writeText(req.data)).catch(() => {});
      }
      return true;
    }

    // read request (`?`)
    if (m === "read" || m === "both") {
      void providerRead(provider()).then((text) => {
        term.write(osc52Response(req.selection, text));
      });
    }
    return true;
  });
}
