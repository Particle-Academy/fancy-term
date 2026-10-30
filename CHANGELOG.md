# Changelog

All notable changes to `@particle-academy/fancy-term` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **Pre-1.0:** breaking changes land in MINOR releases. Until 1.0 the minor
> number is not a compatibility promise — read the entry, not the version.

> This file starts here. Earlier releases predate it and were never written up;
> `git log` is the record for those. It is not backfilled rather than
> guessed-at, because a changelog that invents its own history is worse than one
> that admits where it begins.

## [Unreleased]

## [0.8.1] - 2026-10-30

### Fixed

- **SSR crash `ReferenceError: self is not defined` when the package is
  imported on the server.** Consumer action: none — update. Importing
  `@particle-academy/fancy-term` in Node (Inertia SSR, `react-dom/server`, a
  plain script) threw at import, in both the ESM and CJS builds, because
  `@xterm/xterm` and `@xterm/addon-fit` were imported at module top level and
  addon-fit's UMD wrapper reads the browser-only `self` global. Any SSR page
  whose bundle reached a `<Terminal>` failed to server-render. xterm and its
  addon are now loaded lazily inside the client-only mount effect; on the
  server `<Terminal>` renders the same empty `data-fancy-terminal` container
  the client renders before xterm mounts, so hydration matches. Public API is
  unchanged.
- Because xterm now arrives a tick after the first mount, ref calls made in that
  window are **queued** rather than dropped: `write`, `writeln`, `clear`,
  `reset`, `focus` and `paste` replay in order once xterm opens (so a controlled
  `output` or a parent effect writing straight after mount still lands). Reads
  (`getBuffer`, `getSelection`, `copySelection`) return their empty values and
  `fit` / `selectAll` / `clearSelection` are no-ops until `ready` resolves,
  exactly as before mount previously. `await handle.ready` to read reliably.
- The test setup no longer stubs `self` / `window` (that stub is why the suite
  stayed green while production SSR crashed). New guards: an in-suite SSR test,
  `scripts/check-ssr-import.mjs` (built ESM + CJS in plain Node with no DOM, plus
  `renderToString`), a packaging rule banning any top-level value import from
  `@xterm/*`, and jsdom client tests for mount / write / fit. `jsdom` is a new
  devDependency (on the org third-party allowlist; test-only).
- `docs/Terminal.md` no longer tells SSR apps to wrap the import in a
  client-only `lazy()`; that workaround is unnecessary now.

### Security

- Update Vitest to 4.1.12 for security fixes; dev toolchain only, nothing to do.

- **Dev toolchain only — no runtime change, nothing for consumers to do.** The
  lockfile now resolves `vite` 8.3.5 (was 8.3.0), whose bundled
  `launch-editor` fixes GHSA-587h-7wmj-h5pm (HIGH, `fs.existsSync()` check
  bypassable on Windows), GHSA-698v-4r3x-3vcv (`escapeCmdArgs()` omits `%`
  escaping on Windows) and GHSA-r825-w8mm-5pxw (editor CLI flag
  misinterpretation). `vite` is only reached through the test/dev toolchain
  and the published package does not ship our lockfile, so the exposure was
  this repo's own dev server.

## 0.8.0 — 2026-10-18

### Added

- **File paths are clickable too, and the developer chooses where every click
  goes** — the `links` prop:

  ```tsx
  <Terminal links={{
    url: "browser",                        // or "none", or (url, event) => …
    file: "vscode",                        // "cursor" | "windsurf" | "vscode-insiders" | "none"
                                           // | { template: "https://github.com/o/r/blob/main/{path}#L{line}" }
                                           // | (file, event) => openInMyUi(file.absolutePath, file.line)
    root: "/home/me/project",              // the shell's cwd: resolves relative paths
  }} />
  ```

  - **File links** cover compiler, test-runner and stack-trace output —
    `src/app.ts:42:7`, `./x.mjs`, `/usr/lib/a.so`, `C:\work\a.ts:12:4`,
    `Program.cs(12,5)` — and carry the line and column to wherever they go.
  - **No false underlines**: a path is linked only with a directory part or a
    line number, so `package.json`, `e.g.`, `and/or`, `1.2.3` and email
    addresses in prose stay plain text. A path inside a URL is never a second link.
  - **Destinations**: an installed editor through its URL scheme
    (`vscode://file/…:line:col`, matching VS Code's documented form; `root` needed
    for relative paths), a `{ template }` with `{path}`, `{slashPath}`, `{line}`,
    `{column}` for any other editor or a code host, your own function (it gets
    `absolutePath` when `root` is set) for internal UI, or `"none"`. `url:
    "browser"` opens a new tab with `noopener`.
  - Each kind is linked only when configured — no underline that promises a
    click which does nothing. The config is read live; changing it never
    rebuilds the terminal.

  Pure helpers for hosts wiring their own xterm: `findFilePaths`,
  `resolveFilePath`, `fileLinkUrl`, `resolveLinkHandlers`, `terminalLinkProvider`,
  `openExternal`.

  Asked for by the owner: "links to files need to be clickable as well", and
  "dev should be able to choose where those clicks go — installed file editor,
  browser, or handle them internally".

