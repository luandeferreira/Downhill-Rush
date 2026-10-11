import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  updateControlSettings,
  useControlSettings,
  type ControlMode,
  type TiltSensitivity,
} from '@/input/control-settings';

type Choice<T> = { value: T; label: string };

const MODE_CHOICES: readonly Choice<ControlMode>[] = [
  { value: 'touch', label: 'Toque' },
  { value: 'tilt', label: 'Giroscópio' },
];

const SENSITIVITY_CHOICES: readonly Choice<TiltSensitivity>[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
];

const INVERT_CHOICES: readonly Choice<boolean>[] = [
  { value: false, label: 'Normal' },
  { value: true, label: 'Invertido' },
];

function Segmented<T>({
  choices,
  value,
  onSelect,
}: {
  choices: readonly Choice<T>[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <Pressable
            key={choice.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(choice.value)}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{choice.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsScreen() {
  const settings = useControlSettings();
  const tilt = settings.mode === 'tilt';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backLabel}>‹ Voltar</Text>
          </Pressable>
          <Text style={styles.title}>Ajustes</Text>
        </View>

        <Text style={styles.sectionTitle}>Controle de inclinação</Text>
        <Segmented
          choices={MODE_CHOICES}
          value={settings.mode}
          onSelect={(mode) => updateControlSettings({ mode })}
        />
        <Text style={styles.hint}>
          {tilt
            ? 'Gire o aparelho como um volante para inclinar. A posição ao entrar na corrida (ou ao tocar Reset) é a neutra. O botão da esquerda vira Freio.'
            : 'Botões à esquerda inclinam para trás/frente; segure os dois juntos para frear.'}
        </Text>

        {tilt && (
          <>
            <Text style={styles.sectionTitle}>Sensibilidade</Text>
            <Segmented
              choices={SENSITIVITY_CHOICES}
              value={settings.tiltSensitivity}
              onSelect={(tiltSensitivity) => updateControlSettings({ tiltSensitivity })}
            />
            <Text style={styles.sectionTitle}>Sentido</Text>
            <Segmented
              choices={INVERT_CHOICES}
              value={settings.tiltInverted}
              onSelect={(tiltInverted) => updateControlSettings({ tiltInverted })}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#14213d',
  },
  content: {
    padding: 24,
    gap: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  backLabel: {
    color: '#fca311',
    fontSize: 17,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#e5e5e5',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  hint: {
    color: '#a8b2c1',
    fontSize: 13,
    lineHeight: 18,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fca311',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#fca311',
  },
  segmentLabel: {
    color: '#fca311',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentLabelSelected: {
    color: '#14213d',
  },
});
