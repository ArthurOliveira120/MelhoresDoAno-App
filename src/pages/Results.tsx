import styles from "./Results.module.css";

import { useState, useEffect } from "react";
import type { Winner } from "../types";
import { supabase } from "../../utils/supabase";

export function Results() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWinners() {
      setLoading(true);

      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("category_id, option_id");

      const { data: options, error: optionsError } = await supabase
        .from("options")
        .select("id, category_id, name");

      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, title");

      if (votesError || optionsError || categoriesError) {
        console.error(
          "Erro ao buscar dados: ",
          votesError || optionsError || categoriesError
        );
        setLoading(false);
        return;
      }

      const voteMap = new Map<string, number>();
      votes?.forEach((vote) => {
        const key = `${vote.category_id}-${vote.option_id}`;
        voteMap.set(key, (voteMap.get(key) || 0) + 1);
      });

      const categoryWinners = new Map<number, Winner>();
      voteMap.forEach((count, key) => {
        const [categoryIdStr, optionIdStr] = key.split("-");
        const category_id = Number(categoryIdStr);
        const option_id = Number(optionIdStr);

        const option = options?.find((opt) => opt.id === option_id);
        const category = categories?.find((cat) => cat.id === category_id);
        if (!option) return;

        const current = categoryWinners.get(category_id);
        if (!current || count > current.vote_count) {
          categoryWinners.set(category_id, {
            category_id,
            category_title: category?.title,
            option_id,
            option_name: option.name,
            vote_count: count,
          });
        }
      });

      setWinners(Array.from(categoryWinners.values()));
      setLoading(false);
    }

    fetchWinners();
  }, []);

  return (
    <div className={styles.container}>
      <h1>Resultados: </h1>
      {loading && <p>Carregando resultados...</p>}

      {!loading && winners.length === 0 && <p>Nenhum voto encontrado</p>}

      {!loading &&
        winners.map((winner) => (
          <div key={winner.category_id}>
            <h3>Categoria: {winner.category_title}</h3>
            <p>
              Vencedor: <strong>{winner.option_name}</strong> com{" "}
              {winner.vote_count} votos
            </p>
          </div>
        ))}
    </div>
  );
}
