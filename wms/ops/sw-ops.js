/* Service worker WMS Ops (19 Okt 2026): notif HP dan kerangka aplikasi tanpa sinyal.
 * Jaringan dulu, simpanan cuma cadangan. Hanya GET di /ops/ dan /img/ (logo, boneka SKU); Supabase tidak pernah disimpan. */
var SIMPAN = 'ops-kerangka-2';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (n) { return n.indexOf('ops-kerangka-') === 0 && n !== SIMPAN; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var q = e.request, u;
  try { u = new URL(q.url); } catch (er) { return; }
  if (q.method !== 'GET' || u.origin !== self.location.origin || (u.pathname.indexOf('/ops/') !== 0 && u.pathname.indexOf('/img/') !== 0)) return;
  e.respondWith(fetch(q).then(function (r) {
    if (r && r.ok && r.type === 'basic') { var salin = r.clone(); caches.open(SIMPAN).then(function (c) { return c.put(q, salin); }); }
    return r;
  }, function () {
    return caches.match(q, { ignoreSearch: true }).then(function (r) { return r || (q.mode === 'navigate' ? caches.match('/ops/', { ignoreSearch: true }) : undefined) || Response.error(); });
  }));
});
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { judul: 'WMS Ops', isi: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.judul || 'WMS Ops', {
    body: d.isi || '', tag: d.tag || undefined, renotify: !!d.tag, icon: '/ops/ikon-192.png', badge: '/ops/lencana-96.png',
    data: { url: d.url || '/ops/' }
  }).then(function () {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ segarkan: true }); }); });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var tuju = new URL((e.notification.data && e.notification.data.url) || '/ops/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].url.indexOf(self.location.origin + '/ops/') === 0) { cs[i].postMessage({ buka: tuju }); return cs[i].focus(); }
    }
    return self.clients.openWindow(tuju);
  }));
});
