import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { BikeInput } from '@/game/engine/input';
import type { RaceEvent, RiderStatus } from '@/game/engine/race';
import type { TerrainPiece } from '@/game/track/terrain';

import { RaceRunner, type RenderFrame } from './race-runner';

export type DebugStats = {
  readonly fps: number;
  /** Velocidade da bike, em m/s. */
  readonly speed: number;
  /** Tempo de corrida simulado, em segundos. */
  readonly time: number;
  readonly status: RiderStatus;
};

/** Intervalo de atualização do painel de debug (re-render do React), em ms. */
const STATS_INTERVAL_MS = 250;

type Options = {
  /** Lido uma vez por quadro, antes de avançar a simulação. */
  readInput: () => BikeInput;
  /** Eventos da corrida (queda, respawn…) ocorridos no quadro. */
  onEvents: (events: readonly RaceEvent[]) => void;
};

/**
 * Roda a corrida no thread JS via requestAnimationFrame (o matter-js não roda em worklet)
 * e publica cada quadro num SharedValue, que os componentes Skia leem sem re-render do React.
 */
export function useRaceLoop({ readInput, onEvents }: Options): {
  frame: SharedValue<RenderFrame>;
  terrain: readonly TerrainPiece[];
  stats: DebugStats;
  reset: () => void;
} {
  const [runner] = useState(() => new RaceRunner());
  const frame = useSharedValue<RenderFrame>(runner.peek());
  const [stats, setStats] = useState<DebugStats>({ fps: 0, speed: 0, time: 0, status: { kind: 'riding' } });

  // Callbacks mais recentes, sem reiniciar o loop quando a identidade deles muda.
  const callbacks = useRef({ readInput, onEvents });
  useEffect(() => {
    callbacks.current = { readInput, onEvents };
  }, [readInput, onEvents]);

  useEffect(() => {
    let rafId = 0;
    let lastTime: number | null = null;
    let windowStart: number | null = null;
    let framesInWindow = 0;

    const tick = (now: number) => {
      const frameSeconds = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;

      const { frame: next, events } = runner.advance(frameSeconds, callbacks.current.readInput());
      frame.set(next);
      if (events.length > 0) callbacks.current.onEvents(events);

      framesInWindow++;
      windowStart ??= now;
      const elapsed = now - windowStart;
      if (elapsed >= STATS_INTERVAL_MS) {
        const { velocity } = next.snapshot.bike;
        setStats({
          fps: (framesInWindow * 1000) / elapsed,
          speed: Math.hypot(velocity.x, velocity.y),
          time: next.snapshot.time,
          status: next.snapshot.status,
        });
        framesInWindow = 0;
        windowStart = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [runner, frame]);

  const reset = useCallback(() => {
    runner.reset();
    frame.set(runner.peek());
  }, [runner, frame]);

  return { frame, terrain: runner.terrain, stats, reset };
}
