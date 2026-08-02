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
