import { redirect } from '@sveltejs/kit';

/* Oud adres uit de tijd dat alles onder Instellen hing. */
export const load = () => redirect(307, '/');
