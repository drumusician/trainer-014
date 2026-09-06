<script lang="ts">
	import { goto } from '$app/navigation';
	import { FORMATS } from '$lib/domain/formations';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

	$effect(() => zetKop('Aan de slag', '/app', 'Overslaan'));

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
			alert('Vul de naam van je team in.');
			return;
		}
		app.setTeamName(name);
		stap = 2;
	}

	function naarDrie() {
		if (aantalNamen) app.addPlayerNames(namenVak);
		namenVak = '';
		if (!t.players.length) {
			alert('Zet er minstens één speler in, anders valt er niets op te stellen.');
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
		<p class="uitleg stappen-teller">Stap {stap} van 3</p>

		{#if stap === 1}
			<h2>Hoe heet je team?</h2>
			<p class="uitleg">
				Die naam staat boven je wedstrijd en in het verslag dat je na afloop deelt. Iets als JO11-2, MO13-1 of gewoon de
				naam die iedereen gebruikt.
			</p>
			<label class="vak">
				Teamnaam
				<input bind:value={name} placeholder="bijv. JO11-2" />
			</label>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={naarTwee}>Verder</button>
			</div>
		{:else if stap === 2}
			<h2>Wie zitten erin?</h2>
			<p class="uitleg">
				Plak of typ de namen, één per regel. Alleen voornamen is genoeg. Ze blijven op dit toestel staan en gaan nergens
				anders heen.
			</p>
			<textarea bind:value={namenVak} placeholder="Sem&#10;Noah&#10;Luuk"></textarea>
			<p class="uitleg" style="margin-top: 8px">
				{#if t.players.length}
					Je hebt er al {t.players.length}.
					{#if aantalNamen}Hier komen er {aantalNamen} bij.{/if}
				{:else if aantalNamen}
					{aantalNamen}
					{aantalNamen === 1 ? 'naam' : 'namen'} ingevuld.
				{:else}
					Later players toevoegen kan altijd.
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={naarDrie}>Verder</button>
				<button onclick={() => (stap = 1)}>Terug</button>
			</div>
		{:else}
			<h2>Hoe spelen jullie?</h2>
			<p class="uitleg">
				Dit bepaalt hoeveel plekken er op het veld staan en hoe de klok loopt. Je kunt het later altijd omzetten; je
				opstelling verhuist dan mee.
			</p>
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
			<label class="vak">
				Minuten per {t.parts === 4 ? 'kwart' : 'helft'}
				<input type="number" inputmode="numeric" bind:value={t.minutesPerPart} onchange={() => app.save()} />
			</label>

			<h2>Klaar</h2>
			<p class="uitleg">
				<b>{t.teamName}</b>, {t.players.length}
				{t.players.length === 1 ? 'speler' : 'spelers'}, {t.formation} in
				{t.parts === 4 ? 'vier kwarten' : 'twee helften'} van {t.minutesPerPart} minuten.
			</p>
			<p class="uitleg">
				Wil je nu meteen je vaste opstelling neerzetten? Dan begint elke wedstrijd daarmee en hoef je langs de lijn
				alleen nog te wisselen.
			</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={() => klaar(true)}>Opstelling maken</button>
				<button onclick={() => klaar(false)}>Later</button>
				<button onclick={() => (stap = 2)}>Terug</button>
			</div>
		{/if}
	</div>
</main>
