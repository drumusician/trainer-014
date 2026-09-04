import { app } from '$lib/toestand.svelte';
import { SUPABASE_SLEUTEL, SUPABASE_URL } from './config';

const SESSIESLEUTEL = 'o14-sessie-v1';
/* Op een telefoon ga je tussendoor naar je mail; dan kan de app opnieuw laden.
   Daarom onthouden we voor wie we een code aanvroegen. */
const INLOGSLEUTEL = 'o14-inlog-v1';

const opslag = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** Goedkoop vingerafdrukje, om te zien of er echt iets veranderd is. */
function vingerafdruk(waarde: unknown): string {
	const tekst = JSON.stringify(waarde);
	let h = 5381;
	for (let i = 0; i < tekst.length; i++) h = ((h << 5) + h + tekst.charCodeAt(i)) | 0;
	return tekst.length + ':' + (h >>> 0).toString(36);
}

interface Sessie {
	access_token: string;
	refresh_token: string;
	/** wanneer het token verloopt, in ms */
	verloopt: number;
	user_id?: string | null;
	email?: string | null;
	teamId?: string | null;
	versie?: number;
	laatst?: string | null;
	/** vingerafdruk van wat er als laatste goed is aangekomen */
	afdruk?: string | null;
}

interface Fout extends Error {
	status?: number;
	data?: { code?: string; message?: string };
}

