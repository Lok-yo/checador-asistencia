import { StyleSheet, Text } from 'react-native';
import { Redirect, router } from 'expo-router';

import { ActionButton, Card, colors, Message, Screen, Title } from '../components/ui';
import { configuredTimeZone, formatServerDate, movementLabel } from '../lib/format';
import { useAuth } from '../state/auth';
import { useAttendance } from '../state/attendance';

export default function ResultScreen() {
  const { session } = useAuth();
  const { result, pending, busy, flowError, retry, cancel } = useAttendance();

  if (!session) return <Redirect href="/login" />;
  if (result.status === 'idle' && !pending) return <Redirect href="/" />;

  if (result.status === 'working') {
    return <Screen><Title subtitle="Subiendo la fotografía y esperando la respuesta del servidor.">Confirmando checada…</Title><ActionButton label="Procesando" onPress={() => {}} disabled loading /></Screen>;
  }

  if (result.status === 'success') {
    return (
      <Screen>
        <Title>Checada registrada</Title>
        <Card>
          <Text style={styles.success}>{movementLabel(result.attendance.type)}</Text>
          <Text style={styles.date}>{formatServerDate(result.attendance.created_at)}</Text>
          <Message>Zona horaria: {configuredTimeZone()}</Message>
          <Message>Comprobante: {result.attendance.id}</Message>
        </Card>
        <ActionButton label="Volver al checador" onPress={() => { cancel(); router.replace('/'); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Checada pendiente</Title>
      <Card>
        <Text style={styles.error}>No se confirmó el registro</Text>
        <Message error>{result.status === 'error' ? result.message : 'Hay una solicitud pendiente por recuperar.'}</Message>
        {pending && result.status === 'error' && result.retryable ? <Message>El reintento conserva el mismo identificador. Se pedirá biometría de nuevo.</Message> : null}
      </Card>
      {flowError ? <Message error>{flowError}</Message> : null}
      {pending ? <ActionButton label={result.status === 'error' && result.needsPhoto ? 'Tomar foto de nuevo' : 'Reintentar'} onPress={() => void retry()} disabled={busy} loading={busy} /> : null}
      <ActionButton label="Volver al checador" secondary onPress={cancel} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { color: colors.success, fontSize: 26, fontWeight: '700' },
  error: { color: colors.error, fontSize: 20, fontWeight: '700' },
  date: { color: colors.ink, fontSize: 19, fontWeight: '600' },
});
