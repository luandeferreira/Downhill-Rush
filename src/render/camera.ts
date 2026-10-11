import type { Vec2 } from '@/game/engine/types';

/** Ponto do mundo (metros) que a câmera mantém na âncora da tela. */
export type Camera = { readonly x: number; readonly y: number };

export const CAMERA = {
  /** Onde o alvo fica na tela, em fração da largura/altura (a bike desce para a direita). */
  anchor: { x: 0.38, y: 0.45 },
  /** Taxa de aproximação (1/s): maior = câmera mais "presa" à bike. */
  followRate: { x: 7, y: 4.5 },
  /** Quanto a câmera se adianta na direção do movimento, em segundos de velocidade. */
  lookAheadSeconds: 0.18,
  maxLookAhead: 4,
} as const;

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

function lookAhead(velocity: number): number {
  return clamp(velocity * CAMERA.lookAheadSeconds, -CAMERA.maxLookAhead, CAMERA.maxLookAhead);
}

export function cameraTarget(position: Vec2, velocity: Vec2): Camera {
  return { x: position.x + lookAhead(velocity.x), y: position.y + lookAhead(velocity.y) };
}

/**
 * Suavização exponencial independente de FPS: a fração do caminho percorrida em `dt`
 * é 1 − e^(−taxa·dt), então 30 e 120 FPS produzem o mesmo movimento.
 */
export function followCamera(camera: Camera, target: Camera, dt: number): Camera {
  const kx = 1 - Math.exp(-CAMERA.followRate.x * dt);
  const ky = 1 - Math.exp(-CAMERA.followRate.y * dt);
  return { x: camera.x + (target.x - camera.x) * kx, y: camera.y + (target.y - camera.y) * ky };
}
