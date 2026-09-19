<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Veld from '$lib/components/Veld.svelte';
	import BankKolom from '$lib/components/BankKolom.svelte';
	import { positionCount, groupOf, linesIn, LINES, positionLine, FORMATS } from '$lib/domain/formations';
	import { thinAttendance, attendanceOf } from '$lib/domain/attendance';
	import { benchOverview } from '$lib/domain/bench';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	const bron = $derived(page.params.bron === 'standaard' ? 'standaard' : 'wedstrijd');
	const doel = $derived(bron === 'standaard' ? app.toestand.defaultLineup : app.match);

	$effect(() => {
		zetKop(
			bron === 'standaard' ? text.lineupScreen.titleDefault : text.lineupScreen.titleMatch,
			'/app',
			text.common.back
		);
	});

	/* Arriving here directly has to work too, for instance from a card on the
	   start screen. If no default lineup exists yet we create one here rather than
	   showing a dead end. */
	$effect(() => {
		if (bron === 'standaard' && !app.toestand.defaultLineup && app.toestand.players.length) {
			app.ensureDefaultLineup();
		}
	});

	/* Only after kick-off does shuffling stop belonging here: from then on playing
	   time is wound back from the substitutions, and an unrecorded swap puts that
	   at risk. As long as the clock has not run you may still move anything. */
	$effect(() => {
		if (bron === 'wedstrijd' && app.kickedOff) goto('/app/wedstrijd');
	});

	const bezet = $derived(doel ? Object.values(doel.lineup).filter(Boolean).length : 0);
	const nodig = $derived(doel ? positionCount(doel.formation) : 0);
	const gekozenSpeler = $derived(
		doel && app.chosenPosition ? app.playerById(doel.lineup[app.chosenPosition]) : undefined
	);

	/* The first tap picks a position. A second tap on another position swaps them;
	   if nobody is standing there, the player simply moves across. */
	function tikPlek(plekId: string) {
		if (!app.chosenPosition) {
			app.chosenPosition = plekId;
			return;
		}
		if (app.chosenPosition === plekId) {
			app.chosenPosition = null;
			return;
		}
		app.swapPositions(bron, app.chosenPosition, plekId);
	}

	/* Lines with no substitute: that is a surprise you would rather have now. */
	const zonderWissel = $derived.by(() => {
		if (!doel) return [];
		const bench = doel.bench.map((id) => app.playerById(id)).filter(Boolean);
		/* only the lines this formation has: at 4-a-side there is no keeper */
		return linesIn(doel.formation)
			.filter((code) => !bench.some((p) => p && groupOf(p) === code))
			.map((code) => LINES[code].toLowerCase());
	});

	const mageren = $derived(
		app.toestand.players.filter((p) => thinAttendance(attendanceOf(app.toestand.trainings, p.id, 4)))
	);

	/* Wie zat er al veel op de bank. Wie vandaag is afgemeld hoort er niet in:
	   die kun je toch niet opstellen. */
	const bankRijen = $derived.by(() => {
		const weg = new Set(bron === 'wedstrijd' ? (app.match?.absent ?? []) : []);
		return benchOverview(app.toestand.players, app.toestand.archive, app.toestand.trainings).filter(
			(r) => !weg.has(r.id)
		);
	});
	const meesteBank = $derived(Math.max(1, ...bankRijen.map((r) => r.benchSeconds)));
	const nuOpDeBank = $derived(new Set(doel?.bench ?? []));
	let bankOverzicht = $state<HTMLElement>();

	function klaar() {
		if (bron === 'standaard') {
			app.save();
			goto('/app');
			return;
		}
		if (bezet < nodig && !confirm(text.lineupScreen.confirmIncomplete(bezet, nodig))) return;
		app.chosenPosition = null;
		goto('/app/wedstrijd');
	}

	function wissen() {
		if (!confirm(text.lineupScreen.confirmClear)) return;
		app.clearDefaultLineup();
		goto('/app');
	}
</script>

