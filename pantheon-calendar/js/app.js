/*
 * app.js — 画面を組み立てて動かす
 *
 * 流れ
 *  1. buildDial()  : 14区画の円盤を一度だけ作る
 *  2. update()     : 表示する日が変わるたびに、色・文字・月・回転を更新
 *  3. ドラッグ      : 指の角度の変化 → 盤を回す → 1区画越えたら日を送る
 */

/* ---------- 設定（ここをいじると触り心地が変わる） ---------- */
const DRAG_RESISTANCE = 0.55; // 小さいほど回りにくい（1で指と同じだけ回る）
const DETENT_STRENGTH = 4;    // 区画への吸い付きの強さ（1=なし、大きいほどカチッとする）

/* ---------- 盤の寸法（SVG座標 400x400） ---------- */
const CX = 200, CY = 200;          // 中心
const R_OUTER = 176, R_INNER = 112; // 区画の外周・内周
const R_EMBLEM = 144;               // 紋章を置く半径
const STEP = 360 / CYCLE_DAYS;      // 1区画の角度

/* ---------- 状態 ---------- */
let dayOffset = 0;   // 今日から何日ずらして見ているか
let rotation = 0;    // 盤の現在の回転角（度）

const $ = sel => document.querySelector(sel);
const WEEKDAYS = "日月火水木金土";
const formatDate = (d, isToday) =>
  `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${WEEKDAYS[d.getDay()]})` + (isToday ? " ・今日" : "");
const dateFromOffset = o => new Date(Date.now() + o * 864e5);

