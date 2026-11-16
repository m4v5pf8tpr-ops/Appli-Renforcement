import {
  OBJECTIFS, NIVEAUX, EQUIPEMENTS, JOURS, canDo, buildSession, targetLabel,
  estimateMinutes, isoDay, dateKey, weekStart, weekStreak,
} from "./plan.js";

/* ---------- Stockage local (rien ne quitte le téléphone) ---------- */
const KEY = "renfo.v1";
const store = (() => {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { s = {}; }
  s.profile ??= null; s.history ??= []; s.meta ??= {};
  return s;
})();
const save = () => localStorage.setItem(KEY, JSON.stringify(store));

/* ---------- Utilitaires ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const view = $("#view");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmtDate = d => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
const mmss = sec => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;

let data;
let cleanup = () => {};   // arrêt des animations / minuteurs de la vue courante
let dayMode = "normal";   // ajustement de la séance du jour

/* ---------- Silhouettes animées (moteur de l'atlas) ---------- */
function mountFigure(box, exName) {
  const { POSES, makeFigure, autoVB } = window.Figures;
  const spec = POSES[exName];
  if (!spec) { box.innerHTML = ""; return () => {}; }
  const fig = makeFigure(spec);
  const sex = store.profile?.sex || "M";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", (spec.vb || autoVB(spec, fig)).join(" "));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Mouvement : ${exName}`);
  box.replaceChildren(svg);
  if (reducedMotion || spec.k.length === 1) { svg.innerHTML = fig.draw(sex, fig.tl.total * 0.5); return () => {}; }
  let raf, last = 0;
  const t0 = performance.now();
  const loop = now => {
    if (now - last > 33) { svg.innerHTML = fig.draw(sex, (now - t0) / 1000); last = now; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

/* ---------- Son, écran allumé ---------- */
let audio;
function beep(freq = 880, ms = 160) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = freq; g.gain.value = 0.15;
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + ms / 1000);
  } catch { /* son indisponible : on continue sans */ }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* non supporté */ }
}

/* ---------- Sauvegarde : export / import ---------- */
async function exportData() {
  const today = dateKey(new Date());
  const payload = JSON.stringify({ app: "renfo", v: 1, exportedAt: new Date().toISOString(), profile: store.profile, history: store.history }, null, 1);
  const name = `renfo-sauvegarde-${today}.json`;
  const file = new File([payload], name, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Sauvegarde Renfo" });
    else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    store.meta.lastExport = Date.now(); save();
    return true;
  } catch (e) {
    if (e.name !== "AbortError") alert("Export impossible : " + e.message);
    return false;
  }
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== "renfo" || !d.profile || !Array.isArray(d.history)) throw new Error("ce fichier n'est pas une sauvegarde Renfo");
    if (!confirm(`Remplacer les données actuelles par la sauvegarde du ${new Date(d.exportedAt).toLocaleDateString("fr-FR")} (${d.history.length} séances) ?`)) return;
    store.profile = d.profile; store.history = d.history; store.meta.lastExport = Date.now(); save();
    location.hash = "#/"; route();
  } catch (e) { alert("Import impossible : " + e.message); }
}
async function requestPersistence() {
  try { if (navigator.storage?.persist) store.meta.persisted = await navigator.storage.persist(); save(); } catch { /* ignoré */ }
}

