import type { Session } from "@supabase/supabase-js";

export interface Category {
  id: number;
  title: string;
  order: number;
}

export type Winner = {
  category_id: number;
  category_title: string;

  option_id: number;
  option_name: string;

  vote_count: number;
};


export interface Option {
  id: number;
  category_id: number;
  name: string;
  image: string;
}

export type FormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
};

export type FormErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
};

// Resposta da RPC get_top3
export type Top3Row = {
  option_id: number;
  option_name: string;
  total_votes: number; // vem do banco, mas você decide se mostra ou não na UI
};

export type Profile = {
  user_id: string;
  participant_id: number | null;
  is_admin: boolean;
};

export type SessionContextType = {
  session: Session | null;
  sessionLoading: boolean;
  sessionMessage: string | null;
  sessionError: string | null;

  profile: Profile | null;
  participantId: number | null;
  isAdmin: boolean;

  handleSignUp: (email: string, password: string, username: string) => Promise<void>;
  handleSignIn: (email: string, password: string) => Promise<void>;
  handleSignOut: () => Promise<void>;
};
