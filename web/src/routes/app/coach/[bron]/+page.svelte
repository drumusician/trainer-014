<script lang="ts">
	import { tick } from 'svelte';
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
		/** wat de trainer daarna anders wilde, oudste eerst */
		bijsturingen?: string[];
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
	let bijsturing = $state('');
	let melding = $state('');
	/* Een halve minuut naar een stil scherm kijken voelt als kapot. Een klok die
	   loopt zegt dat er iets gebeurt. */
	let seconden = $state(0);
	let wachtblok = $state<HTMLElement>();

	$effect(() => {
		if (!bezig) return;
		seconden = 0;
		const klok = setInterval(() => seconden++, 1000);
		return () => clearInterval(klok);
	});

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

	/**
	 * Zonder bijsturen een nieuw voorstel, van nul af. Met bijsturen gaat het
	 * vorige voorstel mee, met alle wensen die er al waren plus de nieuwe: dan past
	 * de assistent aan in plaats van opnieuw te beginnen.
	 */
	async function vraagOm(bijsturen = false) {
		if (!doel || bezig) return;
		const wens = bijsturing.trim();
		if (bijsturen && (!laatste || !wens)) return;
		const vorige =
			bijsturen && laatste
				? { voorstel: laatste.voorstel, bijsturingen: [...(laatste.bijsturingen ?? []), wens] }
				: undefined;
		/* De vraag waar het voorstel op antwoordde, niet wat er intussen in het vak staat. */
		const context = bijsturen && laatste ? laatste.vraag : vraag;
		bezig = true;
		melding = '';
		/* Toetsenbord dicht en het wachtblok in beeld, anders staat het onder het toetsenbord. */
		(document.activeElement as HTMLElement | null)?.blur?.();
		await tick();
		wachtblok?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
		try {
			const absent = bron === 'wedstrijd' ? app.match?.absent : [];
			const pakket = coachVraag(app.toestand, { ...doel, absent }, context, vorige);
			const r = await sync.vraagCoach(pakket);
			laatste = {
				vraag: context,
				bijsturingen: vorige?.bijsturingen ?? [],
				voorstel: r.voorstel,
				formation: doel.formation,
				over: r.over,
				wanneer: new Date().toLocaleString('nl-NL', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
			};
			bewaar(laatste);
			if (bijsturen) bijsturing = '';
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

			<label class="vak">
				{text.coach.rulesLabel}
				<textarea
					value={app.toestand.coachAfspraken ?? ''}
					oninput={(e) => app.setCoachAfspraken(e.currentTarget.value)}
					maxlength="2000"
					rows="2"
					placeholder={text.coach.rulesPlaceholder}></textarea>
			</label>
			<p class="uitleg klein">{text.coach.rulesHint}</p>

			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={() => vraagOm()} disabled={bezig}>
					{bezig ? text.coach.busy : laatste ? text.coach.askAgain : text.coach.ask}
				</button>
			</div>
			{#if bezig}
				<div class="wacht" role="status" bind:this={wachtblok}>
					<div class="balk"><i></i></div>
					<p><b>{text.coach.thinking}</b></p>
					<p class="uitleg">{text.coach.waited(seconden)}</p>
					{#if seconden >= 75}<p class="uitleg">{text.coach.slow}</p>{/if}
				</div>
			{/if}
			{#if melding}
				<p class="uitleg" role="alert"><b class="mager">{melding}</b></p>
			{/if}
			<p class="uitleg klein">{text.coach.whatGoes}</p>

			<!-- Tijdens het vragen niet het vorige voorstel laten staan: dan lijkt het
			     alsof er niets gebeurt. -->
			{#if laatste && gecontroleerd && !bezig}
				{@const v = laatste.voorstel}
				<section class="voorstel">
					<h2>{text.coach.resultHeading}</h2>
					<p class="uitleg">{text.coach.askedAt(laatste.wanneer)}</p>
					<p>{v.samenvatting}</p>
					{#if laatste.bijsturingen?.length}
						<p class="uitleg">
							<b>{text.coach.steeredHeading}:</b>
							{laatste.bijsturingen.join(' · ')}
						</p>
					{/if}

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

					{#if !andereFormatie}
						<h2>{text.coach.steerHeading}</h2>
						<p class="uitleg">{text.coach.steerHint}</p>
						<label class="vak">
							{text.coach.steerLabel}
							<textarea bind:value={bijsturing} maxlength="1000" rows="2" placeholder={text.coach.steerPlaceholder}
							></textarea>
						</label>
						<div class="knoprij" style="padding-left: 0">
							<button onclick={() => vraagOm(true)} disabled={!bijsturing.trim()}>{text.coach.steer}</button>
						</div>
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
	.wacht {
		margin: 12px 0;
		padding: 12px;
		border: 1px solid var(--lijn);
		border-radius: 10px;
	}
	.wacht p {
		margin: 8px 0 0;
	}
	.balk {
		height: 4px;
		border-radius: 2px;
		overflow: hidden;
		background: var(--lijn);
	}
	.balk i {
		display: block;
		width: 35%;
		height: 100%;
		background: var(--gras);
		animation: heen 1.4s ease-in-out infinite;
	}
	@keyframes heen {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.balk i {
			animation: none;
			width: 100%;
			opacity: 0.5;
		}
	}
</style>
