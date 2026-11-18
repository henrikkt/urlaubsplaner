import express from 'express';
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlanFehler } from '../src/lib/schema.ts';
import type { Plan } from '../src/lib/types.ts';
import { ladeOderMigriere, pruefeEingang, schreibe, sichere, type DateiPfade } from './datei.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// DATA_DIR / BACKUP_DIR erlauben z. B. eine Testinstanz mit eigener Datendatei
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const PFADE: DateiPfade = {
  datei: path.join(DATA_DIR, 'urlaubsplan.json'),
  backupOrdner: process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(ROOT, 'backup'),
  seed: path.join(DATA_DIR, 'seed.local.json'),
};
const DIST_DIR = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 3027);
const HOST = '0.0.0.0';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

let schreibKette: Promise<unknown> = Promise.resolve();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/api/plan', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const { plan } = await ladeOderMigriere(PFADE);
    if (!plan) {
      res.status(404).json({ fehler: 'Noch kein Plan vorhanden.' });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error('Fehler beim Laden:', err);
    res.status(500).json({ fehler: 'Planungsdatei konnte nicht gelesen werden.' });
  }
});

app.put('/api/plan', (req, res) => {
  // Schreibvorgänge nacheinander ausführen, damit sich zwei Geräte nicht überholen
  schreibKette = schreibKette.then(async () => {
    try {
      const neu = pruefeEingang(req.body);
      let revision = 0;
      try {
        revision = (await ladeOderMigriere(PFADE)).plan?.revision ?? 0;
      } catch {
        // defekte Datei: vor dem Überschreiben sichern
        const ziel = await sichere(PFADE, 'defekt');
        console.warn(`  Defekte Datei gesichert: ${ziel}`);
      }
      const gespeichert: Plan = { ...neu, revision: revision + 1, geaendertAm: new Date().toISOString() };
      await schreibe(PFADE, gespeichert);
      res.json({ ok: true, revision: gespeichert.revision, geaendertAm: gespeichert.geaendertAm });
    } catch (err) {
      if (err instanceof PlanFehler) {
        res.status(400).json({ fehler: err.message });
      } else {
        console.error('Fehler beim Speichern:', err);
        res.status(500).json({ fehler: 'Speichern fehlgeschlagen.' });
      }
    }
  });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ fehler: 'Unbekannter Endpunkt' });
});

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: 'index.html' }));
  app.use((_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
} else {
  app.use((_req, res) =>
    res
      .status(503)
      .type('text/plain; charset=utf-8')
      .send('Frontend ist noch nicht gebaut. Bitte "npm run start" verwenden (baut und startet).'),
  );
}

function lanAdressen(): string[] {
  const out: string[] = [];
  for (const [name, liste] of Object.entries(os.networkInterfaces())) {
    for (const a of liste ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // virtuelle Adapter (WSL, Hyper-V, VirtualBox, VPN) nach hinten
      const virtuell = /vethernet|virtual|vmware|vbox|wsl|hyper-v|loopback|tailscale|zerotier/i.test(name);
      out[virtuell ? 'push' : 'unshift'](`http://${a.address}:${PORT}`);
    }
  }
  return out;
}

// Beim Start einmal laden: migriert alte Dateien bzw. legt sie aus den Startdaten an
try {
  const { plan, meldung } = await ladeOderMigriere(PFADE);
  if (meldung) console.log(`  ${meldung}`);
  if (!plan) console.log('  Noch kein Plan vorhanden – der Startassistent im Browser legt ihn an.');
} catch (err) {
  console.error(`\n  Die Datei ${PFADE.datei} ist beschädigt und wird nicht angefasst:`, err instanceof Error ? err.message : err);
}

const server = app.listen(PORT, HOST, () => {
  const lokal = `http://localhost:${PORT}`;
  const lan = lanAdressen();
  console.log('');
  console.log('  ==============================================');
  console.log('   Urlaubsplaner laeuft (Server-Modus)');
  console.log('  ==============================================');
  console.log(`  Auf diesem PC:      ${lokal}`);
  if (lan.length) {
    console.log(`  Im WLAN (Handy):    ${lan[0]}`);
    for (const weitere of lan.slice(1)) console.log(`                      ${weitere}`);
  } else {
    console.log('  Im WLAN (Handy):    keine Netzwerkverbindung gefunden');
  }
  console.log(`  Daten:              ${PFADE.datei}`);
  console.log('  Beenden mit Strg+C');
  console.log('');

  if (process.env.OPEN_BROWSER === '1') {
    const cmd =
      process.platform === 'win32' ? `start "" "${lokal}"` : process.platform === 'darwin' ? `open ${lokal}` : `xdg-open ${lokal}`;
    exec(cmd);
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} ist schon belegt – läuft die App bereits? Dann einfach http://localhost:${PORT} öffnen.\n`);
    if (process.env.OPEN_BROWSER === '1' && process.platform === 'win32') exec(`start "" "http://localhost:${PORT}"`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
