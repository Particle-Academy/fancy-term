# Contributing to @particle-academy/fancy-term

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

## Commands

```bash
npm run build   # tsup
npm run dev     # tsup --watch
npm run lint    # tsc --noEmit && eslint .
npm test        # vitest run, then a silent build and the two import checks
npm run clean   # remove dist/
```

`npm test` runs `scripts/check-esm-import.mjs` and `scripts/check-ssr-import.mjs`
against the fresh build, so a test run also checks that the built package
imports as ESM and under SSR.

## Tests

vitest, colocated beside the source (`src/**/*.test.ts(x)`), with
`vitest.setup.ts` at the root.

## Dependencies

xterm (`@xterm/xterm`, `@xterm/addon-fit`) and React are peers, not
dependencies: `<Terminal>` hands out the live xterm instance, so owning a copy
would give a consumer on another version two of them. The package has no
runtime dependency.

## Changelog

Update `CHANGELOG.md` in the same commit as the change.
