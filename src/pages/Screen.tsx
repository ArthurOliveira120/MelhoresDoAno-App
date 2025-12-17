import styles from "./Screen.module.css";

import { useEffect, useMemo, useState } from "react";

import type { Category, Option } from "../types";

import { Header } from "../components/Header";

import { supabase } from "../utils/supabase";

type Phase = "vote" | "results";

type SessionState = {
  id: number;
  current_category_id: number;
  phase: Phase;
};

type TopItem = {
  optionId: number;
  name: string;
  votes: number;
};

export function Screen() {
  const [phase, setPhase] = useState<Phase>("vote");
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [top3, setTop3] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryId = category?.id;

  useEffect(() => {
    void refreshAll();

    const stateChannel = supabase
      .channel("realtime-screen-session_state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_state" },
        () => {
          void refreshAll();
        }
      )
      .subscribe();

    const votesChannel = supabase
      .channel("realtime-screen-votes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes" },
        () => {
          if (!categoryId || categoryId === 0) return;
          if (phase === "results") {
            void loadTop3(categoryId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stateChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [categoryId, phase]);

  async function getSessionState(): Promise<SessionState | null> {
    const { data } = await supabase.from("session_state").select("*").single();
    return (data as SessionState) || null;
  }

  async function refreshAll() {
    setLoading(true);

    const state = await getSessionState();
    if (!state) {
      setLoading(false);
      return;
    }

    setPhase(state.phase);

    if (state.current_category_id === 0) {
      setCategory({ id: 0, title: "Esperando começar..." } as Category);
      setOptions([]);
      setTop3([]);
      setLoading(false);
      return;
    }

    const [{ data: categoryData }, { data: optionsData }] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("id", state.current_category_id)
        .single(),
      supabase
        .from("options")
        .select("*")
        .eq("category_id", state.current_category_id),
    ]);

    setCategory((categoryData as Category) || null);
    setOptions((optionsData as Option[]) || []);

    if (state.phase === "results") {
      await loadTop3(state.current_category_id);
    } else {
      setTop3([]);
    }

    setLoading(false);
  }

  async function loadTop3(currentCategoryId: number) {
    const { data: votes } = await supabase
      .from("votes")
      .select("*")
      .eq("category_id", currentCategoryId);

    const counts = new Map<number, number>();
    (votes || []).forEach((v: any) => {
      const optId = v.option_id as number;
      counts.set(optId, (counts.get(optId) || 0) + 1);
    });

    const items: TopItem[] = options.map((opt) => ({
      optionId: opt.id,
      name: opt.name,
      votes: counts.get(opt.id) || 0,
    }));

    items.sort((a, b) => b.votes - a.votes);

    setTop3(items.slice(0, 3));
  }

  function getOptionImage(optionId: number) {
    return options.find((o) => o.id === optionId)?.image || null;
  }

  const isWaiting = useMemo(() => category?.id === 0, [category?.id]);

  return (
    <div className={styles.container}>
      {isWaiting && (
        <div className={styles.centerBox}>
          <Header title="Melhores dos Anos" />
          <h3>Para poder votar, escaneie o QR Code abaixo!</h3>

          <div className={styles.qrcode}>
            <img src="/QRCodeMDA.png" alt="QR Code votação" />
            <p>Quando entrar, NÃO SAIA NEM RECARREGUE A PÁGINA</p>
          </div>
        </div>
      )}

      {!isWaiting && (
        <>
          <Header title={category?.title || "Carregando..."} />

          {loading && (
            <div className={styles.centerBox}>
              <h2>Carregando…</h2>
            </div>
          )}

          {!loading && phase === "vote" && (
            <div className={styles.panel}>
              <h2 className={styles.phaseTitle}>Votação aberta</h2>

              <ul className={styles.optionList}>
                {options.map((opt) => (
                  <li key={opt.id} className={styles.optionItem}>
                    {opt.image && (
                      <img
                        className={styles.optionImage}
                        src={opt.image}
                        alt={opt.name}
                      />
                    )}
                    <span className={styles.optionName}>{opt.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && phase === "results" && (
            <div className={styles.panel}>
              <h2 className={styles.phaseTitle}>Resultados (Top 3)</h2>

              {top3.length === 0 && (
                <div className={styles.centerBox}>
                  <p>Sem votos ainda.</p>
                </div>
              )}

              {top3.length > 0 && (
                <ol className={styles.ranking}>
                  {top3.map((item, idx) => {
                    const img = getOptionImage(item.optionId);

                    return (
                      <li key={item.optionId} className={styles.rankingItem}>
                        <div className={styles.rankLeft}>
                          <span className={styles.rankNumber}>{idx + 1}º</span>

                          {img && (
                            <img
                              className={styles.rankImage}
                              src={img}
                              alt={item.name}
                            />
                          )}

                          <span className={styles.rankName}>
                            {item.name} {idx === 0 && <span>👑</span>}
                          </span>
                        </div>

                        <span className={styles.rankVotes}>
                          {item.votes} votos
                        </span> 
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
