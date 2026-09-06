<script lang="ts">
	import { onMount } from 'svelte';
	import OpBeginscherm from '$lib/components/OpBeginscherm.svelte';
	import { meld, startMeten } from '$lib/analytics';
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
	<title>Blaadje — wedstrijdapp voor jeugdtrainers</title>
	<meta
		name="description"
		content="Je opstelling, je wissels en de speeltijd, bijgehouden terwijl je coacht. Werkt zonder bereik en zonder account, gewoon op je telefoon."
	/>
</svelte:head>

<div class="landing">
	<header class="kop">
		<span class="merk">Blaadje</span>
		<a class="knop prim" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}>Openen</a>
	</header>

	<section class="hero">
		<h1>Het blaadje in je hand,<br />maar dan op je telefoon</h1>
		<p class="groot">
			Blaadje houdt je lineup, je wissels en de playingTime bij terwijl jij coacht. Een wissel kost twee tikken, en na
			afloop weet je precies wie hoe lang heeft gespeeld.
		</p>
		<div class="knoprij">
			<a class="knop prim groot" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}>Blaadje openen</a
			>
			<span class="klein">Gratis proberen · geen account nodig · werkt zonder bereik</span>
		</div>
	</section>

	<section class="plaat">
		<img
			src="/scherm-wedstrijd.png"
			width="390"
			height="700"
			alt="Het wedstrijdscherm met de opstelling op een veld en de bank ernaast"
		/>
	</section>

	<section class="blokken">
		<div>
			<h2>Wisselen in twee tikken</h2>
			<p>
				Tik wie off gaat, tik wie on komt. De bench staat naast het veld, in dezelfde volgorde als de linies, en
				bovenaan staat wie tot nu toe het minst heeft gespeeld. Twee players van position laten ruilen kan ook, zonder
				dat er iemand van de bench hoeft te komen.
			</p>
		</div>
		<div>
			<h2>Speeltijd zonder invoeren</h2>
			<p>
				De minuten volgen uit je wissels, dus je hoeft niets bij te houden. Onder elke name op het veld staat de
				playingTime tot nu toe. Minuten in het doel tellen apart, want een helft keepen is geen halve match voetballen.
			</p>
		</div>
		<div>
			<h2>Helften of kwarten</h2>
			<p>
				Van 11 tegen 11 tot 4 tegen 4, in twee helften of in vier kwarten. Het aantal players ligt nergens vast, dus bij
				de kleinsten werkt het net zo goed als bij de grote elftallen.
			</p>
		</div>
		<div>
			<h2>Presentie op de training</h2>
			<p>
				Aanwezig, afgemeld of niet gekomen: één tik per player. Wie de laatste keren weinig kwam, zie je terug op het
				moment dat je je lineup maakt. De app zet het er alleen bij; what je ermee doet is aan jou.
			</p>
		</div>
		<div>
			<h2>Een verslagje voor de groepsapp</h2>
			<p>
				Na afloop ligt er een kant-en-klaar bericht: de uitslag, wie er scoorden, en de paar regels die je er zelf bij
				schrijft. De wissels blijven off, want daar hoeven de ouders niets van te vinden.
			</p>
		</div>
		<div>
			<h2>Langs de lijn, niet achter een bureau</h2>
			<p>
				Het scherm blijft aan zolang de klok running, je hoeft nergens te scrollen, en zonder bereik gaat alles gewoon
				door. Wat je invult blijft op je eigen telefoon staan.
			</p>
		</div>
	</section>

	<section class="plaat smal">
		<img
			src="/scherm-spelers.png"
			width="390"
			height="700"
			loading="lazy"
			alt="Het spelersoverzicht met speeltijd en presentie per speler"
		/>
		<p class="onderschrift">
			Na een paar weken staat het allemaal in één lijst: gespeelde minuten per player, en hoe vaak ze op de training
			waren.
		</p>
	</section>

	<section class="rustig">
		<OpBeginscherm />
	</section>

	<section class="rustig">
		<h2>Waar je gegevens blijven</h2>
		<p>
			Alles staat op je eigen toestel. Inloggen hoeft niet, en zolang jij dat niet wilt gaat er niets naar een server.
			Neem je wel een account, dan gaan je gegevens over een beveiligde verbinding en ben jij de enige die bij je eigen
			team kan.
		</p>
		<p>
			Namen van kinderen zijn geen bijzaak. Daarom bewaart Blaadje alleen what het echt nodig heeft: een voornaam, een
			line, en de minuten die uit je wissels volgen. Geen beoordelingen, geen dossier.
		</p>
		<p>
			<b>Daar zit ook een keerzijde aan.</b> Staat je seizoen alleen op je telefoon, dan is het weg zodra die telefoon weg
			is: gestolen, in het water, of een browser die opruimt omdat je een tijd niet hebt gekeken. Maak dus af en toe een back-up
			— dat is één knop en één bestand — of neem een account, dan gebeurt het vanzelf.
		</p>
	</section>

	<section class="rustig">
		<h2>Wat het kost</h2>
		<p>
			Zonder account is Blaadje gratis, en dat blijft zo. Alles werkt: opstellen, wisselen, playingTime, presentie, het
			archive. Het enige what je mist is een vangnet, want alles staat alleen op dat ene toestel. Zo kun je een paar
			wedstrijden uitproberen zonder ergens aan vast te zitten.
		</p>
		<p>
			Wordt het je vaste gereedschap, dan wil je een account. Je seizoen staat dan veilig als je telefoon kwijtraakt, en
			je werkt op meer dan één toestel: home de lineup maken, langs de lijn wisselen. Dat kost € 30 per seizoen, zo'n
			zeventig cent per speelweek.
		</p>
		<p>
			Zolang Blaadje in ontwikkeling is hoeft dat nog helemaal niet. Wie er nu bij komt, gebruikt dit seizoen alles
			gratis.
		</p>
		<p>
			Clubs kunnen het in één keer voor al hun jeugdtrainers regelen. Eén factuur, en de trainers hoeven zelf niets te
			doen. Neem contact op via <a href="mailto:tjaco@blaadje.app">tjaco@blaadje.app</a>.
		</p>
	</section>

	<section class="rustig">
		<h2>Waar het vandaan komt</h2>
		<p>
			Blaadje is gemaakt door een ouder-trainer voor zijn eigen O14. Alles wat er al was bleek een tactiekbord, terwijl
			je langs de lijn juist een wisselschriftje nodig hebt. Het wordt elke week bij een echte wedstrijd gebruikt, en
			dat verklaart waarom het doet wat het doet en niet meer dan dat.
		</p>
		<p>
			Het is nog volop in ontwikkeling en op dit moment gratis te gebruiken. Loop je ergens tegenaan of mis je iets,
			mail dan naar
			<a href="mailto:tjaco@blaadje.app">tjaco@blaadje.app</a>. Ik lees alles.
		</p>
		<div class="knoprij">
			<a class="knop prim groot" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}>Aan de slag</a>
		</div>
	</section>

	<footer>
		<p>
			Blaadje · gemaakt in Nederland · <a href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}
				>naar de app</a
			>
			·
			<a href="mailto:tjaco@blaadje.app">tjaco@blaadje.app</a>
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
