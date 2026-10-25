/*
 * scenes.js — 景色と階段を canvas に描く
 *
 * 昇るほど次の景色までの間隔が長くなる（最初は1階、だんだん広がって140階で「光の門」）。
 * 「光の門」だけは140階から先ずっと続く。
 * 景色はすべてコードで描いているので、画像ファイルはいらない。
 * 同じ乱数の種（seed）を毎回使うので、ビルや木の並びはいつ見ても同じになる。
 */

const FLOOR_STEPS = 60;   // 60分我慢 = 1階

const ZONES = [
  { name: "夜の街",       sky: ["#141a38", "#343a6a", "#e79a86"], stair: "#dcd6ea", draw: drawCity },
  { name: "桜並木",       sky: ["#3b2a5a", "#c27ba0", "#ffd3c4"], stair: "#fff0f5", draw: drawSakura },
  { name: "深い森",       sky: ["#0c2320", "#24503f", "#9fd49a"], stair: "#ece2c6", draw: drawForest },
  { name: "夏祭りの花火", sky: ["#05071a", "#11163a", "#251d4a"], stair: "#ffe6c7", draw: drawFireworks },
  { name: "山の稜線",     sky: ["#22355e", "#6a8cc2", "#f6d6bb"], stair: "#f7f2ea", draw: drawMountains },
  { name: "紅葉の渓谷",   sky: ["#2b2140", "#c0705a", "#ffcf8a"], stair: "#fff1dc", draw: drawAutumn },
  { name: "雪の頂",       sky: ["#1a2a4a", "#5d7fb0", "#dce8f5"], stair: "#ffffff", draw: drawSnowPeak },
  { name: "雲の上",       sky: ["#2f63c8", "#7db0f0", "#fde6c4"], stair: "#ffffff", draw: drawClouds },
  { name: "虹の橋",       sky: ["#3f8de0", "#9fd0ff", "#fff1d6"], stair: "#ffffff", draw: drawRainbow },
  { name: "天空の島",     sky: ["#45388a", "#cf78ad", "#ffd59a"], stair: "#fff3e3", draw: drawIslands },
  { name: "天空の城",     sky: ["#2d2560", "#8a5fb0", "#ffc7a0"], stair: "#fff3e8", draw: drawCastle },
  { name: "雷の空",       sky: ["#0b0e1a", "#1d2336", "#2e3550"], stair: "#d9e0ff", draw: drawThunder },
  { name: "オーロラの空", sky: ["#04111e", "#0a2a3a", "#174752"], stair: "#d6fff0", draw: drawAurora },
  { name: "星の海",       sky: ["#04050d", "#0e1430", "#1f2552"], stair: "#e8e4ff", draw: drawStarSea },
  { name: "流星群",       sky: ["#05040f", "#16123a", "#2b1d55"], stair: "#ece6ff", draw: drawMeteors },
  { name: "青い惑星",     sky: ["#020308", "#090e22", "#131838"], stair: "#cfe2ff", draw: drawPlanet },
  { name: "月の表面",     sky: ["#000000", "#06060b", "#12121a"], stair: "#e6e6e6", draw: drawMoon },
  { name: "銀河の果て",   sky: ["#09000f", "#260a3c", "#561866"], stair: "#ffe6ff", draw: drawGalaxy },
  { name: "ブラックホール", sky: ["#000000", "#05030a", "#0d0716"], stair: "#ffd9b0", draw: drawBlackHole },
  { name: "光の門",       sky: ["#fff9e6", "#ffe6a6", "#ffc965"], stair: "#ffffff", draw: drawGate },
];

// 各景色が始まる階。間隔は 1,2,2,3,4,5,5,6,6,7,7,8,9,10,11,12,13,14,15 と少しずつ広がる
const ZONE_START = [0, 1, 3, 5, 8, 12, 17, 22, 28, 34, 41, 48, 56, 65, 75, 86, 98, 111, 125, 140];

function zoneIndex(p) {
  let i = 0;
  while (i < ZONES.length - 1 && p >= ZONE_START[i + 1]) i++;
  return i;
}

/* ---------- 道具 ---------- */

function rng(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fill();
}

