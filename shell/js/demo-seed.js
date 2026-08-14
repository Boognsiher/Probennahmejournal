// demo-seed.js — legt in der Test-Schale ein Demo-Projekt "Probebaustelle"
// mit 150 automatisch generierten Proben an, deren Einstufung den ganzen
// VVEA-Bereich von Typ A bis Sonderabfall abdeckt. Nur zu Demo-/Testzwecken
// (localStorage dieser Test-Schale) — hat nichts mit dem echten Server zu tun.
import { createProjectApi, createEntryApi, getVevaCodesApi, isLoggedIn } from './api.js';
import { CLASSES, PARAMETERS, DEMO_THRESHOLDS, classify, suggestVevaCode } from './vvea.js';

// Nur Materialien, die automatisch VVEA ergeben (Humus/Ober-/Unterboden
// würden auf VBBo umschalten, siehe materialToStandard() in vvea.js).
const DEMO_MATERIALIEN = [
  'Unverschmutzter Aushub', 'Aushub (allgemein)', 'Kies/Sand',
  'Mischabbruch', 'Betonabbruch', 'Asphalt', 'Ziegel/Mauerwerk', 'Bauschutt gemischt',
];
const DEMO_PROBENEHMER = ['Demo Admin', 'Demo Team-Mitglied', 'M. Huber', 'S. Keller', 'P. Meier'];
const DEMO_ENTNAHMEORTE = Array.from({ length: 10 }, (_, i) => `Baugrube ${i + 1}, Schicht ${1 + (i % 3)}`);
const DEMO_ENTSORGUNGSWEGE = ['Deponie Muster AG, Zürich', 'Aushubdeponie Musterhausen', 'Inertstoffdeponie Talrand', 'Reaktordeponie Nordwest'];

// Klassen, die abgedeckt werden sollen: Typ A bis Sonderabfall (bewusst OHNE
// "unbelastet", wie angefragt).
const TARGET_CLASS_IDS = ['typA', 'typB', 'typC', 'typD', 'typE', 'sonderfall'];

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function shuffled(list) { return [...list].sort(() => Math.random() - 0.5); }

// Sucht für einen Parameter einen Wert, der bei classify() garantiert genau
// die Zielklasse ergibt — nutzt classify()/DEMO_THRESHOLDS selbst als
// Referenz (keine von Hand nachgebauten Grenzwert-Annahmen). Manche
// Parameter haben für manche Klassen keinen eigenen Grenzwert (z.B. Blei:
// Typ C/D nicht separat geregelt) — für diese ist die Zielklasse mit diesem
// Parameter nicht erreichbar, Funktion gibt dann null zurück (Aufrufer
// versucht dann einen anderen Parameter).
function pickValueForClass(paramKey, targetClassId) {
  const t = DEMO_THRESHOLDS[paramKey];
  if (!t) return null;
  const targetIndex = CLASSES.findIndex(c => c.id === targetClassId);
  if (targetIndex < 0) return null;
  const targetInfo = CLASSES[targetIndex];

  if (targetInfo.terminal) {
    // Sonderabfall: Wert muss über allen definierten Grenzwerten liegen.
    const defined = CLASSES.filter(c => !c.terminal && t[c.id] !== null && t[c.id] !== undefined).map(c => t[c.id]);
    const base = defined.length ? Math.max(...defined) : 100;
    return Math.round(rand(base * 1.5, base * 4) * 100) / 100;
  }

  const ownLimit = t[targetClassId];
  if (ownLimit === null || ownLimit === undefined) return null; // für diese Klasse nicht erreichbar

  const lowerLimits = CLASSES
    .filter((c, i) => i < targetIndex && !c.terminal && t[c.id] !== null && t[c.id] !== undefined)
    .map(c => t[c.id]);
  const lowerBound = lowerLimits.length ? Math.max(...lowerLimits) : 0;
  if (lowerBound >= ownLimit) return null; // keine gültige Spanne (Dateninkonsistenz) -> anderen Parameter versuchen

  const value = rand(lowerBound, ownLimit);
  return Math.round(value * 100) / 100;
}

