import { useCallback, useEffect, useRef, useState } from "react";

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
}

export interface UseTerminalSessionOptions {
  transport: TerminalSessionTransport;
  /** Replayed history written before live output starts. */
  initial?: string;
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
  const [output, setOutput] = useState(options.initial ?? "");

  const transportRef = useRef(options.transport);
  transportRef.current = options.transport;

  useEffect(() => {
    const unsub = transportRef.current.subscribe((chunk) => setOutput((o) => o + chunk));
    return () => {
      if (typeof unsub === "function") unsub();
    };
    // subscribe once; the transport is read live via the ref.
  }, []);

  const sendData = useCallback((data: string) => {
    void transportRef.current.send(data);
  }, []);

  const append = useCallback((chunk: string) => setOutput((o) => o + chunk), []);
  const clear = useCallback(() => setOutput(""), []);

  return { output, sendData, append, clear };
}
