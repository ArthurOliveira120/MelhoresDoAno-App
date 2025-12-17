import styles from "./Vote.module.css";

import { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";

import type { Category, Option } from "../types";

import { Header } from "../components/Header";
import { RadioOption } from "../components/RadioOption";
import { Button } from "../components/Button";

import { supabase } from "../utils/supabase";

export function Vote() {
  const navigate = useNavigate();
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [waitingNext, setWaintingNext] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem("participant_name");

    if (!storedName) {
      alert("Seu ID não foi encontrado, volte e coloque seu nome de novo");
      navigate("/");
      return;
    }

    fetchParticipantId(storedName);
    fetchCategoryAndOptions();

    const categoryChannel = supabase
      .channel("realtime-category")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_state" },
        () => {
          setHasVoted(false);
          setSelectedOptionId(null);
          setWaintingNext(false);
          fetchCategoryAndOptions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(categoryChannel);
    };
  }, []);

  async function fetchParticipantId(participantName: string) {
    const { data: participant } = await supabase
      .from("participants")
      .select("*")
      .eq("name", participantName.trim())
      .single();

    if (!participant) return;

    setParticipantId(participant.id);
  }

  async function fetchCategoryAndOptions() {
    const { data: state } = await supabase
      .from("session_state")
      .select("*")
      .single();

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
  }

  async function submitVote() {
    if (hasVoted || !selectedOptionId || !category || participantId === null)
      return;

    const { error } = await supabase.from("votes").insert({
      participant_id: participantId,
      category_id: category.id,
      option_id: selectedOptionId,
    });

    if (!error) {
      setHasVoted(true);
      setWaintingNext(true);
    }
  }

  return (
    <div className={styles.container}>
      <Header title={category?.title || "Carregando..."} />
      {category?.id === 0 && (
        <div className={styles.waitingBox}>
          <h1>Esperando começar...</h1>
          <p>Assim que todos entrarem, a categoria vai aparecer aqui</p>
        </div>
      )}

      {category?.id !== 0 && (
        <>
          <div className={styles.form}>
            {!waitingNext && (
              <div className={styles.optionsContainer}>
                {options.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => !hasVoted && setSelectedOptionId(option.id)}
                    style={{
                      cursor: hasVoted ? "default" : "pointer",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      padding: 10,
                      borderRadius: 12,
                    }}
                  >
                    {option.image && (
                      <img
                        src={option.image}
                        alt={option.name}
                        style={{
                          width: 72,
                          height: 72,
                          objectFit: "cover",
                          borderRadius: 12,
                        }}
                      />
                    )}

                    <RadioOption
                      id={option.id}
                      label={option.name}
                      name="voteOption"
                      disabled={hasVoted}
                      checked={selectedOptionId === option.id}
                      onChange={() => setSelectedOptionId(option.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            {waitingNext && (
              <div className={styles.waitingBox}>
                <h2>Seu voto foi registrado</h2>
                <p>Aguardando todos terminarem de votar...</p>
              </div>
            )}

            {!waitingNext && (
              <Button
                onClick={submitVote}
                disabled={!selectedOptionId || hasVoted}
                message="Enviar voto"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