// Wert deutlich unterhalb "unbelastet" für harmlose Zusatz-Parameter, damit
// sie die Gesamteinstufung nicht verfälschen.
function pickHarmlessValue(paramKey) {
  const t = DEMO_THRESHOLDS[paramKey];
  const limit = t?.unbelastet;
  if (limit === null || limit === undefined) return null;
  return Math.round(rand(0, limit * 0.5) * 100) / 100;
}

// TOC/TOC400 dürfen hier nicht als alleiniger "Treiber" gewählt werden: die
// Klassifizierungs-Engine berücksichtigt TOC absichtlich erst, wenn die
// Einstufung durch andere Parameter bereits schlechter als Typ B ist (siehe
// classify() in vvea.js) — als einziger Wert würde TOC daher immer
// "unbelastet" ergeben, unabhängig vom eingegebenen Wert.
const PRIMARY_CANDIDATE_KEYS = new Set(['toc', 'toc400']);
function primaryCandidates() {
  return shuffled(PARAMETERS.filter(p => p.art === 'gesamt' && !PRIMARY_CANDIDATE_KEYS.has(p.key)));
}

// Manche Parameter/Klassen-Kombinationen haben keinen eigenen Grenzwert
// (z.B. ist "Typ D" in den vorliegenden Quelldaten für keinen Parameter
// separat geregelt) — die Zielklasse ist dann mit keinem Wert exakt
// erreichbar. In diesem Fall von der Zielklasse ausgehend nach aussen zur
// nächstliegenden tatsächlich erreichbaren Klasse ausweichen ("Sonderfall"
// ist über jeden Parameter immer erreichbar und damit die garantierte
// letzte Ausweichmöglichkeit, siehe pickValueForClass()).
function nearbyClassOrder(targetClassId) {
  const targetIndex = CLASSES.findIndex(c => c.id === targetClassId);
  const order = [targetClassId];
  for (let offset = 1; offset < CLASSES.length; offset++) {
    if (targetIndex - offset >= 0) order.push(CLASSES[targetIndex - offset].id);
    if (targetIndex + offset < CLASSES.length) order.push(CLASSES[targetIndex + offset].id);
  }
  return order;
}

function buildAnalyseForClass(targetClassId) {
  const candidates = primaryCandidates();
  let primary = null;
  let achievedClassId = null;
  for (const classId of nearbyClassOrder(targetClassId)) {
    for (const p of candidates) {
      const wert = pickValueForClass(p.key, classId);
      if (wert !== null) { primary = { parameterKey: p.key, wert, einheit: p.unit, art: p.art, quelle: 'demo' }; achievedClassId = classId; break; }
    }
    if (primary) break;
  }
  if (!primary) return { analyse: [], achievedClassId: null }; // praktisch unmöglich (sonderfall ist immer erreichbar)

  const analyse = [primary];
  const extraCount = Math.floor(rand(0, 3)); // 0-2 zusätzliche, harmlose Werte für Realismus
  const usedKeys = new Set([primary.parameterKey]);
  for (const p of candidates) {
    if (analyse.length - 1 >= extraCount) break;
    if (usedKeys.has(p.key)) continue;
    const wert = pickHarmlessValue(p.key);
    if (wert === null) continue;
    analyse.push({ parameterKey: p.key, wert, einheit: p.unit, art: p.art, quelle: 'demo' });
    usedKeys.add(p.key);
  }
  return { analyse, achievedClassId };
}

function randomPastDate(maxDaysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(rand(0, maxDaysAgo)));
  d.setHours(Math.floor(rand(7, 17)), Math.floor(rand(0, 60)), 0, 0);
  return d.toISOString();
}

