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

	interface Window {
		/** Plausible, alleen geladen op de landingspagina. Zie src/lib/meten.ts. */
		plausible?: ((naam: string) => void) & {
			q?: unknown[];
			init?: (opties?: unknown) => void;
			o?: unknown;
		};
	}
}

export {};