**What you must DO: nothing.** `onLinkActivate` from 0.7.0 still works — it is
the shorthand for `links.url`, and `links.url` wins when both are set.

## 0.7.0 — 2026-10-18

### Added

- **Clickable URLs: `<Terminal onLinkActivate={(url, event) => …}>`.** http(s)
  URLs in the output are underlined on hover with a pointer cursor, and a click
  calls your handler with the URL. **fancy-term opens nothing itself** — what a
  click does is yours (Genie 2 opens http(s) with its shell). Without the prop,
  URLs are plain text as before.

  - A URL that **wraps across rows is one link**, clickable on any of its rows.
  - The sentence's punctuation is left out (`see https://example.com.` links
    `https://example.com`); a closing bracket the URL itself opened is kept
    (`…/wiki/Foo_(bar)`). Only `http:` and `https:` — never `file:`,
    `javascript:` or other schemes.
  - Positions come from the terminal's **cells**, not string indices, so links
    stay put after wide characters (CJK, emoji), and a wide character inside a
    URL (an internationalised host) does not split it.
  - The handler is read live: adding, changing or removing it never rebuilds
    the terminal.

  For hosts wiring their own xterm: `findUrls(text)` (pure), `urlLinkProvider(xterm, { onActivate })`
  and `registerUrlLinks(xterm, …)` (returns a disposable).

  Built on xterm's core link-provider API — no new dependency (the official
  web-links addon is a separate third-party package). Tested against a real xterm
  buffer, wrapping included.

  Asked for by Genie 2 (Tynn #763) for parity with Genie 1's clickable terminal links.

**What you must DO: nothing.** The prop is optional.

## 0.6.2 — 2026-10-10

### Fixed

- **The ESM bundle could not be imported under plain Node.** It emitted
  `import { Terminal } from "@xterm/xterm"`, and because that package is
  CommonJS-only with exports Node's `cjs-module-lexer` cannot statically detect,
  any bundler-free import threw:

  ```
  SyntaxError: Named export 'Terminal' not found. The requested module
  '@xterm/xterm' is a CommonJS module, which may not support all
  module.exports as named exports.
  ```

  `require("@xterm/xterm")` worked fine, which is exactly why this read as our
  bug rather than a lexer limit. **Vite's interop hid it**, so the component
  worked in every bundled app and nobody hit it — until an SSR consumer tried
  `react-dom/server`. Reported with measurements by `claude · genie2`, whose SSR
  render tests died at import on CI and in a test VM.

  Fixed by importing the default and destructuring, which works under Node and
  every bundler. **Nothing to change on your side** — the public API is
  identical.

- **A real-Node import check now runs on every `npm test`**
  (`scripts/check-esm-import.mjs`). This defect was invisible to the whole
  suite and always would have been: **vitest runs through Vite, whose CommonJS
  interop rewrites the exact import that breaks.** The check loads the built
  bundle in a separate Node process, with a positive control that the import
  actually yields `Terminal` + `useTerminal` — so a bundle that imported
  nothing cannot pass it.

### Documentation

- **`docs/Terminal.md` now says this package is CLIENT-ONLY, with the
  measurement.** A server-side import throws `ReferenceError: self is not
  defined` **before any component runs**, and the cause is narrower than it
  looks:

  | import, in plain Node | result |
  |---|---|
  | `@xterm/xterm` | loads |
  | **`@xterm/addon-fit`** | **`ReferenceError: self is not defined`** |

  `@xterm/addon-fit` is a UMD bundle whose wrapper references the browser global
  `self`. **That is upstream packaging and is NOT fixed by this release** — it
  cannot be, from here. Load the package from a dynamic, client-side `import()`
  for SSR; the docs show the shape. Worth stating plainly because the two
  failures are easy to conflate, and a consumer who finds out the way genie2 did
  spends a CI run on it.

## 0.6.1 — 2026-10-10

### Added

- **`@particle-academy/fancy-term/styles.css`** — the same stylesheet under the
  name the rest of the kit uses.

  0.6.0 shipped the re-export as `/xterm.css` only, which was descriptive but
  wrong by convention: `fancy-code`, `fancy-whiteboard`, `fancy-artboard`,
  `fancy-sheets` and `fancy-slides` **all** export `./styles.css`, unanimously.
  A consumer who knows the kit types that name, and in 0.6.0 they got a resolve
  error. Both names now serve the one file, and a test asserts they cannot drift
  apart.

  Use whichever reads better — `/styles.css` for consistency with the rest of
  your Fancy imports, `/xterm.css` if you would rather the import said what it
  actually is. Nothing to change if you are already on `/xterm.css`.

## 0.6.0 — 2026-10-10

### Added

- **`@particle-academy/fancy-term/xterm.css` — load the stylesheet without naming xterm.**

  ```ts
  import "@particle-academy/fancy-term/xterm.css";
  ```

  The terminal has never rendered without xterm's stylesheet, so every consumer
  had to write `import "@xterm/xterm/css/xterm.css"` in their own source — which
  made xterm the one third-party package a Fancy-only app still had to name.

  **Nothing to do.** The old import is identical in effect and still works; this
  is an additional way in, not a replacement. The new subpath is an `@import` of
  xterm's own stylesheet rather than a copy of it, so it resolves to the single
  copy already in your tree and there is no vendored third-party file to drift.

### Changed

- **The `@xterm/*` peer ranges are now bounded above** — `@xterm/xterm` moves
  from `>=5.0.0` to `>=5.0.0 <6`, and `@xterm/addon-fit` from `>=0.10.0` to
  `>=0.10.0 <0.11`.

  **This was live, not theoretical.** `@xterm/xterm@6.0.0` and
  `@xterm/addon-fit@0.11.0` are both `latest` on npm as of today, so the old
  ranges admitted a MAJOR this package has never been built against — and
  nothing reported it, because a resolver quietly picking an untested version
  looks exactly like success. The pairing made it worse rather than safer:
  `addon-fit@0.10.0` declares `peerDependencies: {"@xterm/xterm": "^5.0.0"}` and
  accidentally held the line, while **`0.11.0` declares no peer at all** — so
  `>=0.10.0` plus `>=5.0.0` allowed xterm 6 with addon-fit 0.11, an untested
  combination, silently.

  **What you must do: almost certainly nothing.** If you are on xterm 5.x and
  addon-fit 0.10.x — what `npm install` has been resolving all along, and what
  this package is built and tested against — the range still admits your
  version and the upgrade is invisible. **If you have explicitly moved to xterm
  6 or addon-fit 0.11, this release will now fail at install with a peer
  conflict instead of running untested code.** That is the intended behaviour:
  it turns a silent runtime risk into a loud install-time error. Tell us and we
  will qualify 6 properly — widening a range later is safe by construction,
  since it only ever adds candidates.

  `>=X <2.0` remains correct for a *first-party* sibling, where we cut the
  releases and the upper bound is a promise we keep. On third-party it is a
  promise someone else makes.

- **xterm stays a PEER deliberately, and this is the release that writes down
  why.** `<Terminal>` hands the live `XTerm` instance to the consumer through
  `handle.xterm`, `handle.ready` and `onReady(xterm)` — the same reason a React
  component cannot own its copy of React. If this package owned xterm, a
  consumer on a different version would get two copies and addons and
  `instanceof` would operate on the wrong class with no warning. The peer's
  value is not "one copy", it is that a conflict fails loudly at install. The
  reasoning now sits in the README, in `src/index.ts`, in `xterm.css` and in
  `src/packaging.test.ts`, so the next person who proposes tidying it into
  `dependencies` meets the argument first.

### Fixed

- **`CHANGELOG.md` is now in the published tarball.** `files` did not whitelist it, so npm never shipped it — and this package puts breaking changes in MINOR releases and tells you in the README to read the entry before taking one. The instruction existed for the author, who has the file, and not for the consumer, who is the only one being instructed. Nothing for you to do; the file simply arrives from this release on.

### Security

- `source-map-js` is pinned forward to `^1.2.2` via `overrides`. Versions up to
  1.2.1 allow an event-loop denial of service through indexed source-map section
  offsets, and it arrives here transitively through the build toolchain.
  **Nothing for a consumer to do, and no runtime change**: an npm package does
  not ship a lockfile, so this governs builds OF this repo, not anything
  installed FROM it. Recorded rather than left silent because the override it
  sits beside — `shell-quote` `^1.9.0`, added for an earlier advisory — was
  carried with no note of why, and had drifted back inside the vulnerable range
  before anyone looked.

## 0.5.1 — 2026-09-29

### Fixed

- **`docs/` is real now.** `files` already listed `docs`, and the directory did
  not exist — so every published tarball carried a `files` entry pointing at
  nothing and shipped no reference at all. That is the worse half of this
  defect: a `files` array that names `docs` reads as compliant to anyone
  checking the manifest, so nothing ever looked in the tarball.

  Adds `docs/Terminal.md` and `docs/ShellSwitcher.md` — the full prop and
  `TerminalOptions` tables, the imperative handle (including `getBuffer()`, the
  Human+ affordance an agent reads instead of scraping the DOM), why the
  clipboard is injectable and what silently breaks in a sandboxed Electron
  renderer without a provider, why OSC 52 defaults to write-only, and how
  pasted images reach the host.

  No code changed.

## 0.5.0 — 2026-08-07

### Changed

- **BREAKING — Node 22 is now declared as the floor.** `engines.node` is `>=22`, where this package previously declared **nothing at all**.

  Declaring nothing was not the same as supporting old Node: a consumer on 18 installed cleanly and found out at runtime.

  **What you must do:** on Node 22 or newer, nothing. Note npm only *warns* on an `engines` mismatch while **pnpm fails the install**, so this surfaces differently depending on your package manager. Node 18 is end-of-life and 20 is maintenance-only.

- **BREAKING — React 18 is no longer supported.** `peerDependencies.react` / `react-dom` are now `^19.0.0`.

  **What you must do:** on React 19, nothing. On React 18, stay on the previous release, or upgrade your app to 19 first.

  React 18 support was a claim nothing tested — every build and test in this package ran against 19, so the 18 half of the old range was never executed. An untested compatibility claim is worse than an absent one, because it reads as support.

### Why

These are the kit 0.5 platform floors, applied across every package at once so a consumer never has to resolve a mix. **No API changed, nothing was removed, nothing was renamed** — only what the package requires.


## 0.4.1 — 2026-07-06

### Fixed

- context-menu Copy writes the menu-open selection snapshot, not a click-time re-read

## 0.4.0 — 2026-07-02

### Added

- Electron-safe clipboard — injectable provider, OSC 52, copy/paste modes, ready signal (#1)

## 0.3.0 — 2026-06-14

### Added

- clipboard (copy/paste + images) + customizable selection context menu

## 0.2.2 — 2026-06-11

### Fixed

- omit undefined rows/cols from xterm constructor (was console-erroring)

## 0.2.1 — 2026-06-11

### Fixed

- guard fit() via proposeDimensions — no xterm resize(undefined) on unlaid-out container

## 0.2.0 — 2026-06-11

### Changed

- **BREAKING** — shell / profile switching (UI + API + session)

## 0.1.0 — 2026-06-10

### Added

- fancy-term 0.1.0 — Human+ Terminal (xterm.js wrapper)

### Changed

- Replaced an `eslint-disable jsx-a11y/no-autofocus` in `ShellSwitcher` with a
  plain comment explaining why the autofocus is deliberate. `jsx-a11y` has never
  been a dependency of this package, so the directive silenced a rule that did
  not exist — and broke linting the moment ESLint was actually turned on.
  **No action needed**, no behaviour change.
