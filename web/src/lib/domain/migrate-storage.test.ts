import { describe, expect, it } from 'vitest';
import { isOudFormaat, migreerToestand } from './migrate-storage';
import opgeslagen from '../../test/opslag-september-2026.json';

/**
 * De omzetting draait op een echte export van een echt seizoen. Dat is de enige
 * manier om te weten dat hij klopt: een zelfgemaakt voorbeeld bevat precies de
 * gevallen waar je aan dacht, en een echte opslag bevat de rest.
 */
describe('oude opslag omzetten', () => {
	const om = migreerToestand(opgeslagen) as Record<string, never>;

	it('herkent het oude formaat, en het nieuwe niet als oud', () => {
		expect(isOudFormaat(opgeslagen)).toBe(true);
		expect(isOudFormaat(om)).toBe(false);
		expect(isOudFormaat(null)).toBe(false);
	});

	it('zet de velden van de toestand om', () => {
		expect(om.teamName).toBe('JO13-1');
		expect(Array.isArray(om.players)).toBe(true);
		expect(Array.isArray(om.archive)).toBe(true);
		expect(om).not.toHaveProperty('teamnaam');
		expect(om).not.toHaveProperty('spelers');
	});

	it('laat geen enkele Nederlandse veldnaam achter', () => {
		const nederlands = [
			'teamnaam',
			'spelers',
			'formatie',
			'helftMinuten',
			'delen',
			'wedstrijd',
			'standaard',
			'archief',
			'trainingen',
			'verslagWissels',
			'naam',
			'linie',
			'keept',
			'datum',
			'tegenstander',
			'thuis',
			'opstelling',
			'bank',
			'gebeurtenissen',
			'verstreken',
			'sinds',
			'loopt',
			'deel',
			'pauze',
			'afgelopen',
			'notitie',
			'bewaard',
			'afwezig',
			'speler',
			'eruit',
			'erin',
			'plek',
			'plekA',
			'plekB',
			'spelerA',
			'spelerB',
			'stand',
			'duur',
			'namen',
			'speeltijd',
			'seconden',
			'posities'
		];
		const gevonden = new Set<string>();
		(function loop(x: unknown) {
			if (Array.isArray(x)) return x.forEach(loop);
			if (x && typeof x === 'object') {
				for (const [k, v] of Object.entries(x)) {
					if (nederlands.includes(k)) gevonden.add(k);
					loop(v);
				}
			}
		})(om);
		expect([...gevonden]).toEqual([]);
	});

	it('zet ook de waarden om die als tekst zijn opgeslagen', () => {
		const match = (om.archive as unknown as Record<string, never>[])[0];
		const soorten = new Set((match.events as unknown as { type: string }[]).map((g) => g.type));
		expect(soorten.has('rust')).toBe(false);
		expect(soorten.has('wissel')).toBe(false);
		expect(soorten.has('ruil')).toBe(false);
		expect(soorten.has('break')).toBe(true);
		expect(soorten.has('substitution')).toBe(true);
		expect(soorten.has('swap')).toBe(true);
		expect(match.formation).toBe('4-4-2 diamond');
	});

	it('hernoemt de enige plek met een Nederlandse code', () => {
		const match = (om.archive as unknown as Record<string, never>[])[0];
		const plekken = Object.keys(match.lineup as unknown as Record<string, string>);
		expect(plekken).toContain('TEN');
		expect(plekken).not.toContain('TIEN');
		const positions = (match.playingTime as unknown as { positions: Record<string, number> }[]).flatMap((r) =>
			Object.keys(r.positions ?? {})
		);
		expect(positions).not.toContain('TIEN');
	});

	it('houdt de cijfers precies gelijk', () => {
		/* De linkerkant leest het ruwe bestand, dus die velden heten nog Nederlands. */
		const oud = (opgeslagen as unknown as { archief: Record<string, never>[] }).archief[0];
		const nieuw = (om.archive as unknown as Record<string, never>[])[0];
		expect(nieuw.duration).toBe(oud.duur);
		expect(nieuw.score).toEqual(oud.stand);
		expect((nieuw.events as unknown[]).length).toBe((oud.gebeurtenissen as unknown[]).length);
		const somNieuw = (r: { seconds: number }[]) => r.reduce((s, x) => s + x.seconds, 0);
		const somOud = (r: { seconden: number }[]) => r.reduce((s, x) => s + x.seconden, 0);
		expect(somNieuw(nieuw.playingTime as never)).toBe(somOud(oud.speeltijd as never));
	});

	it('zet de aanwezigheid op een training om', () => {
		const met = JSON.parse(JSON.stringify(opgeslagen));
		met.trainings = [{ id: 't1', date: '2026-09-01', status: { p1: 'ja', p2: 'af', p3: 'nee' } }];
		const uit = migreerToestand(met) as Record<string, never>;
		const t = (uit.trainings as unknown as { status: Record<string, string> }[])[0];
		expect(t.status).toEqual({ p1: 'present', p2: 'excused', p3: 'absent' });
	});

	it('laat iets wat al omgezet is met rust', () => {
		expect(migreerToestand(om)).toBe(om);
	});
});
