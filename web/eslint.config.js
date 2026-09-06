import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

/* Het hek: wat hier rood wordt, komt niet live. Zie ook .github/workflows/ci.yml
   en het build-commando in netlify.toml. */
export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			/* Een naam die met _ begint is een bewuste weglating, meestal bij het
			   destructureren van een veld dat juist níet mee mag. */
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			/* Vraagt om resolve() rond elke route. Verstandig, maar het raakt 48
			   plekken en dat is een verbouwing, geen hek. Kandidaat voor later. */
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: { projectService: true, extraFileExtensions: ['.svelte'], parser: ts.parser, svelteConfig }
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'node_modules/', 'static/', 'coverage/']
	}
);
