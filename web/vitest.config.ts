import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/* De rekenkern en de winkel draaien hier zonder browser eromheen. jsdom levert
   een document; localStorage komt uit src/test/setup.ts. */
export default defineConfig({
	plugins: [svelte({ compilerOptions: { runes: true } })],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			/* SvelteKit levert deze modules pas als hij zelf draait. Voor tests staan
			   er stand-ins tegenover, zodat een scherm gerenderd kan worden zonder de
			   halve router erbij te halen. */
			'$app/navigation': fileURLToPath(new URL('./src/test/sveltekit/navigation.ts', import.meta.url)),
			'$app/state': fileURLToPath(new URL('./src/test/sveltekit/state.svelte.ts', import.meta.url)),
			'$app/environment': fileURLToPath(new URL('./src/test/sveltekit/environment.ts', import.meta.url))
		},
		/* Zonder dit pakt Svelte zijn serverbouw en gaan componenten stuk op
		   lifecycle_function_unavailable. Componenttests draaien in jsdom, dus die
		   willen de browserbouw. */
		conditions: ['browser']
	},
	/* Dezelfde vervanging als in de echte bouw; anders is __VERSIE__ in een test
	   een onbekende naam. */
	define: { __VERSIE__: JSON.stringify('test') },
	test: {
		environment: 'jsdom',
		setupFiles: ['src/test/setup.ts'],
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			/* Sinds er componenttests zijn, tellen de schermen mee. Wat je op het veld
			   in handen hebt is net zo goed code die stuk kan. */
			include: ['src/lib/**/*.ts', 'src/lib/**/*.svelte', 'src/routes/**/*.svelte'],
			exclude: ['src/lib/**/*.test.ts', 'src/lib/supabase/config.ts', 'src/test/**'],
			/*
			 * Een ondergrens, geen doel. Hij staat net onder waar we nu staan, zodat
			 * een enkele nieuwe regel zonder test niets afkeurt, maar een scherm dat
			 * er ongetest bij komt wél. Zakt dit getal, dan is dat een besluit dat
			 * iemand met de hand maakt.
			 */
			thresholds: { statements: 90, lines: 92, functions: 90, branches: 73 }
		}
	}
});
