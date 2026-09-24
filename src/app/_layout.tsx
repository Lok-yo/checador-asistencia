import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '../state/auth';
import { AttendanceProvider } from '../state/attendance';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AttendanceProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AttendanceProvider>
    </AuthProvider>
  );
}
