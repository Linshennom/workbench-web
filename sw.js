/* Service Worker - offline cache for the Workbench PWA */
const CACHE = 'workbench-v20';
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

self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // 只接管同源
  if(url.origin !== location.origin) return;
  // 只处理 GET
  if(e.request.method !== 'GET') return;

  // 数据快照（data/）走「网络优先」，保证每次都能拉到最新生成的财经/游戏资讯；
  // 离线时回退到缓存副本，避免空白。
  if(url.pathname.includes('/data/')){
    e.respondWith(
      fetch(e.request).then(resp=>{
        if(resp && resp.status===200){
          const clone=resp.clone();
          caches.open(CACHE).then(c=>c.put(e.request, clone));
        }
        return resp;
      }).catch(()=> caches.match(e.request))
    );
    return;
  }

  // 导航请求（顶层访问或刷新）走「缓存优先 + 离线回退到 index」
  const isNav = e.request.mode==='navigate' || (e.request.headers.get('accept')||'').includes('text/html');
  if(isNav){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        if(cached) return cached;
        return fetch(e.request).then(resp=>{
          if(resp && resp.status===200){
            const clone=resp.clone();
            caches.open(CACHE).then(c=>c.put(e.request, clone));
          }
          return resp;
        }).catch(()=> caches.match('./index.html'))
      })
    );
    return;
  }

  // 静态资源：缓存优先，后台静默更新；离线时静默回退
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(resp => {
        if(resp && resp.status===200){
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(()=> cached);
      return cached || networkFetch;
    })
  );
});