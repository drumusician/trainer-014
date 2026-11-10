<script lang="ts">
	/*
	 * De privacyverklaring. Staat op blaadje.app/privacy, want de App Store en
	 * Google Play vragen een openbaar adres, en de app linkt ernaartoe.
	 *
	 * Bewust geen meetscript: dit is geen verkooppagina.
	 *
	 * Wie hier iets verandert, zet de datum onderaan op vandaag.
	 */
	const email = 'tjaco@blaadje.app';
</script>

<svelte:head>
	<title>Privacyverklaring — Blaadje</title>
	<meta name="description" content="Welke gegevens Blaadje bewaart, waar, hoe lang, en hoe je ze weghaalt." />
</svelte:head>

<div class="privacy">
	<header class="kop">
		<a class="merk" href="/">Blaadje</a>
	</header>

	<main>
		<h1>Privacyverklaring</h1>
		<p class="groot">
			Blaadje gaat over kinderen. Daarom bewaren we zo weinig mogelijk, en zit er in de app geen reclame en niets dat je
			volgt.
		</p>

		<h2>Wie we zijn</h2>
		<p>
			Blaadje is een app van SMART Code B.V. in Nederland. Vragen over je gegevens stel je aan
			<a href="mailto:{email}">{email}</a>. Je krijgt antwoord van een mens, binnen een maand en meestal veel sneller.
		</p>

		<h2>Zonder account</h2>
		<p>Alles wat je invult staat op je eigen telefoon. Er gaat niets naar ons. Verwijder je de app, dan is het weg.</p>

		<h2>Met een account</h2>
		<p>Dan bewaren we, zodat je team op meer telefoons staat en andere trainers kunnen meedoen:</p>
		<ul>
			<li><b>Van jou als trainer:</b> je e-mailadres, en bij welke teams je hoort.</li>
			<li>
				<b>Van de spelers:</b> de naam die jij invult (een voornaam is genoeg), de linie, of iemand keept, de opstellingen
				en wissels, de speelminuten die daaruit volgen, doelpunten, en wie er op de training was.
			</li>
			<li>
				<b>Van het team:</b> de teamnaam, het programma met de wedstrijden, en de taken zoals rijden of limonade.
			</li>
			<li>
				<b>Van ouders die het team volgen:</b> welk kind ze kozen, of ze een taak op zich namen of konden niet, en het adres
				dat Apple of Google aan hun telefoon geeft voor meldingen. Geen naam en geen e-mailadres.
			</li>
		</ul>
		<p>Geen geboortedata, geen adressen, geen foto's en geen beoordelingen.</p>

		<h2>Wie waarvoor verantwoordelijk is</h2>
		<p>
			Voor je account zijn wij verantwoordelijk. De gegevens van de spelers vul jij in, als trainer of namens je club;
			die bewaren we voor jou, en doen we niets anders mee. Wil je club daar een verwerkersovereenkomst voor, mail dan.
		</p>
		<p>
			We gebruiken de gegevens alleen om Blaadje te laten werken: je team bewaren, het delen met wie jij toelaat, en
			meldingen sturen aan wie een team volgt. We verkopen niets door, er staan geen advertenties in, en de app meet
			niet wat je doet.
		</p>

		<h2>Waar het staat</h2>
		<ul>
			<li><b>Supabase</b> bewaart de database en regelt het inloggen, op servers in de EU.</li>
			<li><b>PowerSync</b> houdt de telefoons van de trainers van een team gelijk.</li>
			<li><b>Resend</b> verstuurt de inlogcode naar je e-mailadres.</li>
			<li><b>Apple en Google</b> bezorgen de meldingen en regelen betalingen in de app.</li>
			<li><b>Netlify</b> serveert deze website.</li>
		</ul>
		<p>
			Waar een van hen buiten de EU werkt, gebeurt dat onder de afspraken die de AVG daarvoor eist. Alles gaat over een
			versleutelde verbinding, en de database laat alleen de trainers van een team bij de gegevens van dat team.
		</p>

		<h2>Betalen</h2>
		<p>
			Je betaalt via Apple of Google. Wij krijgen alleen een nummer van de aankoop, voor welk team, en tot wanneer het
			loopt. Wie er betaalde en hoe, weten we niet. Een club betaalt op factuur; daarvoor bewaren we de gegevens van de
			club die op de factuur moeten.
		</p>

		<h2>Deze website</h2>
		<p>
			Op de voorpagina tellen we bezoekers met Plausible: zonder cookies en zonder dat we weten wie je bent. In de app
			en op deze pagina tellen we niets.
		</p>

		<h2>Hoe lang, en hoe je het weghaalt</h2>
		<p>
			We bewaren je gegevens zolang je account bestaat. Je verwijdert je account zelf in de app, bij
			<b>Meer → Account → Verwijder je account</b>. Dan gaan je e-mailadres en elk team waar jij de enige trainer bent
			meteen weg, met de spelers en de wedstrijden. Een team met nog een andere trainer blijft voor hen staan. Wat op je
			telefoon staat, blijft daar.
		</p>
		<p>
			Wil je dat één kind helemaal uit Blaadje verdwijnt, ook uit de wedstrijden die al gespeeld zijn, mail dan; dan
			halen we het weg. Een ouder die niet meer wil volgen, zet dat uit in de app.
		</p>

		<h2>Je rechten</h2>
		<p>
			Je mag zien wat we van je hebben, het laten verbeteren of verwijderen, je gegevens meenemen, en bezwaar maken. In
			de app download je alles in één bestand, bij <b>Meer → Je gegevens downloaden</b>. Voor de rest: mail naar
			<a href="mailto:{email}">{email}</a>. Ben je ontevreden over hoe we ermee omgaan, dan kun je een klacht indienen
			bij de
			<a href="https://autoriteitpersoonsgegevens.nl">Autoriteit Persoonsgegevens</a>.
		</p>

		<p class="klein">Bijgewerkt op 10 november 2026.</p>
	</main>

	<footer>
		<p><a href="/">Blaadje</a> · <a href="mailto:{email}">{email}</a></p>
	</footer>
</div>

<style>
	.privacy {
		width: 100%;
		line-height: 1.6;
		flex: 0 0 auto;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.privacy > header,
	.privacy > main,
	.privacy > footer {
		max-width: 680px;
		margin: 0 auto;
		padding: 0 20px;
	}
	.kop {
		padding-top: 18px;
		padding-bottom: 18px;
	}
	.merk {
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--groen);
		text-decoration: none;
	}
	h1 {
		font-size: clamp(28px, 6vw, 38px);
		line-height: 1.15;
		letter-spacing: -0.02em;
		margin: 24px 0 12px;
		color: var(--inkt);
	}
	h2 {
		font-size: 19px;
		text-transform: none;
		letter-spacing: -0.01em;
		color: var(--groen);
		margin: 32px 0 8px;
	}
	p,
	li {
		color: var(--grijs);
		max-width: 36em;
	}
	p {
		margin: 0 0 12px;
	}
	ul {
		margin: 0 0 12px;
		padding-left: 20px;
	}
	li {
		margin-bottom: 6px;
	}
	b {
		color: var(--inkt);
	}
	.groot {
		font-size: clamp(17px, 2.4vw, 19px);
	}
	.klein {
		font-size: 14px;
		margin-top: 32px;
	}
	main a,
	footer a {
		color: var(--groen);
	}
	footer {
		margin-top: 40px;
		padding-top: 20px;
		padding-bottom: 40px;
		border-top: 1px solid var(--lijn);
	}
	footer p {
		font-size: 14px;
		margin: 0;
	}
</style>
