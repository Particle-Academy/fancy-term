# Terminal

A controlled, themeable terminal over xterm.js. The output buffer is React
state, so a host can stream command output straight from its own data layer,
and an agent can read what the human sees.

## Import

```tsx
import { Terminal } from "@particle-academy/fancy-term";
import "@particle-academy/fancy-term/styles.css";
```

### This package is CLIENT-ONLY. Load it dynamically for SSR.

**Importing it at module scope on a server throws**, before any component runs:

```
ReferenceError: self is not defined
```

Measured, so you do not have to guess which dependency:

| import, in plain Node | result |
|---|---|
| `@xterm/xterm` | loads |
| **`@xterm/addon-fit`** | **`ReferenceError: self is not defined`** |

`@xterm/addon-fit` is a UMD bundle whose wrapper references `self`, a browser
global. That is upstream packaging, not an interop problem a CommonJS entry
would fix — the module simply cannot be *evaluated* outside a browser.

So in an SSR app, reach it only from a dynamically imported, client-side path:

```tsx
const TerminalPanel = lazy(async () => {
  const { Terminal } = await import("@particle-academy/fancy-term");
  await import("@particle-academy/fancy-term/styles.css");
  return { default: () => <Terminal output={out} onData={send} /> };
});
```

Any `clientOnly`-style wrapper does the same job; the requirement is that the
server's render never reaches the import. A bundler that code-splits on
`import()` keeps it out of the server bundle for you.

**A separate thing that WAS ours, fixed in 0.6.2:** the ESM bundle used to emit
`import { Terminal } from "@xterm/xterm"`, and because that package is
CommonJS-only with exports Node cannot statically detect, a plain-Node import
threw `SyntaxError: Named export 'Terminal' not found`. If you saw that error,
upgrade — it is gone. `scripts/check-esm-import.mjs` now loads the built bundle
in a real Node process on every `npm test`, because vitest runs through Vite and
its interop hides exactly this class of defect.

## Basic Usage

```tsx
<Terminal output={log} onData={(d) => pty.write(d)} />
```

## Controlled output

`output` is diffed against the previous value and only the **appended delta** is
written, so re-rendering on every chunk is cheap — wire it to a stream and let
React do the rest. Replacing `output` with a string that does not extend the
previous one resets the terminal and rewrites it.

## Props

Extends `TerminalOptions` (below) and the native `<div>` attributes, minus
`onInput`, `onResize`, `onPaste`, `contextMenu` and `children`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| output | `string` | — | The controlled buffer. Only the appended delta is written. |
| shells | `ShellProfile[]` | — | The shells/profiles you offer. Spread `BUILTIN_SHELLS` for presets; the host owns the list. |
| activeShell | `string` | — | Controlled active shell id. Omit for internal selection. |
| onShellChange | `(id, profile) => void` | — | Fired when the user or `setShell` switches. |
| showShellBar | `boolean` | `false` | Render the built-in `<ShellSwitcher>` above the surface. Opt-in so existing layout is unchanged. |
| contextMenu | `TerminalContextMenuConfig` | `true` | `false` disables; an array replaces the items; `(ctx, defaults) => items` lets you add/reorder. |

### `TerminalOptions`

| Option | Type | Default | Description |
|------|------|---------|-------------|
| theme | `TerminalTheme` | Fancy dark | xterm colour theme. |
| rows / cols | `number` | — | Fixed grid. Omit and leave `fit` on to size from the container. |
| fit | `boolean` | `true` | Auto-fit via the fit addon + `ResizeObserver`. |
| readOnly | `boolean` | `false` | Block stdin (display-only). |
| cursorBlink | `boolean` | `true` | |
| cursorStyle | `CursorStyle` | `"block"` | |
| fontFamily | `string` | — | Monospace stack. |
| fontSize | `number` | `13` | |
| scrollback | `number` | `1000` | |
| initialOutput | `string` | — | Written once on mount, before any controlled `output`. |
| onData | `(data: string) => void` | — | Keystrokes and paste data. Wire to your PTY. |
| onResize | `(size) => void` | — | |
| clipboard | `ClipboardOption` | `true` | See below. |
| osc52 | `Osc52Mode` | `"copy"` | See below. |
| copyPaste | `CopyPasteMode` | — | `"contextmenu"`, `"linux"` (highlight-to-copy, middle-click paste) or `"winmac"`. Ctrl+Shift+C always copies. |
| onReady | `(xterm: XTerm) => void` | — | Once opened and attached — the imperative twin of `handle.ready`. |
| onPaste | `(payload) => void \| boolean` | — | See "Pasted images" below. |

## Clipboard is injectable, and that matters in Electron

`clipboard` gates the copy chord, the paste interceptor, the context-menu
copy/paste and OSC 52:

- `true` / omitted — backed by `navigator.clipboard`.
- `false` — disabled. Native text paste still works.
- a `{ writeText, readText }` **provider** — every copy/paste path routes
  through it.

Supply a provider in a sandboxed Electron renderer, where `navigator.clipboard`
**silently no-ops**, to bridge to the main-process clipboard over IPC. Silently
is the operative word: without it, copy appears to work and nothing lands.

## OSC 52 defaults to write-only, deliberately

Terminal programs (Claude Code, tmux, vim) can set or read the system clipboard
via `ESC ] 52`. `osc52` is `"copy"` by default — writes only. `"read"` and
`"both"` also answer read requests, which lets anything running in the terminal
exfiltrate the clipboard, so they are opt-in. `false` disables it entirely.

## Pasted images

`onPaste` receives `{ text, files, images }` on every paste. Plain text still
pastes natively; this is where a host receives pasted **images**, which a shell
cannot render — upload them, hand them to an agent, or write a path. Return
`false` to consume the paste entirely (for example to transform it, then call
`handle.paste(...)` yourself).

## Imperative handle

| Member | Type | Description |
|---|---|---|
| xterm | `XTerm \| null` | The instance. Null before mount. |
| ready | `Promise<XTerm>` | Resolves once opened and measured. `await` it instead of polling; re-armed if the terminal is recreated. |
| write / writeln | `(data: string) => void` | Raw write; ANSI honoured. |
| clear / reset | `() => void` | Viewport (keeps scrollback) / full reset. |
| fit | `() => void` | Re-fit. No-op on a 0-size box or with `fit` off. |
| focus | `() => void` | |
| getBuffer | `() => string` | The full buffer as plain text — **what an agent "sees"**. |
| getSelection | `() => string` | |
| copySelection | `() => Promise<boolean>` | False when nothing is selected or no clipboard. |
| paste | `(text?) => Promise<void>` | Reads the system clipboard with no argument. Honours bracketed paste. |
| selectAll / clearSelection | `() => void` | |
| setShell | `(id: string) => void` | Resolves the profile and fires `onShellChange`. No-op for an unknown id. |
| getShell | `() => string \| undefined` | |

`getBuffer()` is the Human+ affordance: an agent reads the same text the person
is looking at, rather than scraping the DOM.

## Headless hooks

`useTerminal`, `useTerminalFit` and `useTerminalSession` expose the engine layer
if you would rather build your own surface. `useTerminalSession` takes a
`TerminalSessionTransport` and manages connect/reconnect against your backend —
see [ShellSwitcher](./ShellSwitcher.md) for the shell-selection half.
