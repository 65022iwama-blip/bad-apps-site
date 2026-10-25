/*
 * app.js — 記録・階段のアニメーション・画面の切り替え
 *
 * 決まり：目標より少なかった分（分）だけ段を昇る。60段で1階。
 *         目標をこえた日は、こえた分の半分だけ段を落ちる（0段より下には落ちない）。
 * 記録はこの端末の中（localStorage）にだけ保存する。ログインはいらない。
 *
 * 確認用：URL に ?f=35 をつけると、記録と関係なく35階の景色を見られる。
 *         ?demo をつけると、地上から自動で昇り続ける（景色が変わる演出も出る）。
 */

const LS_KEY = "gaman-kaidan-v1";
const $ = id => document.getElementById(id);

/* ---------- 保存 ---------- */

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && s.records) return s;
  } catch (e) {}
  return { goal: null, records: {}, shownSteps: 0, maxZone: 0 };
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}
let state = load();

/* ---------- 計算 ---------- */

const pad = n => String(n).padStart(2, "0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = min => {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}時間${m}分` : `${h}時間`) : `${m}分`;
};

function stepsOf(records) {
  let steps = 0, saved = 0;
  for (const k of Object.keys(records).sort()) {
    const r = records[k], d = r.goal - r.min;
    if (d >= 0) { steps += d; saved += d; }
    else steps = Math.max(0, steps - Math.ceil(-d / 2));
  }
  return { steps, saved };
}

