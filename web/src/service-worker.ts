/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

/* Blaadje moet het doen zonder bereik. Alles wat bij deze versie hoort gaat bij
   de installatie in de cache; daarna serveren we uit de cache en halen we op de
   achtergrond een verse versie op. Wat naar Supabase gaat, raken we nooit aan. */
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
				/* Geen bereik: geef terug wat we hebben, anders de app zelf. Niet '/',
				   want dat is sinds het voorrenderen de landingspagina; wie langs de
				   lijn offline een diep adres opent wil de app zien. */
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
