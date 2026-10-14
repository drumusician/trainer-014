import type {
	ArchivedMatch,
	Attendance,
	Lineup,
	Match,
	MatchEvent,
	MatchEventType,
	PlannedSub,
	Player,
	ScheduledMatch,
	State,
	TaskKind,
	TeamTask,
	Training
} from '$lib/domain/types';
import { emptyState } from '$lib/domain/types';
import { kickedOff } from '$lib/actions/clock';
import { score } from '$lib/domain/time';
import { sha256 } from './sha256';

/**
 * De toestand van de app als rijen in tabellen, en terug.
 *
 * Dezelfde vertaling als in de iPhone-app (`ios/BlaadjeKern/.../Sync/Rijen.swift`),
 * regel voor regel. Dat moet: allebei schrijven ze in dezelfde tabellen, en een
 * rij is alleen dezelfde rij als het kenmerk precies klopt. Zou het web een
 * wedstrijd een ander kenmerk geven dan de telefoon, dan staat hij er twee keer.
 * `rijen.test.ts` legt de uitkomst naast die van de iPhone-app.
 *
 * Eén verschil met de telefoon: daar is ja/nee 0 of 1 en JSON een tekst, omdat
 * het toestel een SQLite-database heeft. Hier zijn het gewoon ja/nee en
 * objecten, zoals de server ze ook terugstuurt.
 */

export type Waarde = string | number | boolean | null | unknown[] | Record<string, unknown>;

export interface Rij {
	tabel: string;
	id: string;
	kolommen: Record<string, Waarde>;
}

export type Wijziging =
	| { soort: 'erbij'; rij: Rij }
	/** alleen de kolommen die veranderden: op de server wint per veld de laatste */
	| { soort: 'bij'; tabel: string; id: string; kolommen: Record<string, Waarde> }
	| { soort: 'weg'; tabel: string; id: string };

/** De tabellen, in de volgorde waarin rijen erbij moeten: eerst waar andere naar verwijzen. */
export const TABELLEN = [
	'teams',
	'team_instellingen',
	'spelers',
	'wedstrijden',
	'trainingen',
	'wedstrijd_spelers',
	'gebeurtenissen',
	'training_spelers',
	'taken'
] as const;

/** Tabellen waarvan de volgorde telt; die krijgen bij het wegschrijven een tijdstip. */
export const MET_VOLGORDE = new Set(['spelers', 'wedstrijden', 'trainingen', 'gebeurtenissen', 'taken']);

/** Kolommen die op de server JSON zijn, en die met ja of nee. */
export const JSON_KOLOMMEN = new Set(['standaardopstelling', 'klok', 'opstelling', 'bank', 'wisselplan', 'posities']);
export const JA_NEE = new Set(['keept', 'thuis', 'aanwezig', 'verslag_met_wissels']);

/** Staat voor 'nu' in `spelers.weg`: wie het wegschrijft vult het tijdstip in. */
export const NU = 'NU';

const gevuld = (s: string | null | undefined): string | null => (s ? s : null);

/* ---------------------------------------------------------------- kenmerken */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * De server wil een uuid. Wat er al een is blijft staan; de korte kenmerken van
 * vroeger ('p1', 'tm2x9...') worden er altijd dezelfde, per team.
 */
