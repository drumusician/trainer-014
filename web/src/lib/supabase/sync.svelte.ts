import { app } from '$lib/store.svelte';
import { reportIssue } from '$lib/issues.svelte';
import { SUPABASE_SLEUTEL, SUPABASE_URL } from './config';
import type { State } from '$lib/domain/types';
import { emptyState } from '$lib/domain/types';
import { migreerToestand } from '$lib/domain/migrate-storage';
import {
	MET_VOLGORDE,
	NU,
	TABELLEN,
	rijen,
	tijdstip,
	toestand,
	verschil,
	vulKenmerkenAan,
	type Rij,
	type Wijziging
} from './rijen';

const SESSIESLEUTEL = 'o14-sessie-v1';
/* Blijft staan na uitloggen: daaraan zien we of er iemand anders inlogt. */
const LAATSTE_INLOG = 'o14-laatste-inlog-v1';
/* On a phone you switch to your mail in between, which can reload the app.
   That is why we remember who we requested a code for. */
const INLOGSLEUTEL = 'o14-inlog-v1';
/* Wat er volgens dit toestel in de tabellen staat. Zie Spiegel. */
const SPIEGELSLEUTEL = 'o14-gespiegeld-v1';

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

interface Sessie {
	access_token: string;
	refresh_token: string;
	/** when the token expires, in ms */
	verloopt: number;
	user_id?: string | null;
	email?: string | null;
	teamId?: string | null;
	/** de versie van het oude blok (team_toestand); alleen nog om één keer te verhuizen */
	versie?: number;
	laatst?: string | null;
	/** van vóór de tabellen; wordt niet meer gebruikt */
	afdruk?: string | null;
}

/**
 * Wat er volgens dit toestel in de tabellen van een team staat.
 *
 * Het verschil tussen dit en wat er nu in de app staat is wat er opgestuurd
 * moet worden; niet meer dan dat. Zo blijft wat een ander toestel intussen
 * deed staan: dat staat hier niet in, en wordt dus ook niet weggehaald.
 *
 * `toestand` leeg met een `naam`: het team bestaat, maar er staat nog niets in.
 * Geen spiegel voor een team: dit toestel heeft het nog nooit opgehaald, en
 * opsturen begint dan altijd met ophalen.
 */
interface Spiegel {
	team: string;
	toestand: State | null;
	naam?: string;
}

interface Fout extends Error {
	status?: number;
	data?: { code?: string; message?: string };
}

/**
 * De noodrem.
 *
 * Op 7 september stond er 81.705.953 keer hetzelfde voorwerk in de statistieken
 * van Postgres — dat is het aantal API-verzoeken dat deze app heeft gedaan. De
 * database stond op 100% processor. De lus zelf was niet te reproduceren: vier
 * nagebootste toestanden en de echte gebouwde app tegen een nepserver deden alle
 * vier braaf niets.
 *
 * Dus is dit geen reparatie van die lus maar een grens eromheen. Alle verkeer
 * naar Supabase gaat door sb(), en hier wordt geteld. Gaat het over de grens, dan
 * stopt het — wat de oorzaak ook is, en ook als die oorzaak er morgen anders
 * uitziet. Een trainer merkt er niets van: de app werkt zonder server, en na een
 * kwartier mag hij het opnieuw proberen.
 *
 * De grens ligt ruim boven normaal gebruik. Opstarten kost er ongeveer twintig;
 * een hele wedstrijd bijhouden een stuk of veertig.
 */
const RAAM = 60_000;
const GRENS = 150;
const AFKOELEN = 900_000;

class Noodrem {
	private stempels: number[] = [];
	/** hoe vaak welk pad, om te kunnen zien wát er loopt */
	private paden: Record<string, number> = {};
	/** wanneer de rem eraf mag; 0 = hij staat er niet op */
	tot = 0;

	/** Mag er nog een verzoek uit? Zo niet, dan staat de rem erop. */
	mag(nu: number, pad = ''): boolean {
		if (this.tot) {
			if (nu < this.tot) return false;
			this.los();
		}
		this.stempels = this.stempels.filter((s) => nu - s < RAAM);
		if (this.stempels.length >= GRENS) {
			this.tot = nu + AFKOELEN;
			/*
			 * Opschrijven wát er zo vaak langskwam. Dit is het enige moment waarop we
			 * er iets van zien: de lus zelf was niet te reproduceren, dus als hij zich
			 * weer voordoet moet de app zelf vertellen welke aanroep het was. Het komt
			 * in het logboekje bij Gegevens, en dat is met één knop door te sturen.
			 */
			reportIssue(
				'De app deed te veel verzoeken achter elkaar en heeft zichzelf stilgezet.',
				Object.entries(this.paden)
					.sort((a, b) => b[1] - a[1])
					.map(([p, n]) => p + ' ×' + n)
					.join(', ')
			);
			return false;
		}
		this.stempels.push(nu);
		/* Alleen het soort pad tellen, nooit een id of een adres. */
		const soort = pad.split('?')[0].replace(/\/[0-9a-f-]{8,}$/i, '/…');
		this.paden[soort] = (this.paden[soort] ?? 0) + 1;
		return true;
	}

	/** Met de hand opnieuw proberen mag altijd; dan beslist de trainer. */
	los() {
		this.tot = 0;
		this.stempels = [];
		this.paden = {};
	}
}

export const noodrem = new Noodrem();

async function sb(pad: string, opties: RequestInit & { metToken?: boolean } = {}, token?: string) {
	if (!noodrem.mag(Date.now(), pad)) {
		const fout = new Error(
			'De app deed veel te veel verzoeken achter elkaar en heeft zichzelf stilgezet. Er gaat iets mis met synchroniseren; je gegevens op dit toestel zijn veilig.'
		) as Fout;
		fout.status = 429;
		throw fout;
	}
	const kop: Record<string, string> = {
		apikey: SUPABASE_SLEUTEL,
		'Content-Type': 'application/json',
		...((opties.headers as Record<string, string>) ?? {})
	};
	if (opties.metToken !== false && token) kop.Authorization = 'Bearer ' + token;

	const r = await fetch(SUPABASE_URL + pad, { ...opties, headers: kop });
	const tekst = await r.text();
	let data: unknown;
	try {
		data = tekst ? JSON.parse(tekst) : null;
	} catch {
		data = tekst;
	}
	if (!r.ok) {
		const d = data as { message?: string; msg?: string; error_description?: string; code?: string; fout?: string };
		const fout = new Error(d?.fout ?? d?.message ?? d?.msg ?? d?.error_description ?? 'fout ' + r.status) as Fout;
		fout.status = r.status;
		fout.data = d;
		throw fout;
	}
	return data;
}

