import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  ink: '#172033',
  muted: '#566277',
  primary: '#135C78',
  primaryPressed: '#0D455C',
  border: '#D8E1E8',
  error: '#A12C35',
  success: '#176448',
};

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children, subtitle }: PropsWithChildren<{ subtitle?: string }>) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={styles.field}
      />
    </View>
  );
}

export function ActionButton({
  label, onPress, disabled, loading, secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (disabled || loading) && styles.disabledButton,
        pressed && !disabled && !loading && styles.pressedButton,
      ]}
    >
      {loading ? <ActivityIndicator color={secondary ? colors.primary : '#FFFFFF'} /> : null}
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export function Message({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <Text style={[styles.message, error && styles.errorMessage]}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, padding: 24, gap: 18, justifyContent: 'center' },
  titleBlock: { gap: 8, marginBottom: 8 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 20, gap: 14 },
  fieldWrap: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  field: { minHeight: 50, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 },
  disabledButton: { opacity: 0.45 },
  pressedButton: { backgroundColor: colors.primaryPressed },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryText: { color: colors.primary },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  errorMessage: { color: colors.error },
});
