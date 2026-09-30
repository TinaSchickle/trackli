import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Nur im Prod-Build registrieren: der cache-first Service Worker würde im
// Dev-Modus Vite-Module einfrieren und nach Dep-Reoptimierung doppelte
// React-Kopien ausliefern ("Invalid hook call").
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Der Service Worker ruft skipWaiting()/clients.claim() auf und übernimmt
  // eine bereits offene Seite damit sofort nach einem neuen Deploy. Ohne
  // Reload liefe die Seite dann mit bereits geladenem altem JS weiter,
  // während Nachlade-Anfragen über den neuen SW laufen, der die alten
  // (von GitHub Pages längst ersetzten) Dateinamen nicht mehr kennt →
  // 404 auf Chunks → React mountet nicht → weißer Bildschirm bis zum
  // manuellen Neuladen. Deshalb bei Controller-Wechsel einmalig selbst
  // neu laden, damit Shell und Assets garantiert zusammenpassen.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`)
      .catch((err) => console.warn('Service-Worker-Registrierung fehlgeschlagen:', err));
  });
}
