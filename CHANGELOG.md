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
