import type { PlanZustand } from '../hooks/usePlan';
import { Icon, type IconName } from './ui';

export function HilfeSeite() {
  return (
    <section aria-labelledby="titel-hilfe" className="text-seite">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-hilfe">Als App installieren</h1>
          <p className="unterzeile">Dann startet der Urlaubsplaner wie eine normale App vom Startbildschirm – auch ohne Internet.</p>
        </div>
      </div>

      <article className="karte">
        <h2>iPhone und iPad</h2>
        <ol>
          <li>
            Diese Seite in <strong>Safari</strong> öffnen.
          </li>
          <li>
            Unten (iPad: oben) auf <strong>Teilen</strong> tippen – das Viereck mit dem Pfeil nach oben.
          </li>
          <li>
            Nach unten wischen und <strong>„Zum Home-Bildschirm“</strong> wählen.
          </li>
          <li>
            Oben rechts auf <strong>„Hinzufügen“</strong> tippen.
          </li>
        </ol>
      </article>

      <article className="karte">
        <h2>Android</h2>
        <ol>
          <li>
            Diese Seite in <strong>Chrome</strong> öffnen.
          </li>
          <li>
            Oben rechts auf das <strong>Menü</strong> tippen (drei Punkte).
          </li>
          <li>
            <strong>„App installieren“</strong> wählen (manchmal heißt es „Zum Startbildschirm hinzufügen“).
          </li>
          <li>
            Mit <strong>„Installieren“</strong> bestätigen.
          </li>
        </ol>
      </article>

      <article className="karte">
        <h2>Computer (Chrome oder Edge)</h2>
        <p>
          In der Adressleiste rechts erscheint ein kleines Symbol <strong>„App installieren“</strong> (Bildschirm mit Pfeil). Darauf
          klicken und bestätigen.
        </p>
      </article>

      <article className="karte">
        <h2>Gut zu wissen</h2>
        <ul>
          <li>Die installierte App und die Webseite teilen sich die Daten nur, wenn sie im selben Browser laufen.</li>
          <li>Gibt es eine neue Version, erscheint oben ein Hinweis „Neue Version verfügbar“. Ein Tipp darauf aktualisiert die App.</li>
          <li>Deine Planung bleibt auf dem Gerät. Für ein neues Handy: Backup speichern und dort einspielen.</li>
        </ul>
      </article>
    </section>
  );
}

const MEHR: { href: string; icon: IconName; titel: string; text: string }[] = [
  { href: '#/einstellungen', icon: 'einstellungen', titel: 'Einstellungen', text: 'Personen, Bundesland, Varianten, Pläne' },
  { href: '#/export', icon: 'export', titel: 'Export / Import', text: 'Backup, Kalender (.ics), Excel, Drucken' },
  { href: '#/datenschutz', icon: 'datenschutz', titel: 'Datenschutz & Daten', text: 'Wo deine Daten liegen, alles löschen' },
  { href: '#/hilfe', icon: 'hilfe', titel: 'Als App installieren', text: 'Anleitung für iPhone und Android' },
];

export function MehrSeite({ zustand }: { zustand: PlanZustand }) {
  return (
    <section aria-labelledby="titel-mehr" className="text-seite">
      <div className="seitenkopf">
        <h1 id="titel-mehr">Mehr</h1>
      </div>
      <ul className="mehr-liste">
        {zustand.mehrerePlaene && (
          <li>
            <a href="#/neu">
              <span aria-hidden="true" style={{ fontSize: 22, width: 20, textAlign: 'center' }}>
                +
              </span>
              <span>
                Neuen Plan anlegen
                <small>z. B. für das nächste Jahr</small>
              </span>
            </a>
          </li>
        )}
        {MEHR.map((m) => (
          <li key={m.href}>
            <a href={m.href}>
              <Icon name={m.icon} />
              <span>
                {m.titel}
                <small>{m.text}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
