<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Veld from '$lib/componenten/Veld.svelte';
	import BankKolom from '$lib/componenten/BankKolom.svelte';
	import { groepVan, LINIES } from '$lib/domein/formaties';
	import { mager, presentie } from '$lib/domein/presentie';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import type { Linie } from '$lib/domein/types';

	const bron = $derived(page.params.bron === 'standaard' ? 'standaard' : 'wedstrijd');
	const doel = $derived(bron === 'standaard' ? app.toestand.standaard : app.wedstrijd);

	$effect(() => {
		zetKop(bron === 'standaard' ? 'Standaardopstelling' : 'Opstelling', '/instellen', 'Terug');
	});

	const bezet = $derived(doel ? Object.values(doel.opstelling).filter(Boolean).length : 0);

	/* Linies zonder wissel: dat is een verrassing die je liever nu hebt. */
	const zonderWissel = $derived.by(() => {
		if (!doel) return [];
		const bank = doel.bank.map((id) => app.spelerVan(id)).filter(Boolean);
		return (['A', 'M', 'V', 'K'] as Linie[])
			.filter((code) => !bank.some((p) => p && groepVan(p) === code))
			.map((code) => LINIES[code].toLowerCase());
	});

	const mageren = $derived(
		app.toestand.spelers.filter((p) => mager(presentie(app.toestand.trainingen, p.id, 4)))
	);

	function klaar() {
		if (bron === 'standaard') {
			app.bewaar();
			goto('/instellen');
			return;
		}
		if (bezet < 11 && !confirm('Er staan er ' + bezet + ' op het veld in plaats van 11. Toch doorgaan?')) return;
		app.gekozenPlek = null;
		goto('/');
	}

	function wissen() {
		if (!confirm('De standaardopstelling weggooien?')) return;
		app.wisStandaard();
		goto('/instellen');
	}
</script>

{#if !doel}
	<main>
		<div class="pad">
			<p class="uitleg">Er is niets om op te stellen.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/instellen">Terug</a></div>
		</div>
	</main>
{:else}
	<main>
		<div class="veldscherm zonderklok">
			<div class="veldrij">
				<Veld
					formatie={doel.formatie}
					opstelling={doel.opstelling}
					gekozen={app.gekozenPlek}
					onplek={(plekId) => (app.gekozenPlek = app.gekozenPlek === plekId ? null : plekId)}
				/>
				<BankKolom
					bank={doel.bank}
					formatie={doel.formatie}
					gekozen={app.gekozenPlek}
					leegtekst="Niemand over."
					ontik={(id) => app.zetInOpzet(bron, id)}
				/>
			</div>

			{#if zonderWissel.length}
				<p class="uitleg" style="padding: 0 12px; margin: 0 0 8px">
					<b class="mager">Geen wissel voor {zonderWissel.join(', ')}.</b>
				</p>
			{/if}
			{#if mageren.length}
				<p class="uitleg" style="padding: 0 12px">
					Weinig getraind:
					{#each mageren as p, i (p.id)}
						{@const r = presentie(app.toestand.trainingen, p.id, 4)}
						<b class="mager">{p.naam} {r.er}/{r.totaal}</b>{i < mageren.length - 1 ? ', ' : ''}
					{/each}
				</p>
			{/if}

			<div class="knoprij">
				<button class="prim" onclick={klaar}>
					{bron === 'standaard' ? 'Bewaren' : 'Klaar — naar de wedstrijd'}
				</button>
				{#if bron === 'standaard'}
					<button class="uit" onclick={wissen}>Wissen</button>
				{/if}
				<span class="uitleg" style="align-self: center; margin: 0">{bezet} van de 11 ingevuld</span>
			</div>
		</div>
	</main>
{/if}
