<script lang="ts">
	import { goto } from '$app/navigation';
	import { FORMATS } from '$lib/domain/formations';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop(text.setup.title, '/app', text.setup.skip));

	const t = $derived(app.toestand);

	let stap = $state(1);
	let name = $state('');
	let namenVak = $state('');

	/* Adopt what is already there, so you can also use this halfway through. */
	$effect(() => {
		if (!name && t.teamName !== 'Ons team') name = t.teamName;
	});

	const aantalNamen = $derived(
		namenVak
			.split('\n')
			.map((r) => r.trim())
			.filter(Boolean).length
	);

	function naarTwee() {
		if (!name.trim()) {
			alert(text.setup.needName);
			return;
		}
		app.setTeamName(name);
		stap = 2;
	}

	function naarDrie() {
		if (aantalNamen) app.addPlayerNames(namenVak);
		namenVak = '';
		if (!t.players.length) {
			alert(text.setup.needPlayer);
			return;
		}
		stap = 3;
	}

	function klaar(naarOpstelling: boolean) {
		app.save();
		if (naarOpstelling) {
			app.ensureDefaultLineup();
			app.chosenPosition = null;
			goto('/app/opstelling/standaard');
		} else {
			goto('/app');
		}
	}
</script>

<main>
	<div class="pad">
		<p class="uitleg stappen-teller">{text.setup.step(stap)}</p>

		{#if stap === 1}
			<h2>{text.setup.nameHeading}</h2>
			<p class="uitleg">{text.setup.nameHint}</p>
			<label class="vak">
				{text.setup.nameLabel}
				<input bind:value={name} placeholder={text.setup.namePlaceholder} />
			</label>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={naarTwee}>{text.setup.next}</button>
			</div>
		{:else if stap === 2}
			<h2>{text.setup.squadHeading}</h2>
			<p class="uitleg">{text.setup.squadHint}</p>
			<textarea bind:value={namenVak} placeholder={text.setup.namesPlaceholder}></textarea>
			<p class="uitleg" style="margin-top: 8px">
				{#if t.players.length}
					{text.setup.already(t.players.length)}
					{#if aantalNamen}{text.setup.adding(aantalNamen)}{/if}
				{:else if aantalNamen}
					{text.setup.filled(aantalNamen)}
				{:else}
					{text.setup.laterIsFine}
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={naarDrie}>{text.setup.next}</button>
				<button onclick={() => (stap = 1)}>{text.setup.back}</button>
			</div>
		{:else}
			<h2>{text.setup.playHeading}</h2>
			<p class="uitleg">{text.setup.playHint}</p>
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
			<label class="vak">
				{text.home.minutesLabel(t.parts)}
				<input type="number" inputmode="numeric" bind:value={t.minutesPerPart} onchange={() => app.save()} />
			</label>

			<h2>{text.setup.doneHeading}</h2>
			<p class="uitleg">
				<b>{t.teamName}</b>, {text.setup.summary(t.players.length, t.formation, t.parts, t.minutesPerPart)}
			</p>
			<p class="uitleg">{text.setup.lineupHint}</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={() => klaar(true)}>{text.setup.makeLineup}</button>
				<button onclick={() => klaar(false)}>{text.setup.later}</button>
				<button onclick={() => (stap = 2)}>{text.setup.back}</button>
			</div>
		{/if}
	</div>
</main>
