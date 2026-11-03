import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import BrowserPage from "./pages/BrowserPage";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserPage />
  </React.StrictMode>,
);
