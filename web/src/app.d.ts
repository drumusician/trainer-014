// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/** Door Vite ingevuld bij het bouwen; zie vite.config.ts. */
	const __VERSIE__: string;

	interface Window {
		/** Plausible, alleen geladen op de landingspagina. Zie src/lib/meten.ts. */
		plausible?: ((name: string) => void) & {
			q?: unknown[];
			init?: (opties?: unknown) => void;
			o?: unknown;
		};
	}
}

export {};
