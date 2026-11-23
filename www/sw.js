const V='amr-v1',F=['./','index.html','style.css','script.js','manifest.json','favicon.png','js/db.js','js/i18n.js','js/fs.js','js/zip.js','js/preview.js','fonts/ui-regular.ttf','fonts/ui-bold.ttf','icons/logo.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin)||e.request.url.includes('/_capacitor_'))return;
e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(V).then(x=>x.put(e.request,c));return n}).catch(()=>caches.match('index.html'))))});
