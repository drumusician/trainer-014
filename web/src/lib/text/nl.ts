/**
 * Alle tekst die een trainer op zijn scherm ziet, op één plek.
 *
 * Waarom hier en niet in de componenten:
 *
 * Ten eerste omdat het te lezen moet zijn. De woorden zijn het product net zo
 * goed als de knoppen, en verspreid over negentien bestanden kun je ze niet in
 * één keer doorlezen. Hier wel.
 *
 * Ten tweede omdat ze anders meebewegen met de code. Bij het hernoemen naar het
 * Engels zijn er 110 Engelse woorden midden in Nederlandse zinnen beland — "Nog
 * geen players", "wie on zitten", "de wissels laat ik er defaultLineup uit" —
 * en geen enkele test ving dat, want copy is geen gedrag. Zinnen die hier staan
 * hebben geen code omheen die per ongeluk mee verandert.
 *
 * De sleutels zijn Engels omdat de code dat is. De waarden zijn Nederlands
 * omdat het product dat is: Blaadje is voor Nederlandse jeugdtrainers, en het
 * Nederlands wordt hier geschreven en niet uit een andere taal vertaald. Komt
 * er ooit een tweede taal, dan komt daar een tweede bestand naast en verandert
 * er aan de componenten niets.
 *
 * Zinnen met iets variabels erin zijn functies. Zo blijft de hele zin bij
 * elkaar staan in plaats van in stukken door de opmaak verspreid, en zie je bij
 * het lezen meteen wat er invalt.
 */

/** Wat op meerdere schermen terugkomt. */
const common = {
	back: 'Terug',
	cancel: 'Annuleren',
	done: 'Klaar',
	delete: 'Weg',
	change: 'Wijzigen',
	noSquadYet: 'Nog geen spelers',
	noSquadHint: 'Zet eerst je selectie erin, dan valt er wat op te stellen.',
	toSquad: 'Naar Team'
} as const;

/** Wie is er vandaag — tevens het opzetscherm van een wedstrijd. */
const attendance = {
	title: 'Wie is er?',

	noMatch: 'Er is geen wedstrijd om spelers voor af te melden.',

	opponentHeading: 'Tegen wie',
	opponentLabel: 'Tegenstander',
	opponentPlaceholder: 'bijv. Sparta JO11-2',
	homeOrAwayLabel: 'Thuis of uit',
	home: 'Thuis',
	away: 'Uit',

	heading: 'Wie is er vandaag',
	/* Tijdens de wedstrijd is dit geen opzetscherm meer maar een correctie, en
	   dan mag het veld niet meer wijzigen — zie setAbsent in actions/match.ts. */
	hintDuringMatch:
		'De wedstrijd loopt. Wie in het veld staat haal je eruit met een wissel, niet hier — anders klopt zijn speeltijd niet meer. Van de bank afmelden kan wel.',
	hintBeforeMatch:
		'Tik weg wie er niet is. Die staat dan niet op de bank, zodat je hem er langs de lijn niet per ongeluk in brengt. Wie al opgesteld stond, laat zijn plek leeg.',

	/* In twee stukken, en dat is een uitzondering. Het aantal staat vet in een
	   verder grijze regel: dat is het getal waar je op scant. Vet kan niet in een
	   tekst zonder opmaak in dit bestand te halen, dus staat het getal in de
	   opmaak en de rest van de zin hier. */
	countRest: (total: number) => `van de ${total} aanwezig`,
	sessions: (came: number, total: number) => `${came}/${total} training`,

	onPitch: 'In het veld',
	present: 'Er wel',
	absent: 'Er niet',

	backToMatch: 'Terug naar de wedstrijd',
	onToLineup: 'Verder naar de opstelling'
} as const;

export const text = {
	common,
	attendance
} as const;
