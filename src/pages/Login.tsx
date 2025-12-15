import styles from "./Login.module.css";

import {
  useState,
  useContext,
  useEffect,
  type FormEvent,
  type ChangeEvent,
} from "react";

import { SessionContext } from "../context/SessionContext";
import { supabase } from "../utils/supabase";

import { Field } from "@base-ui-components/react/field";
import { Form } from "@base-ui-components/react/form";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { CircularProgress } from "@mui/material";
import { toast, Bounce } from "react-toastify";

import { useNavigate } from "react-router-dom";
import type { FormValues, FormErrors } from "../types";

type LoginMode = "signin" | "register";
type LoginProps = { value: LoginMode };

type Profile = {
  role: "admin" | "participant" | string;
  participant_id: number | null;
};

export function Login({ value }: LoginProps) {
  const {
    handleSignIn,
    handleSignUp,
    session,
    sessionLoading,
    sessionMessage,
    sessionError,
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

  // ✅ Sincroniza modo (signin/register)
  useEffect(() => {
    setMode(value);
  }, [value]);

  // ✅ Toasts
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
    } else if (sessionError) {
      if (sessionError === "Email not confirmed") {
        toast.info(sessionError, {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          progress: undefined,
          style: { fontSize: "1.5rem" },
          transition: Bounce,
        });
      } else {
        toast.error(sessionError, {
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
    }
  }, [sessionMessage, sessionError]);

  // ✅ Redirecionamento baseado em profiles.role (não usa metadata)
  useEffect(() => {
    if (!session?.user?.id) return;

    let cancelled = false;

    async function redirectByRole() {
      if (!session) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("role, participant_id")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        // Se não existir profile, você pode decidir um fallback:
        // - mandar pro vote
        // - ou mostrar erro
        console.error("Erro ao buscar profile:", error);
        navigate("/vote");
        return;
      }

      const profile = data as Profile;

      if (profile.role === "admin") {
        navigate("/host");
      } else {
        navigate("/vote");
      }
    }

    redirectByRole();

    return () => {
      cancelled = true;
    };
  }, [session, navigate]);

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
    } else {
      await handleSignUp(
        formValues.email,
        formValues.password,
        formValues.username
      );
    }

    setFormValues({
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
    });
    setErrors({});
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

  return (
    <div className={styles.container}>
      <h1>{mode === "signin" ? "Sign In" : "Register"}</h1>

      <Form className={styles.form} onSubmit={handleSubmit}>
        {/* EMAIL */}
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
            />
          </div>
          {errors.email && <span className={styles.error}>{errors.email}</span>}
        </Field.Root>

        {/* USERNAME (apenas register) */}
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
              />
            </div>
            {errors.username && (
              <span className={styles.error}>{errors.username}</span>
            )}
          </Field.Root>
        )}

        {/* PASSWORD */}
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
            />
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleTogglePassword}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-controls="password"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && (
            <span className={styles.error}>{errors.password}</span>
          )}
        </Field.Root>

        {/* CONFIRM PASSWORD (apenas register) */}
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
              />
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleTogglePassword}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-controls="password"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className={styles.error}>{errors.confirmPassword}</span>
            )}
          </Field.Root>
        )}

        <button
          type="submit"
          className={styles.button}
          disabled={sessionLoading}
        >
          {sessionLoading ? (
            <CircularProgress
              size={24}
              thickness={4}
              sx={{
                color: "var(--primary-contrast)",
                marginLeft: "1rem",
              }}
            />
          ) : mode === "signin" ? (
            "Sign In"
          ) : (
            "Register"
          )}
        </button>
      </Form>

      {mode === "register" && (
        <button onClick={() => setMode("signin")} className={styles.info}>
          Already have an account? Click here!
        </button>
      )}
      {mode === "signin" && (
        <button onClick={() => setMode("register")} className={styles.info}>
          Don't have an account? Click here!
        </button>
      )}
    </div>
  );
}
