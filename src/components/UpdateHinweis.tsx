import { useRegisterSW } from 'virtual:pwa-register/react';

/** Zeigt "Neue Version verfügbar" an, sobald der Service Worker eine neue Version geladen hat. */
export function UpdateHinweis() {
  const {
    needRefresh: [neu, setNeu],
    offlineReady: [offline, setOffline],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // stündlich nach Updates schauen, solange die App offen ist
      if (reg) window.setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (neu) {
    return (
      <div className="hinweis hinweis-info sw-hinweis" role="status">
        <span>
          <strong>Neue Version verfügbar.</strong> Deine Daten bleiben erhalten.
        </span>
        <span className="aktionen">
          <button type="button" className="btn btn-primaer btn-klein" onClick={() => void updateServiceWorker(true)}>
            Jetzt aktualisieren
          </button>
          <button type="button" className="btn btn-klein" onClick={() => setNeu(false)}>
            Später
          </button>
        </span>
      </div>
    );
  }
  if (offline) {
    return (
      <div className="hinweis hinweis-ok sw-hinweis" role="status">
        <span>Die App funktioniert jetzt auch ohne Internet.</span>
        <button type="button" className="icon-btn" aria-label="Hinweis schließen" onClick={() => setOffline(false)}>
          ✕
        </button>
      </div>
    );
  }
  return null;
}
