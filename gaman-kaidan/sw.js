/*
 * sw.js — ホーム画面から開いたとき、電波がなくても表示できるようにする
 *
 * 一度開いたファイル（フォントも）を端末にしまっておき、次からはそれを先に出す。
 * 裏で新しい版を取りに行くので、ファイルを直したら「2回目に開いたとき」に反映される。
 * すぐ反映させたいときは CACHE の番号を上げる。
 * スクショ読み取りの道具（Tesseract.js）は大きいので、ここではしまわない（道具が自分でしまう）。
 */

const CACHE = "gaman-kaidan-v3";
const FILES = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "js/scenes.js",
  "js/ocr.js",
  "js/app.js",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!mine) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then(res => {
          if (res.ok || res.type === "opaque") cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached || Response.error());
      if (cached) {
        e.waitUntil(fresh);
        return cached;
      }
      return fresh;
    })
  );
});