/** Iemand die bij dit team kan. De eigenaar staat er ook bij, met zijn rol. */
export interface Lid {
	gebruiker: string;
	rol: 'eigenaar' | 'trainer';
	email?: string;
}

/**
 * Er moet eerst iets beslist worden door de trainer.
 *
 * Geen storing maar een vraag, en dat verschil moet de app maken. Behandel je dit
 * als een mislukking, dan blijft hij het proberen en zegt het scherm 'geen
 * verbinding' — waarna iemand met zijn telefoon in de lucht naar buiten loopt
 * terwijl hij gewoon op een knop moet drukken.
 */
class WachtOpDeTrainer extends Error {}

/** Wat er in de tabellen staat, per tabel. */
type Tabellen = Record<string, Record<string, unknown>[]>;

/** Hoeveel rijen er in één keer heen of terug gaan. Supabase geeft er standaard hooguit duizend. */
const PAGINA = 1000;

const kloon = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

class Sync {
	sessie = $state<Sessie | null>(null);
	message = $state('');
	bezig = $state(false);
	/** 'email' or 'code' */
	fase = $state<'email' | 'code'>('email');
	email = $state('');

	/* ---------- syncing by itself ---------- */
	/** there are changes waiting that the server does not have yet */
	vies = $state(false);
	/** hoeveel wijzigingen de server weigerde; die zijn weggegooid, zie schrijf() */
	geweigerd = $state(0);
	/** the last attempt failed (usually: no signal) */
	hapert = $state(false);
	private wachter: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Hoe vaak het opsturen achter elkaar mislukte.
	 *
	 * Er stond alleen een rem op botsingen, en toen die herkenning stuk was bleef
	 * de app in hetzelfde tempo doorproberen — 357.000 fouten in een uur op de
	 * database. Nu wachten we na elke mislukking twee keer zo lang, tot vijf
	 * minuten. Niet helemaal stoppen: dan zou de app zichzelf klemzetten, want
	 * ophalen gebeurt niet zolang er hier nog iets klaarstaat.
	 */
	private mislukt = 0;
	private static readonly LANGSTE_WACHT = 300_000;
	private bezigMetDuwen = false;
	private spiegel: Spiegel | null = null;
	/** de rijen van de spiegel, uitgerekend als ze nodig zijn */
	private spiegelRijen: Rij[] | null = null;
	/** telt elke opslag, om te zien of de trainer iets deed terwijl we ophaalden */
	private tikken = 0;

	/* ---------- meerdere trainers ----------
	   Zolang er één team was, kon de app het gewoon pakken. Nu je ook lid kunt
	   zijn van meer teams — je eigen ploeg en die van iemand anders, of gewoon
	   twee ploegen — mag hij dat niet meer gokken: het verkeerde team pakken
	   betekent andermans seizoen overschrijven met dat van jou.

	   Dit was eerst een eenmalige keuze die verdween zodra je hem gemaakt had.
	   Daarmee was het een eenrichtingsdeur: wie twee teams heeft koos er een en
	   kwam nooit meer bij het andere. Nu is het gewoon een lijst die er altijd
	   staat, met daarin welk team dit toestel volgt. */
	mijnTeams = $state<{ id: string; naam: string }[]>([]);
	/** de ploeg van dit team, om te laten zien wie er allemaal bij kan */
	leden = $state<Lid[]>([]);
	/** uitnodigingen die nog openstaan voor dit team */
	openstaand = $state<{ id: string; email: string }[]>([]);
	/** teams waarvoor er een uitnodiging op jouw adres klaarstaat */
	uitgenodigdVoor = $state<{ id: string; naam: string }[]>([]);
	/**
	 * Er logt iemand anders in dan de vorige keer, en er staat hier nog een team.
	 *
	 * Dat gebeurt op een geleende telefoon, of als je zelf twee adressen hebt. Wat
	 * er dan níét mag gebeuren: die spelers stilletjes meenemen naar het nieuwe
	 * account. Heeft dat account nog geen team, dan maakt de app er een aan met de
	 * naam van het oude en duwt de namen van andermans kinderen erin.
	 *
	 * Dus wachten we, en vraagt het scherm wat de bedoeling is. Zolang dit gevuld
	 * is gaat er niets heen en weer.
	 */
	andereGebruiker = $state<string | null>(null);

	load() {
		const bak = storage();
		if (!bak) return;
		try {
			this.sessie = JSON.parse(bak.getItem(SESSIESLEUTEL) ?? 'null');
		} catch {
			this.sessie = null;
		}
		try {
			this.spiegel = JSON.parse(bak.getItem(SPIEGELSLEUTEL) ?? 'null');
		} catch {
			this.spiegel = null;
		}
		this.spiegelRijen = null;
		try {
			const wachtend = JSON.parse(bak.getItem(INLOGSLEUTEL) ?? 'null');
			if (wachtend?.email && !this.sessie) {
				this.email = wachtend.email;
				this.fase = 'code';
				this.message = 'Er is een code onderweg naar ' + wachtend.email + '.';
			}
		} catch {
			/* stil */
		}
	}

	private bewaarInlogpoging(email: string | null) {
		const bak = storage();
		if (!bak) return;
		try {
			if (email) bak.setItem(INLOGSLEUTEL, JSON.stringify({ email, since: Date.now() }));
			else bak.removeItem(INLOGSLEUTEL);
		} catch {
			/* stil */
		}
	}

	private save() {
		const bak = storage();
		if (!bak) return;
		try {
			bak.setItem(SESSIESLEUTEL, JSON.stringify(this.sessie));
		} catch {
			/* stil */
		}
	}

	private zet(d: {
		access_token: string;
		refresh_token: string;
		expires_in?: number;
		user?: { id: string; email: string };
	}) {
		const oud = this.sessie;
		this.sessie = {
			access_token: d.access_token,
			refresh_token: d.refresh_token,
			verloopt: Date.now() + (d.expires_in ?? 3600) * 1000,
			user_id: d.user?.id ?? oud?.user_id ?? null,
			email: d.user?.email ?? oud?.email ?? null,
			teamId: oud?.teamId ?? null,
			/*
			 * Twee dingen die hier misgingen, en allebei stil.
			 *
			 * De versie werd 0 als hij nog onbekend was. Maar 0 betekent 'we hebben
			 * gekeken en er stond niets', en onbekend betekent 'we hebben dit team nog
			 * nooit gezien'. Door dat verschil weg te poetsen omzeilde elke
			 * tokenvernieuwing de regel dat je nooit opstuurt naar een team dat je niet
			 * hebt opgehaald — precies de regel die andermans seizoen beschermt.
			 *
			 * En de vingerafdruk werd helemaal niet meegenomen. Na elke vernieuwing was
			 * hij dus leeg, en dan vindt merkVies() altijd een verschil: de app denkt
			 * bij elke opslag dat er iets te versturen is, ook als er niets veranderd
			 * is. Een uur lang, elk uur opnieuw.
			 */
			versie: oud?.versie,
			afdruk: oud?.afdruk ?? null,
			laatst: oud?.laatst ?? null
		};
		this.save();
	}

