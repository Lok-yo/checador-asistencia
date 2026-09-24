import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { ActionButton, Card, colors, Message, Screen, Title } from '../components/ui';
import { configuredTimeZone, formatServerDate, movementLabel } from '../lib/format';
import { useAuth } from '../state/auth';
import { useAttendance } from '../state/attendance';

export default function Home() {
  const { session, loading, fullName, lastMovement, dataError, refresh, signOut } = useAuth();
  const { begin, pending, busy, flowError, retry, clearFlowError } = useAttendance();
  const [signingOut, setSigningOut] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  const closeSession = async () => {
    if (signingOut || busy) return;
    setSigningOut(true);
    setLocalError(null);
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
    } finally {
      setSigningOut(false);
    }
  };

  const entryBlocked = busy || signingOut || !!pending || !!dataError || !fullName || lastMovement?.type === 'entry';
  const exitBlocked = busy || signingOut || !!pending || !!dataError || !fullName || lastMovement?.type !== 'entry';

  return (
    <Screen>
      <Title subtitle={fullName ? `Hola, ${fullName}` : 'Cargando tu perfil…'}>Mi asistencia</Title>
      <Card>
        <Text style={styles.heading}>Último movimiento</Text>
        {lastMovement ? (
          <>
            <Text style={styles.movement}>{movementLabel(lastMovement.type)}</Text>
            <Text style={styles.detail}>{formatServerDate(lastMovement.created_at)}</Text>
            <Text style={styles.small}>Zona horaria: {configuredTimeZone()}</Text>
          </>
        ) : <Text style={styles.detail}>Aún no hay movimientos.</Text>}
      </Card>

      {pending ? (
        <Card>
          <Text style={styles.heading}>Checada pendiente</Text>
          <Message>Hay una {movementLabel(pending.type).toLowerCase()} confirmada en este teléfono. Reintenta con el mismo identificador para conocer el resultado del servidor.</Message>
          <ActionButton label="Reintentar checada" onPress={() => void retry()} disabled={busy || signingOut} loading={busy} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.heading}>Registrar movimiento</Text>
        <Message>En cada movimiento se pedirá biometría y una foto nueva con la cámara frontal.</Message>
        <ActionButton label="Registrar entrada" onPress={() => { clearFlowError(); void begin('entry'); }} disabled={entryBlocked} loading={busy && !pending} />
        <ActionButton label="Registrar salida" onPress={() => { clearFlowError(); void begin('exit'); }} secondary disabled={exitBlocked} />
        {!pending && !dataError && lastMovement?.type === 'entry' ? <Message>Registra una salida antes de otra entrada.</Message> : null}
        {!pending && !dataError && lastMovement?.type !== 'entry' ? <Message>Registra una entrada antes de una salida.</Message> : null}
      </Card>

      {flowError ? <Message error>{flowError}</Message> : null}
      {dataError ? <><Message error>{dataError}</Message><ActionButton label="Reintentar carga" secondary onPress={() => void refresh()} disabled={busy} /></> : null}
      {localError ? <Message error>{localError}</Message> : null}
      <ActionButton label="Cerrar sesión" secondary onPress={() => void closeSession()} disabled={busy || signingOut} loading={signingOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  movement: { color: colors.primary, fontSize: 26, fontWeight: '700' },
  detail: { color: colors.ink, fontSize: 16 },
  small: { color: colors.muted, fontSize: 13 },
});
