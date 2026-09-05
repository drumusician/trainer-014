import { redirect } from '@sveltejs/kit';

/* De gespeelde wedstrijden staan nu bij Wedstrijden zelf. */
export const load = () => redirect(307, '/app');