	/** Wie er als laatste inlogde. Overleeft uitloggen, want daar gaat het om. */
	private onthoudGebruiker(email: string | null | undefined) {
		try {
			if (email) storage()?.setItem(LAATSTE_INLOG, email);
		} catch {
			/* dan onthouden we het niet; dat is hinderlijk, niet gevaarlijk */
		}
	}

	/**
	 * Is dit een ander dan de vorige keer, en staat er hier nog iets?
	 *
	 * Aangeroepen na elke geslaagde inlog. Zonder gegevens op dit toestel valt er
	 * niets te verhuizen en is er dus ook niets te vragen.
	 */
	private kijkNaarWissel() {
		const nu = this.sessie?.email;
		let vorige: string | null;
		try {
			vorige = storage()?.getItem(LAATSTE_INLOG) ?? null;
		} catch {
			vorige = null;
		}
		const staatHierIets = app.toestand.players.length > 0 || app.toestand.archive.length > 0;
		if (vorige && nu && vorige !== nu && staatHierIets) {
			this.andereGebruiker = vorige;
			return;
		}
		this.onthoudGebruiker(nu);
	}

	/**
	 * Meenemen: wat hier staat wordt het begin van dit account.
	 *
	 * Klopt als het nieuwe account nog geen team heeft — je bent van adres
	 * veranderd en je seizoen verhuist mee. Heeft het al wel een team, dan zegt de
	 * app daarna dat je eerst moet ophalen, en dat is ook waar: twee seizoenen in
	 * één team passen niet, en welke van de twee wint is niets wat de app mag
	 * beslissen.
	 */
	neemMee() {
		this.andereGebruiker = null;
		this.onthoudGebruiker(this.sessie?.email);
		this.merkVies();
	}

	/**
	 * Schoon beginnen: wat hier staat hoort bij de vorige, en blijft daar.
	 *
	 * En dan meteen halen wat bij dít account hoort. Er is op dat moment niets meer
	 * te verliezen, dus wachten tot de trainer zelf op Ophalen drukt is alleen maar
	 * een leeg scherm waar hij niets van begrijpt.
	 */
	beginSchoon() {
		/* Eerst vergeten wat er op de server stond. Anders lijkt de lege app een
		   opdracht om daar alles weg te halen. */
		this.zetSpiegel(null);
		app.wisAlles();
		this.andereGebruiker = null;
		this.vies = false;
		this.onthoudGebruiker(this.sessie?.email);
		void this.ophalen(true);
	}

	uitloggen() {
		this.sessie = null;
		this.message = '';
		this.vies = false;
		this.zetSpiegel(null);
		this.mijnTeams = [];
		this.leden = [];
		this.openstaand = [];
		this.uitgenodigdVoor = [];
		this.andereGebruiker = null;
		storage()?.removeItem(SESSIESLEUTEL);
		this.bewaarInlogpoging(null);
	}

	/** Try a different address after all. */
	opnieuw() {
		this.fase = 'email';
		this.message = '';
		this.bewaarInlogpoging(null);
	}

	/** The token lasts an hour; refreshing in time saves logging in again. */
	private async token(): Promise<string | null> {
		const s = this.sessie;
		if (!s) return null;
		if (s.verloopt && Date.now() < s.verloopt - 60000) return s.access_token;
		try {
			const d = (await sb('/auth/v1/token?grant_type=refresh_token', {
				method: 'POST',
				metToken: false,
				body: JSON.stringify({ refresh_token: s.refresh_token })
			})) as Parameters<Sync['zet']>[0];
			this.zet(d);
			return this.sessie!.access_token;
		} catch (e) {
			/*
			 * Alleen uitloggen als de server het bewijs echt afwijst.
			 *
			 * Hier stond een catch die bij élke fout uitlogde. Geen bereik op het
			 * moment dat je token toevallig verloopt? Uitgelogd, langs de lijn, en
			 * opnieuw inloggen kan niet want er is geen bereik. En sinds de noodrem
			 * bestaat gold het ook daarvoor: de rem sloeg aan en je was je sessie
			 * kwijt.
			 *
			 * Een verlopen of ingetrokken bewijs geeft 400 of 401. Al het andere is
			 * een storing, en daar hoort de trainer niets van te merken.
			 */
			const status = (e as Fout).status ?? 0;
			if (status === 400 || status === 401 || status === 403) {
				this.uitloggen();
			} else {
				this.hapert = true;
			}
			return null;
		}
	}

	/* ---------- signing in ---------- */
	async stuurCode(email: string) {
		if (!email.trim()) {
			this.message = 'Vul je e-mailadres in.';
			return;
		}
		this.bezig = true;
		this.message = 'Bezig met versturen…';
		try {
			const terug = location.origin + '/app/meer';
			await sb('/auth/v1/otp?redirect_to=' + encodeURIComponent(terug), {
				method: 'POST',
				metToken: false,
				body: JSON.stringify({ email: email.trim(), create_user: true })
			});
			this.email = email.trim();
			this.fase = 'code';
			this.bewaarInlogpoging(this.email);
			this.message = 'Mail verstuurd naar ' + this.email + '. Kijk ook in je spam.';
		} catch (e) {
			this.message = 'Versturen lukte niet: ' + (e as Error).message;
		} finally {
			this.bezig = false;
		}
	}

	async controleerCode(code: string) {
		if (!code.trim()) {
			this.message = 'Vul de code uit de mail in.';
			return;
		}
		this.bezig = true;
		this.message = 'Bezig met inloggen…';
		try {
			const d = (await sb('/auth/v1/verify', {
				method: 'POST',
				metToken: false,
				body: JSON.stringify({ email: this.email, token: code.trim(), type: 'email' })
			})) as Parameters<Sync['zet']>[0];
			this.zet(d);
			this.fase = 'email';
			this.bewaarInlogpoging(null);
			this.kijkNaarWissel();
			this.message = 'Ingelogd.';
		} catch (e) {
			this.message = 'Deze code klopt niet of is verlopen: ' + (e as Error).message;
		} finally {
			this.bezig = false;
		}
	}

