/* Service Worker - offline cache for the Workbench PWA */
const CACHE = 'workbench-v8';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only handle same-origin
  if(url.origin !== location.origin) return;
  // 数据快照（data/）走「网络优先」，保证每次都能拉到最新生成的财经/游戏资讯；
  // 离线时回退到缓存副本，避免空白。
  if(url.pathname.includes('/data/')){
    e.respondWith(
      fetch(e.request).then(resp=>{
        if(e.request.method==='GET' && resp.status===200){
          const clone=resp.clone();
          caches.open(CACHE).then(c=>c.put(e.request, clone));
        }
        return resp;
      }).catch(()=> caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(resp => {
        // cache GET successful responses
        if(e.request.method==='GET' && resp.status===200){
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(()=> caches.match('./index.html'));
    })
  );
});