import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type MenuOption = {
  id: 'solo' | 'time-trial' | 'multiplayer';
  label: string;
};

const MENU_OPTIONS: readonly MenuOption[] = [
  { id: 'solo', label: 'Solo' },
  { id: 'time-trial', label: 'Contra o relógio' },
  { id: 'multiplayer', label: 'Multiplayer' },
];

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>DOWNHILL RUSH</Text>
        <Text style={styles.subtitle}>Mountain bike arcade</Text>
      </View>

      <View style={styles.menu}>
        {MENU_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            // Por enquanto só "Solo" abre o protótipo de física; os outros modos vêm depois.
            onPress={() => {
              if (option.id === 'solo') router.push('/race');
            }}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonLabel}>{option.label}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonLabel}>Ajustes</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    backgroundColor: '#14213d',
    padding: 16,
  },
  titleBlock: {
    alignItems: 'center',
  },
  title: {
    color: '#fca311',
    fontSize: 44,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#e5e5e5',
    fontSize: 16,
    marginTop: 4,
  },
  menu: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  button: {
    backgroundColor: '#fca311',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e5e5e5',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    color: '#14213d',
    fontSize: 18,
    fontWeight: '800',
  },
});
