<script lang="ts">
	import { onMount } from 'svelte';
	import OpBeginscherm from '$lib/componenten/OpBeginscherm.svelte';
	import { meld, startMeten } from '$lib/meten';

	onMount(startMeten);
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
			Blaadje houdt je opstelling, je wissels en de speeltijd bij terwijl jij coacht. Een wissel kost twee tikken, en
			na afloop weet je precies wie hoe lang heeft gespeeld.
		</p>
		<div class="knoprij">
			<a class="knop prim groot" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}>Blaadje openen</a>
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
				Tik wie eruit gaat, tik wie erin komt. De bank staat naast het veld, in dezelfde volgorde als de linies, en
				bovenaan staat wie tot nu toe het minst heeft gespeeld. Twee spelers van plek laten ruilen kan ook, zonder dat
				er iemand van de bank hoeft te komen.
			</p>
		</div>
		<div>
			<h2>Speeltijd zonder invoeren</h2>
			<p>
				De minuten volgen uit je wissels, dus je hoeft niets bij te houden. Onder elke naam op het veld staat de
				speeltijd tot nu toe. Minuten in het doel tellen apart, want een helft keepen is geen halve wedstrijd
				voetballen.
			</p>
		</div>
		<div>
			<h2>Helften of kwarten</h2>
			<p>
				Van 11 tegen 11 tot 4 tegen 4, in twee helften of in vier kwarten. Het aantal spelers ligt nergens vast, dus
				bij de kleinsten werkt het net zo goed als bij de grote elftallen.
			</p>
		</div>
		<div>
			<h2>Presentie op de training</h2>
			<p>
				Aanwezig, afgemeld of niet gekomen: één tik per speler. Wie de laatste keren weinig kwam, zie je terug op het
				moment dat je je opstelling maakt. De app zet het er alleen bij; wat je ermee doet is aan jou.
			</p>
		</div>
		<div>
			<h2>Een verslagje voor de groepsapp</h2>
			<p>
				Na afloop ligt er een kant-en-klaar bericht: de uitslag, wie er scoorden, en de paar regels die je er zelf bij
				schrijft. De wissels blijven eruit, want daar hoeven de ouders niets van te vinden.
			</p>
		</div>
		<div>
			<h2>Langs de lijn, niet achter een bureau</h2>
			<p>
				Het scherm blijft aan zolang de klok loopt, je hoeft nergens te scrollen, en zonder bereik gaat alles gewoon
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
			Na een paar weken staat het allemaal in één lijst: gespeelde minuten per speler, en hoe vaak ze op de training
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
			Namen van kinderen zijn geen bijzaak. Daarom bewaart Blaadje alleen wat het echt nodig heeft: een voornaam, een
			linie, en de minuten die uit je wissels volgen. Geen beoordelingen, geen dossier.
		</p>
		<p>
			<b>Daar zit ook een keerzijde aan.</b> Staat je seizoen alleen op je telefoon, dan is het weg zodra die telefoon
			weg is: gestolen, in het water, of een browser die opruimt omdat je een tijd niet hebt gekeken. Maak dus af en
			toe een back-up — dat is één knop en één bestand — of neem een account, dan gebeurt het vanzelf.
		</p>
	</section>

	<section class="rustig">
		<h2>Wat het kost</h2>
		<p>
			Zonder account is Blaadje gratis, en dat blijft zo. Alles werkt: opstellen, wisselen, speeltijd, presentie, het
			archief. Het enige wat je mist is een vangnet, want alles staat alleen op dat ene toestel. Zo kun je een paar
			wedstrijden uitproberen zonder ergens aan vast te zitten.
		</p>
		<p>
			Wordt het je vaste gereedschap, dan wil je een account. Je seizoen staat dan veilig als je telefoon kwijtraakt,
			en je werkt op meer dan één toestel: thuis de opstelling maken, langs de lijn wisselen. Dat kost € 30 per
			seizoen, zo'n zeventig cent per speelweek.
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
			Het is nog volop in ontwikkeling en op dit moment gratis te gebruiken. Loop je ergens tegenaan of mis je iets, mail dan naar
			<a href="mailto:tjaco@blaadje.app">tjaco@blaadje.app</a>. Ik lees alles.
		</p>
		<div class="knoprij">
			<a class="knop prim groot" href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}>Aan de slag</a>
		</div>
	</section>

	<footer>
		<p>
			Blaadje · gemaakt in Nederland · <a href="/app" data-sveltekit-reload onclick={() => meld('App geopend')}>naar de app</a> ·
			<a href="mailto:tjaco@blaadje.app">tjaco@blaadje.app</a>
		</p>
	</footer>
</div>
