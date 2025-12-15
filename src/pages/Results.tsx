import styles from "./Results.module.css";

import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import type { Winner } from "../types";

type SessionState = {
  id: number;
  current_category_id: number;
  locked: boolean;
  phase?: "lobby" | "voting" | "results" | string;
};

export function Results() {
  const [state, setState] = useState<SessionState | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      const s = await fetchSessionState();
      if (cancelled) return;

      setState(s);

      if (s && s.current_category_id > 0) {
        await loadWinners(s.current_category_id);
      } else {
        setWinners([]);
      }

      setLoading(false);
    }

    init();

    const channel = supabase
      .channel("realtime-results")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_state" },
        async () => {
          const s = await fetchSessionState();
          if (cancelled) return;

          setState(s);

          if (s && s.current_category_id > 0) {
            await loadWinners(s.current_category_id);
          } else {
            setWinners([]);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchSessionState(): Promise<SessionState | null> {
    const { data, error } = await supabase
      .from("session_state")
      .select("id, current_category_id, locked, phase")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Results: erro ao buscar session_state:", error);
      return null;
    }

    return data ?? null;
  }

  async function loadWinners(categoryId: number) {
    const { data, error } = await supabase
      .from("winners_view")
      .select("*")
      .eq("category_id", categoryId)
      .order("vote_count", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Results: erro ao buscar winners:", error);
      setWinners([]);
      return;
    }

    setWinners((data as Winner[]) ?? []);
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1>Carregando resultados…</h1>
      </div>
    );
  }

  if (!state || state.current_category_id === 0) {
    return (
      <div className={styles.container}>
        <h1>Aguardando resultados…</h1>
        <p>O host ainda não iniciou a votação.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Resultados</h1>

      {winners.length === 0 && (
        <p>Nenhum voto registrado para esta categoria.</p>
      )}

      <ul className={styles.list}>
        {winners.map((winner, index) => (
          <li key={winner.option_id} className={styles.item}>
            <span className={styles.position}>{index + 1}º</span>
            <span className={styles.name}>{winner.option_name}</span>
            <span className={styles.votes}>{winner.vote_count} votos</span>
          </li>
        ))}
      </ul>

      <p className={styles.info}>
        Aguarde o host avançar para a próxima categoria.
      </p>
    </div>
  );
}
