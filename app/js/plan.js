// Logique de séance : fonctions pures, sans accès au DOM ni au stockage.

export const OBJECTIFS = [
  { label: "Sports", items: ["Cyclisme", "Course à pied", "Trail", "Natation", "Triathlon", "Football", "Tennis / Padel", "Escalade"] },
  { label: "Remise en forme", items: ["Reprise / Débutant", "Perte de poids", "Tonification", "Dos & posture", "Seniors & équilibre"] },
];
export const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé"];
export const EQUIPEMENTS = [
  "Haltères", "Élastique", "Banc / chaise", "Swiss ball", "Barre de traction",
  "Sangles de suspension", "Kettlebell", "Roue abdominale", "Corde à sauter",
];
export const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const rank = niv => NIVEAUX.indexOf(niv);

export function canDo(ex, profile) {
  return ex.equip.every(q => profile.equipment.includes(q)) && rank(ex.niv) <= rank(profile.level);
}

const muscles = ex => new Set(ex.mus.toLowerCase().split(/\s*,\s*/));

/** Meilleur remplaçant d'un exercice impossible (matériel ou niveau). */
export function substitute(orig, exercises, profile, exclude) {
  const target = muscles(orig);
  let best = null, bestScore = -Infinity;
  for (const ex of exercises) {
    if (ex.cat !== orig.cat || exclude.has(ex.id) || !canDo(ex, profile)) continue;
    let score = 0;
    if (ex.prio.includes(profile.objective)) score += 3;
    else if (ex.compl.includes(profile.objective)) score += 1.5;
    if (ex.typ === orig.typ) score += 2;
    for (const m of muscles(ex)) if (target.has(m)) score += 1;
    if (score > bestScore) { best = ex; bestScore = score; }
  }
  return best;
}

/**
 * Séance du jour à partir de la séance type de l'objectif.
 * opts.mode : "normal" | "fatigue" (2 séries max) | "express" (3 exercices, 2 séries)
 */
export function buildSession(profile, data, opts = {}) {
  const mode = opts.mode || "normal";
  const byId = new Map(data.exercises.map(e => [e.id, e]));
  const template = data.sessions[profile.objective] || [];
  const used = new Set(template.map(t => t.id));
  const items = [];
  for (const t of template) {
    const orig = byId.get(t.id);
    if (canDo(orig, profile)) {
      items.push({ ex: orig, dos: t.dos, dose: t.dose, restSec: t.restSec, cons: t.cons });
      continue;
    }
    const sub = substitute(orig, data.exercises, profile, used);
    if (!sub) continue;
    used.add(sub.id);
    items.push({ ex: sub, dos: sub.dos, dose: sub.dose, restSec: t.restSec, cons: sub.cons, replaces: orig.n });
  }
  let out = items.map(it => ({ ...it, sets: it.dose.sets }));
  if (mode === "fatigue" || mode === "express") out = out.map(it => ({ ...it, sets: Math.min(it.sets, 2) }));
  if (mode === "express") out = out.slice(0, 3);
  return { objective: profile.objective, mode, items: out };
}

/** Texte de la cible d'une série : « 8-12 répétitions / jambe », « 30-60 s ». */
export function targetLabel(dose) {
  const range = dose.min === dose.max ? `${dose.min}` : `${dose.min}-${dose.max}`;
  const unit = { reps: "répétitions", s: "s", m: "m" }[dose.unit] || dose.unit;
  let s = `${range} ${unit}`;
  if (dose.per) s += dose.per === "lettre" ? " par lettre" : ` / ${dose.per}`;
  if (dose.note) s += `, ${dose.note}`;
  return s;
}

/** Estimation grossière de durée en minutes (hypothèse : 3 s par répétition). */
export function estimateMinutes(session) {
  let sec = 0;
  for (const it of session.items) {
    const d = it.dose;
    let work = d.unit === "s" ? d.max : d.unit === "m" ? 30 : d.max * 3;
    if (d.per && d.per !== "lettre") work *= 2;
    sec += it.sets * work + (it.sets - 1) * it.restSec + 30;
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** Jour ISO (1 = lundi ... 7 = dimanche). */
export const isoDay = d => ((d.getDay() + 6) % 7) + 1;
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Lundi de la semaine de d. */
export function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - (isoDay(x) - 1));
  return x;
}

/** Nombre de semaines consécutives (en remontant depuis la précédente) où toutes les séances prévues ont été faites. */
export function weekStreak(history, days, today) {
  if (!days.length) return 0;
  const done = new Set(history.map(h => h.date));
  let streak = 0;
  const w = weekStart(today);
  for (let i = 1; i < 104; i++) {
    const start = new Date(w); start.setDate(start.getDate() - 7 * i);
    let count = 0;
    for (let k = 0; k < 7; k++) {
      const d = new Date(start); d.setDate(d.getDate() + k);
      if (done.has(dateKey(d))) count++;
    }
    if (count >= days.length) streak++; else break;
  }
  return streak;
}
