import styles from "./Screen.module.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import type { Category, Winner } from "../types";

type SessionState = {
  id: number;
  current_category_id: number;
  locked: boolean;
  phase?: "lobby" | "voting" | "results" | string;
};

export function Screen() {
  const [state, setState] = useState<SessionState | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  const currentCategoryId = state?.current_category_id ?? 0;

  const phase = useMemo(() => {
    // se tiver phase no banco, usa; senão deduz pelo category_id
    if (state?.phase) return state.phase;
    return currentCategoryId === 0 ? "lobby" : "voting";
  }, [state?.phase, currentCategoryId]);

  const isLobby = phase === "lobby" || currentCategoryId === 0;
  const isVoting = phase === "voting" && currentCategoryId !== 0;
  const isResults = phase === "results" && currentCategoryId !== 0;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      const s = await fetchSessionState();
      if (cancelled) return;

      setState(s);

      if (!s) {
        setCategory(null);
        setWinners([]);
        setLoading(false);
        return;
      }

      if (s.current_category_id === 0) {
        setCategory({ id: 0, title: "Waiting", order: 0 });
        setWinners([]);
      } else {
        await loadCategory(s.current_category_id);
        if (s.phase === "results") {
          await loadWinners(s.current_category_id);
        } else {
          setWinners([]);
        }
      }

      setLoading(false);
    }

    init();

    const channel = supabase
      .channel("realtime-screen")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_state" },
        async () => {
          const s = await fetchSessionState();
          if (cancelled) return;

          setState(s);

          if (!s) {
            setCategory(null);
            setWinners([]);
            return;
          }

          if (s.current_category_id === 0) {
            setCategory({ id: 0, title: "Waiting", order: 0 });
            setWinners([]);
            return;
          }

          await loadCategory(s.current_category_id);

          if (s.phase === "results") {
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
      console.error("Screen: erro ao buscar session_state:", error);
      return null;
    }
    return (data ?? null) as SessionState | null;
  }

  async function loadCategory(categoryId: number) {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", categoryId)
      .maybeSingle();

    if (error) {
      console.error("Screen: erro ao buscar categoria:", error);
      setCategory(null);
      return;
    }

    setCategory((data as Category) ?? null);
  }

  async function loadWinners(categoryId: number) {
    const { data, error } = await supabase
      .from("winners_view")
      .select("*")
      .eq("category_id", categoryId)
      .order("vote_count", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Screen: erro ao buscar winners:", error);
      setWinners([]);
      return;
    }

    setWinners((data as Winner[]) ?? []);
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.center}>
          <h1>Carregando…</h1>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className={styles.container}>
        <div className={styles.center}>
          <h1>Sem sessão ativa</h1>
          <p>Crie uma linha em <strong>session_state</strong> para iniciar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h1 className={styles.title}>Melhores do Ano</h1>
        <div className={styles.badge}>
          {isLobby ? "Aguardando" : isVoting ? "Votação" : "Resultados"}
        </div>
      </div>

      {isLobby && (
        <div className={styles.center}>
          <h2 className={styles.big}>Esperando todo mundo entrar…</h2>
          <p className={styles.sub}>
            Assim que o host iniciar, a categoria vai aparecer aqui.
          </p>
        </div>
      )}

      {isVoting && (
        <div className={styles.center}>
          <h2 className={styles.big}>{category?.title ?? "Categoria"}</h2>
          <p className={styles.sub}>
            Votação em andamento. Vote pelo celular.
          </p>

          {state.locked && (
            <p className={styles.locked}>
              Votação bloqueada (aguardando host).
            </p>
          )}
        </div>
      )}

      {isResults && (
        <div className={styles.center}>
          <h2 className={styles.big}>{category?.title ?? "Resultados"}</h2>
          <p className={styles.sub}>Top 3 da categoria</p>

          {winners.length === 0 ? (
            <p className={styles.sub}>Nenhum voto registrado.</p>
          ) : (
            <div className={styles.podium}>
              {winners.map((w, index) => (
                <div key={w.option_id} className={styles.podiumItem}>
                  <div className={styles.position}>{index + 1}º</div>
                  <div className={styles.name}>{w.option_name}</div>
                  <div className={styles.votes}>{w.vote_count} votos</div>
                </div>
              ))}
            </div>
          )}

          <p className={styles.sub}>Aguardando a próxima categoria…</p>
        </div>
      )}
    </div>
  );
}
