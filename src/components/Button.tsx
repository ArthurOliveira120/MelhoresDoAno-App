import styles from "./Button.module.css";

interface Props {
  message: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ message, onClick, disabled=false }: Props) {
  return <button className={styles.button} disabled={disabled} onClick={onClick}>{message}</button>;
}
