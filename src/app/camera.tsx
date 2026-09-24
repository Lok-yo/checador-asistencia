import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, colors, Message, Screen, Title } from '../components/ui';
import { movementLabel } from '../lib/format';
import { useAuth } from '../state/auth';
import { useAttendance } from '../state/attendance';

export default function CameraScreen() {
  const { session } = useAuth();
  const { verifiedType, busy, flowError, confirmPhoto, cancel } = useAttendance();
  const [permission, requestPermission] = useCameraPermissions();
  const [pictureUri, setPictureUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const requestedPermission = useRef(false);

  useEffect(() => {
    if (verifiedType && permission && !permission.granted && permission.canAskAgain && !requestedPermission.current) {
      requestedPermission.current = true;
      void requestPermission();
    }
  }, [verifiedType, permission, requestPermission]);

  if (!session) return <Redirect href="/login" />;
  if (!verifiedType) return <Redirect href="/" />;

  const capture = async () => {
    if (!ready || capturing || busy || !cameraRef.current) return;
    setCapturing(true);
    setCameraError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (!picture?.uri) throw new Error('La cámara no devolvió una fotografía.');
      setPictureUri(picture.uri);
      setReady(false);
    } catch {
      setCameraError('No se pudo tomar la fotografía. Inténtalo de nuevo.');
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) {
    return <Screen><ActivityIndicator /><Message>Comprobando el permiso de cámara…</Message></Screen>;
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Title>Permiso de cámara</Title>
        <Message error>Necesitamos permiso para tomar una selfie nueva. No se guardó la checada.</Message>
        {permission.canAskAgain ? <ActionButton label="Conceder permiso" onPress={() => void requestPermission()} /> : <Message>Activa el permiso de cámara para Expo Go en los ajustes de Android y vuelve a iniciar el proceso.</Message>}
        <ActionButton label="Cancelar" secondary onPress={cancel} />
      </Screen>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Text style={styles.title}>Foto para {movementLabel(verifiedType).toLowerCase()}</Text>
        <Text style={styles.hint}>Usa la cámara frontal. La foto se enviará solo cuando la confirmes.</Text>
      </View>
      <View style={styles.preview}>
        {pictureUri ? (
          <Image source={{ uri: pictureUri }} style={styles.camera} resizeMode="cover" />
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
            mode="picture"
            flash="off"
            onCameraReady={() => setReady(true)}
            onMountError={() => setCameraError('No se pudo abrir la cámara frontal en este celular.')}
          />
        )}
      </View>
      <View style={styles.controls}>
        {cameraError ? <Message error>{cameraError}</Message> : null}
        {flowError ? <Message error>{flowError}</Message> : null}
        {pictureUri ? (
          <>
            <ActionButton label="Confirmar fotografía" onPress={() => void confirmPhoto(pictureUri)} disabled={busy} loading={busy} />
            <ActionButton label="Repetir fotografía" secondary onPress={() => { setPictureUri(null); setCameraError(null); }} disabled={busy} />
          </>
        ) : <ActionButton label="Tomar fotografía" onPress={() => void capture()} disabled={!ready || capturing || busy} loading={capturing} />}
        <ActionButton label="Cancelar" secondary onPress={cancel} disabled={busy || capturing} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 22, paddingVertical: 16, gap: 5 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 14 },
  preview: { flex: 1, marginHorizontal: 16, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.ink },
  camera: { width: '100%', height: '100%' },
  controls: { padding: 16, gap: 10 },
});
