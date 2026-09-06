<script lang="ts">
	import { goto } from '$app/navigation';
	import { mmss, elapsed } from '$lib/domain/time';
	import { partName, breakName } from '$lib/domain/parts';
	import { shortDate } from '$lib/domain/dates';
	import { seizoenStand } from '$lib/domain/season';
	import { FORMATS } from '$lib/domain/formations';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

	$effect(() => zetKop('Wedstrijden'));

	const t = $derived(app.toestand);
	const w = $derived(app.match);
	const staatKlaar = $derived(!!w && !w.finished && Object.values(w.lineup).some(Boolean));
	const bezig = $derived(staatKlaar && app.kickedOff);
	const opgezet = $derived(!!w && !w.finished && !Object.values(w.lineup).some(Boolean));
	const teBewaren = $derived(!!w && w.finished && !w.archived);
	const running = $derived(staatKlaar || opgezet || teBewaren);

	const st = $derived(seizoenStand(t.archive));

	function beginnen() {
		if (!t.players.length) {
			goto('/app/opzetten');
			return;
		}
		app.newMatch('', true);
		goto('/app/aanwezig');
	}
</script>

<main>
	<div class="pad">
		{#if !t.players.length}
			<h2>Welkom bij Blaadje</h2>
			<p class="uitleg">
				In drie stappen sta je klaar: de name van je team, wie on zitten, en hoe jullie spelen. Duurt een minuut.
			</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/opzetten">Aan de slag</a>
			</div>
		{:else}
			<!-- What is happening now sits at the top and is itself the button to it. -->
			{#if bezig}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">Bezig</div>
					<div class="titel">
						{w!.home ? t.teamName + ' – ' + w!.opponent : w!.opponent + ' – ' + t.teamName}
					</div>
					<div class="erbij">
						{mmss(elapsed(w, app.nu))} ·
						{w!.inBreak ? breakName(w!.part, w!.parts).toLowerCase() : partName(w!.part, w!.parts)} ·
						{w!.running ? 'klok loopt' : 'klok staat stil'}
					</div>
				</a>
			{:else if staatKlaar}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">Klaar om te beginnen</div>
					<div class="titel">
						{w!.home ? t.teamName + ' – ' + w!.opponent : w!.opponent + ' – ' + t.teamName}
					</div>
					<div class="erbij">De lineup staat. De klok begint als jij op Start drukt.</div>
				</a>
			{:else if opgezet}
				<a class="nu" href="/app/opstelling/wedstrijd">
					<div class="wat">Nog te doen</div>
					<div class="titel">Opstelling maken</div>
					<div class="erbij">Tegen {w!.opponent}</div>
				</a>
			{:else if teBewaren}
				<a class="nu" href="/app/afloop">
					<div class="wat">Net gespeeld</div>
					<div class="titel">Nog niet archived</div>
					<div class="erbij">Tegen {w!.opponent}</div>
				</a>
			{:else}
				<button class="nu" style="width: 100%; text-align: left; border: 0" onclick={beginnen}>
					<div class="wat">Zaterdag</div>
					<div class="titel">Nieuwe match</div>
					<div class="erbij">
						{t.formation} · {t.parts === 4 ? '4 kwarten' : '2 helften'} van {t.minutesPerPart} min
					</div>
				</button>
			{/if}

			{#if running}
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/aanwezig">Wie is er?</a>
					<a class="knop" href="/app/opstelling/wedstrijd">Opstelling</a>
					<button
						class="uit"
						onclick={() => {
							if (
								confirm(
									'Deze wedstrijd tegen ' + w!.opponent + ' weggooien?\n\nWat je in het archief bewaarde blijft staan.'
								)
							)
								app.discardMatch();
						}}>Weggooien</button
					>
				</div>
			{:else}
				<h2>Zo spelen jullie</h2>
				<div class="tweekolom">
					<label class="vak">
						Formatie
						<select value={t.formation} onchange={(e) => app.chooseFormation(e.currentTarget.value)}>
							{#each FORMATS as vorm (vorm.name)}
								<optgroup label={vorm.name + (vorm.uitleg ? ' · ' + vorm.uitleg : '')}>
									{#each vorm.formaties as f (f.sleutel)}
										<option value={f.sleutel}>{f.sleutel}{f.uitleg ? ' · ' + f.uitleg : ''}</option>
									{/each}
								</optgroup>
							{/each}
						</select>
					</label>
					<label class="vak">
						Speelwijze
						<select bind:value={t.parts} onchange={() => app.save()}>
							<option value={2}>2 helften</option>
							<option value={4}>4 kwarten</option>
						</select>
					</label>
				</div>
				<div class="tweekolom">
					<label class="vak">
						Minuten per {t.parts === 4 ? 'kwart' : 'helft'}
						<input type="number" inputmode="numeric" bind:value={t.minutesPerPart} onchange={() => app.save()} />
					</label>
					<label class="vak">
						Speelduur
						<input value={t.minutesPerPart * t.parts + ' minuten'} readonly />
					</label>
				</div>
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/opstelling/standaard">
						{t.defaultLineup ? 'Vaste opstelling wijzigen' : 'Vaste opstelling maken'}
					</a>
				</div>
			{/if}

			<h2>Gespeeld</h2>
			{#if !t.archive.length}
				<p class="uitleg">
					Nog niets archived. Sluit een match af en bewaar hem, dan staat hij hier met uitslag, speeltijden en het hele
					verloop.
				</p>
			{:else}
				<p class="uitleg">
					{st.gewonnen}W {st.gelijk}G {st.verloren}V · {st.voor} voor, {st.tegen} tegen ·
					{Math.round(st.seconds / 60)} minuten voetbal
				</p>
				<ul class="log">
					{#each t.archive as a, i (a)}
						<li class="klikbaar">
							<a href="/app/archief/{i}">
								<b>{shortDate(a.date)}</b>
								<span>{a.home !== false ? 'thuis' : 'uit'} tegen {a.opponent}</span>
								<span style="flex: none; font-weight: 700; font-variant-numeric: tabular-nums">
									{a.score?.[0] ?? 0}–{a.score?.[1] ?? 0}
								</span>
								<em>›</em>
							</a>
						</li>
					{/each}
				</ul>
				<div class="knoprij" style="padding-left: 0; margin-top: 12px">
					<a class="knop" href="/app/archief/seizoen">Seizoen en topscorers</a>
				</div>
			{/if}
		{/if}
	</div>
</main>

<style>
	/* The block at the top saying what is going on right now. It sat under the
	   heading 'Landingspagina' in app.css while only this screen uses it. */
	.nu {
		display: block;
		padding: 16px;
		border-radius: 14px;
		text-decoration: none;
		background: var(--groen);
		color: #fff;
		margin-bottom: 12px;
	}
	.nu:active {
		background: var(--groen-diep);
	}
	.nu .wat {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.8;
		font-weight: 700;
	}
	.nu .titel {
		font-size: 21px;
		font-weight: 700;
		margin: 4px 0 2px;
		letter-spacing: -0.01em;
	}
	.nu .erbij {
		font-size: 14px;
		opacity: 0.85;
		font-variant-numeric: tabular-nums;
	}
</style>
