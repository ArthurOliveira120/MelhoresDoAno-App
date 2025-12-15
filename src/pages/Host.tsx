import styles from "./Host.module.css";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";

import type { Category, Option } from "../types";
import { Button } from "../components/Button";

type SessionStateRow = {
  id: number;
  current_category_id: number;
  locked: boolean;
  phase: "lobby" | "voting" | "results" | string;
  updated_at?: string;
};

type VoteProgress = {
  voted_count: number;
  total_participants: number;
};

export function Host() {
  const [state, setState] = useState<SessionStateRow | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [progress, setProgress] = useState<VoteProgress>({
    voted_count: 0,
    total_participants: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const canAdvance = useMemo(() => {
    // Você pode decidir se permite avanço só quando estiver em "voting"
    if (!state) return false;
    if (state.phase !== "voting") return false;

    return progress.total_participants > 0 &&
      progress.voted_count === progress.total_participants;
  }, [state, progress]);

  useEffect(() => {
    loadAll();

    // ✅ O Host agora ouve só o "session_state"
    const sessionChannel = supabase
      .channel("realtime-session-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_state" },
        () => {
          loadAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);

    const s = await getSessionState();
    if (!s) {
      setLoading(false);
      return;
    }

    setState(s);

    await Promise.all([
      loadCategoryAndOptions(s.current_category_id),
      loadVoteProgress(s.current_category_id),
    ]);

    setLoading(false);
  }

  async function getSessionState() {
    const { data, error } = await supabase
      .from("session_state")
      .select("id, current_category_id, locked, phase, updated_at")
      .single();

    if (error) {
      console.error("Erro ao buscar session_state:", error);
      return null;
    }

    return data as SessionStateRow;
  }

  async function loadCategoryAndOptions(categoryId: number) {
    const [{ data: categoryData, error: catErr }, { data: optionsData, error: optErr }] =
      await Promise.all([
        supabase.from("categories").select("*").eq("id", categoryId).single(),
        supabase.from("options").select("*").eq("category_id", categoryId),
      ]);

    if (catErr) console.error("Erro ao buscar categoria:", catErr);
    if (optErr) console.error("Erro ao buscar opções:", optErr);

    setCategory((categoryData as Category) ?? null);
    setOptions((optionsData as Option[]) ?? []);
  }

  // ✅ Sem SELECT em votes/participants (agora é RPC)
  async function loadVoteProgress(categoryId: number) {
    const { data, error } = await supabase.rpc("get_vote_progress", {
      category_id_param: categoryId,
    });

    if (error) {
      console.error("Erro ao buscar progresso:", error);
      // Se der erro, zera para não permitir avanço indevido
      setProgress({ voted_count: 0, total_participants: 0 });
      return;
    }

    // Esperado: { voted_count: number, total_participants: number }
    setProgress(data as VoteProgress);
  }

  async function advanceCategory(force = false) {
    try {
      setActionLoading(true);

      const { error } = await supabase.rpc("advance_category", { force });

      if (error) throw error;

      // loadAll() será chamado pelo realtime do session_state
    } catch (err: any) {
      alert(err?.message ?? "Erro ao avançar categoria");
    } finally {
      setActionLoading(false);
    }
  }

  async function goToResults() {
    // opcional: muda a fase para results sem trocar categoria
    if (!state) return;

    try {
      setActionLoading(true);

      const { error } = await supabase
        .from("session_state")
        .update({ phase: "results", locked: true })
        .eq("id", state.id);

      if (error) throw error;
    } catch (err: any) {
      alert(err?.message ?? "Erro ao ir para resultados");
    } finally {
      setActionLoading(false);
    }
  }

  async function goToVoting() {
    if (!state) return;

    try {
      setActionLoading(true);

      const { error } = await supabase
        .from("session_state")
        .update({ phase: "voting", locked: false })
        .eq("id", state.id);

      if (error) throw error;
    } catch (err: any) {
      alert(err?.message ?? "Erro ao abrir votação");
    } finally {
      setActionLoading(false);
    }
  }

  async function resetToLobby() {
    if (!state) return;

    try {
      setActionLoading(true);

      const { error } = await supabase
        .from("session_state")
        .update({ current_category_id: 0, phase: "lobby", locked: false })
        .eq("id", state.id);

      if (error) throw error;
    } catch (err: any) {
      alert(err?.message ?? "Erro ao resetar");
    } finally {
      setActionLoading(false);
    }
  }

  async function clearAll() {
    // ✅ em vez de deletar votes/participants do client, vira RPC admin
    const ok = confirm("Tem certeza que deseja apagar votos e participantes?");
    if (!ok) return;

    try {
      setActionLoading(true);

      const { error } = await supabase.rpc("admin_clear_all");

      if (error) throw error;

      // também volta pra lobby
      await resetToLobby();
    } catch (err: any) {
      alert(err?.message ?? "Erro ao limpar dados");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {category && (
        <>
          <h1>{category.title}</h1>

          <ul>
            {options.map((opt) => (
              <li key={opt.id}>{opt.name}</li>
            ))}
          </ul>

          {/* ✅ Host pode ver o progresso, mas via RPC (não expondo votes no client) */}
          <p>
            Progresso: {progress.voted_count} / {progress.total_participants}
          </p>

          <p>
            Estado: <strong>{state?.phase}</strong> {state?.locked ? "(locked)" : ""}
          </p>

          <div className={styles.hostButtons}>
            <Button
              message="Abrir votação"
              onClick={goToVoting}
              disabled={actionLoading || state?.phase === "voting"}
            />
            <Button
              message="Mostrar resultados"
              onClick={goToResults}
              disabled={actionLoading || state?.phase === "results"}
            />
            <Button
              message="Next"
              onClick={() => advanceCategory(false)}
              disabled={actionLoading || !canAdvance}
            />
            <Button
              message="Force advance"
              onClick={() => advanceCategory(true)}
              disabled={actionLoading}
            />
            <Button
              message="Reset (Lobby)"
              onClick={resetToLobby}
              disabled={actionLoading}
            />
            <Button
              message="Clear"
              onClick={clearAll}
              disabled={actionLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
