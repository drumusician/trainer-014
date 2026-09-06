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

async function sb(pad: string, opties: RequestInit & { metToken?: boolean } = {}, token?: string) {
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
	private bezigMetDuwen = false;

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
				{
					method: 'POST',
					headers: { Prefer: 'return=representation' },
					body: JSON.stringify({ name: app.toestand.teamName, eigenaar: s.user_id })
				},
				token
			)) as { id: string }[];
			s.teamId = nieuw[0].id;
		}
		this.save();
		return s.teamId!;
	}

	private isBotsing(e: Fout): boolean {
		return e.data?.code === '40001' || /versie running niet gelijk/.test(e.message ?? '');
	}

	async opsturen(overschrijven = false, stil = false) {
		if (!this.sessie) return;
		this.bezig = !stil;
		if (!stil) this.message = 'Bezig met opsturen…';
		try {
			const token = await this.token();
			if (!token) {
				this.message = 'Je bent uitgelogd, log opnieuw in.';
				return;
			}
			const team = await this.zorgVoorTeam(token);
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
			this.message = 'Opgestuurd.';
		} catch (e) {
			if (this.isBotsing(e as Fout)) {
				this.botsing = true;
				this.message =
					'Op de server staat iets nieuwers, van een ander toestel. Haal het eerst op, of stuur dit toestel er met opzet overheen.';
			} else {
				this.hapert = true;
				this.message = 'Opsturen lukte niet: ' + (e as Error).message;
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
			this.message = stil ? '' : 'Opgehaald.';
		} catch (e) {
			this.hapert = true;
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
