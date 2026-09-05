<script lang="ts">
	import { goto } from '$app/navigation';
	import { mmss, verstreken } from '$lib/domein/tijd';
	import { deelNaam, pauzeNaam } from '$lib/domein/delen';
	import { datumKort } from '$lib/domein/datum';
	import { mager, presentie } from '$lib/domein/presentie';
	import { seizoenStand } from '$lib/domein/seizoen';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Blaadje'));

	const t = $derived(app.toestand);
	const w = $derived(app.wedstrijd);
	const staatKlaar = $derived(!!w && !w.afgelopen && Object.values(w.opstelling).some(Boolean));
	const bezig = $derived(staatKlaar && app.gestart);
	const opgezet = $derived(!!w && !w.afgelopen && !Object.values(w.opstelling).some(Boolean));
	const teBewaren = $derived(!!w && w.afgelopen && !w.bewaard);

	const st = $derived(seizoenStand(t.archief));
	const mageren = $derived(t.spelers.filter((p) => mager(presentie(t.trainingen, p.id, 4))));

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
			<!-- Wat er nu speelt, altijd bovenaan en altijd één tik weg. -->
			{#if bezig}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">Bezig</div>
					<div class="titel">{w!.thuis ? t.teamnaam + ' – ' + w!.tegenstander : w!.tegenstander + ' – ' + t.teamnaam}</div>
					<div class="erbij">
						{mmss(verstreken(w, app.nu))} ·
						{w!.pauze ? pauzeNaam(w!.deel, w!.delen).toLowerCase() : deelNaam(w!.deel, w!.delen)} ·
						{w!.loopt ? 'klok loopt' : 'klok staat stil'}
					</div>
				</a>
			{:else if staatKlaar}
				<a class="nu" href="/app/wedstrijd">
					<div class="wat">Klaar om te beginnen</div>
					<div class="titel">{w!.thuis ? t.teamnaam + ' – ' + w!.tegenstander : w!.tegenstander + ' – ' + t.teamnaam}</div>
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
					<div class="erbij">{t.formatie} · {t.delen === 4 ? '4 kwarten' : '2 helften'} van {t.helftMinuten} min</div>
				</button>
			{/if}

			{#if staatKlaar || opgezet}
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/app/aanwezig">Wie is er?</a>
					<a class="knop" href="/app/opstelling/wedstrijd">Opstelling</a>
					<button
						class="uit"
						onclick={() => {
							if (confirm('Deze wedstrijd tegen ' + w!.tegenstander + ' weggooien?\n\nWat je in het archief bewaarde blijft staan.'))
								app.gooiWedstrijdWeg();
						}}>Weggooien</button
					>
				</div>
			{/if}

			<div class="kaarten">
				<a class="kaart" href="/app/trainingen">
					<b>Training</b>
					<span>
						{#if t.trainingen.length}
							Laatste {datumKort(t.trainingen[0].datum)} · {t.trainingen.length} bijgehouden
						{:else}
							Nog niets bijgehouden
						{/if}
					</span>
					{#if mageren.length === 1}
						<span class="mager">{mageren[0].naam} kwam weinig</span>
					{:else if mageren.length}
						<span class="mager">{mageren.length} spelers kwamen weinig</span>
					{/if}
				</a>

				<a class="kaart" href="/app/team/spelers">
					<b>Speeltijd</b>
					<span>Wie hoeveel speelde, en de presentie erbij</span>
				</a>

				<a class="kaart" href="/app/opstelling/standaard">
					<b>Vaste opstelling</b>
					<span>
						{t.standaard ? 'Elke wedstrijd begint hiermee' : 'Nog niet gemaakt'} · {t.formatie}
					</span>
				</a>

				<a class="kaart" href="/app/team">
					<b>Selectie</b>
					<span>{t.spelers.length} spelers · {t.teamnaam}</span>
				</a>

				<a class="kaart" href="/app/archief">
					<b>Archief</b>
					<span>
						{#if t.archief.length}
							{st.gewonnen}W {st.gelijk}G {st.verloren}V · {t.archief.length}
							{t.archief.length === 1 ? 'wedstrijd' : 'wedstrijden'}
						{:else}
							Nog geen bewaarde wedstrijden
						{/if}
					</span>
				</a>

				<a class="kaart" href="/app/meer">
					<b>Meer</b>
					<span>Synchroniseren, back-up, overzetten</span>
				</a>
			</div>
		{/if}
	</div>
</main>
