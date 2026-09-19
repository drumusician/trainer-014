/**
 * Wie zat er op de bank, en hoe vaak begon hij daar.
 *
 * Voor bij het maken van de opstelling. Op gevoel doorwisselen gaat goed tot
 * dezelfde twee jongens drie weken achter elkaar op de bank beginnen; dat zie
 * je pas als het er zwart op wit staat.
 *
 * Alleen wedstrijden waarbij hij er was tellen mee. Afgemeld is geen bankzitten.
 */
import { attendanceOf, type AttendanceSummary } from './attendance';
import { momentenVan } from './momenten';
import type { ArchivedMatch, Player, Training } from './types';

export interface BenchRow {
	id: string;
	name: string;
	/** bewaarde wedstrijden waarbij hij er was */
	matches: number;
	/** seconden op de bank in die wedstrijden */
	benchSeconds: number;
	/** hoe vaak hij op de bank begon */
	startedOnBench: number;
	/**
	 * Van hoeveel wedstrijden we weten wie er begon. Dat is uit de wissels terug
	 * te rekenen, maar alleen als de eindopstelling bewaard is — bij oudere
	 * wedstrijden niet, en dan tellen die hier niet mee in plaats van te gokken.
	 */
	startsKnown: number;
	/** over alle trainingen van het seizoen */
	attendance: AttendanceSummary;
}

export function benchOverview(players: Player[], archive: ArchivedMatch[], trainings: Training[]): BenchRow[] {
	const per = new Map<string, BenchRow>(
		players.map((p) => [
			p.id,
			{
				id: p.id,
				name: p.name,
				matches: 0,
				benchSeconds: 0,
				startedOnBench: 0,
				startsKnown: 0,
				attendance: attendanceOf(trainings, p.id, 0)
			}
		])
	);

	for (const a of archive) {
		const afwezig = new Set(a.absent ?? []);
		const aftrap = momentenVan(a, players)[0];
		const opDeBank = new Set(aftrap?.bench ?? []);
		for (const r of a.playingTime ?? []) {
			const rij = r.id ? per.get(r.id) : undefined;
			if (!rij || afwezig.has(rij.id)) continue;
			rij.matches++;
			rij.benchSeconds += Math.max(0, (a.duration ?? 0) - (r.seconds ?? 0));
			if (aftrap) {
				rij.startsKnown++;
				if (opDeBank.has(rij.id)) rij.startedOnBench++;
			}
		}
	}

	return [...per.values()].sort(
		(a, b) => b.benchSeconds - a.benchSeconds || b.startedOnBench - a.startedOnBench || a.name.localeCompare(b.name)
	);
}
