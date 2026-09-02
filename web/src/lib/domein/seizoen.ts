import type { ArchiefWedstrijd, Speler } from './types';

export interface SeizoenRegel {
	naam: string;
	seconden: number;
	keeper: number;
	wedstrijden: number;
	doelpunten: number;
}

export interface SeizoenStand {
	wedstrijden: number;
	gewonnen: number;
	gelijk: number;
	verloren: number;
	voor: number;
	tegen: number;
	seconden: number;
}

export function seizoenStand(archief: ArchiefWedstrijd[]): SeizoenStand {
	const uit: SeizoenStand = {
		wedstrijden: archief.length, gewonnen: 0, gelijk: 0, verloren: 0, voor: 0, tegen: 0, seconden: 0
	};
	archief.forEach((a) => {
		const [v, t] = a.stand ?? [0, 0];
		uit.voor += v;
		uit.tegen += t;
		if (v > t) uit.gewonnen++;
		else if (v === t) uit.gelijk++;
		else uit.verloren++;
		uit.seconden += a.duur ?? 0;
	});
	return uit;
}

/**
 * Alles uit het archief opgeteld. Op speler-id waar dat kan, zodat iemand
 * hernoemen geen twee rijen oplevert; op naam voor oude wedstrijden zonder id.
 */
export function seizoenTotalen(archief: ArchiefWedstrijd[], spelers: Speler[]): SeizoenRegel[] {
	const per: Record<string, SeizoenRegel> = {};
	const speler = (id?: string | null) => (id ? spelers.find((p) => p.id === id) : undefined);

	const pak = (sleutel: string, naam: string): SeizoenRegel => {
		if (!per[sleutel]) per[sleutel] = { naam, seconden: 0, keeper: 0, wedstrijden: 0, doelpunten: 0 };
		per[sleutel].naam = naam;
		return per[sleutel];
	};

	archief.forEach((a) => {
		(a.speeltijd ?? []).forEach((r) => {
			const p = speler(r.id);
			const rij = pak(p ? 'id:' + p.id : 'naam:' + r.naam, p ? p.naam : r.naam);
			rij.seconden += r.seconden ?? 0;
			rij.keeper += r.keeper ?? 0;
			if ((r.seconden ?? 0) > 0) rij.wedstrijden++;
		});
		(a.gebeurtenissen ?? [])
			.filter((g) => g.type === 'goal' && g.speler)
			.forEach((g) => {
				const p = speler(g.speler);
				const naam = p ? p.naam : a.namen?.[g.speler as string];
				if (!naam) return; /* maker onbekend: telt alleen in de stand */
				pak(p ? 'id:' + p.id : 'naam:' + naam, naam).doelpunten++;
			});
	});

	return Object.values(per).sort((a, b) => b.seconden - a.seconden);
}

export function topscorers(rijen: SeizoenRegel[]): SeizoenRegel[] {
	return rijen
		.filter((r) => r.doelpunten > 0)
		.sort((a, b) => b.doelpunten - a.doelpunten || b.seconden - a.seconden);
}