function sky(ctx, w, h, c) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c[0]);
  g.addColorStop(0.55, c[1]);
  g.addColorStop(1, c[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function stars(ctx, w, h, t, n, seed, maxY = 1, shift = 0) {
  const U = w / 400, r = rng(seed);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h * maxY + shift, s = (r() * 1.5 + 0.4) * U, ph = r() * 6.28;
    ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 1.4 + ph);
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function puff(ctx, x, y, s) {
  circle(ctx, x, y, s);
  circle(ctx, x + s * 0.9, y + s * 0.15, s * 0.75);
  circle(ctx, x - s * 0.9, y + s * 0.2, s * 0.7);
  circle(ctx, x + s * 0.3, y - s * 0.45, s * 0.7);
}

// "#rrggbb" を明るく(+)/暗く(-)する
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ---------- 景色 ---------- */
// par は「その景色の中をどこまで昇ったか」(0〜1)。昇るほど地面が下に沈んでいく。

function drawCity(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  stars(ctx, w, h, t, 40, 11, 0.45);
  glow(ctx, w * 0.78, h * 0.14, 60 * U, "rgba(255,240,200,.35)");
  ctx.fillStyle = "#fff4d6";
  circle(ctx, w * 0.78, h * 0.14, 16 * U);
  const layers = [
    { c: "#2b3060", hh: 0.34, bw: [30, 60], seed: 1, f: 0.45 },
    { c: "#1e2248", hh: 0.25, bw: [24, 50], seed: 2, f: 0.7 },
    { c: "#121530", hh: 0.18, bw: [20, 44], seed: 3, f: 1 },
  ];
  for (const L of layers) {
    const r = rng(L.seed), base = h + sink * L.f;
    let x = -10 * U;
    while (x < w) {
      const bw = (L.bw[0] + r() * (L.bw[1] - L.bw[0])) * U;
      const bh = h * L.hh * (0.4 + r() * 0.9);
      ctx.fillStyle = L.c;
      ctx.fillRect(x, base - bh, bw - 2 * U, bh);
      ctx.fillStyle = "#ffd98a";
      for (let wy = base - bh + 6 * U; wy < base - 4 * U; wy += 9 * U) {
        for (let wx = x + 4 * U; wx < x + bw - 8 * U; wx += 8 * U) {
          const on = r();
          if (on > 0.72) {
            ctx.globalAlpha = on > 0.97 ? 0.5 + 0.5 * Math.sin(t * 3 + wx) : 0.8;
            ctx.fillRect(wx, wy, 3 * U, 4 * U);
          }
        }
      }
      ctx.globalAlpha = 1;
      x += bw;
    }
  }
}

function drawForest(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  stars(ctx, w, h, t, 25, 21, 0.3);
  const layers = [
    { c: "#1f4a3c", y: 0.58, hgt: 70, seed: 4, f: 0.4 },
    { c: "#163a2f", y: 0.72, hgt: 90, seed: 5, f: 0.7 },
    { c: "#0c2620", y: 0.88, hgt: 110, seed: 6, f: 1 },
  ];
  for (const L of layers) {
    const r = rng(L.seed), base = h * L.y + sink * L.f;
    ctx.fillStyle = L.c;
    ctx.fillRect(0, base - 2, w, h - base + 2 + sink);
    for (let x = -10 * U; x < w + 20 * U; x += (12 + r() * 14) * U) {
      const hg = L.hgt * U * (0.6 + r() * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, base - hg);
      ctx.lineTo(x - hg * 0.26, base);
      ctx.lineTo(x + hg * 0.26, base);
      ctx.fill();
    }
  }
  // ホタル
  const r = rng(7);
  for (let i = 0; i < 28; i++) {
    const ph = r() * 6.28;
    const x = r() * w + Math.sin(t * 0.4 + ph) * 18 * U;
    const y = h * 0.45 + r() * h * 0.55 + Math.cos(t * 0.5 + ph) * 12 * U;
    const a = 0.5 + 0.5 * Math.sin(t * 2 + ph * 3);
    glow(ctx, x, y, 9 * U, "rgba(230,255,140,.8)", a);
  }
}

function drawMountains(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  glow(ctx, w * 0.3, h * 0.55, 140 * U, "rgba(255,210,160,.6)");
  ctx.fillStyle = "#ffe7c8";
  circle(ctx, w * 0.3, h * 0.55 + sink * 0.2, 22 * U);
  const layers = [
    { c: "#7b8fbf", y: 0.62, hgt: 0.32, seed: 8, f: 0.35, snow: true },
    { c: "#566c9e", y: 0.76, hgt: 0.26, seed: 9, f: 0.65, snow: true },
    { c: "#33466f", y: 0.92, hgt: 0.2, seed: 10, f: 1, snow: false },
  ];
  for (const L of layers) {
    const r = rng(L.seed), base = h * L.y + sink * L.f;
    ctx.fillStyle = L.c;
    ctx.fillRect(0, base - 1, w, h - base + 1 + sink);
    for (let x = -40 * U; x < w + 40 * U; x += (50 + r() * 50) * U) {
      const ph = h * L.hgt * (0.5 + r() * 0.6), hw = ph * (0.9 + r() * 0.5);
      ctx.fillStyle = L.c;
      ctx.beginPath();
      ctx.moveTo(x, base - ph);
      ctx.lineTo(x - hw, base);
      ctx.lineTo(x + hw, base);
      ctx.fill();
      if (L.snow) {
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.beginPath();
        ctx.moveTo(x, base - ph);
        ctx.lineTo(x - hw * 0.22, base - ph * 0.78);
        ctx.lineTo(x - hw * 0.07, base - ph * 0.82);
        ctx.lineTo(x + hw * 0.06, base - ph * 0.75);
        ctx.lineTo(x + hw * 0.22, base - ph * 0.78);
        ctx.fill();
      }
    }
  }
}

function drawClouds(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  glow(ctx, w * 0.75, h * 0.2, 150 * U, "rgba(255,250,220,.7)");
  ctx.fillStyle = "#fffbe8";
  circle(ctx, w * 0.75, h * 0.2, 24 * U);
  // 流れる雲
  let r = rng(12);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  for (let i = 0; i < 6; i++) {
    const sp = 4 + r() * 8, y = h * (0.1 + r() * 0.4);
    const x = ((r() * w + t * sp * U) % (w + 120 * U)) - 60 * U;
    puff(ctx, x, y, (10 + r() * 10) * U);
  }
  // 雲の海
  r = rng(13);
  const rows = [
    { y: 0.7, c: "#e6eefc", f: 0.5 },
    { y: 0.8, c: "#f4f7ff", f: 0.75 },
    { y: 0.92, c: "#ffffff", f: 1 },
  ];
  for (const R of rows) {
    const base = h * R.y + sink * R.f;
    ctx.fillStyle = R.c;
    ctx.fillRect(0, base, w, h - base + sink);
    for (let x = -20 * U; x < w + 30 * U; x += (22 + r() * 18) * U) {
      circle(ctx, x + Math.sin(t * 0.3 + x) * 3 * U, base, (18 + r() * 16) * U);
    }
  }
}

function drawIslands(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  glow(ctx, w * 0.5, h * 0.75, 220 * U, "rgba(255,220,160,.55)");
  const r = rng(14);
  for (let i = 0; i < 6; i++) {
    const f = 0.3 + r() * 0.7, s = (16 + r() * 30) * U * f;
    const x = r() * w, ph = r() * 6.28;
    const y = h * (0.2 + r() * 0.7) + sink * f + Math.sin(t * 0.8 + ph) * 4 * U;
    ctx.fillStyle = "#7a5a6e";
    ctx.beginPath();
    ctx.moveTo(x - s * 1.6, y);
    ctx.lineTo(x + s * 1.6, y);
    ctx.lineTo(x + s * 0.3, y + s * 2.2);
    ctx.lineTo(x - s * 0.2, y + s * 1.6);
    ctx.fill();
    ctx.fillStyle = "#8fd18c";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.65, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // 小さな滝
    ctx.fillStyle = "rgba(220,240,255,.6)";
    ctx.fillRect(x + s * 0.8, y, 2 * U, s * 2.5);
  }
  // 鳥
  ctx.strokeStyle = "rgba(60,40,80,.7)";
  ctx.lineWidth = 1.5 * U;
  for (let i = 0; i < 5; i++) {
    const x = ((r() * w + t * 14 * U) % (w + 40 * U)) - 20 * U, y = h * (0.1 + r() * 0.25);
    const flap = Math.sin(t * 6 + i) * 3 * U;
    ctx.beginPath();
    ctx.moveTo(x - 6 * U, y - flap);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 6 * U, y - flap);
    ctx.stroke();
  }
}

function drawAurora(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  stars(ctx, w, h, t, 90, 15, 0.7);
  const bands = [
    { y: 0.18, c: "120,255,190" },
    { y: 0.3, c: "90,220,255" },
    { y: 0.42, c: "200,120,255" },
  ];
  bands.forEach((B, i) => {
    const by = h * B.y, len = h * 0.2;
    const g = ctx.createLinearGradient(0, by - 30 * U, 0, by + len);
    g.addColorStop(0, `rgba(${B.c},0)`);
    g.addColorStop(0.25, `rgba(${B.c},.45)`);
    g.addColorStop(1, `rgba(${B.c},0)`);
    ctx.fillStyle = g;
    for (let x = 0; x < w; x += 3 * U) {
      const y = by + Math.sin(x / (60 * U) + t * 0.5 + i * 2) * 22 * U + Math.sin(x / (23 * U) - t * 0.8) * 6 * U;
      ctx.fillRect(x, y, 3.2 * U, by + len - y);
    }
  });
  // 雪原と針葉樹
  const base = h * 0.86 + sink;
  ctx.fillStyle = "#cfe6ef";
  ctx.fillRect(0, base, w, h - base + sink);
  const r = rng(16);
  ctx.fillStyle = "#0b1c22";
  for (let x = 0; x < w; x += (14 + r() * 30) * U) {
    const hg = (30 + r() * 40) * U;
    ctx.beginPath();
    ctx.moveTo(x, base - hg);
    ctx.lineTo(x - hg * 0.22, base + 2);
    ctx.lineTo(x + hg * 0.22, base + 2);
    ctx.fill();
  }
}

function drawStarSea(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.12;
  // 天の川
  const r = rng(17);
  ctx.fillStyle = "#cdd6ff";
  for (let i = 0; i < 260; i++) {
    const a = r(), off = (r() - 0.5) * (r() * 90) * U;
    ctx.globalAlpha = 0.15 + r() * 0.35;
    ctx.fillRect(a * w + off * 0.5, h * 0.05 + a * h * 0.6 + off, 1.2 * U, 1.2 * U);
  }
  ctx.globalAlpha = 1;
  stars(ctx, w, h, t, 140, 18, 1);
  // 流れ星（6秒に1回）
  const k = (t % 6) / 6;
  if (k < 0.15) {
    const q = k / 0.15, sx = w * (0.85 - q * 0.5), sy = h * (0.08 + q * 0.2);
    const g = ctx.createLinearGradient(sx, sy, sx + 60 * U, sy - 24 * U);
    g.addColorStop(0, "rgba(255,255,255,.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 2 * U;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 60 * U, sy - 24 * U);
    ctx.stroke();
  }
  // 足もとに地球のふち
  const cx = w * 0.5, cy = h * 1.75 + sink, R = h * 1.05;
  glow(ctx, cx, cy, R * 1.12, "rgba(90,170,255,.9)", 0.6);
  const g = ctx.createRadialGradient(cx, cy - R * 0.6, R * 0.2, cx, cy, R);
  g.addColorStop(0, "#3a7bd5");
  g.addColorStop(1, "#0c2a5c");
  ctx.fillStyle = g;
  circle(ctx, cx, cy, R);
}

function drawPlanet(ctx, w, h, t, par) {
  const U = w / 400;
  stars(ctx, w, h, t, 160, 19, 1);
  const px = w * 0.68, py = h * 0.32 + par * h * 0.25, R = 70 * U;
  glow(ctx, px, py, R * 1.8, "rgba(110,170,255,.5)");
  const ring = (front) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.strokeStyle = "rgba(230,215,180,.8)";
    ctx.lineWidth = 7 * U;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 1.75, R * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  ring(false);
  const g = ctx.createRadialGradient(px - R * 0.4, py - R * 0.4, R * 0.1, px, py, R);
  g.addColorStop(0, "#9fd0ff");
  g.addColorStop(0.6, "#3c6fc4");
  g.addColorStop(1, "#13244f");
  ctx.fillStyle = g;
  circle(ctx, px, py, R);
  ring(true);
  // 小さな衛星
  const a = t * 0.3;
  ctx.fillStyle = "#d9d2c7";
  circle(ctx, px + Math.cos(a) * R * 2.3, py + Math.sin(a) * R * 0.6, 6 * U);
}

function drawMoon(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.12;
  stars(ctx, w, h, t, 150, 20, 0.8);
  // 遠くの地球
  const ex = w * 0.24, ey = h * 0.17;
  glow(ctx, ex, ey, 50 * U, "rgba(120,180,255,.6)");
  ctx.fillStyle = "#3a7bd5";
  circle(ctx, ex, ey, 22 * U);
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.fillRect(ex - 14 * U, ey - 6 * U, 18 * U, 3 * U);
  ctx.fillRect(ex - 6 * U, ey + 6 * U, 16 * U, 3 * U);
  ctx.fillStyle = "#58a35a";
  circle(ctx, ex + 6 * U, ey - 2 * U, 6 * U);
  // 月の地面
  const base = h * 0.64 + sink;
  ctx.fillStyle = "#8e8e96";
  ctx.beginPath();
  ctx.moveTo(0, h + sink);
  for (let x = 0; x <= w; x += 10 * U) ctx.lineTo(x, base + Math.sin(x / (70 * U)) * 12 * U);
  ctx.lineTo(w, h + sink);
  ctx.fill();
  const r = rng(22);
  for (let i = 0; i < 14; i++) {
    const x = r() * w, y = base + 18 * U + r() * (h - base + sink), s = (5 + r() * 18) * U;
    ctx.fillStyle = "#6f6f77";
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a3a3ab";
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.08, s * 0.8, s * 0.22, 0, 0, Math.PI);
    ctx.fill();
  }
}

function drawGalaxy(ctx, w, h, t, par) {
  const U = w / 400;
  stars(ctx, w, h, t, 120, 23, 1);
  const cx = w * 0.5, cy = h * 0.34 + par * h * 0.2;
  glow(ctx, cx, cy, 170 * U, "rgba(255,140,220,.45)");
  glow(ctx, cx, cy, 50 * U, "rgba(255,240,255,.9)");
  const r = rng(24);
  for (let i = 0; i < 700; i++) {
    const arm = i % 2, d = r(), spread = (r() - 0.5) * 0.5;
    const ang = arm * Math.PI + d * 6.5 + spread + t * 0.05;
    const rad = d * 150 * U;
    const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.45;
    ctx.globalAlpha = 0.3 + (1 - d) * 0.6;
    ctx.fillStyle = r() > 0.5 ? "#ffc6f0" : "#b9c8ff";
    ctx.fillRect(x, y, 1.6 * U, 1.6 * U);
  }
  ctx.globalAlpha = 1;
}

function drawGate(ctx, w, h, t, par) {
  const U = w / 400, cx = w * 0.5, cy = h * 0.3;
  // 回る光の筋
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.05);
  ctx.fillStyle = "rgba(255,255,255,.35)";
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 1.2, -18 * U);
    ctx.lineTo(w * 1.2, 18 * U);
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, cx, cy, 160 * U, "rgba(255,255,255,1)");
  // 門
  const gw = 120 * U, gh = 150 * U, top = cy - gh * 0.45;
  ctx.strokeStyle = "#e9b949";
  ctx.lineWidth = 9 * U;
  ctx.beginPath();
  ctx.moveTo(cx - gw / 2, top + gh);
  ctx.lineTo(cx - gw / 2, top + gw / 2);
  ctx.arc(cx, top + gw / 2, gw / 2, Math.PI, 0);
  ctx.lineTo(cx + gw / 2, top + gh);
  ctx.stroke();
  // のぼる光の粒
  const r = rng(25);
  for (let i = 0; i < 40; i++) {
    const x = r() * w, sp = 10 + r() * 20, y = h - ((r() * h + t * sp * U) % h);
    glow(ctx, x, y, 6 * U, "rgba(255,230,150,1)", 0.8);
  }
}

