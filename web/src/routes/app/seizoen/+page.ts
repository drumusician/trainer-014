import { redirect } from '@sveltejs/kit';

/* Oud adres: het seizoen hangt nu onder Archief. */
export const load = () => redirect(307, '/app/archief/seizoen');
