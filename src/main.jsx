
import React from "react";
import { createRoot } from "react-dom/client";

const App = React.lazy(() => import("./App.jsx"));
const DeveloperUsage = React.lazy(() => import("./components/DeveloperUsage.jsx"));

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
    <React.Suspense fallback={<div role="status" style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>Loading Magnemite…</div>}>
      {isDeveloperUsagePage ? <DeveloperUsage /> : <App />}
    </React.Suspense>
  </React.StrictMode>
);