/* ---------- Formulaire de profil (onboarding et page Profil) ---------- */
function profileForm(p) {
  const radio = (name, value, checked, label = value) =>
    `<label class="chip"><input type="radio" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""} required><span>${esc(label)}</span></label>`;
  const check = (name, value, checked, label = value) =>
    `<label class="chip"><input type="checkbox" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
  return `
  <form id="profile-form">
    <fieldset><legend>Ton objectif</legend>
      <p class="hint">Il fixe la séance type et les exercices prioritaires.</p>
      ${OBJECTIFS.map(g => `<div class="group-title">${g.label}</div><div class="chips">${g.items.map(o => radio("objective", o, p.objective === o)).join("")}</div>`).join("")}
    </fieldset>
    <fieldset><legend>Ton niveau</legend>
      <p class="hint">Les exercices au-dessus sont remplacés par un équivalent.</p>
      <div class="chips">${NIVEAUX.map(n => radio("level", n, p.level === n)).join("")}</div>
    </fieldset>
    <fieldset><legend>Le matériel que tu as chez toi</legend>
      <p class="hint">Rien coché = poids du corps uniquement.</p>
      <div class="chips">${EQUIPEMENTS.map(q => check("equipment", q, p.equipment?.includes(q))).join("")}</div>
    </fieldset>
    <fieldset><legend>Tes jours de séance</legend>
      <p class="hint">Deux ou trois jours non consécutifs suffisent pour progresser.</p>
      <div class="chips">${JOURS.map((j, i) => check("days", i + 1, p.days?.includes(i + 1), j)).join("")}</div>
    </fieldset>
    <fieldset><legend>Silhouette affichée</legend>
      <div class="chips">${radio("sex", "M", p.sex !== "F", "Homme")}${radio("sex", "F", p.sex === "F", "Femme")}</div>
    </fieldset>
    <button class="primary block" type="submit">Enregistrer</button>
  </form>`;
}
function readProfileForm(form) {
  const f = new FormData(form);
  return {
    objective: f.get("objective"), level: f.get("level"), sex: f.get("sex"),
    equipment: f.getAll("equipment"), days: f.getAll("days").map(Number).sort(),
  };
}

/* ---------- Vues ---------- */
function vOnboarding() {
  view.innerHTML = `
    <div class="label">Bienvenue</div>
    <h1>Une séance prête chaque jour prévu. Tu n'as plus qu'à la faire.</h1>
    <p class="muted">Réponds une fois à ces questions. Tes réponses restent sur ce téléphone, rien n'est envoyé.</p>
    <p class="banner">Ces exercices ne remplacent pas un avis médical. En cas de douleur, de blessure ou de pathologie, demande conseil à un professionnel avant de commencer.</p>
    ${profileForm({ level: "Débutant", days: [1, 3, 5] })}`;
  $("#profile-form").onsubmit = async e => {
    e.preventDefault();
    store.profile = { ...readProfileForm(e.target), createdAt: Date.now() };
    save(); await requestPersistence();
    location.hash = "#/"; route();
  };
}

function vHome() {
  const p = store.profile, now = new Date(), today = dateKey(now), dow = isoDay(now);
  const doneDates = new Set(store.history.map(h => h.date));
  const ws = weekStart(now);
  const days = JOURS.map((j, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i);
    const cls = ["day", p.days.includes(i + 1) && "planned", doneDates.has(dateKey(d)) && "done", i + 1 === dow && "today"].filter(Boolean).join(" ");
    return `<div class="${cls}">${j}<b>${d.getDate()}</b></div>`;
  }).join("");
  const weekDone = JOURS.filter((_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return doneDates.has(dateKey(d)); }).length;
  const streak = weekStreak(store.history, p.days, now);
  const needBackup = store.history.length > 0 && (!store.meta.lastExport || Date.now() - store.meta.lastExport > 14 * 864e5);
  const plannedToday = p.days.includes(dow);
  const doneToday = doneDates.has(today);

  const s = buildSession(p, data, { mode: dayMode });
  const totalSets = s.items.reduce((a, it) => a + it.sets, 0);
  const sessionCard = `
    <section class="card">
      <div class="row between"><div class="label">${doneToday ? "Séance faite aujourd'hui" : plannedToday ? "Séance du jour" : "Séance en plus"}</div><div class="label">${esc(p.level)}</div></div>
      <h2 style="margin-top:8px">${esc(p.objective)}</h2>
      <div class="stats"><div><span class="label">Durée</span><b>~${estimateMinutes(s)} min</b></div><div><span class="label">Exercices</span><b>${s.items.length}</b></div><div><span class="label">Séries</span><b>${totalSets}</b></div></div>
      <button class="primary block" id="start">${doneToday ? "Refaire une séance" : "Démarrer"}</button>
      <div class="adjust" role="group" aria-label="Ajuster la séance">
        <button type="button" data-mode="fatigue" aria-pressed="${dayMode === "fatigue"}">Fatigué</button>
        <button type="button" data-mode="express" aria-pressed="${dayMode === "express"}">Pas le temps</button>
      </div>
      <ol class="session-list">${s.items.map(it => `
        <li><span class="name">${esc(it.ex.n)}</span>
          <span class="sub">${it.sets} × ${esc(targetLabel(it.dose))} · repos ${mmss(it.restSec)}</span>
          ${it.replaces ? `<span class="rep">remplace ${esc(it.replaces)}</span>` : ""}</li>`).join("")}
      </ol>
    </section>`;

  view.innerHTML = `
    <div class="label">${fmtDate(now)} · Sem. ${isoWeek(now)}</div>
    <h1>${doneToday ? "C'est fait pour aujourd'hui." : plannedToday ? "Ta séance t'attend." : "Jour de repos."}</h1>
    <div class="week">${days}</div>
    <div class="stats" style="margin-top:0">
      <div><span class="label">Cette semaine</span><b>${weekDone} / ${p.days.length}</b></div>
      <div><span class="label">Semaines tenues</span><b>${streak}</b></div>
      <div><span class="label">Total</span><b>${store.history.length}</b></div>
    </div>
    ${needBackup ? `<div class="banner">Ton historique n'existe que sur ce téléphone. Sauvegarde-le dans Fichiers ou iCloud Drive.<br><button class="small" id="backup">Sauvegarder maintenant</button></div>` : ""}
    ${plannedToday || doneToday || dayMode !== "normal" || vHome.forced ? sessionCard
      : `<section class="card"><p>Rien de prévu aujourd'hui. Le repos fait partie de la progression.</p><button class="ghost block" id="force">Faire une séance quand même</button></section>`}`;

  $("#backup")?.addEventListener("click", async () => { if (await exportData()) route(); });
  $("#force")?.addEventListener("click", () => { vHome.forced = true; route(); });
  $("#start")?.addEventListener("click", () => { beep(660, 1); startPlayer(s); });
  view.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { dayMode = dayMode === b.dataset.mode ? "normal" : b.dataset.mode; route(); });
}

/* ---------- Lecteur de séance ---------- */
let player = null;
function startPlayer(session) {
  player = { session, i: 0, set: 0, phase: "work", restEnd: 0, chrono: null, doneSets: 0 };
  keepAwake(true);
  location.hash = "#/seance";
}
function finishPlayer(completed) {
  const p = player;
  keepAwake(false);
  if (completed || p.doneSets > 0) {
    const today = dateKey(new Date());
    store.history = store.history.filter(h => h.date !== today);
    store.history.push({ date: today, objective: p.session.objective, mode: p.session.mode, sets: p.doneSets, exercises: p.session.items.map(it => it.ex.id), completed });
    save();
  }
}

function vPlayer() {
  if (!player) { location.hash = "#/"; return; }
  const p = player, items = p.session.items, it = items[p.i];
  const pct = ((p.i + (p.phase === "done" ? 1 : p.set / it.sets)) / items.length) * 100;
  const head = `
    <div class="row between"><div class="label">${p.phase === "done" ? "Terminé" : `Exercice ${p.i + 1} / ${items.length}`}</div>
      <button class="back small" id="quit">${p.phase === "done" ? "" : "Arrêter"}</button></div>
    <div class="progress"><i style="width:${pct}%"></i></div>`;

  if (p.phase === "done") {
    view.innerHTML = `<div class="player">${head}
      <h1>Séance terminée.</h1><p class="muted">${p.doneSets} série${p.doneSets > 1 ? "s" : ""} faite${p.doneSets > 1 ? "s" : ""}. C'est enregistré sur ce téléphone.</p>
      <div class="actions"><button class="primary block" id="home">Retour</button></div></div>`;
    $("#home").onclick = () => { player = null; dayMode = "normal"; vHome.forced = false; location.hash = "#/"; };
    return;
  }

  if (p.phase === "rest") {
    const nextLabel = p.set < it.sets ? `${it.ex.n} — série ${p.set + 1} / ${it.sets}` : items[p.i + 1].ex.n;
    view.innerHTML = `<div class="player">${head}
      <div class="label" style="text-align:center;margin-top:30px">Repos</div>
      <div class="big-timer" id="rest">--</div>
      <p class="muted" style="text-align:center">Ensuite : <b>${esc(nextLabel)}</b></p>
      <div class="fig" id="fig" style="margin-top:12px"></div>
      <div class="actions"><div class="row"><button id="plus">+15 s</button><button class="primary" id="skip">Passer</button></div></div></div>`;
    const nextEx = p.set < it.sets ? it.ex : items[p.i + 1].ex;
    const stopFig = mountFigure($("#fig"), nextEx.n);
    const advance = () => {
      if (p.set >= it.sets) { p.i++; p.set = 0; }
      p.phase = "work"; route();
    };
    const tick = () => {
      const left = Math.ceil((p.restEnd - Date.now()) / 1000);
      $("#rest").textContent = mmss(left);
      if (left <= 3 && left > 0 && left !== tick.last) beep(660, 90);
      tick.last = left;
      if (left <= 0) { beep(990, 300); advance(); }
    };
    const iv = setInterval(tick, 250); tick();
    $("#plus").onclick = () => { p.restEnd += 15000; tick(); };
    $("#skip").onclick = advance;
    bindQuit();
    cleanup = () => { clearInterval(iv); stopFig(); };
    return;
  }

  const d = it.dose, timed = d.unit === "s";
  view.innerHTML = `<div class="player">${head}
    <div class="fig" id="fig"></div>
    <h2 style="margin-top:14px">${esc(it.ex.n)}</h2>
    <div class="target">${esc(targetLabel(d))}</div>
    <div class="setdots" aria-label="Série ${p.set + 1} sur ${it.sets}">${Array.from({ length: it.sets }, (_, k) => `<i class="${k < p.set ? "on" : ""}"></i>`).join("")}</div>
    <p>${esc(it.cons)}</p>
    ${timed ? `<div class="big-timer" id="chrono">0:00</div>` : ""}
    <div class="actions">
      ${timed ? `<button id="chronoBtn">Lancer le chrono</button>` : ""}
      <button class="primary block" id="setDone">Série ${p.set + 1} / ${it.sets} faite</button>
      <button class="ghost block" id="skipEx">Passer cet exercice</button>
    </div></div>`;
  const stopFig = mountFigure($("#fig"), it.ex.n);
  let iv = null;
  if (timed) {
    const btn = $("#chronoBtn"), out = $("#chrono");
    btn.onclick = () => {
      if (iv) { clearInterval(iv); iv = null; btn.textContent = "Relancer le chrono"; return; }
      const t0 = Date.now(); let beepedMin = false, beepedMax = false;
      btn.textContent = "Arrêter le chrono";
      iv = setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        out.textContent = mmss(s);
        if (!beepedMin && s >= d.min) { beepedMin = true; beep(660); }
        if (!beepedMax && s >= d.max) { beepedMax = true; beep(990, 300); }
      }, 200);
    };
  }
  const nextStep = () => {
    if (p.i === items.length - 1 && p.set >= it.sets) { p.phase = "done"; finishPlayer(true); }
    else { p.phase = "rest"; p.restEnd = Date.now() + it.restSec * 1000; }
    route();
  };
  $("#setDone").onclick = () => { p.set++; p.doneSets++; nextStep(); };
  $("#skipEx").onclick = () => {
    if (p.i === items.length - 1) { p.phase = "done"; finishPlayer(p.doneSets > 0); route(); return; }
    p.i++; p.set = 0; route();
  };
  bindQuit();
  cleanup = () => { clearInterval(iv); stopFig(); };
}
function bindQuit() {
  const q = $("#quit"); if (!q) return;
  q.onclick = () => {
    if (!confirm("Arrêter la séance ? Les séries faites sont gardées.")) return;
    finishPlayer(false); player = null; location.hash = "#/";
  };
}

/* ---------- Atlas ---------- */
let atlasState = { q: "", mine: true };
function vAtlas() {
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  view.innerHTML = `
    <div class="label">Atlas</div><h1>${data.exercises.length} exercices</h1>
    <input type="search" id="q" placeholder="Chercher un exercice ou un muscle" value="${esc(atlasState.q)}">
    <label class="chip" style="display:inline-block;margin-top:10px"><input type="checkbox" id="mine" ${atlasState.mine ? "checked" : ""}><span>Faisables avec mon matériel et mon niveau</span></label>
    <p class="muted mono" id="count" style="font-size:12px;margin-top:10px"></p>
    <ul class="list" id="list"></ul>`;
  const render = () => {
    const words = norm(atlasState.q).split(/\s+/).filter(Boolean);
    const rows = data.exercises.filter(e =>
      (!atlasState.mine || canDo(e, store.profile)) && words.every(w => norm(`${e.n} ${e.mus} ${e.cat}`).includes(w)));
    $("#count").textContent = `${rows.length} résultat${rows.length > 1 ? "s" : ""}`;
    $("#list").innerHTML = rows.map(e => `<li><a href="#/atlas/${e.id}">${esc(e.n)}<span>${esc(e.cat)} · ${esc(e.niv)} · ${esc(e.equipLabel === "Aucun" ? "sans matériel" : e.equipLabel)}</span></a></li>`).join("");
  };
  $("#q").oninput = e => { atlasState.q = e.target.value; render(); };
  $("#mine").onchange = e => { atlasState.mine = e.target.checked; render(); };
  render();
}
function vExercise(id) {
  const e = data.exercises.find(x => x.id === id);
  if (!e) { location.hash = "#/atlas"; return; }
  const ok = canDo(e, store.profile);
  view.innerHTML = `
    <button class="back" onclick="history.back()">← Atlas</button>
    <h1>${esc(e.n)}</h1>
    <div class="fig" id="fig"></div>
    <dl class="facts">
      <dt>Dosage</dt><dd class="mono">${esc(e.dos)}</dd>
      <dt>Consigne</dt><dd>${esc(e.cons)}</dd>
      <dt>Muscles</dt><dd>${esc(e.mus)}</dd>
      <dt>Catégorie</dt><dd>${esc(e.cat)} · ${esc(e.typ)}</dd>
      <dt>Niveau</dt><dd>${esc(e.niv)}</dd>
      <dt>Matériel</dt><dd>${esc(e.equipLabel)}${ok ? "" : ` <span class="muted">(hors de ton profil)</span>`}</dd>
      ${e.prio.length ? `<dt>Prioritaire</dt><dd>${e.prio.map(esc).join(", ")}</dd>` : ""}
    </dl>
    <p class="muted" style="font-size:13px">Dessin schématique : il montre le trajet du mouvement, pas les détails de technique. Fie-toi d'abord à la consigne.</p>`;
  cleanup = mountFigure($("#fig"), e.n);
}