{#if !doel}
	<main>
		<div class="pad">
			<p class="uitleg">
				{app.toestand.players.length ? text.lineupScreen.noMatch : text.common.noSquadHint}
			</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href={app.toestand.players.length ? '/app' : '/app/opzetten'}>
					{app.toestand.players.length ? text.lineupScreen.toStart : text.lineupScreen.getStarted}
				</a>
			</div>
		</div>
	</main>
{:else}
	<main>
		<div class="veldscherm zonderklok">
			<div class="veldrij">
				<Veld formation={doel.formation} lineup={doel.lineup} gekozen={app.chosenPosition} onplek={tikPlek} />
				<BankKolom
					bench={doel.bench}
					formation={doel.formation}
					gekozen={app.chosenPosition}
					leegtekst={text.lineupScreen.benchEmpty}
					ontik={(id) => app.putOnPositionWhileSettingUp(bron, id)}
				/>
			</div>

			{#if app.chosenPosition}
				<div class="melding">
					<span>
						{#if gekozenSpeler}
							<b>{gekozenSpeler.name}</b> ·
							{text.lineupScreen.chosenPlayer(LINES[positionLine(app.chosenPosition, doel.formation)].toLowerCase())}
						{:else}
							<b>{text.lineupScreen.emptyPosition}</b> ·
							{text.lineupScreen.chosenEmpty(LINES[positionLine(app.chosenPosition, doel.formation)].toLowerCase())}
						{/if}
					</span>
					{#if gekozenSpeler}
						<button class="klein" onclick={() => app.takeOffPitch(bron, app.chosenPosition!)}
							>{text.lineupScreen.toBench}</button
						>
					{/if}
					<button class="klein" onclick={() => (app.chosenPosition = null)}>{text.common.cancel}</button>
				</div>
			{/if}

			{#if !app.chosenPosition && zonderWissel.length}
				<p class="uitleg" style="padding: 0 12px; margin: 0 0 8px">
					<b class="mager">{text.lineupScreen.noSubstitute(zonderWissel.join(', '))}</b>
				</p>
			{/if}
			{#if !app.chosenPosition && (mageren.length || app.toestand.archive.length || bron === 'wedstrijd')}
				<p class="uitleg" style="padding: 0 12px">
					{#if mageren.length}
						{text.lineupScreen.thinLead}
						{#each mageren as p, i (p.id)}
							{@const r = attendanceOf(app.toestand.trainings, p.id, 4)}
							<b class="mager">{text.lineupScreen.thinPlayer(p.name, r.er, r.totaal)}</b>{i < mageren.length - 1
								? ', '
								: ''}
						{/each}
					{/if}
					{#if app.toestand.archive.length}
						<!-- Het veld vult het scherm, dus het overzicht staat eronder. Zonder
						     dit knopje weet niemand dat het er is. -->
						<button class="linkje" onclick={() => bankOverzicht?.scrollIntoView({ behavior: 'smooth' })}
							>{text.lineupScreen.toBenchOverview}</button
						>
						·
						<a class="linkje" href="/app/coach/{bron}">{text.lineupScreen.toCoach}</a>
					{/if}
					{#if bron === 'wedstrijd'}
						{#if app.toestand.archive.length}·{/if}
						<a class="linkje" href="/app/wisselplan">{text.plan.toPlan(app.match?.plan?.length ?? 0)}</a>
					{/if}
				</p>
			{/if}

			<div class="knoprij">
				{#if bron === 'standaard'}
					<label class="formatiekeuze">
						{text.lineupScreen.formationLabel}
						<select value={doel.formation} onchange={(e) => app.chooseFormation(e.currentTarget.value)}>
							{#each FORMATS as vorm (vorm.name)}
								<optgroup label={vorm.name + (vorm.uitleg ? ' · ' + vorm.uitleg : '')}>
									{#each vorm.formaties as f (f.sleutel)}
										<option value={f.sleutel}>{f.sleutel}{f.uitleg ? ' · ' + f.uitleg : ''}</option>
									{/each}
								</optgroup>
							{/each}
						</select>
					</label>
				{/if}
				<button class="prim" onclick={klaar}>
					{bron === 'standaard' ? text.lineupScreen.saveDefault : text.lineupScreen.doneToMatch}
				</button>
				{#if bron === 'wedstrijd'}
					<a class="knop" href="/app/aanwezig">{text.lineupScreen.whoIsThere}</a>
				{/if}
				{#if bron === 'standaard'}
					<button class="uit" onclick={wissen}>{text.lineupScreen.clear}</button>
				{/if}
				<span class="uitleg" style="align-self: center; margin: 0">{text.lineupScreen.filled(bezet, nodig)}</span>
			</div>
		</div>

		<section class="pad bankoverzicht" bind:this={bankOverzicht}>
			<h2>{text.lineupScreen.benchHeading}</h2>
			{#if !app.toestand.archive.length}
				<p class="uitleg">{text.lineupScreen.benchNothingYet}</p>
			{:else}
				<p class="uitleg">
					{text.lineupScreen.benchHint(app.toestand.archive.length, app.toestand.trainings.length)}
				</p>
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/coach/{bron}">{text.lineupScreen.toCoach}</a>
				</div>
				<table class="uitslag spelers">
					<tbody>
						{#each bankRijen as r (r.id)}
							{@const nu = nuOpDeBank.has(r.id)}
							{@const weer = nu && r.startedOnBench > 0}
							<tr>
								<td>
									{r.name}
									<span class="sub">
										{#if !r.matches}
											{text.lineupScreen.benchNoMatch}
										{:else if r.startsKnown}
											{text.lineupScreen.benchStarts(r.startedOnBench, r.startsKnown)}
										{/if}
										{#if nu}
											{r.matches && r.startsKnown ? '·' : ''}
											<b class:mager={weer}>{weer ? text.lineupScreen.benchAgain : text.lineupScreen.benchNow}</b>
										{/if}
									</span>
								</td>
								<td class="balk">
									<div class="staaf"><i style="width: {Math.round((r.benchSeconds / meesteBank) * 100)}%"></i></div>
								</td>
								<td class="m">
									{text.lineupScreen.benchMinutes(Math.round(r.benchSeconds / 60))}
									<span class="sub" class:mager={thinAttendance(r.attendance)}>
										{r.attendance.totaal
											? text.lineupScreen.benchTraining(r.attendance.er, r.attendance.totaal)
											: text.lineupScreen.benchNoTraining}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	</main>
{/if}

<style>
	/* Een knop die leest als een verwijzing: hij hoort bij de zin eromheen. */
	.linkje {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: inherit;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}
	.bankoverzicht {
		padding-top: 24px;
	}
</style>
