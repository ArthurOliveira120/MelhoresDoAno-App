import "./styles/theme.css";
import "./styles/global.css";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";

import { Home } from "./pages/Home";
import { Host } from "./pages/Host";
import { Vote } from "./pages/Vote";
import { Login } from "./pages/Login";
import { Results } from "./pages/Results";
import { Screen } from "./pages/Screen";

import { SessionProvider, SessionContext } from "./context/SessionContext";

import type { ReactNode } from "react";

type Props = { children: ReactNode };

function FullscreenLoading({ text = "Carregando…" }: { text?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2>{text}</h2>
    </div>
  );
}

function PublicOnly({ children }:Props) {
  const { session, profile, isAdmin, sessionLoading } = useContext(SessionContext);

  // enquanto carrega sessão/perfil, não decide redirect ainda
  if (sessionLoading) return <FullscreenLoading text="Carregando sessão…" />;

  // se não tem sessão, deixa acessar login/register
  if (!session) return children;

  // tem sessão, mas profile ainda não chegou → espera
  if (!profile) return <FullscreenLoading text="Carregando perfil…" />;

  // tem sessão e profile → manda direto pro destino certo
  return <Navigate to={isAdmin ? "/host" : "/vote"} replace />;
}

function RequireAuth({ children }:Props) {
  const { session, sessionLoading } = useContext(SessionContext);

  if (sessionLoading) return <FullscreenLoading text="Carregando sessão…" />;

  if (!session) return <Navigate to="/signin" replace />;

  return children;
}

function RequireAdmin({ children }:Props) {
  const { session, profile, isAdmin, sessionLoading } = useContext(SessionContext);

  if (sessionLoading) return <FullscreenLoading text="Carregando…" />;

  if (!session) return <Navigate to="/signin" replace />;

  // espera o profile carregar (evita “piscar”)
  if (!profile) return <FullscreenLoading text="Carregando perfil…" />;

  if (!isAdmin) return <Navigate to="/vote" replace />;

  return children;
}

function RequireParticipant({ children }:Props) {
  const { session, profile, isAdmin, sessionLoading } = useContext(SessionContext);

  if (sessionLoading) return <FullscreenLoading text="Carregando…" />;

  if (!session) return <Navigate to="/signin" replace />;

  if (!profile) return <FullscreenLoading text="Carregando perfil…" />;

  // se for admin e tentar acessar vote, manda pro host
  if (isAdmin) return <Navigate to="/host" replace />;

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          {/* Home continua pública (você decide no botão "Começar") */}
          <Route path="/" element={<Home />} />

          {/* Login/Register: se já estiver logado, manda pro lugar certo */}
          <Route
            path="/register"
            element={
              <PublicOnly>
                <Login value="register" />
              </PublicOnly>
            }
          />
          <Route
            path="/signin"
            element={
              <PublicOnly>
                <Login value="signin" />
              </PublicOnly>
            }
          />

          {/* Rotas protegidas */}
          <Route
            path="/host"
            element={
              <RequireAdmin>
                <Host />
              </RequireAdmin>
            }
          />
          <Route
            path="/vote"
            element={
              <RequireParticipant>
                <Vote />
              </RequireParticipant>
            }
          />
          <Route
            path="/results"
            element={
              <RequireAuth>
                <Results />
              </RequireAuth>
            }
          />

          {/* Screen é pública pra TV (não precisa login) */}
          <Route path="/screen" element={<Screen />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
