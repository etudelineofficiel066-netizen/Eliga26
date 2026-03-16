import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Detect when a new SW is waiting — show a reload banner
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available — show a visible banner to force reload
              const banner = document.createElement("div");
              banner.id = "sw-update-banner";
              banner.style.cssText = [
                "position:fixed","bottom:0","left:0","right:0","z-index:99999",
                "background:#16a34a","color:#fff","padding:12px 16px",
                "display:flex","align-items:center","justify-content:space-between",
                "font-family:sans-serif","font-size:14px","gap:12px","flex-wrap:wrap"
              ].join(";");
              banner.innerHTML = `
                <span>Nouvelle version disponible — rechargez pour éviter les problèmes d'affichage.</span>
                <button id="sw-reload-btn" style="background:#fff;color:#16a34a;border:none;border-radius:6px;padding:6px 16px;font-weight:700;cursor:pointer;font-size:13px;">
                  Recharger
                </button>`;
              document.body.appendChild(banner);
              document.getElementById("sw-reload-btn")?.addEventListener("click", () => {
                newWorker.postMessage({ type: "SKIP_WAITING" });
                window.location.reload();
              });
            }
          });
        });

        // Also handle the case where a controller change happens
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!document.getElementById("sw-update-banner")) {
            window.location.reload();
          }
        });
      })
      .catch((err) => {
        console.warn("[eLIGA PWA] Erreur service worker:", err);
      });
  });
}
