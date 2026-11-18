import { useEffect, useState } from 'react';

/*
 * Hash-Routing (#/kalender …): funktioniert ohne Server-Konfiguration, auch auf GitHub Pages
 * beim Neuladen von Unterseiten.
 */
export type Route =
  | 'uebersicht'
  | 'bloecke'
  | 'kalender'
  | 'brueckentage'
  | 'einstellungen'
  | 'export'
  | 'datenschutz'
  | 'hilfe'
  | 'mehr'
  | 'neu';

const ROUTEN: Route[] = [
  'uebersicht',
  'bloecke',
  'kalender',
  'brueckentage',
  'einstellungen',
  'export',
  'datenschutz',
  'hilfe',
  'mehr',
  'neu',
];

function lese(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTEN.includes(h) ? h : 'uebersicht';
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(lese);
  useEffect(() => {
    const f = () => {
      setRoute(lese());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}

export function geheZu(r: Route) {
  window.location.hash = `/${r}`;
}
