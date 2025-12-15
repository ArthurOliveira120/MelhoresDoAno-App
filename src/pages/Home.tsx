import styles from "./Home.module.css";

import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { useNavigate } from "react-router-dom";
import { SessionContext } from "../context/SessionContext";
import { useContext } from "react";

export function Home() {
  const { session, profile, sessionLoading } = useContext(SessionContext);
  const navigate = useNavigate();

  function handleStart() {
    // evita clique enquanto ainda está carregando a sessão/profile
    if (sessionLoading) return;

    if (!session) {
      navigate("/signin");
      return;
    }

    if (profile?.is_admin) {
      navigate("/host");
    } else {
      navigate("/vote");
    }
  }

  return (
    <>
      <Header title="Melhores dos Anos" />
      <div className={styles.container}>
        <div>
          <h1>Bem vindo aos Melhores dos Anos!</h1>
        </div>

        <Button
          message={sessionLoading ? "Carregando..." : "Começar"}
          onClick={handleStart}
          disabled={sessionLoading}
        />
      </div>
    </>
  );
}