// clipboard.ts — small, dependency-free clipboard helpers shared by the headless
// hook (copy/paste primitives + the paste interceptor) and the component. Kept
// pure where possible so the extraction logic is unit-testable without a DOM.

/** What a paste / drop carried: plain text plus any files (e.g. pasted images). */
export interface ClipboardPayload {
  /** Plain text from the clipboard (or pasted selection). May be "". */
  text: string;
  /** Files present on the clipboard / drop — typically pasted/dropped images. */
  files: File[];
  /** Convenience: the subset of `files` whose MIME type is `image/*`. */
  images: File[];
}

/** True when a file looks like an image (by MIME type). */
export function isImageFile(f: { type?: string }): boolean {
  return typeof f.type === "string" && f.type.startsWith("image/");
}

/**
 * Pull text + files out of a ClipboardEvent / DragEvent `dataTransfer`. The
 * DataTransferItemList is checked first (pasted screenshots only appear there in
 * some browsers), then `.files` as a fallback. Pure + null-safe.
 */
export function readDataTransfer(dt: DataTransfer | null | undefined): ClipboardPayload {
  const files: File[] = [];
  let text = "";
  if (dt) {
    try {
      text = dt.getData("text/plain") ?? "";
    } catch {
      /* getData can throw in restricted contexts */
    }
    const items = dt.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it && it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
    }
    if (files.length === 0 && dt.files) {
      for (let i = 0; i < dt.files.length; i++) files.push(dt.files[i]);
    }
  }
  return { text, files, images: files.filter(isImageFile) };
}

/** Write text to the system clipboard. Resolves false when unavailable/denied. */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  // Legacy fallback for insecure contexts / older browsers.
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Read text from the system clipboard. Resolves "" when unavailable/denied. */
export async function readClipboardText(): Promise<string> {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.clipboard?.readText) return await nav.clipboard.readText();
  } catch {
    /* permission denied / unavailable */
  }
  return "";
}

/**
 * A host-supplied clipboard. Every copy/paste path in fancy-term — the copy
 * chord, the context menu, OSC 52, `handle.copySelection` / `handle.paste` —
 * routes through this, so an Electron host (where `navigator.clipboard` silently
 * no-ops in a sandboxed renderer) can bridge to its main-process clipboard over
 * IPC. `writeText` may return anything (a `Promise<void>` from IPC is fine);
 * `readText` returns the clipboard text.
 */
export interface ClipboardProvider {
  writeText: (text: string) => void | Promise<unknown>;
  readText: () => string | Promise<string>;
}

/** The default provider — `navigator.clipboard` with the legacy `execCommand` fallback. */
export const navigatorClipboard: ClipboardProvider = {
  writeText: (text) => writeClipboardText(text),
  readText: () => readClipboardText(),
};

/** The `clipboard` prop: `false` disables clipboard wiring; a provider object injects a host clipboard; `true`/omitted uses {@link navigatorClipboard}. */
export type ClipboardOption = boolean | ClipboardProvider;

/** Normalize the `clipboard` prop into `{ enabled, provider }`, read live per call. */
export function resolveClipboard(clipboard: ClipboardOption | undefined): {
  enabled: boolean;
  provider: ClipboardProvider;
} {
  if (clipboard === false) return { enabled: false, provider: navigatorClipboard };
  if (clipboard && typeof clipboard === "object") return { enabled: true, provider: clipboard };
  return { enabled: true, provider: navigatorClipboard };
}

/** Write via a provider, resolving `true` on success and `false` if it throws/rejects. */
export async function providerWrite(provider: ClipboardProvider, text: string): Promise<boolean> {
  try {
    await provider.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Read via a provider, resolving `""` if it throws/rejects. */
export async function providerRead(provider: ClipboardProvider): Promise<string> {
  try {
    return (await provider.readText()) ?? "";
  } catch {
    return "";
  }
}
