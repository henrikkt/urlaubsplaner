import { pruefePlan } from '../lib/schema';
import type { Plan } from '../lib/types';
import { ARBEITSBEREICH_SCHEMA, type Arbeitsbereich, type GeladenerArbeitsbereich } from './arbeitsbereich';
import type { PlanSpeicher } from './speicher';

export class ServerFehler extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Server-Modus: genau ein Plan, gespeichert in data/urlaubsplan.json über die Express-API. */
export class ServerSpeicher implements PlanSpeicher {
  readonly modus = 'server' as const;
  readonly mehrerePlaene = false;

  /** Aktuellen Plan vom Server holen; null, wenn der Server noch keinen Plan hat. */
  async holePlan(): Promise<Plan | null> {
    const res = await fetch('api/plan', { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new ServerFehler(`HTTP ${res.status}`, res.status);
    return pruefePlan(await res.json());
  }

  /** Plan speichern; liefert die neue Revision. */
  async speicherePlan(plan: Plan, keepalive = false): Promise<{ revision: number; geaendertAm: string }> {
    const res = await fetch('api/plan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
      keepalive,
    });
    if (!res.ok) {
      let text = `HTTP ${res.status}`;
      try {
        text = ((await res.json()) as { fehler?: string }).fehler ?? text;
      } catch {
        /* keine JSON-Antwort */
      }
      throw new ServerFehler(text, res.status);
    }
    return (await res.json()) as { revision: number; geaendertAm: string };
  }

  async load(): Promise<GeladenerArbeitsbereich | null> {
    const plan = await this.holePlan();
    if (!plan) return null;
    return {
      ab: { schema: ARBEITSBEREICH_SCHEMA, plaene: [plan], aktiverPlanId: plan.id, letztesBackup: null },
      defekt: [],
      migriert: false,
    };
  }

  async save(ab: Arbeitsbereich): Promise<void> {
    const plan = ab.plaene.find((p) => p.id === ab.aktiverPlanId) ?? ab.plaene[0];
    if (plan) await this.speicherePlan(plan);
  }
}
