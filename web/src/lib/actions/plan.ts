import { kickedOff } from './clock';
import { putOnPosition, ruil } from './match-events';
import { planStappen } from '$lib/domain/plan';
import type { Match, PlannedSub } from '$lib/domain/types';

/** Het wisselplan bijhouden, en een stap doorvoeren als de trainer het moment kiest. */

function nieuwId(): string {
	return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Met `naDeel` is het een wissel in de pauze na dat deel; `minuut` is dan het
 * einde ervan. Met soort 'ruil' wisselen twee spelers in het veld van plek.
 */
export function voegToe(
	w: Match | null,
	minuut: number,
	on: string,
	off: string,
	naDeel?: number,
	soort?: 'ruil'
): boolean {
	if (!w || !on || !off || on === off || !Number.isFinite(minuut) || minuut < 0) return false;
	/* Niet (w.plan ??= []).push(...): dat duwt in de kale lijst, buiten de
	   reactieve toestand om, en dan is de stap in de app gewoon weg. Opnieuw
	   lezen geeft de lijst zoals Svelte hem bijhoudt. */
	if (!w.plan) w.plan = [];
	w.plan.push({
		id: nieuwId(),
		minuut: Math.round(minuut),
		on,
		off,
		...(naDeel ? { naDeel } : {}),
		...(soort ? { soort } : {})
	});
	return true;
}

export function haalWeg(w: Match | null, id: string): boolean {
	if (!w?.plan) return false;
	const voor = w.plan.length;
	w.plan = w.plan.filter((s) => s.id !== id);
	return w.plan.length < voor;
}

/** Het hele plan in één keer, van de assistent. Vervangt wat er stond. */
export function vervang(w: Match | null, plan: Omit<PlannedSub, 'id'>[]): boolean {
	if (!w) return false;
	w.plan = plan.map((s) => ({ ...s, id: nieuwId() }));
	return true;
}

export function slaOver(w: Match | null, id: string, overslaan = true): boolean {
	const s = w?.plan?.find((x) => x.id === id);
	if (!s) return false;
	s.skipped = overslaan || undefined;
	return true;
}

/**
 * De stap doorvoeren: een gewone wissel, met alles wat daarbij hoort in het
 * verloop. Alleen na de aftrap, want daarvoor is het opstellen en geen wissel,
 * en alleen als hij kan; anders gebeurt er niets.
 */
export function voerUit(w: Match | null, nu: number, id: string): boolean {
	const s = planStappen(w, nu).find((x) => x.stap.id === id);
	if (!w || !kickedOff(w) || !s || s.status !== 'open' || s.kanNiet || !s.positie) return false;
	if (s.stap.soort === 'ruil') return !!s.positieOn && ruil(w, nu, s.positieOn, s.positie);
	return putOnPosition(w, nu, s.positie, s.stap.on);
}