/* 極座標 → SVG座標。角度0が真上、時計回り */
function polar(r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/* ========== 1. 盤を作る ========== */
function buildDial() {
  const ring = $("#ring");
  GODS.forEach((god, i) => {
    const a0 = i * STEP, a1 = (i + 1) * STEP, mid = (a0 + a1) / 2;
    const [x0, y0] = polar(R_INNER, a0), [x1, y1] = polar(R_OUTER, a0);
    const [x2, y2] = polar(R_OUTER, a1), [x3, y3] = polar(R_INNER, a1);
    const [ex, ey] = polar(R_EMBLEM, mid);

    ring.insertAdjacentHTML("beforeend", `
      <path class="sector" d="M${x0} ${y0} L${x1} ${y1} A${R_OUTER} ${R_OUTER} 0 0 1 ${x2} ${y2}
        L${x3} ${y3} A${R_INNER} ${R_INNER} 0 0 0 ${x0} ${y0}Z" fill="${god.color}"/>
      <g class="emblem" style="transform-origin:${ex}px ${ey}px">
        <svg x="${ex - 12}" y="${ey - 12}" width="24" height="24" viewBox="0 0 64 64">${EMBLEMS[god.emblem]}</svg>
      </g>`);
  });
  $("#progress").innerHTML = GODS.map(g => `<i style="border-color:${g.color}"></i>`).join("");
}

/* ========== 2. 表示を更新 ========== */
function setRotation(deg, activeIndex) {
  $("#ring").style.transform = `rotate(${deg}deg)`;
  // 紋章は盤と逆に回して、常に正立させる。今日の神だけ大きく
  document.querySelectorAll(".emblem").forEach((el, i) => {
    el.style.transform = `rotate(${-deg}deg) scale(${i === activeIndex ? 1.6 : 1})`;
  });
}

/** 文字・色・月だけ更新（ドラッグ中にも呼ぶ） */
function showDay(offset) {
  const info = getCycleDay(dateFromOffset(offset));
  const god = GODS[info.index];

  document.documentElement.style.setProperty("--day", god.color);
  $("#date").textContent = formatDate(info.date, offset === 0);
  $("#name").textContent = god.name;
  $("#kana").textContent = `${god.kana}・${god.domain}`;
  $("#role").textContent = god.role;
  $("#extra").hidden = !info.isExtra;
  $("#symbols").innerHTML = god.symbols.map(s => `<span>${s}</span>`).join("");
  $("#myth").textContent = god.myth;
  $("#moon").innerHTML = moonSVG(info.moonPhase, 120, "#f3ead6", "#16213a");

  document.querySelectorAll(".sector").forEach((el, i) => {
    el.style.fillOpacity = i === info.index ? 0.55 : i < info.index ? 0.06 : 0.14;
  });
  document.querySelectorAll(".emblem").forEach((el, i) => {
    el.style.color = i === info.index ? "#fff7e6" : i < info.index ? "#4a5670" : GODS[i].color;
  });
  document.querySelectorAll("#progress i").forEach((el, i) => {
    el.style.background = i <= info.index ? GODS[i].color : "transparent";
  });
  return info;
}

/** 日を確定して、盤をその神が真上に来る角度まで回す */
function update() {
  const info = showDay(dayOffset);
  const target = -(info.index + 0.5) * STEP;
  // 一番近い回り方を選ぶ（14日目→1日目で逆回りに一周しないように）
  rotation = target + 360 * Math.round((rotation - target) / 360);
  setRotation(rotation, info.index);
}

/* ========== 3. ドラッグで回す ========== */
function setupDrag() {
  const dial = $("#dial"), ring = $("#ring");
  let drag = null;

  const angleOf = e => {
    const b = dial.getBoundingClientRect();
    return Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180 / Math.PI;
  };

  // 区画の位置に吸い付かせる：0〜1 の端数を、両端で平らなS字カーブに通す
  const detent = x => {
    const n = Math.floor(x), u = x - n;
    const k = DETENT_STRENGTH;
    return n + (u < 0.5 ? 0.5 * (2 * u) ** k : 1 - 0.5 * (2 * (1 - u)) ** k);
  };

  dial.addEventListener("pointerdown", e => {
    dial.setPointerCapture(e.pointerId);
    drag = { lastAngle: angleOf(e), total: 0, steps: 0, activeIndex: getCycleDay(dateFromOffset(dayOffset)).index };
    dial.classList.add("dragging");                       // CSSのアニメーションを止める
  });

  dial.addEventListener("pointermove", e => {
    if (!drag) return;
    const a = angleOf(e);
    drag.total += ((a - drag.lastAngle + 540) % 360) - 180; // -180〜180 に直して足す
    drag.lastAngle = a;

    const x = (drag.total * DRAG_RESISTANCE) / STEP;
    setRotation(rotation + detent(x) * STEP, drag.activeIndex);

    const steps = Math.round(x);
    if (steps !== drag.steps) {                             // 1区画越えた
      drag.steps = steps;
      drag.activeIndex = showDay(dayOffset - steps).index;  // 時計回り＝過去へ
      tick();
    }
  });

  const end = () => {
    if (!drag) return;
    rotation += drag.steps * STEP;
    dayOffset -= drag.steps;
    drag = null;
    dial.classList.remove("dragging");
    update();
  };
  dial.addEventListener("pointerup", end);
  dial.addEventListener("pointercancel", end);
}

/* ========== 起動 ========== */
buildDial();
setupDrag();
$("#prev").onclick  = () => { dayOffset--; update(); };
$("#next").onclick  = () => { dayOffset++; update(); };
$("#today").onclick = () => { dayOffset = 0; update(); };
update();

/* ========== アイコンのバッジ ==========
   ホーム画面のアイコン右上に「巡りの何日目か」を出す。
   iPhone（iOS 16.4〜）は通知を許可したときだけ出せるので、最初の1回はボタンで許可をもらう。
   数字が変わるのはアプリを開いたとき（閉じている間は前の数字のまま） */
function updateBadge() {
  if (!("setAppBadge" in navigator)) return;
  if ("Notification" in window && Notification.permission !== "granted") return;
  navigator.setAppBadge(getCycleDay(new Date()).dayNumber).catch(() => {});
}
(function setupBadgeButton() {
  const btn = $("#badge-btn");
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!standalone || !("setAppBadge" in navigator) || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  btn.hidden = false;
  btn.onclick = async () => {
    const result = await Notification.requestPermission();
    btn.hidden = true;
    if (result === "granted") updateBadge();
  };
})();
updateBadge();

/* ホーム画面のアプリは閉じても裏に残るので、開き直したら今日に戻す。
   開いたまま0時をまたいだときも今日を進める */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { dayOffset = 0; update(); updateBadge(); }
});
(function atMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(() => { update(); updateBadge(); atMidnight(); }, next - now + 1000);
})();
