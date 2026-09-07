import { app } from '$lib/store.svelte';
import { SUPABASE_SLEUTEL, SUPABASE_URL } from './config';

const SESSIESLEUTEL = 'o14-sessie-v1';
/* On a phone you switch to your mail in between, which can reload the app.
   That is why we remember who we requested a code for. */
const INLOGSLEUTEL = 'o14-inlog-v1';

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** A cheap fingerprint, to see whether anything really changed. */
function vingerafdruk(waarde: unknown): string {
	const tekst = JSON.stringify(waarde);
	let h = 5381;
	for (let i = 0; i < tekst.length; i++) h = ((h << 5) + h + tekst.charCodeAt(i)) | 0;
	return tekst.length + ':' + (h >>> 0).toString(36);
}

interface Sessie {
	access_token: string;
	refresh_token: string;
	/** when the token expires, in ms */
	verloopt: number;
	user_id?: string | null;
	email?: string | null;
	teamId?: string | null;
	versie?: number;
	laatst?: string | null;
	/** fingerprint of what last arrived successfully */
	afdruk?: string | null;
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
	/** wanneer de rem eraf mag; 0 = hij staat er niet op */
	tot = 0;

	/** Mag er nog een verzoek uit? Zo niet, dan staat de rem erop. */
	mag(nu: number): boolean {
		if (this.tot) {
			if (nu < this.tot) return false;
			this.los();
		}
		this.stempels = this.stempels.filter((s) => nu - s < RAAM);
		if (this.stempels.length >= GRENS) {
			this.tot = nu + AFKOELEN;
			return false;
		}
		this.stempels.push(nu);
		return true;
	}

	/** Met de hand opnieuw proberen mag altijd; dan beslist de trainer. */
	los() {
		this.tot = 0;
		this.stempels = [];
	}
}

export const noodrem = new Noodrem();

