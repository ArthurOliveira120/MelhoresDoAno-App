import styles from "./Results.module.css";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

type CategoryRow = {
  id: number;
  title: string;
};

type Top3Row = {
  option_id: number;
  option_name: string;
  total_votes: number; // vem da RPC, mas a UI não precisa mostrar
};

type WinnerRow = {
  category_id: number;
  category_title: string;
  option_id: number;
  option_name: string;
};

export function Results() {
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchWinners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchWinners() {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1) Busca categorias
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, title")
        .order("id", { ascending: true });

      if (categoriesError) throw categoriesError;

      const categoryList = (categories as CategoryRow[]) ?? [];

      if (categoryList.length === 0) {
        setWinners([]);
        return;
      }

      // 2) Para cada categoria, chama a RPC get_top3 e pega o 1º lugar
      const winnerPromises = categoryList.map(async (cat) => {
        const { data, error } = await supabase.rpc("get_top3", {
          category_id_param: cat.id,
        });

        if (error) {
          console.error(`Erro no get_top3 (category ${cat.id}):`, error);
          return null;
        }

        const top3 = (data as Top3Row[]) ?? [];
        const first = top3[0];

        if (!first) return null;

        const winner: WinnerRow = {
          category_id: cat.id,
          category_title: cat.title,
          option_id: first.option_id,
          option_name: first.option_name,
        };

        return winner;
      });

      const resolved = await Promise.all(winnerPromises);

      // filtra nulos e mantém ordem por categoria
      setWinners(resolved.filter(Boolean) as WinnerRow[]);
    } catch (err: any) {
      console.error("Erro ao buscar vencedores:", err);
      setErrorMessage(err?.message ?? "Erro ao buscar resultados");
      setWinners([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1>Resultados</h1>

      {loading && <p>Carregando resultados...</p>}

      {!loading && errorMessage && (
        <p className={styles.error}>{errorMessage}</p>
      )}

      {!loading && !errorMessage && winners.length === 0 && (
        <p>Nenhum resultado disponível ainda.</p>
      )}

      {!loading && !errorMessage && winners.length > 0 && (
        <div className={styles.resultsList}>
          {winners.map((winner) => (
            <div key={winner.category_id} className={styles.resultCard}>
              <h3 className={styles.categoryTitle}>
                Categoria: {winner.category_title}
              </h3>

              {/* ✅ Não mostramos quantidade de votos na nova versão */}
              <p className={styles.winnerText}>
                Vencedor: <strong>{winner.option_name}</strong>
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <button className={styles.refreshBtn} onClick={fetchWinners}>
          Atualizar
        </button>
      )}
    </div>
  );
}
