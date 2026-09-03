/* Node 26 heeft zelf een localStorage die alleen werkt met een bestand erbij, en
   die duwt die van jsdom opzij. Voor een test is een doosje in het geheugen
   genoeg. */
if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
	const doos = new Map<string, string>();
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
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
}
