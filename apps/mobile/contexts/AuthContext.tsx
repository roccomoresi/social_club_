import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type ProfileRow = {
  id: string;
  full_name: string | null;
  member_number: string | null;
  role: string | null;
  instagram_user: string | null;
  secret_fact: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean | null;
  trivia_1: string | null;
  trivia_2: string | null;
  trivia_3: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  refreshProfile: (userId: string) => Promise<ProfileRow | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_SELECT =
  'full_name, member_number, role, secret_fact, instagram_user, avatar_url, onboarding_completed, trivia_1, trivia_2, trivia_3';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('refreshProfile', error);
      setProfile(null);
      return null;
    }

    const row = data as ProfileRow | null;
    setProfile(row);
    return row;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session: initial },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(initial);
      if (initial?.user) {
        await refreshProfile(initial.user.id);
      }
      if (mounted) setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next?.user) {
        setLoading(true);
        await refreshProfile(next.user.id);
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
