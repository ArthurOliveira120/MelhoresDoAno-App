import styles from "./Vote.module.css";

import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";

import type { Category, Option } from "../types";

import { Header } from "../components/Header";
import { RadioOption } from "../components/RadioOption";
import { Button } from "../components/Button";

import { supabase } from "../utils/supabase";
import { SessionContext } from "../context/SessionContext";

type SessionStateRow = {
  id: number;
  current_category_id: number;
  locked: boolean;
  phase?: "lobby" | "voting" | "results" | string;
};

export function Vote() {
  const navigate = useNavigate();
  const { session, participantId, isAdmin } = useContext(SessionContext);

  const [state, setState] = useState<SessionStateRow | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);

  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [waitingNext, setWaitingNext] = useState(false);

  const [loading, setLoading] = useState(true);

  // ✅ fase mais confiável: primeiro pelo state, senão pelo category_id
  const effectivePhase =
    state?.phase ??
    (state?.current_category_id === 0 ? "lobby" : category?.id === 0 ? "lobby" : "voting");

  const isLobby = effectivePhase === "lobby" || state?.current_category_id === 0;
  const isVoting = effectivePhase === "voting" && (state?.current_category_id ?? 0) !== 0;
  const isResults = effectivePhase === "results";

  // ✅ protege rota: sem sessão -> signin
  useEffect(() => {
    if (!session) {
      navigate("/signin");
    }
  }, [session, navigate]);

  // ✅ admin não vota
  useEffect(() => {
    if (!session) return;
    if (isAdmin) navigate("/host");
  }, [session, isAdmin, navigate]);

  useEffect(() => {
    // só inicializa de verdade quando há sessão e não é admin
    if (!session) return;
    if (isAdmin) return;

    let cancelled = false;

    async function init() {
      setLoading(true);

      const s = await fetchSessionState();
      if (cancelled) return;

      if (!s) {
        setState(null);
        setCategory(null);
        setOptions([]);
        setLoading(false);
        return;
      }

      setState(s);

      // ✅ se for lobby (categoria 0), não tenta buscar categories/options
      if (s.current_category_id === 0) {
        setCategory({ id: 0, title: "Waiting", order: 0 });
        setOptions([]);
      } else {
        await loadCategoryAndOptions(s.current_category_id);
      }

      setHasVoted(false);
      setSelectedOptionId(null);
      setWaitingNext(false);

      setLoading(false);
    }

    init();

    const channel = supabase
      .channel("realtime-vote-session-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_state" },
        async () => {
          const s = await fetchSessionState();
          if (cancelled) return;
          if (!s) return;

          setState(s);

          if (s.current_category_id === 0) {
            setCategory({ id: 0, title: "Waiting", order: 0 });
            setOptions([]);
          } else {
            await loadCategoryAndOptions(s.current_category_id);
          }

          setHasVoted(false);
          setSelectedOptionId(null);
          setWaitingNext(false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session, isAdmin]);

  // ✅ MESMA correção do Host: pegar “a primeira linha”, não single()
  async function fetchSessionState() {
    const { data, error } = await supabase
      .from("session_state")
      .select("id, current_category_id, locked, phase")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Vote: erro ao buscar session_state:", error);
      return null;
    }

    return (data ?? null) as SessionStateRow | null;
  }

  async function loadCategoryAndOptions(categoryId: number) {
    const [
      { data: categoryData, error: categoryErr },
      { data: optionsData, error: optionsErr },
    ] = await Promise.all([
      supabase.from("categories").select("*").eq("id", categoryId).maybeSingle(),
      supabase.from("options").select("*").eq("category_id", categoryId),
    ]);

    if (categoryErr) console.error("Vote: erro ao buscar categoria:", categoryErr);
    if (optionsErr) console.error("Vote: erro ao buscar opções:", optionsErr);

    setCategory((categoryData as Category) ?? null);
    setOptions((optionsData as Option[]) ?? []);
  }

  async function submitVote() {
    if (!session) return;
    if (!participantId) return; // ainda carregando profile
    if (hasVoted || waitingNext) return;
    if (!selectedOptionId || !category) return;
    if (!state) return;
    if (effectivePhase !== "voting") return;
    if (state.locked) return;

    const { error } = await supabase.from("votes").insert({
      participant_id: participantId,
      category_id: category.id,
      option_id: selectedOptionId,
    });

    if (!error) {
      setHasVoted(true);
      setWaitingNext(true);
      return;
    }

    // ✅ se já votou (unique constraint), a gente só trata como “já foi”
    if ((error as any)?.code === "23505") {
      setHasVoted(true);
      setWaitingNext(true);
      return;
    }

    console.error("Vote: erro ao votar:", error);
    alert("Deu algum erro, tenta de novo.");
  }

  // loading global (evita tela “vazia” quando dá refresh)
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerBox}>
          <h1>Carregando…</h1>
          <p>Preparando sua sessão de votação.</p>
        </div>
      </div>
    );
  }

  // se tem sessão mas ainda não tem participantId (profile ainda criando)
  if (session && !isAdmin && !participantId) {
    return (
      <div className={styles.container}>
        <div className={styles.centerBox}>
          <h1>Carregando…</h1>
          <p>Preparando seu perfil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {isLobby && (
        <div className={styles.centerBox}>
          <h1>Esperando começar…</h1>
          <p>Assim que o host iniciar, a categoria vai aparecer aqui.</p>
        </div>
      )}

      {isResults && (
        <div className={styles.centerBox}>
          <h1>Resultados</h1>
          <p>Os resultados estão na tela principal. Aguarde a próxima categoria 😊</p>
        </div>
      )}

      {isVoting && (
        <>
          <Header title={category?.title || "Carregando…"} />

          <div className={styles.form}>
            {!waitingNext && (
              <div className={styles.optionsContainer}>
                {options.map((option) => (
                  <RadioOption
                    key={option.id}
                    id={option.id}
                    label={option.name}
                    name="voteOption"
                    disabled={hasVoted || !!state?.locked}
                    checked={selectedOptionId === option.id}
                    onChange={() => setSelectedOptionId(option.id)}
                  />
                ))}
              </div>
            )}

            {waitingNext && (
              <div className={styles.waitingBox}>
                <h2>Seu voto foi registrado ✅</h2>
                <p>Aguardando o host avançar para a próxima etapa.</p>
              </div>
            )}

            <Button
              onClick={submitVote}
              disabled={
                !selectedOptionId ||
                hasVoted ||
                waitingNext ||
                !!state?.locked ||
                effectivePhase !== "voting"
              }
              message={state?.locked ? "Votação bloqueada" : "Enviar voto"}
            />
          </div>
        </>
      )}
    </div>
  );
}
