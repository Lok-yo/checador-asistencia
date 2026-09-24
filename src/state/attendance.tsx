import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';

import { verifyBiometrics } from '../lib/biometrics';
import type { Attendance, MovementType } from '../lib/format';
import { compressedJpeg } from '../lib/photo';
import { readPending, removePending, writePending, type PendingAttendance } from '../lib/pending';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';

type ResultState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'success'; attendance: Attendance }
  | { status: 'error'; message: string; retryable: boolean; needsPhoto: boolean };

type AttendanceContextValue = {
  verifiedType: MovementType | null;
  pending: PendingAttendance | null;
  busy: boolean;
  flowError: string | null;
  result: ResultState;
  begin: (type: MovementType) => Promise<void>;
  confirmPhoto: (uri: string) => Promise<void>;
  retry: () => Promise<void>;
  cancel: () => void;
  clearFlowError: () => void;
};

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

function serverCode(error: { message?: string } | null): string | null {
  const message = error?.message || '';
  return ['PHOTO_MISSING', 'ENTRY_ALREADY_OPEN', 'NO_OPEN_ENTRY', 'REQUEST_CONFLICT', 'AUTH_REQUIRED', 'INVALID_REQUEST']
    .find((code) => message.includes(code)) || null;
}

function serverMessage(code: string): string {
  switch (code) {
    case 'ENTRY_ALREADY_OPEN': return 'Ya tienes una entrada abierta. Registra una salida antes de otra entrada.';
    case 'NO_OPEN_ENTRY': return 'No hay una entrada abierta. Primero registra una entrada.';
    case 'REQUEST_CONFLICT': return 'Esta solicitud ya se usó para otro movimiento.';
    case 'AUTH_REQUIRED': return 'Tu sesión venció. Inicia sesión para reintentar.';
    case 'INVALID_REQUEST': return 'La solicitud no es válida. Inicia el proceso otra vez.';
    default: return 'No se pudo confirmar la checada.';
  }
}

export function AttendanceProvider({ children }: PropsWithChildren) {
  const { session, refresh } = useAuth();
  const [verifiedType, setVerifiedType] = useState<MovementType | null>(null);
  const [pending, setPending] = useState<PendingAttendance | null>(null);
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState>({ status: 'idle' });
  const busyRef = useRef(false);
  const generation = useRef(0);
  const userId = session?.user.id;

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        generation.current += 1;
        setVerifiedType(null);
      }
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    queueMicrotask(() => {
      if (!active) return;
      setVerifiedType(null);
      setResult({ status: 'idle' });
      setPending(null);
    });
    if (userId) {
      readPending(userId).then((value) => {
        if (active) setPending(value);
      }).catch(() => {
        if (active) setFlowError('No se pudo leer una checada pendiente del almacenamiento seguro.');
      });
    }
    return () => { active = false; };
  }, [userId]);

  const setWorking = (working: boolean) => {
    busyRef.current = working;
    setBusy(working);
  };

  const authenticate = async (type: MovementType): Promise<boolean> => {
    const expectedGeneration = generation.current;
    try {
      await verifyBiometrics();
      if (generation.current !== expectedGeneration) {
        setFlowError('Se interrumpió el proceso. Comprueba tu biometría de nuevo.');
        return false;
      }
      setVerifiedType(type);
      return true;
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : 'No se pudo comprobar la biometría.');
      return false;
    }
  };

  const begin = async (type: MovementType) => {
    if (!session || pending || busyRef.current) return;
    setWorking(true);
    setFlowError(null);
    try {
      if (await authenticate(type)) router.push('/camera');
    } finally {
      setWorking(false);
    }
  };

  const complete = useCallback(async (item: PendingAttendance) => {
    setResult({ status: 'working' });
    router.replace('/result');
    setWorking(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || userData.user?.id !== item.userId) {
        throw new Error('Tu sesión venció. Inicia sesión con la misma cuenta para reintentar.');
      }

      const finalize = () => supabase.rpc('finalize_attendance', {
        p_type: item.type,
        p_request_id: item.requestId,
      });
      let response = await finalize();
      if (serverCode(response.error) === 'PHOTO_MISSING') {
        if (!item.photoUri) {
          setResult({ status: 'error', message: 'La foto aún no llegó al servidor. Toma una foto nueva para esta solicitud.', retryable: true, needsPhoto: true });
          return;
        }

        let bytes: ArrayBuffer;
        try {
          bytes = await compressedJpeg(item.photoUri);
        } catch {
          setResult({ status: 'error', message: 'No se pudo recuperar la foto local. Toma una foto nueva.', retryable: true, needsPhoto: true });
          return;
        }
        const upload = await supabase.storage.from('attendance-photos').upload(item.photoPath, bytes, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        const uploadStatus = (upload.error as { statusCode?: string | number } | null)?.statusCode;
        const alreadyExists = String(uploadStatus) === '409' || upload.error?.message?.toLowerCase().includes('already exists');
        if (upload.error && !alreadyExists) {
          throw new Error('No se pudo subir la foto. Comprueba tu conexión y reintenta.');
        }

        response = await finalize();
      }

      if (response.error) {
        const code = serverCode(response.error);
        if (code && code !== 'PHOTO_MISSING') {
          await removePending(item.userId);
          setPending(null);
          setResult({ status: 'error', message: serverMessage(code), retryable: false, needsPhoto: false });
          void refresh();
          return;
        }
        throw new Error(code === 'PHOTO_MISSING'
          ? 'El servidor aún no encuentra la foto. Reintenta en un momento.'
          : 'No se pudo confirmar la checada. Comprueba tu conexión y reintenta.');
      }

      await removePending(item.userId);
      setPending(null);
      setVerifiedType(null);
      setResult({ status: 'success', attendance: response.data as Attendance });
      void refresh();
    } catch (error) {
      setResult({
        status: 'error',
        message: error instanceof Error ? error.message : 'No se pudo completar la checada.',
        retryable: true,
        needsPhoto: false,
      });
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  const confirmPhoto = async (uri: string) => {
    if (!session || !verifiedType || busyRef.current) return;
    setWorking(true);
    setFlowError(null);
    try {
      const requestId = pending?.requestId || randomUUID();
      const item: PendingAttendance = {
        userId: session.user.id,
        type: verifiedType,
        requestId,
        photoPath: `${session.user.id}/${requestId}.jpg`,
        photoUri: uri,
      };
      await writePending(item);
      setPending(item);
      setWorking(false);
      await complete(item);
    } catch {
      setFlowError('No se pudo guardar esta solicitud en el teléfono. Inténtalo de nuevo.');
      setWorking(false);
    }
  };

  const retry = async () => {
    if (!pending || !session || busyRef.current) return;
    setWorking(true);
    setFlowError(null);
    try {
      if (!await authenticate(pending.type)) return;
      if (result.status === 'error' && result.needsPhoto) {
        router.replace('/camera');
        return;
      }
      setWorking(false);
      await complete(pending);
    } finally {
      if (busyRef.current) setWorking(false);
    }
  };

  const cancel = () => {
    generation.current += 1;
    setVerifiedType(null);
    setFlowError(null);
    router.replace('/');
  };

  return (
    <AttendanceContext.Provider value={{
      verifiedType, pending, busy, flowError, result,
      begin, confirmPhoto, retry, cancel, clearFlowError: () => setFlowError(null),
    }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance(): AttendanceContextValue {
  const context = useContext(AttendanceContext);
  if (!context) throw new Error('AttendanceProvider no está disponible');
  return context;
}