async function sb(pad: string, opties: RequestInit & { metToken?: boolean } = {}, token?: string) {
	const kop: Record<string, string> = {
		apikey: SUPABASE_SLEUTEL,
		'Content-Type': 'application/json',
		...((opties.headers as Record<string, string>) ?? {})
	};
	if (opties.metToken !== false && token) kop.Authorization = 'Bearer ' + token;

	const r = await fetch(SUPABASE_URL + pad, { ...opties, headers: kop });
	const tekst = await r.text();
	let data: unknown = null;
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

class Sync {
	sessie = $state<Sessie | null>(null);
	melding = $state('');
	bezig = $state(false);
	/** 'email' of 'code' */
	fase = $state<'email' | 'code'>('email');
	email = $state('');

	/* ---------- vanzelf bijwerken ---------- */
	/** er staan wijzigingen klaar die de server nog niet heeft */
	vies = $state(false);
	/** de server heeft iets nieuwers; dan beslist de trainer, niet de app */
	botsing = $state(false);
	/** laatste poging mislukt (meestal: geen bereik) */
	hapert = $state(false);
	private wachter: ReturnType<typeof setTimeout> | null = null;
	private bezigMetDuwen = false;

	laad() {
		const bak = opslag();
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
				this.melding = 'Er is een code onderweg naar ' + wachtend.email + '.';
			}
		} catch {
			/* stil */
		}
	}

	private bewaarInlogpoging(email: string | null) {
		const bak = opslag();
		if (!bak) return;
		try {
			if (email) bak.setItem(INLOGSLEUTEL, JSON.stringify({ email, sinds: Date.now() }));
			else bak.removeItem(INLOGSLEUTEL);
		} catch {
			/* stil */
		}
	}

	private bewaar() {
		const bak = opslag();
		if (!bak) return;
		try {
			bak.setItem(SESSIESLEUTEL, JSON.stringify(this.sessie));
		} catch {
			/* stil */
		}
	}

	private zet(d: { access_token: string; refresh_token: string; expires_in?: number; user?: { id: string; email: string } }) {
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
		this.bewaar();
	}

	uitloggen() {
		this.sessie = null;
		this.melding = '';
		this.vies = false;
		this.botsing = false;
		opslag()?.removeItem(SESSIESLEUTEL);
		this.bewaarInlogpoging(null);
	}

	/** Toch een ander adres proberen. */
	opnieuw() {
		this.fase = 'email';
		this.melding = '';
		this.bewaarInlogpoging(null);
	}

	/** Het token is een uur geldig; op tijd vernieuwen scheelt opnieuw inloggen. */
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

	/* ---------- inloggen ---------- */
	async stuurCode(email: string) {
		if (!email.trim()) {
			this.melding = 'Vul je e-mailadres in.';
			return;
		}
		this.bezig = true;
		this.melding = 'Bezig met versturen…';
		try {
			const terug = location.origin + '/';
			await sb('/auth/v1/otp?redirect_to=' + encodeURIComponent(terug), {
				method: 'POST',
				metToken: false,
				body: JSON.stringify({ email: email.trim(), create_user: true })
			});
			this.email = email.trim();
			this.fase = 'code';
			this.bewaarInlogpoging(this.email);
			this.melding = 'Mail verstuurd naar ' + this.email + '. Kijk ook in je spam.';
		} catch (e) {
			this.melding = 'Versturen lukte niet: ' + (e as Error).message;
		} finally {
			this.bezig = false;
		}
	}

	async controleerCode(code: string) {
		if (!code.trim()) {
			this.melding = 'Vul de code uit de mail in.';
			return;
		}
		this.bezig = true;
		this.melding = 'Bezig met inloggen…';
		try {
			const d = (await sb('/auth/v1/verify', {
				method: 'POST',
				metToken: false,
				body: JSON.stringify({ email: this.email, token: code.trim(), type: 'email' })
			})) as Parameters<Sync['zet']>[0];
			this.zet(d);
			this.fase = 'email';
			this.bewaarInlogpoging(null);
			this.melding = 'Ingelogd.';
		} catch (e) {
			this.melding = 'Deze code klopt niet of is verlopen: ' + (e as Error).message;
		} finally {
			this.bezig = false;
		}
	}

	/** Terug uit de mail: de sleutels staan achter een # in het adres. */
	async pakInlogUitLink() {
		if (typeof location === 'undefined') return;
		const h = location.hash ?? '';
		const schoon = () => history.replaceState(null, '', location.pathname + location.search);
		if (!h.includes('access_token=')) {
			if (h.includes('error')) {
				const f = new URLSearchParams(h.replace(/^#/, ''));
				this.melding = 'Inloggen via de link lukte niet: ' + (f.get('error_description') ?? f.get('error') ?? 'onbekende fout');
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
			this.bewaar();
		} catch {
			/* dan vullen we het bij de eerste synchronisatie aan */
		}
		this.melding = 'Ingelogd via de link.';
	}

	/* ---------- team ---------- */
	private async zorgVoorTeam(token: string): Promise<string> {
		const s = this.sessie!;
		if (s.teamId) return s.teamId;
		const rijen = (await sb('/rest/v1/teams?select=id&order=gemaakt.asc&limit=1', {}, token)) as { id: string }[];
		if (rijen?.length) {
			s.teamId = rijen[0].id;
		} else {
			if (!s.user_id) {
				const u = (await sb('/auth/v1/user', {}, token)) as { id: string; email: string };
				s.user_id = u.id;
				s.email = u.email;
			}
			const nieuw = (await sb(
				'/rest/v1/teams',
				{ method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ naam: 'O14', eigenaar: s.user_id }) },
				token
			)) as { id: string }[];
			s.teamId = nieuw[0].id;
		}
		this.bewaar();
		return s.teamId!;
	}

	private isBotsing(e: Fout): boolean {
		return e.data?.code === '40001' || /versie loopt niet gelijk/.test(e.message ?? '');
	}

	async opsturen(overschrijven = false, stil = false) {
		if (!this.sessie) return;
		this.bezig = !stil;
		if (!stil) this.melding = 'Bezig met opsturen…';
		try {
			const token = await this.token();
			if (!token) {
				this.melding = 'Je bent uitgelogd, log opnieuw in.';
				return;
			}
			const team = await this.zorgVoorTeam(token);
			let verwacht: number | null = this.sessie.versie ?? null;
			if (overschrijven) {
				const nu = (await sb('/rest/v1/team_toestand?select=versie&team_id=eq.' + team, {}, token)) as { versie: number }[];
				verwacht = nu?.length ? nu[0].versie : null;
			}
			const pakket = app.syncPakket();
			const r = (await sb(
				'/rest/v1/rpc/toestand_opslaan',
				{ method: 'POST', body: JSON.stringify({ p_team_id: team, p_data: pakket, p_verwachte_versie: verwacht }) },
				token
			)) as { versie: number } | null;
			this.sessie.versie = r?.versie ?? (this.sessie.versie ?? 0) + 1;
			this.sessie.laatst = new Date().toISOString();
			this.sessie.afdruk = vingerafdruk(pakket);
			this.bewaar();
			this.vies = false;
			this.botsing = false;
			this.hapert = false;
			this.melding = 'Opgestuurd.';
		} catch (e) {
			if (this.isBotsing(e as Fout)) {
				this.botsing = true;
				this.melding = 'Op de server staat iets nieuwers, van een ander toestel. Haal het eerst op, of stuur dit toestel er met opzet overheen.';
			} else {
				this.hapert = true;
				this.melding = 'Opsturen lukte niet: ' + (e as Error).message;
			}
		} finally {
			this.bezig = false;
		}
	}

	async ophalen(stil = false) {
		if (!this.sessie) return;
		if (!stil && !confirm('De selectie, standaardopstelling, trainingen en het archief op dit toestel vervangen door wat er op de server staat?'))
			return;
		if (stil && this.vies) return; /* nooit over eigen werk heen */
		this.bezig = !stil;
		if (!stil) this.melding = 'Bezig met ophalen…';
		try {
			const token = await this.token();
			if (!token) {
				this.melding = 'Je bent uitgelogd, log opnieuw in.';
				return;
			}
			const team = await this.zorgVoorTeam(token);
			const rijen = (await sb('/rest/v1/team_toestand?select=data,versie&team_id=eq.' + team, {}, token)) as
				| { data: ReturnType<typeof app.syncPakket>; versie: number }[]
				| null;
			if (!rijen?.length) {
				/* nog niets op de server: dan is wat hier staat het begin */
				if (stil) {
					this.vies = true;
					await this.duwAlsNodig();
				} else {
					this.melding = 'Er staat nog niets op de server.';
				}
				return;
			}
			if (stil && this.sessie.versie === rijen[0].versie) return; /* al gelijk */
			if (!app.neemSyncOver(rijen[0].data)) {
				this.melding = 'Wat er staat kon ik niet lezen.';
				return;
			}
			this.sessie.versie = rijen[0].versie;
			this.sessie.laatst = new Date().toISOString();
			this.sessie.afdruk = vingerafdruk(app.syncPakket());
			this.bewaar();
			this.vies = false;
			this.botsing = false;
			this.hapert = false;
			this.melding = stil ? '' : 'Opgehaald.';
		} catch (e) {
			this.hapert = true;
			if (!stil) this.melding = 'Ophalen lukte niet: ' + (e as Error).message;
		} finally {
			this.bezig = false;
		}
	}

	get botsingOpen(): boolean {
		return this.botsing;
	}

	/* ==========================================================
	   Vanzelf bijwerken
	   Het toestel schrijft, de server bewaart. We sturen op zodra er iets
	   veranderd is en er bereik is; we halen alleen op als er hier niets
	   klaarstaat, anders zouden we je eigen werk overschrijven.
	   ========================================================== */

	/** Wordt na elke opslag geroepen. */
	merkVies() {
		if (!this.sessie) return;
		const nu = vingerafdruk(app.syncPakket());
		if (nu === this.sessie.afdruk) return; /* alleen de lopende wedstrijd veranderde */
		this.vies = true;
		this.plan();
	}

	/** Even wachten tot het rustig is; anders sturen we tijdens een wedstrijd
	    bij elke tik iets op. */
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

	/** Bij het openen van de app, en als je terugkomt uit een ander scherm. */
	async kijkEven() {
		if (!this.sessie) return;
		if (this.vies) {
			await this.duwAlsNodig();
			return;
		}
		try {
			await this.ophalen(true);
		} catch {
			/* geen bereik: dan later */
		}
	}
}

export const sync = new Sync();
