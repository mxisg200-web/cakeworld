// Keeps the app opening even with weak internet. Always tries the network first, so updates arrive by themselves.
const V = 'cw-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  // Share from WhatsApp / Files straight into the app (Android "Share" menu): keep the files, then open the app
  if (r.method === 'POST' && new URL(r.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await r.formData(), fs = fd.getAll('files').filter(f => f && typeof f !== 'string');
        await caches.delete('cw-share'); const c = await caches.open('cw-share');
        let i = 0; for (const f of fs) await c.put(new URL('shared/' + (i++), self.registration.scope).href, new Response(f, { headers: { 'X-Name': encodeURIComponent(f.name || 'report.xlsx') } }));
      } catch (x) { }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.endsWith('supabase.co')) return;
  if (u.origin === location.origin || u.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
  }
});

// ---- Phone alerts (push): shown even when the phone is locked or the app is closed ----
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Cake World', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => {
    // when the app is open on screen it already rings by itself
    if (cl.some(c => c.visibilityState === 'visible' && c.focused)) return;
    return self.registration.showNotification(d.title || 'Cake World', {
      body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'cw', renotify: !!d.renotify,
      vibrate: [200, 100, 200, 100, 200], requireInteraction: false, data: { url: './' }
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => {
    for (const c of cl) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