function streakOf(records) {
  const d = new Date();
  if (!records[dateKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  for (;;) {
    const r = records[dateKey(d)];
    if (!r || r.min > r.goal) return n;
    n++;
    d.setDate(d.getDate() - 1);
  }
}

/* ---------- 景色の表示とアニメーション ---------- */

const canvas = $("scene"), ctx = canvas.getContext("2d");
const params = new URLSearchParams(location.search);
const demo = params.has("demo");
const preview = demo ? 0 : parseFloat(params.get("f"));
const view = { p: isNaN(preview) ? state.shownSteps / FLOOR_STEPS : preview, anim: null };

function resize() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener("resize", resize);

function climb(fromSteps, toSteps, onDone) {
  const from = fromSteps / FLOOR_STEPS, to = toSteps / FLOOR_STEPS;
  const dur = Math.min(7000, Math.max(1400, Math.abs(to - from) * 1300));
  view.anim = { from, to, start: performance.now(), dur, onDone };
}

/* ---------- 演出（キラキラ・紙吹雪・フラッシュ） ---------- */

const fx = { parts: [], flash: 0 };
const CONFETTI = ["#ff5b7f", "#ffd25b", "#5bd6ff", "#8cff7a", "#c78bff", "#ffffff"];

function burst(n, colors, power, life, confetti) {
  const W = canvas.width, U = W / 400, hp = heroPos(W, canvas.height, view.p);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = power * U * (0.3 + Math.random() * 0.7);
    fx.parts.push({
      x: hp.x, y: hp.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * U * 0.5,
      age: 0, life: life * (0.6 + Math.random() * 0.4), c: colors[i % colors.length],
      s: (confetti ? 3 + Math.random() * 4 : 1.5 + Math.random() * 2) * U, rot: Math.random() * 6, confetti,
    });
  }
}

function drawFx(dt) {
  const U = canvas.width / 400;
  fx.parts = fx.parts.filter(q => (q.age += dt) < q.life);
  for (const q of fx.parts) {
    q.vy += (q.confetti ? 260 : 120) * U * dt;
    q.vx *= 0.985;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.rot += dt * 8;
    ctx.globalAlpha = Math.min(1, 2 * (1 - q.age / q.life));
    ctx.fillStyle = q.c;
    if (q.confetti) {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.fillRect(-q.s / 2, -q.s / 4, q.s, q.s * Math.abs(Math.cos(q.rot)) * 0.6 + 1);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fx.flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    fx.flash = Math.max(0, fx.flash - dt * 1.4);
  }
}

// 1階昇ったとき
function floorUp() {
  burst(16, ["#fff6c9", "#ffffff", "#ffd36b"], 120, 0.8, false);
}

// 新しい景色に着いたとき
function newZone(zi) {
  fx.flash = 0.95;
  burst(140, CONFETTI, 320, 2.6, true);
  setTimeout(() => burst(80, CONFETTI, 260, 2.2, true), 350);
  showBanner(ZONES[zi].name, `景色 ${zi + 1} / ${ZONES.length}`);
  try { navigator.vibrate && navigator.vibrate([60, 40, 120]); } catch (e) {}
}

let lastNow = performance.now(), lastFloor = Math.floor(view.p + 1e-6), lastZone = zoneIndex(view.p);
function frame(now) {
  const t = now / 1000, dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  let walking = false;
  if (demo) {
    view.p += dt * 0.9;
    if (view.p > ZONE_START[ZONE_START.length - 1] + 6) { view.p = 0; lastFloor = 0; lastZone = 0; }
    walking = true;
  }
  if (view.anim) {
    const a = view.anim, q = Math.min(1, (now - a.start) / a.dur);
    const e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
    view.p = a.from + (a.to - a.from) * e;
    walking = true;
    if (q >= 1) {
      view.anim = null;
      a.onDone && a.onDone();
    }
  }
  drawScene(ctx, canvas.width, canvas.height, view.p, t, { walking });

  const fl = Math.floor(view.p + 1e-6), zi = zoneIndex(view.p);
  if (walking && fl > lastFloor) floorUp();
  if (demo && zi > lastZone) newZone(zi);
  if (!demo && isNaN(preview) && zi > (state.maxZone || 0)) {
    state.maxZone = zi;
    save();
    newZone(zi);
  }
  lastFloor = fl;
  lastZone = zi;

  drawFx(dt);
  updateHud();
  requestAnimationFrame(frame);
}

let lastHud = "";
function updateHud() {
  const p = view.p, fl = Math.floor(p + 1e-6), zi = zoneIndex(p);
  const steps = Math.round(p * FLOOR_STEPS);
  const key = `${fl}|${zi}|${steps}`;
  if (key === lastHud) return;
  lastHud = key;
  $("floor-num").textContent = fl === 0 ? "地上" : fl;
  $("floor-unit").textContent = fl === 0 ? "" : "階";
  $("zone-name").textContent = ZONES[zi].name;
  const toFloor = (fl + 1) * FLOOR_STEPS - steps;
  const nextZone = zi < ZONES.length - 1
    ? ` ／ 次の景色まで あと${ZONE_START[zi + 1] - fl}階`
    : "";
  $("next-info").textContent = `次の階まで あと${fmt(toFloor)}${nextZone}`;
}

function refreshStats() {
  const { saved } = stepsOf(state.records);
  $("stat-saved").textContent = fmt(saved);
  $("stat-streak").textContent = `${streakOf(state.records)}日`;
  $("stat-goal").textContent = state.goal ? fmt(state.goal) : "-";
}

function showPop(text, down) {
  const el = $("pop");
  el.textContent = text;
  el.classList.toggle("down", !!down);
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}

function showBanner(name, count) {
  $("banner-name").textContent = name;
  $("banner-count").textContent = count;
  const b = $("banner");
  b.hidden = false;
  b.classList.remove("show");
  void b.offsetWidth;
  b.classList.add("show");
  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => (b.hidden = true), 4200);
}

// 記録が変わったあと：今の段数まで昇る（または落ちる）
function settle(animate) {
  const { steps } = stepsOf(state.records);
  const before = state.shownSteps;
  refreshStats();
  if (!isNaN(preview)) return;
  state.shownSteps = steps;
  save();
  if (!animate || steps === before) {
    view.p = steps / FLOOR_STEPS;
    state.maxZone = Math.max(state.maxZone || 0, zoneIndex(view.p));
    save();
    return;
  }
  const diff = steps - before;
  showPop(diff > 0 ? `+${diff}段` : `${diff}段`, diff < 0);
  climb(before, steps);
}

/* ---------- ダイアログ共通 ---------- */

document.querySelectorAll("[data-close]").forEach(b =>
  b.addEventListener("click", () => b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach(d =>
  d.addEventListener("click", e => { if (e.target === d && d.id !== "dlg-welcome") d.close(); }));

function goalOptions(sel, value) {
  sel.innerHTML = "";
  for (let m = 30; m <= 12 * 60; m += 30) {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = fmt(m);
    sel.appendChild(o);
  }
  sel.value = value;
}

/* ---------- はじめて ---------- */

if (!state.goal && isNaN(preview)) {
  goalOptions($("welcome-goal"), 240);
  $("dlg-welcome").showModal();
}
$("welcome-ok").addEventListener("click", () => {
  state.goal = +$("welcome-goal").value;
  save();
  refreshStats();
  $("dlg-welcome").close();
});

/* ---------- 記録 ---------- */

const rec = { min: null };

function openRecord() {
  $("rec-pick").hidden = false;
  $("rec-read").hidden = true;
  $("rec-form").hidden = true;
  $("rec-file").value = "";
  $("dlg-record").showModal();
}

function showForm(cands, msg) {
  $("rec-pick").hidden = true;
  $("rec-read").hidden = true;
  $("rec-form").hidden = false;
  $("rec-msg").textContent = msg || "";
  $("rec-date").value = dateKey(new Date());
  const box = $("rec-cands");
  box.innerHTML = "";
  cands.slice(0, 6).forEach((m, i) => {
    const b = document.createElement("button");
    b.className = "chip" + (i === 0 ? " on" : "");
    b.textContent = fmt(m);
    b.addEventListener("click", () => {
      box.querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
      b.classList.add("on");
      setTime(m);
    });
    box.appendChild(b);
  });
  setTime(cands.length ? cands[0] : null);
}

function setTime(min) {
  $("rec-h").value = min == null ? "" : Math.floor(min / 60);
  $("rec-m").value = min == null ? "" : min % 60;
  updateResult();
}

function readForm() {
  const h = $("rec-h").value, m = $("rec-m").value;
  if (h === "" && m === "") return null;
  const min = (+h || 0) * 60 + (+m || 0);
  return min >= 0 && min <= 24 * 60 ? min : null;
}

function updateResult() {
  const min = readForm(), el = $("rec-result"), ok = $("rec-ok");
  ok.disabled = min == null;
  if (min == null) { el.innerHTML = ""; return; }
  const day = $("rec-date").value, old = state.records[day];
  const goal = old ? old.goal : state.goal;
  const d = goal - min;
  const over = old ? `<small>この日の記録（${fmt(old.min)}）を書きかえます</small>` : "";
  el.className = "result " + (d >= 0 ? "up" : "down");
  el.innerHTML = d >= 0
    ? `目標 ${fmt(goal)} より <b>${fmt(d)}</b> 我慢！<br><b>+${d}段</b> 昇る${over}`
    : `目標を <b>${fmt(-d)}</b> オーバー…<br><b>${Math.ceil(-d / 2)}段</b> 落ちる${over}`;
}

$("btn-record").addEventListener("click", openRecord);
$("rec-manual").addEventListener("click", () => showForm([], ""));
["rec-h", "rec-m", "rec-date"].forEach(id => $(id).addEventListener("input", () => {
  $("rec-cands").querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
  updateResult();
}));

$("rec-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  $("rec-pick").hidden = true;
  $("rec-read").hidden = false;
  $("rec-thumb").src = URL.createObjectURL(file);
  const bar = $("ocr-bar"), status = $("ocr-status");
  bar.style.width = "0%";
  try {
    const cands = await readScreenTime(file, (q, msg) => {
      bar.style.width = `${Math.round(q * 100)}%`;
      status.textContent = msg;
    });
    showForm(cands, cands.length
      ? "読み取れた時間です。合計の時間をえらんでね（ちがったら直せます）"
      : "うまく読み取れませんでした。数字を入れてね");
  } catch (err) {
    showForm([], `読み取れませんでした（${err.message}）。数字を入れてね`);
  }
});

$("rec-ok").addEventListener("click", () => {
  const min = readForm(), day = $("rec-date").value;
  if (min == null || !day) return;
  const old = state.records[day];
  state.records[day] = { min, goal: old ? old.goal : state.goal };
  save();
  $("dlg-record").close();
  settle(true);
});

/* ---------- きろく ---------- */

const WD = "日月火水木金土";
function renderHistory() {
  const ul = $("history");
  ul.innerHTML = "";
  const keys = Object.keys(state.records).sort().reverse();
  if (!keys.length) {
    ul.innerHTML = `<li class="empty">まだ記録がありません</li>`;
    return;
  }
  for (const k of keys) {
    const r = state.records[k], d = r.goal - r.min, dt = new Date(k + "T00:00");
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="d">${dt.getMonth() + 1}/${dt.getDate()}（${WD[dt.getDay()]}）</span>
      <span class="t">${fmt(r.min)}</span>
      <span class="s ${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" + d : -Math.ceil(-d / 2)}段</span>
      <button class="del" aria-label="消す">×</button>`;
    const del = li.querySelector(".del");
    del.addEventListener("click", () => {
      if (!del.classList.contains("armed")) {     // 2回押しで消す
        del.classList.add("armed");
        del.textContent = "消す";
        setTimeout(() => { del.classList.remove("armed"); del.textContent = "×"; }, 2500);
        return;
      }
      delete state.records[k];
      save();
      settle(false);
      renderHistory();
    });
    ul.appendChild(li);
  }
}
$("btn-history").addEventListener("click", () => {
  renderHistory();
  $("dlg-history").showModal();
});

/* ---------- 景色図鑑 ---------- */

function renderBook() {
  const box = $("book"), reached = Math.max(state.maxZone || 0, zoneIndex(view.p));
  box.innerHTML = "";
  ZONES.forEach((Z, i) => {
    const card = document.createElement("div");
    card.className = "card" + (i > reached ? " locked" : "");
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 300;
    if (i <= reached) drawScene(c.getContext("2d"), 240, 300, ZONE_START[i] + ((ZONE_START[i + 1] || ZONE_START[i] + 10) - ZONE_START[i]) * 0.4, 1, { stairs: false });
    card.appendChild(c);
    const cap = document.createElement("div");
    cap.className = "cap";
    cap.innerHTML = i <= reached
      ? `<b>${Z.name}</b><small>${ZONE_START[i]}階〜</small>`
      : `<b>？？？</b><small>${ZONE_START[i]}階で見られる</small>`;
    card.appendChild(cap);
    box.appendChild(card);
  });
}
$("btn-book").addEventListener("click", () => {
  renderBook();
  $("dlg-book").showModal();
});

/* ---------- シェア ---------- */

let shareFile = null;

function shareText() {
  const fl = Math.floor(view.p + 1e-6), { saved } = stepsOf(state.records);
  return `スマホを我慢して ${fl === 0 ? "地上" : fl + "階"} まで昇った🪜\n` +
    `いまの景色：${ZONES[zoneIndex(view.p)].name}\n` +
    `我慢した時間 合計${fmt(saved)}\n#ガマン階段`;
}

function makeShareImage() {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d"), p = view.p, fl = Math.floor(p + 1e-6);
  drawScene(g, W, H, p, performance.now() / 1000, {});
  const sh = g.createLinearGradient(0, 0, 0, H * 0.32);
  sh.addColorStop(0, "rgba(0,0,0,.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H * 0.32);
  g.textAlign = "left";
  g.fillStyle = "#fff";
  g.shadowColor = "rgba(0,0,0,.5)";
  g.shadowBlur = 16;
  g.font = `800 44px "M PLUS Rounded 1c", sans-serif`;
  g.fillText("ガマン階段", 64, 100);
  g.font = `800 170px "M PLUS Rounded 1c", sans-serif`;
  const num = fl === 0 ? "地上" : String(fl);
  g.fillText(num, 56, 270);
  if (fl) {
    const nw = g.measureText(num).width;
    g.font = `800 64px "M PLUS Rounded 1c", sans-serif`;
    g.fillText("階", 56 + nw + 10, 270);
  }
  g.font = `800 50px "M PLUS Rounded 1c", sans-serif`;
  g.fillText(ZONES[zoneIndex(p)].name, 64, 345);
  const { saved } = stepsOf(state.records);
  g.textAlign = "right";
  g.font = `800 40px "M PLUS Rounded 1c", sans-serif`;
  g.fillText(`我慢した時間 合計${fmt(saved)}`, W - 56, H - 64);
  return new Promise(res => c.toBlob(res, "image/png"));
}

$("btn-share").addEventListener("click", async () => {
  const blob = await makeShareImage();
  shareFile = new File([blob], "gaman-kaidan.png", { type: "image/png" });
  $("share-img").src = URL.createObjectURL(blob);
  const canShare = navigator.canShare && navigator.canShare({ files: [shareFile] });
  $("share-go").textContent = canShare ? "画像をシェア" : "画像を保存";
  $("share-hint").textContent = canShare ? "" : "画像を長押しでも保存できます。";
  const url = location.origin + location.pathname;
  $("share-x").href = `https://x.com/intent/post?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(url)}`;
  $("dlg-share").showModal();
});

$("share-go").addEventListener("click", async () => {
  if (!shareFile) return;
  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try { await navigator.share({ files: [shareFile], text: shareText() }); } catch (e) {}
    return;
  }
  const a = document.createElement("a");
  a.href = $("share-img").src;
  a.download = "gaman-kaidan.png";
  a.click();
});

/* ---------- せってい ---------- */

$("btn-settings").addEventListener("click", () => {
  goalOptions($("set-goal"), state.goal || 240);
  $("dlg-settings").showModal();
});
$("set-goal").addEventListener("change", e => {
  state.goal = +e.target.value;
  save();
  refreshStats();
});
$("set-reset").addEventListener("click", e => {
  const b = e.currentTarget;
  if (!b.classList.contains("armed")) {           // 2回押しで消す
    b.classList.add("armed");
    b.textContent = "もう一度押すと消えます";
    setTimeout(() => { b.classList.remove("armed"); b.textContent = "記録をぜんぶ消す"; }, 3000);
    return;
  }
  state = { goal: state.goal, records: {}, shownSteps: 0, maxZone: 0 };
  save();
  settle(false);
  $("dlg-settings").close();
});

/* ---------- 起動 ---------- */

resize();
settle(false);
requestAnimationFrame(frame);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}
