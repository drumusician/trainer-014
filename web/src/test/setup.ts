/*
 * One in-memory box standing in for localStorage, always, regardless of what the
 * environment brings along itself.
 *
 * This used to sit behind an "only if it is missing". Node 26 ships its own
 * localStorage that wants a file alongside it, so there it kicked in; on Node 22
 * — which CI runs on — jsdom provides one, and then it did not. That difference
 * was not harmless: jsdom's localStorage is a Proxy in which
 * `localStorage.setItem = ...` does not replace a method but stores an item under
 * that name. A test simulating a failed save therefore missed entirely, and fell
 * over in CI while passing locally.
 *
 * Hence: the test setup decides the environment, not the other way round.
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