	/** Back from the mail: the keys sit behind a # in the address. */
	async pakInlogUitLink() {
		if (typeof location === 'undefined') return;
		const h = location.hash ?? '';
		const schoon = () => history.replaceState(null, '', location.pathname + location.search);
		if (!h.includes('access_token=')) {
			if (h.includes('error')) {
				const f = new URLSearchParams(h.replace(/^#/, ''));
				this.message =
					'Inloggen via de link lukte niet: ' + (f.get('error_description') ?? f.get('error') ?? 'onbekende fout');
				schoon();
			}
			return;
		}
		const f = new URLSearchParams(h.replace(/^#/, ''));
		this.zet({
			access_token: f.get('access_token') ?? '',
			refresh_token: f.get('refresh_token') ?? '',
			expires_in: Number(f.get('expires_in') ?? 3600)
		});
		this.bewaarInlogpoging(null);
		schoon();
		try {
			const u = (await sb('/auth/v1/user', {}, this.sessie!.access_token)) as { id: string; email: string };
			this.sessie!.user_id = u.id;
			this.sessie!.email = u.email;
			this.save();
		} catch {
			/* then we fill it in on the first sync */
		}
		this.kijkNaarWissel();
		this.message = 'Ingelogd via de link.';
	}

	/* ==========================================================
	   Welk team volgt dit toestel

	   Vier regels, en alles hieronder is een uitwerking daarvan:

	   1. Een toestel volgt precies één team. Alles wat het opstuurt gaat daarheen.
	   2. De app raadt nooit welk team dat is. Zijn er meer, dan kiest de trainer.
	   3. Het eerste contact met een team is altijd ophalen, nooit opsturen.
	   4. Overstappen kan alleen als er niets klaarstaat, en vervangt wat er hier
	      staat door dat van het andere team.

	   Regel 3 is de belangrijkste en zat er eerst niet in. Zonder die regel duwt
	   een net toegevoegde trainer zijn nog lege app naar jouw team. De
	   versiecontrole houdt dat tegen, maar hij krijgt dan een botsing te zien —
	   en één van de twee knoppen daar stuurt met opzet dit toestel eroverheen.
	   Dat is een geladen wapen in handen van iemand die net binnenkomt.
	   ========================================================== */
	/**
	 * Welk team hoort bij dit toestel?
	 *
	 * Zolang een trainer maar bij één team kon, was dit 'pak de eerste'. Sinds je
	 * ook lid kunt zijn van het team van een ander is dat gevaarlijk geworden: het
	 * verkeerde team pakken betekent dat jouw seizoen over dat van iemand anders
	 * heen gaat, en dat is met geen enkele knop terug te draaien. Dus: één team is
	 * duidelijk, geen team maken we aan, en bij meer dan één kiest de trainer.
	 */
	private async zorgVoorTeam(token: string): Promise<string> {
		const s = this.sessie!;
		/* Zolang niet duidelijk is van wie de gegevens op dit toestel zijn, gaat er
		   niets heen en weer. Anders beantwoordt de app die vraag zelf, met de
		   spelers van iemand anders. */
		if (this.andereGebruiker) {
			throw new WachtOpDeTrainer(
				'Op dit toestel staan nog de gegevens van ' + this.andereGebruiker + '. Kies bij Gegevens wat daarmee moet.'
			);
		}
		if (s.teamId) return s.teamId;

		const rijen = (await sb('/rest/v1/teams?select=id,naam&order=gemaakt.asc', {}, token)) as {
			id: string;
			naam: string;
		}[];

		this.mijnTeams = rijen ?? [];

		if (rijen?.length === 1) {
			s.teamId = rijen[0].id;
		} else if (rijen?.length > 1) {
			throw new WachtOpDeTrainer('Je hoort bij meer dan één team. Kies bij Gegevens welk team dit toestel volgt.');
		} else {
			/*
			 * Geen team. Voordat we er een aanmaken: staat er een uitnodiging klaar?
			 *
			 * Zonder deze vraag kreeg de tweede trainer bij zijn eerste inlog een eigen
			 * leeg team, en pas daarna nam hij de uitnodiging aan — met twee teams als
			 * gevolg, waarvan één nergens voor dient. Die tweede is precies wat de
			 * keuzeknoppen nodig maakte, en dus complexiteit die alleen de app zelf
			 * had veroorzaakt.
			 */
			const wachtend = (await sb('/rest/v1/uitnodigingen?select=team_id', {}, token)) as {
				team_id: string;
			}[];
			if (wachtend?.length) {
				await this.kijkNaarUitnodigingen();
				throw new WachtOpDeTrainer('Er staat een uitnodiging voor je klaar. Neem hem aan bij Gegevens.');
			}

			if (!s.user_id) {
				const u = (await sb('/auth/v1/user', {}, token)) as { id: string; email: string };
				s.user_id = u.id;
				s.email = u.email;
			}
			const gemaakt = (await sb(
				'/rest/v1/teams',
				{
					method: 'POST',
					headers: { Prefer: 'return=representation' },
					body: JSON.stringify({ naam: app.toestand.teamName, eigenaar: s.user_id })
				},
				token
			)) as { id: string }[];
			s.teamId = gemaakt[0].id;
			/* Vers aangemaakt, dus de server heeft nog niets. Dat is geen 'onbekend'
			   maar een 'leeg', en dat verschil bepaalt of er opgestuurd mag worden. */
			this.zetSpiegel({ team: s.teamId!, toestand: null, naam: app.toestand.teamName });
		}
		this.save();
		return s.teamId!;
	}

	/**
	 * Kiezen bij welk team dit toestel hoort.
	 *
	 * Alleen als er niets klaarstaat om op te sturen. Anders zou je met de gegevens
	 * van het ene team in de hand naar het andere overstappen, en die daar
	 * overheen zetten.
	 */
	/**
	 * Regel 4: overstappen naar een ander team.
	 *
	 * Het gevaarlijke aan overstappen is niet het wisselen maar het halverwege
	 * blijven steken. Zetten we eerst het teamnummer om en mislukt daarna het
	 * ophalen, dan staat de selectie van het ene team op een toestel dat het
	 * andere volgt — en de eerstvolgende wijziging duwt die de verkeerde kant op.
	 * Daarom eerst halen, en pas omzetten als dat gelukt is.
	 */
	async kiesTeam(teamId: string) {
		if (!this.sessie) return;
		if (teamId === this.sessie.teamId) return;

		/*
		 * De rem geldt alleen als dit toestel al een team volgt. Dan hoort wat er
		 * klaarstaat bij dát team, en overstappen zou het bij het andere naar binnen
		 * duwen. Volgt het nog geen team, dan hoort het klaarstaande werk nergens
		 * bij en zou de rem een doodlopende weg zijn: 'stuur eerst op' terwijl er
		 * niets is om naar op te sturen.
		 */
		if (this.vies && this.sessie.teamId) {
			this.message = 'Stuur eerst op wat hier nog klaarstaat, of haal op.';
			return;
		}

		const kwam = this.sessie.teamId;
		this.bezig = true;
		try {
			const token = await this.token();
			if (!token) return;
			/* Eerst halen, en pas omzetten als dat gelukt is. */
			await this.eersteKeer(teamId, token, !!kwam);
			this.sessie.teamId = teamId;
			this.sessie.laatst = new Date().toISOString();
			this.leden = [];
			this.openstaand = [];
			this.save();
			this.message = 'Dit toestel volgt nu ' + (this.mijnTeams.find((p) => p.id === teamId)?.naam ?? 'dit team') + '.';
			await this.haalPloeg();
			/* Stond er nog niets, dan is wat hier staat het begin van dit team. */
			this.merkVies();
		} catch (e) {
			/* Niets omgezet: het toestel volgt nog steeds hetzelfde team. */
			this.message = 'Overstappen lukte niet: ' + (e as Error).message + '. Er is niets veranderd.';
		} finally {
			this.bezig = false;
		}
	}

	/**
	 * Zelf een team beginnen.
	 *
	 * Tot nu toe ontstond een team alleen als je nog nergens bij hoorde. Wie was
	 * uitgenodigd voor het team van een ander zat daarmee vast: hij kon nooit zijn
	 * eigen ploeg beginnen. Dat is geen ondersteunende rol maar een val.
	 *
	 * Het nieuwe team begint leeg, en dat is regel 4: wat er nu in de app staat
	 * hoort bij het team dat je verlaat, en meenemen zou het daar naar binnen
	 * schrijven. Wie nog nergens bij hoorde houdt wel wat hij heeft — dat ís het
	 * begin van zijn team.
	 */
	async nieuwTeam(naam: string) {
		if (!this.sessie) return;
		const schoon = naam.trim();
		if (!schoon) {
			this.message = 'Geef het team een naam.';
			return;
		}
		if (this.vies && this.sessie.teamId) {
			this.message = 'Stuur eerst op wat hier nog klaarstaat, of haal op.';
			return;
		}
		this.bezig = true;
		try {
			const token = await this.token();
			if (!token) return;
			if (!this.sessie.user_id) {
				const u = (await sb('/auth/v1/user', {}, token)) as { id: string; email: string };
				this.sessie.user_id = u.id;
				this.sessie.email = u.email;
			}
			const gemaakt = (await sb(
				'/rest/v1/teams',
				{
					method: 'POST',
					headers: { Prefer: 'return=representation' },
					body: JSON.stringify({ naam: schoon, eigenaar: this.sessie.user_id })
				},
				token
			)) as { id: string }[];

			/* Vers aangemaakt: de server heeft nog niets. Geen 'onbekend' maar 'leeg'.
			   Dat eerst, zodat het wissen hieronder niet als een opdracht geldt. */
			this.zetSpiegel({ team: gemaakt[0].id, toestand: null, naam: schoon });
			if (this.sessie.teamId) app.wisAlles();
			app.setTeamName(schoon);
			this.sessie.teamId = gemaakt[0].id;
			this.leden = [];
			this.openstaand = [];
			this.save();
			await this.haalTeams();
			await this.opsturen(true);
			this.message = 'Nieuw team gemaakt: ' + schoon + '.';
		} catch (e) {
			this.message = 'Een nieuw team maken lukte niet: ' + (e as Error).message;
		} finally {
			this.bezig = false;
		}
	}

	/** De teams waar je bij hoort. Staat altijd op het gegevensscherm. */
	async haalTeams() {
		const token = await this.token();
		if (!token) return;
		try {
			this.mijnTeams = (await sb('/rest/v1/teams?select=id,naam&order=gemaakt.asc', {}, token)) as {
				id: string;
				naam: string;
			}[];
		} catch {
			/* geen bereik: dan een andere keer */
		}
	}

	/* ---------- wie kan erbij ---------- */
	/** De ploeg ophalen: wie er lid is en welke uitnodigingen nog openstaan. */
	async haalPloeg() {
		const token = await this.token();
		if (!token || !this.sessie?.teamId) return;
		const team = this.sessie.teamId;
		try {
			this.leden = (await sb(
				'/rest/v1/team_leden?select=gebruiker,rol,email&team_id=eq.' + team + '&order=toegevoegd.asc',
				{},
				token
			)) as Lid[];
			this.openstaand = (await sb(
				'/rest/v1/uitnodigingen?select=id,email&team_id=eq.' + team + '&order=gemaakt.asc',
				{},
				token
			)) as { id: string; email: string }[];
		} catch {
			/* Stil. Dit draait vanzelf bij het openen van het scherm, en er is niets
			   wat de trainer eraan kan doen — geen bereik, of het schema staat er nog
			   niet in. Dan verschijnt het blok gewoon niet. Een foutmelding zou hier
			   alleen maar onrust zaaien over iets wat niet van hem is. */
			this.leden = [];
			this.openstaand = [];
		}
	}

	/** Iemand uitnodigen. Op adres, niet met een code die kan rondslingeren. */
	async nodigUit(email: string) {
		const adres = email.trim();
		if (!adres.includes('@')) {
			this.message = 'Vul het e-mailadres in waarmee de ander inlogt.';
			return;
		}
		const token = await this.token();
		if (!token || !this.sessie?.teamId || !this.sessie.user_id) return;
		this.bezig = true;
		try {
			await sb(
				'/rest/v1/uitnodigingen',
				{
					method: 'POST',
					headers: { Prefer: 'return=minimal' },
					body: JSON.stringify({ team_id: this.sessie.teamId, email: adres, door: this.sessie.user_id })
				},
				token
			);
			this.message = adres + ' is uitgenodigd. Hij ziet het zodra hij inlogt.';
			await this.haalPloeg();
		} catch (e) {
			const f = e as Fout;
			/* 23505: dit adres staat er al. Dat is geen fout om de trainer mee
			   lastig te vallen; het antwoord op zijn vraag is gewoon ja. */
			this.message = f.data?.code === '23505' ? adres + ' was al uitgenodigd.' : 'Uitnodigen lukte niet: ' + f.message;
			await this.haalPloeg();
		} finally {
			this.bezig = false;
		}
	}

	/** Een uitnodiging weer intrekken zolang hij niet is aangenomen. */
	async trekIn(id: string) {
		const token = await this.token();
		if (!token) return;
		try {
			await sb('/rest/v1/uitnodigingen?id=eq.' + id, { method: 'DELETE' }, token);
			await this.haalPloeg();
		} catch (e) {
			this.message = 'Intrekken lukte niet: ' + (e as Error).message;
		}
	}

	/** Iemand er weer uit halen. De eigenaar kan er niet uit; dat weigert de database. */
	async haalEruit(gebruiker: string) {
		const token = await this.token();
		if (!token || !this.sessie?.teamId) return;
		try {
			await sb(
				'/rest/v1/team_leden?team_id=eq.' + this.sessie.teamId + '&gebruiker=eq.' + gebruiker,
				{ method: 'DELETE' },
				token
			);
			await this.haalPloeg();
		} catch (e) {
			this.message = 'Verwijderen lukte niet: ' + (e as Error).message;
		}
	}

	/* ---------- uitgenodigd worden ---------- */
	/**
	 * Staat er een uitnodiging klaar op mijn adres?
	 *
	 * De regels laten de eigenaar ook zijn eigen openstaande uitnodigingen zien —
	 * dat moet, want hij moet ze kunnen intrekken. Hier zijn die niet interessant:
	 * je hoeft jezelf niet uit te nodigen voor je eigen team.
	 */
	async kijkNaarUitnodigingen() {
		const token = await this.token();
		if (!token) return;
		try {
			const rijen = (await sb('/rest/v1/uitnodigingen?select=team_id', {}, token)) as {
				team_id: string;
			}[];
			const vreemd = rijen.filter((r) => r.team_id !== this.sessie?.teamId);
			if (!vreemd.length) {
				this.uitgenodigdVoor = [];
				return;
			}
			/* De naam erbij, anders neem je iets aan zonder te weten wat. Meer dan de
			   naam krijgt een uitgenodigde niet te zien; dat regelt de database. */
			const ids = vreemd.map((r) => r.team_id).join(',');
			const teams = (await sb('/rest/v1/teams?select=id,naam&id=in.(' + ids + ')', {}, token)) as {
				id: string;
				naam: string;
			}[];
			this.uitgenodigdVoor = vreemd.map((r) => ({
				id: r.team_id,
				naam: teams.find((t) => t.id === r.team_id)?.naam ?? 'een team'
			}));
		} catch {
			/* geen bereik, of niet ingelogd: dan een andere keer */
		}
	}

	/**
	 * Een uitnodiging aannemen.
	 *
	 * De database doet het echte werk: alleen uitnodigingen op jouw eigen adres,
	 * en jij kunt jezelf niet zomaar lid maken. Wat hier gebeurt is kiezen wat het
	 * toestel daarna volgt.
	 */
	async neemUitnodigingAan(): Promise<string[]> {
		const token = await this.token();
		if (!token) return [];
		this.bezig = true;
		try {
			/*
			 * PostgREST geeft een functie die 'setof uuid' teruggeeft als een lijst
			 * tekst terug, maar bij een andere vorm of een andere versie kan het net
			 * zo goed een lijst objecten met één veld zijn. Wat er precies uit komt
			 * zie je pas tegen de echte server, en dit is te belangrijk om op te
			 * gokken: leest de app hem verkeerd, dan zegt hij dat er geen uitnodiging
			 * klaarstond terwijl hij hem net heeft aangenomen — en dan probeert de
			 * trainer het nog eens, en nog eens. Dus allebei de vormen aankunnen.
			 */
			const rauw = (await sb('/rest/v1/rpc/uitnodiging_aannemen', { method: 'POST' }, token)) as unknown[] | null;
			const teams = (rauw ?? [])
				.map((r) => (typeof r === 'string' ? r : Object.values(r as Record<string, unknown>)[0]))
				.filter((r): r is string => typeof r === 'string');
			this.uitgenodigdVoor = [];
			if (!teams.length) {
				this.message = 'Er stond geen uitnodiging klaar op dit adres.';
				return [];
			}
			await this.haalTeams();
			this.message = 'Aangenomen. Hieronder staat welk team dit toestel volgt.';
			return teams;
		} catch (e) {
			this.message = 'Aannemen lukte niet: ' + (e as Error).message;
			return [];
		} finally {
			this.bezig = false;
		}
	}

	/* ==========================================================
	   De tabellen

	   Het toestel schrijft, de server bewaart. Wat er opgestuurd wordt is het
	   verschil tussen wat er nu staat en de spiegel: wat er volgens dit toestel
	   al in de tabellen stond. Per veld, net als de iPhone-app. Daardoor botst er
	   niets meer: twee toestellen die elk iets anders veranderen houden allebei
	   hun wijziging, en bij hetzelfde veld wint de laatste.
	   ========================================================== */

	private zetSpiegel(s: Spiegel | null) {
		this.spiegel = s ? { ...s, toestand: s.toestand ? kloon(s.toestand) : null } : null;
		this.spiegelRijen = null;
		try {
			if (s) storage()?.setItem(SPIEGELSLEUTEL, JSON.stringify(this.spiegel));
			else storage()?.removeItem(SPIEGELSLEUTEL);
		} catch {
			/* Vol of geen opslag: dan haalt hij het na herladen opnieuw op. */
		}
	}

	/** Heeft dit toestel dit team ooit opgehaald? */
	private kent(team: string): boolean {
		return this.spiegel?.team === team;
	}

	private gespiegeld(team: string): Rij[] {
		const s = this.spiegel;
		if (!s || s.team !== team) return [];
		this.spiegelRijen ??= s.toestand
			? rijen(s.toestand, team)
			: [{ tabel: 'teams', id: team, kolommen: { naam: s.naam ?? '' } }];
		return this.spiegelRijen;
	}

	/** Wat er nu staat, met een vast kenmerk voor elke wedstrijd. */
	private nu(): State {
		if (vulKenmerkenAan(app.toestand)) app.save();
		return kloon(app.toestand);
	}

	private stappen(team: string, doel = this.nu()): Wijziging[] {
		return verschil(this.gespiegeld(team), rijen(doel, team));
	}

	/** Alles wat er van dit team in de tabellen staat. */
	private async haalTabellen(team: string, token: string): Promise<Tabellen> {
		const uit: Tabellen = {};
		await Promise.all(
			TABELLEN.map(async (tabel) => {
				const filter = tabel === 'teams' || tabel === 'team_instellingen' ? 'id=eq.' : 'team_id=eq.';
				const lijst: Record<string, unknown>[] = [];
				for (let vanaf = 0; ; vanaf += PAGINA) {
					const deel = (await sb(
						`/rest/v1/${tabel}?select=*&${filter}${team}&order=id&limit=${PAGINA}&offset=${vanaf}`,
						{},
						token
					)) as Record<string, unknown>[] | null;
					lijst.push(...(deel ?? []));
					if ((deel?.length ?? 0) < PAGINA) break;
				}
				uit[tabel] = lijst;
			})
		);
		return uit;
	}

	/**
	 * De wijzigingen naar de server, tabel voor tabel.
	 *
	 * Erbij in groepen; bestaat een rij al (een ander toestel maakte hem met
	 * hetzelfde kenmerk), dan wordt hij bijgewerkt. Een gebeurtenis kan op de
	 * server niet veranderen, dus daar is 'bestaat al' gewoon klaar.
	 *
	 * Weigert de server iets (dit mag niet, dit klopt niet), dan wordt dat nooit
	 * beter van opnieuw proberen. Blijft het staan, dan komt er nooit meer iets
	 * doorheen. Dus weggooien en tellen; het volgende ophalen zet het recht.
	 * Een storing (geen bereik) gooit wel: dan blijft alles klaarstaan.
	 */
	private async schrijf(stappen: Wijziging[], token: string) {
		const nu = Date.now() / 1000;
		let volgnummer = 0;
		let geweigerd = 0;
		const waarde = (k: string, v: unknown) => (k === 'weg' && v === NU ? tijdstip(nu, 0) : v);
		const weigering = (e: unknown) => {
			const st = (e as Fout).status ?? 0;
			return st >= 400 && st < 500 && st !== 401 && st !== 408 && st !== 429;
		};
		const probeer = async (wat: () => Promise<unknown>) => {
			try {
				await wat();
			} catch (e) {
				if (!weigering(e)) throw e;
				geweigerd++;
			}
		};

		for (const tabel of TABELLEN) {
			const erbij = stappen.flatMap((w) => (w.soort === 'erbij' && w.rij.tabel === tabel ? [w.rij] : []));
			const lichamen = erbij.map((r) => {
				const o: Record<string, unknown> = { id: r.id };
				for (const [k, v] of Object.entries(r.kolommen)) o[k] = waarde(k, v);
				if (MET_VOLGORDE.has(tabel)) o.gemaakt = tijdstip(nu, volgnummer++);
				return o;
			});
			const prefer =
				(tabel === 'gebeurtenissen' || tabel === 'teams'
					? 'resolution=ignore-duplicates'
					: 'resolution=merge-duplicates') + ',return=minimal';
			const post = (lijst: unknown) =>
				sb('/rest/v1/' + tabel, { method: 'POST', headers: { Prefer: prefer }, body: JSON.stringify(lijst) }, token);
			for (let i = 0; i < lichamen.length; i += 500) {
				const groep = lichamen.slice(i, i + 500);
				try {
					await post(groep);
				} catch (e) {
					if (!weigering(e)) throw e;
					/* Eén rij die niet mag houdt de rest niet tegen. */
					for (const o of groep) await probeer(() => post([o]));
				}
			}
			for (const w of stappen) {
				if (w.soort !== 'bij' || w.tabel !== tabel) continue;
				const o: Record<string, unknown> = {};
				for (const [k, v] of Object.entries(w.kolommen)) o[k] = waarde(k, v);
				await probeer(() =>
					sb(
						`/rest/v1/${tabel}?id=eq.${w.id}`,
						{ method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) },
						token
					)
				);
			}
		}
		for (const tabel of [...TABELLEN].reverse()) {
			const weg = stappen.flatMap((w) => (w.soort === 'weg' && w.tabel === tabel ? [w.id] : []));
			for (let i = 0; i < weg.length; i += 100) {
				const ids = weg.slice(i, i + 100).join(',');
				await probeer(() => sb(`/rest/v1/${tabel}?id=in.(${ids})`, { method: 'DELETE' }, token));
			}
		}
		if (geweigerd) {
			this.geweigerd += geweigerd;
			reportIssue(
				'De server weigerde ' +
					geweigerd +
					(geweigerd === 1 ? ' wijziging' : ' wijzigingen') +
					'. Die zijn niet bewaard.'
			);
		}
	}

	/**
	 * Regel 3: het eerste contact met een team is ophalen.
	 *
	 * Staat er al iets in de tabellen, dan wordt dat wat hier staat, en wat hier
	 * stond gaat apart. Staat er nog niets, dan kijken we één keer in het oude
	 * blok (van vóór de tabellen) en verhuizen dat. En anders is wat hier staat
	 * het begin van het team — tenzij we van een ander team komen, want dan hoort
	 * het daarbij.
	 *
	 * Daarna kent dit toestel het team. Opsturen doet de aanroeper.
	 */
	private async eersteKeer(team: string, token: string, kwam = false) {
		const tabellen = await this.haalTabellen(team, token);
		const naam = tabellen.teams?.[0]?.naam;
		if (typeof naam !== 'string') throw new Error('dit team staat niet (meer) in je account');
		const server = toestand(tabellen, team);
		const gevuld = ['spelers', 'wedstrijden', 'trainingen'].some((t) => (tabellen[t] ?? []).length > 0);
		const hierIets = app.toestand.players.length > 0 || app.toestand.archive.length > 0;

		if (server && gevuld) {
			if (hierIets && !kwam) app.bewaarApart('voor-account');
			this.zetSpiegel({ team, toestand: server });
			app.neemOver(server);
			return;
		}

		this.zetSpiegel({ team, toestand: null, naam });
		const oud = await this.oudBlok(team, token);
		const hierNieuwer = hierIets && !kwam && oud !== null && this.sessie?.versie === oud.versie;
		if (oud && !hierNieuwer) {
			app.neemOver(oud.toestand);
		} else if (kwam) {
			app.wisAlles();
		}
		/* 'Ons team' is wat er staat als er niets is ingevuld. Daarmee mag de app het
		   team van een ander niet hernoemen. */
		if (app.toestand.teamName === 'Ons team') app.setTeamName(naam);
	}

	/** Het oude blok van dit team, als dat er nog is en te lezen valt. */
	private async oudBlok(team: string, token: string): Promise<{ toestand: State; versie: number } | null> {
		try {
			const r = (await sb('/rest/v1/team_toestand?select=data,versie&team_id=eq.' + team, {}, token)) as
				{ data: unknown; versie: number }[] | null;
			const d = r?.length ? (migreerToestand(r[0].data) as Partial<State> | null) : null;
			if (!d || !Array.isArray(d.players)) return null;
			return { toestand: { ...emptyState(), ...d, match: d.match ?? null }, versie: r![0].versie };
		} catch {
			/* Geen oud blok, of de tabel is er niet meer: niets te verhuizen. */
			return null;
		}
	}

	/** Stuurt op wat er hier veranderde. Met `stil` vanzelf, op de achtergrond. */
	async opsturen(stil = false) {
		if (!this.sessie) return;
		/* Met de hand op de knop drukken haalt de rem eraf: dan beslist de trainer. */
		if (!stil) noodrem.los();
		this.bezig = !stil;
		if (!stil) this.message = 'Bezig met bijwerken…';
		try {
			const token = await this.token();
			if (!token) {
				this.message = 'Je bent uitgelogd, log opnieuw in.';
				return;
			}
			const team = await this.zorgVoorTeam(token);
			if (!this.kent(team)) await this.eersteKeer(team, token);

			const doel = this.nu();
			/*
			 * Nooit een team leegmaken omdat er hier niets staat. Een lege app is
			 * bijna altijd een nieuw of gewist toestel, en geen trainer die zijn
			 * seizoen weg wil hebben. Dan halen we op in plaats van op te sturen.
			 */
			const leeg = !doel.players.length && !doel.archive.length && !doel.trainings.length;
			if (leeg && this.spiegel?.toestand?.players.length) {
				this.zetSpiegel(null);
				await this.eersteKeer(team, token);
				this.vies = false;
				this.message = stil ? '' : 'Op dit toestel stond niets; opgehaald wat er in je account staat.';
				return;
			}
			const stappen = this.stappen(team, doel);
			if (stappen.length) await this.schrijf(stappen, token);
			this.zetSpiegel({ team, toestand: doel });
			this.sessie.laatst = new Date().toISOString();
			this.save();
			this.hapert = false;
			this.mislukt = 0;
			this.message = stil ? '' : 'Bijgewerkt.';
			/* Intussen getikt? Dan staat er alweer iets klaar. */
			this.merkVies();
		} catch (e) {
			if (e instanceof WachtOpDeTrainer) {
				this.message = (e as Error).message;
				return;
			}
			this.hapert = true;
			if ((e as Fout).status === 429) {
				/* De noodrem. Doorproberen is precies wat we net hebben tegengehouden. */
				this.message = (e as Error).message;
				return;
			}
			this.mislukt++;
			this.message = 'Bijwerken lukte niet: ' + (e as Error).message;
			this.plan(this.wachttijd());
		} finally {
			this.bezig = false;
		}
	}

	/**
	 * Halen wat er in de tabellen staat.
	 *
	 * Stil: alleen als hier niets klaarstaat, en niet als de trainer intussen iets
	 * deed; dat gaat eerst de andere kant op. Met de hand: wat hier staat wordt
	 * vervangen, ook wat nog niet was opgestuurd. Daarom vraagt hij het eerst.
	 */
	async ophalen(stil = false) {
		if (!this.sessie) return;
		if (
			!stil &&
			!confirm(
				'Alles op dit toestel vervangen door wat er in je account staat?\n\nWat hier nog niet was opgestuurd gaat dan verloren.'
			)
		)
			return;
		if (stil && this.vies) return; /* never over your own work */
		if (!stil) noodrem.los();
		this.bezig = !stil;
		if (!stil) this.message = 'Bezig met ophalen…';
		try {
			const token = await this.token();
			if (!token) {
				this.message = 'Je bent uitgelogd, log opnieuw in.';
				return;
			}
			const team = await this.zorgVoorTeam(token);
			if (!this.kent(team)) {
				await this.eersteKeer(team, token);
			} else {
				const tik = this.tikken;
				const server = toestand(await this.haalTabellen(team, token), team);
				if (!server) throw new Error('dit team staat niet (meer) in je account');
				/* Getikt terwijl we haalden: eerst dat opsturen, dan een volgende keer. */
				if (stil && (this.tikken !== tik || this.vies)) return;
				this.zetSpiegel({ team, toestand: server });
				if (!stil || verschil(rijen(this.nu(), team), rijen(server, team)).length) app.neemOver(server);
			}
			this.sessie.laatst = new Date().toISOString();
			this.save();
			this.hapert = false;
			this.mislukt = 0;
			this.message = stil ? '' : 'Opgehaald.';
			this.merkVies();
		} catch (e) {
			if (e instanceof WachtOpDeTrainer) {
				this.message = (e as Error).message;
				return;
			}
			this.hapert = true;
			if ((e as Fout).status === 429) {
				this.message = (e as Error).message;
				return;
			}
			if (!stil) this.message = 'Ophalen lukte niet: ' + (e as Error).message;
		} finally {
			this.bezig = false;
		}
	}

	/* ==========================================================
	   Syncing by itself
	   We push as soon as something has changed and there is signal; we only pull
	   when nothing is waiting here, otherwise we would overwrite your own work.
	   ========================================================== */

	/** Called after every save. */
	merkVies() {
		this.tikken++;
		if (!this.sessie) return;
		const team = this.sessie.teamId;
		/* Een team dat we nog nooit haalden: dan is er altijd iets te doen, en dat
		   begint met ophalen. */
		this.vies = team && this.kent(team) ? this.stappen(team).length > 0 : true;
		if (this.vies) this.plan();
	}

	/** Na elke mislukking twee keer zo lang, tot vijf minuten. */
	private wachttijd(): number {
		return Math.min(Sync.LANGSTE_WACHT, 4000 * 2 ** Math.max(0, this.mislukt - 1));
	}

	/** Wait until things settle; otherwise we push on every single tap. */
	private plan(na = 4000) {
		if (this.wachter) clearTimeout(this.wachter);
		this.wachter = setTimeout(() => this.duwAlsNodig(), na);
	}

	async duwAlsNodig() {
		if (!this.sessie || !this.vies || this.bezigMetDuwen) return;
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			this.hapert = true;
			return;
		}
		this.bezigMetDuwen = true;
		try {
			await this.opsturen(true);
		} finally {
			this.bezigMetDuwen = false;
		}
	}

	/** On opening the app, when you come back to it, and every minute while it is in front of you. */
	async kijkEven() {
		if (!this.sessie) return;
		/* Stil op de achtergrond: een uitnodiging die klaarstaat wil je zien zonder
		   ernaar te hoeven zoeken. */
		void this.kijkNaarUitnodigingen();
		if (this.vies) await this.duwAlsNodig();
		if (this.vies) return;
		await this.ophalen(true);
		/* De eerste keer kan er na het ophalen iets te verhuizen zijn. */
		if (this.vies) await this.duwAlsNodig();
	}
}

export const sync = new Sync();
