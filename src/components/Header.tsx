import styles from "./Header.module.css";

interface Props {
    title: string;
}

export function Header({ title }: Props) {
  return (
    <header className={styles.header}>
      <img src="src/assets/LOGO.png" className={styles.imgLogo} />
      <h1>{title}</h1>
    </header>
  );
}
