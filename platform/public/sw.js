// CACHE_NAME is versioned per deploy. The registering page passes the
// current build id as ?v=<BUILD_ID>, which we read off the SW's own URL.
// Falls back to a static tag if the query is missing (e.g. direct navigation).
const BUILD_VERSION = (() => {
  try {
    return new URL(self.location.href).searchParams.get('v') || 'static';
  } catch {
    return 'static';
  }
})();
const CACHE_NAME = `tamamhealth-${BUILD_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/login',
  '/patient-portal',
  '/dashboard',
  '/patients',
  '/consultation',
  '/referrals',
  '/lab',
  '/pharmacy',
  '/surveillance',
  '/reports',
  '/hospitals',
  '/government',
  '/appointments',
  '/immunizations',
  '/births',
  '/deaths',
  '/anc',
  '/messages',
  '/settings',
  '/telehealth',
  '/epidemic-intelligence',
  '/data-quality',
  '/vital-statistics',
  '/mch-analytics',
  '/facility-assessments',
];

// Background sync queue stored in IndexedDB
const SYNC_DB_NAME = 'tamamhealth-sync-queue';
const SYNC_STORE = 'pending-requests';

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueRequest(url, options) {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    tx.objectStore(SYNC_STORE).add({
      url,
      method: options.method || 'POST',
      headers: options.headers || {},
      body: options.body || null,
      timestamp: Date.now(),
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch {
    // IndexedDB not available
  }
}

async function flushSyncQueue() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const store = tx.objectStore(SYNC_STORE);
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const entry of all) {
      try {
        await fetch(entry.url, {
          method: entry.method,
          headers: entry.headers,
          body: entry.body,
        });
        // Remove from queue on success
        const delTx = db.transaction(SYNC_STORE, 'readwrite');
        delTx.objectStore(SYNC_STORE).delete(entry.id);
      } catch {
        // Still offline, keep in queue
        break;
      }
    }
  } catch {
    // IndexedDB not available
  }
}

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some routes may not be available at install time
        return cache.addAll(['/']);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches and flush sync queue
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => flushSyncQueue())
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) return;

  // For API auth routes: network only (don't cache auth responses)
  if (url.pathname.startsWith('/api/auth')) {
    return;
  }

  // For other API POST/PUT/DELETE: try network, queue if offline
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(async () => {
        // Queue the request for background sync
        const body = await request.clone().text();
        await queueRequest(request.url, {
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body,
        });
        return new Response(JSON.stringify({ queued: true, offline: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // For Next.js static assets: cache-first (they have content hashes)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For everything else: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return cached app shell
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Listen for online event to flush sync queue
self.addEventListener('message', (event) => {
  if (event.data === 'ONLINE') {
    flushSyncQueue();
  }
});
