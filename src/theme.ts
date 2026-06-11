import type { TerminalTheme } from "./types";

/**
 * The default "sexy" Fancy dark terminal theme — a zinc surface, violet cursor,
 * and a balanced ANSI palette drawn from the react-fancy Tailwind v4 tokens.
 * Pass a `theme` prop / option to override.
 */
export const fancyDarkTheme: TerminalTheme = {
  background: "#09090b", // zinc-950
  foreground: "#e4e4e7", // zinc-200
  cursor: "#8b5cf6", // violet-500
  cursorAccent: "#09090b",
  selectionBackground: "#3f3f46", // zinc-700
  black: "#18181b",
  red: "#f43f5e",
  green: "#10b981",
  yellow: "#f59e0b",
  blue: "#3b82f6",
  magenta: "#8b5cf6",
  cyan: "#22d3ee",
  white: "#e4e4e7",
  brightBlack: "#52525b",
  brightRed: "#fb7185",
  brightGreen: "#34d399",
  brightYellow: "#fbbf24",
  brightBlue: "#60a5fa",
  brightMagenta: "#a78bfa",
  brightCyan: "#67e8f9",
  brightWhite: "#fafafa",
};
