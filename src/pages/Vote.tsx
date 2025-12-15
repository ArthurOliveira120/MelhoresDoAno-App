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

type ProfileRow = {
  role: "admin" | "participant" | string;
  participant_id: number | null;
};

export function Vote() {
  const navigate = useNavigate();

  const { session } = useContext(SessionContext);

  const [participantId, setParticipantId] = useState<number | null>(null);

  const [state, setState] = useState<SessionStateRow | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);

  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [waitingNext, setWaitingNext] = useState(false);

  const phase = state?.phase ?? (category?.id === 0 ? "lobby" : "voting");

  // ✅ Se não estiver logado, manda pro signin
  useEffect(() => {
    if (!session) {
      navigate("/signin");
    }
  }, [session, navigate]);

  // ✅ Pega participant_id do profiles (não usa localStorage, não usa participants)
  useEffect(() => {
    if (!session?.user?.id) return;

    let cancelled = false;

    async function loadProfile() {
      if (!session) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("role, participant_id")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        console.error("Vote: erro ao buscar profile:", error);
        // fallback: manda pro login
        navigate("/signin");
        return;
      }

      const profile = data as ProfileRow;

      // Se alguém cair aqui como admin, manda pro host
      if (profile.role === "admin") {
        navigate("/host");
        return;
      }

      if (!profile.participant_id) {
        console.error("Vote: participant_id vazio no profile.");
        // você pode decidir outra rota, mas aqui é melhor voltar pro login
        navigate("/signin");
        return;
      }

      setParticipantId(profile.participant_id);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session, navigate]);

  // ✅ Carrega estado + categoria + opções e assina realtime apenas do session_state
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const s = await fetchSessionState();
      if (cancelled) return;
      if (!s) return;

      setState(s);
      await loadCategoryAndOptions(s.current_category_id);

      // reset de UI
      setHasVoted(false);
      setSelectedOptionId(null);
      setWaitingNext(false);
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
          await loadCategoryAndOptions(s.current_category_id);

          // Quando muda categoria/fase, “reseta” a tela do participante
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
  }, []);

  async function fetchSessionState() {
    const { data, error } = await supabase
      .from("session_state")
      .select("id, current_category_id, locked, phase")
      .single();

    if (error) {
      console.error("Vote: erro ao buscar session_state:", error);
      return null;
    }

    return data as SessionStateRow;
  }

  async function loadCategoryAndOptions(categoryId: number) {
    const [{ data: categoryData, error: categoryErr }, { data: optionsData, error: optionsErr }] =
      await Promise.all([
        supabase.from("categories").select("*").eq("id", categoryId).single(),
        supabase.from("options").select("*").eq("category_id", categoryId),
      ]);

    if (categoryErr) console.error("Vote: erro ao buscar categoria:", categoryErr);
    if (optionsErr) console.error("Vote: erro ao buscar opções:", optionsErr);

    setCategory((categoryData as Category) ?? null);
    setOptions((optionsData as Option[]) ?? []);
  }

  async function submitVote() {
    // regras básicas do front (o RLS é a regra real)
    if (!session) return;
    if (hasVoted || waitingNext) return;
    if (!selectedOptionId || !category) return;
    if (!participantId) return;
    if (phase !== "voting") return;
    if (state?.locked) return;

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

    // ✅ Se você criou UNIQUE(participant_id, category_id),
    // quando tentar votar duas vezes vai cair aqui.
    // Postgres duplicate key -> code "23505"
    if ((error as any)?.code === "23505") {
      setHasVoted(true);
      setWaitingNext(true);
      return;
    }

    console.error("Vote: erro ao votar:", error);
    alert("Deu algum erro, tenta de novo.");
  }

  // telas de estado
  const isLobby = phase === "lobby" || category?.id === 0;
  const isVoting = phase === "voting" && category?.id !== 0;
  const isResults = phase === "results";

  return (
    <div className={styles.container}>
      {/* LOBBY */}
      {isLobby && (
        <div className={styles.centerBox}>
          <h1>Esperando começar…</h1>
          <p>Assim que o host iniciar, a categoria vai aparecer aqui.</p>
        </div>
      )}

      {/* RESULTS */}
      {isResults && (
        <div className={styles.centerBox}>
          <h1>Resultados</h1>
          <p>
            Os resultados estão sendo exibidos na tela principal. Aguarde a próxima
            categoria 😊
          </p>
        </div>
      )}

      {/* VOTING */}
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
                phase !== "voting"
              }
              message={state?.locked ? "Votação bloqueada" : "Enviar voto"}
            />
          </div>
        </>
      )}
    </div>
  );
}
