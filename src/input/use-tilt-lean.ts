import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TILT_RANGE_DEG, type ControlSettings } from './control-settings';

const UPDATE_INTERVAL_MS = 16;
const DEADZONE_DEG = 2;

/** Diferença angular normalizada para (−π, π]. */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Lê a rotação do aparelho "como um volante" (em torno do eixo da tela) a partir da
 * direção da gravidade no acelerômetro e converte em inclinação −1..1.
 * A posição neutra é a do aparelho na primeira leitura e a cada `calibrate()`.
 */
export function useTiltLean(
  enabled: boolean,
  settings: ControlSettings,
  onLean: (lean: number) => void,
): { available: boolean | null; calibrate: () => void } {
  const [available, setAvailable] = useState<boolean | null>(null);
  const neutral = useRef<number | null>(null);
  const latest = useRef({ settings, onLean });
  useEffect(() => {
    latest.current = { settings, onLean };
  }, [settings, onLean]);

  useEffect(() => {
    if (!enabled) return;
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    Accelerometer.isAvailableAsync().then((ok) => {
      if (cancelled) return;
      setAvailable(ok);
      if (!ok) return;
      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscription = Accelerometer.addListener(({ x, y }) => {
        const angle = Math.atan2(y, x);
        neutral.current ??= angle;
        const { settings: s, onLean: emit } = latest.current;
        const deg = (wrapAngle(angle - neutral.current) * 180) / Math.PI;
        const magnitude = Math.max(Math.abs(deg) - DEADZONE_DEG, 0) / (TILT_RANGE_DEG[s.tiltSensitivity] - DEADZONE_DEG);
        const lean = Math.sign(deg) * Math.min(magnitude, 1) * (s.tiltInverted ? -1 : 1);
        emit(lean);
      });
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      neutral.current = null;
      latest.current.onLean(0);
    };
  }, [enabled]);

  const calibrate = useCallback(() => {
    neutral.current = null;
  }, []);

  return { available, calibrate };
}
