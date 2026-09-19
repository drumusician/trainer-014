/*
 * Wat de assistent binnenkrijgt en in welke vorm hij mag antwoorden. Zonder
 * netwerk: het taalmodel zelf wordt hier niet gevraagd.
 *
 *   deno test supabase/functions/coach
 */
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1';
import * as z from 'zod/v4';
import { bericht, CoachVraagSchema, kanOpstellen, voorstelSchema, type CoachVraag } from './vraag.ts';

const speler = (naam: string, afwezig = false) => ({
	naam,
	linie: 'Middenveld',
	kanKeepen: false,
	afwezig,
	training: { aanwezig: 3, van: 4, laatste: ['aanwezig'] },
	bank: { wedstrijden: 1, bankMinuten: 10, begonOpBank: 0, beginBekend: 1 },
	minutenGespeeld: 60,
	doelpunten: 0,
	assists: 0
});

const VRAAG: CoachVraag = {
	teamId: '6f1d2c3b-1111-4222-8333-944455556666',
	vraag: 'Morgen tegen de nummer 1.',
	formatie: '2-2',
	delen: 2,
	minutenPerDeel: 20,
	plekken: [
		{ code: 'VL', label: 'V', linie: 'Verdediging' },
		{ code: 'VR', label: 'V', linie: 'Verdediging' },
		{ code: 'AL', label: 'A', linie: 'Aanval' },
		{ code: 'AR', label: 'A', linie: 'Aanval' }
	],
	spelers: ['Bram', 'Cas', 'Dirk', 'Eef', 'Finn'].map((n) => speler(n)).concat(speler('Siem', true)),
	opstellingNu: { plekken: { VL: 'Bram', VR: 'Cas', AL: 'Dirk', AR: null }, bank: ['Eef', 'Finn'] },
	wedstrijden: []
};

Deno.test('neemt een goede vraag aan', () => {
	assert(CoachVraagSchema.safeParse(VRAAG).success);
});

Deno.test('weigert een vraag zonder team of met een te lange tekst', () => {
	assertFalse(CoachVraagSchema.safeParse({ ...VRAAG, teamId: 'x' }).success);
	assertFalse(CoachVraagSchema.safeParse({ ...VRAAG, vraag: 'a'.repeat(2001) }).success);
});

Deno.test('noemt de plekken en wie er is, maar niet wie er afwezig is', () => {
	const tekst = JSON.stringify(z.toJSONSchema(voorstelSchema(VRAAG)));
	assert(tekst.includes('Een van: VL, VR, AL, AR.'));
	assert(tekst.includes('Een van: Bram, Cas, Dirk, Eef, Finn.'));
	assertFalse(tekst.includes('Siem'));
});

/* Een verkeerde naam gooit niet het hele antwoord weg: dat loopt de app na. */
Deno.test('laat een antwoord met een onbekende naam door naar de app', () => {
	const antwoord = {
		samenvatting: 's',
		opstelling: [{ plek: 'SP', speler: 'Zlatan' }],
		bank: [],
		wisselplan: [{ minuut: 20, eruit: 'Dirk', erin: 'Finn', waarom: 'rust' }],
		redenen: [],
		aandachtspunten: []
	};
	assert(voorstelSchema(VRAAG).safeParse(antwoord).success);
	assert(
		voorstelSchema(VRAAG).safeParse({ ...antwoord, wisselplan: [{ ...antwoord.wisselplan[0], minuut: 41 }] }).success,
		'een wissel na het eindsignaal is een slordigheid, geen reden om alles weg te gooien'
	);
});

/* De vorm gaat als JSON-schema naar het taalmodel; dat moet er ook echt van te maken zijn. */
Deno.test('is om te zetten naar een JSON-schema', () => {
	const js = z.toJSONSchema(voorstelSchema(VRAAG)) as { properties: Record<string, unknown> };
	assertEquals(Object.keys(js.properties).sort(), [
		'aandachtspunten',
		'bank',
		'opstelling',
		'redenen',
		'samenvatting',
		'wisselplan'
	]);
});

Deno.test('zegt het als er te weinig spelers zijn', () => {
	assertEquals(kanOpstellen(VRAAG), null);
	const weinig = { ...VRAAG, spelers: VRAAG.spelers.slice(0, 3) };
	assertEquals(kanOpstellen(weinig), 'Er zijn 3 spelers en 4 plekken. Daar valt niets op te stellen.');
});

Deno.test('stuurt het team-id niet mee naar het taalmodel', () => {
	const tekst = bericht(VRAAG);
	assertFalse(tekst.includes(VRAAG.teamId));
	assert(tekst.startsWith('De trainer vraagt:\nMorgen tegen de nummer 1.'));
});

Deno.test('stuurt bij het bijsturen het vorige voorstel en alle wensen mee', () => {
	const vorige = {
		voorstel: {
			samenvatting: 'Eef begint op de bank.',
			opstelling: [
				{ plek: 'VL', speler: 'Bram' },
				{ plek: 'VR', speler: 'Cas' },
				{ plek: 'AL', speler: 'Dirk' },
				{ plek: 'AR', speler: 'Finn' }
			],
			bank: ['Eef'],
			wisselplan: [],
			redenen: [],
			aandachtspunten: []
		},
		bijsturingen: ['Eef moet beginnen.', 'Dirk liever rechts.']
	};
	const bijgestuurd = { ...VRAAG, vorige };
	assert(CoachVraagSchema.safeParse(bijgestuurd).success);
	const tekst = bericht(bijgestuurd);
	assert(tekst.includes('Je eerdere voorstel:'));
	assert(tekst.includes('Eef begint op de bank.'));
	assert(tekst.indexOf('- Eef moet beginnen.') < tekst.indexOf('- Dirk liever rechts.'));
	/* het voorstel staat niet ook nog tussen de gewone gegevens */
	assertEquals(tekst.split('Eef begint op de bank.').length, 2);
});

Deno.test('vraagt zonder bijsturing gewoon om een nieuw voorstel', () => {
	assertFalse(bericht(VRAAG).includes('Je eerdere voorstel'));
});

Deno.test('weigert bijsturen zonder wens', () => {
	const leeg = {
		...VRAAG,
		vorige: {
			voorstel: { samenvatting: '', opstelling: [], bank: [], wisselplan: [], redenen: [], aandachtspunten: [] },
			bijsturingen: []
		}
	};
	assertFalse(CoachVraagSchema.safeParse(leeg).success);
});

Deno.test('zet de vaste afspraken apart boven de gegevens', () => {
	const tekst = bericht({ ...VRAAG, afspraken: 'Wie keept, begint niet op de bank.' });
	assert(tekst.includes('Vaste afspraken van dit team:\nWie keept, begint niet op de bank.'));
	assert(tekst.indexOf('Vaste afspraken') < tekst.indexOf('De gegevens:'));
	assertEquals(tekst.split('Wie keept').length, 2);
	assertFalse(bericht(VRAAG).includes('Vaste afspraken'));
});

Deno.test('neemt een vraag van een oudere app zonder afspraken en keeperminuten aan', () => {
	assert(CoachVraagSchema.safeParse(VRAAG).success);
	const nieuw = {
		...VRAAG,
		afspraken: 'x',
		spelers: VRAAG.spelers.map((s) => ({ ...s, keeperMinuten: 35 }))
	};
	assert(CoachVraagSchema.safeParse(nieuw).success);
});
