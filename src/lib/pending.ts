import * as SecureStore from 'expo-secure-store';

import type { MovementType } from './format';

export type PendingAttendance = {
  userId: string;
  type: MovementType;
  requestId: string;
  photoPath: string;
  photoUri: string | null;
};

const keyFor = (userId: string) => `attendance.pending.${userId}`;

export async function readPending(userId: string): Promise<PendingAttendance | null> {
  const raw = await SecureStore.getItemAsync(keyFor(userId));
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as PendingAttendance;
    if (
      value.userId === userId &&
      (value.type === 'entry' || value.type === 'exit') &&
      typeof value.requestId === 'string' &&
      value.photoPath === `${userId}/${value.requestId}.jpg` &&
      (value.photoUri === null || typeof value.photoUri === 'string')
    ) {
      return value;
    }
  } catch {
    // Los datos locales inválidos no deben iniciar una operación de red.
  }
  return null;
}

export async function writePending(pending: PendingAttendance): Promise<void> {
  await SecureStore.setItemAsync(keyFor(pending.userId), JSON.stringify(pending));
}

export async function removePending(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(userId));
}