async function generateDemoBaustelle(onProgress) {
  if (!isLoggedIn()) throw new Error('Bitte zuerst anmelden.');

  const project = await createProjectApi({
    name: 'Probebaustelle (Demo Typ A–Sonderabfall)',
    kuerzel: 'DEMOX',
    auftraggeber: 'Demo Auftraggeber AG',
    ort: 'Musterhausen',
    bemerkungen: '150 automatisch generierte Testproben — Einstufung deckt bewusst den ganzen Bereich '
      + 'von Typ A bis Sonderabfall ab, zur Veranschaulichung der Farbcodierung/Filter.',
    entnahmeorte: DEMO_ENTNAHMEORTE,
    entsorgungswege: DEMO_ENTSORGUNGSWEGE,
  });

  const vevaCodes = await getVevaCodesApi().catch(() => []);

  const TOTAL = 150;
  // Zielklassen möglichst gleichmässig über die 150 Proben verteilen, aber
  // in zufälliger Reihenfolge (nicht blockweise sortiert).
  const targetSequence = shuffled(
    Array.from({ length: TOTAL }, (_, i) => TARGET_CLASS_IDS[i % TARGET_CLASS_IDS.length])
  );

  const deviations = []; // Zielklassen, die mangels Grenzwert nicht exakt erreichbar waren

  const jobs = targetSequence.map((targetClassId, i) => async () => {
    const { analyse, achievedClassId } = buildAnalyseForClass(targetClassId);
    const klassifizierung = analyse.length ? classify(analyse, DEMO_THRESHOLDS) : null;
    if (achievedClassId && achievedClassId !== targetClassId) deviations.push({ targetClassId, achievedClassId });
    const material = pick(DEMO_MATERIALIEN);
    const vevaSuggestion = klassifizierung ? suggestVevaCode(material, 'vvea', klassifizierung.classId, vevaCodes) : null;

    return createEntryApi({
      projektId: project.id,
      createdAt: randomPastDate(180),
      entnahmeort: pick(DEMO_ENTNAHMEORTE),
      material,
      probenehmer: pick(DEMO_PROBENEHMER),
      bemerkungen: `Demo-Probe #${i + 1} — Zielklasse ${targetClassId}${achievedClassId && achievedClassId !== targetClassId ? ` (kein Parameter mit Grenzwert für ${targetClassId} vorhanden, daher ${achievedClassId})` : ''}.`,
      analyse,
      klassifizierung,
      standard: 'vvea',
      entsorgungsweg: Math.random() < 0.7 ? pick(DEMO_ENTSORGUNGSWEGE) : '',
      vevaCode: vevaSuggestion ? vevaSuggestion.code : '',
      menge: Math.random() < 0.85 ? Math.round(rand(2, 180) * 10) / 10 : null,
      mengeEinheit: Math.random() < 0.7 ? 't' : 'm3',
    });
  });

  // In Tranchen parallelisieren (schneller als 150x sequentiell warten,
  // aber nicht alle 150 gleichzeitig lostreten).
  const BATCH = 15;
  let done = 0;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    await Promise.all(batch.map(job => job()));
    done += batch.length;
    onProgress?.(done, TOTAL);
  }

  return { project, total: TOTAL, deviations };
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('demo-seed');
  const status = document.getElementById('demo-seed-status');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!isLoggedIn()) { alert('Bitte zuerst anmelden, dann erneut versuchen.'); return; }
    if (!confirm('Demo-Projekt "Probebaustelle" mit 150 zufälligen Proben (Typ A bis Sonderabfall) anlegen?')) return;
    btn.disabled = true;
    try {
      if (status) status.textContent = 'Generiere Demo-Proben … 0/150';
      const { total, deviations } = await generateDemoBaustelle((done, totalCount) => {
        if (status) status.textContent = `Generiere Demo-Proben … ${done}/${totalCount}`;
      });
      const devNote = deviations.length
        ? ` (${deviations.length}× musste auf die nächstliegende erreichbare Klasse ausgewichen werden, mangels Grenzwert für die exakte Zielklasse — siehe Bemerkungen der jeweiligen Probe.)`
        : '';
      if (status) status.textContent = `Fertig: ${total} Demo-Proben angelegt.${devNote} Lade Journal …`;
      await new Promise(r => setTimeout(r, 1200));
      location.hash = '#/journal';
      location.reload();
    } catch (err) {
      if (status) status.textContent = 'Fehler: ' + (err?.message || err);
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });
});
