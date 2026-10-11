import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { ControlMode } from './control-settings';
import type { ControlButton } from './control-state';

type Props = {
  mode: ControlMode;
  onChange: (button: ControlButton, pressed: boolean) => void;
};

/**
 * Botões de segurar. Usa gesture-handler (e não Pressable) porque o sistema de toque do
 * React Native só tem um "responder" por vez — com ele não dá para pedalar e inclinar juntos.
 */
function HoldButton({
  button,
  label,
  onChange,
  wide = false,
}: {
  button: ControlButton;
  label: string;
  onChange: Props['onChange'];
  wide?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onBegin(() => {
          setPressed(true);
          onChange(button, true);
        })
        .onFinalize(() => {
          setPressed(false);
          onChange(button, false);
        }),
    [button, onChange],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.button, wide && styles.buttonWide, pressed && styles.buttonPressed]}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </GestureDetector>
  );
}

export function TouchControls({ mode, onChange }: Props) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.side}>
        {mode === 'touch' ? (
          <>
            <HoldButton button="leanBack" label="◀ Trás" onChange={onChange} />
            <HoldButton button="leanForward" label="Frente ▶" onChange={onChange} />
          </>
        ) : (
          <HoldButton button="brake" label="Freio" onChange={onChange} wide />
        )}
      </View>
      <View style={styles.side}>
        <HoldButton button="jump" label="Pular" onChange={onChange} />
        <HoldButton button="pedal" label="Pedalar" onChange={onChange} wide />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  side: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-end',
  },
  button: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 33, 61, 0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  buttonWide: {
    width: 120,
    height: 100,
    borderRadius: 50,
  },
  buttonPressed: {
    backgroundColor: 'rgba(252, 163, 17, 0.8)',
    borderColor: '#ffffff',
  },
  label: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
