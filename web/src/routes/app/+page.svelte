<script lang="ts">
	import { goto } from '$app/navigation';
	import { mmss, elapsed } from '$lib/domain/time';
	import { partName, breakName } from '$lib/domain/parts';
	import { shortDate } from '$lib/domain/dates';
	import { seizoenStand } from '$lib/domain/season';
	import { FORMATS } from '$lib/domain/formations';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop(text.home.title));

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
			<h2>{text.home.welcomeHeading}</h2>
			<p class="uitleg">{text.home.welcomeHint}</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/opzetten">{text.home.getStarted}</a>
			</div>
		{:else}
			<!-- What is happening now sits at the top and is itself the button to it. -->
			{#if bezig}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">{text.home.nowBusy}</div>
					<div class="titel">
						{w!.home ? t.teamName + ' – ' + w!.opponent : w!.opponent + ' – ' + t.teamName}
					</div>
					<div class="erbij">
						{text.home.nowBusyClock(
							mmss(elapsed(w, app.nu)),
							w!.inBreak ? breakName(w!.part, w!.parts).toLowerCase() : partName(w!.part, w!.parts),
							w!.running
						)}
					</div>
				</a>
			{:else if staatKlaar}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">{text.home.nowReady}</div>
					<div class="titel">
						{w!.home ? t.teamName + ' – ' + w!.opponent : w!.opponent + ' – ' + t.teamName}
					</div>
					<div class="erbij">{text.home.nowReadyHint}</div>
				</a>
			{:else if opgezet}
				<a class="nu" href="/app/opstelling/wedstrijd">
					<div class="wat">{text.home.nowTodo}</div>
					<div class="titel">{text.home.nowTodoTitle}</div>
					<div class="erbij">{text.home.versus(w!.opponent)}</div>
				</a>
			{:else if teBewaren}
				<a class="nu" href="/app/afloop">
					<div class="wat">{text.home.nowJustPlayed}</div>
					<div class="titel">{text.home.nowNotArchived}</div>
					<div class="erbij">{text.home.versus(w!.opponent)}</div>
				</a>
			{:else}
				<button class="nu" style="width: 100%; text-align: left; border: 0" onclick={beginnen}>
					<div class="wat">{text.home.nowSaturday}</div>
					<div class="titel">{text.home.nowNewMatch}</div>
					<div class="erbij">{text.home.nowSetup(t.formation, t.parts, t.minutesPerPart)}</div>
				</button>
			{/if}

			{#if running}
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/aanwezig">{text.home.whoIsThere}</a>
					<a class="knop" href="/app/opstelling/wedstrijd">{text.home.lineup}</a>
					<button
						class="uit"
						onclick={() => {
							if (confirm(text.home.confirmDiscard(w!.opponent))) app.discardMatch();
						}}>{text.home.discard}</button
					>
				</div>
			{:else}
				<h2>{text.home.howYouPlayHeading}</h2>
				<div class="tweekolom">
					<label class="vak">
						{text.home.formationLabel}
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
						{text.home.partsLabel}
						<select bind:value={t.parts} onchange={() => app.save()}>
							<option value={2}>{text.home.halves}</option>
							<option value={4}>{text.home.quarters}</option>
						</select>
					</label>
				</div>
				<div class="tweekolom">
					<label class="vak">
						{text.home.minutesLabel(t.parts)}
						<input type="number" inputmode="numeric" bind:value={t.minutesPerPart} onchange={() => app.save()} />
					</label>
					<label class="vak">
						{text.home.durationLabel}
						<input value={text.home.durationValue(t.minutesPerPart * t.parts)} readonly />
					</label>
				</div>
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/opstelling/standaard">
						{t.defaultLineup ? text.home.editDefaultLineup : text.home.makeDefaultLineup}
					</a>
				</div>
			{/if}

			<h2>{text.home.playedHeading}</h2>
			{#if !t.archive.length}
				<p class="uitleg">{text.home.nothingArchived}</p>
			{:else}
				<p class="uitleg">
					{text.home.seasonLine(st.gewonnen, st.gelijk, st.verloren, st.voor, st.tegen, Math.round(st.seconds / 60))}
				</p>
				<ul class="log">
					{#each t.archive as a, i (a)}
						<li class="klikbaar">
							<a href="/app/archief/{i}">
								<b>{shortDate(a.date)}</b>
								<span>{text.home.matchLine(a.home !== false, a.opponent)}</span>
								<span style="flex: none; font-weight: 700; font-variant-numeric: tabular-nums">
									{a.score?.[0] ?? 0}–{a.score?.[1] ?? 0}
								</span>
								<em>›</em>
							</a>
						</li>
					{/each}
				</ul>
				<div class="knoprij" style="padding-left: 0; margin-top: 12px">
					<a class="knop" href="/app/archief/seizoen">{text.home.toSeason}</a>
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
