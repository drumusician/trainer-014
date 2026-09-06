import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/*
 * Welke bouw draait er?
 *
 * Zonder dit is een probleemmelding van een andere trainer niet te plaatsen: je
 * weet wat er misging, maar niet in welke versie. Netlify zet COMMIT_REF; lokaal
 * staat er gewoon 'dev'.
 */
/* process.env zonder @types/node erbij te slepen: dit bestand draait in Node,
   maar de rest van het project heeft die typen nergens nodig. */
declare const process: { env: Record<string, string | undefined> };
const versie = (process.env.COMMIT_REF ?? '').slice(0, 7) || 'dev';

export default defineConfig({
	plugins: [sveltekit()],
	define: { __VERSIE__: JSON.stringify(versie) }
});
