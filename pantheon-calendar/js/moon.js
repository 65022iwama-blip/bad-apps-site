/*
 * moon.js — 新月・満月の日時を計算する
 *
 * Jean Meeus『Astronomical Algorithms』第49章の式（主要な補正項のみ）。
 * 誤差は数分程度で、「その日が何日目か」を決めるには十分。
 * ネットにつながなくても動く（外部APIは使わない）。
 */

const DEG = Math.PI / 180;

/**
 * k番目の月相の日時を返す。
 * k が整数なら新月、k+0.5 なら満月（k=0 は 2000年1月6日ごろの新月）。
 */
function moonPhaseDate(k, isFull) {
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T
          - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;

  const E  = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M  = (2.5534 + 29.1053567 * k - 0.0000014 * T * T) * DEG;            // 太陽の平均近点角
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3) * DEG; // 月の平均近点角
  const F  = (160.7108 + 390.67050284 * k - 0.0016118 * T * T) * DEG;        // 月の緯度引数
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T) * DEG;          // 昇交点黄経
  const s = Math.sin;

  const c = isFull
    ? [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209]
    : [-0.40720, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208];

  jde += c[0] * s(Mp) + c[1] * E * s(M) + c[2] * s(2 * Mp) + c[3] * s(2 * F)
       + c[4] * E * s(Mp - M) + c[5] * E * s(Mp + M) + c[6] * E * E * s(2 * M)
       - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
       - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
       - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om);

  // ユリウス日 → JavaScript の Date（地球時TTとの差 約69秒も引く）
  return new Date((jde - 2440587.5) * 864e5 - 69e3);
}

/** date の前後数か月ぶんの新月・満月を時刻順に並べて返す */
function moonEventsAround(date) {
  const k0 = Math.floor((date.getFullYear() + date.getMonth() / 12 - 2000) * 12.3685);
  const list = [];
  for (let k = k0 - 3; k <= k0 + 4; k++) {
    list.push({ time: moonPhaseDate(k, false),      isFull: false });
    list.push({ time: moonPhaseDate(k + 0.5, true), isFull: true });
  }
  return list.sort((a, b) => a.time - b.time);
}

/**
 * 月の形をSVGで返す。
 * phase: 0=新月 → 0.5=満月 → 1=次の新月
 * 右側から満ちて左側から欠ける（北半球の見え方）。
 */
function moonSVG(phase, size, litColor, darkColor) {
  const r = 20, c = 24, cosA = Math.cos(phase * 2 * Math.PI), pts = [];
  const half = y => Math.sqrt(Math.max(0, r * r - y * y));
  for (let i = 0; i <= 40; i++) {               // 光っている部分の右の縁
    const y = -r + (2 * r * i) / 40;
    pts.push([phase < 0.5 ? half(y) : -cosA * half(y), y]);
  }
  for (let i = 40; i >= 0; i--) {               // 光っている部分の左の縁
    const y = -r + (2 * r * i) / 40;
    pts.push([phase < 0.5 ? cosA * half(y) : -half(y), y]);
  }
  const poly = pts.map(([x, y]) => `${(c + x).toFixed(2)},${(c + y).toFixed(2)}`).join(" ");
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48">
    <circle cx="${c}" cy="${c}" r="${r}" fill="${darkColor}" stroke="${litColor}" stroke-opacity=".35"/>
    <polygon fill="${litColor}" points="${poly}"/></svg>`;
}
