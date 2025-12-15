import styles from "./Host.module.css";

import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { Button } from "../components/Button";
import type { Category, Option } from "../types";

type SessionState = {
  id: number;
  current_category_id: number;
  locked: boolean;
};

export function Host() {
  const [state, setState] = useState<SessionState | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [votesCount, setVotesCount] = useState(0);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel("host-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_state" },
        () => loadAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function getSessionState(): Promise<SessionState | null> {
    const { data, error } = await supabase
      .from("session_state")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar session_state:", error);
      return null;
    }

    return data as SessionState | null;
  }

  async function loadAll() {
    setLoading(true);

    const s = await getSessionState();
    if (!s) {
      setState(null);
      setCategory(null);
      setOptions([]);
      setLoading(false);
      return;
    }

    setState(s);

    // categoria atual
    if (s.current_category_id > 0) {
      const { data: cat } = await supabase
        .from("categories")
        .select("*")
        .eq("id", s.current_category_id)
        .maybeSingle();

      setCategory(cat ?? null);

      const { data: opts } = await supabase
        .from("options")
        .select("*")
        .eq("category_id", s.current_category_id);

      setOptions(opts ?? []);
    } else {
      setCategory(null);
      setOptions([]);
    }

    // votos e participantes
    const [{ count: votes }, { count: participants }] = await Promise.all([
      supabase
        .from("votes")
        .select("*", { count: "exact", head: true })
        .eq("category_id", s.current_category_id),
      supabase
        .from("participants")
        .select("*", { count: "exact", head: true }),
    ]);

    setVotesCount(votes ?? 0);
    setParticipantsCount(participants ?? 0);

    setLoading(false);
  }

  async function updateSessionState(values: Partial<SessionState>) {
    if (!state) return;

    await supabase
      .from("session_state")
      .update(values)
      .eq("id", state.id);

    await loadAll();
  }

  async function nextCategory(force = false) {
    if (!state) return;

    // se não for forçado, só avança quando todos votaram
    if (!force && participantsCount > votesCount) return;

    const { data: categories } = await supabase
      .from("categories")
      .select("*")
      .order("id", { ascending: true });

    if (!categories || categories.length === 0) return;

    const currentIndex = categories.findIndex(
      (c) => c.id === state.current_category_id
    );

    const next = categories[currentIndex + 1];

    if (!next) return;

    await updateSessionState({
      current_category_id: next.id,
      locked: false,
    });
  }

  async function resetToWaiting() {
    await updateSessionState({
      current_category_id: 0,
      locked: false,
    });
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h2>Carregando...</h2>
      </div>
    );
  }

  if (!state) {
    return (
      <div className={styles.container}>
        <h2>
          Nenhuma sessão encontrada. Crie uma linha em <code>session_state</code>.
        </h2>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Host</h1>

      <p>
        Categoria atual:{" "}
        <strong>
          {state.current_category_id === 0
            ? "Waiting"
            : category?.title}
        </strong>
      </p>

      <p>
        Votos: {votesCount} / {participantsCount}
      </p>

      <div className={styles.buttons}>
        <Button
          message="Próxima categoria"
          onClick={() => nextCategory(false)}
          disabled={participantsCount !== votesCount}
        />

        <Button
          message="Forçar avanço"
          onClick={() => nextCategory(true)}
        />

        <Button
          message="Voltar para waiting"
          onClick={resetToWaiting}
        />
      </div>
    </div>
  );
}