function petals(ctx, w, h, t, n, seed, colors, U) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sp = 14 + r() * 22, ph = r() * 6.28, sz = (2.5 + r() * 3) * U;
    const x = (r() * w + Math.sin(t * 0.9 + ph) * 26 * U + t * 12 * U) % (w + 20 * U) - 10 * U;
    const y = (r() * h + t * sp * U) % (h + 20 * U) - 10 * U;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 2 + ph);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.ellipse(0, 0, sz, sz * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSakura(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  glow(ctx, w * 0.7, h * 0.3, 160 * U, "rgba(255,220,230,.6)");
  const layers = [
    { y: 0.7, c: "#e9a7c0", trunk: "#5a3a48", seed: 31, f: 0.5, s: 0.8 },
    { y: 0.86, c: "#f7c3d6", trunk: "#3e2632", seed: 32, f: 1, s: 1.15 },
  ];
  for (const L of layers) {
    const r = rng(L.seed), base = h * L.y + sink * L.f;
    ctx.fillStyle = "#6f9b6a";
    ctx.fillRect(0, base, w, h - base + sink);
    for (let x = -10 * U; x < w + 30 * U; x += (40 + r() * 30) * U * L.s) {
      const th = (40 + r() * 30) * U * L.s;
      ctx.strokeStyle = L.trunk;
      ctx.lineWidth = 5 * U * L.s;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x + 3 * U, base - th);
      ctx.stroke();
      ctx.fillStyle = L.c;
      for (let k = 0; k < 6; k++) {
        circle(ctx, x + (r() - 0.5) * 50 * U * L.s, base - th - (r() - 0.3) * 26 * U * L.s, (14 + r() * 12) * U * L.s);
      }
    }
  }
  petals(ctx, w, h, t, 70, 33, ["#ffd1e0", "#ffb3cb", "#fff0f5"], U);
}

