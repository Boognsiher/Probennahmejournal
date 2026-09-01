// demo-seed.js — legt in der Test-Schale ein Demo-Projekt "Probebaustelle"
// mit 150 automatisch generierten Proben an, deren Einstufung den ganzen
// VVEA-Bereich von Typ A bis Sonderabfall SOWIE den Boden-Bereich (Kat. I–
// IIIb) von Kat. II bis Sonderabfall abdeckt — inkl. Proben mit Material
// Gleisaushub/Schotter. Nur zu Demo-/Testzwecken (localStorage dieser
// Test-Schale) — hat nichts mit dem echten Server zu tun.
//
// Die VVEA-Analysewerte je Probe folgen denselben Analytik-Programmen, die
// auch im echten Formular unter "Analysen auslösen" zur Verfügung stehen
// (siehe Einstellungen > Analytik-Programme) — statt einzelner Zufallswerte
// bekommt jede Demo-Probe damit ein vollständiges, zusammenhängendes
// Parameter-Set (VVEA Basis Feststoff, dazu situativ Organik-Zusatz bzw.
// beim typischen "Sonderfall mit tiefen Eluatwerten"-Fall zusätzlich das
// Eluat-Programm). Boden-Proben nutzen ein einfacheres Panel aus den zehn
// Boden-Parametern (siehe buildAnalyseForClassVBBo()), da VBBO_PARAMETERS
// keine Eluat-/Organik-Aufteilung kennt. Alle Werte einer Probe teilen sich
// einen zufälligen "Belastungsgrad" (0-1 innerhalb der jeweils erreichbaren
// Grenzwertspanne, mit leichtem Jitter je Parameter), damit mehrere erhöhte
// Werte gemeinsam auftreten statt eines einzelnen isolierten Ausreissers.
import {
  createProjectApi, createEntryApi, getVevaCodesApi, getAnalytikProgrammeApi,
  getMaterialienApi, getVbboThresholdsApi, isLoggedIn,
} from './api.js';
import {
  CLASSES, PARAMETERS, DEMO_THRESHOLDS, classify, suggestVevaCode,
  VBBO_CLASSES, VBBO_PARAMETERS, buildVbboThresholds,
} from './vvea.js';

// Materialien, die automatisch VVEA ergeben (Humus/Ober-/Unterboden würden
// auf Boden/Kat.-I-IIIb umschalten, siehe materialToStandard() in vvea.js,
// dafür gibt es DEMO_MATERIALIEN_BODEN unten) — Namen entsprechen Einträgen
// der zentralen Materialien-Liste (Einstellungen > Materialien). Enthält
// auch Gleisaushub/Schotter, die genau wie Aushub nach VVEA eingestuft
// werden, aber ihren eigenen VeVA-Aushubcode-„Eimer" haben.
const DEMO_MATERIALIEN = [
  'Unverschmutzter Aushub', 'Aushub (allgemein)', 'Kies/Sand',
  'Mischabbruch', 'Betonabbruch', 'Asphalt', 'Ziegel/Mauerwerk', 'Bauschutt gemischt',
  'Gleisaushub', 'Schotter (Gleis)',
];
// Materialien, die auf Boden (Kat. I–IIIb) umschalten.
const DEMO_MATERIALIEN_BODEN = ['Humus/Oberboden', 'Unterboden'];
const DEMO_PROBENEHMER = ['Demo Admin', 'Demo Team-Mitglied', 'M. Huber', 'S. Keller', 'P. Meier'];
const DEMO_ENTNAHMEORTE = Array.from({ length: 10 }, (_, i) => `Baugrube ${i + 1}, Schicht ${1 + (i % 3)}`);
const DEMO_ENTSORGUNGSWEGE = ['Deponie Muster AG, Zürich', 'Aushubdeponie Musterhausen', 'Inertstoffdeponie Talrand', 'Reaktordeponie Nordwest'];

