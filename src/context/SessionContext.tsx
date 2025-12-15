import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";

type SessionMessage = string | null;
type SessionError = string | null;

type Profile = {
  user_id: string;
  participant_id: number | null; // participants.id é int8 -> em TS fica number
  is_admin: boolean;
};

type SessionContextType = {
  session: Session | null;
  sessionLoading: boolean;
  sessionMessage: SessionMessage;
  sessionError: SessionError;

  // infos úteis pro app (sem expor votos):
  profile: Profile | null;
  participantId: number | null;
  isAdmin: boolean;

  handleSignUp: (email: string, password: string, username: string) => Promise<void>;
  handleSignIn: (email: string, password: string) => Promise<void>;
  handleSignOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextType>({
  session: null,
  sessionLoading: false,
  sessionMessage: null,
  sessionError: null,

  profile: null,
  participantId: null,
  isAdmin: false,

  handleSignUp: async () => {},
  handleSignIn: async () => {},
  handleSignOut: async () => {},
});

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);

  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<SessionMessage>(null);
  const [sessionError, setSessionError] = useState<SessionError>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const participantId = profile?.participant_id ?? null;
  const isAdmin = profile?.is_admin ?? false;

  // Busca perfil + cria registro se não existir (primeiro login)
  async function ensureProfileForUser(userId: string, fallbackName: string) {
    // 1) tenta pegar profile existente
    const { data: existing, error: existingErr } = await supabase
      .from("profiles")
      .select("user_id, participant_id, is_admin")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existing) {
      setProfile(existing);
      return;
    }

    // 2) se não existe, cria participant
    const { data: createdParticipant, error: participantErr } = await supabase
      .from("participants")
      .insert({ name: fallbackName })
      .select("id")
      .single();

    if (participantErr) throw participantErr;

    // 3) cria profile ligando auth user -> participants.id
    const { data: createdProfile, error: profileErr } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        participant_id: createdParticipant.id,
        is_admin: false,
      })
      .select("user_id, participant_id, is_admin")
      .single();

    if (profileErr) throw profileErr;

    setProfile(createdProfile);
  }

  async function loadSessionAndProfile() {
    setSessionLoading(true);
    setSessionError(null);

    try {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      setSession(currentSession ?? null);

      // se tem sessão, tenta carregar/criar profile
      if (currentSession?.user?.id) {
        const usernameFromMeta =
          (currentSession.user.user_metadata?.username as string | undefined) ??
          (currentSession.user.email?.split("@")[0] ?? "Participante");

        await ensureProfileForUser(currentSession.user.id, usernameFromMeta);
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      setSession(null);
      setProfile(null);
      setSessionError(err?.message ?? "Error loading session");
    } finally {
      setSessionLoading(false);
    }
  }

  useEffect(() => {
    // carrega ao abrir o app
    loadSessionAndProfile();

    // escuta mudanças de auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession ?? null);

      // quando muda sessão, atualiza profile
      if (newSession?.user?.id) {
        const usernameFromMeta =
          (newSession.user.user_metadata?.username as string | undefined) ??
          (newSession.user.email?.split("@")[0] ?? "Participante");

        try {
          await ensureProfileForUser(newSession.user.id, usernameFromMeta);
        } catch (err: any) {
          setProfile(null);
          setSessionError(err?.message ?? "Error loading profile");
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Em muitos casos não vem sessão imediata (confirmação por email).
      // Só avisamos e pronto — o profile será criado no primeiro login confirmado.
      if (data.user) {
        setSessionMessage("Cadastro feito! Confirma seu email e depois faça login.");
      }
    } catch (err: any) {
      setSessionError(err?.message ?? "Error on sign up");
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

      setSession(data.session ?? null);

      // garante profile ao logar
      if (data.session?.user?.id) {
        const usernameFromMeta =
          (data.session.user.user_metadata?.username as string | undefined) ??
          (data.session.user.email?.split("@")[0] ?? "Participante");

        await ensureProfileForUser(data.session.user.id, usernameFromMeta);
      }

      setSessionMessage("Login realizado.");
    } catch (err: any) {
      setSessionError(err?.message ?? "Error on sign in");
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
      window.location.href = "/";
    } catch (err: any) {
      setSessionError(err?.message ?? "Error on sign out");
    } finally {
      setSessionLoading(false);
    }
  }

  const value = useMemo<SessionContextType>(
    () => ({
      session,
      sessionLoading,
      sessionMessage,
      sessionError,
      profile,
      participantId,
      isAdmin,
      handleSignUp,
      handleSignIn,
      handleSignOut,
    }),
    [session, sessionLoading, sessionMessage, sessionError, profile, participantId, isAdmin]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
