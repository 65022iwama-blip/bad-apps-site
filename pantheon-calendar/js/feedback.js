/*
 * feedback.js — 盤が1区画動いたときの「カチッ」
 *
 *  - 音   : Web Audio で短いノイズを作って鳴らす（音声ファイル不要）
 *  - 振動 : navigator.vibrate（Android のブラウザで動く）
 *
 * ※ iPhone ではウェブページから振動させる方法がないので、音だけになる。
 */

let audioCtx = null;

function playClick() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const len = Math.floor(audioCtx.sampleRate * 0.025);     // 25ミリ秒
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 6;

    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();             // 高めの音だけ通して「カチッ」に
    const gain = audioCtx.createGain();
    src.buffer = buf;
    filter.type = "bandpass"; filter.frequency.value = 2600; filter.Q.value = 3;
    gain.gain.value = 0.9;
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start();
  } catch (_) { /* 音が出せない環境では何もしない */ }
}

function vibrate() {
  try { navigator.vibrate && navigator.vibrate(14); } catch (_) {}
}

/** 1区画ぶん動いたときに呼ぶ */
function tick() {
  playClick();
  vibrate();
  const pointer = document.getElementById("pointer");        // 上の三角を跳ねさせる
  if (pointer) {
    pointer.classList.remove("tick");
    void pointer.getBBox();                                  // アニメーションをやり直させるため
    pointer.classList.add("tick");
  }
}