function drawFireworks(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  stars(ctx, w, h, t, 50, 34, 0.6);
  const cols = ["255,90,120", "255,210,90", "120,220,255", "170,255,140", "220,140,255", "255,160,80"];
  const P = 3.4;
  for (let s = 0; s < 6; s++) {
    const off = s * 0.57, cyc = Math.floor((t + off) / P), q = ((t + off) % P) / P;
    const r = rng(1000 + s * 97 + cyc * 13);
    const bx = w * (0.15 + r() * 0.7), by = h * (0.12 + r() * 0.3), R = (60 + r() * 60) * U;
    const col = cols[Math.floor(r() * cols.length)];
    if (q < 0.22) {
      const k = q / 0.22, y = h - (h - by) * (1 - (1 - k) * (1 - k));
      glow(ctx, bx, y, 8 * U, `rgba(${col},1)`);
    } else {
      const k = (q - 0.22) / 0.78, e = 1 - Math.pow(1 - k, 3), a = Math.max(0, 1 - k * 1.1);
      if (k < 0.08) {               // はじけた瞬間に空が少し明るくなる
        ctx.fillStyle = `rgba(${col},${0.18 * (1 - k / 0.08)})`;
        ctx.fillRect(0, 0, w, h);
      }
      glow(ctx, bx, by + e * 10 * U, R * 0.9, `rgba(${col},.35)`, a);
      ctx.fillStyle = `rgba(${col},${a})`;
      for (let i = 0; i < 48; i++) {
        const ang = (i / 48) * Math.PI * 2, rr = R * e * (0.85 + (i % 3) * 0.08);
        const x = bx + Math.cos(ang) * rr, y = by + Math.sin(ang) * rr + e * e * 26 * U;
        circle(ctx, x, y, 2.2 * U);
      }
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + 0.1, rr = R * e * 0.5;
        circle(ctx, bx + Math.cos(ang) * rr, by + Math.sin(ang) * rr + e * e * 18 * U, 1.6 * U);
      }
    }
  }
  // 丘とちょうちん
  const base = h * 0.84 + sink;
  ctx.fillStyle = "#0b0c1c";
  ctx.beginPath();
  ctx.moveTo(0, h + sink);
  for (let x = 0; x <= w; x += 10 * U) ctx.lineTo(x, base + Math.sin(x / (90 * U)) * 16 * U);
  ctx.lineTo(w, h + sink);
  ctx.fill();
  for (let x = 12 * U; x < w; x += 22 * U) {
    const y = base - 10 * U + Math.sin(x / (90 * U)) * 16 * U;
    glow(ctx, x, y, 10 * U, "rgba(255,150,80,.8)", 0.7 + 0.3 * Math.sin(t * 3 + x));
    ctx.fillStyle = "#ff8a4a";
    circle(ctx, x, y, 3 * U);
  }
}

