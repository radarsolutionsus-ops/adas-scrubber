/* no-op service worker placeholder to prevent 404 noise in environments
 * that auto-request /service-worker.js from cached or browser tooling hooks.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
