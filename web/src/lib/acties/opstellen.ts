import { FORMATIES } from '$lib/domein/formaties';
import { zetOpstellingOm } from '$lib/domein/opstelling';
import type { Standaard, Toestand, Wedstrijd } from '$lib/domein/types';

/**
 * Opstellen buiten een lopende wedstrijd om: de standaardopstelling, en het
 * schuiven voor de aftrap.
 *
 * Deze functies raken de gebeurtenissenlijst niet aan. Wat tijdens een wedstrijd
 * gebeurt hoort daar wél in en staat daarom niet hier maar in de winkel zelf.
 */

/** Waar je aan het opstellen bent: de wedstrijd van vandaag of de standaard. */
export type Bron = 'wedstrijd' | 'standaard';

export function doelVan(t: Toestand, bron: Bron): Wedstrijd | Standaard | null {
	return bron === 'standaard' ? t.standaard : t.wedstrijd;
}

/** Zorgt dat er een standaard is die klopt met de selectie en de formatie. */
export function zorgVoorStandaard(t: Toestand): Standaard {
	if (!t.standaard) t.standaard = { formatie: t.formatie, opstelling: {}, bank: [] };
	const st = t.standaard;
	if (!FORMATIES[st.formatie]) st.formatie = t.formatie;
	zetStandaardInFormatie(t, t.formatie);
	const ids = t.spelers.map((p) => p.id);
	for (const plek of Object.keys(st.opstelling)) {
		if (!ids.includes(st.opstelling[plek] as string)) delete st.opstelling[plek];
	}
	const inVeld = Object.values(st.opstelling).filter(Boolean) as string[];
	st.bank = ids.filter((id) => !inVeld.includes(id));
	return st;
}

/** Twee plekken omwisselen. Is er een leeg, dan verhuist die ene ernaartoe. */
export function ruilPlekken(t: Toestand, bron: Bron, plekA: string, plekB: string): boolean {
	const doel = doelVan(t, bron);
	if (!doel || plekA === plekB) return false;
	const a = doel.opstelling[plekA] ?? null;
	const b = doel.opstelling[plekB] ?? null;
	if (!a && !b) return false;
	doel.opstelling[plekA] = b;
	doel.opstelling[plekB] = a;
	return true;
}

/** Iemand van het veld halen zonder dat er meteen een ander in komt. */
export function haalVanVeld(t: Toestand, bron: Bron, plek: string): boolean {
	const doel = doelVan(t, bron);
	const id = doel?.opstelling[plek];
	if (!doel || !id) return false;
	doel.opstelling[plek] = null;
	if (!doel.bank.includes(id)) doel.bank.push(id);
	return true;
}

/** Iemand op de gekozen plek zetten; wie daar stond gaat naar de bank. */
export function zetOpPlekInOpzet(t: Toestand, bron: Bron, plek: string, spelerId: string): boolean {
	const doel = doelVan(t, bron);
	if (!doel) return false;
	const oud = doel.opstelling[plek];
	doel.opstelling[plek] = spelerId;
	doel.bank = doel.bank.filter((x) => x !== spelerId);
	if (oud) doel.bank.push(oud);
	return true;
}

/**
 * De standaardopstelling meenemen naar een andere formatie. Wie op een plek
 * staat die ook in de nieuwe formatie bestaat blijft staan; de rest schuift door
 * binnen zijn eigen linie. Wat niet past gaat naar de bank, en plekken die
 * overblijven laten we leeg: die vult de trainer zelf.
 */
export function zetStandaardInFormatie(t: Toestand, formatie: string): boolean {
	const st = t.standaard;
	if (!st || st.formatie === formatie || !FORMATIES[formatie]) return false;
	const uit = zetOpstellingOm(st.opstelling, st.formatie, formatie, st.bank);
	st.formatie = formatie;
	st.opstelling = uit.opstelling;
	st.bank = uit.bank;
	return true;
}

/**
 * De formatie van het team. Er is er maar één: je standaardopstelling staat erin
 * en je volgende wedstrijd begint ermee. Waar je hem ook omzet, hij verhuist mee.
 */
export function kiesFormatie(t: Toestand, formatie: string): boolean {
	if (!FORMATIES[formatie]) return false;
	t.formatie = formatie;
	zetStandaardInFormatie(t, formatie);
	return true;
}

export function wisStandaard(t: Toestand) {
	t.standaard = null;
}
