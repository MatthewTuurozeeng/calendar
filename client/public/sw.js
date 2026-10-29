// Service worker: app-shell caching, offline reading and push notifications (README §4.9, §7).
// Plain JS in public/ so it's served at /sw.js and controls the whole app.

const CACHE = 'app-shell-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.svg']
// Copies of database reads, for offline viewing. The app deletes it on sign-out.
const DATA_CACHE = 'data-v1'
const DATA_LIMIT = 300

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET') return

  // Database reads: network first; the last good answer when offline.
  // Writes, auth and Edge Functions always go to the network.
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(networkThenData(request))
    return
  }

  // Otherwise only this app's own files.
  if (url.origin !== self.location.origin) return

  // Pages: network first so deploys show up, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Built assets have hashed names, so a cached copy is always correct.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})

/** The same URL can be read as a list or as one object, so the Accept header is part of the key. */
function dataKey(request) {
  const url = new URL(request.url)
  url.searchParams.set('__accept', request.headers.get('accept') || '')
  return url.toString()
}

async function networkThenData(request) {
  const key = dataKey(request)
  try {
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      caches.open(DATA_CACHE).then(async (cache) => {
        await cache.put(key, copy)
        // Oldest first: keep the cache to the most recent reads.
        const keys = await cache.keys()
        await Promise.all(keys.slice(0, Math.max(0, keys.length - DATA_LIMIT)).map((k) => cache.delete(k)))
      })
    }
    return response
  } catch (err) {
    const cached = await caches.match(key, { cacheName: DATA_CACHE })
    if (cached) return cached
    throw err
  }
}

// Payload from send-reminders: { title, body, url, tag }.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Reminder', {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  )
})

// Focus an open window if there is one, else open the app at the reminder's page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) return open.focus().then(() => open.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
