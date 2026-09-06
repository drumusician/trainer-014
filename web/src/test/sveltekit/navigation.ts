/* Stand-in voor $app/navigation. Een test heeft geen router; wat telt is dát er
   genavigeerd wordt en waarheen, en dat kun je hier aflezen. */
export const gegaanNaar: string[] = [];

export function goto(url: string | URL): Promise<void> {
	gegaanNaar.push(String(url));
	return Promise.resolve();
}

export function invalidateAll(): Promise<void> {
	return Promise.resolve();
}

export function pushState(): void {}
export function replaceState(): void {}
export function preloadData(): Promise<void> {
	return Promise.resolve();
}
export function preloadCode(): Promise<void> {
	return Promise.resolve();
}
export function beforeNavigate(): void {}
export function afterNavigate(): void {}
export function onNavigate(): void {}
