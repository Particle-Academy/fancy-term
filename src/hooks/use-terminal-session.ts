import { useCallback, useEffect, useRef, useState } from "react";
import { decideShellSwitch } from "../shell-select";

/**
 * A streamed terminal backend — a PTY, an SSH session, or a command runner.
 * `subscribe` pushes output chunks (wire it to an Echo channel or a fancy-query
 * `useFancyStream` feed); `send` forwards the user's keystrokes upstream.
 */
export interface TerminalSessionTransport {
  /** Forward user input / keystrokes to the backend. */
  send: (data: string) => void | Promise<void>;
  /** Subscribe to backend output chunks; return an unsubscribe function. */
  subscribe: (onChunk: (chunk: string) => void) => (() => void) | void;
  /**
   * Optional — called when the active shell changes (and once on mount if a
   * `shell` is provided). The host (re)connects its PTY/command backend to the
   * chosen shell here. Transports that don't care about shells can omit it; the
   * hook stays fully backward compatible.
   */
  connect?: (shell: string | undefined) => void | Promise<void>;
}

export interface UseTerminalSessionOptions {
  transport: TerminalSessionTransport;
  /** Replayed history written before live output starts. */
  initial?: string;
  /** The active shell id. Changing it resets the buffer + calls `transport.connect`. */
  shell?: string;
}

export interface TerminalSessionApi {
  /** Accumulated output — feed to `<Terminal output={output} />`. */
  output: string;
  /** Forward keystrokes upstream — wire to `<Terminal onData={sendData} />`. */
  sendData: (data: string) => void;
  /** Append a chunk locally (e.g. a client-side echo or banner). */
  append: (chunk: string) => void;
  /** Clear the local buffer. */
  clear: () => void;
  /** The active shell id (controlled by `options.shell` when provided). */
  shell: string | undefined;
  /**
   * Switch shells: resets the buffer (back to `initial`) and tells the transport
   * to reconnect via `transport.connect(id)`. In controlled mode (`options.shell`
   * set) this still fires `connect`; pass the new id down via `options.shell` to
   * reflect it. No-op when the id matches the current shell.
   */
  switchShell: (id: string | undefined) => void;
}

/**
 * Bind a `<Terminal>` to a streamed backend: accumulates incoming output into a
 * controlled buffer and forwards keystrokes upstream — the glue between the
 * display surface and a PTY/command channel.
 *
 * ```tsx
 * const session = useTerminalSession({
 *   transport: {
 *     send: (d) => echo.private(`pty.${id}`).whisper("stdin", { d }),
 *     subscribe: (onChunk) => {
 *       const ch = echo.private(`pty.${id}`).listen(".stdout", (e) => onChunk(e.chunk));
 *       return () => echo.leave(`pty.${id}`);
 *     },
 *   },
 * });
 * <Terminal output={session.output} onData={session.sendData} />
 * ```
 */
export function useTerminalSession(options: UseTerminalSessionOptions): TerminalSessionApi {
  const initial = options.initial ?? "";
  const [output, setOutput] = useState(initial);

  // In uncontrolled mode `switchShell` drives this; in controlled mode the
  // `options.shell` effect keeps it in sync.
  const [internalShell, setInternalShell] = useState<string | undefined>(options.shell);
  const shell = options.shell !== undefined ? options.shell : internalShell;

  const transportRef = useRef(options.transport);
  transportRef.current = options.transport;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    const unsub = transportRef.current.subscribe((chunk) => setOutput((o) => o + chunk));
    return () => {
      if (typeof unsub === "function") unsub();
    };
    // subscribe once; the transport is read live via the ref.
  }, []);

  // Connect on mount + whenever the active shell changes. Resetting the buffer
  // is owned by switchShell (uncontrolled) / this effect (controlled).
  const connectedShell = useRef<string | undefined>(undefined);
  const mounted = useRef(false);
  useEffect(() => {
    // On mount: connect once (even if shell is undefined, for parity).
    if (!mounted.current) {
      mounted.current = true;
      connectedShell.current = shell;
      void transportRef.current.connect?.(shell);
      return;
    }
    if (!decideShellSwitch(connectedShell.current, shell).changed) return;
    connectedShell.current = shell;
    setOutput(initialRef.current); // reset the buffer for the new shell
    void transportRef.current.connect?.(shell);
  }, [shell]);

  const sendData = useCallback((data: string) => {
    void transportRef.current.send(data);
  }, []);

  const append = useCallback((chunk: string) => setOutput((o) => o + chunk), []);
  const clear = useCallback(() => setOutput(""), []);

  const switchShell = useCallback((id: string | undefined) => {
    // Uncontrolled: flip internal state, the effect above does reset + connect.
    // Controlled (options.shell set): still drive a reset + connect now so the
    // host sees the switch immediately even before it echoes options.shell back.
    setInternalShell((cur) => (cur === id ? cur : id));
    if (!decideShellSwitch(connectedShell.current, id).changed) return;
    connectedShell.current = id;
    setOutput(initialRef.current);
    void transportRef.current.connect?.(id);
  }, []);

  return { output, sendData, append, clear, shell, switchShell };
}
