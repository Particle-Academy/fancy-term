import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTerminal } from "../hooks/use-terminal";
import { ShellSwitcher } from "./ShellSwitcher";
import { diffOutput } from "../output-diff";
import { decideShellSelect } from "../shell-select";
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
    shells,
    activeShell,
    onShellChange,
    showShellBar = false,
    className,
    style,
    ...rest
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected shell: controlled by `activeShell` when provided, else internal.
  const isShellControlled = activeShell !== undefined;
  const [internalShell, setInternalShell] = useState<string | undefined>(undefined);
  const shellId = isShellControlled ? activeShell : internalShell;

  // Read shell state live so the stable handle's setShell/getShell never go stale.
  const shellStateRef = useRef({ shells, shellId, isShellControlled, onShellChange });
  shellStateRef.current = { shells, shellId, isShellControlled, onShellChange };

  const selectShell = useCallback((id: string) => {
    const s = shellStateRef.current;
    const decision = decideShellSelect(s.shells, s.shellId, id);
    if (!decision) return; // unknown id — no-op
    if (!s.isShellControlled) setInternalShell(id);
    s.onShellChange?.(id, decision.profile);
  }, []);

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

  useImperativeHandle(
    ref,
    (): TerminalHandle => ({
      ...handle,
      setShell: selectShell,
      getShell: () => shellStateRef.current.shellId,
    }),
    [handle, selectShell],
  );

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

  const surface = (
    <div
      ref={containerRef}
      data-fancy-terminal=""
      data-readonly={readOnly ? "" : undefined}
      data-fancy-terminal-shell={shellId ?? undefined}
      // When the shell bar is shown the wrapper owns the box; the surface flexes.
      style={
        showShellBar && shells
          ? { width: "100%", flex: 1, minHeight: 0 }
          : { width: "100%", height: "100%", ...style }
      }
      {...(showShellBar && shells ? {} : rest)}
    />
  );

  if (!showShellBar || !shells) return surface;

  return (
    <div
      data-fancy-terminal-shell={shellId ?? undefined}
      className={className}
      style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", ...style }}
      {...rest}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 6px",
          background: "#09090b",
          borderBottom: "1px solid #27272a",
        }}
      >
        <ShellSwitcher
          shells={shells}
          value={shellId}
          onChange={(id) => selectShell(id)}
          disabled={readOnly}
        />
      </div>
      {surface}
    </div>
  );
});
