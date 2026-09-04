export type Toestel = 'ios' | 'android' | 'desktop';

/**
 * Welk toestel iemand gebruikt, alleen om de juiste uitleg te tonen.
 * Er hangt geen functionaliteit vanaf; zit het ernaast, dan ziet iemand
 * instructies voor een ander toestel en verder niets.
 */
export function bepaalToestel(ua: string, aanraakpunten = 0): Toestel {
	const s = ua.toLowerCase();
	if (/iphone|ipod/.test(s)) return 'ios';
	/* Een iPad doet zich sinds iPadOS 13 voor als een Mac. Het verschil is dat
	   een echte Mac geen aanraakscherm heeft. */
	if (/ipad/.test(s) || (/macintosh/.test(s) && aanraakpunten > 1)) return 'ios';
	if (/android/.test(s)) return 'android';
	return 'desktop';
}

/** Draait de app vanaf het beginscherm in plaats van in een tabblad? */
export function staatOpBeginscherm(): boolean {
	if (typeof window === 'undefined') return false;
	const alsApp = window.matchMedia?.('(display-mode: standalone)')?.matches;
	const opIos = (navigator as { standalone?: boolean }).standalone;
	return !!(alsApp || opIos);
}
