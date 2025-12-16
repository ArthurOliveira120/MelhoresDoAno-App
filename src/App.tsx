import "./styles/theme.css";
import "./styles/global.css";

import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Home } from "./pages/Home";
import { Host } from "./pages/Host";
import { Vote } from "./pages/Vote";
import { Screen } from "./pages/Screen";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<Host />} />
        <Route path="/vote" element={<Vote />} />
        <Route path="/screen" element={<Screen />} />
      </Routes>
    </BrowserRouter>
  );
}
