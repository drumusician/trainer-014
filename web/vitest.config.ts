import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/* De rekenkern en de winkel draaien hier zonder browser eromheen. jsdom levert
   een document; localStorage komt uit src/test/setup.ts. */
export default defineConfig({
	plugins: [svelte({ compilerOptions: { runes: true } })],
	resolve: {
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['src/test/setup.ts'],
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			/* Alleen de logica meten. De componenten worden niet getest, dus die
			   zouden het beeld vertroebelen met een grote rode nul in plaats van
			   te laten zien hoe goed de rekenkern is afgedekt. */
			include: ['src/lib/**/*.ts'],
			exclude: ['src/lib/**/*.test.ts', 'src/lib/supabase/config.ts']
		}
	}
});
