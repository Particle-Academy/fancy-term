import { useEffect, useRef, type RefObject } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { fancyDarkTheme } from "../theme";
import { useTerminalFit } from "./use-terminal-fit";
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
        try {
          fitRef.current?.fit();
        } catch {
          /* container not measurable yet — ignore */
        }
      },
      focus: () => xtermRef.current?.focus(),
      getBuffer: () => readBuffer(xtermRef.current),
      getSelection: () => xtermRef.current?.getSelection() ?? "",
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
      rows: o.rows,
      cols: o.cols,
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

    if (o.initialOutput) term.write(o.initialOutput);
    if ((o.fit ?? true) && el.clientWidth > 0 && el.clientHeight > 0) {
      try {
        fitAddon.fit();
      } catch {
        /* ignore */
      }
    }

    return () => {
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
