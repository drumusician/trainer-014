/**
 * Het logboekje doorsturen.
 *
 * Op de landingspagina staat dat er niets naar een server gaat, en dat blijft zo:
 * dit maakt alleen tekst. Wat ermee gebeurt beslist de trainer zelf, met de
 * knop en met zijn eigen mailprogramma.
 *
 * Namen van kinderen mogen er niet in. De app schrijft ze zelf nergens in een
 * foutmelding, maar een melding komt soms van de browser of van de database, en
 * daar heb ik geen greep op. Daarom halen we ze er hier alsnog uit: alles wat we
 * kennen — spelersnamen, de teamnaam, de tegenstander, e-mailadressen — wordt
 * vervangen voordat de tekst bestaat. Beter een melding die minder zegt dan een
 * naam die de deur uit gaat.
 */
import type { Issue } from '$lib/issues.svelte';
import type { State } from './types';

/** Wat er in plaats van een naam komt te staan. */
const WEG = '[naam]';

function ontdubbel(namen: string[]): string[] {
	/* Langste eerst: anders vervangt 'Bram' de helft van 'Bram-Jan' en blijft de
	   rest staan. */
	return [...new Set(namen.map((n) => n.trim()).filter((n) => n.length > 2))].sort((a, b) => b.length - a.length);
}

/** Alles wat we van deze trainer kennen en dus niet mogen doorsturen. */
export function persoonlijk(t: State): string[] {
	return ontdubbel([
		...t.players.map((p) => p.name),
		t.teamName,
		t.match?.opponent ?? '',
		...t.archive.map((a) => a.opponent),
		...t.archive.flatMap((a) => (a.playingTime ?? []).map((r) => r.name))
	]);
}

/** Namen en adressen uit één regel halen. */
export function schoon(tekst: string, namen: string[]): string {
	let uit = tekst;
	for (const naam of namen) {
		uit = uit.split(naam).join(WEG);
	}
	/* En alles wat er als een e-mailadres uitziet, ook als we het niet kennen. */
	return uit.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[adres]');
}

/**
 * De tekst die de trainer te zien krijgt vóór hij hem verstuurt. Hij leest hem
 * zelf; dat is de hele reden dat dit werkt zonder de belofte te breken.
 */
export function issueReport(lijst: Issue[], t: State, omgeving = ''): string {
	const namen = persoonlijk(t);
	const regels = lijst.map((p) => {
		const wanneer = p.when.slice(0, 19).replace('T', ' ');
		const wat = schoon(p.what, namen);
		const melding = p.message ? '\n    ' + schoon(p.message, namen) : '';
		return `${wanneer}  ${wat}${melding}`;
	});
	return [
		'Blaadje — wat er misging',
		omgeving,
		'',
		regels.length ? regels.join('\n') : 'Niets gemeld.',
		'',
		'Geen namen in deze tekst; die zijn eruit gehaald voordat hij bestond.'
	]
		.filter((r) => r !== null)
		.join('\n');
}

/** Wat voor toestel en welke versie, zonder iets dat naar een persoon wijst. */
export function omgevingsregel(ua: string, versie: string): string {
	const kort = ua.replace(/\s*\([^)]*\)/g, '').slice(0, 80);
	return `versie ${versie} · ${kort}`;
}

/**
 * Wat er in de mailto-link past.
 *
 * Een mailto-adres is niet onbeperkt lang; sommige mailprogramma's kappen boven
 * de tweeduizend tekens stilletjes af, en dan mis je juist het staartje. Twintig
 * meldingen halen dat makkelijk. Daarom gaat de mail met de nieuwste meldingen
 * op weg en staat de hele tekst er in het scherm bij, met de mededeling dat er
 * meer is. Beter iets korts dat aankomt dan iets langs dat halverwege stopt.
 */
const MAILRUIMTE = 1600;

export function mailInhoud(tekst: string): string {
	if (tekst.length <= MAILRUIMTE) return tekst;
	const kop = tekst.slice(0, tekst.indexOf('\n\n') + 2);
	const rest = tekst.slice(kop.length);
	const ingekort = rest.slice(0, MAILRUIMTE - kop.length - 80);
	return (
		kop +
		ingekort.slice(0, ingekort.lastIndexOf('\n')) +
		'\n\n(Ingekort voor de mail. De hele lijst staat in de app en op het klembord.)'
	);
}
