import type { ArchivedMatch, Player } from './types';

export interface SeizoenRegel {
	name: string;
	seconds: number;
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
	seconds: number;
}

export function seizoenStand(archive: ArchivedMatch[]): SeizoenStand {
	const uit: SeizoenStand = {
		wedstrijden: archive.length,
		gewonnen: 0,
		gelijk: 0,
		verloren: 0,
		voor: 0,
		tegen: 0,
		seconds: 0
	};
	archive.forEach((a) => {
		const [v, t] = a.score ?? [0, 0];
		uit.voor += v;
		uit.tegen += t;
		if (v > t) uit.gewonnen++;
		else if (v === t) uit.gelijk++;
		else uit.verloren++;
		uit.seconds += a.duration ?? 0;
	});
	return uit;
}

/**
 * Everything in the archive added up. By player id where possible, so renaming
 * someone does not produce two rows; by name for older matches without ids.
 */
export function seasonTotals(archive: ArchivedMatch[], players: Player[]): SeizoenRegel[] {
	const per: Record<string, SeizoenRegel> = {};
	const player = (id?: string | null) => (id ? players.find((p) => p.id === id) : undefined);

	const pak = (sleutel: string, name: string): SeizoenRegel => {
		if (!per[sleutel]) per[sleutel] = { name, seconds: 0, keeper: 0, wedstrijden: 0, doelpunten: 0 };
		per[sleutel].name = name;
		return per[sleutel];
	};

	archive.forEach((a) => {
		(a.playingTime ?? []).forEach((r) => {
			const p = player(r.id);
			const rij = pak(p ? 'id:' + p.id : 'naam:' + r.name, p ? p.name : r.name);
			rij.seconds += r.seconds ?? 0;
			rij.keeper += r.keeper ?? 0;
			if ((r.seconds ?? 0) > 0) rij.wedstrijden++;
		});
		(a.events ?? [])
			.filter((g) => g.type === 'goal' && g.player)
			.forEach((g) => {
				const p = player(g.player);
				const name = p ? p.name : a.names?.[g.player as string];
				if (!name) return; /* scorer unknown: counts towards the score only */
				pak(p ? 'id:' + p.id : 'naam:' + name, name).doelpunten++;
			});
	});

	return Object.values(per).sort((a, b) => b.seconds - a.seconds);
}

export interface MakerRegel {
	name: string;
	doelpunten: number;
	/** in which matches, newest first */
	wedstrijden: { date: string; opponent: string; aantal: number }[];
}

/**
 * Who scored, and when. The score counts every goal; this list only the ones
 * with a scorer attached, because sometimes you simply do not know.
 */
export function makers(archive: ArchivedMatch[], players: Player[]): MakerRegel[] {
	const per: Record<string, MakerRegel> = {};
	archive.forEach((a) => {
		(a.events ?? [])
			.filter((g) => g.type === 'goal' && g.player)
			.forEach((g) => {
				const p = players.find((s) => s.id === g.player);
				const name = p ? p.name : a.names?.[g.player as string];
				if (!name) return;
				const rij = (per[name] ??= { name, doelpunten: 0, wedstrijden: [] });
				rij.doelpunten++;
				const laatste = rij.wedstrijden.find((w) => w.date === a.date && w.opponent === a.opponent);
				if (laatste) laatste.aantal++;
				else rij.wedstrijden.push({ date: a.date, opponent: a.opponent, aantal: 1 });
			});
	});
	return Object.values(per)
		.map((r) => ({ ...r, wedstrijden: [...r.wedstrijden].sort((x, y) => y.date.localeCompare(x.date)) }))
		.sort((a, b) => b.doelpunten - a.doelpunten || a.name.localeCompare(b.name));
}

export function topscorers(rijen: SeizoenRegel[]): SeizoenRegel[] {
	return rijen.filter((r) => r.doelpunten > 0).sort((a, b) => b.doelpunten - a.doelpunten || b.seconds - a.seconds);
}
