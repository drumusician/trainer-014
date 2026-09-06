/**
 * Measure visits to the landing page, and nothing else.
 *
 * We do not measure inside the app itself. blaadje.app promises that nothing goes
 * to a server unless you want it to, and that has to stay true. A marketing page
 * is a different thing from the app that holds children's names.
 *
 * So the script is loaded on the landing page only. And the buttons to the app do
 * a full page load rather than a jump within the app, so the script is gone before
 * /app appears. That saves relying on Plausible settings I cannot verify.
 */
const DOMEIN = 'blaadje.app';
const SCRIPT = 'https://plausible.io/js/pa-b3boY7ioSqozXuznm2eGT.js';

export function startMeten(): () => void {
	if (typeof window === 'undefined' || location.hostname !== DOMEIN) return () => {};
	if (document.querySelector(`script[src="${SCRIPT}"]`)) return () => {};

	/* Literally Plausible's own stub. Important: init stores the options in
	   plausible.o. The script reads that after loading, and without it never
	   starts. An init that does nothing looks harmless and measures nothing. */
	window.plausible =
		window.plausible ||
		function (...args: unknown[]) {
			(window.plausible!.q = window.plausible!.q || []).push(args);
		};
	window.plausible.init =
		window.plausible.init ||
		function (opties?: unknown) {
			window.plausible!.o = opties || {};
		};

	const script = document.createElement('script');
	script.async = true;
	script.src = SCRIPT;
	document.head.appendChild(script);
	window.plausible.init();

	return () => script.remove();
}

/** Report a single event, if measuring is on. */
export function meld(name: string) {
	window.plausible?.(name);
}
