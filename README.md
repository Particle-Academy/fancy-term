# @particle-academy/fancy-term

**Human+ Terminal for React** — a controlled, themeable `<Terminal>` wrapping
[xterm.js](https://xtermjs.org), with hooks and an MCP-bridgeable surface so
embedded agents read the buffer, write input, and run commands **without
DOM-scraping**.

Like every Fancy UI component it serves two surfaces at once:

- **Authoring** — terse and controlled (`output` + `onData`), JSON-friendly props
  (rows/cols, theme tokens, initial buffer), a stable `data-fancy-terminal`
  handle, and a ref exposing the full `TerminalHandle`.
- **Inhabited** — that same handle is what an MCP bridge drives, so an agent reads
  the visible buffer and writes input through stable affordances, never the DOM.

Sexy by default via a Fancy dark theme drawn from the react-fancy Tailwind v4
tokens.

> **Status:** 0.1.0. `<Terminal>` + `useTerminal` / `useTerminalFit` /
> `useTerminalSession` are in place. The `registerTerminalBridge` MCP bridge
> (`terminal_read` / `terminal_write` / `terminal_run`) and the trust‑but‑verify
> staged-command affordance ship next, in `@particle-academy/agent-integrations`.

## Install

```bash
npm install @particle-academy/fancy-term @xterm/xterm @xterm/addon-fit
```

`react`, `xterm`, and the fit addon are **peer dependencies** — the wrapper itself
is zero-runtime-dep (the same posture as `fancy-echarts` over ECharts). Import the
xterm stylesheet once in your app:

```ts
import "@xterm/xterm/css/xterm.css";
```

## `<Terminal>`

The parent needs a height — the terminal fits its container (like any xterm
surface); a 0‑height parent collapses it.

```tsx
import { Terminal } from "@particle-academy/fancy-term";

function Console() {
  const [out, setOut] = useState("$ ");
  return (
    <div style={{ height: 360 }}>
      <Terminal output={out} onData={(d) => backend.send(d)} />
    </div>
  );
}
```

`output` is a **controlled buffer**: the component writes only the appended delta
as it grows (replacing it wholesale resets + rewrites), so you can drive the
terminal straight from React state — e.g. streaming command output via
fancy-query's `useFancyStream`.

| prop | type | notes |
|---|---|---|
| `output` | `string` | controlled buffer (delta-appended) |
| `onData` | `(data: string) => void` | user keystrokes / paste → your PTY/command backend |
| `onResize` | `(size) => void` | cols/rows changed |
| `theme` | `TerminalTheme` | xterm color theme; omit for the Fancy dark theme |
| `rows` / `cols` | `number` | fixed grid; omit + keep `fit` to size from the container |
| `fit` | `boolean` | auto-fit via the fit addon + ResizeObserver (default `true`) |
| `readOnly` | `boolean` | block stdin (display-only) |
| `cursorBlink` / `cursorStyle` | | `"block" \| "underline" \| "bar"` |
| `fontFamily` / `fontSize` / `scrollback` | | |
| `initialOutput` | `string` | written once on mount (uncontrolled use) |

The ref exposes a `TerminalHandle`:

```tsx
const term = useRef<TerminalHandle>(null);
// term.current.write / writeln / clear / reset / fit / focus
// term.current.getBuffer()      → the visible buffer as text (what an agent "sees")
// term.current.getSelection()   → current selection
// term.current.xterm            → the raw xterm.js instance (escape hatch)
```

## Hooks

```tsx
// Headless engine — the terminal without the component shell.
const handle = useTerminal(containerRef, { theme, onData });

// Auto-fit on resize, guarding the hidden-tab / late-mount 0×0 case.
useTerminalFit(containerRef, () => handle.fit());

// Bind to a streamed backend (PTY / SSH / command runner).
const session = useTerminalSession({
  transport: {
    send: (d) => echo.private(`pty.${id}`).whisper("stdin", { d }),
    subscribe: (onChunk) => {
      echo.private(`pty.${id}`).listen(".stdout", (e) => onChunk(e.chunk));
      return () => echo.leave(`pty.${id}`);
    },
  },
});
<Terminal output={session.output} onData={session.sendData} />
```

## Human+ contract

`<Terminal>` is **controlled** (`value`/`onData`), carries a **stable handle**
(`data-fancy-terminal` + the ref API), takes **JSON-friendly** props, and is
**bridgeable** — `registerTerminalBridge` (in `agent-integrations`, shipping next)
maps `terminal_read` / `terminal_write` / `terminal_run` onto the handle, wraps
mutations so every write broadcasts `AgentActivity`, and supports a staged
"agent proposes → human confirms" mode for destructive commands.

## License

MIT
