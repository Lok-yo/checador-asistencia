import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { ActionButton, Card, Field, Message, Screen, Title } from '../components/ui';
import { authMessage } from '../lib/auth-errors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';

export default function Register() {
  const { session, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (session) return <Redirect href="/" />;

  const submit = async () => {
    if (working) return;
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      setError('El nombre debe tener entre 2 y 120 caracteres.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Escribe un correo válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: trimmedName } },
      });
      if (signUpError) throw signUpError;
      if (data.session) router.replace('/');
      else setNotice('Cuenta creada. Revisa tu correo y confirma la cuenta; después inicia sesión.');
    } catch (reason) {
      setError(authMessage(reason as Error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Tu nombre aparecerá en el checador.">Crear cuenta</Title>
      <Card>
        <Field label="Nombre completo" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" editable={!working} />
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!working} />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!working} />
        <Field label="Confirmar contraseña" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" editable={!working} />
        {error ? <Message error>{error}</Message> : null}
        {notice ? <Message>{notice}</Message> : null}
        <ActionButton label="Registrarme" onPress={() => void submit()} disabled={working} loading={working} />
      </Card>
      <ActionButton label="Volver al inicio de sesión" secondary onPress={() => router.replace('/login')} disabled={working} />
    </Screen>
  );
}
