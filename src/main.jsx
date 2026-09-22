
import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import DeveloperUsage from "./components/DeveloperUsage.jsx";

import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const currentPath =
  window.location.pathname.replace(/\/+$/, "") || "/";

const isDeveloperUsagePage =
  currentPath === "/developer/usage";

createRoot(rootElement).render(
  <React.StrictMode>
    {isDeveloperUsagePage ? (
      <DeveloperUsage />
    ) : (
      <App />
    )}
  </React.StrictMode>
);