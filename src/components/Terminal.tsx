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
import { TerminalContextMenu } from "./TerminalContextMenu";
import { diffOutput } from "../output-diff";
import { decideShellSelect } from "../shell-select";
import { resolveMenuItems, type TerminalContextMenuContext, type TerminalContextMenuItem } from "../context-menu";
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
    clipboard,
    osc52,
    copyPaste,
    onReady,
    onPaste,
    contextMenu,
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
    clipboard,
    osc52,
    copyPaste,
    onReady,
    onPaste,
  });

  // Delegate `xterm` / `ready` as live getters rather than spreading `handle`
  // (object spread would snapshot the getters — capturing xterm === null before
  // the container is measured, the exact race consumers hit). Methods are stable.
  useImperativeHandle(
    ref,
    (): TerminalHandle => ({
      get xterm() {
        return handle.xterm;
      },
      get ready() {
        return handle.ready;
      },
      write: handle.write,
      writeln: handle.writeln,
      clear: handle.clear,
      reset: handle.reset,
      fit: handle.fit,
      focus: handle.focus,
      getBuffer: handle.getBuffer,
      getSelection: handle.getSelection,
      copySelection: handle.copySelection,
      paste: handle.paste,
      selectAll: handle.selectAll,
      clearSelection: handle.clearSelection,
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

  // Right-click selection context menu (Copy / Paste / Select all / Clear by
  // default; customizable via the `contextMenu` prop).
  const [menu, setMenu] = useState<{
    at: { x: number; y: number };
    items: TerminalContextMenuItem[];
    ctx: TerminalContextMenuContext;
  } | null>(null);

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      if (contextMenu === false) return;
      e.preventDefault();
      const selection = handle.getSelection();
      const ctx: TerminalContextMenuContext = {
        hasSelection: selection.length > 0,
        selection,
        readOnly: !!readOnly,
      };
      const items = resolveMenuItems(contextMenu, ctx, {
        copy: () => void handle.copySelection(),
        paste: () => void handle.paste(),
        selectAll: () => handle.selectAll(),
        clear: () => handle.clear(),
      });
      if (items) setMenu({ at: { x: e.clientX, y: e.clientY }, items, ctx });
    },
    [contextMenu, handle, readOnly],
  );

  const menuNode = menu ? (
    <TerminalContextMenu at={menu.at} items={menu.items} ctx={menu.ctx} onClose={() => setMenu(null)} />
  ) : null;

  const surface = (
    <div
      ref={containerRef}
      data-fancy-terminal=""
      onContextMenu={openMenu}
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

  if (!showShellBar || !shells) {
    return (
      <>
        {surface}
        {menuNode}
      </>
    );
  }

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
      {menuNode}
    </div>
  );
});
