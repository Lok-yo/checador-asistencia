import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Attendance } from '../lib/format';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  fullName: string | null;
  lastMovement: Attendance | null;
  dataError: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string | null>(null);
  const [lastMovement, setLastMovement] = useState<Attendance | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setDataError('No se pudo recuperar la sesión guardada.');
      currentUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      if (active) {
        setDataError('No se pudo recuperar la sesión guardada.');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      currentUserId.current = nextSession?.user.id ?? null;
      if (!nextSession) {
        setFullName(null);
        setLastMovement(null);
      }
      setSession(nextSession);
      setLoading(false);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else if (state === 'background') supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    return () => {
      active = false;
      subscription.unsubscribe();
      appState.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;
    const [profileResponse, attendanceResponse] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', userId).single(),
      supabase.from('attendance').select('id,user_id,type,photo_path,created_at,request_id')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (currentUserId.current !== userId) return;
    if (profileResponse.error || attendanceResponse.error) {
      setDataError('No se pudieron cargar tus datos. Comprueba la conexión y reintenta.');
      return;
    }
    setFullName(profileResponse.data.full_name);
    setLastMovement(attendanceResponse.data as Attendance | null);
    setDataError(null);
  }, [session]);

  useEffect(() => {
    if (session) {
      queueMicrotask(() => { void refresh(); });
    }
  }, [session, refresh]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error('No se pudo cerrar sesión. Inténtalo de nuevo.');
  };

  return (
    <AuthContext.Provider value={{ session, loading, fullName, lastMovement, dataError, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider no está disponible');
  return context;
}
