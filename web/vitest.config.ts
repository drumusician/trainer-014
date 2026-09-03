import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

/* De rekenkern en de winkel draaien hier zonder browser eromheen. jsdom levert
   localStorage, meer is er niet nodig: er komt geen component aan te pas. */
export default defineConfig({
	plugins: [svelte({ compilerOptions: { runes: true } })],
	test: {
		environment: 'jsdom',
		setupFiles: ['src/test/opzet.ts'],
		include: ['src/**/*.test.ts']
	}
});
