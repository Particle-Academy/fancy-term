# ShellSwitcher

The shell/profile selector shown above a `<Terminal>`. fancy-term renders the
control and tracks the choice; **the host owns the list and does the work** —
reconnecting a PTY to the chosen shell is yours.

## Import

```tsx
import { ShellSwitcher, BUILTIN_SHELLS, resolveShell } from "@particle-academy/fancy-term";
```

## Usage

Most hosts never render it directly — set `showShellBar` on `<Terminal>`:

```tsx
<Terminal
  shells={BUILTIN_SHELLS}
  showShellBar
  onShellChange={(id, profile) => session.reconnect(profile)}
/>
```

Render it yourself when it belongs somewhere else in your chrome:

```tsx
<ShellSwitcher shells={shells} active={id} onChange={setId} />
```

## `ShellProfile`

A profile is plain data, so an agent can emit one and a host can store it:

| Field | Description |
|---|---|
| id | The id used by `activeShell`, `setShell` and `onShellChange`. |
| label | What the user sees. |
| … | Whatever else your backend needs to launch it. |

`BUILTIN_SHELLS` is a set of sensible presets to spread, not a fixed menu —
add, remove or replace freely.

## `resolveShell(shells, id)`

The pure helper that `setShell`, `<ShellSwitcher>` and the session hook all
agree on. Returns the matching `ShellProfile`, or `undefined` when the id is not
in the list — which is why an unknown id is a no-op rather than a crash.

## Controlled vs uncontrolled

Pass `activeShell` to control the selection. Omit it and `<Terminal>` tracks it
internally; `handle.setShell(id)` still works and still fires `onShellChange`.

## See also

- [Terminal](./Terminal.md)
