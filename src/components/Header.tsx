import styles from "./Header.module.css";

import { useContext } from "react";
import { SessionContext } from "../context/SessionContext";

interface Props {
  title: string;
}

export function Header({ title }: Props) {
  const { session, handleSignOut } = useContext(SessionContext);

  return (
    <header className={styles.header}>
      <img src="/logo.png" className={styles.imgLogo} />
      <h1>{title}</h1>

      {session && (
        <>
          <p>Olá, {session.user.user_metadata.username}</p>
          <button
            onClick={async () => {
              await handleSignOut();
            }}
            className={styles.logoutBtn}
          >
            Log Out
          </button>
        </>
      )}
    </header>
  );
}
