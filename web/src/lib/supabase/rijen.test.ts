import { describe, expect, it } from 'vitest';
import { emptyState, type State } from '$lib/domain/types';
import { migreerToestand } from '$lib/domain/migrate-storage';
import { JA_NEE, JSON_KOLOMMEN, alsTabellen, moment, rijen, toestand, uuid, verschil, vulKenmerkenAan } from './rijen';
import { sha256 } from './sha256';
import gedeeld from '../../../../ios/BlaadjeKern/Tests/BlaadjeKernTests/Fixtures/rijen-gedeeld.json';

/*
 * De iPhone-app schrijft voor twee toestanden zijn rijen weg
 * (`SyncTests.deRijenStaanVoorDeWebappKlaar`). Het web moet daar letter voor
 * letter op uitkomen: dezelfde kenmerken, dezelfde waarden. Anders zien de twee
 * elkaars wedstrijden als nieuwe en staat alles dubbel.
 */
interface Geval {
	naam: string;
	team: string;
	invoer: unknown;
	rijen: { tabel: string; id: string; kolommen: Record<string, string | number | null> }[];
}
const gevallen = gedeeld as unknown as Geval[];

function lees(invoer: unknown): State {
	return { ...emptyState(), ...(migreerToestand(structuredClone(invoer)) as Partial<State>) };
}

/** Een rij van het web zoals de telefoon hem op zijn toestel zet: 0 of 1, JSON als tekst. */
function zoalsDeTelefoon(kolommen: Record<string, unknown>) {
	return Object.fromEntries(Object.entries(kolommen).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 1 : 0) : v]));
}

describe('dezelfde rijen als de iPhone-app', () => {
	for (const g of gevallen) {
		it(`maakt voor "${g.naam}" precies dezelfde rijen`, () => {
			const hier = rijen(lees(g.invoer), g.team);
			expect(hier.map((r) => r.tabel + '/' + r.id)).toEqual(g.rijen.map((r) => r.tabel + '/' + r.id));
			hier.forEach((r, i) => {
				const daar = g.rijen[i].kolommen;
				expect(Object.keys(r.kolommen).sort()).toEqual(Object.keys(daar).sort());
				for (const [k, v] of Object.entries(r.kolommen)) {
					const ander = daar[k];
					if (JSON_KOLOMMEN.has(k)) {
						expect(v, `${r.tabel}.${k}`).toEqual(typeof ander === 'string' ? JSON.parse(ander) : ander);
					} else if (JA_NEE.has(k)) {
						expect(v ? 1 : 0, `${r.tabel}.${k}`).toBe(ander);
					} else {
						expect(v, `${r.tabel}.${k}`).toBe(ander);
					}
				}
			});
		});

		it(`leest de rijen van de telefoon voor "${g.naam}" terug`, () => {
			const vanTelefoon = alsTabellen(g.rijen.map((r) => ({ tabel: r.tabel, id: r.id, kolommen: r.kolommen })));
			const vanWeb = alsTabellen(rijen(lees(g.invoer), g.team));
			const a = toestand(vanTelefoon, g.team)!;
			const b = toestand(
				Object.fromEntries(Object.entries(vanWeb).map(([t, l]) => [t, l.map(zoalsDeTelefoon)])),
				g.team
			)!;
			expect(a).toEqual(b);
			expect(verschil(rijen(a, g.team), rijen(b, g.team))).toEqual([]);
		});
	}
});

describe('heen en terug', () => {
	const g = gevallen[0];

	it('verandert na één keer heen en terug niets meer', () => {
		const eerst = toestand(alsTabellen(rijen(lees(g.invoer), g.team)), g.team)!;
		const daarna = toestand(alsTabellen(rijen(eerst, g.team)), g.team)!;
		expect(daarna).toEqual(eerst);
		expect(verschil(rijen(eerst, g.team), rijen(daarna, g.team))).toEqual([]);
	});

	it('houdt de selectie, de wedstrijd en het archief', () => {
		const voor = lees(g.invoer);
		const na = toestand(alsTabellen(rijen(voor, g.team)), g.team)!;
		expect(na.players.map((p) => p.name)).toEqual(voor.players.map((p) => p.name));
		expect(na.archive.map((a) => a.score)).toEqual(voor.archive.map((a) => a.score));
		expect(na.match?.opponent).toBe(voor.match?.opponent);
		expect(na.match?.plan?.length).toBe(1);
		expect(na.trainings.length).toBe(voor.trainings.length);
	});

	it('maakt van een tik een klein verschil', () => {
		const t = toestand(alsTabellen(rijen(lees(g.invoer), g.team)), g.team)!;
		const voor = rijen(t, g.team);
		t.players[0].name = 'Sem B.';
		const v = verschil(voor, rijen(t, g.team));
		/* de speler zelf, en zijn naam bij de wedstrijd die nog loopt */
		expect(v.map((w) => w.soort + ' ' + ('tabel' in w ? w.tabel : w.rij.tabel))).toEqual([
			'bij spelers',
			'bij wedstrijd_spelers'
		]);
	});

	it('haalt weg wat er niet meer is, eerst wat ernaar wijst', () => {
		const t = toestand(alsTabellen(rijen(lees(g.invoer), g.team)), g.team)!;
		const voor = rijen(t, g.team);
		t.trainings = t.trainings.slice(1);
		const v = verschil(voor, rijen(t, g.team));
		expect(v.every((w) => w.soort === 'weg')).toBe(true);
		const tabellen = v.map((w) => ('tabel' in w ? w.tabel : ''));
		expect(tabellen.lastIndexOf('training_spelers')).toBeLessThan(tabellen.indexOf('trainingen'));
	});

	it('ziet niets van een ander team', () => {
		expect(toestand({}, g.team)).toBeNull();
		const ander = alsTabellen(rijen(lees(g.invoer), '22222222-2222-4222-8222-222222222222'));
		expect(toestand(ander, g.team)).toBeNull();
	});
});

describe('kenmerken', () => {
	it('rekent SHA-256 goed uit', () => {
		const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
		expect(hex(sha256(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		expect(hex(sha256('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
		/* langer dan één blok, en met letters buiten ASCII */
		expect(hex(sha256('é'.repeat(40)))).toBe(hex(sha256('é'.repeat(40))));
		expect(sha256('x'.repeat(200))).toHaveLength(32);
	});

	it('laat een uuid staan en maakt van een kort kenmerk altijd dezelfde', () => {
		const team = '11111111-1111-4111-8111-111111111111';
		expect(uuid('ABCDEF12-3456-4789-8ABC-DEF123456789', team)).toBe('abcdef12-3456-4789-8abc-def123456789');
		expect(uuid('p1', team)).toBe(uuid('p1', team));
		expect(uuid('p1', team)).not.toBe(uuid('p1', '22222222-2222-4222-8222-222222222222'));
		expect(uuid('p1', team)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it('geeft een wedstrijd zonder kenmerk er een', () => {
		const t = lees(gevallen[1].invoer);
		t.archive.forEach((a) => delete a.id);
		let n = 0;
		expect(vulKenmerkenAan(t, () => 'k' + ++n)).toBe(true);
		expect(t.archive.every((a) => a.id)).toBe(true);
		expect(vulKenmerkenAan(t)).toBe(false);
	});

	it('vergelijkt tijdstippen van de server en van het toestel', () => {
		expect(moment('2026-10-13 21:00:00.123456+00') < moment('2026-10-13T21:00:00.124Z')).toBe(true);
		expect(moment('2026-10-13T21:00:00Z') < moment('2026-10-13T21:00:00.001+00:00')).toBe(true);
		expect(moment(null)).toBe('');
	});
});
