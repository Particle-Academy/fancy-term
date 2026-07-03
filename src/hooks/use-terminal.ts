import { useEffect, useRef, type RefObject } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { fancyDarkTheme } from "../theme";
import { useTerminalFit } from "./use-terminal-fit";
import { providerRead, providerWrite, readDataTransfer, resolveClipboard } from "../clipboard";
import { copyPasteBehavior, resolveKeyAction } from "../copy-paste-mode";
import { registerOsc52 } from "../osc52";
import type { TerminalHandle, TerminalOptions } from "../types";

const DEFAULT_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** A minimal externally-resolvable promise (Promise.withResolvers isn't universally available). */
function makeDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

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

  // A re-armable "xterm is open" promise backing handle.ready.
  const readyRef = useRef(makeDeferred<XTerm>());

  // Stable handle — its methods always operate on the live xterm via the ref.
  const handleRef = useRef<TerminalHandle | null>(null);
  if (handleRef.current === null) {
    handleRef.current = {
      get xterm() {
        return xtermRef.current;
      },
      get ready() {
        return readyRef.current.promise;
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
        return providerWrite(resolveClipboard(optsRef.current.clipboard).provider, sel);
      },
      paste: async (text) => {
        const data = text ?? (await providerRead(resolveClipboard(optsRef.current.clipboard).provider));
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

    // Paste the system clipboard into the terminal (honors readOnly + bracketed
    // paste). Shared by the paste key chord and middle-click paste.
    const pasteFromClipboard = async () => {
      const oo = optsRef.current;
      if (oo.readOnly) return;
      const text = await providerRead(resolveClipboard(oo.clipboard).provider);
      if (text) xtermRef.current?.paste(text);
    };

    // ── Clipboard wiring (gated by `clipboard !== false`, read live) ──────────
    // Copy/paste key chords resolved by the active `copyPaste` mode: Ctrl+Shift+C
    // always copies; plain Ctrl+C stays SIGINT unless winmac + selection; winmac
    // also binds Ctrl/Cmd+V paste. Returning false consumes the event.
    term.attachCustomKeyEventHandler((e) => {
      const oo = optsRef.current;
      const clip = resolveClipboard(oo.clipboard);
      if (!clip.enabled) return true;
      const action = resolveKeyAction(e, term.hasSelection(), copyPasteBehavior(oo.copyPaste));
      if (action === "copy") {
        void providerWrite(clip.provider, term.getSelection());
        return false;
      }
      if (action === "paste") {
        void pasteFromClipboard();
        return false;
      }
      return true;
    });

    // OSC 52 — terminal programs (Claude Code, tmux, vim) copy/read the clipboard
    // via `ESC ] 52`. Routed through the live provider; off when clipboard === false.
    const oscDisposable = registerOsc52(
      term,
      () => resolveClipboard(optsRef.current.clipboard).provider,
      () => {
        const oo = optsRef.current;
        return resolveClipboard(oo.clipboard).enabled ? (oo.osc52 ?? "copy") : false;
      },
    );

    // linux mode: auto-copy the selection as it changes (X11 primary-selection).
    const selectionSub = term.onSelectionChange(() => {
      const oo = optsRef.current;
      const clip = resolveClipboard(oo.clipboard);
      if (clip.enabled && copyPasteBehavior(oo.copyPaste).selectToCopy && term.hasSelection()) {
        void providerWrite(clip.provider, term.getSelection());
      }
    });

    // linux mode: middle-click pastes.
    const onMouseDown = (ev: MouseEvent) => {
      const oo = optsRef.current;
      if (ev.button !== 1) return;
      if (!resolveClipboard(oo.clipboard).enabled) return;
      if (!copyPasteBehavior(oo.copyPaste).middleClickPaste) return;
      ev.preventDefault();
      void pasteFromClipboard();
    };
    el.addEventListener("mousedown", onMouseDown);

    // Paste: a capture-phase listener on the container runs before xterm's own
    // textarea handler. We do NOT preventDefault for text, so xterm pastes it
    // exactly once natively — we only surface the payload (esp. pasted images)
    // via onPaste. The host returning false (or a read-only terminal) suppresses
    // the native text paste.
    const onPasteEvent = (e: ClipboardEvent) => {
      const o2 = optsRef.current;
      if (resolveClipboard(o2.clipboard).enabled === false) return;
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

    // The terminal is open + attached — signal readiness so consumers wiring
    // addons don't have to poll handle.xterm.
    optsRef.current.onReady?.(term);
    readyRef.current.resolve(term);

    return () => {
      el.removeEventListener("paste", onPasteEvent, true);
      el.removeEventListener("mousedown", onMouseDown);
      oscDisposable?.dispose();
      selectionSub.dispose();
      dataSub.dispose();
      resizeSub.dispose();
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
      // Re-arm readiness for a potential remount (container change).
      readyRef.current = makeDeferred<XTerm>();
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