function drawAutumn(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  glow(ctx, w * 0.5, h * 0.42, 180 * U, "rgba(255,190,120,.6)");
  const r = rng(35);
  const leaves = ["#e8452c", "#f28a2e", "#f6c13a", "#c9302c"];
  // 左右のがけと木
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 0 : w;
    ctx.fillStyle = "#4a2a2a";
    ctx.beginPath();
    ctx.moveTo(edge, h * 0.3 + sink * 0.5);
    ctx.lineTo(w * 0.5 + side * w * 0.12, h + sink);
    ctx.lineTo(edge, h + sink);
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const k = r(), x = edge - side * k * w * 0.42, y = h * 0.3 + k * h * 0.6 + sink * (0.5 + k * 0.5) + (r() - 0.5) * 30 * U;
      ctx.fillStyle = leaves[i % 4];
      circle(ctx, x, y, (12 + r() * 14) * U);
    }
  }
  // 川
  ctx.fillStyle = "rgba(140,200,255,.55)";
  ctx.beginPath();
  ctx.moveTo(w * 0.47, h * 0.75 + sink);
  ctx.lineTo(w * 0.53, h * 0.75 + sink);
  ctx.lineTo(w * 0.62, h + sink);
  ctx.lineTo(w * 0.38, h + sink);
  ctx.fill();
  petals(ctx, w, h, t, 45, 36, leaves, U);
}

