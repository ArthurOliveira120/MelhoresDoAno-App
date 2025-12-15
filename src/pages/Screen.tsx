import styles from "./Screen.module.css";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

type SessionStateRow = {
  id: number;
  current_category_id: number;
  locked: boolean;
  phase: "lobby" | "voting" | "results" | string;
};

type Category = {
  id: number;
  title: string;
};

type Option = {
  id: number;
  category_id: number;
  name: string;
};

type Top3Row = {
  option_id: number;
  option_name: string;
  total_votes: number;
};

export function Screen() {
  const [state, setState] = useState<SessionStateRow | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [top3, setTop3] = useState<Top3Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      const s = await fetchSessionState();
      if (cancelled) return;

      if (s) {
        setState(s);
        await loadScreenData(s);
      }

      setLoading(false);
    }

    init();

    // ✅ A TV escuta somente mudanças no session_state
    const channel = supabase
      .channel("realtime-screen-session-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_state" },
        async () => {
          const s = await fetchSessionState();
          if (cancelled) return;

          if (s) {
            setState(s);
            await loadScreenData(s);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchSessionState() {
    const { data, error } = await supabase
      .from("session_state")
      .select("id, current_category_id, locked, phase")
      .single();

    if (error) {
      console.error("Screen: erro ao buscar session_state:", error);
      return null;
    }

    return data as SessionStateRow;
  }

  async function loadScreenData(s: SessionStateRow) {
    // sempre limpa o que não for do modo atual
    setTop3([]);

    // Categoria 0 = lobby (pode manter isso por enquanto)
    // Se você já adicionou phase, ele vira a regra principal.
    const categoryId = s.current_category_id;

    // Se estiver mostrando resultados -> pega Top3 via RPC
    if (s.phase === "results") {
      await loadCategory(categoryId);
      await loadTop3(categoryId);
      return;
    }

    // Lobby ou Voting -> mostra categoria e opções
    await Promise.all([loadCategory(categoryId), loadOptions(categoryId)]);
  }

  async function loadCategory(categoryId: number) {
    const { data, error } = await supabase
      .from("categories")
      .select("id, title")
      .eq("id", categoryId)
      .single();

    if (error) {
      console.error("Screen: erro ao buscar categoria:", error);
      setCategory(null);
      return;
    }

    setCategory(data as Category);
  }

  async function loadOptions(categoryId: number) {
    const { data, error } = await supabase
      .from("options")
      .select("id, category_id, name")
      .eq("category_id", categoryId)
      .order("id", { ascending: true });

    if (error) {
      console.error("Screen: erro ao buscar options:", error);
      setOptions([]);
      return;
    }

    setOptions((data as Option[]) ?? []);
  }

  async function loadTop3(categoryId: number) {
    // ✅ Não usa tabela votes; usa RPC segura
    const { data, error } = await supabase.rpc("get_top3", {
      category_id_param: categoryId,
    });

    if (error) {
      console.error("Screen: erro ao buscar top3:", error);
      setTop3([]);
      return;
    }

    setTop3((data as Top3Row[]) ?? []);
  }

  const phase = state?.phase ?? "lobby";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img src="/logo.png" className={styles.logo} alt="Logo" />
        <div className={styles.headerText}>
          <h1 className={styles.eventTitle}>Melhores do Ano</h1>
          <p className={styles.phase}>
            {phase === "lobby" && "Aguardando participantes..."}
            {phase === "voting" && "Votação aberta"}
            {phase === "results" && "Resultados"}
          </p>
        </div>
      </header>

      {loading && <p className={styles.loading}>Carregando...</p>}

      {!loading && (
        <main className={styles.main}>
          {/* LOBBY */}
          {phase === "lobby" && (
            <section className={styles.card}>
              <h2 className={styles.categoryTitle}>Sala de espera</h2>
              <p className={styles.bigText}>
                Entre no site pelo celular e faça login para votar 🎉
              </p>
            </section>
          )}

          {/* VOTING */}
          {phase === "voting" && (
            <section className={styles.card}>
              <h2 className={styles.categoryTitle}>
                {category?.title ?? "Categoria"}
              </h2>

              <div className={styles.grid}>
                {options.map((opt) => (
                  <div key={opt.id} className={styles.optionCard}>
                    <span className={styles.optionName}>{opt.name}</span>
                  </div>
                ))}
              </div>

              <p className={styles.tip}>
                Vote no celular. A TV só exibe as informações.
              </p>
            </section>
          )}

          {/* RESULTS */}
          {phase === "results" && (
            <section className={styles.card}>
              <h2 className={styles.categoryTitle}>
                {category?.title ?? "Categoria"}
              </h2>

              <div className={styles.podium}>
                {top3.length === 0 && (
                  <p className={styles.bigText}>Carregando Top 3...</p>
                )}

                {top3.map((w, idx) => (
                  <div key={w.option_id} className={styles.podiumItem}>
                    <span className={styles.rank}>#{idx + 1}</span>
                    <span className={styles.winnerName}>{w.option_name}</span>
                    {/* Se você quiser esconder número de votos na TV também, é só remover essa linha */}
                    <span className={styles.votes}>{w.total_votes} votos</span>
                  </div>
                ))}
              </div>

              <p className={styles.tip}>
                O host controla quando exibir os resultados e quando avançar.
              </p>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
