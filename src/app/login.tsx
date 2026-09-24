import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { ActionButton, Card, Field, Message, Screen, Title } from '../components/ui';
import { authMessage } from '../lib/auth-errors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (session) return <Redirect href="/" />;

  const submit = async () => {
    if (working) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Escribe un correo válido.');
      return;
    }
    if (!password) {
      setError('Escribe tu contraseña.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signInError) throw signInError;
      router.replace('/');
    } catch (reason) {
      setError(authMessage(reason as Error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Inicia sesión para registrar tu asistencia.">Checador de asistencia</Title>
      <Card>
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!working} />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" editable={!working} />
        {error ? <Message error>{error}</Message> : null}
        <ActionButton label="Iniciar sesión" onPress={() => void submit()} disabled={working} loading={working} />
      </Card>
      <ActionButton label="Crear cuenta" secondary onPress={() => router.push('/register')} disabled={working} />
    </Screen>
  );
}
