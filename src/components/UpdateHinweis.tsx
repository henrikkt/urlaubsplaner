import { useEffect } from 'react';
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

  // „Offline bereit“ ist nur eine Info → nach ein paar Sekunden von selbst ausblenden
  useEffect(() => {
    if (!offline) return;
    const t = window.setTimeout(() => setOffline(false), 6000);
    return () => window.clearTimeout(t);
  }, [offline, setOffline]);

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
    // Reine Info: kleine Pille, lässt Klicks durch (pointer-events: none) und verschwindet von selbst
    return (
      <div className="toast-bereich" role="status">
        <p className="toast toast-info">
          <span className="toast-haken" aria-hidden="true">
            ✓
          </span>
          Die App funktioniert jetzt auch ohne Internet.
        </p>
      </div>
    );
  }
  return null;
}