function drawSnowPeak(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  glow(ctx, w * 0.5, h * 0.2, 160 * U, "rgba(255,255,255,.5)");
  const cx = w * 0.5, top = h * 0.3 + sink * 0.6, base = h + sink;
  ctx.fillStyle = "#8ea6c8";
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx - w * 0.75, base);
  ctx.lineTo(cx + w * 0.75, base);
  ctx.fill();
  ctx.fillStyle = "#f4f8ff";
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx - w * 0.75, base);
  ctx.lineTo(cx + w * 0.05, base);
  ctx.fill();
  // 頂上の旗
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2 * U;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, top - 28 * U);
  ctx.stroke();
  ctx.fillStyle = "#ff5a5a";
  ctx.beginPath();
  ctx.moveTo(cx, top - 28 * U);
  ctx.quadraticCurveTo(cx + 10 * U, top - 26 * U + Math.sin(t * 5) * 3 * U, cx + 20 * U, top - 22 * U);
  ctx.lineTo(cx, top - 16 * U);
  ctx.fill();
  // 雪
  const r = rng(37);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 140; i++) {
    const sp = 20 + r() * 40, s = (1 + r() * 2.2) * U;
    const x = (r() * w + t * 30 * U + Math.sin(t + i) * 8 * U) % w;
    const y = (r() * h + t * sp * U) % h;
    ctx.globalAlpha = 0.6 + r() * 0.4;
    circle(ctx, x, y, s);
  }
  ctx.globalAlpha = 1;
}

function drawRainbow(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  const cols = ["#ff5b5b", "#ff9f43", "#ffe066", "#6be37a", "#4fc3ff", "#5a6bff", "#b46bff"];
  const cx = w * 0.5, cy = h * 0.95 + sink * 0.5, R = w * 0.75, bw = 9 * U;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = bw;
  cols.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(cx, cy, R - i * bw, Math.PI, 0);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // きらきら
  const r = rng(38);
  for (let i = 0; i < 30; i++) {
    const x = r() * w, y = r() * h * 0.8, a = Math.max(0, Math.sin(t * 2 + r() * 6.28));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const s = (2 + r() * 4) * U * a;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - s * 2, y); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x + s * 2, y); ctx.lineTo(x, y - s * 0.5);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  for (let x = -20 * U; x < w + 30 * U; x += 34 * U) puff(ctx, x, h * 0.9 + sink, (18 + Math.sin(x) * 6) * U);
}

function drawCastle(ctx, w, h, t, par) {
  const U = w / 400, sink = par * h * 0.3;
  glow(ctx, w * 0.5, h * 0.35, 200 * U, "rgba(255,210,170,.55)");
  const cx = w * 0.5, cy = h * 0.42 + sink * 0.6 + Math.sin(t * 0.7) * 5 * U;
  // 浮いている岩
  ctx.fillStyle = "#5b4a6e";
  ctx.beginPath();
  ctx.moveTo(cx - 120 * U, cy);
  ctx.lineTo(cx + 120 * U, cy);
  ctx.lineTo(cx + 30 * U, cy + 110 * U);
  ctx.lineTo(cx - 10 * U, cy + 150 * U);
  ctx.lineTo(cx - 50 * U, cy + 90 * U);
  ctx.fill();
  ctx.fillStyle = "#7fc98a";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 122 * U, 14 * U, 0, 0, Math.PI * 2);
  ctx.fill();
  // 城
  const towers = [[-70, 60, 22], [-30, 95, 26], [10, 130, 30], [52, 85, 24], [88, 55, 20]];
  for (const [dx, th, tw] of towers) {
    const x = cx + dx * U, top = cy - th * U, wdt = tw * U;
    ctx.fillStyle = "#f2e6ff";
    ctx.fillRect(x - wdt / 2, top, wdt, th * U);
    ctx.fillStyle = "#6a4bc2";
    ctx.beginPath();
    ctx.moveTo(x - wdt / 2 - 3 * U, top);
    ctx.lineTo(x, top - wdt * 1.3);
    ctx.lineTo(x + wdt / 2 + 3 * U, top);
    ctx.fill();
    ctx.fillStyle = "#ffd36b";
    for (let y = top + 10 * U; y < cy - 10 * U; y += 18 * U) ctx.fillRect(x - 2.5 * U, y, 5 * U, 8 * U);
    ctx.fillStyle = "#ff6b8a";
    ctx.beginPath();
    ctx.moveTo(x, top - wdt * 1.3);
    ctx.lineTo(x + 14 * U, top - wdt * 1.3 + 4 * U + Math.sin(t * 5 + dx) * 2 * U);
    ctx.lineTo(x, top - wdt * 1.3 + 8 * U);
    ctx.fill();
  }
  // 下の雲
  ctx.fillStyle = "rgba(255,240,250,.85)";
  for (let x = -20 * U; x < w + 30 * U; x += 36 * U) puff(ctx, x + Math.sin(t * 0.3 + x) * 6 * U, h * 0.93 + sink, 20 * U);
}

