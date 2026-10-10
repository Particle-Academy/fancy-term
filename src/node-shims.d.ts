/**
 * The one `node:fs` function `packaging.test.ts` needs, declared rather than
 * depended upon.
 *
 * This package has no `@types/node`, and a third-party devDependency needs the
 * owner's approval here — adding one so a test can read a file in the tarball
 * would be a poor trade. vitest runs on node, so the implementation is already
 * there; only the types were missing. Declaring the single signature in use
 * keeps the surface honest: if a test reaches for more of node, it has to say so
 * here first.
 *
 * `?raw` was the first attempt and does NOT work for a stylesheet — Vite's CSS
 * plugin intercepts `*.css?raw` and hands back an EMPTY string. That is worth
 * recording, because a test asserting `expect(css).not.toMatch(/…/)` would have
 * passed vacuously on `""` and reported coverage of a file it never read.
 */
declare module "node:fs" {
    export function readFileSync(path: URL | string, encoding: "utf8"): string;
    export function readdirSync(path: string): string[];
    export function statSync(path: string): { isDirectory(): boolean };
}

declare module "node:url" {
    export function fileURLToPath(url: URL | string): string;
}
