import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/* De rekenkern en de winkel draaien hier zonder browser eromheen. jsdom levert
   een document; localStorage komt uit src/test/opzet.ts. */
export default defineConfig({
	plugins: [svelte({ compilerOptions: { runes: true } })],
	resolve: {
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['src/test/opzet.ts'],
		include: ['src/**/*.test.ts']
	}
});
