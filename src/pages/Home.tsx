import styles from "./Home.module.css";

import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { useNavigate } from "react-router-dom";

export function Home() {
  const navigate = useNavigate();

  return (
    <>
      <Header title="Melhores dos Anos"></Header>
      <div className={styles.container}>
        <div>
          <h1>Bem vindo aos Melhores dos Anos!</h1>
        </div>
        <Button message="Começar" onClick={() => navigate("/signin")}></Button>
      </div>
    </>
  );
}