export function uuid(kenmerk: string, team: string): string {
	if (UUID.test(kenmerk)) return kenmerk.toLowerCase();
	const b = sha256(team + '|' + kenmerk).slice(0, 16);
	b[6] = (b[6] & 0x0f) | 0x50;
	b[8] = (b[8] & 0x3f) | 0x80;
	const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
	return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

/** Een wedstrijd heeft een vast kenmerk nodig, ook als de opslag van vroeger is. */
export function vulKenmerkenAan(t: State, nieuwId: () => string = () => crypto.randomUUID()): boolean {
	let veranderd = false;
	if (t.match && !t.match.id) {
		t.match.id = nieuwId();
		veranderd = true;
	}
	for (const a of t.archive) {
		if (!a.id) {
			a.id = nieuwId();
			veranderd = true;
		}
	}
	return veranderd;
}

/* ---------------------------------------------------- van toestand naar rijen */

export function rijen(t: State, team: string): Rij[] {
	const m = (id: string) => uuid(id, team);
	const ref = (id: string | null | undefined): Waarde => (id ? m(id) : null);
	const opstelling = (l: Lineup) => Object.entries(l).map(([plek, p]) => [plek, p ? m(p) : null]);
	const lijst = (ids: string[]) => ids.map(m);

	const perTabel = new Map<string, Rij[]>();
	const zet = (tabel: string, id: string, kolommen: Record<string, Waarde>) => {
		if (!perTabel.has(tabel)) perTabel.set(tabel, []);
		perTabel.get(tabel)!.push({ tabel, id, kolommen });
	};

	zet('teams', team, { naam: knip(t.teamName, 60, 'Mijn team') });
	zet('team_instellingen', team, {
		formatie: knip(t.formation, 20),
		delen: t.parts === 4 ? 4 : 2,
		minuten_per_deel: minuten(t.minutesPerPart),
		verslag_met_wissels: !!t.reportSubs,
		standaardopstelling: t.defaultLineup
			? {
					formation: t.defaultLineup.formation,
					lineup: opstelling(t.defaultLineup.lineup),
					bench: lijst(t.defaultLineup.bench)
				}
			: null
	});

	/* Spelers: wie er nu is, en daarna wie alleen nog in oude wedstrijden of
	   trainingen voorkomt. Die laatsten bestaan op de server wél, met `weg`
	   gezet: anders wijst een wedstrijd naar een speler die er niet is. */
	const bekend = new Set<string>();
	for (const p of t.players) {
		const id = m(p.id);
		if (bekend.has(id)) continue;
		bekend.add(id);
		zet('spelers', id, {
			team_id: team,
			naam: knip(p.name, 60, '?'),
			linie: p.line ?? '',
			keept: p.keeper === true,
			weg: null
		});
	}
	const vroeger = new Map<string, string>();
	const noem = (id: string | null | undefined, naam: string | null | undefined) => {
		if (!id) return;
		const u = m(id);
		if (bekend.has(u)) return;
		if (naam) vroeger.set(u, naam);
		else if (!vroeger.has(u)) vroeger.set(u, 'Oud-speler');
	};
	const betrokken = (g: MatchEvent) => [g.player, g.assist, g.on, g.off, g.playerA, g.playerB];
	for (const a of t.archive) {
		for (const r of a.playingTime) noem(r.id || 'naam:' + r.name, r.name);
		for (const id of a.absent ?? []) noem(id, a.names?.[id]);
		for (const g of a.events) for (const id of betrokken(g)) noem(id, id ? a.names?.[id] : null);
	}
	for (const tr of t.trainings) for (const id of Object.keys(tr.status)) noem(id, null);
	for (const taak of t.tasks ?? []) {
		noem(taak.player, null);
		noem(taak.declinedBy, null);
	}
	if (t.match && t.match.archived !== true) {
		for (const g of t.match.events) for (const id of betrokken(g)) noem(id, null);
	}
	for (const [id, naam] of vroeger) {
		zet('spelers', id, {
			team_id: team,
			naam: knip(naam, 60, 'Oud-speler'),
			linie: '',
			keept: false,
			weg: NU
		});
	}

	const gebeurtenissen = (events: MatchEvent[], wid: string) => {
		const gezien = new Map<string, number>();
		for (const g of events) {
			const ruil = g.type === 'swap';
			const plek = ruil ? g.positionA : g.position;
			const kolommen: Record<string, Waarde> = {
				team_id: team,
				wedstrijd_id: wid,
				soort: SOORT[g.type],
				t: Math.max(0, rond(g.t)),
				deel: g.part !== undefined && g.part !== null && g.part >= 1 && g.part <= 4 ? g.part : null,
				speler: ref(ruil ? g.playerA : g.player),
				assist: ref(g.assist),
				erin: ref(g.on),
				eruit: ref(g.off),
				positie: plek !== undefined && plek !== null ? knip(plek, 10) : null,
				positie_b: g.positionB !== undefined && g.positionB !== null ? knip(g.positionB, 10) : null,
				speler_b: ref(g.playerB)
			};
			/* Het kenmerk volgt uit de inhoud. Een gebeurtenis kun je op de server
			   niet wijzigen, alleen erbij zetten en weghalen; verandert er iets (een
			   assist erbij), dan is het een andere rij. */
			const inhoud = Object.keys(kolommen)
				.sort()
				.map((k) => k + '=' + alsCel(kolommen[k]))
				.join(';');
			const keer = gezien.get(inhoud) ?? 0;
			gezien.set(inhoud, keer + 1);
			zet('gebeurtenissen', uuid('gebeurtenis|' + inhoud + '|' + keer, team), kolommen);
		}
	};

	const w = t.match;
	if (w && w.archived !== true) {
		const wid = m(w.id || 'wedstrijd-van-nu');
		const [voor, tegen] = score(w);
		const klok: Record<string, Waarde> = {
			elapsed: w.elapsed,
			since: w.since ?? null,
			running: w.running,
			part: w.part,
			inBreak: w.inBreak,
			finished: w.finished
		};
		if (w.keptBy !== undefined && w.keptBy !== null) klok.keptBy = w.keptBy;
		if (w.fromProgram === true) klok.uitProgramma = true;
		zet('wedstrijden', wid, {
			team_id: team,
			datum: datum(w.date),
			tegenstander: knip(w.opponent, 80),
			thuis: !!w.home,
			status: kickedOff(w) ? 'bezig' : 'gepland',
			formatie: knip(w.formation, 20),
			delen: w.parts === 4 ? 4 : 2,
			minuten_per_deel: minuten(t.minutesPerPart),
			doelpunten_voor: voor,
			doelpunten_tegen: tegen,
			duur: 0,
			teamnaam: null,
			notitie: w.note !== undefined && w.note !== null ? knip(w.note, 4000) : null,
			klok,
			opstelling: opstelling(w.lineup),
			bank: lijst(w.bench),
			wisselplan: w.plan ? w.plan.map((s) => planAlsJson({ ...s, on: m(s.on), off: m(s.off) })) : null,
			aanvang: aanvang(w.time)
		});
		const afwezig = new Set((w.absent ?? []).map(m));
		for (const p of t.players) {
			const pid = m(p.id);
			zet('wedstrijd_spelers', uuid('ws|' + wid + '|' + pid, team), {
				team_id: team,
				wedstrijd_id: wid,
				speler_id: pid,
				naam: knip(p.name, 60, '?'),
				aanwezig: !afwezig.has(pid),
				seconden: 0,
				keeper_seconden: 0,
				posities: null
			});
		}
		gebeurtenissen(w.events, wid);
	}

	t.archive.forEach((a, i) => {
		const wid = m(a.id || 'bewaard-' + i + '-' + a.date + '-' + a.opponent);
		zet('wedstrijden', wid, {
			team_id: team,
			datum: datum(a.date),
			tegenstander: knip(a.opponent, 80),
			thuis: !!a.home,
			status: 'afgelopen',
			formatie: knip(a.formation, 20),
			delen: a.parts === 4 ? 4 : 2,
			minuten_per_deel: minuten(t.minutesPerPart),
			doelpunten_voor: Math.max(0, a.score[0]),
			doelpunten_tegen: Math.max(0, a.score[1]),
			duur: Math.max(0, rond(a.duration)),
			teamnaam: a.teamName !== undefined && a.teamName !== null ? knip(a.teamName, 60) : null,
			notitie: a.note !== undefined && a.note !== null ? knip(a.note, 4000) : null,
			klok: null,
			opstelling: a.lineup ? opstelling(a.lineup) : null,
			bank: a.bench ? lijst(a.bench) : null,
			wisselplan: null,
			aanvang: null
		});
		const afwezig = new Set((a.absent ?? []).map(m));
		const gehad = new Set<string>();
		for (const r of a.playingTime) {
			const pid = m(r.id || 'naam:' + r.name);
			if (gehad.has(pid)) continue;
			gehad.add(pid);
			zet('wedstrijd_spelers', uuid('ws|' + wid + '|' + pid, team), {
				team_id: team,
				wedstrijd_id: wid,
				speler_id: pid,
				naam: knip(r.name, 60, '?'),
				aanwezig: !afwezig.has(pid),
				seconden: Math.max(0, rond(r.seconds)),
				keeper_seconden: Math.max(0, rond(r.keeper ?? 0)),
				posities: r.positions ? Object.entries(r.positions).map(([plek, sec]) => [plek, sec]) : null
			});
		}
		for (const id of a.absent ?? []) {
			const pid = m(id);
			if (gehad.has(pid)) continue;
			gehad.add(pid);
			zet('wedstrijd_spelers', uuid('ws|' + wid + '|' + pid, team), {
				team_id: team,
				wedstrijd_id: wid,
				speler_id: pid,
				naam: knip(a.names?.[id] ?? t.players.find((p) => p.id === id)?.name ?? '', 60, '?'),
				aanwezig: false,
				seconden: 0,
				keeper_seconden: 0,
				posities: null
			});
		}
		gebeurtenissen(a.events, wid);
	});

	/* Het programma: wat er nog komt. Geen klok, en daaraan is hij te herkennen. */
	const wedstrijdIds = new Set((perTabel.get('wedstrijden') ?? []).map((r) => r.id));
	for (const p of t.program ?? []) {
		const wid = m(p.id);
		if (wedstrijdIds.has(wid)) continue;
		wedstrijdIds.add(wid);
		zet('wedstrijden', wid, {
			team_id: team,
			datum: datum(p.date),
			tegenstander: knip(p.opponent, 80),
			thuis: !!p.home,
			status: 'gepland',
			formatie: knip(t.formation, 20),
			delen: t.parts === 4 ? 4 : 2,
			minuten_per_deel: minuten(t.minutesPerPart),
			doelpunten_voor: 0,
			doelpunten_tegen: 0,
			duur: 0,
			teamnaam: null,
			notitie: null,
			klok: null,
			opstelling: null,
			bank: null,
			wisselplan: null,
			aanvang: aanvang(p.time)
		});
	}

	const trainingGehad = new Set<string>();
	for (const tr of t.trainings) {
		const tid = m(tr.id);
		if (trainingGehad.has(tid)) continue;
		trainingGehad.add(tid);
		zet('trainingen', tid, { team_id: team, datum: datum(tr.date) });
		for (const [id, st] of Object.entries(tr.status)) {
			const pid = m(id);
			zet('training_spelers', uuid('ts|' + tid + '|' + pid, team), {
				team_id: team,
				training_id: tid,
				speler_id: pid,
				status: st === 'present' ? 'aanwezig' : st === 'excused' ? 'afgemeld' : 'afwezig'
			});
		}
	}

	/* Taken, alleen bij een wedstrijd die er is: anders weigert de server ze. */
	const taakGehad = new Set<string>();
	for (const taak of t.tasks ?? []) {
		const wid = m(taak.matchId);
		const id = m(taak.id);
		if (!wedstrijdIds.has(wid) || taakGehad.has(id)) continue;
		taakGehad.add(id);
		zet('taken', id, {
			team_id: team,
			wedstrijd_id: wid,
			soort: taak.kind,
			speler_id: ref(taak.player),
			afgemeld_door: ref(taak.declinedBy)
		});
	}

	return TABELLEN.flatMap((tabel) => perTabel.get(tabel) ?? []);
}

/* -------------------------------------------------------- wat veranderde er */

/** Twee waarden uit een rij gelijk? JSON vergelijken we als tekst: beide kanten komen hier vandaan. */
export function zelfde(a: Waarde | undefined, b: Waarde | undefined): boolean {
	if (a === b) return true;
	if (a === null || b === null || a === undefined || b === undefined) return false;
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Wat er moet gebeuren om van de ene stand naar de andere te komen. Erbij en
 * bijwerken in de volgorde van de tabellen, weghalen andersom, zodat een rij er
 * altijd is voordat iets ernaar wijst.
 */
export function verschil(oud: Rij[], nieuw: Rij[]): Wijziging[] {
	const sleutel = (r: { tabel: string; id: string }) => r.tabel + '/' + r.id;
	const was = new Map<string, Rij>();
	for (const r of oud) if (!was.has(sleutel(r))) was.set(sleutel(r), r);
	const wordt = new Set(nieuw.map(sleutel));
	const uit: Wijziging[] = [];
	for (const r of nieuw) {
		const vorige = was.get(sleutel(r));
		if (!vorige) {
			uit.push({ soort: 'erbij', rij: r });
			continue;
		}
		const anders: Record<string, Waarde> = {};
		let iets = false;
		for (const [k, v] of Object.entries(r.kolommen)) {
			if (!zelfde(vorige.kolommen[k], v)) {
				anders[k] = v;
				iets = true;
			}
		}
		if (iets) uit.push({ soort: 'bij', tabel: r.tabel, id: r.id, kolommen: anders });
	}
	for (const tabel of [...TABELLEN].reverse()) {
		for (const r of oud) {
			if (r.tabel === tabel && !wordt.has(sleutel(r))) uit.push({ soort: 'weg', tabel: r.tabel, id: r.id });
		}
	}
	return uit;
}

/**
 * De rijen zoals ze in de tabellen zouden staan, voor wie zonder server heen en
 * terug wil: elke rij krijgt zijn `id` als kolom, en een tijdstip in de volgorde
 * waarin hij langskwam.
 */
export function alsTabellen(lijst: Rij[]): Record<string, Record<string, unknown>[]> {
	const uit: Record<string, Record<string, unknown>[]> = {};
	lijst.forEach((r, i) => {
		const k: Record<string, unknown> = { ...r.kolommen, id: r.id };
		if (MET_VOLGORDE.has(r.tabel)) k.gemaakt = tijdstip(946_684_800, i);
		if (k.weg === NU) k.weg = tijdstip(946_684_800, 0);
		(uit[r.tabel] ??= []).push(k);
	});
	return uit;
}

/** Een tijdstip als tekst, op de milliseconde, met het volgnummer erbij opgeteld. */
export function tijdstip(seconden: number, volgnummer: number): string {
	return new Date(Math.round(seconden * 1000) + volgnummer).toISOString();
}

/* ---------------------------------------------------- van rijen naar toestand */

type Tabelrij = Record<string, unknown>;

/**
 * De toestand zoals hij uit de tabellen volgt. `null` als het team er niet in
 * staat: dan valt er niets op te bouwen, en is niets doen beter dan leeg maken.
 *
 * Leest zowel wat de server stuurt (ja/nee, JSON als object) als de vorm van de
 * telefoon (0 of 1, JSON als tekst).
 */
export function toestand(tabellen: Record<string, Tabelrij[]>, team: string): State | null {
	const rijenVan = (tabel: string) =>
		(tabellen[tabel] ?? []).filter((r) =>
			tabel === 'teams' || tabel === 'team_instellingen' ? r.id === team : r.team_id === team
		);
	const s = (r: Tabelrij, k: string): string | null => (typeof r[k] === 'string' ? (r[k] as string) : null);
	const n = (r: Tabelrij, k: string): number => {
		const v = r[k];
		return typeof v === 'number' ? Math.trunc(v) : typeof v === 'string' && v !== '' ? Math.trunc(Number(v)) || 0 : 0;
	};
	const ja = (r: Tabelrij, k: string): boolean => {
		const v = r[k];
		return v === true || (typeof v === 'number' && v !== 0) || v === 'true' || v === '1';
	};
	const json = (r: Tabelrij, k: string): unknown => {
		const v = r[k];
		if (typeof v === 'string') {
			try {
				return JSON.parse(v) ?? undefined;
			} catch {
				return undefined;
			}
		}
		return v ?? undefined;
	};
	const opVolgorde = (a: Tabelrij, b: Tabelrij) => {
		const x = moment(s(a, 'gemaakt')),
			y = moment(s(b, 'gemaakt'));
		if (x !== y) return x < y ? -1 : 1;
		return vergelijk(s(a, 'id') ?? '', s(b, 'id') ?? '');
	};

	const teamRij = rijenVan('teams')[0];
	if (!teamRij) return null;
	const t = emptyState();
	t.teamName = s(teamRij, 'naam') ?? '';
	const inst = rijenVan('team_instellingen')[0];
	if (inst) {
		t.formation = gevuld(s(inst, 'formatie')) ?? t.formation;
		t.parts = n(inst, 'delen') === 4 ? 4 : 2;
		t.minutesPerPart = Math.max(1, n(inst, 'minuten_per_deel'));
		t.reportSubs = ja(inst, 'verslag_met_wissels');
		const d = json(inst, 'standaardopstelling');
		if (isObject(d)) {
			t.defaultLineup = {
				formation: typeof d.formation === 'string' ? d.formation : '',
				lineup: leesOpstelling(d.lineup) ?? {},
				bench: Array.isArray(d.bench) ? d.bench.filter((x): x is string => typeof x === 'string') : []
			};
		}
	}

	const spelers = [...rijenVan('spelers')].sort(opVolgorde);
	t.players = spelers
		.filter((r) => !gevuld(s(r, 'weg')))
		.map((r) => {
			const p: Player = {
				id: s(r, 'id') ?? '',
				name: s(r, 'naam') ?? '',
				line: (['V', 'M', 'A'].includes(s(r, 'linie') ?? '') ? s(r, 'linie') : '') as Player['line']
			};
			if (ja(r, 'keept')) p.keeper = true;
			return p;
		});
	const plekInSelectie = new Map<string, number>();
	t.players.forEach((p, i) => plekInSelectie.set(p.id, i));
	/* Op de volgorde van de selectie; wie daar niet meer in staat daarna, op naam. */
	const opSelectie = (a: Tabelrij, b: Tabelrij) => {
		const x = plekInSelectie.get(s(a, 'speler_id') ?? ''),
			y = plekInSelectie.get(s(b, 'speler_id') ?? '');
		if (x !== undefined && y !== undefined) return x - y;
		if ((x === undefined) !== (y === undefined)) return x !== undefined ? -1 : 1;
		const na = s(a, 'naam') ?? '',
			nb = s(b, 'naam') ?? '';
		return na !== nb ? vergelijk(na, nb) : vergelijk(s(a, 'speler_id') ?? '', s(b, 'speler_id') ?? '');
	};

	const groepeer = (lijst: Tabelrij[], k: string) => {
		const uit = new Map<string, Tabelrij[]>();
		for (const r of lijst) {
			const sl = s(r, k) ?? '';
			if (!uit.has(sl)) uit.set(sl, []);
			uit.get(sl)!.push(r);
		}
		return uit;
	};
	const perWedstrijd = groepeer(rijenVan('wedstrijd_spelers'), 'wedstrijd_id');
	const gebeurd = groepeer(rijenVan('gebeurtenissen'), 'wedstrijd_id');
	const gebeurtenissen = (wid: string): MatchEvent[] =>
		[...(gebeurd.get(wid) ?? [])].sort(opVolgorde).flatMap((r) => {
			const type = TYPE[s(r, 'soort') ?? ''];
			if (!type) return [];
			const ruil = type === 'swap';
			const g: MatchEvent = { type, t: n(r, 't') };
			const zet = <K extends keyof MatchEvent>(k: K, v: MatchEvent[K] | null) => {
				if (v !== null && v !== undefined) g[k] = v;
			};
			if (!ruil) zet('player', s(r, 'speler'));
			zet('assist', s(r, 'assist'));
			zet('off', s(r, 'eruit'));
			zet('on', s(r, 'erin'));
			if (!ruil) zet('position', s(r, 'positie'));
			if (ruil) zet('positionA', s(r, 'positie'));
			zet('positionB', s(r, 'positie_b'));
			if (ruil) zet('playerA', s(r, 'speler'));
			zet('playerB', s(r, 'speler_b'));
			if (typeof r.deel === 'number') g.part = r.deel;
			return [g];
		});
	const lijstVan = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);

	const wedstrijden = rijenVan('wedstrijden');
	/* De wedstrijd van nu: wat bezig is gaat voor, anders de eerste die klaarstaat. */
	/* Een wedstrijd zonder klok is er een uit het programma, nog niet opgezet. */
	const metKlok = (r: Tabelrij) => r.klok !== null && r.klok !== undefined && r.klok !== '';
	const open = wedstrijden
		.filter((r) => s(r, 'status') !== 'afgelopen' && metKlok(r))
		.sort((a, b) => {
			const x = s(a, 'status') === 'bezig',
				y = s(b, 'status') === 'bezig';
			if (x !== y) return x ? -1 : 1;
			const da = s(a, 'datum') ?? '',
				db = s(b, 'datum') ?? '';
			return da !== db ? vergelijk(da, db) : opVolgorde(a, b);
		});
	const r = open[0];
	const wid = r ? s(r, 'id') : null;
	if (r && wid) {
		const klok = json(r, 'klok');
		const k = isObject(klok) ? klok : {};
		const ws = [...(perWedstrijd.get(wid) ?? [])].sort(opSelectie);
		const w: Match = {
			date: s(r, 'datum') ?? '',
			opponent: s(r, 'tegenstander') ?? '',
			home: ja(r, 'thuis'),
			formation: s(r, 'formatie') ?? '',
			lineup: leesOpstelling(json(r, 'opstelling')) ?? {},
			bench: lijstVan(json(r, 'bank')) ?? [],
			events: gebeurtenissen(wid),
			elapsed: typeof k.elapsed === 'number' ? k.elapsed : 0,
			since: typeof k.since === 'number' ? k.since : null,
			running: k.running === true,
			parts: n(r, 'delen') === 4 ? 4 : 2,
			part: typeof k.part === 'number' ? Math.trunc(k.part) : 1,
			inBreak: k.inBreak === true,
			finished: k.finished === true,
			absent: ws.filter((x) => !ja(x, 'aanwezig')).flatMap((x) => s(x, 'speler_id') ?? [])
		};
		const notitie = s(r, 'notitie');
		if (notitie !== null) w.note = notitie;
		if (typeof k.keptBy === 'string') w.keptBy = k.keptBy;
		const plan = json(r, 'wisselplan');
		if (Array.isArray(plan) && plan.every(isObject)) w.plan = plan.map(leesPlan);
		w.id = wid;
		const tijd = s(r, 'aanvang');
		if (tijd !== null) w.time = tijd;
		if (k.uitProgramma === true) w.fromProgram = true;
		t.match = w;
	}

	const programma = wedstrijden
		.filter((r) => s(r, 'status') === 'gepland' && !metKlok(r))
		.sort((a, b) => {
			const da = s(a, 'datum') ?? '',
				db = s(b, 'datum') ?? '';
			if (da !== db) return vergelijk(da, db);
			const ta = s(a, 'aanvang') ?? '',
				tb = s(b, 'aanvang') ?? '';
			return ta !== tb ? vergelijk(ta, tb) : opVolgorde(a, b);
		})
		.map((r) => {
			const p: ScheduledMatch = {
				id: s(r, 'id') ?? '',
				date: s(r, 'datum') ?? '',
				opponent: s(r, 'tegenstander') ?? '',
				home: ja(r, 'thuis')
			};
			const tijd = s(r, 'aanvang');
			if (tijd !== null) p.time = tijd;
			return p;
		});
	if (programma.length) t.program = programma;

	t.archive = wedstrijden
		.filter((r) => s(r, 'status') === 'afgelopen')
		.sort((a, b) => {
			const da = s(a, 'datum') ?? '',
				db = s(b, 'datum') ?? '';
			return da !== db ? vergelijk(db, da) : opVolgorde(b, a);
		})
		.map((r) => {
			const wid = s(r, 'id') ?? '';
			const ws = [...(perWedstrijd.get(wid) ?? [])].sort(opSelectie);
			const a: ArchivedMatch = {
				date: s(r, 'datum') ?? '',
				opponent: s(r, 'tegenstander') ?? '',
				home: ja(r, 'thuis'),
				score: [n(r, 'doelpunten_voor'), n(r, 'doelpunten_tegen')],
				formation: s(r, 'formatie') ?? '',
				duration: n(r, 'duur'),
				parts: n(r, 'delen') === 4 ? 4 : 2,
				events: gebeurtenissen(wid),
				names: Object.fromEntries(
					ws.flatMap((x) => (s(x, 'speler_id') ? [[s(x, 'speler_id')!, s(x, 'naam') ?? '']] : []))
				),
				absent: ws.filter((x) => !ja(x, 'aanwezig')).flatMap((x) => s(x, 'speler_id') ?? []),
				playingTime: ws.map((x) => {
					const regel: ArchivedMatch['playingTime'][number] = {
						name: s(x, 'naam') ?? '',
						seconds: n(x, 'seconden'),
						keeper: n(x, 'keeper_seconden')
					};
					const id = s(x, 'speler_id');
					if (id !== null) regel.id = id;
					const pos = json(x, 'posities');
					if (pos !== undefined) regel.positions = leesPosities(pos);
					return regel;
				})
			};
			const teamnaam = s(r, 'teamnaam');
			if (teamnaam !== null) a.teamName = teamnaam;
			const notitie = s(r, 'notitie');
			if (notitie !== null) a.note = notitie;
			const lineup = leesOpstelling(json(r, 'opstelling'));
			if (lineup) a.lineup = lineup;
			const bench = lijstVan(json(r, 'bank'));
			if (bench) a.bench = bench;
			a.id = wid;
			return a;
		});

	const perTraining = groepeer(rijenVan('training_spelers'), 'training_id');
	t.trainings = [...rijenVan('trainingen')]
		.sort((a, b) => {
			const da = s(a, 'datum') ?? '',
				db = s(b, 'datum') ?? '';
			return da !== db ? vergelijk(db, da) : opVolgorde(b, a);
		})
		.map((r): Training => {
			const tid = s(r, 'id') ?? '';
			const status: Record<string, Attendance> = {};
			for (const x of [...(perTraining.get(tid) ?? [])].sort(opSelectie)) {
				const pid = s(x, 'speler_id');
				if (!pid) continue;
				const st = s(x, 'status');
				status[pid] = st === 'afgemeld' ? 'excused' : st === 'afwezig' ? 'absent' : 'present';
			}
			return { id: tid, date: s(r, 'datum') ?? '', status };
		});

	const taken = [...rijenVan('taken')].sort(opVolgorde).flatMap((r): TeamTask[] => {
		const id = s(r, 'id'),
			wid = s(r, 'wedstrijd_id'),
			soort = s(r, 'soort');
		if (!id || !wid || !SOORTEN.includes(soort as TaskKind)) return [];
		const taak: TeamTask = { id, matchId: wid, kind: soort as TaskKind };
		const speler = s(r, 'speler_id');
		if (speler) taak.player = speler;
		const weg = s(r, 'afgemeld_door');
		if (weg) taak.declinedBy = weg;
		return [taak];
	});
	if (taken.length) t.tasks = taken;
	return t;
}

const SOORTEN: TaskKind[] = ['limonade', 'rijden', 'fluiten', 'vlaggen', 'teamtas'];

/** Een aftrap als "10:30", of niets. */
function aanvang(s: string | null | undefined): string | null {
	const t = (s ?? '').trim();
	const m = /^(\d\d):(\d\d)$/.exec(t);
	return m && Number(m[1]) <= 23 && Number(m[2]) <= 59 ? t : null;
}

/* --------------------------------------------------------- klein gereedschap */

const SOORT: Record<MatchEventType, string> = {
	start: 'aftrap',
	break: 'pauze',
	end: 'einde',
	goal: 'doelpunt',
	conceded: 'tegendoelpunt',
	substitution: 'wissel',
	swap: 'ruil'
};
const TYPE: Record<string, MatchEventType> = Object.fromEntries(
	Object.entries(SOORT).map(([k, v]) => [v, k as MatchEventType])
);

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Zoals de telefoon teksten vergelijkt: op tekenwaarde, niet op taal. */
function vergelijk(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Zoals Swift afrondt: .5 weg van nul. */
function rond(x: number): number {
	return Math.sign(x) * Math.round(Math.abs(x)) || 0;
}

/**
 * Een waarde zoals de telefoon hem beschrijft, voor het kenmerk van een
 * gebeurtenis: `tekst("LV")`, `getal(12)`, `leeg`. Moet letter voor letter
 * kloppen, anders krijgt dezelfde gebeurtenis hier een ander kenmerk.
 */
function alsCel(v: Waarde): string {
	if (v === null) return 'leeg';
	if (typeof v === 'number') return 'getal(' + v + ')';
	if (typeof v === 'boolean') return 'getal(' + (v ? 1 : 0) + ')';
	if (typeof v === 'string') {
		const tekst = v.replace(/[\\"'\n\r\t\0]/g, (c) =>
			c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : c === '\0' ? '\\0' : '\\' + c
		);
		return 'tekst("' + tekst + '")';
	}
	return 'tekst(' + JSON.stringify(JSON.stringify(v)) + ')';
}

/** Een opstelling staat als lijst van paren, want een object bewaart op de server zijn volgorde niet. */
function leesOpstelling(v: unknown): Lineup | null {
	if (Array.isArray(v)) {
		const l: Lineup = {};
		for (const p of v) {
			if (Array.isArray(p) && p.length === 2 && typeof p[0] === 'string') {
				l[p[0]] = typeof p[1] === 'string' ? p[1] : null;
			}
		}
		return l;
	}
	if (isObject(v)) {
		const l: Lineup = {};
		for (const [k, w] of Object.entries(v)) l[k] = typeof w === 'string' ? w : null;
		return l;
	}
	return null;
}

function leesPosities(v: unknown): Record<string, number> {
	const uit: Record<string, number> = {};
	if (Array.isArray(v)) {
		for (const p of v) {
			if (Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'number') uit[p[0]] = p[1];
		}
	} else if (isObject(v)) {
		for (const [k, w] of Object.entries(v)) if (typeof w === 'number') uit[k] = w;
	}
	return uit;
}

function leesPlan(o: Record<string, unknown>): PlannedSub {
	const s: PlannedSub = {
		id: typeof o.id === 'string' ? o.id : '',
		minuut: typeof o.minuut === 'number' ? Math.trunc(o.minuut) : 0,
		on: typeof o.on === 'string' ? o.on : '',
		off: typeof o.off === 'string' ? o.off : ''
	};
	if (typeof o.naDeel === 'number') s.naDeel = Math.trunc(o.naDeel);
	if (o.soort === 'ruil') s.soort = 'ruil';
	if (typeof o.skipped === 'boolean') s.skipped = o.skipped;
	return s;
}

/** Dezelfde volgorde van velden als de telefoon, zodat het verschil klein blijft. */
function planAlsJson(s: PlannedSub): Record<string, Waarde> {
	const o: Record<string, Waarde> = { id: s.id, minuut: s.minuut, on: s.on, off: s.off };
	if (s.naDeel !== undefined && s.naDeel !== null) o.naDeel = s.naDeel;
	if (s.soort !== undefined && s.soort !== null) o.soort = s.soort;
	if (s.skipped !== undefined && s.skipped !== null) o.skipped = s.skipped;
	return o;
}

/** Wat de server weigert, raakt het toestel daarna kwijt. Dus vooraf passend maken. */
function knip(s: string | null | undefined, lengte: number, anders = ''): string {
	const tekst = s ?? '';
	/* Niet bijknippen aan de randen: wie een notitie typt, raakt anders zijn
	   laatste spatie kwijt zodra de rij terugkomt. */
	return tekst.trim() === '' ? anders : Array.from(tekst).slice(0, lengte).join('');
}

function minuten(m: number): number {
	return Math.min(60, Math.max(1, rond(m || 0)));
}

/** Leest "2026-09-04". Al het andere is geen datum, en dan maakt de server er 1 januari 2000 van. */
function datum(d: string): string {
	const delen = (d ?? '').split('-');
	if (delen.length !== 3 || !/^\d{4}$/.test(delen[0]) || !/^\d{2}$/.test(delen[1]) || !/^\d{2}$/.test(delen[2]))
		return '2000-01-01';
	const [jaar, maand, dag] = delen.map(Number);
	if (maand < 1 || maand > 12) return '2000-01-01';
	const schrikkel = (jaar % 4 === 0 && jaar % 100 !== 0) || jaar % 400 === 0;
	const dagen = [31, schrikkel ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return dag >= 1 && dag <= dagen[maand - 1] ? d : '2000-01-01';
}

/**
 * Een tijdstip van de server of van het toestel, vergelijkbaar gemaakt. De
 * server schrijft '2026-10-13T21:00:00.123456+00:00', het toestel
 * '2026-10-13T21:00:00.123Z'; allebei in dezelfde tijdzone.
 */
export function moment(tekst: string | null): string {
	if (!tekst || tekst.length < 19) return '';
	const kop = tekst.slice(0, 19).replace(' ', 'T');
	const rest = tekst.slice(19);
	const breuk = rest[0] === '.' ? (/^\d*/.exec(rest.slice(1))?.[0] ?? '') : '';
	return kop + '.' + (breuk + '000000').slice(0, 6);
}
