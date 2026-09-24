import * as LocalAuthentication from 'expo-local-authentication';

export async function verifyBiometrics(): Promise<void> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    throw new Error('Este celular no tiene un sensor biométrico compatible. No se puede registrar la checada.');
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (!isEnrolled || level < LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK) {
    throw new Error('Configura una huella o un rostro compatible en los ajustes de Android. El PIN no cuenta como biometría.');
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Comprueba tu identidad para registrar asistencia',
    promptSubtitle: 'Usa la biometría configurada en este celular',
    cancelLabel: 'Cancelar',
    biometricsSecurityLevel: 'weak',
    disableDeviceFallback: true,
    requireConfirmation: true,
  });

  if (!result.success) {
    const message = result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel'
      ? 'Cancelaste la comprobación biométrica. No se registró ninguna checada.'
      : result.error === 'lockout'
        ? 'La biometría está bloqueada temporalmente. Inténtalo más tarde.'
        : 'No se pudo comprobar tu biometría. Inténtalo de nuevo.';
    throw new Error(message);
  }
}
