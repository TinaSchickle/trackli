// Der Platzhalter im Cache-Namen wird beim Prod-Build durch eine eindeutige
// ID ersetzt (siehe vite.config.js). Dadurch bekommt jeder Build einen neuen
// Cache-Namen, der alte Cache wird beim activate gelöscht und die App zieht
// die neuen Assets.
const CACHE_NAME = 'zykluskalender-__BUILD_ID__';
const SHELL_ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first für gebaute Assets, Netzwerk-Fallback sonst.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => cached)
    )
  );
});

// Erinnerungs-Push (z. B. "noch kein Zervixschleim heute"), ausgelöst vom
// Cron-Job in scripts/send-mucus-reminders.mjs. Payload ist JSON {title, body}.
self.addEventListener('push', (event) => {
  let payload = { title: 'Zykluskalender', body: 'Denk an deinen heutigen Eintrag.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // kein/kein gültiges JSON – Standardtext behalten
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'mucus-reminder',
    })
  );
});

// Klick auf die Benachrichtigung: vorhandenes Fenster fokussieren oder die
// App neu öffnen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
      return undefined;
    })
  );
});
