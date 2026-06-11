import { useEffect, useRef, type RefObject } from "react";

/**
 * Run `fit` whenever the container resizes — and once it first has a real,
 * non-zero box. Guards the hidden-tab / late-mount 0×0 case: fitting a collapsed
 * container yields garbage rows/cols (or throws), so we simply skip until there
 * is layout to measure.
 */
export function useTerminalFit(
  ref: RefObject<HTMLElement | null>,
  fit: () => void,
  enabled = true,
): void {
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) fitRef.current();
    };

    const observer = new ResizeObserver(run);
    observer.observe(el);
    run(); // initial — fires once the box has layout

    return () => observer.disconnect();
  }, [ref, enabled]);
}
