// menu-position.ts — clamp a fixed-position menu so it never spills off-screen.
// Pure helper (unit-testable); the component measures its own rect and applies it.

export interface MenuPoint {
  x: number;
  y: number;
}
export interface MenuSize {
  width: number;
  height: number;
}

/**
 * Clamp a menu's top-left so the whole menu stays inside the viewport (minus a
 * margin). Pushes left/up when it would overflow the right/bottom edge, and never
 * goes past the top-left margin. Pure.
 */
export function clampMenuPosition(
  at: MenuPoint,
  menu: MenuSize,
  viewport: MenuSize,
  margin = 8,
): MenuPoint {
  const maxX = Math.max(margin, viewport.width - menu.width - margin);
  const maxY = Math.max(margin, viewport.height - menu.height - margin);
  return {
    x: Math.min(Math.max(margin, at.x), maxX),
    y: Math.min(Math.max(margin, at.y), maxY),
  };
}
