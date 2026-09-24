export type MovementType = 'entry' | 'exit';

export type Attendance = {
  id: string;
  user_id: string;
  type: MovementType;
  photo_path: string;
  created_at: string;
  request_id: string;
};

export const movementLabel = (type: MovementType) =>
  type === 'entry' ? 'Entrada' : 'Salida';

const configuredZone = process.env.EXPO_PUBLIC_TIME_ZONE || 'America/Hermosillo';

export function formatServerDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: configuredZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date) + ' UTC';
  }
}

export function configuredTimeZone(): string {
  return configuredZone;
}
