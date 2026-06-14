import { useEffect, useRef, type RefObject } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { fancyDarkTheme } from "../theme";
import { useTerminalFit } from "./use-terminal-fit";
import { readClipboardText, readDataTransfer, writeClipboardText } from "../clipboard";
import { shouldCopyEvent } from "../copy-keybinding";
import type { TerminalHandle, TerminalOptions } from "../types";

const DEFAULT_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Read the whole xterm buffer as plain text — what an agent "sees". */
function readBuffer(term: XTerm | null): string {
  if (!term) return "";
  const buf = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buf.length; i++) {
    const line = buf.getLine(i);
    if (line) lines.push(line.translateToString(true));
  }
  return lines.join("\n").replace(/\n+$/, "");
}

/**
 * Create + own an xterm.js instance for a container, returning a stable
 * {@link TerminalHandle}. The headless engine layer behind `<Terminal>` — use it
 * directly when you want the terminal without the component shell (custom chrome,
 * an agent bridge host, tests). Options are read live, so changing them re-applies
 * without tearing down the terminal.
 */
export function useTerminal(
  containerRef: RefObject<HTMLElement | null>,
  options: TerminalOptions = {},
): TerminalHandle {
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  // Stable handle — its methods always operate on the live xterm via the ref.
  const handleRef = useRef<TerminalHandle | null>(null);
  if (handleRef.current === null) {
    handleRef.current = {
      get xterm() {
        return xtermRef.current;
      },
      write: (d) => xtermRef.current?.write(d),
      writeln: (d) => xtermRef.current?.writeln(d),
      clear: () => xtermRef.current?.clear(),
      reset: () => xtermRef.current?.reset(),
      fit: () => {
        const addon = fitRef.current;
        if (!addon) return;
        try {
          // Guard against an unmeasurable container / not-yet-rendered viewport:
          // proposeDimensions() returns undefined (or NaN) then, and fit() would
          // call xterm's resize(undefined,…), which console-errors "cols must be
          // numeric". Skip — the ResizeObserver fires again once it's measurable.
          // This matters most under `showShellBar`, whose extra layout pass races
          // the first fit.
          const dims = addon.proposeDimensions();
          if (
            !dims ||
            !Number.isFinite(dims.cols) ||
            !Number.isFinite(dims.rows) ||
            dims.cols < 1 ||
            dims.rows < 1
          ) {
            return;
          }
          addon.fit();
        } catch {
          /* container not measurable yet — ignore */
        }
      },
      focus: () => xtermRef.current?.focus(),
      getBuffer: () => readBuffer(xtermRef.current),
      getSelection: () => xtermRef.current?.getSelection() ?? "",
      copySelection: async () => {
        const sel = xtermRef.current?.getSelection() ?? "";
        if (!sel) return false;
        return writeClipboardText(sel);
      },
      paste: async (text) => {
        const data = text ?? (await readClipboardText());
        if (data) xtermRef.current?.paste(data);
      },
      selectAll: () => xtermRef.current?.selectAll(),
      clearSelection: () => xtermRef.current?.clearSelection(),
      // Shell selection is owned by the <Terminal> component layer (it needs the
      // `shells` list + onShellChange). The headless engine is shell-agnostic, so
      // these are no-ops here and get overridden when <Terminal> composes them.
      setShell: () => {},
      getShell: () => undefined,
    };
  }
  const handle = handleRef.current;

  // Create the engine once for the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const o = optsRef.current;

    const term = new XTerm({
      theme: o.theme ?? fancyDarkTheme,
      // Only pass rows/cols when explicitly set. xterm validates these and
      // console-errors "rows/cols must be numeric" if handed `undefined`, rather
      // than falling back to its 80×24 default. Omit the keys instead.
      ...(typeof o.rows === "number" ? { rows: o.rows } : {}),
      ...(typeof o.cols === "number" ? { cols: o.cols } : {}),
      disableStdin: o.readOnly ?? false,
      cursorBlink: o.cursorBlink ?? true,
      cursorStyle: o.cursorStyle ?? "block",
      fontFamily: o.fontFamily ?? DEFAULT_FONT,
      fontSize: o.fontSize ?? 13,
      scrollback: o.scrollback ?? 1000,
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(el);
    xtermRef.current = term;
    fitRef.current = fitAddon;

    const dataSub = term.onData((d) => optsRef.current.onData?.(d));
    const resizeSub = term.onResize(({ cols, rows }) =>
      optsRef.current.onResize?.({ cols, rows }),
    );

    // ── Clipboard wiring (gated by `clipboard !== false`, read live) ──────────
    // Copy: Ctrl+Shift+C / Cmd+C-with-selection → system clipboard. Returning
    // false consumes the event so no control byte is sent; plain Ctrl+C is never
    // matched (stays SIGINT — see shouldCopyEvent).
    term.attachCustomKeyEventHandler((e) => {
      if (optsRef.current.clipboard === false) return true;
      if (shouldCopyEvent(e, term.hasSelection())) {
        void writeClipboardText(term.getSelection());
        return false;
      }
      return true;
    });

    // Paste: a capture-phase listener on the container runs before xterm's own
    // textarea handler. We do NOT preventDefault for text, so xterm pastes it
    // exactly once natively — we only surface the payload (esp. pasted images)
    // via onPaste. The host returning false (or a read-only terminal) suppresses
    // the native text paste.
    const onPasteEvent = (e: ClipboardEvent) => {
      const o2 = optsRef.current;
      if (o2.clipboard === false) return;
      if (o2.readOnly) {
        e.preventDefault();
        return;
      }
      const payload = readDataTransfer(e.clipboardData);
      if (o2.onPaste?.(payload) === false) e.preventDefault();
    };
    el.addEventListener("paste", onPasteEvent, true);

    if (o.initialOutput) term.write(o.initialOutput);
    // Route through the guarded handle.fit() (proposeDimensions check) so a
    // not-yet-laid-out container never triggers an xterm resize(undefined).
    if (o.fit ?? true) handle.fit();

    return () => {
      el.removeEventListener("paste", onPasteEvent, true);
      dataSub.dispose();
      resizeSub.dispose();
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // Re-apply reactive options without tearing the terminal down.
  useEffect(() => {
    const t = xtermRef.current;
    if (!t) return;
    if (options.theme) t.options.theme = options.theme;
    if (options.readOnly !== undefined) t.options.disableStdin = options.readOnly;
    if (options.cursorBlink !== undefined) t.options.cursorBlink = options.cursorBlink;
    if (options.cursorStyle) t.options.cursorStyle = options.cursorStyle;
    if (options.fontSize) t.options.fontSize = options.fontSize;
    if (options.fontFamily) t.options.fontFamily = options.fontFamily;
  }, [options.theme, options.readOnly, options.cursorBlink, options.cursorStyle, options.fontSize, options.fontFamily]);

  // Auto-fit on container resize (0×0-guarded).
  useTerminalFit(containerRef, () => handle.fit(), options.fit ?? true);

  return handle;
}
