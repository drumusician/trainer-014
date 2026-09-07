<script lang="ts">
	import { onMount } from 'svelte';
	import OpBeginscherm from '$lib/components/OpBeginscherm.svelte';
	import { meld, startMeten } from '$lib/analytics';
	import { text } from '$lib/text/nl';
	import { isInstalled } from '$lib/domain/device';

	onMount(() => {
		/* On iOS "Add to Home Screen" saves the page you were on at that moment, not
		   what the manifest says. So anyone who made the icon from this page opens the
		   brochure instead of the app. Then we send them onwards, and do not measure:
		   this is an app opening, not a visit to the site. */
		if (isInstalled()) {
			location.replace('/app');
			return;
		}
		return startMeten();
	});
</script>

<svelte:head>
	<title>{text.landing.pageTitle}</title>
	<meta name="description" content={text.landing.pageDescription} />
</svelte:head>

<div class="landing">
	<header class="kop">
		<span class="merk">Blaadje</span>
		<a class="knop prim" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}
			>{text.landing.openShort}</a
		>
	</header>

	<section class="hero">
		<h1>{text.landing.heroLine1}<br />{text.landing.heroLine2}</h1>
		<p class="groot">
			{text.landing.heroLead}
		</p>
		<div class="knoprij">
			<a class="knop prim groot" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}
				>{text.landing.openLong}</a
			>
			<span class="klein">{text.landing.heroSmall}</span>
		</div>
	</section>

	<section class="plaat">
		<img src="/scherm-wedstrijd.png" width="390" height="700" alt={text.landing.shotMatchAlt} />
	</section>

	<section class="blokken">
		<div>
			<h2>{text.landing.blocks.substitutions.heading}</h2>
			<p>
				{text.landing.blocks.substitutions.body}
			</p>
		</div>
		<div>
			<h2>{text.landing.blocks.playingTime.heading}</h2>
			<p>
				{text.landing.blocks.playingTime.body}
			</p>
		</div>
		<div>
			<h2>{text.landing.blocks.parts.heading}</h2>
			<p>
				{text.landing.blocks.parts.body}
			</p>
		</div>
		<div>
			<h2>{text.landing.blocks.attendance.heading}</h2>
			<p>
				{text.landing.blocks.attendance.body}
			</p>
		</div>
		<div>
			<h2>{text.landing.blocks.report.heading}</h2>
			<p>
				{text.landing.blocks.report.body}
			</p>
		</div>
		<div>
			<h2>{text.landing.blocks.touchline.heading}</h2>
			<p>
				{text.landing.blocks.touchline.body}
			</p>
		</div>
	</section>

	<section class="plaat smal">
		<img src="/scherm-spelers.png" width="390" height="700" loading="lazy" alt={text.landing.shotPlayersAlt} />
		<p class="onderschrift">
			{text.landing.shotPlayersCaption}
		</p>
	</section>

	<section class="rustig">
		<OpBeginscherm />
	</section>

	<section class="rustig">
		<h2>{text.landing.privacyHeading}</h2>
		<p>
			{text.landing.privacy1}
		</p>
		<p>
			{text.landing.privacyShare}
		</p>
		<p>
			{text.landing.privacy2}
		</p>
		<p>
			<b>{text.landing.privacy3.bold}</b>
			{text.landing.privacy3.after}
		</p>
	</section>

	<section class="rustig">
		<h2>{text.landing.priceHeading}</h2>
		<p>
			{text.landing.price1}
		</p>
		<p>
			{text.landing.price2}
		</p>
		<p>
			{text.landing.price3}
		</p>
		<p>
			{text.landing.price4.before}
			<a href="mailto:{text.landing.email}">{text.landing.email}</a>{text.landing.price4.after}
		</p>
	</section>

	<section class="rustig">
		<h2>{text.landing.originHeading}</h2>
		<p>
			{text.landing.origin1}
		</p>
		<p>
			{text.landing.origin2.before}
			<a href="mailto:{text.landing.email}">{text.landing.email}</a>{text.landing.origin2.after}
		</p>
		<div class="knoprij">
			<a class="knop prim groot" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}
				>{text.landing.getStarted}</a
			>
		</div>
	</section>

	<footer>
		<p>
			{text.landing.footerBefore}
			<a href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}>{text.landing.footerLink}</a>
			{text.landing.footerDot}
			<a href="mailto:{text.landing.email}">{text.landing.email}</a>
		</p>
	</footer>
</div>

