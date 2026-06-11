import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTerminal } from "../hooks/use-terminal";
import { diffOutput } from "../output-diff";
import type { TerminalHandle, TerminalProps } from "../types";

/**
 * Human+ `<Terminal>` — a controlled, themeable xterm.js terminal.
 *
 * - **Authoring surface:** terse, controlled (`output` + `onData`), JSON-friendly
 *   props (rows/cols, theme tokens, initial buffer), a stable `data-fancy-terminal`
 *   handle, and a ref exposing {@link TerminalHandle} (write/clear/fit/getBuffer/…).
 * - **Inhabited surface:** the same handle is what an MCP bridge drives, so an
 *   embedded agent reads the buffer + writes input without DOM-scraping.
 *
 * The parent must have a height — the terminal fits its container (like any xterm
 * surface); a 0-height parent collapses it.
 *
 * ```tsx
 * const [out, setOut] = useState("");
 * <div style={{ height: 360 }}>
 *   <Terminal output={out} onData={(d) => backend.send(d)} />
 * </div>
 * ```
 */
export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  {
    output,
    theme,
    rows,
    cols,
    fit = true,
    readOnly,
    cursorBlink,
    cursorStyle,
    fontFamily,
    fontSize,
    scrollback,
    initialOutput,
    onData,
    onResize,
    className,
    style,
    ...rest
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handle = useTerminal(containerRef, {
    theme,
    rows,
    cols,
    fit,
    readOnly,
    cursorBlink,
    cursorStyle,
    fontFamily,
    fontSize,
    scrollback,
    // `initialOutput` is for uncontrolled use; with a controlled `output` the
    // diffing effect below owns the buffer, so don't double-write.
    initialOutput: output === undefined ? initialOutput : undefined,
    onData,
    onResize,
  });

  useImperativeHandle(ref, () => handle, [handle]);

  // Controlled output: write only the appended delta; reset + rewrite if the
  // value diverges from what we've already written (a wholesale replace).
  const written = useRef("");
  useEffect(() => {
    if (output === undefined) return;
    const change = diffOutput(written.current, output);
    if (!change) return;
    if (change.reset) handle.reset();
    handle.write(change.write);
    written.current = output;
  }, [output, handle]);

  return (
    <div
      ref={containerRef}
      data-fancy-terminal=""
      data-readonly={readOnly ? "" : undefined}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
      {...rest}
    />
  );
});
