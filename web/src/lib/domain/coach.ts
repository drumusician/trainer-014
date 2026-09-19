/**
 * De assistent: een tweede paar ogen bij het maken van de opstelling.
 *
 * Hier staat alleen wat er heen gaat en wat er terugkomt. Het echte denkwerk
 * gebeurt op de server (supabase/functions/coach), met een taalmodel dat de
 * notities van de trainer kan lezen naast de cijfers. Dat kan deze app zelf niet,
 * en een rekenregel ook niet: 'Jack naast Mirza beviel goed tegen een snelle
 * spits' staat nergens anders dan in een notitie.
 *
 * Twee dingen doen we hier bewust zelf:
 *
 * - **Wat er heen gaat, kiezen we.** Voornamen, linies, speeltijd, notities en
 *   trainingsopkomst. Geen e-mailadressen, geen teamnaam, niet wie de wedstrijd
 *   bijhield. Alleen wat nodig is voor een opstelling.
 * - **Wat terugkomt, controleren we.** Een voorstel met een plek dubbel of een
 *   speler die er niet is, wordt niet overgenomen. De assistent stelt voor; de
 *   app laat alleen toe wat klopt.
 */
import { benchOverview } from './bench';
import { momentenVan } from './momenten';
import { positionsOf, LINES, canKeep } from './formations';
import { spelersOverzicht } from './players';
import { homeFirst } from './time';
import { sortTrainings } from './attendance';
import { timelineRows } from './report';
import type { Attendance, Lineup, Player, State } from './types';

/** Wat de assistent te zien krijgt. De vorm is dezelfde als in de functie op de server. */
export interface CoachVraag {
	/** de vraag of het verhaal van de trainer, in zijn eigen woorden */
	vraag: string;
	formatie: string;
	delen: number;
	minutenPerDeel: number;
	plekken: { code: string; label: string; linie: string }[];
	spelers: CoachSpeler[];
	/** zoals de trainer hem nu heeft staan, op naam */
	opstellingNu: { plekken: Record<string, string | null>; bank: string[] };
	/** nieuwste eerst */
	wedstrijden: CoachWedstrijd[];
	/** bij het bijsturen: het vorige voorstel en alle wensen tot nu toe, de nieuwste laatst */
	vorige?: { voorstel: CoachVoorstel; bijsturingen: string[] };
}

export interface CoachSpeler {
	naam: string;
	linie: string;
	kanKeepen: boolean;
	/** vandaag afgemeld: niet opstellen */
	afwezig: boolean;
	training: { aanwezig: number; van: number; laatste: string[] };
	bank: { wedstrijden: number; bankMinuten: number; begonOpBank: number; beginBekend: number };
	minutenGespeeld: number;
	doelpunten: number;
	assists: number;
}

export interface CoachWedstrijd {
	datum: string;
	tegenstander: string;
	thuis: boolean;
	/** thuisploeg eerst, zoals je hem zegt, plus of we wonnen */
	uitslag: string;
	formatie: string;
	minuten: number;
	afwezig: string[];
	/** wie er begon, per plekcode */
	basis: Record<string, string>;
	/** 'minuut  wat er gebeurde', in de woorden van het verloop */
	verloop: string[];
	speeltijd: { naam: string; minuten: number; keeperMinuten: number; perPlek: Record<string, number> }[];
	notitie: string;
}

/** Wat de assistent terugstuurt. Namen, geen id's: die zijn voor mensen onleesbaar en voor een model ook. */
export interface CoachVoorstel {
	samenvatting: string;
	opstelling: { plek: string; speler: string }[];
	bank: string[];
	wisselplan: { minuut: number; eruit: string; erin: string; waarom: string }[];
	redenen: string[];
	aandachtspunten: string[];
}

/** Wat je aan het opstellen bent, met wie er vandaag niet is. */
export interface CoachDoel {
	formation: string;
	lineup: Lineup;
	bench: string[];
	absent?: string[];
}

const TRAINING: Record<Attendance, string> = {
	present: 'aanwezig',
	excused: 'afgemeld',
	absent: 'niet gekomen'
};

/**
 * Elke speler een naam die maar één keer voorkomt. Twee keer Daan zou voor de
 * assistent één jongen zijn, en dan zet hij er een dubbel op het veld.
 */
export function uniekeNamen(players: Player[]): Map<string, string> {
	const uit = new Map<string, string>();
	const gezien = new Map<string, number>();
	for (const p of players) {
		const basis = p.name.trim() || 'Naamloos';
		const n = (gezien.get(basis) ?? 0) + 1;
		gezien.set(basis, n);
		uit.set(p.id, n === 1 ? basis : `${basis} (${n})`);
	}
	return uit;
}

