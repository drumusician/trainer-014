<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Veld from '$lib/components/Veld.svelte';
	import BankKolom from '$lib/components/BankKolom.svelte';
	import { coachVraag, controleerVoorstel, type CoachVoorstel } from '$lib/domain/coach';
	import { app } from '$lib/store.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	const bron = $derived(page.params.bron === 'standaard' ? 'standaard' : 'wedstrijd');
	const terug = $derived(`/app/opstelling/${bron}`);
	const doel = $derived(bron === 'standaard' ? app.toestand.defaultLineup : app.match);

	$effect(() => zetKop(text.coach.title, terug, text.common.back));

	/* Na de aftrap volgt de opstelling uit de wissels; dan valt er niets meer voor te stellen. */
	$effect(() => {
		if (bron === 'wedstrijd' && app.kickedOff) goto('/app/wedstrijd');
	});

	/*
	 * Het laatste voorstel blijft bewaard op dit toestel, per bron. Wie even naar
	 * het opstelscherm kijkt en terugkomt, wil niet opnieuw een minuut wachten —
	 * en ook geen beurt kwijt zijn. Alleen hier: het hoort niet bij het team en
	 * gaat dus niet mee naar de server.
	 */
	interface Bewaard {
		vraag: string;
		voorstel: CoachVoorstel;
		formation: string;
		over: number;
		wanneer: string;
	}
	const SLEUTEL = 'o14-coach-v1';
	function lees(): Record<string, Bewaard> {
		try {
			return JSON.parse(localStorage.getItem(SLEUTEL) ?? '{}') ?? {};
		} catch {
			return {};
		}
	}
	function bewaar(b: Bewaard) {
		try {
			localStorage.setItem(SLEUTEL, JSON.stringify({ ...lees(), [bron]: b }));
		} catch {
			/* geen opslag: dan alleen voor nu */
		}
	}

	let laatste = $state<Bewaard | null>(null);
	let vraag = $state('');
	let bezig = $state(false);
	let melding = $state('');

	$effect(() => {
		const b = lees()[bron] ?? null;
		laatste = b;
		vraag = b?.vraag ?? '';
	});

	const ingelogd = $derived(!!sync.sessie?.teamId);
	const gecontroleerd = $derived(
		laatste && doel
			? controleerVoorstel(laatste.voorstel, app.toestand.players, {
					...doel,
					absent: bron === 'wedstrijd' ? app.match?.absent : []
				})
			: null
	);
	const andereFormatie = $derived(!!laatste && !!doel && laatste.formation !== doel.formation);

	function uitleg(e: unknown): string {
		const f = e as { status?: number; message?: string; data?: { fout?: string } };
		if (!f?.status) return text.coach.offline;
		if (f.data?.fout) return f.data.fout;
		if (f.status === 404) return text.coach.notDeployed;
		if (f.status === 401) return text.coach.needLogin;
		/* de noodrem van de app zelf zegt het al in het Nederlands */
		if (f.status === 429 && f.message) return f.message;
		return text.coach.failed;
	}

	async function vraagOm() {
		if (!doel || bezig) return;
		bezig = true;
		melding = '';
		try {
			const absent = bron === 'wedstrijd' ? app.match?.absent : [];
			const pakket = coachVraag(app.toestand, { ...doel, absent }, vraag);
			const r = await sync.vraagCoach(pakket);
			laatste = {
				vraag,
				voorstel: r.voorstel,
				formation: doel.formation,
				over: r.over,
				wanneer: new Date().toLocaleString('nl-NL', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
			};
			bewaar(laatste);
		} catch (e) {
			melding = uitleg(e);
		} finally {
			bezig = false;
		}
	}

	function neemOver() {
		if (!gecontroleerd || gecontroleerd.problemen.length || andereFormatie) return;
		if (app.applyLineup(bron, gecontroleerd.lineup, gecontroleerd.bench)) goto(terug);
	}
</script>

<main>
	<div class="pad">
		{#if !doel}
			<p class="uitleg">{text.coach.noTarget}</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">{text.common.back}</a></div>
		{:else if !ingelogd}
			<h2>{text.coach.needLoginHeading}</h2>
			<p class="uitleg">{text.coach.needLogin}</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/meer">{text.coach.toLogin}</a>
			</div>
		{:else}
			<p class="uitleg">{text.coach.intro}</p>
			{#if app.toestand.archive.length < 3}
				<p class="uitleg">{text.coach.fewMatches(app.toestand.archive.length)}</p>
			{/if}

			<label class="vak">
				{text.coach.questionLabel}
				<textarea bind:value={vraag} maxlength="2000" rows="4" placeholder={text.coach.questionPlaceholder}></textarea>
			</label>
			{#if bron === 'standaard'}
				<p class="uitleg">{text.coach.absentHint}</p>
			{/if}

			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={vraagOm} disabled={bezig}>
					{laatste ? text.coach.askAgain : text.coach.ask}
				</button>
			</div>
			{#if bezig}
				<p class="uitleg" role="status">{text.coach.thinking}</p>
			{/if}
			{#if melding}
				<p class="uitleg" role="alert"><b class="mager">{melding}</b></p>
			{/if}
			<p class="uitleg klein">{text.coach.whatGoes}</p>

			{#if laatste && gecontroleerd}
				{@const v = laatste.voorstel}
				<section class="voorstel">
					<h2>{text.coach.resultHeading}</h2>
					<p class="uitleg">{text.coach.askedAt(laatste.wanneer)}</p>
					<p>{v.samenvatting}</p>

					<div class="veldrij">
						<Veld formation={doel.formation} lineup={gecontroleerd.lineup} />
						<BankKolom bench={gecontroleerd.bench} formation={doel.formation} ontik={() => {}} />
					</div>

					{#if andereFormatie}
						<p class="uitleg"><b class="mager">{text.coach.otherFormation(laatste.formation)}</b></p>
					{:else if gecontroleerd.problemen.length}
						<p class="uitleg">
							<b class="mager">{text.coach.cannotTake}</b>
							{gecontroleerd.problemen.join(' ')}
						</p>
					{:else}
						<div class="knoprij" style="padding-left: 0">
							<button class="prim" onclick={neemOver}>{text.coach.take}</button>
						</div>
					{/if}
					{#each gecontroleerd.opmerkingen as o (o)}
						<p class="uitleg"><b class="mager">{o}</b></p>
					{/each}

					{#if v.redenen.length}
						<h2>{text.coach.reasonsHeading}</h2>
						<ul class="punten">
							{#each v.redenen as r, i (i)}<li>{r}</li>{/each}
						</ul>
					{/if}

					{#if v.wisselplan.length}
						<h2>{text.coach.subsHeading}</h2>
						<ul class="log">
							{#each [...v.wisselplan].sort((a, b) => a.minuut - b.minuut) as w, i (i)}
								<li>
									<span>
										{text.coach.sub(w.minuut, w.erin, w.eruit)}
										<span class="sub">{w.waarom}</span>
									</span>
								</li>
							{/each}
						</ul>
					{/if}

					{#if v.aandachtspunten.length}
						<h2>{text.coach.pointsHeading}</h2>
						<ul class="punten">
							{#each v.aandachtspunten as p, i (i)}<li>{p}</li>{/each}
						</ul>
					{/if}

					<p class="uitleg klein">{text.coach.left(laatste.over)}</p>
				</section>
			{/if}
		{/if}
	</div>
</main>

<style>
	textarea {
		width: 100%;
		font: inherit;
	}
	.voorstel {
		margin-top: 16px;
	}
	.voorstel .veldrij {
		margin: 12px 0;
	}
	.punten {
		margin: 0 0 8px;
		padding-left: 20px;
		font-size: 15px;
	}
	.punten li {
		margin-bottom: 6px;
	}
	.klein {
		font-size: 12px;
	}
</style>
