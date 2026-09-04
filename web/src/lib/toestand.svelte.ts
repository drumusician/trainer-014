import { plekken } from './domein/formaties';
import { eindTijd, keepertijden, speeltijden, stand, verstreken } from './domein/tijd';
import { sorteerTrainingen } from './domein/presentie';
import type {
	Aanwezigheid, ArchiefWedstrijd, Gebeurtenis, GebeurtenisType, Opstelling,
	Speler, Toestand, Training, Veldlinie, Wedstrijd
} from './domein/types';
import { legeToestand } from './domein/types';

const SLEUTEL = 'o14-app-v1';

/** Draaien we ergens met opslag? Op de server niet, in een test wel. */
const opslag = () => (typeof localStorage === 'undefined' ? null : localStorage);

function nieuwId(voorvoegsel = 'p'): string {
	return voorvoegsel + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Oude opslag: 'K' was een linie. Nu staat keepen daarnaast. */
function migreer(t: Toestand): Toestand {
	t.spelers.forEach((p) => {
		if ((p.linie as string) === 'K') {
			p.linie = '';
			p.keept = true;
		}
	});
	if (!Array.isArray(t.trainingen)) t.trainingen = [];
	t.trainingen.forEach((tr, i) => {
		if (!tr.id) tr.id = 't' + (tr.datum ?? 'onbekend') + '-' + i; /* van voor de id's */
	});
	if (!Array.isArray(t.archief)) t.archief = [];
	return t;
}

class App {
	toestand = $state<Toestand>(legeToestand());
	/** loopt mee met de klok, zodat schermen vanzelf bijwerken */
	nu = $state(Date.now());
	/** de plek die je hebt aangetikt om te wisselen */
	gekozenPlek = $state<string | null>(null);
	/** wordt na elke opslag geroepen, zodat de synchronisatie het weet */
	naBewaren: (() => void) | null = null;

	laad() {
		const bak = opslag();
		if (!bak) return;
		try {
			const ruw = bak.getItem(SLEUTEL);
			if (!ruw) return;
			const d = JSON.parse(ruw);
			if (d && Array.isArray(d.spelers)) {
				this.toestand = migreer({ ...legeToestand(), ...d });
				this.bewaar(); /* wat de migratie erbij zette, meteen vastleggen */
			}
		} catch {
			/* liever een lege app dan een stukke */
		}
	}

	bewaar() {
		const bak = opslag();
		if (!bak) return;
		try {
			bak.setItem(SLEUTEL, JSON.stringify(this.toestand));
		} catch {
			/* stil: vol geheugen mag de wedstrijd niet stoppen */
		}
		this.naBewaren?.();
	}

	/* ---------- selectie ---------- */
	spelerVan(id: string | null | undefined): Speler | undefined {
		return id ? this.toestand.spelers.find((p) => p.id === id) : undefined;
	}

	namenErbij(tekst: string) {
		tekst.split('\n').map((x) => x.trim()).filter(Boolean).forEach((naam) => {
			this.toestand.spelers.push({ id: nieuwId(), naam, linie: '' });
		});
		this.bewaar();
	}

	hernoem(p: Speler, naam: string) {
		p.naam = naam.trim();
		this.bewaar();
	}

	verwijderSpeler(p: Speler) {
		this.toestand.spelers = this.toestand.spelers.filter((x) => x.id !== p.id);
		this.bewaar();
	}

	zetLinie(p: Speler, linie: Veldlinie) {
		p.linie = p.linie === linie ? '' : linie;
		this.bewaar();
	}

	zetKeept(p: Speler) {
		p.keept = !p.keept;
		this.bewaar();
	}

	/* ---------- wedstrijd ---------- */
	get wedstrijd(): Wedstrijd | null {
		return this.toestand.wedstrijd;
	}

	/** Is er afgetrapt? Pas dan ligt de opstelling vast en gaat de klok tellen. */
	get gestart(): boolean {
		return !!this.toestand.wedstrijd?.gebeurtenissen.some((g) => g.type === 'start');
	}

	nieuweWedstrijd(tegenstander: string, thuis: boolean) {
		const t = this.toestand;
		t.wedstrijd = {
			datum: new Date().toISOString().slice(0, 10),
			tegenstander: tegenstander || 'Tegenstander',
			thuis,
			formatie: t.formatie,
			opstelling: {},
			bank: [],
			gebeurtenissen: [],
			verstreken: 0,
			sinds: null,
			loopt: false,
			helft: 1,
			afgelopen: false,
			afwezig: []
		};
		this.vulUitStandaard();
		this.bewaar();
	}

	/** De wedstrijd begint met de standaardopstelling, voor zover die nog klopt. */
	vulUitStandaard() {
		const t = this.toestand;
		const w = t.wedstrijd;
		if (!w) return;
		const st = t.standaard;
		if (st && st.formatie === w.formatie) {
			for (const [plek, id] of Object.entries(st.opstelling)) {
				if (id && this.spelerVan(id)) w.opstelling[plek] = id;
			}
		}
		this.herzetBank();
	}

	/** De bank is iedereen die er is en niet in het veld staat. */
	herzetBank() {
		const t = this.toestand;
		const w = t.wedstrijd;
		if (!w) return;
		const inVeld = Object.values(w.opstelling).filter(Boolean) as string[];
		const afwezig = w.afwezig ?? [];
		w.bank = t.spelers.map((p) => p.id).filter((id) => !inVeld.includes(id) && !afwezig.includes(id));
	}

	/** Wie er vandaag niet is. Uit het veld halen mag ook: dan valt de plek leeg. */
	zetAfwezig(spelerId: string, afwezig: boolean) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		const lijst = new Set(w.afwezig ?? []);
		if (afwezig) {
			lijst.add(spelerId);
			for (const plek of Object.keys(w.opstelling)) {
				if (w.opstelling[plek] === spelerId) w.opstelling[plek] = null;
			}
		} else {
			lijst.delete(spelerId);
		}
		w.afwezig = [...lijst];
		this.herzetBank();
		this.bewaar();
	}

	/** De klok bijstellen als de scheidsrechter er anders over denkt. */
	verschuifKlok(seconden: number) {
		const w = this.toestand.wedstrijd;
		if (!w || w.afgelopen) return;
		w.verstreken = Math.max(0, w.verstreken + seconden);
		this.nu = Date.now();
		this.bewaar();
	}

	/** Een proefwedstrijd of een misser weggooien. */
	gooiWedstrijdWeg() {
		this.toestand.wedstrijd = null;
		this.gekozenPlek = null;
		this.bewaar();
	}

	log(type: GebeurtenisType, extra: Partial<Gebeurtenis> = {}) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.gebeurtenissen.push({ type, t: verstreken(w, this.nu), ...extra } as Gebeurtenis);
	}

	loopToggle() {
		const w = this.toestand.wedstrijd;
		if (!w || w.afgelopen) return;
		if (w.loopt) {
			w.verstreken += (Date.now() - (w.sinds ?? Date.now())) / 1000;
			w.loopt = false;
			w.sinds = null;
		} else {
			if (!w.gebeurtenissen.length) this.log('start');
			w.loopt = true;
			w.sinds = Date.now();
		}
		this.nu = Date.now();
		this.bewaar();
	}

	rustToggle() {
		const w = this.toestand.wedstrijd;
		if (!w || w.afgelopen) return;
		if (w.helft === 1) {
			if (w.loopt) this.loopToggle();
			this.log('rust');
			w.helft = 2;
		} else if (!w.loopt) {
			this.loopToggle();
		}
		this.bewaar();
	}

	/** Iemand van de bank op de gekozen plek zetten. Tijdens een wedstrijd is dat een wissel. */
	zetOpPlek(spelerId: string) {
		const w = this.toestand.wedstrijd;
		if (!w || !this.gekozenPlek) return;
		const plek = this.gekozenPlek;
		const eruit = w.opstelling[plek];
		w.opstelling[plek] = spelerId;
		w.bank = w.bank.filter((x) => x !== spelerId);
		if (eruit) {
			w.bank.push(eruit);
			this.log('wissel', { eruit, erin: spelerId, plek });
		}
		this.gekozenPlek = null;
		this.bewaar();
	}

	/** Twee spelers op het veld wisselen van plek. Wordt vastgelegd, want anders
	    klopt straks de speeltijd per plek niet meer. */
	ruilInWedstrijd(plekA: string, plekB: string) {
		const w = this.toestand.wedstrijd;
		if (!w || plekA === plekB) return;
		const a = w.opstelling[plekA] ?? null;
		const b = w.opstelling[plekB] ?? null;
		if (!a && !b) return;
		w.opstelling[plekA] = b;
		w.opstelling[plekB] = a;
		/* Voor de aftrap is dit gewoon je opstelling maken, geen gebeurtenis. */
		if (this.gestart) this.log('ruil', { plekA, plekB });
		this.gekozenPlek = null;
		this.bewaar();
	}

	doelpunt(spelerId: string | null) {
		this.log('goal', { speler: spelerId });
		this.bewaar();
	}

	/** De assist bij het laatste doelpunt. Mag ook later, mag ook niet. */
	zetAssist(spelerId: string | null) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		for (let i = w.gebeurtenissen.length - 1; i >= 0; i--) {
			if (w.gebeurtenissen[i].type === 'goal') {
				w.gebeurtenissen[i].assist = spelerId;
				this.bewaar();
				return;
			}
		}
	}

	tegendoelpunt() {
		this.log('tegen');
		this.bewaar();
	}

	/** Per ongeluk getikt? De laatste actie kan terug, zolang er niets overheen is gegaan. */
	herstelbaar(): string | null {
		const g = this.toestand.wedstrijd?.gebeurtenissen ?? [];
		const laatste = g[g.length - 1];
		if (!laatste) return null;
		if (laatste.type === 'goal') return 'Doelpunt';
		if (laatste.type === 'tegen') return 'Tegendoelpunt';
		if (laatste.type === 'wissel') return 'Wissel';
		return null;
	}

	herstelLaatste() {
		const w = this.toestand.wedstrijd;
		if (!w || !this.herstelbaar()) return;
		const laatste = w.gebeurtenissen[w.gebeurtenissen.length - 1];
		if (laatste.type === 'wissel' && laatste.plek) {
			w.opstelling[laatste.plek] = laatste.eruit ?? null;
			w.bank = w.bank.filter((x) => x !== laatste.eruit);
			if (laatste.erin && !w.bank.includes(laatste.erin)) w.bank.push(laatste.erin);
		}
		w.gebeurtenissen.pop();
		this.gekozenPlek = null;
		this.bewaar();
	}

	beeindig() {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		if (w.loopt) {
			w.verstreken += (Date.now() - (w.sinds ?? Date.now())) / 1000;
			w.loopt = false;
			w.sinds = null;
		}
		this.log('eind');
		w.afgelopen = true;
		this.bewaar();
	}

	bewaarInArchief(): boolean {
		const t = this.toestand;
		const w = t.wedstrijd;
		if (!w || w.bewaard) return false;
		const tijden = speeltijden(w, t.spelers, this.nu);
		const keepers = keepertijden(w, this.nu);
		const namen: Record<string, string> = {};
		t.spelers.forEach((p) => (namen[p.id] = p.naam));
		const regel: ArchiefWedstrijd = {
			datum: w.datum, tegenstander: w.tegenstander, thuis: w.thuis,
			stand: stand(w), formatie: w.formatie, duur: eindTijd(w),
			gebeurtenissen: w.gebeurtenissen, namen,
			afwezig: [...(w.afwezig ?? [])],
			speeltijd: t.spelers
				.filter((p) => tijden[p.id] !== undefined)
				.map((p) => ({ id: p.id, naam: p.naam, seconden: Math.round(tijden[p.id]), keeper: Math.round(keepers[p.id] ?? 0) }))
		};
		t.archief.unshift(regel);
		w.bewaard = true;
		this.bewaar();
		return true;
	}

	verwijderUitArchief(i: number) {
		this.toestand.archief.splice(i, 1);
		this.bewaar();
	}

	/* ---------- een bewaarde wedstrijd bijwerken ---------- */
	/** Datum, tegenstander, thuis of uit. De cijfers blijven zoals ze waren. */
	wijzigArchief(i: number, velden: Partial<Pick<ArchiefWedstrijd, 'datum' | 'tegenstander' | 'thuis'>>) {
		const a = this.toestand.archief[i];
		if (!a) return;
		Object.assign(a, velden);
		this.bewaar();
	}

	/** De stand volgt uit de doelpunten, dus na elke wijziging opnieuw tellen. */
	private telStand(a: ArchiefWedstrijd) {
		a.stand = [
			a.gebeurtenissen.filter((g) => g.type === 'goal').length,
			a.gebeurtenissen.filter((g) => g.type === 'tegen').length
		];
	}

	/**
	 * Een doelpunt weghalen dat er niet was. Wissels blijven staan: daar hangt de
	 * speeltijd aan, en die is bij het bewaren uitgerekend.
	 */
	verwijderDoelpunt(i: number, index: number) {
		const a = this.toestand.archief[i];
		const g = a?.gebeurtenissen[index];
		if (!a || !g || (g.type !== 'goal' && g.type !== 'tegen')) return;
		a.gebeurtenissen.splice(index, 1);
		this.telStand(a);
		this.bewaar();
	}

	/** Een doelpunt dat je miste, op de goede minuut ertussen. */
	voegDoelpuntToe(i: number, minuut: number, spelerId: string | null, tegen = false) {
		const a = this.toestand.archief[i];
		if (!a) return;
		const gebeurtenis: Gebeurtenis = tegen
			? { type: 'tegen', t: Math.max(0, Math.round(minuut * 60)) }
			: { type: 'goal', t: Math.max(0, Math.round(minuut * 60)), speler: spelerId };
		a.gebeurtenissen = [...a.gebeurtenissen, gebeurtenis].sort((x, y) => (x.t ?? 0) - (y.t ?? 0));
		this.telStand(a);
		this.bewaar();
	}

	/* ---------- standaardopstelling ---------- */
	/** Zorgt dat er een standaard is die klopt met de huidige selectie. */
	zorgVoorStandaard() {
		const t = this.toestand;
		if (!t.standaard) t.standaard = { formatie: t.formatie, opstelling: {}, bank: [] };
		const st = t.standaard;
		if (!plekken(st.formatie)) st.formatie = t.formatie;
		const ids = t.spelers.map((p) => p.id);
		for (const plek of Object.keys(st.opstelling)) {
			if (!ids.includes(st.opstelling[plek] as string)) delete st.opstelling[plek];
		}
		const inVeld = Object.values(st.opstelling).filter(Boolean) as string[];
		st.bank = ids.filter((id) => !inVeld.includes(id));
		this.bewaar();
		return st;
	}

	/** Twee plekken omwisselen. Is er een leeg, dan verhuist die ene ernaartoe. */
	ruilPlekken(bron: 'wedstrijd' | 'standaard', plekA: string, plekB: string) {
		const doel = bron === 'standaard' ? this.toestand.standaard : this.toestand.wedstrijd;
		if (!doel || plekA === plekB) return;
		const a = doel.opstelling[plekA] ?? null;
		const b = doel.opstelling[plekB] ?? null;
		if (!a && !b) return;
		doel.opstelling[plekA] = b;
		doel.opstelling[plekB] = a;
		this.gekozenPlek = null;
		this.bewaar();
	}

	/** Iemand van het veld halen zonder dat er meteen een ander in komt. */
	haalVanVeld(bron: 'wedstrijd' | 'standaard', plek: string) {
		const doel = bron === 'standaard' ? this.toestand.standaard : this.toestand.wedstrijd;
		const id = doel?.opstelling[plek];
		if (!doel || !id) return;
		doel.opstelling[plek] = null;
		if (!doel.bank.includes(id)) doel.bank.push(id);
		this.gekozenPlek = null;
		this.bewaar();
	}

	/** Opstellen vóór de aftrap: gewoon ruilen, dit is geen wissel. */
	zetInOpzet(bron: 'wedstrijd' | 'standaard', spelerId: string) {
		const doel = bron === 'standaard' ? this.toestand.standaard : this.toestand.wedstrijd;
		if (!doel || !this.gekozenPlek) return;
		const oud = doel.opstelling[this.gekozenPlek];
		doel.opstelling[this.gekozenPlek] = spelerId;
		doel.bank = doel.bank.filter((x) => x !== spelerId);
		if (oud) doel.bank.push(oud);
		this.gekozenPlek = null;
		this.bewaar();
	}

	wisStandaard() {
		this.toestand.standaard = null;
		this.bewaar();
	}

	/* ---------- trainingen ---------- */
	nieuweTraining(): Training {
		const t = this.toestand;
		const status: Record<string, Aanwezigheid> = {};
		t.spelers.forEach((p) => (status[p.id] = 'ja'));
		const training: Training = { id: nieuwId('t'), datum: new Date().toISOString().slice(0, 10), status };
		t.trainingen = sorteerTrainingen([training, ...t.trainingen]);
		this.bewaar();
		return training;
	}

	trainingMetId(id: string | undefined): Training | undefined {
		return this.toestand.trainingen.find((t) => t.id === id);
	}

	tikPresentie(training: Training, spelerId: string) {
		const volgorde: Aanwezigheid[] = ['ja', 'af', 'nee'];
		const nu = training.status[spelerId] ?? 'ja';
		training.status[spelerId] = volgorde[(volgorde.indexOf(nu) + 1) % volgorde.length];
		this.bewaar();
	}

	zetTrainingDatum(training: Training, datum: string) {
		if (!datum) return;
		training.datum = datum;
		this.toestand.trainingen = sorteerTrainingen(this.toestand.trainingen);
		this.bewaar();
	}

	verwijderTraining(training: Training) {
		this.toestand.trainingen = this.toestand.trainingen.filter((t) => t.id !== training.id);
		this.bewaar();
	}

	/* ---------- overzetten ---------- */
	/**
	 * Een pakket van een ander toestel overnemen. Alles wat erin staat vervangt
	 * wat je had; wat er niet in staat blijft. Een lopende wedstrijd raakt het
	 * nooit aan.
	 */
	neemOver(pakket: Partial<Omit<Toestand, 'wedstrijd'>>) {
		const t = this.toestand;
		if (Array.isArray(pakket.spelers)) t.spelers = pakket.spelers;
		if (pakket.formatie && plekken(pakket.formatie)) t.formatie = pakket.formatie;
		if (pakket.helftMinuten) t.helftMinuten = pakket.helftMinuten;
		if ('standaard' in pakket) t.standaard = pakket.standaard ?? null;
		if (Array.isArray(pakket.trainingen)) t.trainingen = pakket.trainingen;
		if (Array.isArray(pakket.archief)) t.archief = pakket.archief;
		if (typeof pakket.verslagWissels === 'boolean') t.verslagWissels = pakket.verslagWissels;
		this.bewaar();
	}

	/** Alleen de voorbereiding en de geschiedenis; een lopende wedstrijd blijft lokaal. */
	syncPakket() {
		const t = this.toestand;
		return {
			spelers: t.spelers, formatie: t.formatie, helftMinuten: t.helftMinuten,
			standaard: t.standaard, trainingen: t.trainingen, archief: t.archief,
			verslagWissels: t.verslagWissels
		};
	}

	neemSyncOver(d: ReturnType<App['syncPakket']>): boolean {
		if (!d || !Array.isArray(d.spelers)) return false;
		const t = this.toestand;
		t.spelers = d.spelers;
		if (d.formatie && plekken(d.formatie)) t.formatie = d.formatie;
		if (d.helftMinuten) t.helftMinuten = d.helftMinuten;
		t.standaard = d.standaard ?? null;
		t.trainingen = Array.isArray(d.trainingen) ? d.trainingen : [];
		t.archief = Array.isArray(d.archief) ? d.archief : [];
		t.verslagWissels = !!d.verslagWissels;
		this.bewaar();
		return true;
	}
}

export const app = new App();

/** Opstelling waar je nu aan werkt: de wedstrijd, of de standaard. */
export function opstellingVan(bron: 'wedstrijd' | 'standaard'): { formatie: string; opstelling: Opstelling; bank: string[] } | null {
	return bron === 'standaard' ? app.toestand.standaard : app.toestand.wedstrijd;
}
