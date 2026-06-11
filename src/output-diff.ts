/**
 * Decide what to push to the terminal when the controlled `output` changes.
 * Terminals are append-only streams, so the common case (output grew) writes
 * only the delta; a value that no longer extends what we've written means a
 * wholesale replace, so reset + rewrite. Returns null when nothing changed.
 */
export function diffOutput(
  written: string,
  next: string,
): { reset: boolean; write: string } | null {
  if (next === written) return null;
  if (next.startsWith(written)) return { reset: false, write: next.slice(written.length) };
  return { reset: true, write: next };
}
