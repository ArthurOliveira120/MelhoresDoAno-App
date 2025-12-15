import "./styles/theme.css";
import "./styles/global.css";

import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Home } from "./pages/Home";
import { Host } from "./pages/Host";
import { Vote } from "./pages/Vote";
import { Login } from "./pages/Login";
import { Results } from "./pages/Results";
import { Screen } from "./pages/Screen";
import { SessionProvider } from "./context/SessionContext";

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Login value="register" />} />
          <Route path="/signin" element={<Login value="signin" />} />
          <Route path="/host" element={<Host />} />
          <Route path="/vote" element={<Vote />} />
          <Route path="/results" element={<Results />} />
          <Route path="/screen" element={<Screen />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
