// src/context/SessionContext.tsx
import { createContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";

export type Profile = {
  id: string; // uuid (auth.users.id)
  participant_id: number | null; // int8
  is_admin: boolean;
};

export type SessionContextType = {
  session: Session | null;
  profile: Profile | null;

  isAdmin: boolean;
  participantId: number | null;

  sessionLoading: boolean;
  sessionMessage: string | null;
  sessionError: string | null;

  handleSignUp: (email: string, password: string, username: string) => Promise<void>;
  handleSignIn: (email: string, password: string) => Promise<void>;
  handleSignOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextType>({
  session: null,
  profile: null,

  isAdmin: false,
  participantId: null,

  sessionLoading: false,
  sessionMessage: null,
  sessionError: null,

  handleSignUp: async () => {},
  handleSignIn: async () => {},
  handleSignOut: async () => {},
});

type Props = {
  children: ReactNode;
};

export function SessionProvider({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const isAdmin = profile?.is_admin ?? false;
  const participantId = profile?.participant_id ?? null;

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, participant_id, is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as Profile | null;
  }

  async function ensureProfile(userId: string, usernameFallback: string) {
    // 1) tenta buscar profile
    const existing = await fetchProfile(userId);
    if (existing) {
      setProfile(existing);
      return;
    }

    // 2) cria participant
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .insert({ name: usernameFallback })
      .select("id")
      .single();

    if (participantError) throw participantError;

    // 3) cria profile
    const { data: createdProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        participant_id: participant.id,
        is_admin: false,
      })
      .select("id, participant_id, is_admin")
      .single();

    if (profileError) throw profileError;

    setProfile(createdProfile as Profile);
  }

  useEffect(() => {
    async function getSession() {
      setSessionLoading(true);
      setSessionError(null);

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const currentSession = data.session ?? null;
        setSession(currentSession);

        if (!currentSession?.user?.id) {
          setProfile(null);
          return;
        }

        const username =
          (currentSession.user.user_metadata?.username as string | undefined) ??
          currentSession.user.email?.split("@")[0] ??
          "Participante";

        await ensureProfile(currentSession.user.id, username);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao buscar sessão";
        setSession(null);
        setProfile(null);
        setSessionError(message);
      } finally {
        setSessionLoading(false);
      }
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession ?? null);

      if (!newSession?.user?.id) {
        setProfile(null);
        return;
      }

      const username =
        (newSession.user.user_metadata?.username as string | undefined) ??
        newSession.user.email?.split("@")[0] ??
        "Participante";

      try {
        await ensureProfile(newSession.user.id, username);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao carregar perfil";
        setSessionError(message);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignUp(email: string, password: string, username: string) {
    setSessionLoading(true);
    setSessionMessage(null);
    setSessionError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
          emailRedirectTo: `${window.location.origin}/signin`,
        },
      });

      if (error) throw error;

      if (data.user) {
        setSessionMessage("Cadastro realizado! Verifique seu email.");
        window.location.href = "/signin";
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro no cadastro";
      setSessionError(message);
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleSignIn(email: string, password: string) {
    setSessionLoading(true);
    setSessionMessage(null);
    setSessionError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        setSession(data.session);

        const username =
          (data.session.user.user_metadata?.username as string | undefined) ??
          data.session.user.email?.split("@")[0] ??
          "Participante";

        await ensureProfile(data.session.user.id, username);

        setSessionMessage("Login realizado com sucesso.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro no login";
      setSessionError(message);
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleSignOut() {
    setSessionLoading(true);
    setSessionMessage(null);
    setSessionError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setSession(null);
      setProfile(null);

      // mantém seu estilo “direto”
      window.location.href = "/";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao sair";
      setSessionError(message);
    } finally {
      setSessionLoading(false);
    }
  }

  const contextValue: SessionContextType = {
    session,
    profile,
    isAdmin,
    participantId,
    sessionLoading,
    sessionMessage,
    sessionError,
    handleSignUp,
    handleSignIn,
    handleSignOut,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}
