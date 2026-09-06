import { describe, expect, it } from 'vitest';
import { issueReport, mailInhoud, omgevingsregel, persoonlijk, schoon } from './issue-report';
import { emptyState, type State } from './types';
import type { Issue } from '$lib/issues.svelte';

/*
 * Het logboekje doorsturen mag de belofte van de landingspagina niet breken. Die
 * belofte is niet "wij sturen niets" maar "er gaat niets weg tenzij jij het
 * stuurt, en dan zonder namen". Dat tweede stuk is wat hier bewezen wordt: geen
 * enkele naam die de app kent mag in de tekst overblijven.
 */
function toestand(): State {
	const t = emptyState();
	t.teamName = 'JO14-3';
	t.players = [
		{ id: 'p1', name: 'Bram', line: 'V' },
		{ id: 'p2', name: 'Sil', line: 'M' },
		{ id: 'p3', name: 'Bram-Jan', line: 'A' }
	];
	t.match = { opponent: 'Kampong', lineup: {}, bench: [], events: [] } as never;
	t.archive = [
		{
			date: '2026-09-06',
			opponent: 'Hercules',
			home: true,
			score: [1, 0],
			formation: '4-3-3',
			duration: 2400,
			events: [],
			playingTime: [{ id: 'oud', name: 'Wessel', seconds: 1200 }]
		} as never
	];
	return t;
}

const LOG: Issue[] = [
	{ when: '2026-09-06T14:30:12.000Z', what: 'Opslaan lukte niet.', message: 'QuotaExceededError' },
	{ when: '2026-09-06T14:31:00.000Z', what: 'Synchroniseren lukte niet.' }
];

describe('wat we van deze trainer kennen', () => {
	it('verzamelt alle namen die in de app staan', () => {
		const n = persoonlijk(toestand());
		expect(n).toContain('Bram');
		expect(n).toContain('JO14-3');
		expect(n).toContain('Kampong');
		expect(n).toContain('Hercules');
		expect(n).toContain('Wessel');
	});

	/* Korte namen laten we staan: 'Sil' vervangen zou half Nederlands slopen, en
	   drie letters zeggen niemand iets. Dat is een keuze, geen vergissing. */
	it('laat namen van twee letters of korter met rust', () => {
		const t = emptyState();
		t.players = [{ id: 'x', name: 'Jo', line: 'M' }];
		expect(persoonlijk(t)).not.toContain('Jo');
	});

	it('zet de langste namen vooraan', () => {
		const n = persoonlijk(toestand());
		expect(n.indexOf('Bram-Jan')).toBeLessThan(n.indexOf('Bram'));
	});
});

describe('een regel schoonvegen', () => {
	it('haalt een bekende naam eruit', () => {
		expect(schoon('Bram kon niet opgeslagen worden', ['Bram'])).toBe('[naam] kon niet opgeslagen worden');
	});

	/*
	 * Dit is waarom de langste eerst gaan. Andersom blijft er '[naam]-Jan' staan,
	 * en dat is nog steeds een naam.
	 */
	it('laat geen halve naam achter', () => {
		expect(schoon('Bram-Jan viel om', persoonlijk(toestand()))).toBe('[naam] viel om');
	});

	it('haalt ook een adres eruit dat we niet kennen', () => {
		expect(schoon('mislukt voor iemand@voorbeeld.nl', [])).toBe('mislukt voor [adres]');
	});
});

describe('de tekst die doorgestuurd wordt', () => {
	it('zet elke melding op zijn tijdstip', () => {
		const tekst = issueReport(LOG, toestand());
		expect(tekst).toContain('2026-09-06 14:30:12');
		expect(tekst).toContain('Opslaan lukte niet.');
		expect(tekst).toContain('QuotaExceededError');
	});

	it('zegt het als er niets te melden is', () => {
		expect(issueReport([], toestand())).toContain('Niets gemeld.');
	});

	it('vertelt erbij dat de namen eruit zijn', () => {
		expect(issueReport(LOG, toestand())).toContain('Geen namen');
	});

	it('neemt de versie en het toestel mee', () => {
		const tekst = issueReport(LOG, toestand(), omgevingsregel('Mozilla/5.0 (iPhone) Safari/605', 'abc1234'));
		expect(tekst).toContain('abc1234');
		expect(tekst).toContain('Safari/605');
	});

	/*
	 * De test die ertoe doet. Wat er ook in een foutmelding beland is — van de
	 * browser, van de database — er hoort geen naam van een kind in te staan.
	 */
	it('laat geen enkele naam staan die de app kent', () => {
		const vuil: Issue[] = [
			{ when: '2026-09-06T14:00:00.000Z', what: 'Iets ging mis', message: 'Bram-Jan, Bram en Wessel van JO14-3' },
			{ when: '2026-09-06T14:01:00.000Z', what: 'Nog iets', message: 'tegen Kampong, mail naar tjaco@example.com' }
		];
		const t = toestand();
		const tekst = issueReport(vuil, t);
		for (const naam of persoonlijk(t)) {
			expect(tekst, naam).not.toContain(naam);
		}
		expect(tekst).not.toContain('@example.com');
	});
});

describe('de omgevingsregel', () => {
	it('laat het merk staan en de rest weg', () => {
		const r = omgevingsregel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1', 'a1b2c3d');
		expect(r).toContain('versie a1b2c3d');
		expect(r).toContain('Safari');
		/* wat tussen haakjes stond zegt vooral iets over het toestel van één persoon */
		expect(r).not.toContain('iPhone OS 18_0');
	});
});

/*
 * De mail mag niet halverwege afbreken. Sommige mailprogramma's kappen een lange
 * mailto-link stilletjes af, en dan mis je precies het staartje dat je zocht.
 */
describe('wat er in de mail past', () => {
	it('laat een korte melding met rust', () => {
		const kort = issueReport(LOG, toestand());
		expect(mailInhoud(kort)).toBe(kort);
	});

	it('kort een lange lijst in en zegt dat erbij', () => {
		const veel: Issue[] = Array.from({ length: 20 }, (_, i) => ({
			when: '2026-09-06T14:00:00.000Z',
			what: 'Er ging iets mis, melding nummer ' + i,
			message: 'met een technische regel eronder die ook nog een eind doorloopt'
		}));
		const lang = issueReport(veel, toestand());
		const mail = mailInhoud(lang);
		expect(lang.length).toBeGreaterThan(1600);
		expect(mail.length).toBeLessThan(1600);
		expect(mail).toContain('Ingekort voor de mail');
	});

	it('houdt de kop met de versie erin overeind', () => {
		const veel: Issue[] = Array.from({ length: 20 }, () => ({
			when: '2026-09-06T14:00:00.000Z',
			what: 'Er ging iets mis met een lange omschrijving die doorloopt en doorloopt'
		}));
		const mail = mailInhoud(issueReport(veel, toestand(), omgevingsregel('Safari/605', 'a1b2c3d')));
		expect(mail).toContain('a1b2c3d');
	});

	/* Nooit midden in een regel afbreken: een halve foutmelding leest als een
	   andere fout. */
	it('breekt op een regeleinde af', () => {
		const veel: Issue[] = Array.from({ length: 20 }, () => ({
			when: '2026-09-06T14:00:00.000Z',
			what: 'Er ging iets mis',
			message: 'QuotaExceededError: de opslag zat vol en er kon niets meer bij'
		}));
		const mail = mailInhoud(issueReport(veel, toestand()));
		const regels = mail.split('\n');
		const laatste = regels[regels.length - 3];
		expect(laatste === '' || laatste.endsWith('bij') || laatste.endsWith('mis')).toBe(true);
	});
});
