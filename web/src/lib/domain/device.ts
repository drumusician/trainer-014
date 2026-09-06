export type Device = 'ios' | 'android' | 'desktop';

/**
 * Which device someone is on, purely to show the right instructions. No
 * behaviour depends on it; if the guess is wrong, someone sees instructions for
 * another device and nothing more.
 */
export function detectDevice(ua: string, aanraakpunten = 0): Device {
	const s = ua.toLowerCase();
	if (/iphone|ipod/.test(s)) return 'ios';
	/* Since iPadOS 13 an iPad presents itself as a Mac. The difference is that a
	   real Mac has no touch screen. */
	if (/ipad/.test(s) || (/macintosh/.test(s) && aanraakpunten > 1)) return 'ios';
	if (/android/.test(s)) return 'android';
	return 'desktop';
}

/** Is the app running from the home screen rather than in a browser tab? */
export function isInstalled(): boolean {
	if (typeof window === 'undefined') return false;
	const alsApp = window.matchMedia?.('(display-mode: standalone)')?.matches;
	const opIos = (navigator as { standalone?: boolean }).standalone;
	return !!(alsApp || opIos);
}
