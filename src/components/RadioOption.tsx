import styles from "./RadioOption.module.css";

type Props = {
  id: number;
  label: string;
  name: string;
  disabled?: boolean;
  checked: boolean;
  onChange: () => void;
};

export function RadioOption({
  id,
  label,
  name,
  disabled = false,
  checked,
  onChange,
}: Props) {
  return (
    <label className={styles.label}>
      <input
        type="radio"
        name={name}
        value={id}
        disabled={disabled}
        checked={checked}
        onChange={onChange}
      />
      <span className={styles.customRadio}>{label}</span>
    </label>
  );
}
