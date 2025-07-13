import styles from "./Home.module.css";

import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { supabase } from "../../utils/supabase";

export function Home() {
  const [participantName, setParticipantName] = useState("");
  const navigate = useNavigate();

  async function insertParticipant() {
    const { data: existing } = await supabase
      .from("participants")
      .select("*")
      .eq("name", participantName)
      .single();

    if (existing) {
      alert("Já tem alguém com esse nome, tenta outro man");
    } else {
      await supabase
        .from("participants")
        .insert({ name: participantName });

    localStorage.setItem("participant_name", participantName);
    navigate("/vote");
    }
  }

  return (
    <div className={styles.container}>
      <h1>Melhores do Ano da TJA</h1>
      <h5>Preencha com seu nome: </h5>
      <input
        type="text"
        value={participantName}
        onChange={(event) => {
          setParticipantName(event.target.value);
        }}
      />
      <button onClick={insertParticipant}>Iniciar</button>
    </div>
  );
}
