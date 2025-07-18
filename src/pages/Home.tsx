import styles from "./Home.module.css";

import { useState } from "react";

import { Header } from "../components/Header";
import { Button } from "../components/Button";

import { useNavigate } from "react-router-dom";

import { supabase } from "../../utils/supabase";

export function Home() {
  const [participantName, setParticipantName] = useState("");
  const navigate = useNavigate();

  async function insertParticipant() {
    if (!participantName || participantName === "") return;

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
    <>
      <Header title="Melhores do Ano"></Header>
      <div className={styles.container}>
        <label><b>Preencha com seu nome</b></label>
        <input
          type="text"
          value={participantName}
          onChange={(event) => {
            setParticipantName(event.target.value);
          }}
        />
        <Button message="Iniciar" onClick={insertParticipant}></Button>
      </div>
    </>
  );
}
