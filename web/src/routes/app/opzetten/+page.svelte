<script lang="ts">
	import { goto } from '$app/navigation';
	import { SPEELVORMEN } from '$lib/domein/formaties';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Aan de slag', '/app', 'Overslaan'));

	const t = $derived(app.toestand);

	let stap = $state(1);
	let naam = $state('');
	let namenVak = $state('');

	/* Wat er al staat overnemen, zodat je hem ook halverwege kunt gebruiken. */
	$effect(() => {
		if (!naam && t.teamnaam !== 'Ons team') naam = t.teamnaam;
	});

	const aantalNamen = $derived(namenVak.split('\n').map((r) => r.trim()).filter(Boolean).length);

	function naarTwee() {
		if (!naam.trim()) {
			alert('Vul de naam van je team in.');
			return;
		}
		app.zetTeamnaam(naam);
		stap = 2;
	}

	function naarDrie() {
		if (aantalNamen) app.namenErbij(namenVak);
		namenVak = '';
		if (!t.spelers.length) {
			alert('Zet er minstens één speler in, anders valt er niets op te stellen.');
			return;
		}
		stap = 3;
	}

	function klaar(naarOpstelling: boolean) {
		app.bewaar();
		if (naarOpstelling) {
			app.zorgVoorStandaard();
			app.gekozenPlek = null;
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
				Die naam staat boven je wedstrijd en in het verslag dat je na afloop deelt. Iets als JO11-2, MO13-1 of gewoon
				de naam die iedereen gebruikt.
			</p>
			<label class="vak">
				Teamnaam
				<input bind:value={naam} placeholder="bijv. JO11-2" />
			</label>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={naarTwee}>Verder</button>
			</div>
		{:else if stap === 2}
			<h2>Wie zitten erin?</h2>
			<p class="uitleg">
				Plak of typ de namen, één per regel. Alleen voornamen is genoeg. Ze blijven op dit toestel staan en gaan
				nergens anders heen.
			</p>
			<textarea bind:value={namenVak} placeholder="Sem&#10;Noah&#10;Luuk"></textarea>
			<p class="uitleg" style="margin-top: 8px">
				{#if t.spelers.length}
					Je hebt er al {t.spelers.length}.
					{#if aantalNamen}Hier komen er {aantalNamen} bij.{/if}
				{:else if aantalNamen}
					{aantalNamen}
					{aantalNamen === 1 ? 'naam' : 'namen'} ingevuld.
				{:else}
					Later spelers toevoegen kan altijd.
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={naarDrie}>Verder</button>
				<button onclick={() => (stap = 1)}>Terug</button>
			</div>
		{:else}
			<h2>Hoe spelen jullie?</h2>
			<p class="uitleg">
				Dit bepaalt hoeveel plekken er op het veld staan en hoe de klok loopt. Je kunt het later altijd omzetten;
				je opstelling verhuist dan mee.
			</p>
			<div class="tweekolom">
				<label class="vak">
					Formatie
					<select value={t.formatie} onchange={(e) => app.kiesFormatie(e.currentTarget.value)}>
						{#each SPEELVORMEN as vorm (vorm.naam)}
							<optgroup label={vorm.naam + (vorm.uitleg ? ' · ' + vorm.uitleg : '')}>
								{#each vorm.formaties as f (f.sleutel)}
									<option value={f.sleutel}>{f.sleutel}{f.uitleg ? ' · ' + f.uitleg : ''}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>
				<label class="vak">
					Speelwijze
					<select bind:value={t.delen} onchange={() => app.bewaar()}>
						<option value={2}>2 helften</option>
						<option value={4}>4 kwarten</option>
					</select>
				</label>
			</div>
			<label class="vak">
				Minuten per {t.delen === 4 ? 'kwart' : 'helft'}
				<input type="number" inputmode="numeric" bind:value={t.helftMinuten} onchange={() => app.bewaar()} />
			</label>

			<h2>Klaar</h2>
			<p class="uitleg">
				<b>{t.teamnaam}</b>, {t.spelers.length}
				{t.spelers.length === 1 ? 'speler' : 'spelers'}, {t.formatie} in
				{t.delen === 4 ? 'vier kwarten' : 'twee helften'} van {t.helftMinuten} minuten.
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
