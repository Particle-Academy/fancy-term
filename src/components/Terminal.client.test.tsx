// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, createRef, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Terminal as XTerm } from "@xterm/xterm";
import { Terminal } from "./Terminal";
import { useTerminal } from "../hooks/use-terminal";
import type { TerminalHandle } from "../types";

/**
 * Client behaviour after xterm became lazily loaded (0.8.1): it still mounts,
 * writes land (including ones made BEFORE the lazy import resolved), and fit
 * resizes the terminal.
 */

beforeAll(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no ResizeObserver or matchMedia; xterm / useTerminalFit need them.
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(async () => {
  // xterm's Viewport schedules a setTimeout(syncScrollArea) at open which throws
  // if the terminal was disposed first (upstream). Let it run before unmounting.
  await new Promise((r) => setTimeout(r, 10));
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
}

/** xterm parses writes asynchronously; an empty write's callback fires after the queue drains. */
function flush(term: XTerm): Promise<void> {
  return new Promise((resolve) => term.write("", resolve));
}

describe("<Terminal> on the client (jsdom)", () => {
  it("mounts xterm into the placeholder and resolves ready + onReady", async () => {
    const ref = createRef<TerminalHandle>();
    const onReady = vi.fn();
    mount(<Terminal ref={ref} onReady={onReady} />);

    const term = await ref.current!.ready;
    expect(term).toBeTruthy();
    expect(ref.current!.xterm).toBe(term);
    expect(onReady).toHaveBeenCalledWith(term);
    const container = host!.querySelector("[data-fancy-terminal]");
    expect(container?.querySelector(".xterm")).not.toBeNull();
  });

  it("controlled output and writes made before xterm loaded are not lost", async () => {
    // Fresh module graph => the loader's cache is empty => a genuinely cold,
    // asynchronous load, whatever order the tests run in.
    vi.resetModules();
    const { Terminal: ColdTerminal } = await import("./Terminal");
    const ref = createRef<TerminalHandle>();
    let xtermAtEarlyWrite: unknown = "not-called";
    function Parent() {
      const inner = useRef<TerminalHandle>(null);
      useEffect(() => {
        // Runs right after mount, before the lazy import has resolved.
        xtermAtEarlyWrite = inner.current?.xterm;
        inner.current?.writeln("early-write");
      }, []);
      return (
        <ColdTerminal
          ref={(h) => {
            inner.current = h;
            (ref as { current: TerminalHandle | null }).current = h;
          }}
          output={"controlled-output\r\n"}
        />
      );
    }
    mount(<Parent />);
    // Proves the queue path ran: xterm did not exist yet when we wrote.
    expect(xtermAtEarlyWrite).toBeNull();

    const term = await ref.current!.ready;
    await flush(term);
    const buf = ref.current!.getBuffer();
    expect(buf).toContain("controlled-output");
    expect(buf).toContain("early-write");
    expect(buf.indexOf("controlled-output")).toBeLessThan(buf.indexOf("early-write"));
  });

  it("write after ready reaches the buffer", async () => {
    const ref = createRef<TerminalHandle>();
    mount(<Terminal ref={ref} initialOutput="init " />);
    const term = await ref.current!.ready;
    ref.current!.write("more");
    await flush(term);
    expect(ref.current!.getBuffer()).toContain("init more");
  });

  it("fit resizes the terminal to the proposed dimensions", async () => {
    let handle: TerminalHandle | null = null;
    function Host() {
      const el = useRef<HTMLDivElement>(null);
      handle = useTerminal(el, { fit: false });
      return <div ref={el} />;
    }
    mount(<Host />);
    const term = await handle!.ready;

    const { FitAddon } = await import("@xterm/addon-fit");
    vi.spyOn(FitAddon.prototype, "proposeDimensions").mockReturnValue({ cols: 101, rows: 33 });
    act(() => handle!.fit());
    expect(term.cols).toBe(101);
    expect(term.rows).toBe(33);
  });
});
