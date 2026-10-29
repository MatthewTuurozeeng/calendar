import { useSyncExternalStore } from 'react'

// Offline reading (README §4.9): the service worker keeps copies of database
// reads in this cache and serves them when the network is down.

const DATA_CACHE = 'data-v1'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Whether the browser thinks it has a network connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}

/** Deletes the saved copies of this user's data, e.g. on sign-out. */
export async function clearOfflineData() {
  if ('caches' in window) await caches.delete(DATA_CACHE)
}
