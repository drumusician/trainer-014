/* Stand-in voor $app/state. Zet `page.url` in een test als een scherm daarop
   afgaat. */
export const page = $state({
	/* eslint-disable-next-line svelte/prefer-svelte-reactivity -- een test zet de
	   hele url in één keer opnieuw; er wordt nooit een veld van gemuteerd */
	url: new URL('http://localhost/app'),
	params: {} as Record<string, string>,
	route: { id: null as string | null },
	status: 200,
	error: null,
	data: {},
	form: null
});

export const navigating = $state({ from: null, to: null });
export const updated = { current: false, check: () => Promise.resolve(false) };
