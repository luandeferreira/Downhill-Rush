import { useSyncExternalStore } from 'react';

export type ControlMode = 'touch' | 'tilt';
export type TiltSensitivity = 'low' | 'medium' | 'high';

export type ControlSettings = {
  readonly mode: ControlMode;
  /** Inverte o sentido do giroscópio (a convenção de eixos varia entre aparelhos). */
  readonly tiltInverted: boolean;
  readonly tiltSensitivity: TiltSensitivity;
};

/** Rotação do aparelho (graus) que corresponde a inclinação máxima. */
export const TILT_RANGE_DEG: Record<TiltSensitivity, number> = { low: 35, medium: 25, high: 15 };

const DEFAULT_SETTINGS: ControlSettings = { mode: 'touch', tiltInverted: false, tiltSensitivity: 'medium' };

// Só em memória por enquanto: volta ao padrão quando o app reinicia.
let current = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

export function getControlSettings(): ControlSettings {
  return current;
}

export function updateControlSettings(patch: Partial<ControlSettings>): void {
  current = { ...current, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useControlSettings(): ControlSettings {
  return useSyncExternalStore(subscribe, getControlSettings, getControlSettings);
}
