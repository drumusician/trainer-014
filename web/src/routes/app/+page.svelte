<script lang="ts">
	import { goto } from '$app/navigation';
	import { mmss, verstreken } from '$lib/domein/tijd';
	import { deelNaam, pauzeNaam } from '$lib/domein/delen';
	import { datumKort } from '$lib/domein/datum';
	import { seizoenStand } from '$lib/domein/seizoen';
	import { SPEELVORMEN } from '$lib/domein/formaties';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Wedstrijden'));

	const t = $derived(app.toestand);
	const w = $derived(app.wedstrijd);
	const staatKlaar = $derived(!!w && !w.afgelopen && Object.values(w.opstelling).some(Boolean));
	const bezig = $derived(staatKlaar && app.gestart);
	const opgezet = $derived(!!w && !w.afgelopen && !Object.values(w.opstelling).some(Boolean));
	const teBewaren = $derived(!!w && w.afgelopen && !w.bewaard);
	const loopt = $derived(staatKlaar || opgezet || teBewaren);

	const st = $derived(seizoenStand(t.archief));

	function beginnen() {
		if (!t.spelers.length) {
			goto('/app/opzetten');
			return;
		}
		app.nieuweWedstrijd('', true);
		goto('/app/aanwezig');
	}
</script>

<main>
	<div class="pad">
		{#if !t.spelers.length}
			<h2>Welkom bij Blaadje</h2>
			<p class="uitleg">
				In drie stappen sta je klaar: de naam van je team, wie erin zitten, en hoe jullie spelen. Duurt een minuut.
			</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/opzetten">Aan de slag</a>
			</div>
		{:else}
			<!-- Wat er nu speelt staat bovenaan en is meteen de knop ernaartoe. -->
			{#if bezig}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">Bezig</div>
					<div class="titel">
						{w!.thuis ? t.teamnaam + ' – ' + w!.tegenstander : w!.tegenstander + ' – ' + t.teamnaam}
					</div>
					<div class="erbij">
						{mmss(verstreken(w, app.nu))} ·
						{w!.pauze ? pauzeNaam(w!.deel, w!.delen).toLowerCase() : deelNaam(w!.deel, w!.delen)} ·
						{w!.loopt ? 'klok loopt' : 'klok staat stil'}
					</div>
				</a>
			{:else if staatKlaar}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">Klaar om te beginnen</div>
					<div class="titel">
						{w!.thuis ? t.teamnaam + ' – ' + w!.tegenstander : w!.tegenstander + ' – ' + t.teamnaam}
					</div>
					<div class="erbij">De opstelling staat. De klok begint als jij op Start drukt.</div>
				</a>
			{:else if opgezet}
				<a class="nu" href="/app/opstelling/wedstrijd">
					<div class="wat">Nog te doen</div>
					<div class="titel">Opstelling maken</div>
					<div class="erbij">Tegen {w!.tegenstander}</div>
				</a>
			{:else if teBewaren}
				<a class="nu" href="/app/afloop">
					<div class="wat">Net gespeeld</div>
					<div class="titel">Nog niet bewaard</div>
					<div class="erbij">Tegen {w!.tegenstander}</div>
				</a>
			{:else}
				<button class="nu" style="width: 100%; text-align: left; border: 0" onclick={beginnen}>
					<div class="wat">Zaterdag</div>
					<div class="titel">Nieuwe wedstrijd</div>
					<div class="erbij">
						{t.formatie} · {t.delen === 4 ? '4 kwarten' : '2 helften'} van {t.helftMinuten} min
					</div>
				</button>
			{/if}

			{#if loopt}
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/aanwezig">Wie is er?</a>
					<a class="knop" href="/app/opstelling/wedstrijd">Opstelling</a>
					<button
						class="uit"
						onclick={() => {
							if (
								confirm(
									'Deze wedstrijd tegen ' + w!.tegenstander + ' weggooien?\n\nWat je in het archief bewaarde blijft staan.'
								)
							)
								app.gooiWedstrijdWeg();
						}}>Weggooien</button
					>
				</div>
			{:else}
				<h2>Zo spelen jullie</h2>
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
				<div class="tweekolom">
					<label class="vak">
						Minuten per {t.delen === 4 ? 'kwart' : 'helft'}
						<input type="number" inputmode="numeric" bind:value={t.helftMinuten} onchange={() => app.bewaar()} />
					</label>
					<label class="vak">
						Speelduur
						<input value={t.helftMinuten * t.delen + ' minuten'} readonly />
					</label>
				</div>
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/opstelling/standaard">
						{t.standaard ? 'Vaste opstelling wijzigen' : 'Vaste opstelling maken'}
					</a>
				</div>
			{/if}

			<h2>Gespeeld</h2>
			{#if !t.archief.length}
				<p class="uitleg">
					Nog niets bewaard. Sluit een wedstrijd af en bewaar hem, dan staat hij hier met uitslag, speeltijden en het
					hele verloop.
				</p>
			{:else}
				<p class="uitleg">
					{st.gewonnen}W {st.gelijk}G {st.verloren}V · {st.voor} voor, {st.tegen} tegen ·
					{Math.round(st.seconden / 60)} minuten voetbal
				</p>
				<ul class="log">
					{#each t.archief as a, i (a)}
						<li class="klikbaar">
							<a href="/app/archief/{i}">
								<b>{datumKort(a.datum)}</b>
								<span>{a.thuis !== false ? 'thuis' : 'uit'} tegen {a.tegenstander}</span>
								<span style="flex: none; font-weight: 700; font-variant-numeric: tabular-nums">
									{a.stand?.[0] ?? 0}–{a.stand?.[1] ?? 0}
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
