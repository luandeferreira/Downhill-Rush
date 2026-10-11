import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { CrashReason, RaceEvent } from '@/game/engine/race';
import { useControlSettings } from '@/input/control-settings';
import { createControlState, toBikeInput, type ControlButton } from '@/input/control-state';
import { TouchControls } from '@/input/touch-controls';
import { useTiltLean } from '@/input/use-tilt-lean';
import { useRaceLoop } from '@/render/use-race-loop';
import { WorldCanvas } from '@/render/world-canvas';

const CRASH_LABEL: Record<CrashReason, string> = {
  head: 'Bateu a cabeça',
  landing: 'Aterrissagem torta',
  pit: 'Caiu no buraco',
};

/** Pouso com pelo menos este tempo no ar (s) vibra. */
const HARD_LANDING_AIR_TIME = 0.6;

function playHaptics(events: readonly RaceEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'crash':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'hop':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'land':
        if (event.airTime >= HARD_LANDING_AIR_TIME) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'respawn':
        break;
    }
  }
}

/** Corrida de teste (etapas 1–2): pista fixa, controles, quedas e painel de debug. */
export function RaceScreen() {
  const { width, height } = useWindowDimensions();
  const settings = useControlSettings();
  const controls = useRef(createControlState());

  const setTiltLean = useCallback((lean: number) => {
    controls.current.tiltLean = lean;
  }, []);
  const tilt = useTiltLean(settings.mode === 'tilt', settings, setTiltLean);

  const onButton = useCallback((button: ControlButton, pressed: boolean) => {
    controls.current[button] = pressed;
  }, []);
  const readInput = useCallback(() => toBikeInput(controls.current, settings.mode), [settings.mode]);

  const { frame, terrain, stats, reset } = useRaceLoop({ readInput, onEvents: playHaptics });

  const onReset = useCallback(() => {
    tilt.calibrate();
    reset();
  }, [tilt, reset]);

  return (
    <View style={styles.container}>
      <WorldCanvas frame={frame} terrain={terrain} width={width} height={height} style={StyleSheet.absoluteFill} />

      <View style={styles.debug} pointerEvents="none">
        <Text style={styles.debugText}>FPS {stats.fps.toFixed(0)}</Text>
        <Text style={styles.debugText}>
          {(stats.speed * 3.6).toFixed(0)} km/h ({stats.speed.toFixed(1)} m/s)
        </Text>
        <Text style={styles.debugText}>t {stats.time.toFixed(1)} s</Text>
        <Text style={styles.debugText}>
          {settings.mode === 'tilt' ? `giroscópio${tilt.available === false ? ' (indisponível)' : ''}` : 'toque'}
        </Text>
      </View>

      {stats.status.kind === 'crashed' && (
        <View style={styles.crashBanner} pointerEvents="none">
          <Text style={styles.crashTitle}>QUEDA!</Text>
          <Text style={styles.crashReason}>{CRASH_LABEL[stats.status.reason]}</Text>
        </View>
      )}

      <View style={styles.topButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.topButton, styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.topButtonLabel}>Ajustes</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onReset}
          style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}>
          <Text style={styles.topButtonLabel}>Reset</Text>
        </Pressable>
      </View>

      <TouchControls mode={settings.mode} onChange={onButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8ecae6',
  },
  debug: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  debugText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  crashBanner: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(230, 57, 70, 0.85)',
  },
  crashTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  crashReason: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  topButtons: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  topButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fca311',
  },
  secondaryButton: {
    backgroundColor: '#e5e5e5',
  },
  pressed: {
    opacity: 0.75,
  },
  topButtonLabel: {
    color: '#14213d',
    fontSize: 16,
    fontWeight: '800',
  },
});
