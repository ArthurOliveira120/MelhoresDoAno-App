import styles from "./Host.module.css";

import type { Option, Category } from "../types";

import { useEffect, useState } from "react";

import { supabase } from "../../utils/supabase";

export function Host() {
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [votesCount, setVotesCount] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [canAdvance, setCanAdvance] = useState(false);

  //Buscar estado da sessão ao carregar
  useEffect(() => {
    loadSessionAndVotes();
  }, []);

  useEffect(() => {
    const voteChannel = supabase
      .channel("realtime-votes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes" },
        async () => {
          const state = await getSessionState();
          if (!state) return;
          updateVotes(state.current_category_id);
        }
      )
      .subscribe();

    const participantChannel = supabase
      .channel("realtime-participants")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants" },
        async () => {
          const state = await getSessionState();
          if (!state) return;
          updateVotes(state.current_category_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(voteChannel);
      supabase.removeChannel(participantChannel);
    };
  }, [category]);

  async function loadSessionAndVotes() {
    const state = await getSessionState();

    if (!state) return;

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

    setCategory(categoryData);
    setOptions(optionsData || []);

    updateVotes(state.current_category_id);
  }

  async function getSessionState() {
    const { data } = await supabase.from("session_state").select("*").single();
    return data;
  }

  async function updateVotes(categoryId?: number) {
    const id = categoryId || category?.id;

    if (!id) return;

    const [{ data: votes }, { data: participants }] = await Promise.all([
      supabase.from("votes").select("*").eq("category_id", id),
      supabase.from("participants").select("*"),
    ]);

    setVotesCount(votes?.length || 0);
    setTotalParticipants(participants?.length || 0);
    setCanAdvance((votes?.length || 0) === (participants?.length || 0));
  }

  async function advanceCategory(force = false) {
    const { data: allCategories } = await supabase
      .from("categories")
      .select("*");

    if (!allCategories) return;

    const index = allCategories.findIndex((c) => c.id === category?.id);
    const next = allCategories[index + 1];

    if (next || force) {
      await supabase
        .from("session_state")
        .update({
          current_category_id: next.id,
          locked: false,
        })
        .eq("id", 1);

      loadSessionAndVotes();
    }
  }

  async function resetCategoryId() {
    await supabase
      .from("session_state")
      .update({
        current_category_id: 1,
        locked: false,
      })
      .eq("id", 1);
    loadSessionAndVotes();
  }

  async function clearParticipants() {
    await supabase.from("votes").delete().neq("id", 0);
    await supabase.from("participants").delete().neq("id", 0);
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.mainTitle}>Host - Current Category</h1>

      {category && (
        <>
          <h2 className={styles.categoryTitle}>{category.title}</h2>
          <ul>
            {options.map((opt) => (
              <li key={opt.id}>{opt.name}</li>
            ))}
          </ul>
          <p>
            votes: {votesCount} / {totalParticipants}
          </p>
          <button
            className={styles.nextButton}
            disabled={!canAdvance}
            onClick={() => advanceCategory()}
          >
            Next category
          </button>
          <button onClick={resetCategoryId}>reset</button>
          <button onClick={() => advanceCategory(true)}>force advance</button>
          <button onClick={clearParticipants}>clear participants</button>
        </>
      )}
    </div>
  );
}
