export function authMessage(error: { message?: string }): string {
  const message = (error.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (message.includes('email not confirmed')) return 'Confirma tu correo desde el mensaje recibido antes de iniciar sesión.';
  if (message.includes('already registered')) return 'Ese correo ya está registrado. Inicia sesión.';
  if (message.includes('password')) return 'La contraseña no cumple las reglas configuradas en Supabase.';
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  return 'No se pudo conectar con Supabase. Comprueba tu conexión e inténtalo de nuevo.';
}
