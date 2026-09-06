import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** Geen server: een map met bestanden, net als de oude app. Zo blijft Blaadje
    offline werken en staat hij op een koud veld meteen op het scherm. */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		/* De schil waarmee de app zichzelf uittekent heet 200.html en niet
		   index.html, want index.html is nu de echte landingspagina: die wordt
		   vooraf gerenderd zodat een zoekmachine er iets ziet staan. */
		adapter: adapter({ fallback: '200.html' }),
		/* Alleen de landingspagina wordt uitgetekend. Niet verder kruipen: de
		   app-routes moeten juist leeg blijven, die tekent de browser zelf. */
		prerender: { entries: ['/'], crawl: false, handleUnseenRoutes: 'ignore' }
	}
};
