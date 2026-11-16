/* Généré par scripts/extract_atlas.py depuis source/Atlas_des_exercices.html : ne pas modifier à la main. */
(function () {
/* Moteur de silhouettes : squelette 2D, IK à deux segments, homme / femme, matériel */
const FL = 225;
const RAD = Math.PI / 180;
const dir = a => [Math.sin(a * RAD), -Math.cos(a * RAD)];
const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = v => Math.hypot(v[0], v[1]);
const angOf = v => ((Math.atan2(v[0], -v[1]) / RAD) + 360) % 360;
const lerp = (a, b, u) => a + (b - a) * u;
const lerpAng = (a, b, u) => { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d * u; };

const SEX = {
  M: { k: 1.0, SW: 46, HW: 30, HR: 10.5, w: { TH: 14, SH: 10, UA: 9.5, FA: 8 }, hand: 4, foot: 7 },
  F: { k: 0.95, SW: 38, HW: 35, HR: 10, w: { TH: 14, SH: 9.5, UA: 8, FA: 7 }, hand: 3.6, foot: 6.5 },
};
const LEN = { T: 52, SHF: 0.87, NK: 7, UA: 29, FA: 26, TH: 44, SH: 42, FT: 15 };
const SEGS = ["aUA", "aFA", "bUA", "bFA", "aTH", "aSH", "bTH", "bSH"];
const DEF_ANG = { T: 0, aUA: 180, aFA: 180, bUA: 180, bFA: 180, aTH: 180, aSH: 180, bTH: 180, bSH: 180 };

function ik(base, tgt, l1, l2, s) {
  const v = sub(tgt, base);
  let d = len(v);
  const phi = angOf(v);
  const dmax = l1 + l2 - 0.01, dmin = Math.abs(l1 - l2) + 0.01;
  if (d >= dmax) return add(base, dir(phi), l1);
  if (d < dmin) d = dmin;
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
  return add(base, dir(phi + s * a), l1);
}

/* Résout une pose : angles absolus (0 = haut, 90 = droite), ancre, cibles IK */
function solve(kp, view, sexKey, rootGiven) {
  const sx = SEX[sexKey], k = sx.k;
  const g = n => (kp[n] !== undefined ? kp[n] : DEF_ANG[n]);
  const sc = n => (kp[n + "s"] !== undefined ? kp[n + "s"] : 1);
  const T = g("T"), u = dir(T), v = dir(T + 90);
  const J = {};
  J.P = [0, 0];
  const Tl = LEN.T * k * sc("T");
  J.N = add(J.P, u, Tl);
  const S = add(J.P, u, Tl * LEN.SHF + (kp.shE || 0));
  if (view === "s") {
    J.aS = S; J.bS = add(S, v, -2.5); J.aHp = [0, 0]; J.bHp = add([0, 0], v, -2);
  } else {
    J.aS = add(S, v, -sx.SW / 2); J.bS = add(S, v, sx.SW / 2);
    J.aHp = add(J.P, v, -(sx.HW / 2 - 5)); J.bHp = add(J.P, v, sx.HW / 2 - 5);
  }
  const hd = kp.Hd !== undefined ? kp.Hd : T;
  J.hd = hd;
  J.Hd = add(add(J.N, dir(hd), LEN.NK * k + sx.HR), dir(hd + 90), kp.Hx || 0);
  for (const sd of ["a", "b"]) {
    J[sd + "E"] = add(J[sd + "S"], dir(g(sd + "UA")), LEN.UA * k * sc(sd + "UA"));
    J[sd + "W"] = add(J[sd + "E"], dir(g(sd + "FA")), LEN.FA * k * sc(sd + "FA"));
    J[sd + "K"] = add(J[sd + "Hp"], dir(g(sd + "TH")), LEN.TH * k * sc(sd + "TH"));
    J[sd + "A"] = add(J[sd + "K"], dir(g(sd + "SH")), LEN.SH * k * sc(sd + "SH"));
  }
  let delta = [0, 0];
  if (rootGiven) delta = rootGiven;
  else if (kp.an) { const [n, x, y] = kp.an; delta = sub([x, y], J[n]); }
  for (const key in J) if (Array.isArray(J[key])) J[key] = add(J[key], delta);
  // IK
  const dS = view === "s" ? { a: 1, b: 1 } : { a: 1, b: -1 };
  const dL = view === "s" ? { a: -1, b: -1 } : { a: 1, b: -1 };
  for (const sd of ["a", "b"]) {
    const wt = kp[sd + "Wt"];
    if (wt) {
      const s = wt[2] !== undefined ? wt[2] : dS[sd];
      J[sd + "E"] = ik(J[sd + "S"], wt, LEN.UA * k * sc(sd + "UA"), LEN.FA * k * sc(sd + "FA"), s);
      J[sd + "W"] = add(J[sd + "E"], dir(angOf(sub(wt, J[sd + "E"]))), LEN.FA * k * sc(sd + "FA"));
    }
    const at = kp[sd + "At"];
    if (at) {
      const s = at[2] !== undefined ? at[2] : dL[sd];
      J[sd + "K"] = ik(J[sd + "Hp"], at, LEN.TH * k * sc(sd + "TH"), LEN.SH * k * sc(sd + "SH"), s);
      J[sd + "A"] = add(J[sd + "K"], dir(angOf(sub(at, J[sd + "K"]))), LEN.SH * k * sc(sd + "SH"));
    }
  }
  // feet, hands
  for (const sd of ["a", "b"]) {
    const shA = angOf(sub(J[sd + "A"], J[sd + "K"]));
    let f = kp[sd + "FT"];
    const A = J[sd + "A"];
    if (typeof f !== "number") {
      if (view !== "s") f = shA;
      else if (f === "t") {
        const dy = FL - 1.5 - A[1];
        f = dy <= 0 ? 90 : dy >= LEN.FT * k ? 180 : Math.acos(-dy / (LEN.FT * k)) / RAD;
      } else if (A[1] >= FL - 9 && !kp.top) f = 90;
      else f = shA - 90;
    }
    J[sd + "ft"] = f;
    const faA = angOf(sub(J[sd + "W"], J[sd + "E"]));
    J[sd + "ha"] = kp[sd + "HA"] !== undefined ? kp[sd + "HA"] : faA;
    J[sd + "H"] = add(J[sd + "W"], dir(J[sd + "ha"]), 3);
  }
  J.T = T; J.u = u; J.v = v; J.Tl = Tl;
  return J;
}

/* Convertit une pose clé en angles + racine pour l'interpolation */
function keyState(kp, view, sexKey) {
  const J = solve(kp, view, sexKey);
  const st = { root: J.P, ang: {}, sc: {}, kp };
  st.ang.T = J.T; st.ang.Hd = J.hd;
  st.ang.aUA = angOf(sub(J.aE, J.aS)); st.ang.aFA = angOf(sub(J.aW, J.aE));
  st.ang.bUA = angOf(sub(J.bE, J.bS)); st.ang.bFA = angOf(sub(J.bW, J.bE));
  st.ang.aTH = angOf(sub(J.aK, J.aHp)); st.ang.aSH = angOf(sub(J.aA, J.aK));
  st.ang.bTH = angOf(sub(J.bK, J.bHp)); st.ang.bSH = angOf(sub(J.bA, J.bK));
  st.ang.aFT = J.aft; st.ang.bFT = J.bft; st.ang.aHA = J.aha; st.ang.bHA = J.bha;
  for (const n of [...SEGS, "T"]) st.sc[n + "s"] = kp[n + "s"] !== undefined ? kp[n + "s"] : 1;
  return st;
}

function frameJoints(A, B, u, view, sexKey) {
  const kp = {};
  for (const n in A.ang) kp[n] = lerpAng(A.ang[n], B.ang[n], u);
  for (const n in A.sc) kp[n] = lerp(A.sc[n], B.sc[n], u);
  // valeurs numériques libres (épaules, tête, paramètres de matériel)
  for (const n of ["shE", "Hx", "br", "ry", "fs", "aDB", "aDBs"]) {
    const a = A.kp[n], b = B.kp[n];
    if (a !== undefined || b !== undefined) kp[n] = lerp(a ?? b ?? 0, b ?? a ?? 0, u);
  }
  for (const t of ["aWt", "bWt", "aAt", "bAt"]) {
    if (A.kp[t] && B.kp[t]) {
      const s = A.kp[t][2];
      kp[t] = [lerp(A.kp[t][0], B.kp[t][0], u), lerp(A.kp[t][1], B.kp[t][1], u)];
      if (s !== undefined) kp[t][2] = s;
    }
  }
  kp.top = A.kp.top;
  // pieds et mains : angles déjà résolus et interpolés
  const J = solve(kp, view, sexKey, [lerp(A.root[0], B.root[0], u), lerp(A.root[1], B.root[1], u)]);
  if (!(A.kp.aAt && B.kp.aAt) || true) J.aft = kp.aFT;
  J.bft = kp.bFT;
  J.aha = kp.aHA; J.bha = kp.bHA;
  for (const sd of ["a", "b"]) J[sd + "H"] = add(J[sd + "W"], dir(J[sd + "ha"]), 3);
  J.kp = kp;
  return J;
}

/* ---------- Dessin ---------- */
function catmull(pts) {
  const n = pts.length; let d = "";
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (i === 0) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}
const TORSO = {
  sM: [[-0.08, -10], [0.15, -11], [0.45, -8.5], [0.7, -10], [0.9, -9], [1.0, -5], [1.0, 5], [0.88, 10], [0.7, 12], [0.45, 9.5], [0.2, 10], [-0.05, 9]],
  sF: [[-0.08, -12.5], [0.12, -12], [0.42, -7.5], [0.7, -8.5], [0.9, -8], [1.0, -4.5], [1.0, 4.5], [0.85, 8], [0.7, 12.5], [0.58, 10], [0.42, 7], [0.2, 9], [-0.05, 9]],
  fM: [[1.0, -8], [0.93, -24], [0.75, -21], [0.45, -16], [0.15, -16.5], [-0.08, -17]],
  fF: [[1.0, -7], [0.93, -20], [0.72, -17], [0.45, -13.5], [0.15, -18], [-0.08, -18.5]],
};
function torsoPath(J, view, sexKey) {
  const k = SEX[sexKey].k, L = J.Tl;
  let pts;
  if (view === "s") pts = TORSO["s" + sexKey];
  else { const h = TORSO["f" + sexKey]; pts = [...h, ...h.slice().reverse().map(([a, b]) => [a, -b])]; }
  const shE = (J.kp && J.kp.shE) || 0;
  return catmull(pts.map(([s, o]) => add(add(J.P, J.u, s * L + (s > 0.8 ? shE * (s - 0.8) / 0.2 : 0)), J.v, o * k * (view === "s" ? 1 : 1))));
}
const seg = (a, b, w, c) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;

function limbSVG(J, sd, part, sx, c) {
  if (part === "arm") {
    return seg(J[sd + "S"], J[sd + "E"], sx.w.UA, c) + seg(J[sd + "E"], J[sd + "W"], sx.w.FA, c) +
      `<circle cx="${J[sd + "H"][0].toFixed(1)}" cy="${J[sd + "H"][1].toFixed(1)}" r="${sx.hand}" fill="${c}"/>`;
  }
  const A = J[sd + "A"], f = J[sd + "ft"];
  let foot;
  if (J.view === "s") foot = seg(add(A, dir(f), -3), add(A, dir(f), 13 * sx.k), sx.foot, c);
  else foot = seg(A, add(A, dir(f), 6), sx.foot + 1.5, c);
  return seg(J[sd + "Hp"], J[sd + "K"], sx.w.TH, c) + seg(J[sd + "K"], A, sx.w.SH, c) + foot;
}

function headSVG(J, view, sexKey, c, hair) {
  const sx = SEX[sexKey], H = J.Hd, r = sx.HR, hd = J.hd;
  let s = `<circle cx="${H[0].toFixed(1)}" cy="${H[1].toFixed(1)}" r="${r}" fill="${c}"/>`;
  const arc = (a1, a2, rr, w) => {
    const p1 = add(H, dir(a1), rr), p2 = add(H, dir(a2), rr);
    const large = ((a2 - a1 + 360) % 360) > 180 ? 1 : 0;
    return `<path d="M${p1[0].toFixed(1)},${p1[1].toFixed(1)} A${rr},${rr} 0 ${large} 1 ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" fill="none" stroke="${hair}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  if (view === "s") {
    s += arc(hd - 115, hd + 30, r - 1.8, 4.2);
    const nose = add(H, dir(hd + 90), r - 0.5);
    s += `<circle cx="${nose[0].toFixed(1)}" cy="${nose[1].toFixed(1)}" r="2.2" fill="${c}"/>`;
    if (sexKey === "F") {
      const t = add(H, dir(hd - 105), r + 3.5);
      s += `<ellipse cx="${t[0].toFixed(1)}" cy="${t[1].toFixed(1)}" rx="4" ry="7" transform="rotate(${(hd - 105 + 180).toFixed(0)} ${t[0].toFixed(1)} ${t[1].toFixed(1)})" fill="${hair}"/>`;
    }
  } else {
    s += sexKey === "F" ? arc(hd - 115, hd + 115, r - 1.6, 4.5) : arc(hd - 70, hd + 70, r - 1.8, 4.2);
  }
  return s;
}

/* ---------- Matériel ---------- */
const INK = "var(--prop)", BAND = "var(--band)", SOFT = "var(--propsoft)";
function pt(J, p) { return typeof p === "string" ? J[p] : p; }
function dumbbell(c, ang, size = 1) {
  const a = dir(ang), b = dir(ang + 90);
  const e1 = add(c, a, -8 * size), e2 = add(c, a, 8 * size);
  const plate = e => { const p1 = add(e, b, -5 * size), p2 = add(e, b, 5 * size); return seg(p1, p2, 5 * size, INK); };
  return seg(e1, e2, 2.6, INK) + plate(e1) + plate(e2);
}
function propSVG(pr, J, view) {
  const kp = J.kp || {};
  switch (pr.t) {
    case "bench": {
      const { x1, x2, y } = pr;
      return `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="7" rx="2" fill="${SOFT}" stroke="${INK}" stroke-width="1.2"/>` +
        seg([x1 + 6, y + 7], [x1 + 6, FL], 3, INK) + seg([x2 - 6, y + 7], [x2 - 6, FL], 3, INK);
    }
    case "incl": {
      const [a, b] = pr.back; const [x1, x2, y] = pr.seat;
      return `<path d="M${a[0]},${a[1]} L${b[0]},${b[1]}" stroke="${SOFT}" stroke-width="8" stroke-linecap="round"/>` +
        `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="7" rx="2" fill="${SOFT}" stroke="${INK}" stroke-width="1.2"/>` +
        seg([(x1 + x2) / 2, y + 7], [(x1 + x2) / 2, FL], 3, INK) + seg([x1 - 8, FL], [x2 + 8, FL], 3, INK);
    }
    case "box": return `<rect x="${pr.x1}" y="${pr.y}" width="${pr.x2 - pr.x1}" height="${FL - pr.y}" rx="2" fill="${SOFT}" stroke="${INK}" stroke-width="1.2"/>`;
    case "chair": {
      const { x1, x2, y } = pr, bx = pr.back === "r" ? x2 - 2 : x1 + 2;
      return `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="5" rx="1.5" fill="${SOFT}" stroke="${INK}" stroke-width="1.2"/>` +
        seg([x1 + 3, y + 5], [x1 + 3, FL], 2.6, INK) + seg([x2 - 3, y + 5], [x2 - 3, FL], 2.6, INK) +
        (pr.back ? seg([bx, y], [bx, y - 45], 3, INK) : "");
    }
    case "post": return seg([pr.x, pr.y1], [pr.x, pr.y2 ?? FL], 4, INK);
    case "wall": return `<rect x="${pr.x - (pr.side === "r" ? 0 : 6)}" y="0" width="6" height="${FL}" fill="${SOFT}"/>`;
    case "bar": return seg([pr.x1, pr.y], [pr.x2, pr.y], 3.2, INK) + seg([pr.x1, pr.y - 6], [pr.x1, pr.y + 3], 3, INK) + seg([pr.x2, pr.y - 6], [pr.x2, pr.y + 3], 3, INK);
    case "table": return `<rect x="${pr.x1}" y="${pr.y}" width="${pr.x2 - pr.x1}" height="6" fill="${SOFT}" stroke="${INK}" stroke-width="1.2"/>` +
      seg([pr.x1 + 5, pr.y + 6], [pr.x1 + 5, FL], 3, INK) + seg([pr.x2 - 5, pr.y + 6], [pr.x2 - 5, FL], 3, INK);
    case "block": return `<rect x="${pr.x1}" y="${pr.y}" width="${pr.x2 - pr.x1}" height="${FL - pr.y}" rx="4" fill="${SOFT}" stroke="${INK}" stroke-width="1.2"/>`;
    case "ball": {
      const r = kp.br !== undefined ? kp.br : pr.r;
      let c;
      if (pr.at) { const p = J[pr.at]; c = [p[0] + (pr.dx || 0), pr.floor ? FL - r : p[1] + (pr.dy || 0)]; }
      else c = [pr.x, pr.y ?? FL - r];
      return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r}" fill="var(--ball)" stroke="${INK}" stroke-width="1.2" opacity="0.92"/>`;
    }
    case "db": if (pr.endon) return (pr.h || "a").split("").map(sd => `<circle cx="${J[sd + "H"][0].toFixed(1)}" cy="${J[sd + "H"][1].toFixed(1)}" r="6.5" fill="none" stroke="${INK}" stroke-width="3.5"/>`).join("");
      return (pr.h || "a").split("").map(sd => {
      const fa = J[sd + "ha"];
      return dumbbell(J[sd + "H"], (pr.ang !== undefined ? pr.ang : fa + 90), pr.size || 1);
    }).join("");
    case "db2": {
      const c = pr.at ? add(J[pr.at], pr.off || [0, 0]) : [(J.aH[0] + J.bH[0]) / 2, (J.aH[1] + J.bH[1]) / 2];
      return dumbbell(c, pr.ang !== undefined ? pr.ang : 0, 1.05);
    }
    case "kb": {
      let h = pr.h === "ab" ? [(J.aH[0] + J.bH[0]) / 2, (J.aH[1] + J.bH[1]) / 2] : J[(pr.h || "a") + "H"];
      let d = pr.mode === "fa" ? dir(J[(pr.h === "ab" ? "a" : pr.h || "a") + "ha"]) : pr.mode === "up" ? dir(0) : dir(180);
      const c = add(h, d, 10);
      return seg(h, add(h, d, 4), 3, INK) + `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="7.5" fill="${INK}"/>`;
    }
    case "band": {
      const tos = Array.isArray(pr.to) && typeof pr.to[0] === "string" ? pr.to : [pr.to];
      const f = pt(J, pr.from);
      return tos.map(t => { const p = pt(J, t); return seg(f, p, 2.3, BAND); }).join("") +
        (typeof pr.from !== "string" ? `<circle cx="${f[0]}" cy="${f[1]}" r="3" fill="${INK}"/>` : "");
    }
    case "loop": {
      if (view === "s") { const p = J[pr.j || "aK"]; return `<ellipse cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" rx="3" ry="8" fill="none" stroke="${BAND}" stroke-width="2.5"/>`; }
      const a = J["a" + (pr.j || "K")], b = J["b" + (pr.j || "K")];
      return seg(a, b, 2.5, BAND);
    }
    case "arcband": {
      const a = J.aH, b = J.bH, top = add(J.aS, J.v, -14);
      const c1 = add(top, J.u, 10), c2 = add(top, J.u, -10);
      const f = x => x.toFixed(1);
      return `<path d="M${f(a[0])},${f(a[1])} Q${f(c1[0])},${f(c1[1])} ${f(top[0])},${f(top[1])} Q${f(c2[0])},${f(c2[1])} ${f(b[0])},${f(b[1])}" fill="none" stroke="${BAND}" stroke-width="2.3"/>`;
    }
    case "strap": return (pr.to || ["aH"]).map(t => { const p = J[t]; return seg(pr.top, p, 2, INK) + seg(add(p, [-4, 0]), add(p, [4, 0]), 3.5, INK); }).join("") + `<circle cx="${pr.top[0]}" cy="${pr.top[1]}" r="3" fill="${INK}"/>`;
    case "wheel": { const p = J[pr.at || "aH"]; return seg([p[0] - 10, FL - 8], [p[0] + 10, FL - 8], 2.5, INK) + `<circle cx="${p[0].toFixed(1)}" cy="${FL - 8}" r="8" fill="none" stroke="${INK}" stroke-width="3"/>`; }
    case "towel": { const p = J[pr.at || "aA"]; return `<rect x="${(p[0] - 8).toFixed(1)}" y="${FL - 3}" width="18" height="3" rx="1" fill="${BAND}"/>`; }
    case "rope": {
      const a = J.aH, b = J.bH, cy = kp.ry !== undefined ? kp.ry : FL + 15;
      return `<path d="M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${((a[0] + b[0]) / 2).toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.8"/>`;
    }
    case "mat": return `<rect x="${pr.x1}" y="${pr.y1}" width="${pr.x2 - pr.x1}" height="${pr.y2 - pr.y1}" rx="8" fill="var(--mat)"/>`;
    case "fingers": {
      const p = J[pr.at || "aH"], base = J[(pr.at || "aH")[0] + "ha"], sp = kp.fs !== undefined ? kp.fs : 10;
      let s = "";
      for (let i = -2; i <= 2; i++) s += seg(p, add(p, dir(base + i * sp), 10), 2.4, INK);
      return s + `<circle cx="${add(p, dir(base), 5)[0].toFixed(1)}" cy="${add(p, dir(base), 5)[1].toFixed(1)}" r="${(4 + sp * 0.12).toFixed(1)}" fill="none" stroke="${BAND}" stroke-width="2"/>`;
    }
    case "hammer": {
      const p = J[(pr.h || "a") + "H"], a = kp.aDB !== undefined ? kp.aDB : 0, s = kp.aDBs !== undefined ? kp.aDBs : 1;
      const e = add(p, dir(a), 16 * s);
      return seg(p, e, 2.6, INK) + seg(add(e, dir(a + 90), -5), add(e, dir(a + 90), 5), 5, INK);
    }
    case "line": return seg(pr.a, pr.b, pr.w || 2, INK);
    default: return "";
  }
}

/* ---------- Figure complète ---------- */
function figureSVG(spec, J, sexKey) {
  const sx = SEX[sexKey], view = spec.v;
  J.view = view;
  const C = sexKey === "M" ? ["var(--m1)", "var(--m2)", "var(--mh)"] : ["var(--f1)", "var(--f2)", "var(--fh)"];
  const props = spec.pr || [];
  const back = props.filter(p => !p.front && !["db", "db2", "kb", "hammer", "fingers", "rope", "band", "strap", "loop", "arcband", "wheel", "towel"].includes(p.t) || p.back);
  const front = props.filter(p => !back.includes(p));
  let s = "";
  if (!spec.top) {
    s += `<line x1="-300" y1="${FL}" x2="600" y2="${FL}" stroke="var(--floor)" stroke-width="1.5"/>`;
    s += `<ellipse cx="${J.P[0].toFixed(1)}" cy="${FL + 1.5}" rx="42" ry="2.6" fill="var(--shadow)"/>`;
  }
  s += back.map(p => propSVG(p, J, view)).join("");
  const farFirst = front.filter(p => p.far).map(p => propSVG(p, J, view)).join("");
  const nearProps = front.filter(p => !p.far).map(p => propSVG(p, J, view)).join("");
  if (view === "s") {
    s += limbSVG(J, "b", "leg", sx, C[1]) + limbSVG(J, "b", "arm", sx, C[1]) + farFirst;
    s += `<path d="${torsoPath(J, view, sexKey)}" fill="${C[0]}"/>`;
    s += seg(J.N, add(J.N, dir(J.hd), 8), 7, C[0]);
    s += headSVG(J, view, sexKey, C[0], C[2]);
    s += limbSVG(J, "a", "leg", sx, C[0]) + limbSVG(J, "a", "arm", sx, C[0]) + nearProps;
  } else {
    const L = spec.lc || C[0], Lb = spec.lcb || C[0];
    if (!spec.noLegs) s += limbSVG(J, "a", "leg", sx, C[0]) + limbSVG(J, "b", "leg", sx, C[0]);
    s += farFirst;
    s += `<path d="${torsoPath(J, view, sexKey)}" fill="${C[0]}"/>`;
    s += seg(J.N, add(J.N, dir(J.hd), 8), 8, C[0]);
    if (spec.headUnder) s += headSVG(J, view, sexKey, C[0], C[2]);
    s += limbSVG(J, "a", "arm", sx, spec.armDark === "a" ? C[1] : C[0]) + limbSVG(J, "b", "arm", sx, spec.armDark === "b" ? C[1] : C[0]);
    if (!spec.headUnder) s += headSVG(J, view, sexKey, C[0], C[2]);
    s += nearProps;
  }
  return s;
}

/* ---------- Animation ---------- */
function buildTimeline(spec) {
  const n = spec.k.length;
  let seq;
  if (n === 1) seq = [0];
  else if (spec.mode === "loop" || spec.mode === "cut") seq = [...Array(n).keys()];
  else seq = [...Array(n).keys(), ...[...Array(n - 2).keys()].map(i => n - 2 - i)];
  const tr = 1.05 * (spec.t || 1), hold = spec.hold ?? 0.45;
  const segs = [];
  for (let i = 0; i < seq.length; i++) {
    const a = seq[i], b = seq[(i + 1) % seq.length];
    const d = spec.d && spec.d[i] !== undefined ? spec.d[i] : tr;
    const cut = spec.mode === "cut" && i === seq.length - 1;
    segs.push({ a, b, hold, d: cut ? 0.001 : d });
  }
  const total = segs.reduce((s, x) => s + x.hold + x.d, 0);
  return { segs, total };
}
const ease = u => 0.5 - 0.5 * Math.cos(Math.PI * u);
function stateAt(tl, t) {
  if (tl.segs.length === 1 && tl.segs[0].a === tl.segs[0].b) return { a: 0, b: 0, u: 0 };
  let x = t % tl.total;
  for (const s of tl.segs) {
    if (x < s.hold) return { a: s.a, b: s.a, u: 0 };
    x -= s.hold;
    if (x < s.d) return { a: s.a, b: s.b, u: ease(x / s.d) };
    x -= s.d;
  }
  return { a: 0, b: 0, u: 0 };
}

function makeFigure(spec) {
  const cache = {};
  for (const sx of ["M", "F"]) cache[sx] = spec.k.map(kp => keyState(Object.assign({ top: spec.top }, kp), spec.v, sx));
  const tl = buildTimeline(spec);
  return {
    tl,
    draw(sexKey, t) {
      const st = stateAt(tl, t);
      const ks = cache[sexKey];
      const J = frameJoints(ks[st.a], ks[st.b], st.u, spec.v, sexKey);
      return figureSVG(spec, J, sexKey);
    },
    joints(sexKey, t) {
      const st = stateAt(tl, t);
      const ks = cache[sexKey];
      return frameJoints(ks[st.a], ks[st.b], st.u, spec.v, sexKey);
    },
    drawKey(sexKey, i) {
      const ks = cache[sexKey];
      const J = frameJoints(ks[i], ks[i], 0, spec.v, sexKey);
      return figureSVG(spec, J, sexKey);
    },
  };
}

/* Cadrage automatique : boîte englobante sur toute l'animation, homme et femme */
function autoVB(spec, fig) {
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  const take = (p) => { if (!p || !isFinite(p[0])) return; x1 = Math.min(x1, p[0]); x2 = Math.max(x2, p[0]); y1 = Math.min(y1, p[1]); y2 = Math.max(y2, p[1]); };
  const N = 24;
  for (const sx of ["M", "F"]) for (let i = 0; i <= N; i++) {
    const t = fig.tl.total * i / N;
    const J = fig.joints(sx, t);
    for (const k of ["P","N","Hd","aS","bS","aE","bE","aW","bW","aH","bH","aK","bK","aA","bA"]) take(J[k]);
    take(add(J.Hd, [0, -13])); take(add(J.Hd, [-13, 0])); take(add(J.Hd, [13, 0]));
    for (const sd of ["a","b"]) { take(add(J[sd+"A"], dir(J[sd+"ft"]), 14)); take(add(J[sd+"A"], dir(J[sd+"ft"]), -4)); }
  }
  for (const p of spec.pr || []) {
    if (p.x1 !== undefined) { take([p.x1, p.y ?? p.y1 ?? FL]); take([p.x2, p.y ?? p.y1 ?? FL]); }
    if (p.top) take(p.top);
    if (p.x !== undefined && p.t === "wall") { take([p.x, y1]); }
    if (p.t === "post") { take([p.x, p.y1]); }
    if (Array.isArray(p.from)) take(p.from);
    if (p.back) { take(p.back[0]); take(p.back[1]); }
    if (p.t === "ball" && p.x !== undefined) { take([p.x - p.r, FL - 2 * p.r]); take([p.x + p.r, FL]); }
    if (p.t === "ball" && p.at) for (const sx of ["M", "F"]) for (let i = 0; i <= N; i++) { const J = fig.joints(sx, fig.tl.total * i / N); const c = J[p.at]; const cx = c[0] + (p.dx || 0); take([cx - p.r - 2, c[1]]); take([cx + p.r + 2, c[1]]); }
  }
  if (!spec.top) y2 = Math.max(y2, FL + 4);
  const m = 12; x1 -= m; x2 += m; y1 -= m; y2 += (spec.top ? m : 6);
  let w = Math.max(x2 - x1, 120), h = Math.max(y2 - y1, 110);
  const R = 260 / 240;
  if (w / h > R) { const nh = w / R; y1 -= (nh - h) * (spec.top ? 0.5 : 1); h = nh; } else { const nw = h * R; x1 -= (nw - w) / 2; w = nw; }
  return [x1, y1, w, h].map(v => +v.toFixed(1));
}

/* Poses : angles absolus en degrés (0 = haut, 90 = avant/droite, 180 = bas, 270 = arrière/gauche)
   v:'s' profil (regard vers la droite), v:'f' face, top:1 vue de dessus */
const X = 130, AF = 220;
const P = (...o) => Object.assign({}, ...o);
const POSES = {};
const E = (name, spec) => { POSES[name] = spec; };

/* ---- bases ---- */
const ST = o => P({ T: 0, aUA: 184, aFA: 184, bUA: 178, bFA: 178, an: ["P", X, 135], aAt: [X + 2, AF], bAt: [X - 2, AF] }, o);
const SQ = o => P({ T: 35, aUA: 90, aFA: 90, bUA: 92, bFA: 92, an: ["P", 100, 178], aAt: [X, AF], bAt: [X - 2, AF] }, o);
const FS = o => P({ T: 0, aUA: 190, aFA: 187, bUA: 170, bFA: 173, an: ["P", X, 135], aAt: [X - 12, AF], bAt: [X + 12, AF] }, o);
const SU = o => P({ T: 270, Hd: 270, an: ["P", 140, 212], aUA: 90, aFA: 90, bUA: 92, bFA: 92, aTH: 90, aSH: 90, bTH: 90, bSH: 90 }, o);
const SUK = o => SU(P({ aAt: [188, AF], bAt: [185, AF] }, o));
const PR = o => P({ T: 90, Hd: 92, an: ["P", 115, 212], aUA: 90, aFA: 90, bUA: 92, bFA: 92, aTH: 270, aSH: 270, bTH: 270, bSH: 270, aFT: 235, bFT: 235 }, o);
const QD = o => P({ T: 84, Hd: 90, an: ["P", 125, 174], aWt: [172, 218], bWt: [169, 218], aTH: 180, aSH: 270, bTH: 180, bSH: 270, aFT: 268, bFT: 268 }, o);
const HP = o => P({ T: 70, Hd: 76, aUA: 180, aFA: 180, bUA: 180, bFA: 180, aTH: 250, aSH: 250, bTH: 250, bSH: 250, aFT: "t", bFT: "t", an: ["bW", 174, 218] }, o);
const PU0 = o => P({ T: 70, Hd: 76, aTH: 250, aSH: 250, bTH: 250, bSH: 250, aFT: "t", bFT: "t", an: ["aA", 50, 208], aWt: [174, 218], bWt: [171, 218] }, o);
const PU1 = o => PU0(P({ T: 82, Hd: 86, aTH: 262, aSH: 262, bTH: 262, bSH: 262 }, o));
const FP = o => P({ T: 80, Hd: 84, aUA: 180, aFA: 90, bUA: 180, bFA: 90, aTH: 260, aSH: 260, bTH: 260, bSH: 260, aFT: "t", bFT: "t", an: ["aE", 178, 218] }, o);
const HANG = o => P({ T: 0, aTH: 183, aSH: 192, bTH: 178, bSH: 188, an: ["P", X, 128], aWt: [X, 27], bWt: [X, 27] }, o);
const BAR = { t: "bar", x1: 70, x2: 190, y: 24 };
const DB = { t: "db", h: "ab" }, DBA = { t: "db", h: "a" };
const MAT = { t: "mat", x1: 60, x2: 200, y1: 10, y2: 230 };
const SIDE = o => P({ T: 76, aUA: 0, aFA: 0, bUA: 180, bFA: 92, aTH: 256, aSH: 256, bTH: 256, bSH: 256, an: ["bE", 196, 218] }, o);
const SIDEL = o => P({ T: 270, Hd: 265, an: ["P", 125, 208], aUA: 270, aFA: 270, bUA: 95, bFA: 150, aTH: 90, aSH: 90, bTH: 90, bSH: 90, }, o);

const TOPP = (o) => P({ T: 0, an: ["P", X, 140], aTH: 182, aSH: 182, bTH: 178, bSH: 178 }, o);
const MATP = { t: "mat", x1: 60, x2: 200, y1: 20, y2: 238 };

/* ===================== ABDOS ===================== */
E("Planche sur les avant-bras", { v: "s", k: [FP()] });
E("Planche latérale", { v: "f", k: [SIDE()] });
E("Planche latérale avec élévation de jambe", { v: "f", k: [SIDE(), SIDE({ aTH: 288, aSH: 288 })] });
E("Planche bras tendus avec touches d'épaules", { v: "s", k: [PU0(), PU0({ aWt: [168, 172, 1] })] });
E("Planche dynamique coudes-mains", { v: "s", k: [PU0({ T: 81, Hd: 85, aTH: 261, aSH: 261, bTH: 261, bSH: 261, aWt: [204, 218, 1], bWt: [200, 218, 1] }), PU0()] });
E("Planche avec levée bras-jambe opposés", { v: "s", k: [HP(), HP({ aUA: 75, aFA: 75, bTH: 262, bSH: 262 })] });
E("Dead bug", { v: "s", k: [SU({ aUA: 0, aFA: 0, bUA: 2, bFA: 2, aTH: 0, aSH: 90, bTH: 2, bSH: 92 }), SU({ aUA: 285, aFA: 285, bUA: 2, bFA: 2, aTH: 0, aSH: 90, bTH: 75, bSH: 78 })] });
E("Hollow hold (gainage creux)", { v: "s", k: [SU({ T: 286, Hd: 284, aUA: 285, aFA: 285, bUA: 287, bFA: 287, aTH: 72, aSH: 74, bTH: 74, bSH: 76, an: ["P", 140, 206] })] });
E("Hollow rock", { v: "s", k: [SU({ T: 292, Hd: 288, aUA: 292, aFA: 292, bUA: 294, bFA: 294, aTH: 80, aSH: 82, bTH: 82, bSH: 84, an: ["P", 145, 212] }),
  SU({ T: 276, Hd: 276, aUA: 276, aFA: 276, bUA: 278, bFA: 278, aTH: 62, aSH: 64, bTH: 64, bSH: 66, an: ["P", 132, 210] })] });
E("Crunch", { v: "s", k: [SUK({ aUA: 60, aFA: 75, bUA: 62, bFA: 77 }), SUK({ T: 302, Hd: 300, aUA: 105, aFA: 100, bUA: 107, bFA: 102 })] });
E("Crunch inversé", { v: "s", k: [SU({ aTH: 0, aSH: 90, bTH: 2, bSH: 92 }), SU({ an: ["P", 140, 205], aTH: 325, aSH: 45, bTH: 327, bSH: 47 })] });
E("Relevé de jambes allongé", { v: "s", k: [SU({ aTH: 84, aSH: 84, bTH: 86, bSH: 86 }), SU({ aTH: 2, aSH: 2, bTH: 4, bSH: 4 })] });
E("Battements de jambes (ciseaux)", { v: "s", t: 0.6, k: [SU({ T: 282, Hd: 280, aTH: 68, aSH: 68, bTH: 88, bSH: 88 }), SU({ T: 282, Hd: 280, aTH: 88, aSH: 88, bTH: 68, bSH: 68 })] });
E("Crunch bicyclette", { v: "s", k: [SU({ T: 298, Hd: 296, aUA: 30, aFA: 250, bUA: 32, bFA: 252, aTH: 335, aSH: 65, bTH: 76, bSH: 76 }), SU({ T: 298, Hd: 296, aUA: 30, aFA: 250, bUA: 32, bFA: 252, aTH: 76, aSH: 76, bTH: 335, bSH: 65 })] });
E("Sit-up", { v: "s", k: [SUK({ aUA: 40, aFA: 75, bUA: 42, bFA: 77 }), SUK({ T: 15, Hd: 25, aUA: 110, aFA: 100, bUA: 112, bFA: 102 })] });
E("V-up (portefeuille)", { v: "s", k: [SU({ aUA: 270, aFA: 270, bUA: 270, bFA: 270, aTH: 88, aSH: 88, bTH: 88, bSH: 88, an: ["P", 140, 213] }),
  SU({ T: 325, Hd: 335, aUA: 40, aFA: 40, bUA: 42, bFA: 42, aTH: 32, aSH: 32, bTH: 34, bSH: 34, an: ["P", 132, 210] })] });
const RT = (side, o) => P({ T: side < 0 ? -8 : 8, an: ["P", X, 198], aTH: 10, aTHs: 0.5, aSH: 185, aSHs: 0.55, bTH: 350, bTHs: 0.5, bSH: 175, bSHs: 0.55, aWt: [X + side * 38, 196, 1], bWt: [X + side * 33, 193, -1] }, o);
E("Russian twist", { v: "f", k: [RT(-1), RT(1)] });
E("Russian twist lesté", { v: "f", k: [RT(-1), RT(1)], pr: [{ t: "db2", ang: 90 }] });
E("Mountain climbers", { v: "s", t: 0.55, hold: 0.1, k: [HP({ aTH: 150, aSH: 245, aFT: 180 }), HP({ bTH: 150, bSH: 245, bFT: 180 })] });
E("Mountain climbers croisés", { v: "s", t: 0.6, hold: 0.1, k: [HP({ aTH: 140, aSH: 235, aFT: 180, T: 72 }), HP({ bTH: 140, bSH: 235, bFT: 180, T: 72 })] });
E("Essuie-glaces au sol", { v: "f", top: 1, k: [P({ T: 0, an: ["P", X, 120], aUA: 270, aFA: 270, bUA: 90, bFA: 90, aTH: 180, aTHs: 0.25, aSH: 180, aSHs: 0.25, bTH: 180, bTHs: 0.25, bSH: 180, bSHs: 0.25 }),
  P({ T: 0, an: ["P", X, 120], aUA: 270, aFA: 270, bUA: 90, bFA: 90, aTH: 128, aTHs: 0.9, aSH: 128, aSHs: 0.9, bTH: 120, bTHs: 0.9, bSH: 120, bSHs: 0.9 })], pr: [MAT] });
E("Rotation thoracique en planche latérale", { v: "f", k: [SIDE({ T: 66, bFA: 180, an: ["bW", 196, 218], aUA: 0, aFA: 0 }), SIDE({ T: 66, bFA: 180, an: ["bW", 196, 218], aUA: 205, aFA: 215 })] });
E("Marche de l'ours statique (bear hold)", { v: "s", k: [QD({ an: ["P", 125, 166], T: 82, aTH: 170, aSH: 255, bTH: 170, bSH: 255, aFT: "t", bFT: "t" })] });
E("L-sit (sol ou deux chaises)", { v: "s", k: [P({ T: 0, shE: -9, aUA: 176, aFA: 178, bUA: 176, bFA: 178, an: ["aW", 126, 218], aTH: 90, aSH: 90, bTH: 90, bSH: 90 })] });
const PAL = o => FS(P({ aAt: [X - 18, AF], bAt: [X + 18, AF] }, o));
E("Pallof press (anti-rotation)", { v: "f", k: [PAL({ aWt: [X - 2, 108, 1], bWt: [X + 2, 108, -1] }), PAL({ aUA: 175, aUAs: 0.35, aFA: 172, aFAs: 0.3, bUA: 185, bUAs: 0.35, bFA: 188, bFAs: 0.3 })],
  pr: [{ t: "post", x: 18, y1: 90 }, { t: "band", from: [18, 108], to: ["aH", "bH"] }] });
const WC = (x, y, T, o) => FS(P({ T, aAt: [X - 22, AF], bAt: [X + 22, AF], aWt: [x, y, 1], bWt: [x + 6, y + 2, -1] }, o));
E("Rotation de buste à l'élastique (woodchop)", { v: "f", k: [WC(78, 52, -8), WC(178, 178, 10, { an: ["P", X, 142] })], pr: [{ t: "post", x: 14, y1: 30 }, { t: "band", from: [14, 34], to: ["aH", "bH"] }] });
E("Bûcheron avec haltère", { v: "f", k: [WC(88, 178, -10, { an: ["P", X, 142] }), WC(176, 48, 8)], pr: [{ t: "db2", ang: 30 }] });
const WALK = (s, o) => P({ T: 2, an: ["P", X, 137], aUA: 180 - 12 * s, aFA: 182 - 20 * s, bUA: 180 + 12 * s, bFA: 182, aAt: [X + 20 * s, AF], bAt: [X - 20 * s, AF - 2] }, o);
E("Portage unilatéral (suitcase carry)", { v: "s", k: [WALK(1, { aUA: 180, aFA: 180 }), WALK(-1, { aUA: 180, aFA: 180 })], pr: [DBA] });
E("Planche avec tirage d'haltère (renegade row)", { v: "s", k: [HP({ T: 72 }), HP({ T: 72, aUA: 295, aFA: 185 })], pr: [DB] });
E("Planche pieds sur swiss ball", { v: "s", k: [HP({ T: 88, Hd: 90, aTH: 268, aSH: 268, bTH: 268, bSH: 268, aFT: 200, bFT: 200 })], pr: [{ t: "ball", at: "aA", dx: 12, floor: true, r: 26 }] });
E("Pike sur swiss ball", { v: "s", k: [HP({ T: 88, Hd: 90, aTH: 268, aSH: 268, bTH: 268, bSH: 268, aFT: 200, bFT: 200 }), HP({ T: 150, Hd: 160, aTH: 234, aSH: 234, bTH: 234, bSH: 234, aFT: 160, bFT: 160 })],
  pr: [{ t: "ball", at: "aA", dx: 8, floor: true, r: 26 }] });
const STIR = (dx, o) => P({ T: 60, Hd: 66, aUA: 180 + dx, aFA: 88, bUA: 180 + dx, bFA: 88, aTH: 240, aSH: 240, bTH: 240, bSH: 240, aFT: "t", bFT: "t", an: ["aA", 48, 210] }, o);
E("Stir the pot (planche avant-bras sur ballon)", { v: "s", k: [STIR(8), STIR(-10)], pr: [{ t: "ball", at: "aE", dx: 14, floor: true, r: 26 }] });
const CB = (T, o) => P({ T, Hd: T + 10, an: ["P", 142, 168], aAt: [196, AF], bAt: [193, AF], aUA: T + 25, aFA: T - 95, bUA: T + 27, bFA: T - 93 }, o);
E("Crunch sur swiss ball", { v: "s", k: [CB(258), CB(300)], pr: [{ t: "ball", x: 128, r: 28 }] });
const RO = (th, T, ua) => P({ T, Hd: T + 5, an: ["aK", 92, 216], aTH: th, aSH: 270, bTH: th, bSH: 270, aFT: 270, bFT: 270, aUA: ua, aFA: 90, bUA: ua + 2, bFA: 92 });
E("Rollout au swiss ball", { v: "s", k: [RO(160, 38, 165), RO(122, 72, 105)], pr: [{ t: "ball", at: "aE", dx: 12, floor: true, r: 25 }] });
const WH = (th, T, x) => P({ T, Hd: T + 5, an: ["aK", 92, 216], aTH: th, aSH: 270, bTH: th, bSH: 270, aFT: 270, bFT: 270, aWt: [x, 212], bWt: [x - 2, 212] });
E("Roulette abdominale (ab wheel)", { v: "s", k: [WH(165, 40, 128), WH(118, 78, 205)], pr: [{ t: "wheel", at: "aH" }] });
E("Relevé de genoux suspendu", { v: "s", k: [HANG(), HANG({ T: 352, aTH: 78, aSH: 178, bTH: 80, bSH: 180 })], pr: [BAR] });
E("Relevé de jambes suspendu", { v: "s", k: [HANG(), HANG({ T: 348, aTH: 86, aSH: 86, bTH: 88, bSH: 88 })], pr: [BAR] });
E("Planche pieds dans les sangles", { v: "s", k: [HP({ T: 86, Hd: 90, aTH: 266, aSH: 266, bTH: 266, bSH: 266, aFT: 200, bFT: 200 })], pr: [{ t: "strap", top: [70, 4], to: ["aA"] }] });
const DF = (T) => P({ T, Hd: 270, an: ["aS", 82, 180], aUA: 275, aFA: 185, bUA: 275, bFA: 185, aTH: T - 180, aSH: T - 180, bTH: T - 178, bSH: T - 178 });
E("Dragon flag", { v: "s", k: [DF(222), DF(256)], pr: [{ t: "bench", x1: 50, x2: 200, y: 186 }] });

/* ===================== BAS DU CORPS ===================== */
E("Squat au poids du corps", { v: "s", k: [ST(), SQ()] });
const GOB = [ST({ aUA: 170, aFA: 20, bUA: 172, bFA: 22 }), SQ({ aUA: 160, aFA: 30, bUA: 162, bFA: 32 })];
E("Squat goblet", { v: "s", k: GOB, pr: [{ t: "db2", ang: 0 }] });
E("Squat goblet excentrique (descente 4 s)", { v: "s", k: GOB, d: [2.8, 0.9], pr: [{ t: "db2", ang: 0 }] });
E("Squat avec élastique", { v: "s", k: [ST({ aUA: 165, aFA: 340, bUA: 167, bFA: 342 }), SQ({ aUA: 150, aFA: 330, bUA: 152, bFA: 332 })], pr: [{ t: "band", from: "aA", to: "aH" }] });
E("Squat sumo avec haltère", { v: "f", k: [FS({ an: ["P", X, 140], aAt: [94, AF], bAt: [166, AF], aWt: [126, 182], bWt: [134, 182] }), FS({ an: ["P", X, 172], aAt: [94, AF], bAt: [166, AF], aWt: [126, 190], bWt: [134, 190] })], pr: [{ t: "db2", ang: 0 }] });
E("Squat sauté", { v: "s", k: [SQ({ aUA: 235, aFA: 232, bUA: 237, bFA: 234 }), ST({ an: ["P", X, 112], aAt: [X + 2, 198], bAt: [X - 2, 198], aFT: 165, bFT: 165, aUA: 20, aFA: 15, bUA: 22, bFA: 17 })] });
const BUL = (T, py, o) => P({ T, Hd: T, an: ["P", 116, py], aAt: [150, AF], bAt: [60, 181], bFT: 248 }, o);
const BENCHL = { t: "bench", x1: 28, x2: 86, y: 186 };
E("Squat bulgare", { v: "s", k: [BUL(4, 140), BUL(14, 178, { an: ["P", 110, 178] })], pr: [BENCHL] });
E("Squat bulgare lesté", { v: "s", k: [BUL(4, 140), BUL(14, 178, { an: ["P", 110, 178] })], pr: [BENCHL, DB] });
E("Squat sur une jambe vers une chaise", { v: "s", k: [P({ T: 0, an: ["P", 125, 135], aAt: [135, AF], bTH: 130, bSH: 160, aUA: 92, aFA: 92, bUA: 94, bFA: 94 }), P({ T: 28, an: ["P", 98, 170], aAt: [135, AF], bTH: 88, bSH: 92, aUA: 86, aFA: 86, bUA: 88, bFA: 88 })], pr: [{ t: "chair", x1: 70, x2: 112, y: 180, back: "l" }] });
E("Pistol squat", { v: "s", k: [P({ T: 0, an: ["P", 130, 135], aAt: [132, AF], bTH: 150, bSH: 170, aUA: 92, aFA: 92, bUA: 94, bFA: 94 }), P({ T: 42, Hd: 30, an: ["P", 108, 198], aAt: [132, AF], bTH: 84, bSH: 86, aUA: 82, aFA: 82, bUA: 84, bFA: 84 })] });
const WALL = (x, side) => ({ t: "wall", x, side });
E("Chaise contre le mur", { v: "s", k: [P({ T: 0, an: ["P", 80, 178], aAt: [124, AF], bAt: [122, AF] })], pr: [WALL(68)] });
E("Chaise sur une jambe", { v: "s", k: [P({ T: 0, an: ["P", 80, 178], aAt: [124, AF], bTH: 90, bSH: 90 })], pr: [WALL(68)] });
E("Spanish squat (isométrie avec élastique)", { v: "s", k: [P({ T: 28, Hd: 20, an: ["P", 90, 178], aAt: [133, AF], bAt: [131, AF], aUA: 92, aFA: 92, bUA: 94, bFA: 94 })], pr: [{ t: "post", x: 236, y1: 150 }, { t: "band", from: [236, 178], to: "aK" }] });
E("Sissy squat", { v: "s", k: [ST({ aUA: 92, aFA: 92, bUA: 94, bFA: 94 }), P({ an: ["aA", 130, 211], aSH: 218, aTH: 140, bSH: 218, bTH: 140, T: 322, Hd: 340, aFT: "t", bFT: "t", aUA: 75, aFA: 75, bUA: 77, bFA: 77 })] });
const KN = (th, T, o) => P({ an: ["aK", 120, 217], aTH: th, bTH: th, aSH: 270, bSH: 270, aFT: 270, bFT: 270, T, Hd: T, aUA: 150, aFA: 30, bUA: 152, bFA: 32 }, o);
E("Reverse nordic", { v: "s", k: [KN(180, 0), KN(150, 330)] });
E("Extension de jambe à l'élastique", { v: "s", k: [P({ T: 0, an: ["P", 112, 176], aTH: 90, aSH: 185, bTH: 90, bSH: 180, aUA: 175, aFA: 150, bUA: 177, bFA: 150 }), P({ T: 0, an: ["P", 112, 176], aTH: 88, aSH: 92, bTH: 90, bSH: 180, aUA: 175, aFA: 150, bUA: 177, bFA: 150 })],
  pr: [{ t: "chair", x1: 90, x2: 134, y: 184, back: "l" }, { t: "band", from: [126, 222], to: "aA" }] });
E("Fente avant", { v: "s", k: [P({ T: 0, an: ["P", 112, 135], aAt: [114, AF], bAt: [108, AF] }), P({ T: 0, an: ["P", 137, 178], aAt: [178, AF], bAt: [108, 214], bFT: "t" })] });
const FA0 = P({ T: 0, an: ["P", 132, 135], aAt: [140, AF], bAt: [128, AF] });
const FA1 = P({ T: 2, an: ["P", 110, 178], aAt: [140, AF], bAt: [62, 214], bFT: "t" });
E("Fente arrière", { v: "s", k: [FA0, FA1] });
E("Fente arrière avec haltères", { v: "s", k: [FA0, FA1], pr: [DB] });
E("Fente arrière avec montée de genou", { v: "s", k: [P(FA1, { T: 8 }), P(FA0, { bAt: undefined, bTH: 88, bSH: 182, aUA: 200, aFA: 120, bUA: 150, bFA: 60 })] });
const LA = P({ T: 0, an: ["P", 128, 178], aAt: [168, AF], bAt: [86, 214], bFT: "t" });
const LB = P({ T: 0, an: ["P", 128, 178], bAt: [168, AF], aAt: [86, 214], aFT: "t" });
const LMID = P({ T: 0, an: ["P", 128, 137], aAt: [130, AF], bAt: [126, AF] });
E("Fente marchée", { v: "s", mode: "loop", k: [LA, LMID, LB, LMID] });
const LAT = (px, py, o) => FS(P({ an: ["P", px, py], aAt: [88, AF], bAt: [172, AF], aWt: [px - 6, py - 35], bWt: [px + 6, py - 35] }, o));
E("Fente latérale", { v: "f", k: [LAT(130, 142), LAT(100, 170, { T: -6 })] });
E("Fente latérale avec haltère", { v: "f", k: [LAT(130, 142), LAT(100, 170, { T: -6 })], pr: [{ t: "db2", ang: 0 }] });
E("Fente croisée (curtsy)", { v: "f", k: [FS({ aWt: [126, 140], bWt: [134, 140] }), FS({ an: ["P", 124, 168], aAt: [118, AF], bAt: [104, 208, -1], bFT: 200, aWt: [120, 170], bWt: [128, 170] })] });
const AIR = P({ T: 0, an: ["P", 128, 118], aAt: [142, 200], bAt: [112, 202], aFT: 160, bFT: 170, aUA: 30, aFA: 40, bUA: 220, bFA: 200 });
E("Fente sautée", { v: "s", mode: "loop", t: 0.7, k: [LA, AIR, LB, P(AIR, { aAt: [112, 202], bAt: [142, 200], aFT: 170, bFT: 160, aUA: 220, aFA: 200, bUA: 30, bFA: 40 })] });
const BOX = { t: "box", x1: 140, x2: 206, y: 186 };
const SU0 = P({ T: 8, an: ["P", 112, 140], aAt: [160, 181], bAt: [108, AF] });
const SU1 = P({ T: 0, an: ["P", 160, 96], aAt: [162, 181], bAt: [152, 172] });
E("Step-up", { v: "s", k: [SU0, SU1], pr: [BOX] });
E("Step-up lesté", { v: "s", k: [SU0, SU1], pr: [BOX, DB] });
E("Step-down excentrique", { v: "s", k: [P({ T: 0, an: ["P", 118, 107], aAt: [118, 191], bAt: [132, 186], aUA: 160, aFA: 160 }), P({ T: 20, an: ["P", 112, 148], aAt: [118, 191], bAt: [162, AF], aUA: 110, aFA: 100, bUA: 112, bFA: 102 })], pr: [{ t: "box", x1: 70, x2: 150, y: 196 }] });
const BR0 = SUK(), BR1 = SUK({ an: ["P", 140, 186], T: 240, Hd: 262 });
E("Pont fessier", { v: "s", k: [BR0, BR1] });
E("Pont fessier une jambe", { v: "s", k: [SUK({ bAt: undefined, bTH: 40, bSH: 40 }), SUK({ an: ["P", 140, 186], T: 240, Hd: 262, bAt: undefined, bTH: 60, bSH: 60 })] });
E("Pont fessier avec élastique aux genoux", { v: "s", k: [BR0, BR1], pr: [{ t: "loop", j: "aK" }] });
const HT = (T, o) => P({ an: ["aS", 90, 180], T, Hd: T + 15, aAt: [182, AF], bAt: [179, AF], aUA: 135, aFA: 100, bUA: 137, bFA: 102 }, o);
const BENCHHT = { t: "bench", x1: 36, x2: 92, y: 186 };
E("Hip thrust", { v: "s", k: [HT(318, { aUA: 250, aFA: 262, bUA: 252, bFA: 264 }), HT(270, { Hd: 300, aUA: 252, aFA: 262, bUA: 254, bFA: 264 })], pr: [BENCHHT] });
E("Hip thrust lesté", { v: "s", k: [HT(318, { aWt: [123, 199], bWt: [121, 199] }), HT(270, { Hd: 300, aWt: [138, 166], bWt: [136, 166] })], pr: [BENCHHT, { t: "db2", at: "P", off: [2, -15], ang: 90 }] });
E("Hip thrust une jambe", { v: "s", k: [HT(318, { bAt: undefined, bTH: 20, bSH: 110, aUA: 250, aFA: 262 }), HT(270, { Hd: 300, bAt: undefined, bTH: 10, bSH: 100, aUA: 252, aFA: 262, bUA: 254, bFA: 264 })], pr: [BENCHHT] });
const RDL1 = P({ T: 72, Hd: 78, an: ["P", 104, 140], aAt: [X, AF], bAt: [X - 2, AF], aUA: 182, aFA: 182, bUA: 182, bFA: 182 });
E("Soulevé de terre roumain", { v: "s", k: [ST({ aUA: 182, aFA: 182 }), RDL1], pr: [{ t: "db", h: "ab", endon: 1 }] });
const SL1 = P({ T: 86, Hd: 90, an: ["P", 122, 140], aAt: [X, AF], bTH: 268, bSH: 268, bFT: 200, aUA: 182, aFA: 182, bUA: 182, bFA: 182 });
E("Soulevé de terre roumain une jambe", { v: "s", k: [ST(), SL1], pr: [{ t: "db", h: "a", endon: 1 }] });
E("Soulevé de terre une jambe au poids du corps", { v: "s", k: [ST(), P(SL1, { aUA: 150, aFA: 150, bUA: 152, bFA: 152 })] });
E("Good morning à l'élastique", { v: "s", k: [ST({ aUA: 165, aFA: 340, bUA: 167, bFA: 342 }), P(RDL1, { T: 76, Hd: 80, aUA: 241, aFA: 56, bUA: 243, bFA: 58 })], pr: [{ t: "band", from: "aA", to: "aH" }] });
E("Soulevé de terre kettlebell", { v: "s", k: [P({ T: 48, Hd: 62, an: ["P", 102, 168], aAt: [X, AF], bAt: [X - 2, AF], aWt: [128, 194], bWt: [126, 194] }), ST({ aWt: [134, 150], bWt: [132, 150] })], pr: [{ t: "kb", h: "ab" }] });
E("Swing kettlebell", { v: "s", k: [P({ T: 64, Hd: 72, an: ["P", 104, 150], aAt: [X, AF], bAt: [X - 2, AF], aWt: [114, 182], bWt: [112, 182] }), ST({ aUA: 92, aFA: 92, bUA: 92, bFA: 92 })], pr: [{ t: "kb", h: "ab", mode: "fa" }] });
E("Nordic hamstring curl", { v: "s", d: [2.4, 1.0], k: [KN(180, 0, { an: ["aK", 118, 217], aUA: 160, aFA: 150 }), KN(232, 52, { an: ["aK", 118, 217], Hd: 60, aUA: 120, aFA: 110, bUA: 122, bFA: 112 })], pr: [{ t: "block", x1: 50, x2: 82, y: 200 }] });
const LCG = (T, py, x, o) => P({ T, Hd: T + 8, an: ["P", 140, py], aAt: [x, AF], bAt: [x - 3, AF], aUA: 92, aFA: 92, bUA: 94, bFA: 94 }, o);
E("Leg curl glissé (serviette ou chaussettes)", { v: "s", k: [LCG(255, 196, 218), LCG(242, 184, 180)], pr: [{ t: "towel", at: "aA" }] });
E("Leg curl au swiss ball", { v: "s", k: [LCG(252, 190, 222, { aAt: [222, 180], bAt: [219, 180] }), LCG(238, 178, 185, { aAt: [185, 178], bAt: [182, 178] })], pr: [{ t: "ball", at: "aA", dx: 6, floor: true, r: 22 }] });
E("Leg curl à l'élastique", { v: "s", k: [PR(), PR({ aSH: 20, aFT: 300 })], pr: [{ t: "post", x: 16, y1: 200 }, { t: "band", from: [16, 212], to: "aA" }] });
E("Leg curl en suspension", { v: "s", k: [LCG(250, 196, 210, { aAt: [210, 176], bAt: [207, 176] }), LCG(240, 182, 172, { aAt: [172, 168], bAt: [169, 168] })], pr: [{ t: "strap", top: [236, 4], to: ["aA"] }] });
const COP = (T, o) => P({ T, Hd: T, an: ["bE", 196, 218], aUA: 15, aFA: 15, bUA: 180, bFA: 92, aAt: [52, 181], bTH: 250, bSH: 258 }, o);
E("Copenhagen plank", { v: "f", k: [COP(84), COP(72)], pr: [{ t: "bench", x1: 18, x2: 74, y: 186 }] });
E("Adduction de hanche à l'élastique", { v: "f", k: [FS({ aAt: undefined, aTH: 204, aSH: 204, bAt: [X + 8, AF], aUA: 200, aFA: 120, bUA: 160, bFA: 240 }), FS({ aAt: undefined, aTH: 174, aSH: 174, bAt: [X + 8, AF], aUA: 200, aFA: 120, bUA: 160, bFA: 240 })],
  pr: [{ t: "post", x: 14, y1: 196 }, { t: "band", from: [14, 210], to: "aA" }] });
E("Serrage de ballon entre les genoux", { v: "s", k: [SUK({ br: 9.5 }), SUK({ br: 7.5 })], pr: [{ t: "ball", at: "aK", dx: 0, dy: 2, r: 9, front: 1 }] });
const CL = (th) => SIDEL({ aTH: 125, aTHs: 0.7, aSH: 265, aSHs: 0.6, bTH: th, bTHs: 0.7, bSH: 265, bSHs: 0.6 });
E("Clamshell avec élastique", { v: "f", headUnder: 1, k: [CL(125), CL(62)], pr: [{ t: "loop", j: "K" }] });
const MW = (px, ax, bx) => FS({ an: ["P", px, 152], aAt: [ax, AF], bAt: [bx, AF], aUA: 175, aFA: 120, bUA: 185, bFA: 240 });
E("Marche latérale avec élastique (monster walk)", { v: "f", k: [MW(132, 112, 152), MW(118, 86, 148)], pr: [{ t: "loop", j: "K" }, { t: "loop", j: "A" }] });
E("Pas chassés latéraux en squat", { v: "f", t: 0.7, k: [MW(124, 102, 146), MW(110, 78, 140)] });
E("Abduction de hanche couché sur le côté", { v: "f", headUnder: 1, k: [SIDEL(), SIDEL({ bTH: 58, bSH: 58 })] });
const FH = (th, s) => TOPP({ an: ["P", X, 150], aUA: 180, aUAs: 0.18, aFA: 180, aFAs: 0.18, bUA: 180, bUAs: 0.18, bFA: 180, bFAs: 0.18, aTH: th, aTHs: s, aSH: 180, aSHs: 0.95, bTH: 180, bTHs: 0.18, bSH: 180, bSHs: 0.95 });
E("Fire hydrant", { v: "f", top: 1, k: [FH(180, 0.18), FH(268, 0.9)], pr: [MATP] });
E("Donkey kick", { v: "s", k: [QD(), QD({ aTH: 272, aSH: 2, aFT: 272 })] });
const KBS = o => ST(P({ T: 8, aWt: [190, 104], bWt: [188, 104] }, o));
E("Kickback fessier à l'élastique", { v: "s", k: [KBS(), KBS({ aAt: undefined, aTH: 205, aSH: 212 })], pr: [WALL(194, "r"), { t: "band", from: [186, 216], to: "aA" }] });
E("Flexion de hanche à l'élastique", { v: "s", k: [ST({ aUA: 200, aFA: 110, bUA: 202, bFA: 112 }), ST({ aAt: undefined, aTH: 92, aSH: 180, aUA: 200, aFA: 110, bUA: 202, bFA: 112 })], pr: [{ t: "post", x: 30, y1: 200 }, { t: "band", from: [30, 214], to: "aA" }] });
const CALF1 = { an: ["P", X, 123], aAt: [X + 2, 208], bAt: [X - 2, 208], aFT: "t", bFT: "t" };
E("Mollets debout", { v: "s", k: [ST(), ST(CALF1)] });
E("Mollets lestés", { v: "s", k: [ST(), ST(CALF1)], pr: [{ t: "db", h: "ab", endon: 1 }] });
E("Mollets une jambe sur marche (excentrique)", { v: "s", d: [0.8, 2.4], k: [P({ T: 0, an: ["aA", 134.5, 183], aFT: 150, bTH: 190, bSH: 250, bFT: 200 }), P({ T: 0, an: ["aA", 128, 201], aFT: 70, bTH: 190, bSH: 250, bFT: 200 })], pr: [{ t: "box", x1: 133, x2: 210, y: 196 }] });
E("Mollets assis genoux fléchis", { v: "s", k: [P({ T: 0, an: ["P", 100, 178], aAt: [144, AF], bAt: [141, AF], aUA: 170, aFA: 100, bUA: 172, bFA: 102 }), P({ T: 0, an: ["P", 100, 178], aAt: [144, 207], bAt: [141, 207], aFT: "t", bFT: "t", aUA: 170, aFA: 100, bUA: 172, bFA: 102 })],
  pr: [{ t: "bench", x1: 58, x2: 118, y: 186 }, { t: "db2", at: "aK", off: [0, -9], ang: 90 }] });
E("Relevés de pointes de pied", { v: "s", k: [ST({ T: 356, an: ["P", 124, 135], aAt: [134, AF], bAt: [132, AF] }), ST({ T: 356, an: ["P", 124, 135], aAt: [134, AF], bAt: [132, AF], aFT: 52, bFT: 52 })], pr: [WALL(108)] });
const INV = f => P({ T: 0, an: ["P", X, 168], aTH: 180, aTHs: 0.25, aSH: 180, bTH: 180, bTHs: 0.25, bSH: 180, aFT: f, bFT: 180, aUA: 186, aFA: 168, bUA: 174, bFA: 192 });
E("Inversion-éversion de cheville à l'élastique", { v: "f", vb: [10, 110, 190, 175], k: [INV(140), INV(222)], pr: [{ t: "chair", x1: 100, x2: 160, y: 180 }, { t: "post", x: 14, y1: 205 }, { t: "band", from: [14, 216], to: "aA" }] });
E("Équilibre sur une jambe", { v: "s", t: 1.8, k: [ST({ bAt: undefined, bTH: 115, bSH: 178, aUA: 160, aFA: 150, bUA: 200, bFA: 200 }), ST({ T: 3, an: ["P", X + 1, 135], bAt: undefined, bTH: 118, bSH: 180, aUA: 164, aFA: 154, bUA: 196, bFA: 196 })] });
E("Sautillements (pogo jumps)", { v: "s", t: 0.35, hold: 0.04, k: [ST({ an: ["P", X, 124], aAt: [X + 2, 209], bAt: [X - 2, 209], aFT: "t", bFT: "t", aUA: 200, aFA: 120, bUA: 202, bFA: 122 }), ST({ an: ["P", X, 109], aAt: [X + 2, 194], bAt: [X - 2, 194], aFT: 165, bFT: 165, aUA: 200, aFA: 120, bUA: 202, bFA: 122 })] });
const KU = (sd) => sd === "a" ? P({ T: 0, an: ["P", X, 128], aTH: 85, aSH: 180, aFT: 150, bAt: [X - 2, 214], bFT: "t", aUA: 215, aFA: 120, bUA: 140, bFA: 50 }) :
  P({ T: 0, an: ["P", X, 128], bTH: 85, bSH: 180, bFT: 150, aAt: [X - 2, 214], aFT: "t", bUA: 215, bFA: 120, aUA: 140, aFA: 50 });
E("Montées de genoux", { v: "s", t: 0.42, hold: 0.04, k: [KU("a"), KU("b")] });
E("Saut en longueur sans élan", { v: "s", mode: "cut", k: [P({ T: 45, Hd: 40, an: ["P", 92, 168], aAt: [108, AF], bAt: [106, AF], aUA: 250, aFA: 250, bUA: 252, bFA: 252 }),
  P({ T: 30, an: ["P", 158, 110], aTH: 115, aSH: 195, bTH: 118, bSH: 198, aUA: 60, aFA: 60, bUA: 62, bFA: 62 }),
  P({ T: 38, an: ["P", 200, 172], aAt: [230, AF], bAt: [228, AF], aUA: 80, aFA: 80, bUA: 82, bFA: 82 })] });
E("Saut sur banc (box jump)", { v: "s", mode: "cut", k: [P({ T: 40, an: ["P", 96, 170], aAt: [116, AF], bAt: [114, AF], aUA: 240, aFA: 240, bUA: 242, bFA: 242 }),
  P({ T: 18, an: ["P", 150, 112], aTH: 110, aSH: 195, bTH: 112, bSH: 197, aUA: 40, aFA: 40, bUA: 42, bFA: 42 }),
  P({ T: 30, an: ["P", 176, 144], aAt: [198, 181], bAt: [196, 181], aUA: 80, aFA: 80, bUA: 82, bFA: 82 })], pr: [{ t: "box", x1: 166, x2: 232, y: 186 }] });
E("Sauts latéraux (skater jumps)", { v: "f", t: 0.75, k: [P({ T: -8, an: ["P", 96, 166], aAt: [92, AF], bAt: [70, 206, 1], bFT: 200, aUA: 150, aFA: 140, bUA: 215, bFA: 230 }), P({ T: 8, an: ["P", 164, 166], bAt: [168, AF], aAt: [190, 206, -1], aFT: 160, aUA: 145, aFA: 130, bUA: 210, bFA: 220 })] });
E("Saut une jambe avec réception stabilisée", { v: "s", k: [P({ T: 30, an: ["P", 110, 170], aAt: [128, AF], bTH: 205, bSH: 255, bFT: 200, aUA: 215, aFA: 215, bUA: 140, bFA: 140 }), P({ T: 5, an: ["P", 128, 110], aAt: [132, 196], aFT: 160, bTH: 190, bSH: 235, bFT: 200, aUA: 20, aFA: 20, bUA: 22, bFA: 22 })] });
E("Drop jump (saut en contrebas)", { v: "s", mode: "cut", k: [P({ T: 0, an: ["P", 78, 100], aAt: [80, 181], bAt: [78, 181] }),
  P({ T: 35, an: ["P", 122, 172], aAt: [145, AF], bAt: [143, AF], aUA: 230, aFA: 230, bUA: 232, bFA: 232 }),
  P({ T: 5, an: ["P", 150, 100], aAt: [152, 190], bAt: [150, 190], aFT: 165, bFT: 165, aUA: 15, aFA: 15, bUA: 17, bFA: 17 })], pr: [{ t: "box", x1: 40, x2: 100, y: 186 }] });
E("Squat assisté aux sangles", { v: "s", k: [ST({ aWt: [178, 112], bWt: [176, 112] }), SQ({ T: 14, an: ["P", 92, 184], aWt: [176, 142], bWt: [174, 142] })], pr: [{ t: "strap", top: [240, 4], to: ["aH"] }] });
E("Fente arrière pied dans la sangle", { v: "s", k: [P({ T: 5, an: ["P", 118, 140], aAt: [148, AF], bAt: [72, 196], bFT: 250 }), P({ T: 10, an: ["P", 112, 180], aAt: [148, AF], bAt: [52, 200], bFT: 250 })], pr: [{ t: "strap", top: [62, 4], to: ["bA"] }] });
E("Squat au mur avec swiss ball", { v: "s", k: [ST({ an: ["P", 110, 138], aAt: [140, AF], bAt: [138, AF] }), SQ({ T: 2, Hd: 0, an: ["P", 104, 180], aAt: [150, AF], bAt: [148, AF] })], pr: [WALL(56), { t: "ball", at: "P", dx: -26, dy: -26, r: 20 }] });

/* ===================== HAUT DU CORPS ===================== */
E("Pompes classiques", { v: "s", k: [PU0(), PU1()] });
E("Pompes diamant", { v: "s", k: [PU0({ aWt: [164, 218], bWt: [162, 218] }), PU1({ aWt: [164, 218], bWt: [162, 218] })] });
E("Pompes avec élastique", { v: "s", k: [PU0(), PU1()], pr: [{ t: "arcband" }] });
E("Pompes scapulaires (push-up plus)", { v: "s", t: 0.8, k: [PU0({ shE: -2 }), PU0({ T: 67, Hd: 73, aTH: 247, aSH: 247, bTH: 247, bSH: 247, shE: 2 })] });
const KNP = (th, T) => P({ an: ["aK", 95, 217], aTH: th, bTH: th, aSH: 300, bSH: 300, T, Hd: T + 6, aWt: [172, 218], bWt: [169, 218] });
E("Pompes sur les genoux", { v: "s", k: [KNP(235, 55), KNP(253, 73)] });
const INC = (T, o) => P({ an: ["aA", 40, 212], aFT: "t", bFT: "t", T, Hd: T + 6, aTH: T + 180, aSH: T + 180, bTH: T + 180, bSH: T + 180, aWt: [182, 184], bWt: [180, 184] }, o);
E("Pompes mains surélevées", { v: "s", k: [INC(58), INC(66)], pr: [{ t: "bench", x1: 160, x2: 228, y: 186 }] });
const DEC = (T) => P({ an: ["aA", 48, 174], aFT: 160, bFT: 160, T, Hd: T, aTH: T + 180, aSH: T + 180, bTH: T + 180, bSH: T + 180, aWt: [180, 218], bWt: [178, 218] });
E("Pompes pieds surélevés", { v: "s", k: [DEC(84), DEC(96)], pr: [{ t: "bench", x1: 14, x2: 70, y: 186 }] });
const HEAD = (py, o) => P({ T: 0, Ts: 0.35, an: ["P", X, py], aWt: [92, 218], bWt: [168, 218], aTH: 180, aTHs: 0.05, aSH: 180, aSHs: 0.05, bTH: 180, bTHs: 0.05, bSH: 180, bSHs: 0.05 }, o);
E("Pompes larges", { v: "f", noLegs: 1, k: [HEAD(180), HEAD(200)] });
E("Pompes archer", { v: "f", noLegs: 1, k: [HEAD(180, { aWt: [80, 218], bWt: [180, 218] }), HEAD(198, { an: ["P", 110, 198], T: -6, aWt: [80, 218], bWt: [180, 218] })] });
const PIK = (px, py, T) => P({ an: ["P", px, py], T, Hd: T + 15, aWt: [156, 218], bWt: [153, 218], aAt: [62, 214], bAt: [60, 214], aFT: "t", bFT: "t" });
E("Pompes pike", { v: "s", k: [PIK(110, 140, 125), PIK(116, 152, 138)] });
E("Pompes claquées", { v: "s", t: 0.6, k: [PU1(), PU0({ T: 62, Hd: 68, aTH: 242, aSH: 242, bTH: 242, bSH: 242, aWt: [166, 198], bWt: [164, 198] })] });
const SUSP = (T, hx, hy) => P({ an: ["aA", 60, 212], aFT: "t", bFT: "t", T, Hd: T + 5, aTH: T + 180, aSH: T + 180, bTH: T + 180, bSH: T + 180, aWt: [hx, hy], bWt: [hx - 2, hy] });
E("Pompes en suspension", { v: "s", k: [SUSP(50, 205, 140), SUSP(62, 196, 152)], pr: [{ t: "strap", top: [222, 4], to: ["aH"] }] });
E("Poirier contre le mur", { v: "s", k: [P({ T: 165, Hd: 175, an: ["aW", 135, 218], aUA: 180, aFA: 180, bUA: 180, bFA: 180, aTH: 345, aSH: 345, bTH: 347, bSH: 347, aFT: 300, bFT: 300 })], pr: [WALL(100)] });
E("Dips sur banc", { v: "s", k: [P({ T: 0, Hd: 5, an: ["P", 100, 170], aWt: [92, 183], bWt: [90, 183], aAt: [172, AF], bAt: [170, AF], aFT: 50, bFT: 50 }), P({ T: 4, Hd: 8, an: ["P", 103, 203], aWt: [92, 183], bWt: [90, 183], aAt: [172, AF], bAt: [170, AF], aFT: 50, bFT: 50 })], pr: [{ t: "bench", x1: 36, x2: 96, y: 186 }] });
const DCH = (py) => P({ T: 0, an: ["P", X, py], aWt: [80, 134], bWt: [180, 134], aTH: 183, aSH: 180, aSHs: 0.3, bTH: 177, bSH: 180, bSHs: 0.3 });
E("Dips entre deux chaises", { v: "f", k: [DCH(128), DCH(156)], pr: [{ t: "post", x: 76, y1: 136 }, { t: "post", x: 184, y1: 136 }, { t: "line", a: [70, 136], b: [90, 136], w: 4 }, { t: "line", a: [170, 136], b: [190, 136], w: 4 }] });
const BENCH = { t: "bench", x1: 55, x2: 172, y: 186 };
const BP = (o) => P({ T: 270, Hd: 270, an: ["P", 140, 176], aAt: [190, AF], bAt: [187, AF] }, o);
E("Développé couché haltères", { v: "s", k: [BP({ aWt: [111, 167, 1], bWt: [109, 167, 1] }), BP({ aWt: [97, 123], bWt: [95, 123] })], pr: [BENCH, DB] });
E("Écarté couché haltères", { v: "s", k: [BP({ aWt: [97, 123], bWt: [95, 123] }), BP({ aUA: 128, aFA: 112, bUA: 130, bFA: 114 })], pr: [BENCH, DB] });
E("Pull-over haltère", { v: "s", k: [BP({ aUA: 2, aFA: 2, bUA: 2, bFA: 2 }), BP({ aUA: 282, aFA: 282, bUA: 282, bFA: 282 })], pr: [BENCH, { t: "db2", ang: 90 }] });
E("Barre au front avec haltères", { v: "s", k: [BP({ aUA: 345, aFA: 245, bUA: 345, bFA: 245 }), BP({ aUA: 345, aFA: 345, bUA: 345, bFA: 345 })], pr: [BENCH, DB] });
const INCL = { t: "incl", back: [[62, 110], [122, 180]], seat: [110, 162, 186] };
const IP = (o) => P({ T: 318, Hd: 322, an: ["P", 136, 176], aAt: [192, AF], bAt: [189, AF] }, o);
E("Développé incliné haltères", { v: "s", k: [IP({ aWt: [128, 134, 1], bWt: [126, 134, 1] }), IP({ aWt: [114, 90], bWt: [112, 90] })], pr: [INCL, DB] });
E("Curl incliné sur banc", { v: "s", k: [IP({ aUA: 182, aFA: 182, bUA: 182, bFA: 182 }), IP({ aUA: 182, aFA: 30, bUA: 182, bFA: 32 })], pr: [INCL, { t: "db", h: "ab", endon: 1 }] });
E("Développé au sol haltères (floor press)", { v: "s", k: [SUK({ aWt: [115, 190, 1], bWt: [113, 190, 1] }), SUK({ aWt: [97, 160], bWt: [95, 160] })], pr: [DB] });
E("Développé pectoraux à l'élastique", { v: "s", k: [ST({ T: 5, aAt: [140, AF], bAt: [114, AF], aWt: [142, 100], bWt: [140, 100] }), ST({ T: 5, aAt: [140, AF], bAt: [114, AF], aWt: [186, 98], bWt: [184, 98] })], pr: [{ t: "post", x: 22, y1: 82 }, { t: "band", from: [22, 100], to: ["aH"], back: 1 }] });
const MIL = [ST({ aWt: [141, 82, 1], bWt: [139, 82, 1] }), ST({ aWt: [134, 30], bWt: [132, 30] })];
E("Développé militaire haltères", { v: "s", k: MIL, pr: [DB] });
E("Développé épaules à l'élastique", { v: "s", k: MIL, pr: [{ t: "band", from: "aA", to: "aH" }] });
const SEAT = (o) => P({ T: 0, an: ["P", 108, 178], aAt: [152, AF], bAt: [149, AF] }, o);
E("Développé épaules assis", { v: "s", k: [SEAT({ aWt: [118, 124, 1], bWt: [116, 124, 1] }), SEAT({ aWt: [112, 74], bWt: [110, 74] })], pr: [{ t: "bench", x1: 78, x2: 138, y: 186 }, { t: "line", a: [86, 186], b: [86, 116], w: 5 }, DB] });
E("Développé Arnold", { v: "f", k: [FS({ aUA: 176, aUAs: 0.5, aFA: 8, bUA: 184, bUAs: 0.5, bFA: 352 }), FS({ aUA: 332, aFA: 352, bUA: 28, bFA: 8 })], pr: [DB] });
E("Push press haltères", { v: "s", t: 0.8, k: [P({ T: 5, an: ["P", 122, 152], aAt: [X, AF], bAt: [X - 2, AF], aWt: [134, 97, 1], bWt: [132, 97, 1] }), ST({ aWt: [133, 30], bWt: [131, 30] })], pr: [DB] });
const LR = [FS({ aUA: 193, aFA: 191, bUA: 167, bFA: 169 }), FS({ aUA: 273, aFA: 268, bUA: 87, bFA: 92 })];
E("Élévations latérales haltères", { v: "f", k: LR, pr: [DB] });
E("Élévations latérales à l'élastique", { v: "f", k: LR, pr: [{ t: "band", from: "aA", to: "aH" }, { t: "band", from: "bA", to: "bH" }] });
E("Élévations frontales", { v: "s", k: [ST({ aUA: 182, aFA: 182, bUA: 182, bFA: 182 }), ST({ aUA: 90, aFA: 88, bUA: 92, bFA: 90 })], pr: [{ t: "db", h: "ab", endon: 1 }] });
const ER = (fa, s) => FS({ aUA: 182, aFA: fa, aFAs: s, bUA: 172, bFA: 174 });
E("Rotation externe d'épaule à l'élastique", { v: "f", armDark: "b", k: [ER(100, 0.75), ER(180, 0.12), ER(265, 0.75)], pr: [{ t: "post", x: 240, y1: 140 }, { t: "band", from: [240, 150], to: "aH" }] });
E("Rotation interne d'épaule à l'élastique", { v: "f", armDark: "b", k: [ER(265, 0.75), ER(180, 0.12), ER(100, 0.75)], pr: [{ t: "post", x: 20, y1: 140 }, { t: "band", from: [20, 150], to: "aH" }] });
const ER90 = (fa, s) => FS({ aUA: 272, aFA: fa, aFAs: s, bUA: 172, bFA: 174 });
E("Rotation externe à 90° d'abduction", { v: "f", armDark: "b", k: [ER90(180, 1), ER90(270, 0.12), ER90(360, 1)], pr: [{ t: "post", x: 20, y1: 150 }, { t: "band", from: [20, 160], to: "aH" }] });
const ERL = (fa, s) => SIDEL({ bUA: 92, bFA: fa, bFAs: s });
E("Rotation externe couché sur le côté", { v: "f", headUnder: 1, k: [ERL(180, 0.75), ERL(90, 0.12), ERL(0, 0.75)], pr: [{ t: "db", h: "b" }] });
E("Cuban press", { v: "f", k: [FS(), FS({ aUA: 268, aFA: 182, bUA: 92, bFA: 178 }), FS({ aUA: 268, aFA: 270, aFAs: 0.15, bUA: 92, bFA: 90, bFAs: 0.15 }), FS({ aUA: 268, aFA: 2, bUA: 92, bFA: 358 }), FS({ aUA: 332, aFA: 352, bUA: 28, bFA: 8 })], pr: [DB] });
const HALO = (x1, y1, x2, y2) => FS({ aWt: [x1, y1, 1], bWt: [x2, y2, -1] });
E("Halo kettlebell", { v: "f", mode: "loop", t: 0.7, hold: 0.05, k: [HALO(150, 58, 156, 60), HALO(124, 38, 136, 38), HALO(104, 60, 110, 58), HALO(124, 96, 136, 96)], pr: [{ t: "kb", h: "ab", mode: "up" }] });
const CURL = [ST({ aUA: 182, aFA: 182, bUA: 180, bFA: 180 }), ST({ aUA: 184, aFA: 14, bUA: 182, bFA: 12 })];
E("Curl biceps haltères", { v: "s", k: CURL, pr: [{ t: "db", h: "ab", endon: 1 }] });
E("Curl marteau", { v: "s", k: CURL, pr: [DB] });
E("Curl biceps à l'élastique", { v: "s", k: CURL, pr: [{ t: "band", from: "aA", to: "aH" }] });
E("Extension triceps au-dessus de la tête", { v: "s", k: [ST({ aUA: 8, aFA: 222, bUA: 8, bFA: 222 }), ST({ aUA: 4, aFA: 4, bUA: 4, bFA: 4 })], pr: [{ t: "db2", ang: 0 }] });
E("Extension triceps à l'élastique", { v: "s", k: [ST({ T: 8, aUA: 172, aFA: 28, bUA: 174, bFA: 30 }), ST({ T: 8, aUA: 172, aFA: 172, bUA: 174, bFA: 174 })], pr: [{ t: "post", x: 196, y1: 10, y2: 30 }, { t: "band", from: [196, 30], to: "aH" }] });
const KICK = (fa) => P({ T: 72, Hd: 78, an: ["P", 106, 142], aAt: [X, AF], bAt: [104, AF], aUA: 262, aFA: fa, bWt: [150, 168] });
E("Kickback triceps", { v: "s", k: [KICK(180), KICK(262)], pr: [DBA] });
const WR = (ha, o) => P({ T: 8, an: ["P", 100, 178], aAt: [146, AF], bAt: [143, AF], aUA: 158, aFA: 90, aHA: ha, bUA: 170, bFA: 110 }, o);
const STOOL = { t: "bench", x1: 66, x2: 124, y: 186 };
E("Extension des poignets", { v: "s", vb: [70, 100, 120, 111], k: [WR(150), WR(40)], pr: [STOOL, DBA] });
E("Flexion des poignets", { v: "s", vb: [70, 100, 120, 111], k: [WR(160), WR(60)], pr: [STOOL, DBA] });
E("Pronation-supination avec haltère", { v: "s", vb: [70, 100, 120, 111], k: [WR(90, { aDB: 0, aDBs: 1 }), WR(90, { aDB: 0, aDBs: 0.2 }), WR(90, { aDB: 180, aDBs: 1 })], pr: [STOOL, { t: "hammer", h: "a" }] });
E("Extension des doigts à l'élastique", { v: "f", vb: [40, 30, 150, 138], k: [FS({ aUA: 218, aFA: 340, bUA: 170, bFA: 174, fs: 3 }), FS({ aUA: 218, aFA: 340, bUA: 170, bFA: 174, fs: 18 })], pr: [{ t: "fingers", at: "aH" }] });
E("Suspension passive à la barre", { v: "s", t: 2, k: [HANG(), HANG({ an: ["P", X + 2, 128], T: 2 })], pr: [BAR] });

/* ===================== DOS ===================== */
E("Superman", { v: "s", k: [PR(), PR({ T: 80, Hd: 76, aUA: 78, aFA: 78, bUA: 80, bFA: 80, aTH: 282, aSH: 282, bTH: 282, bSH: 282 })] });
E("Superman alterné (nageur)", { v: "s", t: 0.8, k: [PR({ T: 84, aUA: 76, aFA: 76, bTH: 282, bSH: 282 }), PR({ T: 84, bUA: 78, bFA: 78, aTH: 282, aSH: 282 })] });
E("Bird dog", { v: "s", k: [QD(), QD({ aWt: undefined, aUA: 90, aFA: 90, bTH: 268, bSH: 268, bFT: 250 })] });
E("Cobra tenu au sol", { v: "s", k: [PR({ T: 77, Hd: 72, aUA: 256, aFA: 258, bUA: 258, bFA: 260 })] });
E("Anges inversés au sol", { v: "f", top: 1, k: [TOPP({ aUA: 335, aFA: 335, bUA: 25, bFA: 25 }), TOPP({ aUA: 196, aFA: 192, bUA: 164, bFA: 168 })], pr: [MATP] });
E("Y-T-W allongé", { v: "f", top: 1, k: [TOPP({ aUA: 325, aFA: 325, bUA: 35, bFA: 35 }), TOPP({ aUA: 270, aFA: 270, bUA: 90, bFA: 90 }), TOPP({ aUA: 235, aFA: 320, bUA: 125, bFA: 40 })], pr: [MATP] });
E("Good morning au poids du corps", { v: "s", k: [ST({ aUA: 168, aFA: 55, bUA: 170, bFA: 57 }), P(RDL1, { T: 74, Hd: 78, aUA: 242, aFA: 129, bUA: 244, bFA: 131 })] });
E("Planche inversée", { v: "s", k: [P({ T: 292.8, Hd: 300, an: ["aA", 205, 214], aTH: 112.8, aSH: 112.8, bTH: 112.8, bSH: 112.8, aFT: 30, bFT: 30, aWt: [82, 218], bWt: [80, 218] })] });
const IR = (T, o) => P({ T, Hd: T, an: ["aA", 232, 214], aTH: T - 180, aSH: T - 180, bTH: T - 180, bSH: T - 180, aFT: 30, bFT: 30, aWt: [108, 114], bWt: [106, 114] }, o);
E("Rowing inversé sous une table", { v: "s", k: [IR(290), IR(308.5)], pr: [{ t: "table", x1: 80, x2: 200, y: 110 }] });
E("Extension lombaire sur swiss ball", { v: "s", k: [P({ T: 122, Hd: 128, an: ["P", 126, 166], aAt: [40, AF], bAt: [38, AF], aFT: "t", bFT: "t", aUA: 80, aFA: 260, bUA: 82, bFA: 262 }),
  P({ T: 90, Hd: 86, an: ["P", 126, 166], aAt: [40, AF], bAt: [38, AF], aFT: "t", bFT: "t", aUA: 30, aFA: 210, bUA: 32, bFA: 212 })], pr: [{ t: "ball", x: 118, r: 28 }, WALL(32)] });
const ROW1 = (ua, fa) => P({ T: 90, Hd: 95, an: ["P", 128, 138], aAt: [118, AF], bTH: 180, bSH: 270, bFT: 270, bWt: [176, 180], aUA: ua, aFA: fa });
E("Rowing haltère un bras", { v: "s", k: [ROW1(180, 180), ROW1(286, 182)], pr: [{ t: "bench", x1: 78, x2: 206, y: 184 }, DBA] });
const BO = (ua, fa) => P({ T: 48, Hd: 58, an: ["P", 108, 150], aAt: [X, AF], bAt: [X - 2, AF], aUA: ua, aFA: fa, bUA: ua + 2, bFA: fa + 2 });
E("Rowing buste penché deux haltères", { v: "s", k: [BO(182, 182), BO(262, 186)], pr: [{ t: "db", h: "ab", endon: 1 }] });
const CHS = (o) => P({ T: 45, Hd: 50, an: ["P", 112, 150], aAt: [84, AF], bAt: [82, AF], aFT: "t", bFT: "t" }, o);
const PAD = { t: "incl", back: [[118, 164], [158, 124]], seat: [110, 146, 198] };
E("Rowing sur banc incliné", { v: "s", k: [CHS({ aUA: 182, aFA: 182, bUA: 182, bFA: 182 }), CHS({ aUA: 282, aFA: 184, bUA: 284, bFA: 186 })], pr: [PAD, { t: "db", h: "ab", endon: 1 }] });
E("Y sur banc incliné", { v: "s", k: [CHS({ aUA: 182, aFA: 182, bUA: 182, bFA: 182 }), CHS({ aUA: 48, aFA: 48, bUA: 50, bFA: 50 })], pr: [PAD, DB] });
const RF = (o) => P({ T: 0, Ts: 0.45, an: ["P", X, 141], aAt: [X - 14, AF], bAt: [X + 14, AF], aUA: 183, aFA: 183, bUA: 177, bFA: 177 }, o);
E("Oiseau haltères", { v: "f", k: [RF(), RF({ aUA: 262, aFA: 266, bUA: 98, bFA: 94 })], pr: [DB] });
E("Oiseau sur banc incliné", { v: "f", k: [RF(), RF({ aUA: 262, aFA: 266, bUA: 98, bFA: 94 })], pr: [{ t: "box", x1: 112, x2: 148, y: 156 }, DB] });
E("Shrugs haltères", { v: "f", k: [FS({ shE: -1 }), FS({ shE: 7 })], pr: [DB] });
E("Soulevé de terre haltères", { v: "s", k: [P({ T: 52, Hd: 62, an: ["P", 104, 168], aAt: [X, AF], bAt: [X - 2, AF], aUA: 182, aFA: 182, bUA: 182, bFA: 182 }), ST({ aUA: 182, aFA: 182 })], pr: [{ t: "db", h: "ab", endon: 1 }] });
const SR = (ua, fa) => P({ T: 0, Hd: 2, an: ["P", 95, 207], aTH: 90, aSH: 90, bTH: 90, bSH: 90, aFT: 2, bFT: 2, aUA: ua, aFA: fa, bUA: ua + 2, bFA: fa + 2 });
E("Rowing assis à l'élastique", { v: "s", k: [SR(92, 92), SR(205, 88)], pr: [{ t: "band", from: "aA", to: "aH" }] });
E("Rowing un bras à l'élastique avec rotation", { v: "s", k: [ST({ T: 6, aAt: [142, AF], bAt: [112, AF], aUA: 92, aFA: 92 }), ST({ T: -4, aAt: [142, AF], bAt: [112, AF], aUA: 215, aFA: 92 })], pr: [{ t: "post", x: 238, y1: 80 }, { t: "band", from: [238, 100], to: "aH" }] });
E("Tirage vertical à l'élastique", { v: "f", k: [FS({ aUA: 338, aFA: 340, bUA: 22, bFA: 20 }), FS({ aUA: 228, aFA: 352, bUA: 132, bFA: 8 })], pr: [{ t: "line", a: [110, 4], b: [150, 4], w: 4 }, { t: "band", from: [130, 4], to: ["aH", "bH"] }] });
E("Tirage bras tendus à l'élastique", { v: "s", k: [ST({ T: 18, Hd: 22, an: ["P", 122, 137], aUA: 45, aFA: 45, bUA: 47, bFA: 47 }), ST({ T: 18, Hd: 22, an: ["P", 122, 137], aUA: 182, aFA: 182, bUA: 184, bFA: 184 })], pr: [{ t: "post", x: 228, y1: 30 }, { t: "band", from: [228, 40], to: "aH" }] });
const CRAWL = (ua, fa) => P({ T: 68, Hd: 74, an: ["P", 108, 145], aAt: [X, AF], bAt: [X - 2, AF], aUA: ua, aFA: fa, bUA: ua + 2, bFA: fa + 2 });
E("Simulation de crawl à l'élastique", { v: "s", k: [CRAWL(96, 96), CRAWL(140, 182), CRAWL(232, 238)], pr: [{ t: "post", x: 238, y1: 150 }, { t: "band", from: [238, 168], to: "aH" }] });
E("Face pull à l'élastique", { v: "s", k: [ST({ aUA: 86, aFA: 86, bUA: 88, bFA: 88 }), ST({ aUA: 92, aUAs: 0.3, aFA: 14, bUA: 94, bUAs: 0.3, bFA: 16 })], pr: [{ t: "post", x: 238, y1: 60 }, { t: "band", from: [238, 80], to: "aH" }] });
E("Écartés à l'élastique (pull-apart)", { v: "f", k: [FS({ aUA: 200, aUAs: 0.3, aFA: 160, aFAs: 0.5, bUA: 160, bUAs: 0.3, bFA: 200, bFAs: 0.5 }), FS({ aUA: 270, aFA: 270, bUA: 90, bFA: 90 })], pr: [{ t: "band", from: "aH", to: "bH" }] });
const PULL = [HANG(), HANG({ an: ["P", X, 86], T: 4, aTH: 192, aSH: 200, bTH: 188, bSH: 196 })];
E("Tractions pronation", { v: "s", k: PULL, pr: [BAR] });
E("Tractions supination", { v: "s", k: PULL, pr: [BAR] });
E("Tractions assistées à l'élastique", { v: "s", k: PULL, pr: [BAR, { t: "band", from: [126, 24], to: "aK" }, { t: "band", from: [134, 24], to: "aK" }] });
E("Tractions négatives", { v: "s", d: [2.6, 0.7], k: [PULL[1], PULL[0]], pr: [BAR] });
E("Tractions scapulaires", { v: "s", t: 0.8, k: [HANG({ shE: 5, an: ["P", X, 131] }), HANG({ shE: -3, an: ["P", X, 123] })], pr: [BAR] });
const SROW = (T, hx, hy, o) => P({ an: ["aA", 190, AF], aFT: 30, bFT: 30, T, Hd: T + 8, aTH: T - 180, aSH: T - 180, bTH: T - 180, bSH: T - 180, aWt: [hx, hy], bWt: [hx - 2, hy] }, o);
const STRAP2 = { t: "strap", top: [186, 2], to: ["aH"] };
E("Rowing en suspension", { v: "s", k: [SROW(320, 146, 84), SROW(340, 160, 84)], pr: [STRAP2] });
E("Rowing un bras en suspension", { v: "s", k: [SROW(320, 146, 84, { bWt: undefined, bUA: 200, bFA: 200 }), SROW(338, 160, 84, { bWt: undefined, bUA: 190, bFA: 190 })], pr: [STRAP2] });
E("Y en suspension", { v: "s", k: [SROW(320, 146, 84), SROW(335, 126, 48)], pr: [{ t: "strap", top: [150, 2], to: ["aH"] }] });

/* ===================== CORPS ENTIER & AJOUTS ===================== */
const BSTAND = ST({ an: ["P", X, 135], aAt: [X, AF], bAt: [X - 2, AF] });
const BSQ = P({ T: 65, Hd: 70, an: ["P", 100, 190], aAt: [X, AF], bAt: [X - 2, AF], aWt: [160, 218], bWt: [157, 218] });
const BPL = P({ T: 70, Hd: 76, an: ["P", 107, 180], aAt: [30, 212], bAt: [28, 212], aFT: "t", bFT: "t", aWt: [160, 218], bWt: [157, 218] });
const BJUMP = ST({ an: ["P", X, 112], aAt: [X + 2, 197], bAt: [X - 2, 197], aFT: 160, bFT: 160, aUA: 15, aFA: 10, bUA: 17, bFA: 12 });
E("Burpees", { v: "s", mode: "loop", t: 0.7, hold: 0.15, k: [BSTAND, BSQ, BPL, BSQ, BJUMP] });
E("Burpee sans saut", { v: "s", mode: "loop", t: 0.9, k: [BSTAND, BSQ, BPL, BSQ] });
E("Sprawl", { v: "s", mode: "loop", t: 0.7, hold: 0.15, k: [BSTAND, BSQ, P({ T: 80, Hd: 78, an: ["P", 105, 206], aAt: [25, 214], bAt: [23, 214], aFT: "t", bFT: "t", aWt: [157, 218], bWt: [154, 218] }), BSQ] });
const BEAR = (s) => P({ T: 82, Hd: 88, an: ["P", 125, 168], aWt: [s ? 178 : 160, 218], bWt: [s ? 160 : 178, 218], aAt: [s ? 72 : 92, 214], bAt: [s ? 92 : 72, 214], aFT: "t", bFT: "t" });
E("Marche de l'ours (bear crawl)", { v: "s", t: 0.8, k: [BEAR(1), BEAR(0)] });
E("Chenille (inchworm)", { v: "s", k: [ST({ an: ["P", 100, 135], aAt: [102, AF], bAt: [98, AF] }),
  P({ T: 155, Hd: 170, an: ["P", 98, 134], aAt: [102, AF], bAt: [98, AF], aWt: [132, 218], bWt: [130, 218] }),
  P({ T: 115, Hd: 120, an: ["P", 150, 160], aAt: [102, 213], bAt: [98, 213], aFT: "t", bFT: "t", aWt: [196, 218], bWt: [194, 218] }),
  P({ T: 72, Hd: 76, an: ["P", 182, 186], aAt: [102, 213], bAt: [98, 213], aFT: "t", bFT: "t", aWt: [226, 218], bWt: [224, 218] })] });
E("Jumping jacks", { v: "f", t: 0.45, hold: 0.05, k: [FS({ aAt: [X - 10, AF], bAt: [X + 10, AF] }), FS({ an: ["P", X, 128], aAt: [X - 36, 214], bAt: [X + 36, 214], aUA: 325, aFA: 330, bUA: 35, bFA: 30 })] });
E("Squat jacks", { v: "f", t: 0.55, hold: 0.05, k: [FS({ aAt: [X - 10, AF], bAt: [X + 10, AF], aWt: [123, 106], bWt: [137, 106] }), FS({ an: ["P", X, 172], aAt: [X - 40, AF], bAt: [X + 40, AF], aWt: [122, 142], bWt: [138, 142] })] });
E("Planche jacks", { v: "f", top: 1, t: 0.5, hold: 0.05, k: [TOPP({ an: ["P", X, 130], aUA: 180, aUAs: 0.2, aFA: 180, aFAs: 0.2, bUA: 180, bUAs: 0.2, bFA: 180, bFAs: 0.2 }),
  TOPP({ an: ["P", X, 130], aUA: 180, aUAs: 0.2, aFA: 180, aFAs: 0.2, bUA: 180, bUAs: 0.2, bFA: 180, bFAs: 0.2, aTH: 203, aSH: 203, bTH: 157, bSH: 157 })], pr: [MATP] });
const THR = [SQ({ T: 22, aUA: 150, aFA: 350, bUA: 152, bFA: 352 }), ST({ aUA: 4, aFA: 2, bUA: 6, bFA: 4 })];
E("Thruster haltères", { v: "s", k: THR, pr: [DB] });
E("Squat + développé à l'élastique", { v: "s", k: THR, pr: [{ t: "band", from: "aA", to: "aH" }] });
const LUN = P({ T: 0, an: ["P", 128, 178], aAt: [168, AF], bAt: [86, 214], bFT: "t" });
E("Fente avec rotation de buste", { v: "s", k: [ST({ an: ["P", 112, 135], aAt: [114, AF], bAt: [86, AF], aWt: [160, 108], bWt: [158, 108] }), P(LUN, { aWt: [168, 140], bWt: [166, 140] }), P(LUN, { T: -4, aWt: [150, 178, 1], bWt: [148, 178, 1] })], pr: [{ t: "db2", ang: 90 }] });
E("Marche du fermier (farmer walk)", { v: "s", k: [WALK(1, { aUA: 180, aFA: 180, bUA: 180, bFA: 180 }), WALK(-1, { aUA: 180, aFA: 180, bUA: 180, bFA: 180 })], pr: [{ t: "db", h: "ab", endon: 1 }] });
E("Épaulé haltère un bras", { v: "s", k: [P({ T: 55, Hd: 64, an: ["P", 105, 150], aAt: [X, AF], bAt: [X - 2, AF], aWt: [130, 190] }), ST({ aUA: 158, aFA: 342, bUA: 182, bFA: 182 })], pr: [DBA] });
E("Arraché haltère un bras", { v: "s", t: 0.8, k: [P({ T: 50, Hd: 60, an: ["P", 100, 170], aAt: [X, AF], bAt: [X - 2, AF], aWt: [134, 204] }), ST({ aUA: 3, aFA: 3, bUA: 182, bFA: 182 })], pr: [DBA] });
E("Man maker", { v: "s", mode: "loop", t: 0.9, k: [
  P({ T: 70, Hd: 76, an: ["P", 107, 180], aAt: [30, 212], bAt: [28, 212], aFT: "t", bFT: "t", aWt: [160, 212], bWt: [157, 212] }),
  P({ T: 70, Hd: 76, an: ["P", 107, 180], aAt: [30, 212], bAt: [28, 212], aFT: "t", bFT: "t", aUA: 292, aFA: 186, bWt: [157, 212] }),
  P({ T: 30, Hd: 20, an: ["P", 102, 176], aAt: [126, AF], bAt: [124, AF], aUA: 150, aFA: 350, bUA: 152, bFA: 352 }),
  ST({ an: ["P", 125, 135], aAt: [127, AF], bAt: [123, AF], aUA: 3, aFA: 3, bUA: 5, bFA: 5 })], pr: [DB] });
E("Relevé turc (Turkish get-up)", { v: "s", k: [
  SU({ aUA: 2, aFA: 2, bUA: 100, bFA: 100, aAt: [185, AF], bTH: 88, bSH: 88 }),
  SU({ T: 318, Hd: 330, aUA: 2, aFA: 2, bWt: [86, 218], aAt: [185, AF], bTH: 88, bSH: 88 }),
  P({ T: 0, an: ["P", 130, 172], aAt: [166, AF], bTH: 190, bSH: 270, bFT: 270, aUA: 2, aFA: 2, bUA: 180, bFA: 180 }),
  ST({ aUA: 2, aFA: 2 })], pr: [{ t: "kb", h: "a", mode: "up" }] });
E("Épaulé-jeté kettlebell", { v: "s", mode: "loop", t: 0.8, k: [
  P({ T: 60, Hd: 68, an: ["P", 104, 150], aAt: [X, AF], bAt: [X - 2, AF], aWt: [116, 180], bUA: 182, bFA: 182 }),
  ST({ aUA: 160, aFA: 340 }),
  P({ T: 5, an: ["P", 124, 152], aAt: [X, AF], bAt: [X - 2, AF], aUA: 160, aFA: 340 }),
  P({ T: 5, an: ["P", 124, 150], aAt: [X, AF], bAt: [X - 2, AF], aUA: 2, aFA: 2 }),
  ST({ aUA: 2, aFA: 2 })], pr: [{ t: "kb", h: "a", mode: "fa" }] });
E("Assis-debout de chaise", { v: "s", k: [P({ T: 12, Hd: 10, an: ["P", 98, 174], aAt: [140, AF], bAt: [138, AF], aUA: 165, aFA: 65, bUA: 167, bFA: 67 }),
  P({ T: 38, Hd: 30, an: ["P", 106, 170], aAt: [140, AF], bAt: [138, AF], aUA: 175, aFA: 80, bUA: 177, bFA: 82 }),
  ST({ an: ["P", 137, 135], aAt: [140, AF], bAt: [138, AF], aUA: 165, aFA: 65, bUA: 167, bFA: 67 })], pr: [{ t: "chair", x1: 70, x2: 112, y: 180, back: "l" }] });
const WP = (T) => P({ T, Hd: T + 2, an: ["aA", 75, AF], aTH: T + 180, aSH: T + 180, bTH: T + 180, bSH: T + 180, aFT: "t", bFT: "t", aWt: [195, 100], bWt: [193, 100] });
E("Pompes contre le mur", { v: "s", k: [WP(30), WP(40)], pr: [WALL(197, "r")] });
const TOE = (ax, bx, o) => P({ T: 0, an: ["P", X, 136], aAt: [ax, AF], bAt: [bx, AF], aUA: 160, aFA: 150, bUA: 200, bFA: 210 }, o);
E("Marche talon-pointe", { v: "s", mode: "loop", t: 1.1, k: [TOE(142, 124), TOE(142, 134, { bAt: [134, 206] }), TOE(124, 142), TOE(134, 142, { aAt: [134, 206] })] });
E("Curl-up de McGill", { v: "s", k: [SU({ bAt: [182, AF], aUA: 96, aFA: 96, bUA: 98, bFA: 98 }), SU({ T: 281, Hd: 281, bAt: [182, AF], aUA: 96, aFA: 96, bUA: 98, bFA: 98 })] });
E("Rétraction cervicale (chin tuck)", { v: "s", vb: [78, 30, 110, 101], k: [ST({ Hx: 4, Hd: 6 }), ST({ Hx: -3, Hd: 0 })] });
E("Glissements muraux (wall slides)", { v: "f", k: [FS({ aUA: 242, aFA: 338, bUA: 118, bFA: 22 }), FS({ aUA: 326, aFA: 338, bUA: 34, bFA: 22 })] });
E("Corde à sauter", { v: "f", t: 0.3, hold: 0.02, k: [FS({ an: ["P", X, 126], aAt: [X - 8, 209], bAt: [X + 8, 209], aUA: 196, aFA: 236, bUA: 164, bFA: 124, ry: 300 }), FS({ an: ["P", X, 134], aAt: [X - 8, AF], bAt: [X + 8, AF], aUA: 196, aFA: 236, bUA: 164, bFA: 124, ry: -40 })], pr: [{ t: "rope" }] });
window.Figures = { POSES, makeFigure, autoVB };
})();
