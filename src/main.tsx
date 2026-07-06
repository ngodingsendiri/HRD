import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import { registerSW } from "virtual:pwa-register";

if ("serviceWorker" in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Create a custom event to notify App.tsx to show toast
      window.dispatchEvent(
        new CustomEvent("pwa-update", { detail: { updateSW } }),
      );
    },
    onOfflineReady() {
      console.log("App ready for offline use.");
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
