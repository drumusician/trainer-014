/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

/* Blaadje has to work without signal. Everything belonging to this version goes
   into the cache on install; after that we serve from the cache and fetch a fresh
   version in the background. Anything bound for Supabase we never touch. */
const CACHE = 'blaadje-' + version;
const BESTANDEN = [...build, ...files];

self.addEventListener('install', (event) => {
	const e = event as ExtendableEvent;
	e.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(BESTANDEN))
			.then(() => (self as unknown as ServiceWorkerGlobalScope).skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	const e = event as ExtendableEvent;
	e.waitUntil(
		caches
			.keys()
			.then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
			.then(() => (self as unknown as ServiceWorkerGlobalScope).clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const e = event as FetchEvent;
	if (e.request.method !== 'GET') return;
	const url = new URL(e.request.url);
	if (url.origin !== location.origin) return; /* Supabase nooit uit de cache */

	e.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const uitCache = await cache.match(e.request);
			if (uitCache && BESTANDEN.includes(url.pathname)) return uitCache;

			try {
				const antwoord = await fetch(e.request);
				if (antwoord.ok && antwoord.type === 'basic') cache.put(e.request, antwoord.clone());
				return antwoord;
			} catch {
				/* No signal: return what we have, otherwise the app itself. Not '/',
				   because since prerendering that is the landing page; someone opening a
				   deep link offline at the touchline wants to see the app. */
				return (
					(await cache.match(e.request)) ??
					(await cache.match('/app')) ??
					(await cache.match('/200.html')) ??
					Response.error()
				);
			}
		})()
	);
});