/* ---------- Profil et sauvegarde ---------- */
function vProfil() {
  const last = store.meta.lastExport ? new Date(store.meta.lastExport).toLocaleDateString("fr-FR") : "jamais";
  view.innerHTML = `
    <div class="label">Profil</div><h1>Tes réglages</h1>
    ${profileForm(store.profile)}
    <section class="card flat stack" style="margin-top:28px">
      <h2>Sauvegarde</h2>
      <p class="muted">Tes données ne sont stockées que dans cette app, sur ce téléphone. Si tu la supprimes, elles disparaissent. Dernière sauvegarde : <b>${last}</b>.</p>
      <p class="muted" style="font-size:13px">Stockage protégé contre l'effacement automatique : ${store.meta.persisted ? "oui" : "non confirmé par le système"}.</p>
      <button class="primary block" id="export">Exporter (Fichiers, iCloud Drive…)</button>
      <label class="btn block" style="width:100%">Importer une sauvegarde<input type="file" id="import" accept="application/json,.json" hidden></label>
    </section>
    <section class="card flat stack" style="margin-top:14px">
      <h2>Tout effacer</h2>
      <p class="muted">Supprime le profil et l'historique de ce téléphone.</p>
      <button class="ghost block" id="wipe">Effacer mes données</button>
    </section>
    <p class="muted" style="font-size:13px;margin-top:20px">Ces exercices ne remplacent pas un avis médical. En cas de douleur, arrête et demande conseil à un professionnel.</p>`;
  $("#profile-form").onsubmit = async e => {
    e.preventDefault();
    store.profile = { ...store.profile, ...readProfileForm(e.target) }; save();
    e.submitter.textContent = "Enregistré ✓"; setTimeout(() => (e.submitter.textContent = "Enregistrer"), 1500);
  };
  $("#export").onclick = async () => { if (await exportData()) route(); };
  $("#import").onchange = e => e.target.files[0] && importData(e.target.files[0]);
  $("#wipe").onclick = () => {
    if (!confirm("Effacer définitivement ton profil et ton historique de ce téléphone ?")) return;
    localStorage.removeItem(KEY); location.hash = "#/"; location.reload();
  };
}

/* ---------- Routeur ---------- */
function route() {
  cleanup(); cleanup = () => {};
  const h = location.hash.replace(/^#/, "") || "/";
  const tabs = $("#tabs");
  if (!store.profile) { tabs.hidden = true; vOnboarding(); return; }
  tabs.hidden = h === "/seance";
  const tab = h.startsWith("/atlas") ? "atlas" : h.startsWith("/profil") ? "profil" : "home";
  tabs.querySelectorAll("a").forEach(a => { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (h === "/seance") vPlayer();
  else if (h === "/atlas") vAtlas();
  else if (h.startsWith("/atlas/")) vExercise(h.slice(7));
  else if (h === "/profil") vProfil();
  else vHome();
  if (h !== "/seance") window.scrollTo(0, 0);
}

addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && player && player.phase !== "done") keepAwake(true); });

(async function init() {
  view.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    const [exercises, sessions] = await Promise.all(["data/exercises.json", "data/sessions.json"].map(u => fetch(u).then(r => r.json())));
    data = { exercises, sessions };
  } catch {
    view.innerHTML = `<p>Impossible de charger les exercices. Vérifie ta connexion pour le premier lancement.</p>`;
    return;
  }
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
