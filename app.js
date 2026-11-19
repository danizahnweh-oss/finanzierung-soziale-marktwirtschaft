"use strict";
/* ---------- Speicher ---------- */
const KEY = "fsmw:";
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* privat */ } }
};

/* ---------- Format ---------- */
const nf = (n, d = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n, d = 2) => nf(n, d) + " €";
const mio = n => nf(n / 1e6, 2) + " Mio. €";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- Steuermodell 2026 (vereinfacht) ---------- */
function est(x) {
  x = Math.floor(x);
  if (x <= 12348) return 0;
  if (x <= 17799) { const y = (x - 12348) / 1e4; return Math.floor((914.51 * y + 1400) * y); }
  if (x <= 69878) { const z = (x - 17799) / 1e4; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}
const soli = e => e <= 20350 ? 0 : Math.min(0.055 * e, 0.119 * (e - 20350));
const BBG_RV = 101400, BBG_KV = 69750;
function payroll(bruttoM, { gkv = true, kist = true } = {}) {
  const J = bruttoM * 12, r = Math.min(J, BBG_RV), k = Math.min(J, BBG_KV);
  const rv = r * 0.093, av = r * 0.013;
  const kv = gkv ? k * 0.0875 : 0, pv = gkv ? k * 0.024 : 0;
  const vors = rv + (gkv ? k * (0.07 + 0.0145) + k * 0.024 : 0);
  const zve = Math.max(0, J - 1230 - 36 - vors);
  const e = est(zve), s = soli(e), ki = kist ? e * 0.08 : 0;
  const tax = e + s + ki, sv = rv + av + kv + pv;
  return { J, zve, e, s, ki, rv, av, kv, pv, tax, sv, net: J - tax - sv };
}
const TONI = payroll(3500);
const KANE = payroll(25e6 / 12, { gkv: false, kist: false });

/* ---------- Daten ---------- */
const M1 = [ // Steuereinnahmen 2025, Mrd. €
  ["Umsatzsteuer (inkl. Einfuhrumsatzsteuer)", 310.2], ["Lohnsteuer", 262.7], ["Veranlagte Einkommensteuer", 78.4],
  ["Gewerbesteuer", 76.4], ["Körperschaftsteuer", 39.2], ["Energiesteuer", 37.6], ["Nicht veranlagte Steuern vom Ertrag", 31.1],
  ["Abgeltungsteuer auf Zinsen und Kursgewinne", 24.8], ["Versicherungsteuer", 19.6], ["Grundsteuer und sonstige Gemeindesteuern", 18.1],
  ["Tabaksteuer", 17.6], ["Erbschaftsteuer", 15.4], ["Grunderwerbsteuer", 15.1], ["Solidaritätszuschlag", 12.9],
  ["Kfz-Steuer", 9.6], ["Stromsteuer", 5.9], ["Zölle", 5.9], ["Übrige Steuern", 9.4]
];
const M4 = [ // Bundeshaushalt 2026, Mrd. €
  ["Arbeit und Soziales", 197.3], ["Verteidigung", 82.7], ["Allgemeine Finanzverwaltung", 47.4], ["Bundesschuld (vor allem Zinsen)", 33.6],
  ["Verkehr", 27.9], ["Gesundheit", 21.8], ["Forschung, Technologie, Raumfahrt", 21.8], ["Bildung, Familie, Senioren, Frauen, Jugend", 16.7],
  ["Inneres", 15.8], ["Finanzen", 10.8], ["Wirtschaftliche Zusammenarbeit", 10.1], ["Wohnen und Bauen", 7.7],
  ["Landwirtschaft, Ernährung", 7.0], ["Auswärtiges Amt", 6.0], ["Wirtschaft und Energie", 5.9], ["Bundeskanzleramt", 5.0],
  ["Umwelt, Klimaschutz", 2.8], ["Sonstige (u. a. Digitales, Bundestag, Justiz)", 4.3]
];

/* ---------- Bausteine ---------- */
function bars(data, { unit = " Mrd. €", total = null, top = data.length, cls = "" } = {}) {
  const max = Math.max(...data.map(d => d[1]));
  return `<div class="bars ${cls}">` + data.slice(0, top).map(([l, v], i) => {
    const w = v / max * 100, pct = total ? ` (${nf(v / total * 100, 1)} %)` : "";
    return `<div class="bar${i > 3 ? " alt" : ""}"><span class="lab">${esc(l)}</span><span class="track" style="--w:${w.toFixed(1)}"><span class="fill"></span><span class="val">${nf(v, 1)}${unit}${pct}</span></span></div>`;
  }).join("") + `</div>`;
}
function material(tag, title, body, source, kind = "official") {
  const k = kind === "model" ? `<span class="model">Modellrechnung</span>` : kind === "est" ? `<span class="model">Schätzung</span>` : `<span class="official">amtliche Daten</span>`;
  return `<section class="card material"><h3><span class="mtag">${tag}</span>${title}${k}</h3>${body}<p class="source">${source}</p></section>`;
}

/* Schreibaufgabe: Musterlösung schaltet erst nach realistischem Umfang frei (keine Anzeige) */
const WRITE = {};
function writeTask(id, num, prompt, tip, solution, checks) {
  WRITE[id] = { solution, checks };
  const val = store.get("w:" + id, "");
  const unlocked = val.trim().length >= Math.floor(solution.replace(/<[^>]+>/g, "").length * 0.5);
  return `<section class="card task" data-write="${id}">
    <div class="task-head"><span class="task-num">Aufgabe ${num}</span></div>
    <p>${prompt}</p>
    <details class="tip"><summary>Tipp</summary><div class="tip-body">${tip}</div></details>
    <label class="fl" for="ta-${id}">Deine Antwort</label>
    <textarea id="ta-${id}" data-id="${id}" spellcheck="true">${esc(val)}</textarea>
    <div class="saved" id="sv-${id}"></div>
    <div class="btnrow"><button type="button" class="btn" data-sol="${id}" ${unlocked ? "" : "disabled"}>Musterlösung anzeigen</button></div>
    <div id="sol-${id}" hidden></div>
  </section>`;
}
function solHtml(id) {
  const w = WRITE[id], done = store.get("c:" + id, []);
  return `<div class="solution"><h4>Musterlösung</h4>${w.solution}
    <h4 style="margin-top:12px">Selbstcheck: Hast du ...</h4>
    <ul class="checklist">${w.checks.map((c, i) => `<li><input type="checkbox" id="ck-${id}-${i}" data-ck="${id}" data-i="${i}" ${done.includes(i) ? "checked" : ""}><label for="ck-${id}-${i}">${c}</label></li>`).join("")}</ul></div>`;
}

/* Quiz */
const QUIZ = {};
function quiz(id, items) {
  QUIZ[id] = items;
  return `<div data-quiz="${id}">` + items.map((q, qi) => `<div class="q"><div class="q-text">${q.q}</div><div class="opts">${q.o.map((o, oi) => `<button type="button" class="opt" data-q="${id}" data-qi="${qi}" data-oi="${oi}">${o}</button>`).join("")}</div><div class="fb" id="fb-${id}-${qi}" aria-live="polite"></div></div>`).join("") + `</div>`;
}

/* Zuordnung */
const ASSIGN = {};
function assign(id, cats, items) {
  ASSIGN[id] = { cats, items };
  const st = store.get("a:" + id, {});
  return `<div class="assign-list" data-assign="${id}">` + items.map((it, i) => `<div class="assign" id="as-${id}-${i}"><span class="txt">${it[0]}</span><span class="seg" role="group" aria-label="Zuordnung">${cats.map((c, ci) => `<button type="button" data-as="${id}" data-i="${i}" data-c="${ci}" aria-pressed="${st[i] === ci}">${c}</button>`).join("")}</span></div>`).join("") +
    `</div><div class="btnrow"><button type="button" class="btn primary" data-ascheck="${id}">Zuordnung prüfen</button></div><div class="fb" id="asfb-${id}" aria-live="polite"></div>`;
}

/* Reihenfolge */
const ORDER = {};
function orderTask(id, correct) {
  ORDER[id] = correct;
  let cur = store.get("o:" + id, null);
  if (!cur || cur.length !== correct.length) { cur = correct.map((_, i) => i); for (let i = cur.length - 1; i > 0; i--) { const j = Math.floor(((i * 7919 + 13) % 97) / 97 * (i + 1)); [cur[i], cur[j]] = [cur[j], cur[i]]; } if (cur.every((v, i) => v === i)) cur.reverse(); }
  return `<ol class="sortlist" id="ol-${id}" data-order="${id}">` + cur.map(i => sortCard(id, i)).join("") + `</ol>
    <div class="btnrow"><button type="button" class="btn primary" data-ocheck="${id}">Reihenfolge prüfen</button></div><div class="fb" id="ofb-${id}" aria-live="polite"></div>`;
}
const sortCard = (id, i) => `<li class="sortcard" data-idx="${i}"><span class="handle" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span><span class="txt">${ORDER[id][i]}</span><span class="arrows"><button type="button" data-mv="-1" aria-label="nach oben">▲</button><button type="button" data-mv="1" aria-label="nach unten">▼</button></span></li>`;

/* ---------- Stationen ---------- */
const S = [];

/* 0 Start */
S.push({ short: "Start", title: "Anpfiff", render: () => {
  const g = store.get("guess", 60);
  return `<div class="hero">
    <div>
      <p class="kicker">Wirtschaft und Recht 11: Finanzierung der Sozialen Marktwirtschaft</p>
      <h1>25 Millionen Euro brutto. Wie viel bleibt Harry Kane?</h1>
      <p class="lead">Kane ist Stürmer beim FC Bayern. Laut Medienberichten verdient er rund 25 Mio. € im Jahr. Ein Teil davon geht an den Staat. Wohin, und warum?</p>
    </div>
    <div class="jersey" aria-hidden="true">${jerseySvg()}</div>
  </div>
  <section class="card">
    <h3>Deine Schätzung zuerst</h3>
    <div class="guess">
      <label for="guess" class="fl">Wie viel Prozent seines Bruttogehalts behält Kane netto?</label>
      <div class="range-row"><input type="range" id="guess" min="10" max="100" step="1" value="${g}"><span class="out" id="guessOut">${g} %</span></div>
      <div class="btnrow"><button type="button" class="btn primary" id="reveal">Auflösen</button></div>
      <div id="revealOut" ${store.get("revealed", false) ? "" : "hidden"}>${revealHtml()}</div>
    </div>
  </section>
  <section class="card flat">
    <h3>So arbeitest du</h3>
    <p>Neun Stationen führen dich durch das Thema. Wische nach links oder rechts oder nutze die Knöpfe unten. Deine Antworten werden in diesem Browser gespeichert.</p>
    <p class="small muted">Kennzeichnung: <span class="official">amtliche Daten</span> stammen von Statistischem Bundesamt, Finanz- oder Arbeitsministerium. <span class="model">Modellrechnung</span> und <span class="model">Schätzung</span> sind vereinfachte Rechnungen oder Medienangaben.</p>
  </section>`;
}});
function revealHtml() {
  const p = KANE.net / KANE.J * 100;
  return `<div class="kpis" style="margin-top:14px">
    <div class="kpi"><b>${mio(KANE.net)}</b><span>netto im Jahr <span class="model">Modellrechnung</span></span></div>
    <div class="kpi"><b>${nf(p, 1)} %</b><span>vom Brutto bleibt</span></div>
    <div class="kpi"><b>${mio(KANE.e + KANE.s)}</b><span>Einkommensteuer und Soli</span></div>
    <div class="kpi"><b>${eur(KANE.sv, 0)}</b><span>Sozialbeiträge (Rente, Arbeitslosigkeit)</span></div>
  </div>
  <p class="small muted">Annahmen: nur Grundgehalt, ledig, keine Kirchensteuer, privat kranken- und pflegeversichert, Tarif 2026. Boni und Werbeeinnahmen fehlen. Fällt dir bei den Sozialbeiträgen etwas auf? Das klären wir in Station 2.</p>`;
}
function jerseySvg() {
  return `<svg viewBox="0 0 200 200" role="img"><circle cx="100" cy="100" r="96" fill="var(--surface-2)"/>
  <path d="M62 44 L82 36 Q100 48 118 36 L138 44 L164 66 L150 88 L138 80 L138 160 Q100 168 62 160 L62 80 L50 88 L36 66 Z" fill="var(--jersey)"/>
  <path d="M82 36 Q100 54 118 36" fill="none" stroke="#ffffff" stroke-width="3"/>
  <text x="100" y="128" text-anchor="middle" font-family="Barlow Semi Condensed, sans-serif" font-weight="700" font-size="62" fill="#ffffff">9</text></svg>`;
}

/* 1 Steuern im Alltag */
const BASKET = [
  ["Döner zum Mitnehmen", 7.5, .07], ["Energydrink", 2.49, .19], ["Kinoticket", 12, .07], ["Streaming-Abo (Anteil pro Woche)", 1.5, .19],
  ["T-Shirt", 20, .19], ["Taschenbuch", 15, .07], ["Busfahrt (Einzelticket)", 2.2, .07], ["Tafel Schokolade", 1.49, .07],
  ["Handyguthaben", 15, .19], ["Liter Benzin für den Roller", 1.75, "fuel"]
];
function basketCalc(c) {
  let ust = 0, en = 0, sum = 0;
  BASKET.forEach((b, i) => { const n = c[i] || 0, p = b[1] * n; sum += p;
    if (b[2] === "fuel") { ust += p * .19 / 1.19; en += 0.6545 * n; } else ust += p * b[2] / (1 + b[2]); });
  return { sum, ust, en };
}
S.push({ short: "Alltag", title: "Steuern im Alltag", render: () => {
  const c = store.get("basket", {});
  return `<h2>Steuern zahlst du schon heute</h2>
  <p class="lead">Lohnsteuer zahlen die meisten Schülerinnen und Schüler noch nicht. Beim Einkaufen zahlst du trotzdem Steuern, nur siehst du sie nicht.</p>
  <section class="card"><h3>Dein Wochenkorb</h3><p class="small muted">Stelle ein, was du in einer typischen Woche kaufst. Preise sind Beispielpreise.</p>
    <div class="basket">${BASKET.map((b, i) => `<div class="item"><span class="nm">${b[0]}<small>${eur(b[1])} · ${b[2] === "fuel" ? "19 % + 65,45 ct Energiesteuer" : (b[2] * 100) + " % USt"}</small></span><span class="counter"><button type="button" data-bk="${i}" data-d="-1" aria-label="weniger ${esc(b[0])}">−</button><output id="bk-${i}">${c[i] || 0}</output><button type="button" data-bk="${i}" data-d="1" aria-label="mehr ${esc(b[0])}">+</button></span></div>`).join("")}</div>
    <div class="kpis" id="basketOut"></div>
  </section>
  <section class="card flat"><h3>Und Kane?</h3>
    <p>Kane tankt seinen Wagen mit 80 Litern Benzin. Er zahlt <b>52,36 € Energiesteuer</b>, genau so viel wie jeder andere für 80 Liter. Umsatz- und Energiesteuer hängen nicht vom Einkommen ab, sondern vom Konsum.</p>
    <p class="small muted">Steuersätze 2026: Umsatzsteuer 19 %, ermäßigt 7 % (u. a. Lebensmittel, Bücher, Nahverkehr, seit 2026 auch Speisen im Restaurant). Energiesteuer Benzin 65,45 ct/l, Diesel 47,04 ct/l. Stromsteuer 2,05 ct/kWh.</p>
  </section>
  ${writeTask("a1", 1, `<span class="op">Nenne</span> die Steuern, die du selbst bezahlst, und gib die Steuersätze an. <span class="op">Schätze</span>, wie viel du in der letzten Woche zum Steueraufkommen beigetragen hast, und vergleiche mit Harry Kane.`,
    `Denk an alles, was du kaufst oder nutzt: Essen, Kleidung, Handy, Tanken, Strom zu Hause. Der Wochenkorb oben liefert dir die Zahl für die Schätzung. Für den Vergleich: Welche Steuer zahlt Kane, die du (noch) nicht zahlst?`,
    `<p>Ich zahle vor allem <b>indirekte Steuern</b>, die im Preis stecken: die <b>Umsatzsteuer</b> mit 19 % (z. B. Kleidung, Energydrinks, Handyguthaben) oder ermäßigt 7 % (z. B. Lebensmittel, Bücher, Busfahrten), die <b>Energiesteuer</b> beim Tanken (65,45 Cent je Liter Benzin) und über die Stromrechnung der Familie die Stromsteuer. Lohn- oder Einkommensteuer zahle ich nicht, weil mein Einkommen unter dem Grundfreibetrag von 12.348 € liegt.</p><p>Schätzung: Bei rund 60 € Ausgaben pro Woche stecken etwa 6 bis 9 € Umsatzsteuer darin, mit Tanken kommen ein paar Euro Energiesteuer dazu.</p><p>Kane zahlt beim Einkaufen dieselben Sätze, durch seinen höheren Konsum aber absolut mehr. Der weitaus größte Teil seiner Steuerlast ist jedoch die <b>Einkommensteuer</b> (rund 11 Mio. € im Jahr). Erwachsene mit hohem Einkommen tragen also viel mehr zum Steueraufkommen bei als Jugendliche.</p>`,
    ["mindestens zwei Steuerarten mit Steuersatz genannt?", "eine Zahl für deine Woche geschätzt und begründet?", "erklärt, warum du (noch) keine Einkommensteuer zahlst?", "Kane mit dir verglichen (Konsumsteuern gleich, Einkommensteuer verschieden)?"])}`;
}, after: () => updateBasket() });
function updateBasket() {
  const el = document.getElementById("basketOut"); if (!el) return;
  const r = basketCalc(store.get("basket", {}));
  el.innerHTML = `<div class="kpi"><b>${eur(r.sum)}</b><span>ausgegeben</span></div><div class="kpi"><b>${eur(r.ust)}</b><span>davon Umsatzsteuer</span></div><div class="kpi"><b>${eur(r.en)}</b><span>davon Energiesteuer</span></div><div class="kpi"><b>${r.sum ? nf((r.ust + r.en) / r.sum * 100, 1) : "0"} %</b><span>Steueranteil am Einkauf</span></div>`;
}

/* 2 Steuer oder Beitrag */
function slipRows(p, div = 12) {
  const r = (l, v, c = "") => `<tr class="${c}"><td>${l}</td><td>${eur(v / div)}</td></tr>`;
  return r("Bruttogehalt", p.J, "sum") + r("Lohnsteuer", p.e) + r("Solidaritätszuschlag", p.s) + r("Kirchensteuer", p.ki) + r("Summe Steuern", p.tax, "sum") +
    r("Rentenversicherung", p.rv) + r("Arbeitslosenversicherung", p.av) + r("Krankenversicherung", p.kv) + r("Pflegeversicherung", p.pv) + r("Summe Sozialversicherung", p.sv, "sum") + r("Nettogehalt", p.net, "sum");
}
function stack(p) {
  const t = p.tax / p.J * 100, s = p.sv / p.J * 100, n = 100 - t - s;
  const seg = (w, c, l) => `<span style="width:${w}%;background:${c}" title="${l}">${w > 9 ? nf(w, 1) + " %" : ""}</span>`;
  return `<div class="stackbar">${seg(t, "var(--c-tax)", "Steuern")}${seg(s, "var(--c-sv)", "Sozialbeiträge")}${seg(n, "var(--c-net)", "Netto")}</div>`;
}
S.push({ short: "Abzüge", title: "Steuer oder Beitrag?", render: () => {
  const b = store.get("brutto", 3500);
  return `<h2>Zwei Gehaltszettel, zwei Welten</h2>
  <p class="lead">Toni ist Zeugwart beim FC Bayern (ausgedachtes Beispiel). Er wäscht Kanes Trikots. Vergleiche die Abzüge.</p>
  <div class="grid2">
    ${material("M2a", "Toni, Zeugwart: Gehalt pro Monat", `<p class="small muted">ledig, kinderlos, Bayern, Kirchensteuer 8 %</p><div class="tbl-wrap"><table><tbody>${slipRows(TONI)}</tbody></table></div>`, "Vereinfachte Berechnung nach Tarif und Beitragssätzen 2026 (KV inkl. halbem Ø-Zusatzbeitrag, PV inkl. Kinderlosenzuschlag).", "model")}
    ${material("M2b", "Harry Kane: Gehalt pro Monat", `<p class="small muted">Gehalt laut Medien, ledig, ohne Kirchensteuer, privat krankenversichert</p><div class="tbl-wrap"><table><tbody>${slipRows(KANE)}</tbody></table></div>`, "Gehalt: Medienberichte (Sky, ran), ca. 25 Mio. € pro Jahr. Krankenversicherung privat, deshalb hier 0.", "model")}
  </div>
  <section class="card"><h3>Wohin geht das Bruttogehalt?</h3>
    <p class="small" style="margin:0">Toni</p>${stack(TONI)}
    <p class="small" style="margin:8px 0 0">Kane</p>${stack(KANE)}
    <div class="legend"><span><i style="background:var(--c-tax)"></i>Steuern</span><span><i style="background:var(--c-sv)"></i>Sozialbeiträge</span><span><i style="background:var(--c-net)"></i>Netto</span></div>
    <p style="margin-top:12px"><b>Leitfrage:</b> Warum zahlt Kane prozentual viel mehr Steuern, aber fast keine Sozialbeiträge?</p>
    <details class="tip"><summary>Erklärung aufklappen</summary><div class="tip-body"><p>Sozialbeiträge werden nur bis zur <b>Beitragsbemessungsgrenze</b> berechnet: 2026 in der Renten- und Arbeitslosenversicherung bis 101.400 € im Jahr, in Kranken- und Pflegeversicherung bis 69.750 €. Jeder Euro darüber ist beitragsfrei. Die Einkommensteuer dagegen steigt <b>progressiv</b> mit dem Einkommen.</p></div></details>
  </section>
  <section class="card"><h3>Rechne selbst: dein späteres Gehalt</h3>
    <label class="fl" for="brutto">Bruttogehalt pro Monat</label>
    <div class="range-row"><input type="range" id="brutto" min="1000" max="12000" step="100" value="${b}"><span class="out" id="bruttoOut"></span></div>
    <div id="bruttoRes"></div>
  </section>
  <section class="card"><h3>Steuer oder Beitrag? Ordne zu.</h3>
  ${assign("sb", ["Steuer", "Beitrag"], [
    ["Muss gezahlt werden, ohne dass man eine bestimmte Gegenleistung dafür bekommt.", 0],
    ["Wer zahlt, erwirbt einen Anspruch, z. B. auf Rente oder Arbeitslosengeld.", 1],
    ["Fließt in den allgemeinen Haushalt und kann für alles verwendet werden.", 0],
    ["Wird zweckgebunden für eine Versicherung verwendet.", 1],
    ["Wird zwischen Arbeitnehmer und Arbeitgeber etwa hälftig geteilt.", 1],
    ["Steigt mit dem Einkommen ohne Obergrenze.", 0],
    ["Umsatzsteuer auf Kanes neue Fußballschuhe", 0],
    ["9,3 % von Tonis Lohn für die Rentenkasse", 1]
  ])}</section>
  ${writeTask("a2", 2, `<span class="op">Grenze</span> Steuern grundsätzlich von Beiträgen zur Sozialversicherung <span class="op">ab</span>. Nutze die Gehaltszettel von Toni und Kane als Beispiele.`,
    `Zwei Fragen helfen: Bekomme ich für meine Zahlung eine bestimmte Gegenleistung? Und wofür darf der Staat bzw. die Versicherung das Geld verwenden? Ein Satz zur Beitragsbemessungsgrenze macht die Antwort stark.`,
    `<p><b>Steuern</b> sind Zwangsabgaben an den Staat, für die man <b>keine direkte Gegenleistung</b> erhält. Sie fließen in den allgemeinen Haushalt und dürfen für alle Staatsaufgaben verwendet werden (Nonaffektationsprinzip). Die Einkommensteuer richtet sich nach der <b>Leistungsfähigkeit</b>: Wer mehr verdient, zahlt einen höheren Anteil. Kane zahlt deshalb etwa 47 % seines Bruttos an Steuern, Toni etwa 12,5 %.</p><p><b>Sozialversicherungsbeiträge</b> sind ebenfalls Pflicht, begründen aber einen <b>Anspruch auf zweckgebundene Leistungen</b>, etwa Rente, Arbeitslosengeld oder Krankenbehandlung. Sie werden meist hälftig von Arbeitnehmer und Arbeitgeber getragen und nur bis zur Beitragsbemessungsgrenze erhoben. Deshalb zahlt Toni rund 22 % seines Bruttos, Kane nur einen winzigen Bruchteil.</p><p>Beide Abgaben finanzieren den Sozialstaat. In der Sozialversicherung findet zusätzlich eine Umverteilung statt, z. B. erhalten in der Krankenversicherung alle die gleiche Behandlung, auch wenn sie unterschiedlich hohe Beiträge zahlen (Solidaritätsprinzip).</p>`,
    ["die fehlende Gegenleistung bei Steuern genannt?", "den Leistungsanspruch bei Beiträgen genannt?", "Zweckbindung bzw. allgemeiner Haushalt unterschieden?", "Toni und Kane als Beispiel genutzt (Progression, Beitragsbemessungsgrenze)?"])}`;
}, after: () => updateBrutto() });
function updateBrutto() {
  const i = document.getElementById("brutto"); if (!i) return;
  const b = +i.value, p = payroll(b);
  document.getElementById("bruttoOut").textContent = eur(b, 0);
  document.getElementById("bruttoRes").innerHTML = stack(p) + `<div class="kpis"><div class="kpi"><b>${eur(p.tax / 12)}</b><span>Steuern (${nf(p.tax / p.J * 100, 1)} %)</span></div><div class="kpi"><b>${eur(p.sv / 12)}</b><span>Sozialbeiträge (${nf(p.sv / p.J * 100, 1)} %)</span></div><div class="kpi"><b>${eur(p.net / 12)}</b><span>Netto</span></div></div><p class="small muted">Vereinfachte Modellrechnung 2026, ledig, kinderlos, Bayern, gesetzlich versichert, mit Kirchensteuer. Schiebe über 8.450 €: Was passiert mit dem Anteil der Sozialbeiträge?</p>`;
}

/* 3 Tarif */
S.push({ short: "Tarif", title: "Der Einkommensteuertarif", render: () => {
  const v = store.get("zve", 40000);
  return `<h2>Je mehr Einkommen, desto höher der Steuersatz</h2>
  <p class="lead">Die Einkommensteuer folgt dem Prinzip der Belastung nach Leistungsfähigkeit. Ziehe den Regler und beobachte beide Steuersätze.</p>
  <section class="card">
    <label class="fl" for="zve">Zu versteuerndes Einkommen pro Jahr</label>
    <div class="range-row"><input type="range" id="zve" min="0" max="320000" step="1000" value="${Math.min(v, 320000)}"><span class="out" id="zveOut"></span></div>
    <div class="btnrow"><button type="button" class="btn sm" data-zve="30000">Berufseinstieg 30.000 €</button><button type="button" class="btn sm" data-zve="${Math.round(TONI.zve)}">Toni</button><button type="button" class="btn sm" data-zve="25000000">Kane</button></div>
    <div class="kpis" id="zveRes"></div>
    <svg class="chart-svg" id="tarifChart" viewBox="0 0 640 260" role="img" aria-label="Durchschnitts- und Grenzsteuersatz 2026"></svg>
    <div class="legend"><span><i style="background:var(--accent)"></i>Grenzsteuersatz (auf den letzten Euro)</span><span><i style="background:var(--c-sv)"></i>Durchschnittssteuersatz (auf das ganze Einkommen)</span></div>
    <div class="zones" id="zones">
      <div class="zone" data-z="0"><b>Nullzone</b>bis 12.348 €: 0 %. Grundfreibetrag sichert das Existenzminimum.</div>
      <div class="zone" data-z="1"><b>Progressionszone</b>12.349 bis 69.878 €: Grenzsatz steigt von 14 % auf 42 %.</div>
      <div class="zone" data-z="2"><b>1. Proportionalzone</b>69.879 bis 277.825 €: Spitzensteuersatz 42 %.</div>
      <div class="zone" data-z="3"><b>2. Proportionalzone</b>ab 277.826 €: „Reichensteuer“ 45 %. Leistungsanreiz bleibt.</div>
    </div>
    <p class="source">Tarif nach § 32a EStG für 2026, ohne Solidaritätszuschlag und Kirchensteuer.</p>
  </section>
  <section class="card flat"><h3>Verdient Kane nur mit Fußball?</h3>
    <p>Zum <b>Einkommen</b> zählt nicht nur der Lohn aus nichtselbstständiger Arbeit. Auch Werbeverträge, Mieten aus Immobilien oder Gewinne aus Aktien sind Einkünfte. Kapitalerträge wie Dividenden werden meist pauschal mit 25 % Abgeltungsteuer belegt.</p>
  </section>
  <section class="card"><h3>Kurz geprüft</h3>${quiz("tarif", [
    { q: "Toni verdient 1.000 € mehr im Jahr. Welcher Steuersatz zeigt, wie viel davon an den Staat geht?", o: ["Der Durchschnittssteuersatz", "Der Grenzsteuersatz", "Der Eingangssteuersatz"], a: 1, e: "Der Grenzsteuersatz gilt für den zusätzlichen Euro." },
    { q: "Warum ist ein Einkommen bis 12.348 € steuerfrei?", o: ["Damit Geringverdiener mehr konsumieren", "Das Existenzminimum soll nicht besteuert werden", "Weil der Staat die Steuer nicht eintreiben kann"], a: 1, e: "Der Grundfreibetrag schützt das Existenzminimum." },
    { q: "Kane zahlt Spitzensätze. Liegt sein Durchschnittssteuersatz bei 45 %?", o: ["Ja, genau 45 %", "Knapp darunter, weil die ersten Euro niedriger besteuert werden", "Deutlich darüber"], a: 1, e: "Bei 25 Mio. € liegt der Durchschnittssatz bei etwa 44,9 % (ohne Soli)." },
    { q: "Kanes Dividenden aus Aktien gehören zu ...", o: ["Einkünften aus Kapitalvermögen", "Einkünften aus nichtselbstständiger Arbeit", "steuerfreien Einnahmen"], a: 0, e: "Dafür fällt meist die Abgeltungsteuer an." }
  ])}</section>`;
}, after: () => updateZve() });
function updateZve() {
  const i = document.getElementById("zve"); if (!i) return;
  const x = +i.dataset.override || +i.value, e = est(x), avg = x ? e / x * 100 : 0, mg = (est(x + 1000) - e) / 10;
  document.getElementById("zveOut").textContent = eur(x, 0);
  document.getElementById("zveRes").innerHTML = `<div class="kpi"><b>${eur(e, 0)}</b><span>Einkommensteuer im Jahr</span></div><div class="kpi"><b>${nf(avg, 1)} %</b><span>Durchschnittssteuersatz</span></div><div class="kpi"><b>${nf(mg, 0)} %</b><span>Grenzsteuersatz</span></div>`;
  const z = x <= 12348 ? 0 : x <= 69878 ? 1 : x <= 277825 ? 2 : 3;
  document.querySelectorAll(".zone").forEach(el => el.classList.toggle("on", +el.dataset.z === z));
  drawTarif(Math.min(x, 320000));
}
function drawTarif(mark) {
  const svg = document.getElementById("tarifChart"); if (!svg) return;
  const W = 640, H = 260, L = 40, R = 12, T = 12, B = 30, X = v => L + v / 320000 * (W - L - R), Y = p => T + (1 - p / 50) * (H - T - B);
  let g = "", a = "";
  for (let v = 0; v <= 320000; v += 2000) { const e = est(v); g += `${v ? "L" : "M"}${X(v).toFixed(1)},${Y(v ? (est(v + 1000) - e) / 10 : 0).toFixed(1)}`; a += `${v ? "L" : "M"}${X(v).toFixed(1)},${Y(v ? e / v * 100 : 0).toFixed(1)}`; }
  let grid = "";
  [0, 14, 24, 42].forEach(p => grid += `<line x1="${L}" x2="${W - R}" y1="${Y(p)}" y2="${Y(p)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(p) + 4}" text-anchor="end">${p} %</text>`);
  [0, 100000, 200000, 300000].forEach(v => grid += `<text x="${X(v)}" y="${H - 8}" text-anchor="middle">${v / 1000} T€</text>`);
  svg.innerHTML = grid + `<path d="${g}" fill="none" stroke="var(--accent)" stroke-width="3"/><path d="${a}" fill="none" stroke="var(--c-sv)" stroke-width="3"/><line x1="${X(mark)}" x2="${X(mark)}" y1="${T}" y2="${H - B}" stroke="var(--ink)" stroke-dasharray="4 4"/>`;
}

/* 4 Steuereinnahmen */
S.push({ short: "M1", title: "Steuereinnahmen", render: () => {
  const tot = 989.8;
  return `<h2>Woher hat der Staat sein Geld?</h2>
  <p class="lead">2025 haben Bund, Länder und Gemeinden zusammen <b>989,8 Mrd. €</b> Steuern eingenommen, so viel wie nie zuvor.</p>
  ${material("M1", "Steuereinnahmen 2025 in Mrd. €", bars(M1, { total: tot }), "Quelle: Bundesministerium der Finanzen, Steuereinnahmen 4. Quartal und Gesamtjahr 2025 (29.01.2026); Statistisches Bundesamt. Gemeindesteuern teils als Restgröße berechnet.")}
  <section class="card"><h3>Lies die Statistik</h3>${quiz("m1", [
    { q: "Welche zwei Steuern bringen zusammen mehr als die Hälfte aller Einnahmen?", o: ["Gewerbe- und Körperschaftsteuer", "Umsatzsteuer und Lohnsteuer", "Energie- und Tabaksteuer"], a: 1, e: "310,2 + 262,7 = 572,9 Mrd. €, das sind rund 58 %." },
    { q: "Wer zahlt die Umsatzsteuer letztlich?", o: ["Die Unternehmen", "Die Verbraucherinnen und Verbraucher beim Kauf", "Nur Reiche"], a: 1, e: "Unternehmen führen sie ab, getragen wird sie von den Konsumenten." },
    { q: "Kane zahlt rund 11,2 Mio. € Einkommensteuer. In welchem Balken steckt dieses Geld?", o: ["Lohnsteuer", "Gewerbesteuer", "Abgeltungsteuer"], a: 0, e: "Bei Arbeitnehmern wird die Einkommensteuer als Lohnsteuer direkt vom Gehalt abgezogen." }
  ])}</section>`;
}});

/* 5 Sozialbudget */
S.push({ short: "M3", title: "Das Sozialbudget", render: () => {
  return `<h2>Wer bezahlt die soziale Sicherung?</h2>
  <p class="lead">Das Sozialbudget zeigt alle Sozialleistungen in Deutschland, egal ob Rentenkasse, Krankenkasse, Bund, Land oder Gemeinde sie zahlt.</p>
  ${material("M3", "Auszug aus dem Sozialbudget 2025 in Mrd. €", `<div class="tbl-wrap"><table><thead><tr><th></th><th>Leistungen insgesamt</th><th>Beiträge der Versicherten</th><th>Beiträge der Arbeitgeber</th><th>Zuschüsse des Staates</th></tr></thead><tbody>
    <tr class="sum"><td>Sozialbudget insgesamt</td><td>1.431,0</td><td>461,1</td><td>512,8</td><td>488,1</td></tr>
    <tr><td>Sozialversicherungssysteme<br><span class="small muted">Rente, Kranken-, Pflege-, Unfall-, Arbeitslosenversicherung</span></td><td>866,9</td><td>378,8</td><td>327,4</td><td>144,8</td></tr>
    <tr><td>Förder- und Fürsorgesysteme<br><span class="small muted">u. a. Kindergeld, Bürgergeld, Sozialhilfe, Jugendhilfe, Wohngeld</span></td><td>279,6</td><td>-</td><td>-</td><td>278,7</td></tr>
    <tr><td colspan="5" class="small muted" style="text-align:left">...</td></tr></tbody></table></div>
    <div class="kpis"><div class="kpi"><b>32,0 %</b><span>der Wirtschaftsleistung (BIP) sind Sozialleistungen</span></div><div class="kpi"><b>57,5 Mrd. €</b><span>Bürgergeld 2025</span></div><div class="kpi"><b>124,8 Mrd. €</b><span>Zuschüsse des Staates an die Rentenversicherung</span></div></div>
    <p class="small muted">Die Finanzierung (1.488 Mrd. €) ist etwas höher als die Leistungen, Restbeträge sind sonstige Einnahmen. Arbeitgeberbeiträge enthalten auch „unterstellte“ Beiträge, z. B. Lohnfortzahlung im Krankheitsfall.</p>`,
    "Quelle: Bundesministerium für Arbeit und Soziales, Sozialbudget 2025, Tabelle III-1 (Datenstand Mai 2026, Werte geschätzt).")}
  <section class="card"><h3>Finanzierung im Überblick</h3>
    <p class="small" style="margin:0">Sozialbudget insgesamt</p>${shareBar([461.1, 512.8, 488.1])}
    <p class="small" style="margin:8px 0 0">Sozialversicherungssysteme</p>${shareBar([378.8, 327.4, 144.8])}
    <p class="small" style="margin:8px 0 0">Förder- und Fürsorgesysteme</p>${shareBar([0, 0, 278.7])}
    <div class="legend"><span><i style="background:var(--c-net)"></i>Versicherte</span><span><i style="background:var(--c-sv)"></i>Arbeitgeber</span><span><i style="background:var(--c-state)"></i>Staat</span></div>
  </section>
  ${writeTask("a3", 3, `<span class="op">Beurteile</span> die Ausgaben des Staates im Rahmen des Sozialbudgets. Werte dazu M3 aus und <span class="op">beurteile</span> die Aussagekraft der Statistik, auch im Hinblick auf den Bundeshaushalt (M4, nächste Station).`,
    `Arbeite in drei Schritten: 1. Beschreiben (Thema, Quelle, Jahr, Einheit). 2. Auswerten (Wer trägt wie viel? Wo ist der Staat besonders wichtig?). 3. Aussagekraft (Was zeigt der Ausschnitt nicht? Warum passen die 488 Mrd. € nicht zu den 197 Mrd. € für Arbeit und Soziales im Bundeshaushalt?).`,
    `<p><b>Beschreiben:</b> Die Tabelle zeigt einen Auszug aus dem Sozialbudget 2025 des Bundesarbeitsministeriums in Milliarden Euro. Sie stellt die Leistungen des gesamten Sozialbudgets, der Sozialversicherungen und der Förder- und Fürsorgesysteme ihrer Finanzierung durch Versicherte, Arbeitgeber und Staat gegenüber. Die Werte sind geschätzt.</p><p><b>Auswerten:</b> Insgesamt werden 1.431 Mrd. € geleistet. Die Finanzierung verteilt sich fast zu gleichen Teilen auf Arbeitgeber (512,8 Mrd.), Staat (488,1 Mrd.) und Versicherte (461,1 Mrd.). Die Sozialversicherungen werden überwiegend von Versicherten (378,8 Mrd.) und Arbeitgebern (327,4 Mrd.) getragen, doch auch hier schießt der Staat 144,8 Mrd. € zu, vor allem an die Rentenversicherung. Die Förder- und Fürsorgesysteme wie Kindergeld oder Bürgergeld (279,6 Mrd.) bezahlt der Staat fast vollständig aus Steuern. Die Staatsausgaben sind also erheblich und steigen: Jeder dritte Euro der Wirtschaftsleistung ist eine Sozialleistung.</p><p><b>Aussagekraft:</b> Es handelt sich nur um einen Ausschnitt mit geschätzten Werten; Sondersysteme, Beamtenversorgung und einzelne Leistungen fehlen. „Staat“ meint Bund, Länder und Gemeinden zusammen. Deshalb sind die 488 Mrd. € deutlich mehr als die Sozialausgaben im Bundeshaushalt 2026 (Arbeit und Soziales 197,3 Mrd., Gesundheit 21,8 Mrd., Familie 16,7 Mrd.). Zudem vergleichen M3 und M4 unterschiedliche Jahre und Abgrenzungen. Für die Frage, wie stark der Staat die soziale Sicherung trägt, ist die Statistik dennoch aussagekräftig.</p>`,
    ["Quelle, Jahr und Einheit genannt?", "die drei Finanzierungsquellen mit Zahlen verglichen?", "den hohen Staatsanteil bei Förder- und Fürsorgesystemen erklärt?", "Grenzen der Statistik genannt (Ausschnitt, Schätzung, Staat = Bund + Länder + Gemeinden)?", "den Unterschied zum Bundeshaushalt begründet?"])}`;
}});
function shareBar(v) {
  const t = v.reduce((a, b) => a + b, 0), c = ["var(--c-net)", "var(--c-sv)", "var(--c-state)"];
  return `<div class="stackbar">${v.map((x, i) => x ? `<span style="width:${x / t * 100}%;background:${c[i]}">${x / t * 100 > 8 ? nf(x / t * 100, 0) + " %" : ""}</span>` : "").join("")}</div>`;
}

/* 6 Bundeshaushalt */
S.push({ short: "M4", title: "Der Bundeshaushalt", render: () => {
  return `<h2>Wofür gibt der Bund Geld aus?</h2>
  <p class="lead">Der Bundeshaushalt 2026 umfasst <b>524,5 Mrd. €</b>. Davon stammen 387,2 Mrd. € aus Steuern und 98,0 Mrd. € aus neuen Krediten.</p>
  ${material("M4", "Bundeshaushalt 2026: Ausgaben der Ressorts in Mrd. €", bars(M4, { total: 524.5 }), "Quelle: Bundesministerium der Finanzen, Eckwertebeschluss zum Bundeshaushalt 2027, Anlage 3 (Soll 2026). Verteidigung zusätzlich 25,5 Mrd. € aus dem Sondervermögen Bundeswehr. Aktuelle Zahlen: bundeshaushalt.de")}
  <section class="card flat"><p style="margin:0">Knapp 70 % des Etats für Arbeit und Soziales sind <b>Zuschüsse an die Rentenversicherung</b>. Dazu kommen u. a. Grundsicherung (Bürgergeld) und Arbeitsförderung. 2027 sollen die Ausgaben auf 543,3 Mrd. € steigen.</p></section>
  <section class="card"><h3>Welches Prinzip der Sozialen Marktwirtschaft steckt dahinter?</h3>
  <p class="small muted">Solidarität: Die Gemeinschaft hilft dem Einzelnen. Subsidiarität: Hilfe zur Selbsthilfe, zuerst Eigenverantwortung und Familie, der Staat springt nachrangig ein.</p>
  ${assign("prinzip", ["Solidarität", "Subsidiarität"], [
    ["Bundeszuschuss an die Rentenversicherung (Arbeit und Soziales)", 0],
    ["Weiterbildung und Umschulung für Arbeitslose (Arbeit und Soziales)", 1],
    ["Grundsicherung für Menschen ohne ausreichendes Einkommen", 0],
    ["Elterngeld, damit Familien die Betreuung selbst übernehmen können (Familie)", 1],
    ["Zuschuss des Bundes an die Krankenkassen (Gesundheit)", 0],
    ["BAföG, damit junge Menschen später selbst für sich sorgen können (Forschung, Bildung)", 1]
  ])}</section>
  ${writeTask("a4", 4, `<span class="op">Analysiere</span> den aktuellen Bundeshaushalt (M4) im Hinblick auf die Merkmale der Sozialen Marktwirtschaft. Wer mag, recherchiert die neuesten Zahlen auf <a href="https://www.bundeshaushalt.de" target="_blank" rel="noopener">bundeshaushalt.de</a>.`,
    `Suche dir zwei bis drei große Ressorts heraus. Frage jeweils: Hilft hier die Gemeinschaft den Schwächeren (Solidarität)? Soll jemand befähigt werden, sich selbst zu helfen (Subsidiarität)? Sichert der Staat den Wettbewerb und den Rahmen der Marktwirtschaft?`,
    `<p>Der Bundeshaushalt 2026 zeigt deutlich den Charakter eines <b>Sozialstaats</b>: Mit 197,3 Mrd. € (37,6 %) ist „Arbeit und Soziales“ mit Abstand der größte Posten.</p><p><b>Solidaritätsprinzip:</b> Der größte Teil davon sind Zuschüsse an die Rentenversicherung. Die Steuerzahler stützen damit die Rentner, deren Renten nicht allein aus Beiträgen finanziert werden können. Auch die Grundsicherung für Menschen ohne ausreichendes Einkommen und die Zuschüsse an die Krankenkassen im Etat Gesundheit (21,8 Mrd.) zeigen: Die Gemeinschaft sichert den Einzelnen gegen Notlagen ab.</p><p><b>Subsidiaritätsprinzip:</b> Mittel für Weiterbildung, Umschulung und Arbeitsvermittlung sollen Arbeitslose befähigen, wieder selbst für ihren Lebensunterhalt zu sorgen (Hilfe zur Selbsthilfe). Familienleistungen wie Elterngeld stärken die Familie als erste Hilfeinstanz, BAföG und Bildungsausgaben fördern Eigenverantwortung.</p><p>Daneben finanziert der Haushalt den <b>Ordnungsrahmen</b> (Inneres, Justiz) und öffentliche Güter (Verkehr, Verteidigung, Forschung). Steigende Zinsausgaben (33,6 Mrd.) engen künftige soziale Spielräume ein.</p>`,
    ["den Sozialetat als größten Posten mit Zahl genannt?", "mindestens ein Beispiel für Solidarität erklärt?", "mindestens ein Beispiel für Subsidiarität erklärt?", "einen weiteren Aspekt (Ordnungsrahmen, Schulden) erwähnt?"])}`;
}});

/* 7 Änderungen */
S.push({ short: "M5", title: "Was sich 2027 ändert", render: () => {
  const ch = [
    ["Mindestlohn", "13,90 €", "14,60 €", "+0,70 € pro Stunde", "fix", "beschlossen"],
    ["Grundfreibetrag Einkommensteuer", "12.348 €", "12.564 €", "+216 € pro Jahr", "plan", "Regierungsentwurf"],
    ["Kindergeld", "259 €", "267 €", "+8 € pro Kind und Monat", "plan", "Regierungsentwurf"],
    ["Grundsicherung (früher Bürgergeld), Erwachsene", "563 €", "563 €", "Nullrunde, Umbau zur „Neuen Grundsicherung“", "plan", "voraussichtlich"]
  ];
  return `<h2>Das ändert sich für Verbraucher</h2>
  <p class="lead">Zum 1. Januar 2027 ändern sich wichtige Werte. Rückblick 2025 auf 2026: Mindestlohn 12,82 auf 13,90 €, Grundfreibetrag 12.096 auf 12.348 €, Kindergeld 255 auf 259 €.</p>
  ${material("M5", "Änderungen 2026 auf 2027", `<div class="changes">${ch.map(c => `<div class="change"><div class="small muted">${c[0]}</div><div class="from-to">${c[1]} → ${c[2]}</div><span class="delta">${c[3]}</span><br><span class="status ${c[4]}">${c[5]}</span></div>`).join("")}</div>`,
    "Quellen: Mindestlohnkommission bzw. Mindestlohnanpassungsverordnung; Regierungsentwurf Steuerreform 2027 (Stand Herbst 2026); Angaben zur Grundsicherung 2027 nach Presseberichten, noch nicht endgültig.")}
  <section class="card flat"><h3>Und Toni, und Kane?</h3><p>Der höhere Grundfreibetrag spart Toni einige Dutzend Euro Einkommensteuer im Jahr. Für Kane ist der Betrag im Verhältnis zu seinem Einkommen bedeutungslos. Ein Mindestlohn-Job mit 40 Stunden pro Woche bringt 2027 etwa 2.530 € brutto im Monat.</p></section>
  ${writeTask("a5", 5, `<span class="op">Erkläre</span>, weshalb die Änderungen für Verbraucher in M5 den grundlegenden Merkmalen der Sozialen Marktwirtschaft entsprechen.`,
    `Ordne jede Änderung einem Merkmal zu: Solidarität, Subsidiarität (Hilfe zur Selbsthilfe), Schutz des Existenzminimums, Familienförderung, Umverteilung. Frage auch: Wer bezahlt die Maßnahme?`,
    `<p>Die Änderungen in M5 verbinden freien Markt mit sozialem Ausgleich, dem Kern der Sozialen Marktwirtschaft.</p><p>Die Erhöhung des <b>Mindestlohns</b> auf 14,60 € entspricht dem <b>Subsidiaritätsprinzip</b>: Wer arbeitet, soll von seinem Lohn leben können und nicht auf staatliche Hilfe angewiesen sein. Der Staat setzt nur einen Rahmen, die Löhne zahlen die Unternehmen.</p><p>Die <b>Grundsicherung</b> sichert Menschen, die ihren Lebensunterhalt nicht selbst verdienen können, das Existenzminimum (<b>Solidaritätsprinzip</b>). Dass sie 2027 voraussichtlich nicht steigt, zeigt die Spannung zwischen sozialer Sicherheit und Finanzierbarkeit sowie dem Anreiz zur Arbeitsaufnahme.</p><p>Der höhere <b>Grundfreibetrag</b> stellt sicher, dass das Existenzminimum steuerfrei bleibt, auch wenn die Preise steigen. Besteuert wird erst, wer darüber hinaus leistungsfähig ist. Das höhere <b>Kindergeld</b> unterstützt Familien (Familienförderung, sozialer Ausgleich).</p><p>Finanziert werden Grundsicherung und Kindergeld aus Steuern, die vor allem leistungsfähige Bürgerinnen und Bürger wie Kane über die progressive Einkommensteuer und alle über die Umsatzsteuer zahlen. So entsteht Umverteilung.</p>`,
    ["den Mindestlohn mit Subsidiarität bzw. Hilfe zur Selbsthilfe verbunden?", "die Grundsicherung mit Solidarität und Existenzminimum verbunden?", "Grundfreibetrag und Kindergeld erklärt?", "die Finanzierung über Steuern angesprochen?"])}`;
}});

/* 8 Umverteilung */
S.push({ short: "Umverteilung", title: "Umverteilung", render: () => {
  const kt = KANE.e + KANE.s, rs = 563 * 12;
  return `<h2>Von Kane zur Grundsicherung: Umverteilung</h2>
  <p class="lead">Der Staat nimmt nach Leistungsfähigkeit ein und gibt nach Bedürftigkeit aus.</p>
  <div class="flow" aria-label="Kreislauf der Umverteilung">
    <div class="node">Einnahmen<small>Steuern nach Leistungsfähigkeit, Konsumsteuern, Sozialbeiträge</small></div><div class="arr" aria-hidden="true">→</div>
    <div class="node">Staat und Sozialversicherungen<small>Bundeshaushalt, Sozialbudget</small></div><div class="arr" aria-hidden="true">→</div>
    <div class="node">Ausgaben<small>Rente, Grundsicherung, Kindergeld, Bildung</small></div>
  </div>
  <section class="card"><h3>Was Kanes Steuer finanzieren könnte <span class="model">Modellrechnung</span></h3>
    <div class="kpis">
      <div class="kpi"><b>${mio(kt)}</b><span>Kanes Einkommensteuer und Soli pro Jahr</span></div>
      <div class="kpi"><b>${nf(kt / rs, 0)}</b><span>Jahre Grundsicherung für einen Erwachsenen (563 € × 12)</span></div>
      <div class="kpi"><b>${nf(kt / (267 * 12), 0)}</b><span>Kinder ein Jahr Kindergeld (267 € × 12)</span></div>
      <div class="kpi"><b>${nf(kt / (TONI.tax), 0)}</b><span>mal so viel Steuer wie Toni</span></div>
    </div>
    <p class="small muted">Steuern sind nicht zweckgebunden. Die Rechnung zeigt nur Größenordnungen.</p>
  </section>
  <section class="card"><h3>Bringe die Umverteilung in die richtige Reihenfolge</h3><p class="small muted">Ziehe die Karten am Griff oder nutze die Pfeile.</p>
  ${orderTask("flow", [
    "Kane erhält sein Gehalt von 25 Mio. € brutto.",
    "Der Verein zieht Lohnsteuer und Solidaritätszuschlag ab und führt sie an das Finanzamt ab.",
    "Die Steuer fließt in die Haushalte von Bund, Ländern und Gemeinden.",
    "Der Bundestag beschließt im Haushalt, wofür das Geld ausgegeben wird.",
    "Der Bund zahlt Zuschüsse an die Rentenversicherung und finanziert die Grundsicherung.",
    "Eine Rentnerin mit kleiner Rente und ein Arbeitsloser erhalten Leistungen."
  ])}</section>
  ${writeTask("a6", 6, `<span class="op">Stelle dar</span>, wie der Staat in der Sozialen Marktwirtschaft versucht, eine Umverteilung zu erreichen (M1 bis M5). Nutze Kane und Toni als Beispiele.`,
    `Gliedere in zwei Teile: 1. Wie nimmt der Staat Geld ein, und wer zahlt wie viel (M1, M2, Tarif)? 2. Wofür gibt er es aus, und wer profitiert (M3, M4, M5)? Ein Satz zum Umfang macht die Darstellung vollständig.`,
    `<p><b>Einnahmen nach Leistungsfähigkeit:</b> Der Staat finanziert sich vor allem über Steuern (2025: 989,8 Mrd. €, M1). Die Einkommensteuer ist progressiv: Kane zahlt rund 47 % seines Gehalts an Steuern, Toni rund 12,5 % (M2). Wer mehr leisten kann, soll mehr beitragen. Über Konsumsteuern wie Umsatz- und Energiesteuer zahlen alle, wer mehr konsumiert, zahlt mehr. Dazu kommen Sozialbeiträge, die allerdings nur bis zur Beitragsbemessungsgrenze erhoben werden.</p><p><b>Ausgaben nach Bedürftigkeit:</b> Mit diesen Mitteln finanziert der Staat Leistungen für Menschen, die sich nicht selbst helfen können: Grundsicherung, Kindergeld, Zuschüsse zur Rente (M4, M5). Der Umfang ist groß: Das Sozialbudget umfasst 1.431 Mrd. €, davon trägt der Staat 488 Mrd. € (M3); im Bundeshaushalt 2026 entfallen 37,6 % auf Arbeit und Soziales (M4).</p><p><b>Ergebnis:</b> Geld fließt von leistungsfähigen zu bedürftigen Menschen. Allein Kanes Steuer entspricht rechnerisch rund 1.750 Jahren Grundsicherung für einen Erwachsenen. Gleichzeitig setzt der Staat auf Hilfe zur Selbsthilfe (Mindestlohn, Weiterbildung), damit Umverteilung den Leistungsanreiz nicht zerstört.</p>`,
    ["die Einnahmenseite mit progressiver Steuer erklärt?", "Konsumsteuern und Beiträge erwähnt?", "die Ausgabenseite mit Beispielen aus M3 bis M5 dargestellt?", "den Umfang der Umverteilung mit Zahlen belegt?", "Kane und Toni als Beispiele genutzt?"])}`;
}});

/* 9 Abpfiff */
S.push({ short: "Abpfiff", title: "Abpfiff", render: () => {
  return `<h2>Abpfiff: Teste dich</h2>
  <section class="card">${quiz("final", [
    { q: "Welche Aussage über Sozialversicherungsbeiträge stimmt?", o: ["Sie steigen ohne Obergrenze mit dem Einkommen.", "Sie werden nur bis zur Beitragsbemessungsgrenze erhoben.", "Sie fließen in den allgemeinen Bundeshaushalt."], a: 1, e: "Deshalb zahlt Kane prozentual kaum Beiträge." },
    { q: "Größter Posten im Bundeshaushalt 2026?", o: ["Verteidigung", "Arbeit und Soziales", "Bundesschuld"], a: 1, e: "197,3 Mrd. €, also 37,6 %." },
    { q: "Wer finanziert die Förder- und Fürsorgesysteme (z. B. Kindergeld) fast vollständig?", o: ["Die Arbeitgeber", "Die Versicherten", "Der Staat aus Steuern"], a: 2, e: "278,7 von 279,6 Mrd. € (2025)." },
    { q: "Die Erhöhung des Mindestlohns entspricht vor allem ...", o: ["dem Subsidiaritätsprinzip", "dem Äquivalenzprinzip der Krankenkasse", "dem Prinzip der Planwirtschaft"], a: 0, e: "Wer arbeitet, soll von seinem Lohn leben können: Hilfe zur Selbsthilfe." },
    { q: "Ein Einkommen bis 12.348 € (2026) ist steuerfrei, weil ...", o: ["das Existenzminimum geschützt wird.", "Kleinverdiener keine Steuererklärung abgeben.", "der Staat genug Geld hat."], a: 0, e: "Grundfreibetrag = Nullzone." },
    { q: "Was beschreibt Umverteilung in der Sozialen Marktwirtschaft am besten?", o: ["Alle zahlen gleich viel und bekommen gleich viel.", "Einnahmen nach Leistungsfähigkeit, Ausgaben nach Bedürftigkeit.", "Der Staat legt alle Löhne fest."], a: 1, e: "Genau das ist der Kern." }
  ])}</section>
  <section class="card flat"><h3>Quellen</h3><ul class="sources">
    <li>Bundesministerium der Finanzen: Steuereinnahmen 4. Quartal und Gesamtjahr 2025 (29.01.2026)</li>
    <li>Statistisches Bundesamt: Steuereinnahmen 2025 (989,8 Mrd. €)</li>
    <li>Bundesministerium für Arbeit und Soziales: Sozialbudget 2025, Tabellen III-1 und III-3 (Datenstand Mai 2026)</li>
    <li>Bundesministerium der Finanzen: Eckwerte Bundeshaushalt 2027, Anlage 3, Soll 2026; <a href="https://www.bundeshaushalt.de" target="_blank" rel="noopener">bundeshaushalt.de</a></li>
    <li>§ 32a Einkommensteuergesetz (Tarif 2026); Beitragssätze und Beitragsbemessungsgrenzen 2026</li>
    <li>Mindestlohn 2027, Regierungsentwurf Steuerreform 2027 (Grundfreibetrag, Kindergeld), Presseberichte zur Grundsicherung 2027</li>
    <li>Kanes Gehalt: Medienberichte (u. a. Sky Sport, ran.de), keine offiziellen Vereinsangaben</li>
    <li>Toni ist eine ausgedachte Person. Alle Gehaltsrechnungen sind vereinfachte Modellrechnungen.</li>
  </ul><p class="small muted">Bezug: startup.WR 11 Gymnasium Bayern, Kapitel 1.6, Aufgaben 1 bis 6. Materialien hier mit aktuellen Zahlen neu erstellt.</p>
  <div class="btnrow"><button type="button" class="btn ghost" id="resetAll">Alle meine Eingaben löschen</button></div></section>`;
}});

/* ---------- Navigation ---------- */
let cur = Math.min(Math.max(+store.get("station", 0) || 0, 0), S.length - 1);
const main = document.getElementById("main"), stepsEl = document.getElementById("steps");
function renderSteps() {
  const visited = store.get("visited", [0]);
  stepsEl.innerHTML = S.map((s, i) => `<button type="button" class="step${visited.includes(i) ? " done" : ""}" data-go="${i}" ${i === cur ? 'aria-current="step"' : ""} aria-label="${i + 1}: ${esc(s.title)}">${i === 0 ? "Start" : i}<span class="lbl">${i ? " " + esc(s.short) : ""}</span></button>`).join("");
  const a = stepsEl.querySelector("[aria-current]"); if (a) a.scrollIntoView({ block: "nearest", inline: "center" });
}
function go(i) {
  if (i < 0 || i >= S.length) return;
  cur = i; store.set("station", i);
  const v = store.get("visited", [0]); if (!v.includes(i)) { v.push(i); store.set("visited", v); }
  main.innerHTML = `<div class="station">${S[i].render()}</div>`;
  if (S[i].after) S[i].after();
  document.getElementById("prevBtn").disabled = i === 0;
  document.getElementById("nextBtn").disabled = i === S.length - 1;
  document.getElementById("pagerLabel").textContent = `${i + 1} von ${S.length}: ${S[i].title}`;
  renderSteps();
  window.scrollTo({ top: 0, behavior: "auto" });
  main.focus({ preventScroll: true });
}
document.getElementById("prevBtn").onclick = () => go(cur - 1);
document.getElementById("nextBtn").onclick = () => go(cur + 1);

/* ---------- Ereignisse ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.go !== undefined) return go(+t.dataset.go);
  if (t.id === "reveal") { store.set("revealed", true); const o = document.getElementById("revealOut"); o.hidden = false; return; }
  if (t.dataset.bk !== undefined) { const c = store.get("basket", {}), i = t.dataset.bk; c[i] = Math.max(0, Math.min(30, (c[i] || 0) + +t.dataset.d)); store.set("basket", c); document.getElementById("bk-" + i).textContent = c[i]; return updateBasket(); }
  if (t.dataset.zve) { const i = document.getElementById("zve"), v = +t.dataset.zve; if (v > 320000) { i.value = 320000; i.dataset.override = v; } else { i.value = v; delete i.dataset.override; } store.set("zve", v); return updateZve(); }
  if (t.dataset.sol) { const id = t.dataset.sol, box = document.getElementById("sol-" + id); if (box.hidden) { box.innerHTML = solHtml(id); box.hidden = false; t.textContent = "Musterlösung ausblenden"; } else { box.hidden = true; t.textContent = "Musterlösung anzeigen"; } return; }
  if (t.dataset.q) { const q = QUIZ[t.dataset.q][+t.dataset.qi], wrap = t.parentElement, fb = document.getElementById(`fb-${t.dataset.q}-${t.dataset.qi}`);
    wrap.querySelectorAll(".opt").forEach(b => b.classList.remove("correct", "wrong"));
    const ok = +t.dataset.oi === q.a; t.classList.add(ok ? "correct" : "wrong");
    fb.className = "fb " + (ok ? "ok" : "no"); fb.textContent = (ok ? "Richtig. " : "Noch nicht. ") + (ok ? q.e : "Versuche es noch einmal."); return; }
  if (t.dataset.as) { const id = t.dataset.as, st = store.get("a:" + id, {}); st[t.dataset.i] = +t.dataset.c; store.set("a:" + id, st);
    t.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === t)); document.getElementById(`as-${id}-${t.dataset.i}`).classList.remove("correct", "wrong"); return; }
  if (t.dataset.ascheck) { const id = t.dataset.ascheck, A = ASSIGN[id], st = store.get("a:" + id, {}); let r = 0, open = 0;
    A.items.forEach((it, i) => { const el = document.getElementById(`as-${id}-${i}`); el.classList.remove("correct", "wrong"); if (st[i] === undefined) { open++; return; } const ok = st[i] === it[1]; if (ok) r++; el.classList.add(ok ? "correct" : "wrong"); });
    const fb = document.getElementById("asfb-" + id); fb.className = "fb " + (r === A.items.length ? "ok" : "no");
    fb.textContent = r === A.items.length ? "Alles richtig zugeordnet." : `${r} von ${A.items.length} richtig${open ? `, ${open} noch offen` : ""}. Rote Karten noch einmal überdenken.`; return; }
  if (t.dataset.mv) { const li = t.closest(".sortcard"), ol = li.parentElement; if (+t.dataset.mv < 0 && li.previousElementSibling) ol.insertBefore(li, li.previousElementSibling); else if (+t.dataset.mv > 0 && li.nextElementSibling) ol.insertBefore(li.nextElementSibling, li); saveOrder(ol); t.focus(); return; }
  if (t.dataset.ocheck) { const id = t.dataset.ocheck, ol = document.getElementById("ol-" + id); let r = 0; [...ol.children].forEach((li, pos) => { const ok = +li.dataset.idx === pos; if (ok) r++; li.classList.remove("correct", "wrong"); li.classList.add(ok ? "correct" : "wrong"); });
    const fb = document.getElementById("ofb-" + id), n = ol.children.length; fb.className = "fb " + (r === n ? "ok" : "no"); fb.textContent = r === n ? "Perfekt, die Reihenfolge stimmt." : `${r} von ${n} Karten stehen richtig. Verschiebe die roten Karten.`; return; }
  if (t.id === "resetAll") { if (confirm("Wirklich alle Eingaben auf diesem Gerät löschen?")) { try { Object.keys(localStorage).filter(k => k.startsWith(KEY)).forEach(k => localStorage.removeItem(k)); } catch (er) { } go(0); } return; }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.matches("textarea[data-id]")) { const id = t.dataset.id; store.set("w:" + id, t.value);
    const need = Math.floor(WRITE[id].solution.replace(/<[^>]+>/g, "").length * 0.5); const b = document.querySelector(`[data-sol="${id}"]`); if (b && t.value.trim().length >= need) b.disabled = false;
    const sv = document.getElementById("sv-" + id); sv.textContent = "Gespeichert"; clearTimeout(sv._t); sv._t = setTimeout(() => sv.textContent = "", 1500); }
  if (t.id === "guess") { store.set("guess", +t.value); document.getElementById("guessOut").textContent = t.value + " %"; }
  if (t.id === "brutto") { store.set("brutto", +t.value); updateBrutto(); }
  if (t.id === "zve") { delete t.dataset.override; store.set("zve", +t.value); updateZve(); }
});
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset.ck) return;
  const id = t.dataset.ck, d = new Set(store.get("c:" + id, [])); t.checked ? d.add(+t.dataset.i) : d.delete(+t.dataset.i); store.set("c:" + id, [...d]);
});
function saveOrder(ol) { store.set("o:" + ol.dataset.order, [...ol.children].map(li => +li.dataset.idx)); ol.querySelectorAll(".sortcard").forEach(li => li.classList.remove("correct", "wrong")); }

/* Drag and Drop mit Pointer-Events (am Griff) */
let drag = null;
document.addEventListener("pointerdown", e => {
  const h = e.target.closest(".handle"); if (!h) return;
  const li = h.closest(".sortcard"); e.preventDefault(); h.setPointerCapture(e.pointerId);
  drag = { li, ol: li.parentElement, y0: e.clientY, h }; li.classList.add("dragging");
});
document.addEventListener("pointermove", e => {
  if (!drag) return; const { li, ol } = drag; const dy = e.clientY - drag.y0; li.style.transform = `translateY(${dy}px)`;
  const r = li.getBoundingClientRect(), mid = r.top + r.height / 2;
  const prev = li.previousElementSibling, next = li.nextElementSibling;
  if (prev && mid < prev.getBoundingClientRect().top + prev.offsetHeight / 2) { ol.insertBefore(li, prev); drag.y0 -= prev.offsetHeight + 8; li.style.transform = `translateY(${e.clientY - drag.y0}px)`; }
  else if (next && mid > next.getBoundingClientRect().top + next.offsetHeight / 2) { ol.insertBefore(next, li); drag.y0 += next.offsetHeight + 8; li.style.transform = `translateY(${e.clientY - drag.y0}px)`; }
});
const endDrag = () => { if (!drag) return; drag.li.style.transform = ""; drag.li.classList.remove("dragging"); saveOrder(drag.ol); drag = null; };
document.addEventListener("pointerup", endDrag); document.addEventListener("pointercancel", endDrag);

/* Wischen zwischen Stationen */
let sw = null;
main.addEventListener("touchstart", e => {
  if (e.touches.length !== 1) return;
  if (e.target.closest("input,textarea,select,.handle,.tbl-wrap,.sortlist,details[open] .tip-body,svg")) { sw = null; return; }
  sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
main.addEventListener("touchend", e => {
  if (!sw || drag) return; const dx = e.changedTouches[0].clientX - sw.x, dy = e.changedTouches[0].clientY - sw.y;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - sw.t < 800) go(cur + (dx < 0 ? 1 : -1));
  sw = null;
}, { passive: true });
document.addEventListener("keydown", e => {
  if (e.target.closest("input,textarea")) return;
  if (e.key === "ArrowRight" && !e.altKey) go(cur + 1); if (e.key === "ArrowLeft" && !e.altKey) go(cur - 1);
});

go(cur);
