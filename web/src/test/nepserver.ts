import { vi } from 'vitest';
import type { State } from '$lib/domain/types';
import { alsTabellen, rijen, toestand } from '$lib/supabase/rijen';

/**
 * Een nagebootste Supabase, zo eenvoudig als het kan maar met de regels die
 * ertoe doen: tabellen per team, alleen leden komen erbij, erbij zetten kan
 * bestaande rijen bijwerken of overslaan, en Supabase geeft hooguit duizend
 * rijen per keer.
 *
 * Het toegangsbewijs is het nummer van de gebruiker, dan hoeft er niets te
 * worden nagerekend.
 */
type Rij = Record<string, unknown>;

interface Team {
	id: string;
	naam: string;
	eigenaar: string;
	leden: string[];
}

export interface Verzoek {
	method: string;
	pad: string;
	body: unknown;
}

const DATATABELLEN = [
	'team_instellingen',
	'spelers',
	'wedstrijden',
	'trainingen',
	'wedstrijd_spelers',
	'gebeurtenissen',
	'training_spelers'
];

export function nepServer() {
	const s = {
		teams: [] as Team[],
		tabellen: Object.fromEntries(DATATABELLEN.map((t) => [t, new Map<string, Rij>()])) as Record<
			string,
			Map<string, Rij>
		>,
		/** het oude blok van vóór de tabellen, per team */
		oud: {} as Record<string, { data: unknown; versie: number }>,
		uitnodigingen: [] as { id: string; team_id: string; email: string }[],
		emails: { u1: 'trainer@voorbeeld.nl' } as Record<string, string>,
		/** wie er bij de volgende code inlogt */
		wie: 'u1',
		/** geen bereik */
		stuk: false,
		/** de ploeg en uitnodigingen bestaan nog niet */
		zonderPloeg: false,
		/** laat de server een rij weigeren; geeft de status terug */
		weiger: null as ((method: string, tabel: string, rij: Rij) => number | null) | null,
		log: [] as Verzoek[],
		klok: Date.parse('2026-10-14T12:00:00Z'),

		team(id: string, naam: string, eigenaar = 'u1', leden = [eigenaar]) {
			s.teams.push({ id, naam, eigenaar, leden });
		},

		/** Zet een toestand in de tabellen, zoals de telefoon dat zou doen. */
		vul(team: string, t: State) {
			const tabellen = alsTabellen(rijen(t, team));
			for (const [tabel, lijst] of Object.entries(tabellen)) {
				if (tabel === 'teams') continue;
				for (const r of lijst) s.tabellen[tabel].set(r.id as string, { ...r });
			}
		},

		/** Wat er nu in de tabellen van een team staat, als toestand. */
		toestand(team: string): State | null {
			const t = s.teams.find((x) => x.id === team);
			const tabellen: Record<string, Rij[]> = { teams: t ? [{ id: t.id, naam: t.naam }] : [] };
			for (const tabel of DATATABELLEN) tabellen[tabel] = [...s.tabellen[tabel].values()];
			return toestand(tabellen, team);
		},

		rijenVan(tabel: string, team: string): Rij[] {
			return [...s.tabellen[tabel].values()].filter((r) => (r.team_id ?? r.id) === team);
		},

		/** de verzoeken die iets veranderden */
		schrijfacties(): Verzoek[] {
			return s.log.filter((v) => v.method !== 'GET');
		}
	};

	const antwoord = (data: unknown, status = 200) =>
		new Response(data === undefined ? null : JSON.stringify(data), { status });
	const lidVan = (gebruiker: string, team: unknown) =>
		s.teams.some((t) => t.id === team && t.leden.includes(gebruiker));
	const teamVan = (tabel: string, r: Rij) => (tabel === 'team_instellingen' ? r.id : r.team_id);

	const f = vi.fn(async (url: string, init?: RequestInit) => {
		const u = new URL(url);
		const method = init?.method ?? 'GET';
		const body = init?.body ? JSON.parse(String(init.body)) : null;
		s.log.push({ method, pad: u.pathname + u.search, body });
		if (s.stuk) throw new Error('geen bereik');

		const kop = (init?.headers ?? {}) as Record<string, string>;
		const wie = (kop.Authorization ?? '').replace('Bearer ', '');
		const q = u.searchParams;
		const eq = (k: string) => q.get(k)?.replace(/^eq\./, '');

		/* ---------- inloggen ---------- */
		if (u.pathname === '/auth/v1/otp') return antwoord({});
		if (u.pathname === '/auth/v1/verify' || u.pathname === '/auth/v1/token') {
			const id = u.pathname === '/auth/v1/token' ? (body?.refresh_token ?? s.wie) : s.wie;
			return antwoord({
				access_token: id,
				refresh_token: id,
				expires_in: 3600,
				user: { id, email: s.emails[id] ?? id }
			});
		}
		if (u.pathname === '/auth/v1/user') return antwoord({ id: wie, email: s.emails[wie] ?? wie });

		const pad = u.pathname.replace('/rest/v1/', '');

		/* ---------- teams ---------- */
		if (pad === 'teams') {
			if (method === 'GET') {
				let lijst = s.teams.filter((t) => t.leden.includes(wie));
				const ids = q.get('id');
				if (ids?.startsWith('in.(')) {
					const gevraagd = ids.slice(4, -1).split(',');
					/* een uitgenodigde ziet de naam van het team */
					lijst = s.teams.filter((t) => gevraagd.includes(t.id));
				} else if (ids) lijst = lijst.filter((t) => t.id === eq('id'));
				return antwoord(lijst.map((t) => ({ id: t.id, naam: t.naam })));
			}
			if (method === 'POST') {
				const lijst = Array.isArray(body) ? body : [body];
				const gemaakt = lijst.map((r: Rij) => {
					const bestaand = s.teams.find((t) => t.id === r.id);
					if (bestaand) return bestaand;
					const t = {
						id: (r.id as string) ?? 'team-' + (s.teams.length + 1),
						naam: r.naam as string,
						eigenaar: wie,
						leden: [wie]
					};
					s.teams.push(t);
					return t;
				});
				return antwoord(
					gemaakt.map((t) => ({ id: t.id })),
					201
				);
			}
			if (method === 'PATCH') {
				/* Alleen de eigenaar; voor een ander werkt het niets bij, zonder fout. */
				const t = s.teams.find((x) => x.id === eq('id') && x.eigenaar === wie);
				if (t && typeof body?.naam === 'string') t.naam = body.naam;
				return antwoord(undefined, 204);
			}
		}

		/* ---------- de ploeg ---------- */
		if (pad === 'team_leden' || pad === 'uitnodigingen') {
			if (s.zonderPloeg) return antwoord({ code: '42P01', message: 'relation does not exist' }, 404);
			if (pad === 'team_leden') {
				const t = s.teams.find((x) => x.id === eq('team_id'));
				return antwoord(
					(t?.leden ?? []).map((g) => ({ gebruiker: g, rol: g === t?.eigenaar ? 'eigenaar' : 'trainer' }))
				);
			}
			if (method === 'GET') {
				const team = eq('team_id');
				return antwoord(s.uitnodigingen.filter((x) => (team ? x.team_id === team : x.email === s.emails[wie])));
			}
			return antwoord(undefined, 201);
		}
		if (pad === 'rpc/uitnodiging_aannemen') {
			const mijn = s.uitnodigingen.filter((x) => x.email === s.emails[wie]);
			for (const x of mijn) s.teams.find((t) => t.id === x.team_id)?.leden.push(wie);
			s.uitnodigingen = s.uitnodigingen.filter((x) => !mijn.includes(x));
			return antwoord(mijn.map((x) => x.team_id));
		}

		/* ---------- het oude blok ---------- */
		if (pad === 'team_toestand') {
			const team = eq('team_id');
			const d = team && lidVan(wie, team) ? s.oud[team] : undefined;
			return antwoord(d ? [d] : []);
		}

		/* ---------- de tabellen ---------- */
		const tabel = s.tabellen[pad];
		if (!tabel) return antwoord({ message: 'onbekend pad ' + pad }, 404);

		if (method === 'GET') {
			const team = eq('team_id') ?? eq('id');
			if (!lidVan(wie, team)) return antwoord([]);
			const lijst = [...tabel.values()]
				.filter((r) => teamVan(pad, r) === team)
				.sort((a, b) => String(a.id).localeCompare(String(b.id)));
			const limit = Number(q.get('limit') ?? 1000);
			const offset = Number(q.get('offset') ?? 0);
			return antwoord(lijst.slice(offset, offset + Math.min(limit, 1000)));
		}
		if (method === 'POST') {
			const lijst = (Array.isArray(body) ? body : [body]) as Rij[];
			/* Alles of niets, zoals een verzoek aan de database. */
			for (const r of lijst) {
				if (!lidVan(wie, teamVan(pad, r))) return antwoord({ code: '42501', message: 'row-level security' }, 403);
				const st = s.weiger?.('POST', pad, r);
				if (st) return antwoord({ message: 'geweigerd' }, st);
			}
			const negeren = (kop.Prefer ?? '').includes('ignore-duplicates');
			for (const r of lijst) {
				const bestaand = tabel.get(r.id as string);
				if (bestaand && negeren) continue;
				tabel.set(r.id as string, { ...(bestaand ?? {}), ...r });
			}
			return antwoord(undefined, 201);
		}
		if (method === 'PATCH') {
			const r = tabel.get(eq('id') ?? '');
			if (r && lidVan(wie, teamVan(pad, r))) {
				const st = s.weiger?.('PATCH', pad, r);
				if (st) return antwoord({ message: 'geweigerd' }, st);
				Object.assign(r, body);
			}
			return antwoord(undefined, 204);
		}
		if (method === 'DELETE') {
			const ids = (q.get('id') ?? '').replace(/^in\.\(|\)$/g, '').split(',');
			for (const id of ids) {
				const r = tabel.get(id);
				if (r && lidVan(wie, teamVan(pad, r))) tabel.delete(id);
			}
			return antwoord(undefined, 204);
		}
		return antwoord({ message: 'niet nagebootst' }, 500);
	});
	globalThis.fetch = f as unknown as typeof fetch;
	return Object.assign(s, { f });
}