export function coachVraag(
	t: State,
	doel: CoachDoel,
	vraag: string,
	vorige?: { voorstel: CoachVoorstel; bijsturingen: string[] }
): CoachVraag {
	const namen = uniekeNamen(t.players);
	const naam = (id: string | null | undefined) => (id ? (namen.get(id) ?? null) : null);
	const afwezig = new Set(doel.absent ?? []);
	const bank = new Map(benchOverview(t.players, t.archive, t.trainings).map((r) => [r.id, r]));
	const overzicht = new Map(spelersOverzicht(t.players, t.archive, t.trainings).map((r) => [r.id, r]));
	const trainingen = sortTrainings(t.trainings);

	const spelers: CoachSpeler[] = t.players.map((p) => {
		const b = bank.get(p.id)!;
		const o = overzicht.get(p.id)!;
		const statussen = trainingen.map((tr) => tr.status[p.id]).filter((s): s is Attendance => !!s);
		return {
			naam: namen.get(p.id)!,
			linie: LINES[p.line] ?? LINES[''],
			kanKeepen: canKeep(p),
			afwezig: afwezig.has(p.id),
			training: {
				aanwezig: statussen.filter((s) => s === 'present').length,
				van: statussen.length,
				laatste: statussen.slice(0, 4).map((s) => TRAINING[s])
			},
			bank: {
				wedstrijden: b.matches,
				bankMinuten: Math.round(b.benchSeconds / 60),
				begonOpBank: b.startedOnBench,
				beginBekend: b.startsKnown
			},
			minutenGespeeld: Math.round(o.seconds / 60),
			doelpunten: o.goals,
			assists: o.assists
		};
	});

	const wedstrijden: CoachWedstrijd[] = [...t.archive]
		.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
		.map((a) => {
			const home = a.home !== false;
			const [v, tg] = a.score ?? [0, 0];
			const [links, rechts] = homeFirst([v, tg], home);
			const afloop = v > tg ? 'gewonnen' : v < tg ? 'verloren' : 'gelijk';
			const aftrap = momentenVan(a, t.players)[0];
			const basis: Record<string, string> = {};
			for (const [plek, id] of Object.entries(aftrap?.lineup ?? {})) basis[plek] = naam(id) ?? a.names?.[id] ?? id;
			const regels = timelineRows(a.events ?? [], t.players, a.names, a.parts, a.formation).filter(
				(r) => r.type !== 'start' && r.type !== 'end'
			);
			return {
				datum: a.date,
				tegenstander: a.opponent,
				thuis: home,
				uitslag: `${links}-${rechts} (${home ? 'thuis' : 'uit'}, ${afloop})`,
				formatie: a.formation,
				minuten: Math.round((a.duration ?? 0) / 60),
				afwezig: (a.absent ?? []).map((id) => naam(id) ?? a.names?.[id] ?? id),
				basis,
				verloop: regels.map((r) => `${Math.floor(r.t / 60)}′ ${r.tekst}`),
				speeltijd: (a.playingTime ?? [])
					.filter((r) => (r.seconds ?? 0) > 0)
					.map((r) => ({
						naam: naam(r.id) ?? r.name,
						minuten: Math.round((r.seconds ?? 0) / 60),
						keeperMinuten: Math.round((r.keeper ?? 0) / 60),
						perPlek: Object.fromEntries(
							Object.entries(r.positions ?? {})
								.filter(([, s]) => s >= 30)
								.map(([plek, s]) => [plek, Math.round(s / 60)])
						)
					})),
				notitie: a.note?.trim() ?? ''
			};
		});

	return {
		vraag: vraag.trim(),
		formatie: doel.formation,
		delen: t.parts,
		minutenPerDeel: t.minutesPerPart,
		plekken: positionsOf(doel.formation).map(([code, label, , , linie]) => ({ code, label, linie: LINES[linie] })),
		spelers,
		opstellingNu: {
			plekken: Object.fromEntries(positionsOf(doel.formation).map(([code]) => [code, naam(doel.lineup[code]) ?? null])),
			bank: doel.bench.map((id) => naam(id)).filter((n): n is string => !!n)
		},
		wedstrijden,
		...(vorige ? { vorige } : {})
	};
}

export interface Gecontroleerd {
	lineup: Lineup;
	bench: string[];
	/** wat het overnemen tegenhoudt */
	problemen: string[];
	/** wat klopt maar opvalt: dat zeg je erbij, het houdt niets tegen */
	opmerkingen: string[];
}

/**
 * Het voorstel terugvertalen naar id's, en nagaan of het kan.
 *
 * Wie er is maar nergens staat, zetten we op de bank in plaats van te weigeren:
 * dat is geen fout in de opstelling, alleen een slordige lijst.
 */
export function controleerVoorstel(v: CoachVoorstel, players: Player[], doel: CoachDoel): Gecontroleerd {
	const namen = uniekeNamen(players);
	const idVan = new Map([...namen].map(([id, n]) => [n, id]));
	const byId = new Map(players.map((p) => [p.id, p]));
	const afwezig = new Set(doel.absent ?? []);
	const plekken = positionsOf(doel.formation).map(([code]) => code);
	const problemen: string[] = [];
	const opmerkingen: string[] = [];

	const lineup: Lineup = {};
	const opHetVeld = new Set<string>();
	for (const { plek, speler } of v.opstelling) {
		if (!plekken.includes(plek)) {
			problemen.push(`Plek ${plek} bestaat niet in ${doel.formation}.`);
			continue;
		}
		if (lineup[plek]) {
			problemen.push(`Plek ${plek} staat er twee keer in.`);
			continue;
		}
		const id = idVan.get(speler);
		if (!id) {
			problemen.push(`${speler} staat niet in de selectie.`);
			continue;
		}
		if (afwezig.has(id)) problemen.push(`${speler} is vandaag afgemeld.`);
		if (opHetVeld.has(id)) problemen.push(`${speler} staat twee keer op het veld.`);
		opHetVeld.add(id);
		lineup[plek] = id;
		if (plek === 'K' && !canKeep(byId.get(id)!))
			opmerkingen.push(`${speler} staat in het doel, maar keept normaal niet.`);
	}
	for (const plek of plekken) if (!lineup[plek]) problemen.push(`Er staat niemand op ${plek}.`);

	const bench = players.map((p) => p.id).filter((id) => !opHetVeld.has(id) && !afwezig.has(id));
	return { lineup, bench, problemen: [...new Set(problemen)], opmerkingen };
}