// Zielkombinationen (Standard + Klasse), die über die Demo-Proben abgedeckt
// werden sollen: VVEA Typ A bis Sonderabfall (bewusst OHNE "unbelastet", wie
// angefragt) sowie Boden Kat. II bis Sonderabfall (analog ohne die
// unbelastete Kat. I). 6 + 4 = 10 Kombinationen, gleichmässig über die
// TOTAL Proben verteilt (siehe generateDemoBaustelle()).
const TARGET_COMBOS = [
  ...['typA', 'typB', 'typC', 'typD', 'typE', 'sonderfall'].map(classId => ({ standard: 'vvea', classId })),
  ...['katII', 'katIIIa', 'katIIIb', 'sonderfall'].map(classId => ({ standard: 'vbbo', classId })),
];

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function shuffled(list) { return [...list].sort(() => Math.random() - 0.5); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function paramDef(key) { return PARAMETERS.find(p => p.key === key); }

// Sucht für einen Parameter einen Wert innerhalb der Grenzwertspanne der
// angegebenen Klasse (zwischen deren eigenem Grenzwert und dem der nächst-
// tieferen tatsächlich definierten Klasse) — nutzt classify()/die jeweilige
// Grenzwerttabelle selbst als Referenz (keine von Hand nachgebauten
// Grenzwert-Annahmen). Generisch über `classes`/`thresholdsTable` gehalten,
// damit dieselbe Logik für VVEA (CLASSES/DEMO_THRESHOLDS) und Boden
// (VBBO_CLASSES/projizierte Boden-Grenzwerte) wiederverwendet werden kann —
// siehe pickValueForClass()/pickValueForClassVBBo() unten.
// `severity` (0-1, optional) positioniert den Wert innerhalb der Spanne statt
// rein zufällig — mehrere Parameter mit demselben `severity` steigen dadurch
// gemeinsam an, wie bei einer echten Kontamination, statt unabhängig
// voneinander zu streuen. Manche Parameter haben für manche Klassen keinen
// eigenen Grenzwert (z.B. Blei: Typ C/D nicht separat geregelt) — für diese
// ist die Zielklasse mit diesem Parameter nicht erreichbar, Funktion gibt
// dann null zurück (Aufrufer versucht dann einen anderen Parameter).
function pickValueForClassGeneric(classes, thresholdsTable, paramKey, targetClassId, severity = null) {
  const t = thresholdsTable[paramKey];
  if (!t) return null;
  const targetIndex = classes.findIndex(c => c.id === targetClassId);
  if (targetIndex < 0) return null;
  const targetInfo = classes[targetIndex];

  if (targetInfo.terminal) {
    // Terminale Klasse (Sonderabfall/Sonderfall): Wert muss über allen
    // definierten Grenzwerten liegen.
    const defined = classes.filter(c => !c.terminal && t[c.id] !== null && t[c.id] !== undefined).map(c => t[c.id]);
    const base = defined.length ? Math.max(...defined) : 100;
    const f = severity === null ? rand(1.5, 4) : 1.2 + clamp01(severity) * 2.8;
    return Math.round(base * f * 100) / 100;
  }

  const ownLimit = t[targetClassId];
  if (ownLimit === null || ownLimit === undefined) return null; // für diese Klasse nicht erreichbar

  const lowerLimits = classes
    .filter((c, i) => i < targetIndex && !c.terminal && t[c.id] !== null && t[c.id] !== undefined)
    .map(c => t[c.id]);
  const lowerBound = lowerLimits.length ? Math.max(...lowerLimits) : 0;
  if (lowerBound >= ownLimit) return null; // keine gültige Spanne (Dateninkonsistenz) -> anderen Parameter versuchen

  const f = severity === null ? Math.random() : clamp01(severity + rand(-0.12, 0.12));
  const value = lowerBound + f * (ownLimit - lowerBound);
  return Math.round(value * 100) / 100;
}
const pickValueForClass = (paramKey, targetClassId, severity = null) =>
  pickValueForClassGeneric(CLASSES, DEMO_THRESHOLDS, paramKey, targetClassId, severity);

// Wie pickValueForClassGeneric(), weicht aber bei fehlendem Grenzwert für die
// Zielklasse auf die nächsttiefere tatsächlich erreichbare Klasse aus (nie
// höher) — damit ein Begleitparameter des Panels die Gesamteinstufung nie
// über die für die Probe vorgesehene Klasse hinaustreibt.
function pickValueAtMostClassGeneric(classes, thresholdsTable, paramKey, targetClassId, severity) {
  const targetIndex = classes.findIndex(c => c.id === targetClassId);
  for (let i = targetIndex; i >= 0; i--) {
    const val = pickValueForClassGeneric(classes, thresholdsTable, paramKey, classes[i].id, severity);
    if (val !== null) return val;
  }
  return null;
}
const pickValueAtMostClass = (paramKey, targetClassId, severity) =>
  pickValueAtMostClassGeneric(CLASSES, DEMO_THRESHOLDS, paramKey, targetClassId, severity);

// Boden-Pendants: nutzen dieselbe generische Logik mit VBBO_CLASSES und den
// per buildVbboThresholds() live projizierten Boden-Grenzwerten (Kat. I/II
// aus den Boden-Rohwerten, Kat. IIIa/IIIb aus den VVEA-Grenzwerten Typ B/E —
// siehe generateDemoBaustelle(), wo `vbboThresholdsProjected` gebaut wird).
const pickValueForClassVBBo = (vbboThresholdsProjected, paramKey, targetClassId, severity = null) =>
  pickValueForClassGeneric(VBBO_CLASSES, vbboThresholdsProjected, paramKey, targetClassId, severity);
const pickValueAtMostClassVBBo = (vbboThresholdsProjected, paramKey, targetClassId, severity) =>
  pickValueAtMostClassGeneric(VBBO_CLASSES, vbboThresholdsProjected, paramKey, targetClassId, severity);

// TOC/TOC400 dürfen hier nicht als alleiniger "Treiber" gewählt werden: die
// Klassifizierungs-Engine berücksichtigt TOC absichtlich erst, wenn die
// Einstufung durch andere Parameter bereits schlechter als Typ B ist (siehe
// classify() in vvea.js) — als einziger Wert würde TOC daher immer
// "unbelastet" ergeben, unabhängig vom eingegebenen Wert.
const DRIVER_EXCLUDED_KEYS = new Set(['toc', 'toc400']);
const METAL_GESAMT_KEYS = new Set(['sb', 'as', 'pb', 'cd', 'cr', 'cr6', 'co', 'cu', 'ni', 'hg', 'tl', 'zn', 'sn']);

// Treiber-Suche läuft bewusst über ALLE Gesamtgehalt-Parameter (nicht nur die
// der gewählten Analytik-Programme) — das garantiert dieselbe Erreichbarkeit
// jeder Zielklasse wie zuvor. Das restliche Panel (siehe buildAnalyseForClass)
// bleibt dagegen auf die tatsächlich gewählten Programme beschränkt, damit
// die Probe wie eine echte Analytik-Bestellung aussieht.
const ALL_GESAMT_KEYS = PARAMETERS.filter(p => p.art === 'gesamt' && !DRIVER_EXCLUDED_KEYS.has(p.key)).map(p => p.key);

// Manche Parameter/Klassen-Kombinationen haben keinen eigenen Grenzwert
// (z.B. ist "Typ D" in den vorliegenden Quelldaten für keinen Parameter
// separat geregelt, und Typ C ist unter den Basis-/Organik-Programm-
// Parametern kaum von Typ B zu unterscheiden) — die Zielklasse ist dann mit
// keinem Parameter exakt erreichbar. In diesem Fall von der Zielklasse
// ausgehend nach aussen zur nächstliegenden tatsächlich erreichbaren Klasse
// ausweichen ("Sonderfall" ist über jeden Parameter immer erreichbar und
// damit die garantierte letzte Ausweichmöglichkeit).
function nearbyClassOrderGeneric(classes, targetClassId) {
  const targetIndex = classes.findIndex(c => c.id === targetClassId);
  const order = [targetClassId];
  for (let offset = 1; offset < classes.length; offset++) {
    if (targetIndex - offset >= 0) order.push(classes[targetIndex - offset].id);
    if (targetIndex + offset < classes.length) order.push(classes[targetIndex + offset].id);
  }
  return order;
}
const nearbyClassOrder = targetClassId => nearbyClassOrderGeneric(CLASSES, targetClassId);

// Baut die Analysewerte-Tabelle einer Demo-Probe: VVEA-Basis-Feststoff-Panel
// (immer), dazu situativ Organik-Zusatz (Abwechslung) und — beim typischen
// Praxisfall "hoher Schwermetall-Feststoffgehalt, aber tiefe organische
// Schadstoffe, nach Behandlung im Eluat Typ-C-tauglich" — das Eluat-Programm,
// um die in classify() hinterlegte Sonderfall->Typ-C-Rückstufung auch in den
// Demo-Daten zu zeigen (siehe Kommentar dort bzw. README).
function buildAnalyseForClass(targetClassId, programme) {
  const basisKeys = programme.basis?.parameterKeys || [];
  const organikKeys = programme.organik?.parameterKeys || [];
  const eluatKeys = programme.eluat?.parameterKeys || [];

  const includeOrganik = Math.random() < 0.4;
  const panelKeys = new Set([...basisKeys, ...(includeOrganik ? organikKeys : [])]);

  // Treiber-Parameter suchen, der die Zielklasse exakt erreicht (ggf. auf
  // eine benachbarte Klasse ausweichen, falls kein Parameter einen eigenen
  // Grenzwert für die exakte Zielklasse hat).
  const candidates = shuffled(ALL_GESAMT_KEYS);
  let driverKey = null, driverValue = null, achievedClassId = null;
  for (const classId of nearbyClassOrder(targetClassId)) {
    for (const key of candidates) {
      const wert = pickValueForClass(key, classId);
      if (wert !== null) { driverKey = key; driverValue = wert; achievedClassId = classId; break; }
    }
    if (driverKey) break;
  }
  if (!driverKey) return { analyse: [], klassifizierung: null }; // praktisch unmöglich (Sonderfall ist immer erreichbar)
  panelKeys.add(driverKey); // Treiber immer mit ins Panel, auch falls ausserhalb der gewählten Programme

  const severity = rand(0.15, 0.9);
  const analyse = [];
  for (const key of panelKeys) {
    const def = paramDef(key);
    if (!def) continue;
    const wert = key === driverKey ? driverValue : pickValueAtMostClass(key, achievedClassId, severity);
    if (wert === null) continue; // für diesen Parameter bei dieser Klasse kein sinnvoller Wert bestimmbar
    analyse.push({ parameterKey: key, wert, einheit: def.unit, art: def.art || 'gesamt', quelle: 'demo' });
  }

  // Sonderfall->Typ-C-Rückstufung zeigen: nur sinnvoll, wenn der Treiber ein
  // Feststoff-Schwermetall ist (siehe METAL_GESAMT_KEYS/classify()) — dann in
  // ~50% der Fälle eine Eluatprüfung ergänzen, deren Werte alle innerhalb des
  // Typ-C-Eluatgrenzwerts liegen.
  if (achievedClassId === 'sonderfall' && METAL_GESAMT_KEYS.has(driverKey) && eluatKeys.length && Math.random() < 0.5) {
    for (const key of eluatKeys) {
      const def = paramDef(key);
      if (!def) continue;
      const wert = pickValueAtMostClass(key, 'typC', rand(0.1, 0.7));
      if (wert === null) continue;
      analyse.push({ parameterKey: key, wert, einheit: def.unit, art: def.art || 'gesamt', quelle: 'demo' });
    }
  }

  // Die tatsächliche Einstufung erst jetzt (nach evtl. Eluat-Ergänzung)
  // berechnen — die Rückstufungslogik in classify() kann das Ergebnis noch
  // von "sonderfall" auf "typC" ändern.
  const klassifizierung = analyse.length ? classify(analyse, DEMO_THRESHOLDS) : null;
  return { analyse, klassifizierung };
}

// Boden-Pendant zu buildAnalyseForClass(): einfacheres Panel (VBBO_PARAMETERS
// kennt keine Eluat-/Organik-Aufteilung wie PARAMETERS), sonst dieselbe
// Treiber-plus-Begleitparameter-Logik mit gemeinsamer `severity`.
// `vbboThresholdsProjected` ist die per buildVbboThresholds() aus den
// Boden-Rohwerten (Kat. I/II) und den VVEA-Grenzwerten (Kat. IIIa/IIIb = Typ
// B/Typ E) gebaute Grenzwerttabelle — siehe generateDemoBaustelle().
const BODEN_PARAM_KEYS = VBBO_PARAMETERS.map(p => p.key);
function buildAnalyseForClassVBBo(targetClassId, vbboThresholdsProjected) {
  const candidates = shuffled(BODEN_PARAM_KEYS);
  let driverKey = null, driverValue = null, achievedClassId = null;
  for (const classId of nearbyClassOrderGeneric(VBBO_CLASSES, targetClassId)) {
    for (const key of candidates) {
      const wert = pickValueForClassVBBo(vbboThresholdsProjected, key, classId);
      if (wert !== null) { driverKey = key; driverValue = wert; achievedClassId = classId; break; }
    }
    if (driverKey) break;
  }
  if (!driverKey) return { analyse: [], klassifizierung: null }; // praktisch unmöglich (Sonderfall ist immer erreichbar)

  const severity = rand(0.15, 0.9);
  const companionCount = Math.floor(rand(2, 5));
  const companions = shuffled(BODEN_PARAM_KEYS.filter(k => k !== driverKey)).slice(0, companionCount);
  const analyse = [];
  for (const key of [driverKey, ...companions]) {
    const def = VBBO_PARAMETERS.find(p => p.key === key);
    if (!def) continue;
    const wert = key === driverKey ? driverValue : pickValueAtMostClassVBBo(vbboThresholdsProjected, key, achievedClassId, severity);
    if (wert === null) continue;
    analyse.push({ parameterKey: key, wert, einheit: def.unit, art: 'gesamt', quelle: 'demo' });
  }

  const klassifizierung = analyse.length ? classify(analyse, vbboThresholdsProjected, VBBO_CLASSES, VBBO_PARAMETERS) : null;
  return { analyse, klassifizierung };
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
    name: 'Probebaustelle (Demo Typ A–Sonderabfall / Kat. II–IIIb)',
    kuerzel: 'DEMOX',
    auftraggeber: 'Demo Auftraggeber AG',
    ort: 'Musterhausen',
    bemerkungen: '150 automatisch generierte Testproben — Einstufung deckt bewusst den ganzen Bereich '
      + 'von VVEA Typ A bis Sonderabfall sowie Boden Kat. II bis Sonderabfall ab, zur Veranschaulichung '
      + 'der Farbcodierung/Filter.',
    entnahmeorte: DEMO_ENTNAHMEORTE,
    entsorgungswege: DEMO_ENTSORGUNGSWEGE,
  });
  // Demo-Projekt gleich als aktives Projekt setzen (siehe Startbildschirm in
  // app.js), damit man nach dem Generieren direkt im Journal dieses Projekts landet.
  localStorage.setItem('pnj_active_project_id', project.id);
  localStorage.setItem('pnj_active_project_name', project.name);

  const vevaCodes = await getVevaCodesApi().catch(() => []);
  const materialien = await getMaterialienApi().catch(() => []);
  const alleProgramme = await getAnalytikProgrammeApi().catch(() => []);
  const vbboThresholdsRaw = await getVbboThresholdsApi().catch(() => ({}));
  const programme = {
    basis: alleProgramme.find(p => p.id === 'vvea-basis-feststoff')
      || { parameterKeys: ALL_GESAMT_KEYS },
    organik: alleProgramme.find(p => p.id === 'vvea-organik-zusatz') || { parameterKeys: [] },
    eluat: alleProgramme.find(p => p.id === 'vvea-eluat-typc') || { parameterKeys: [] },
  };
  // Kat. IIIa/IIIb kommen live aus den VVEA-Grenzwerten (Typ B/Typ E) — hier
  // einmalig vorprojiziert, statt bei jeder einzelnen Demo-Probe neu zu bauen.
  const vbboThresholdsProjected = buildVbboThresholds(vbboThresholdsRaw, DEMO_THRESHOLDS);

  const TOTAL = 150;
  // Zielkombinationen (Standard + Klasse) möglichst gleichmässig über die 150
  // Proben verteilen, aber in zufälliger Reihenfolge (nicht blockweise sortiert).
  const targetSequence = shuffled(
    Array.from({ length: TOTAL }, (_, i) => TARGET_COMBOS[i % TARGET_COMBOS.length])
  );

  const deviations = []; // Zielklassen, deren tatsächliche Einstufung abweicht (kein Grenzwert erreichbar oder Typ-C-Rückstufung)

  const jobs = targetSequence.map((target, i) => async () => {
    const isBoden = target.standard === 'vbbo';
    const { analyse, klassifizierung } = isBoden
      ? buildAnalyseForClassVBBo(target.classId, vbboThresholdsProjected)
      : buildAnalyseForClass(target.classId, programme);
    if (klassifizierung && klassifizierung.classId !== target.classId) {
      deviations.push({ targetClassId: target.classId, achievedClassId: klassifizierung.classId });
    }
    const material = pick(isBoden ? DEMO_MATERIALIEN_BODEN : DEMO_MATERIALIEN);
    const vevaSuggestion = klassifizierung
      ? suggestVevaCode(material, target.standard, klassifizierung.classId, vevaCodes, materialien)
      : null;

    return createEntryApi({
      projektId: project.id,
      createdAt: randomPastDate(180),
      entnahmeort: pick(DEMO_ENTNAHMEORTE),
      material,
      probenehmer: pick(DEMO_PROBENEHMER),
      bemerkungen: `Demo-Probe #${i + 1} — Zielklasse (${isBoden ? 'Boden' : 'VVEA'}) ${target.classId}`
        + `${klassifizierung && klassifizierung.classId !== target.classId ? ` (tatsächlich: ${klassifizierung.classId}, siehe Analysewerte)` : ''}.`,
      analyse,
      klassifizierung,
      standard: target.standard,
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
    if (!confirm('Demo-Projekt "Probebaustelle" mit 150 zufälligen Proben (VVEA Typ A bis Sonderabfall, Boden Kat. II bis Sonderabfall, inkl. Gleisaushub) anlegen?')) return;
    btn.disabled = true;
    try {
      if (status) status.textContent = 'Generiere Demo-Proben … 0/150';
      const { total, deviations } = await generateDemoBaustelle((done, totalCount) => {
        if (status) status.textContent = `Generiere Demo-Proben … ${done}/${totalCount}`;
      });
      const devNote = deviations.length
        ? ` (${deviations.length}× weicht die tatsächliche Einstufung von der Zielklasse ab — mangels Grenzwert für die exakte Zielklasse oder wegen der Sonderfall->Typ-C-Rückstufung, siehe Bemerkungen der jeweiligen Probe.)`
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
