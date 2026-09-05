/**
 * Bezoek aan de landingspagina meten, en verder niets.
 *
 * In de app zelf meten we niet. Op blaadje.app staat dat er zolang jij dat niet
 * wilt niets naar een server gaat, en dat moet waar blijven. Een marketingpagina
 * is iets anders dan de app waarin de namen van kinderen staan.
 *
 * Het script wordt daarom alleen op de landingspagina geladen. En de knoppen
 * naar de app doen een volledige paginawissel in plaats van een sprong binnen de
 * app, zodat het script weg is voordat /app in beeld komt. Dat scheelt vertrouwen
 * op instellingen van Plausible die ik niet kan controleren.
 */
const DOMEIN = 'blaadje.app';
const SCRIPT = 'https://plausible.io/js/pa-b3boY7ioSqozXuznm2eGT.js';

export function startMeten(): () => void {
	if (typeof window === 'undefined' || location.hostname !== DOMEIN) return () => {};
	if (document.querySelector(`script[src="${SCRIPT}"]`)) return () => {};

	window.plausible =
		window.plausible ||
		function (...args: unknown[]) {
			(window.plausible!.q = window.plausible!.q || []).push(args);
		};
	window.plausible.init = window.plausible.init || ((opties?: unknown) => void opties);

	const script = document.createElement('script');
	script.async = true;
	script.src = SCRIPT;
	document.head.appendChild(script);
	window.plausible.init();

	return () => script.remove();
}

/** Eén gebeurtenis melden, als er gemeten wordt. */
export function meld(naam: string) {
	window.plausible?.(naam);
}
