// context-menu.ts — the model for the customizable terminal selection menu.
// Pure data + a resolver; the rendering lives in TerminalContextMenu.tsx.

/** Context handed to the menu at right-click time + to custom item builders. */
export interface TerminalContextMenuContext {
  /** Whether there is a non-empty text selection. */
  hasSelection: boolean;
  /** The selected text (or ""). */
  selection: string;
  /** Whether the terminal is read-only (paste / clear are dropped by default). */
  readOnly: boolean;
}

/** A single menu entry. `onSelect` runs on click; set `separator` for a divider. */
export interface TerminalContextMenuItem {
  /** Stable id (used as the React key + a `data-menu-item` handle). */
  id: string;
  /** Visible label. Ignored for separators. */
  label?: string;
  /** Optional leading glyph / emoji / short string (JSON-friendly — no ReactNode). */
  icon?: string;
  /** Greyed-out + non-interactive. */
  disabled?: boolean;
  /** Render a divider instead of a clickable item. */
  separator?: boolean;
  /** Invoked on click with the menu context. */
  onSelect?: (ctx: TerminalContextMenuContext) => void;
}

/** The actions the built-in items dispatch to (wired by the component). */
export interface TerminalMenuActions {
  copy: () => void;
  paste: () => void;
  selectAll: () => void;
  clear: () => void;
}

/**
 * The `contextMenu` prop shape:
 * - `false` — disable the menu entirely.
 * - `true` / omitted — the default Copy / Paste / Select all / Clear menu.
 * - an array — replace the default items wholesale.
 * - a function — receives the context **and the default items** so you can
 *   add/remove/reorder (e.g. append a "Send to agent" item).
 */
export type TerminalContextMenuConfig =
  | boolean
  | TerminalContextMenuItem[]
  | ((
      ctx: TerminalContextMenuContext,
      defaults: TerminalContextMenuItem[],
    ) => TerminalContextMenuItem[]);

/** The built-in Copy / Paste / Select all / Clear items, contextual to selection + readOnly. */
export function defaultMenuItems(
  ctx: TerminalContextMenuContext,
  actions: TerminalMenuActions,
): TerminalContextMenuItem[] {
  const items: TerminalContextMenuItem[] = [
    { id: "copy", label: "Copy", icon: "⧉", disabled: !ctx.hasSelection, onSelect: actions.copy },
  ];
  if (!ctx.readOnly) {
    items.push({ id: "paste", label: "Paste", icon: "⎘", onSelect: actions.paste });
  }
  items.push({ id: "select-all", label: "Select all", onSelect: actions.selectAll });
  if (!ctx.readOnly) {
    items.push({ id: "sep-default", separator: true });
    items.push({ id: "clear", label: "Clear", onSelect: actions.clear });
  }
  return items;
}

/**
 * Resolve the configured menu into the final item list, or `null` when disabled.
 * Empty results (e.g. a function that filtered everything out) also resolve to
 * `null` so the caller can skip opening an empty menu.
 */
export function resolveMenuItems(
  config: TerminalContextMenuConfig | undefined,
  ctx: TerminalContextMenuContext,
  actions: TerminalMenuActions,
): TerminalContextMenuItem[] | null {
  if (config === false) return null;
  const defaults = defaultMenuItems(ctx, actions);
  const items =
    config === undefined || config === true
      ? defaults
      : Array.isArray(config)
        ? config
        : config(ctx, defaults);
  return items.length > 0 ? items : null;
}
