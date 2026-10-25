/*
 * ocr.js — スクリーンタイムのスクショから「3時間12分」などの数字を読み取る
 *
 * 文字読み取りには Tesseract.js（無料・端末の中で動く）を使う。
 * スクショはどこにも送られない。最初の1回だけ、読み取り用のデータ（数MB）をダウンロードする。
 * 読めなかったときは、手で数字を入れてもらう。
 */

const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("読み取りの道具を読み込めませんでした"));
    document.head.appendChild(s);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像を開けませんでした"));
    img.src = url;
  });
}

// 白黒にして、ダークモードのスクショ（黒地に白文字）なら色を反転させる
function prepare(img) {
  const scale = Math.min(1, 1400 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height), px = d.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    px[i] = g;
    sum += g;
  }
  const dark = sum / (px.length / 4) < 110;
  for (let i = 0; i < px.length; i += 4) {
    let g = dark ? 255 - px[i] : px[i];
    g = Math.max(0, Math.min(255, (g - 128) * 1.4 + 128));
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

// 文字の中から時間らしいものを、上から順に取り出す（分にして返す）
function parseTimes(text) {
  const s = text.normalize("NFKC").replace(/\s+/g, "").replace(/時[聞閒閻問]/g, "時間");
  const re = /(\d{1,2})時間(?:(\d{1,2})分)?|(\d{1,2})分|(\d{1,2})h(?:(\d{1,2})m)?/gi;
  const out = [];
  let m;
  while ((m = re.exec(s))) {
    let min;
    if (m[1] != null) {
      if (m[2] != null && +m[2] > 59) continue;
      min = +m[1] * 60 + +(m[2] || 0);
    } else if (m[3] != null) {
      min = +m[3];
    } else {
      if (m[5] != null && +m[5] > 59) continue;
      min = +m[4] * 60 + +(m[5] || 0);
    }
    if (min > 0 && min <= 24 * 60 && !out.includes(min)) out.push(min);
  }
  return out;
}

// onProgress(0〜1, 説明) で進み具合を知らせる
async function readScreenTime(file, onProgress = () => {}) {
  onProgress(0, "読み取りの準備中…");
  await loadScript(TESS_URL);
  const img = await loadImage(file);
  const canvas = prepare(img);
  const worker = await Tesseract.createWorker("jpn", 1, {
    logger: m => {
      if (m.status === "recognizing text") onProgress(m.progress, "読み取り中…");
      else if (/load|initializ/.test(m.status)) onProgress(0, "読み取りの準備中…（初回は少し時間がかかります）");
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return parseTimes(data.text || "");
  } finally {
    worker.terminate();
  }
}
