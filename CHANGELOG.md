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

### Changed

- Replaced an `eslint-disable jsx-a11y/no-autofocus` in `ShellSwitcher` with a
  plain comment explaining why the autofocus is deliberate. `jsx-a11y` has never
  been a dependency of this package, so the directive silenced a rule that did
  not exist — and broke linting the moment ESLint was actually turned on.
  **No action needed**, no behaviour change.
