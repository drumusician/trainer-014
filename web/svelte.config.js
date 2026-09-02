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
		adapter: adapter({ fallback: 'index.html' }),
		prerender: { entries: [] }
	}
};
