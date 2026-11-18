import { besondererTagImJahr, erstelleKontext, type Kontext } from './berechnung';
import { anlassText, findeBrueckentage, sortiereNachEffizienz, wocheUm, zeitraumWerkzeug, type Chance } from './brueckentage';
import { istGueltigesDatum, jahrVon, jedenTag } from './datum';
import type { ISODatum, Plan } from './types';

/**
 * Urlaubstipps für die eigene Planung (Variante D):
 *  - alle Chancen des Brückentag-Finders
 *  - ein Kurztrip rund um jeden besonderen Tag im Planungsjahr
 *    (Mo–Fr-Woche des Tages; fällt er aufs Wochenende, die Woche davor – jeweils über
 *    angrenzende Wochenenden/Feiertage verlängert)
 * Ergebnis ist nach Effizienz sortiert und enthält jeden Zeitraum nur einmal.
 */
export function urlaubstipps(plan: Plan, ctx: Kontext = erstelleKontext(plan)): Chance[] {
  const w = zeitraumWerkzeug(plan, ctx);
  const tipps = new Map<string, Chance>();
  for (const c of findeBrueckentage(plan, ctx)) tipps.set(c.id, c);

  for (const t of plan.besondereTage) {
    const d = besondererTagImJahr(t, ctx.jahr);
    if (!istGueltigesDatum(d) || jahrVon(d) !== ctx.jahr) continue;
    const [von, bis] = wocheUm(d, w);
    const feiertage = anlassText(jedenTag(von, bis), ctx);
    const name = t.name.trim() || 'Besonderer Tag';
    const anlass = feiertage === 'Wochenende' ? name : `${name} + ${feiertage}`;
    const c = w.bewerte(von, bis, 'Anlass', `${t.symbol} ${anlass}`.trim());
    if (c && !tipps.has(c.id)) tipps.set(c.id, c);
  }

  return sortiereNachEffizienz([...tipps.values()]);
}

/** Für den Kalender: welche Tipps berühren welchen Tag? */
export function tippsProTag(tipps: Chance[]): Map<ISODatum, Chance[]> {
  const map = new Map<ISODatum, Chance[]>();
  for (const c of tipps) {
    for (const d of jedenTag(c.von, c.bis)) {
      const liste = map.get(d);
      if (liste) liste.push(c);
      else map.set(d, [c]);
    }
  }
  return map;
}
