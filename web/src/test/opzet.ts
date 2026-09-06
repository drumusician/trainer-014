/*
 * Eén doosje in het geheugen als localStorage, altijd, ongeacht wat de omgeving
 * zelf meebrengt.
 *
 * Dit stond eerst achter een 'alleen als het ontbreekt'. Node 26 brengt een eigen
 * localStorage mee die er een bestand bij wil, dus daar sloeg het aan; op Node 22
 * — waar de CI op draait — levert jsdom er zelf een, en dan niet. Dat verschil
 * was niet onschuldig: de localStorage van jsdom is een Proxy waarin
 * `localStorage.setItem = ...` geen methode vervangt maar een item met die naam
 * opslaat. Een test die het mislukken van opslaan naspeelt greep daar dus mis,
 * en viel om in de CI terwijl hij lokaal slaagde.
 *
 * Vandaar: de testopstelling bepaalt de omgeving, niet andersom.
 */
const doos = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
	configurable: true,
	writable: true,
	value: {
		getItem: (k: string) => doos.get(k) ?? null,
		setItem: (k: string, v: string) => void doos.set(k, String(v)),
		removeItem: (k: string) => void doos.delete(k),
		clear: () => doos.clear(),
		key: (i: number) => [...doos.keys()][i] ?? null,
		get length() {
			return doos.size;
		}
	}
});
