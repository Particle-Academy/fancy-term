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

> **Status:** 0.2.0. `<Terminal>` + `useTerminal` / `useTerminalFit` /
> `useTerminalSession` are in place, plus **shell / profile switching** (the
> `<ShellSwitcher>` component, controlled `shells` / `activeShell` props, and the
> session hook's `switchShell`). The `registerTerminalBridge` MCP bridge
> (`terminal_read` / `terminal_write` / `terminal_run` / `terminal_set_shell`) and
> the trust‑but‑verify staged-command affordance ship in
> `@particle-academy/agent-integrations`.

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
| `shells` | `ShellProfile[]` | the shells / profiles the host offers (see [Switching shells](#switching-shells)) |
| `activeShell` | `string` | controlled selected shell id (omit for uncontrolled) |
| `onShellChange` | `(id, profile) => void` | fired when the user / `setShell` switches |
| `showShellBar` | `boolean` | render the `<ShellSwitcher>` toolbar above the surface (default `false`) |

The ref exposes a `TerminalHandle`:

```tsx
const term = useRef<TerminalHandle>(null);
// term.current.write / writeln / clear / reset / fit / focus
// term.current.getBuffer()      → the visible buffer as text (what an agent "sees")
// term.current.getSelection()   → current selection
// term.current.setShell("pwsh") → switch the active shell (fires onShellChange)
// term.current.getShell()       → the active shell id
// term.current.xterm            → the raw xterm.js instance (escape hatch)
```

## Switching shells

fancy-term is a **frontend wrapper** — it never spawns a shell. It owns the
*selected-shell state, the UI, and the change events*; the **host reacts** by
reconnecting its PTY / command backend to the chosen profile. That separation
keeps the wrapper portable across any backend.

A `ShellProfile` is fully JSON-friendly (an agent can emit one):

```ts
interface ShellProfile {
  id: string;        // stable key, e.g. "powershell"
  label: string;     // display, e.g. "PowerShell"
  icon?: string;     // optional short glyph / emoji / single char
  command?: string;  // host hint, e.g. "pwsh" / "cmd.exe"
  args?: string[];   // host hint
  cwd?: string;      // host hint
}
```

`command` / `args` / `cwd` are **host hints only** — fancy-term passes the choice
along; your backend decides what to launch. Spread the built-in presets and
filter to what your host actually offers:

```ts
import { BUILTIN_SHELLS } from "@particle-academy/fancy-term";
// cmd · powershell · pwsh · git-bash · bash · zsh
const shells = BUILTIN_SHELLS.filter((s) => ["pwsh", "git-bash"].includes(s.id));
```

### On the `<Terminal>` (controlled)

```tsx
const [shell, setShell] = useState("pwsh");

<div style={{ height: 360 }}>
  <Terminal
    output={out}
    onData={(d) => backend.send(d)}
    shells={shells}
    activeShell={shell}
    onShellChange={(id) => {
      setShell(id);
      backend.reconnect(id); // host reconnects its PTY to the chosen shell
    }}
    showShellBar           // opt-in: render the built-in switcher toolbar
  />
</div>
```

The root carries `data-fancy-terminal-shell="<id>"` so an agent (or an MCP bridge)
can read the active shell without DOM-guessing. Omit `activeShell` for an
uncontrolled terminal that tracks the selection internally.

### Standalone `<ShellSwitcher>`

Place the picker anywhere — it's a self-contained, accessible (Arrow / Enter /
Esc), Fancy-dark-themed dropdown with zero third-party deps:

```tsx
import { ShellSwitcher } from "@particle-academy/fancy-term";

<ShellSwitcher
  shells={shells}
  value={shell}
  onChange={(id, profile) => backend.reconnect(profile)}
/>
```

Stable handles: the root carries `data-fancy-shell-switcher`, each option carries
`data-shell-id`.

### In the session hook

`useTerminalSession` accepts a `shell` and exposes `switchShell(id)`. Switching
**resets the buffer** and calls the transport's optional `connect(shell)` so the
host can (re)wire its backend. Transports that don't care about shells just omit
`connect` — fully backward compatible.

```tsx
const session = useTerminalSession({
  shell: "pwsh",
  transport: {
    send: (d) => backend.send(d),
    subscribe: (onChunk) => backend.onOutput(onChunk),
    connect: (shell) => backend.connect(shell), // (re)connect to the chosen shell
  },
});

// later — reset + reconnect to a new shell:
session.switchShell("git-bash");
<Terminal output={session.output} onData={session.sendData} />
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

`<Terminal>` is **controlled** (`value`/`onData`, `activeShell`/`onShellChange`),
carries **stable handles** (`data-fancy-terminal` + `data-fancy-terminal-shell`,
`data-fancy-shell-switcher` / `data-shell-id`, plus the ref API), takes
**JSON-friendly** props (including `ShellProfile[]`), and is **bridgeable** —
`registerTerminalBridge` (in `agent-integrations`) maps `terminal_read` /
`terminal_write` / `terminal_run` / `terminal_set_shell` onto the handle, wraps
mutations so every write broadcasts `AgentActivity`, and supports a staged
"agent proposes → human confirms" mode for destructive commands.

## License

MIT

---

## ⭐ Star Fancy UI

If this package is useful to you, a quick ⭐ on the repo really helps us build a better kit. Thank you!
