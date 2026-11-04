/* OneSignal + M4D PWA shared root service worker. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

/* Marriage4Dummies PWA: cache only the public site shell, never personal data. */
const CACHE_NAME='m4d-shell-v7-push-state-sync';
const SHELL=['/','/index.html','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-512-maskable.png','/icons/apple-touch-icon.png','/apple-touch-icon.png','/favicon.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('m4d-shell-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 const url=new URL(req.url);
 // Only cache known static app files; no APIs, user pages, account data or media.
 const staticAsset=SHELL.includes(url.pathname) && url.pathname!=='/' && url.pathname!=='/index.html';
 if(req.mode==='navigate'){
   event.respondWith(fetch(req).then(res=>{
     if(res.ok && url.pathname==='/' ){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put('/index.html',copy));}
     return res;
   }).catch(()=>caches.match('/index.html')));
 }else if(staticAsset){event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));}
});
// OneSignal SDK above handles incoming push events and notification clicks.