function drawThunder(ctx, w, h, t, par) {
  const U = w / 400;
  const P = 2.8, cyc = Math.floor(t / P), q = (t % P) / P;
  const r = rng(500 + cyc);
  // 稲妻
  if (q < 0.12) {
    const a = q < 0.04 || (q > 0.07 && q < 0.1) ? 1 : 0.3;
    ctx.fillStyle = `rgba(200,210,255,${0.35 * a})`;
    ctx.fillRect(0, 0, w, h);
    let x = w * (0.2 + r() * 0.6), y = h * 0.18;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.shadowColor = "#9fb4ff";
    ctx.shadowBlur = 18 * U;
    ctx.lineWidth = 3 * U;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < h * 0.85) {
      x += (r() - 0.5) * 50 * U;
      y += (20 + r() * 30) * U;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // 雷雲
  const cr = rng(39);
  for (let i = 0; i < 18; i++) {
    const x = cr() * w, y = h * (0.02 + cr() * 0.2), s = (26 + cr() * 30) * U;
    ctx.fillStyle = i % 2 ? "#2a3048" : "#353c58";
    puff(ctx, x + Math.sin(t * 0.2 + i) * 10 * U, y, s);
  }
  // 雨
  ctx.strokeStyle = "rgba(170,190,255,.35)";
  ctx.lineWidth = 1.2 * U;
  ctx.beginPath();
  const rr = rng(40);
  for (let i = 0; i < 120; i++) {
    const x = (rr() * w + t * 60 * U) % w, y = (rr() * h + t * 500 * U * (0.8 + rr() * 0.4)) % h;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5 * U, y + 16 * U);
  }
  ctx.stroke();
}

