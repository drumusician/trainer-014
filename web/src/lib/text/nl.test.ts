import { describe, expect, it } from 'vitest';
import { text } from './nl';

/*
 * Het woordenboek is een datafile, maar de helft ervan zijn functies: zinnen met
 * een naam, een aantal of een tijd erin. Zo'n zin komt pas tot leven als hij
 * uitgerekend wordt, en dan pas zie je of er 'undefined' of 'NaN' in staat. Deze
 * test loopt ze allemaal één keer af.
 */

type Tak = { pad: string; waarde: unknown };

function alles(o: unknown, pad = ''): Tak[] {
	if (o && typeof o === 'object' && !Array.isArray(o)) {
		return Object.entries(o).flatMap(([k, v]) => alles(v, pad ? pad + '.' + k : k));
	}
	return [{ pad, waarde: o }];
}

const takken = alles(text);
const zinnen = takken.filter((t) => typeof t.waarde === 'string');
const sjablonen = takken.filter((t) => typeof t.waarde === 'function');

describe('het woordenboek', () => {
	it('bevat de hele app', () => {
		expect(takken.length).toBeGreaterThan(150);
		expect(sjablonen.length).toBeGreaterThan(20);
	});

	it('heeft nergens een lege zin staan', () => {
		for (const { pad, waarde } of zinnen) {
			expect(String(waarde).trim(), pad).not.toBe('');
		}
	});

	/*
	 * Elke zin met een gat erin één keer invullen. Een 1 werkt als naam én als
	 * aantal, dus alle sjablonen kunnen langs dezelfde meetlat.
	 */
	it('vult elk gat in zonder undefined of NaN', () => {
		for (const { pad, waarde } of sjablonen) {
			const fn = waarde as (...a: unknown[]) => unknown;
			const uit = String(fn(...Array.from({ length: Math.max(fn.length, 1) }, () => 1)));
			expect(uit.trim(), pad).not.toBe('');
			for (const rommel of ['undefined', 'NaN', '[object Object]']) {
				expect(uit, pad).not.toContain(rommel);
			}
		}
	});

	/*
	 * Bij de hernoeming naar het Engels lekten er woorden de Nederlandse teksten
	 * in — drie rondes lang, omdat elke reparatie te smal was. Dit is de vangnet
	 * die dat voortaan meteen laat zien.
	 */
	it('is Nederlands', () => {
		/* Alleen woorden die in het Nederlands niet bestaan. 'start', 'keeper',
		   'team' en 'training' zijn hier gewoon Nederlands en horen er dus niet in. */
		const engels =
			/\b(player|players|match|matches|lineup|bench|substitution|substitutions|position|positions|attendance|season|settings|cancel|delete|opponent|squad|played|minutes|goals)\b/i;
		const uitzonderingen = new Set(['landing.email']);
		for (const { pad, waarde } of zinnen) {
			if (uitzonderingen.has(pad)) continue;
			const gevonden = String(waarde).match(engels);
			expect(gevonden?.[0] ?? null, pad + ': ' + waarde).toBeNull();
		}
	});
});
