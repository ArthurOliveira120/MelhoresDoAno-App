import styles from "./Login.module.css";

import {
  useState,
  useContext,
  useEffect,
  type FormEvent,
  type ChangeEvent,
} from "react";

import { SessionContext } from "../context/SessionContext";

import { Field } from "@base-ui-components/react/field";
import { Form } from "@base-ui-components/react/form";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { CircularProgress } from "@mui/material";
import { toast, Bounce } from "react-toastify";

import { useNavigate } from "react-router-dom";
import type { FormValues, FormErrors } from "../types";

type LoginMode = "signin" | "register";
type LoginProps = { value: LoginMode };

export function Login({ value }: LoginProps) {
  const {
    handleSignIn,
    handleSignUp,
    session,
    sessionLoading,
    sessionMessage,
    sessionError,
    profile,
    isAdmin,
  } = useContext(SessionContext);

  const navigate = useNavigate();

  const [errors, setErrors] = useState<FormErrors>({});
  const [mode, setMode] = useState<LoginMode>(value);
  const [showPassword, setShowPassword] = useState(false);

  const [formValues, setFormValues] = useState<FormValues>({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
  });

  useEffect(() => {
    setMode(value);
  }, [value]);

  // Toasts
  useEffect(() => {
    if (sessionMessage) {
      toast.success(sessionMessage, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        progress: undefined,
        style: { fontSize: "1.5rem" },
        transition: Bounce,
      });
      return;
    }

    if (sessionError) {
      const fn = sessionError === "Email not confirmed" ? toast.info : toast.error;
      fn(sessionError, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        progress: undefined,
        style: { fontSize: "1.5rem" },
        transition: Bounce,
      });
    }
  }, [sessionMessage, sessionError]);

  // ✅ Redireciona APENAS quando: não está carregando + tem sessão + tem profile
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) return;
    if (!profile) return;

    if (isAdmin) navigate("/host");
    else navigate("/vote");
  }, [sessionLoading, session, profile, isAdmin, navigate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const newErrors: FormErrors = {};
    if (!formValues.email) newErrors.email = "Email is required";
    if (!formValues.password) newErrors.password = "Password is required";

    if (mode === "register") {
      if (!formValues.username) newErrors.username = "Username is required";
      if (!formValues.confirmPassword)
        newErrors.confirmPassword = "Confirm Password is required";

      if (
        formValues.password &&
        formValues.confirmPassword &&
        formValues.password !== formValues.confirmPassword
      ) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (mode === "signin") {
      await handleSignIn(formValues.email, formValues.password);

      // mantém email pra facilitar retry
      setFormValues((prev) => ({
        ...prev,
        password: "",
      }));
    } else {
      await handleSignUp(formValues.email, formValues.password, formValues.username);

      // no cadastro, limpa tudo
      setFormValues({
        email: "",
        password: "",
        confirmPassword: "",
        username: "",
      });
    }

    setShowPassword(false);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  const handleTogglePassword = () => setShowPassword((show) => !show);

  // ✅ se tem sessão mas profile ainda não chegou, mostra loading “decente”
  const showProfileLoading = !!session && !profile && sessionLoading;

  return (
    <div className={styles.container}>
      <h1>{mode === "signin" ? "Sign In" : "Register"}</h1>

      {showProfileLoading && (
        <p className={styles.info}>Carregando perfil…</p>
      )}

      <Form className={styles.form} onSubmit={handleSubmit}>
        <Field.Root name="email" className={styles.field}>
          <Field.Label className={styles.label}>Email</Field.Label>
          <div className={styles.inputWrapper}>
            <Field.Control
              type="email"
              name="email"
              required
              value={formValues.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              className={styles.input}
              disabled={sessionLoading}
            />
          </div>
          {errors.email && <span className={styles.error}>{errors.email}</span>}
        </Field.Root>

        {mode === "register" && (
          <Field.Root name="username" className={styles.field}>
            <Field.Label className={styles.label}>Username</Field.Label>
            <div className={styles.inputWrapper}>
              <Field.Control
                type="text"
                name="username"
                required
                value={formValues.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                className={styles.input}
                disabled={sessionLoading}
              />
            </div>
            {errors.username && (
              <span className={styles.error}>{errors.username}</span>
            )}
          </Field.Root>
        )}

        <Field.Root name="password" className={styles.field}>
          <Field.Label className={styles.label}>Password</Field.Label>
          <div className={styles.inputWrapper}>
            <Field.Control
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              required
              value={formValues.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              className={styles.input}
              disabled={sessionLoading}
            />
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleTogglePassword}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-controls="password"
              disabled={sessionLoading}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && (
            <span className={styles.error}>{errors.password}</span>
          )}
        </Field.Root>

        {mode === "register" && (
          <Field.Root name="confirmPassword" className={styles.field}>
            <Field.Label className={styles.label}>Confirm Password</Field.Label>
            <div className={styles.inputWrapper}>
              <Field.Control
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                required
                value={formValues.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                className={styles.input}
                disabled={sessionLoading}
              />
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleTogglePassword}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-controls="password"
                disabled={sessionLoading}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className={styles.error}>{errors.confirmPassword}</span>
            )}
          </Field.Root>
        )}

        <button type="submit" className={styles.button} disabled={sessionLoading}>
          {sessionLoading ? (
            <CircularProgress
              size={24}
              thickness={4}
              sx={{ color: "var(--primary-contrast)", marginLeft: "1rem" }}
            />
          ) : mode === "signin" ? (
            "Sign In"
          ) : (
            "Register"
          )}
        </button>
      </Form>

      {mode === "register" && (
        <button onClick={() => setMode("signin")} className={styles.info} disabled={sessionLoading}>
          Already have an account? Click here!
        </button>
      )}

      {mode === "signin" && (
        <button onClick={() => setMode("register")} className={styles.info} disabled={sessionLoading}>
          Don't have an account? Click here!
        </button>
      )}
    </div>
  );
}