function drawMeteors(ctx, w, h, t, par) {
  const U = w / 400;
  stars(ctx, w, h, t, 180, 41, 1);
  for (let i = 0; i < 12; i++) {
    const P = 1.6 + (i % 4) * 0.5, off = i * 0.37, cyc = Math.floor((t + off) / P), q = ((t + off) % P) / P;
    const r = rng(700 + i * 31 + cyc);
    if (q > 0.5) continue;
    const k = q / 0.5, len = (60 + r() * 80) * U;
    const sx = w * (0.3 + r() * 0.9) - k * w * 0.5, sy = h * (r() * 0.5) + k * h * 0.25;
    const ex = sx + len, ey = sy - len * 0.45;
    const g = ctx.createLinearGradient(sx, sy, ex, ey);
    const col = ["255,255,255", "180,220,255", "255,200,240"][i % 3];
    g.addColorStop(0, `rgba(${col},${1 - k})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.4 * U;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    glow(ctx, sx, sy, 8 * U, `rgba(${col},1)`, 1 - k);
  }
}

function drawBlackHole(ctx, w, h, t, par) {
  const U = w / 400;
  stars(ctx, w, h, t, 160, 42, 1);
  const cx = w * 0.5, cy = h * 0.34 + par * h * 0.15, R = 46 * U;
  glow(ctx, cx, cy, 200 * U, "rgba(255,140,60,.35)");
  const disk = front => {
    const r = rng(43);
    for (let i = 0; i < 900; i++) {
      const d = 1.25 + r() * 1.9, sp = 0.8 / d;
      const ang = r() * Math.PI * 2 + t * sp;
      const y = Math.sin(ang);
      if ((y > 0) !== front) continue;
      const x = cx + Math.cos(ang) * R * d * 1.6, yy = cy + y * R * d * 0.28;
      const hot = 1 - (d - 1.25) / 1.9;
      ctx.fillStyle = hot > 0.6 ? "#fff3d6" : hot > 0.3 ? "#ffb35c" : "#ff6a3d";
      ctx.globalAlpha = 0.35 + hot * 0.6;
      ctx.fillRect(x, yy, 1.8 * U, 1.8 * U);
    }
    ctx.globalAlpha = 1;
  };
  disk(false);
  // 光の輪
  ctx.strokeStyle = "rgba(255,210,150,.85)";
  ctx.lineWidth = 3 * U;
  ctx.shadowColor = "#ffb35c";
  ctx.shadowBlur = 20 * U;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#000";
  circle(ctx, cx, cy, R);
  disk(true);
}

/* ---------- 階段と主人公 ---------- */

// 主人公の胸のあたりの位置（演出のキラキラを出す場所）
function heroPos(w, h, p) {
  const U = w / 400, k = Math.floor(p), f = p - k, dir = k % 2 === 0 ? 1 : -1;
  const xL = w * 0.16, xR = w * 0.84, st = h * 0.2 / 10;
  return { x: (dir > 0 ? xL : xR) + (xR - xL) * dir * f, y: h * 0.66 - st * 0.5 - 16 * U };
}

function drawStairs(ctx, w, h, p, t, color, walking, hero) {
  const U = w / 400, S = 10;               // 1階 = 10段の踊り場つき階段
  const FH = h * 0.2, cy = h * 0.66;
  const xL = w * 0.16, xR = w * 0.84, sw = (xR - xL) / S, st = FH / S;
  const sy = yw => cy - (yw - p * FH);      // 主人公がいつも同じ高さに見えるようにずらす
  const k0 = Math.floor(p);
  const side = shade(color.length === 7 ? color : "#ffffff", -0.45);

  for (let k = Math.max(0, k0 - 4); k <= k0 + 3; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    const xs = dir > 0 ? xL : xR, xe = dir > 0 ? xR : xL;
    // 階段の裏側
    ctx.fillStyle = side;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(xs, sy(k * FH) + st);
    ctx.lineTo(xe, sy((k + 1) * FH) + st);
    ctx.lineTo(xe, sy((k + 1) * FH) + st * 2.2);
    ctx.lineTo(xs, sy(k * FH) + st * 2.2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 段
    for (let i = 0; i < S; i++) {
      const x = dir > 0 ? xL + i * sw : xR - (i + 1) * sw;
      const top = sy(k * FH + (i + 1) * st);
      ctx.fillStyle = side;
      ctx.fillRect(x, top, sw + 0.5, st * 1.7);
      ctx.fillStyle = color;
      ctx.fillRect(x, top, sw + 0.5, st * 0.45);
    }
    // 踊り場と階の数字
    const ly = sy(k * FH);
    ctx.fillStyle = color;
    ctx.fillRect(xs - w * 0.07, ly, w * 0.14, st * 0.45);
    ctx.fillStyle = side;
    ctx.fillRect(xs - w * 0.07, ly + st * 0.45, w * 0.14, st * 0.8);
    ctx.font = `700 ${11 * U}px "M PLUS Rounded 1c", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 4 * U;
    ctx.fillText(k === 0 ? "地上" : `${k}F`, xs, ly + st * 2.6);
    ctx.shadowBlur = 0;
  }

  if (!hero) return;
  const k = k0, f = p - k, dir = k % 2 === 0 ? 1 : -1;
  const x = (dir > 0 ? xL : xR) + (xR - xL) * dir * f;
  const foot = sy(k * FH + f * FH + st * 0.5);
  drawHero(ctx, x, foot, U, dir, t, walking);
}

function drawHero(ctx, x, y, U, dir, t, walking) {
  const bob = walking ? Math.abs(Math.sin(t * 12)) * 3 * U : Math.sin(t * 2) * 0.6 * U;
  glow(ctx, x, y - 16 * U, 30 * U, "rgba(255,255,255,.35)");
  y -= bob;
  // 足
  const sw = walking ? Math.sin(t * 12) * 3 * U : 0;
  ctx.strokeStyle = "#2a2a3a";
  ctx.lineWidth = 2.6 * U;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 2 * U, y - 8 * U); ctx.lineTo(x - 2 * U + sw, y);
  ctx.moveTo(x + 2 * U, y - 8 * U); ctx.lineTo(x + 2 * U - sw, y);
  ctx.stroke();
  // マフラー（風になびく）
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.moveTo(x, y - 20 * U);
  ctx.quadraticCurveTo(x - dir * 9 * U, y - 22 * U + Math.sin(t * 6) * 2 * U, x - dir * 14 * U, y - 17 * U + Math.sin(t * 6 + 1) * 3 * U);
  ctx.lineTo(x - dir * 12 * U, y - 14 * U);
  ctx.quadraticCurveTo(x - dir * 6 * U, y - 17 * U, x, y - 17 * U);
  ctx.fill();
  // からだ
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - 5 * U, y - 20 * U, 10 * U, 13 * U, 4 * U) : ctx.rect(x - 5 * U, y - 20 * U, 10 * U, 13 * U);
  ctx.fill();
  // あたま
  circle(ctx, x, y - 26 * U, 6 * U);
  ctx.fillStyle = "#2a2a3a";
  circle(ctx, x + dir * 2.4 * U, y - 26.5 * U, 1 * U);
}

/* ---------- まとめて描く ---------- */

let _buf = null;
function buffer(w, h) {
  if (!_buf) _buf = document.createElement("canvas");
  if (_buf.width !== w || _buf.height !== h) { _buf.width = w; _buf.height = h; }
  return _buf;
}

function paintZone(ctx, w, h, zi, par, t) {
  const Z = ZONES[zi];
  sky(ctx, w, h, Z.sky);
  Z.draw(ctx, w, h, t, par);
}

// p = 何階にいるか（小数あり）。opts.hero=false で主人公を消す
function drawScene(ctx, w, h, p, t, opts = {}) {
  const zi = zoneIndex(p);
  const last = zi === ZONES.length - 1;
  const start = ZONE_START[zi];
  const par = last ? Math.min(1, (p - start) / 30) : (p - start) / (ZONE_START[zi + 1] - start);
  paintZone(ctx, w, h, zi, par, t);

  // 次の景色が近づくと、だんだん混ざって見えてくる
  if (!last && par > 0.85) {
    const b = buffer(w, h), bc = b.getContext("2d");
    paintZone(bc, w, h, zi + 1, 0, t);
    ctx.globalAlpha = (par - 0.85) / 0.15;
    ctx.drawImage(b, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  if (opts.stairs !== false) {
    drawStairs(ctx, w, h, p, t, ZONES[zi].stair, !!opts.walking, opts.hero !== false);
  }
}