<style>
	/*
	 * :global() staat er waar een regel de grens van een component oversteekt.
	 *
	 * Het blok 'Op je beginscherm zetten' wordt door OpBeginscherm getekend, en
	 * gescopete stijl reikt niet in een kindcomponent. Zonder deze markering viel
	 * die kop stilletjes terug op de standaardstijl — precies elf pixels korter,
	 * en op het scherm nauwelijks te zien. Waar :global() staat, staat dus een
	 * componentgrens.
	 */
	/*
	 * De stijl van deze pagina, en van niets anders.
	 *
	 * Stond in app.css, waar hij een derde van het blad vulde terwijl geen enkel
	 * ander scherm hem gebruikt. Hier is hij vanzelf begrensd: Svelte zet er een
	 * kenmerk op, dus deze regels kunnen nooit meer iets in de app raken.
	 *
	 * De kleuren en maten komen nog wel uit app.css, want die zijn van de hele app.
	 */
	.landing {
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
		line-height: 1.55;
		/* Body is een flex-kolom voor de app, waar niets mag scrollen. Een
		   landingspagina is juist een gewone pagina: laten groeien en de browser
		   laten scrollen. */
		flex: 0 0 auto;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.landing > section,
	.landing > header,
	.landing > footer {
		max-width: 760px;
		margin: 0 auto;
		padding: 0 20px;
	}

	.landing .kop {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 18px;
		padding-bottom: 18px;
	}
	.landing .merk {
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--groen);
	}

	.landing .hero {
		padding-top: 32px;
		padding-bottom: 8px;
	}
	.landing h1 {
		font-size: clamp(30px, 7vw, 46px);
		line-height: 1.12;
		letter-spacing: -0.02em;
		margin: 0 0 16px;
		color: var(--inkt);
	}
	.landing p.groot {
		font-size: clamp(17px, 2.4vw, 20px);
		color: var(--grijs);
		margin: 0 0 24px;
		max-width: 34em;
	}
	.landing :global(.knoprij) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
		padding: 0;
	}
	.landing :global(.knop.groot) {
		font-size: 17px;
		padding: 13px 22px;
		border-radius: 11px;
	}
	.landing :global(.klein) {
		font-size: 14px;
		color: var(--grijs);
	}

	.landing .plaat {
		padding-top: 36px;
		padding-bottom: 36px;
		text-align: center;
	}
	.landing .plaat img {
		width: 100%;
		max-width: 330px;
		height: auto;
		border: 1px solid var(--lijn);
		border-radius: 18px;
		box-shadow: 0 18px 44px rgba(22, 32, 29, 0.13);
	}
	.landing .plaat.smal img {
		max-width: 300px;
	}
	.landing .onderschrift {
		font-size: 14px;
		color: var(--grijs);
		margin: 16px auto 0;
		max-width: 34em;
	}

	.landing .blokken {
		display: grid;
		gap: 28px 32px;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		padding-top: 24px;
		padding-bottom: 24px;
	}
	.landing .blokken h2 {
		font-size: 17px;
		text-transform: none;
		letter-spacing: -0.01em;
		color: var(--inkt);
		margin: 0 0 6px;
	}
	.landing .blokken p {
		margin: 0;
		color: var(--grijs);
		font-size: 15px;
	}

	.landing .rustig {
		padding-top: 32px;
		padding-bottom: 8px;
	}
	.landing .rustig :global(h2) {
		font-size: 20px;
		text-transform: none;
		letter-spacing: -0.01em;
		color: var(--groen);
		margin: 0 0 10px;
	}
	.landing .rustig :global(p) {
		color: var(--grijs);
		margin: 0 0 14px;
		max-width: 36em;
	}

	.landing footer {
		margin-top: 48px;
		padding-top: 20px;
		padding-bottom: 40px;
		border-top: 1px solid var(--lijn);
	}
	.landing footer p {
		font-size: 14px;
		color: var(--grijs);
		margin: 0;
	}
	/* Alleen links in lopende tekst; een knop houdt zijn eigen kleur. */
	.landing footer p a,
	.landing .rustig :global(p a) {
		color: var(--groen);
	}

	.landing :global(.klein) {
		display: block;
		margin-top: 4px;
	}

	/* ---------- beginscherm met kaarten ----------
	   Wat je vaak doet staat in de tabbalk; alles wat verder weg ligt staat hier,
	   zodat niets in een ander scherm verstopt zit. */

	/* De grote kaart bovenaan: wat er nu speelt. */
</style>
