import { resolveShell, type ShellProfile } from "./types";

/**
 * Pure decision for "select shell `id`": resolves the profile and reports whether
 * the selection actually changed. The single source of truth shared by
 * `<Terminal>`'s `setShell`, `<ShellSwitcher>`, and `useTerminalSession`, so the
 * interactive behavior is unit-testable without a DOM.
 *
 * Returns `null` when the id isn't in `shells` (a no-op — unknown shell).
 */
export function decideShellSelect(
  shells: ShellProfile[] | undefined,
  current: string | undefined,
  id: string,
): { profile: ShellProfile; changed: boolean } | null {
  const profile = resolveShell(shells, id);
  if (!profile) return null;
  return { profile, changed: current !== id };
}

/**
 * Pure decision for a session shell switch. The session hook holds the buffer +
 * the transport, so it only needs to know: did the shell change? If so it must
 * reset the buffer (to `initial`) and reconnect the transport. Extracted so the
 * reset-and-reconnect contract is unit-testable without rendering the hook.
 */
export function decideShellSwitch(
  current: string | undefined,
  next: string | undefined,
): { changed: boolean } {
  return { changed: current !== next };
}
