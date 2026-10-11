import type { Vec2 } from './types';

export function rotate(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Ângulo (rad, 0..π) entre dois vetores unitários. */
export function angleBetween(a: Vec2, b: Vec2): number {
  return Math.acos(clamp(dot(a, b), -1, 1));
}