async function sb(pad: string, opties: RequestInit & { metToken?: boolean } = {}, token?: string) {
	if (!noodrem.mag(Date.now())) {
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
		const d = data as { message?: string; msg?: string; error_description?: string; code?: string };
		const fout = new Error(d?.message ?? d?.msg ?? d?.error_description ?? 'fout ' + r.status) as Fout;
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
	/** the server has something newer; then the coach decides, not the app */
	botsing = $state(false);
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

	load() {
		const bak = storage();
		if (!bak) return;
		try {
			this.sessie = JSON.parse(bak.getItem(SESSIESLEUTEL) ?? 'null');
		} catch {
			this.sessie = null;
		}
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
			versie: oud?.versie ?? 0,
			laatst: oud?.laatst ?? null
		};
		this.save();
	}

	uitloggen() {
		this.sessie = null;
		this.message = '';
		this.vies = false;
		this.botsing = false;
		this.mijnTeams = [];
		this.leden = [];
		this.openstaand = [];
		this.uitgenodigdVoor = [];
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
		} catch {
			this.uitloggen();
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
			s.versie = 0;
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
			const rijen = (await sb('/rest/v1/team_toestand?select=data,versie&team_id=eq.' + teamId, {}, token)) as
				{ data: ReturnType<typeof app.syncPayload>; versie: number }[] | null;

			if (rijen?.length) {
				if (!app.adoptSyncPayload(rijen[0].data)) {
					this.message = 'Wat er bij dat team staat kon ik niet lezen. Er is niets veranderd.';
					return;
				}
				this.sessie.versie = rijen[0].versie;
			} else if (kwam) {
				/*
				 * Een leeg team, en we kwamen van een ander. Wat hier staat is dan van
				 * dát team, en meenemen zou het bij het nieuwe naar binnen schrijven.
				 * Dus schoon beginnen. Kwamen we nergens vandaan, dan is wat hier staat
				 * juist het begin van dit team en blijft het staan.
				 */
				app.wisAlles();
				this.sessie.versie = 0;
			} else {
				this.sessie.versie = 0;
			}

			this.sessie.teamId = teamId;
			this.sessie.afdruk = vingerafdruk(app.syncPayload());
			this.sessie.laatst = new Date().toISOString();
			this.leden = [];
			this.openstaand = [];
			this.vies = false;
			this.botsing = false;
			this.save();
			this.message = 'Dit toestel volgt nu ' + (this.mijnTeams.find((p) => p.id === teamId)?.naam ?? 'dit team') + '.';
			await this.haalPloeg();
		} catch (e) {
			/* Niets omgezet: het toestel volgt nog steeds hetzelfde team. */
			this.message = 'Overstappen lukte niet: ' + (e as Error).message + '. Er is niets veranderd.';
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
				'/rest/v1/team_leden?select=gebruiker,rol&team_id=eq.' + team + '&order=toegevoegd.asc',
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

	private isBotsing(e: Fout): boolean {
		/* De tekst komt uit de database en is Nederlands; de hernoeming naar het
		   Engels maakte er 'versie running niet gelijk' van, waardoor een conflict
		   niet meer als conflict werd herkend en de rem er nooit op ging. */
		return e.data?.code === '40001' || /versie loopt niet gelijk/.test(e.message ?? '');
	}

	async opsturen(overschrijven = false, stil = false) {
		if (!this.sessie) return;
		/* Met de hand op de knop drukken haalt de rem eraf: dan beslist de trainer. */
		if (!stil) noodrem.los();
		this.bezig = !stil;
		if (!stil) this.message = 'Bezig met opsturen…';
		try {
			const token = await this.token();
			if (!token) {
				this.message = 'Je bent uitgelogd, log opnieuw in.';
				return;
			}
			const team = await this.zorgVoorTeam(token);
			/*
			 * Regel 3. Weten we niet op welke versie we bouwen, dan hebben we dit team
			 * nog nooit opgehaald — en dan is opsturen het overschrijven van iets wat
			 * we niet gezien hebben.
			 */
			if (this.sessie.versie === undefined && !overschrijven) {
				const naam = this.mijnTeams.find((p) => p.id === team)?.naam ?? 'dit team';
				this.message = `Dit toestel heeft de gegevens van ${naam} nog niet opgehaald. Doe dat eerst met Ophalen.`;
				return;
			}
			let verwacht: number | null = this.sessie.versie ?? null;
			if (overschrijven) {
				const nu = (await sb('/rest/v1/team_toestand?select=versie&team_id=eq.' + team, {}, token)) as {
					versie: number;
				}[];
				verwacht = nu?.length ? nu[0].versie : null;
			}
			const pakket = app.syncPayload();
			const r = (await sb(
				'/rest/v1/rpc/toestand_opslaan',
				{ method: 'POST', body: JSON.stringify({ p_team_id: team, p_data: pakket, p_verwachte_versie: verwacht }) },
				token
			)) as { versie: number } | null;
			this.sessie.versie = r?.versie ?? (this.sessie.versie ?? 0) + 1;
			this.sessie.laatst = new Date().toISOString();
			this.sessie.afdruk = vingerafdruk(pakket);
			this.save();
			this.vies = false;
			this.botsing = false;
			this.hapert = false;
			this.mislukt = 0;
			this.message = 'Opgestuurd.';
		} catch (e) {
			if (e instanceof WachtOpDeTrainer) {
				this.message = (e as Error).message;
				return;
			}
			if ((e as Fout).status === 429) {
				/* De noodrem. Doorproberen is precies wat we net hebben tegengehouden. */
				this.hapert = true;
				this.message = (e as Error).message;
				return;
			}
			this.mislukt++;
			if (this.isBotsing(e as Fout)) {
				this.botsing = true;
				/* Hier beslist de trainer; de app probeert niet vanzelf opnieuw. */
				this.message =
					'Op de server staat iets nieuwers, van een ander toestel. Haal het eerst op, of stuur dit toestel er met opzet overheen.';
			} else {
				this.hapert = true;
				this.message = 'Opsturen lukte niet: ' + (e as Error).message;
				this.plan(this.wachttijd());
			}
		} finally {
			this.bezig = false;
		}
	}

	async ophalen(stil = false) {
		if (!this.sessie) return;
		if (
			!stil &&
			!confirm(
				'De selectie, standaardopstelling, trainingen, het archief en de wedstrijd die klaarstaat op dit toestel vervangen door wat er op de server staat?\n\nEen wedstrijd die hier al loopt blijft staan.'
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
			const rijen = (await sb('/rest/v1/team_toestand?select=data,versie&team_id=eq.' + team, {}, token)) as
				{ data: ReturnType<typeof app.syncPayload>; versie: number }[] | null;
			if (!rijen?.length) {
				/* nothing on the server yet: then what is here is the beginning */
				if (stil) {
					this.vies = true;
					await this.duwAlsNodig();
				} else {
					this.message = 'Er staat nog niets op de server.';
				}
				return;
			}
			if (stil && this.sessie.versie === rijen[0].versie) return; /* already in step */
			if (!app.adoptSyncPayload(rijen[0].data)) {
				this.message = 'Wat er staat kon ik niet lezen.';
				return;
			}
			this.sessie.versie = rijen[0].versie;
			this.sessie.laatst = new Date().toISOString();
			this.sessie.afdruk = vingerafdruk(app.syncPayload());
			this.save();
			this.vies = false;
			this.botsing = false;
			this.hapert = false;
			this.mislukt = 0;
			this.message = stil ? '' : 'Opgehaald.';
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

	get botsingOpen(): boolean {
		return this.botsing;
	}

	/* ==========================================================
	   Syncing by itself
	   The device writes, the server keeps. We push as soon as something has
	   changed and there is signal; we only pull when nothing is waiting here,
	   otherwise we would overwrite your own work.
	   ========================================================== */

	/** Called after every save. */
	merkVies() {
		if (!this.sessie) return;
		const nu = vingerafdruk(app.syncPayload());
		if (nu === this.sessie.afdruk) return; /* nothing changed that concerns the server */
		this.vies = true;
		this.plan();
	}

	/** Wait until things settle; otherwise we push on every single tap during a
	    match. */
	/** Na elke mislukking twee keer zo lang, tot vijf minuten. */
	private wachttijd(): number {
		return Math.min(Sync.LANGSTE_WACHT, 4000 * 2 ** Math.max(0, this.mislukt - 1));
	}

	private plan(na = 4000) {
		if (this.wachter) clearTimeout(this.wachter);
		this.wachter = setTimeout(() => this.duwAlsNodig(), na);
	}

	async duwAlsNodig() {
		if (!this.sessie || !this.vies || this.bezigMetDuwen || this.botsing) return;
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			this.hapert = true;
			return;
		}
		this.bezigMetDuwen = true;
		try {
			await this.opsturen(false, true);
		} finally {
			this.bezigMetDuwen = false;
		}
	}

	/** On opening the app, and when you come back from another screen. */
	async kijkEven() {
		if (!this.sessie) return;
		/* Stil op de achtergrond: een uitnodiging die klaarstaat wil je zien zonder
		   ernaar te hoeven zoeken. */
		void this.kijkNaarUitnodigingen();
		if (this.vies) {
			await this.duwAlsNodig();
			return;
		}
		try {
			await this.ophalen(true);
		} catch {
			/* no signal: then later */
		}
		/* And then check whether what is here still matches what the server has. Up
		   to now we only noticed that after a change, which is too late when
		   something is added to what we exchange: then everything that was already
		   there is suddenly new, while nobody touched a thing. */
		this.merkVies();
	}
}

export const sync = new Sync();
