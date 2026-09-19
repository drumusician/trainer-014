/**
 * De assistent: een voorstel voor de opstelling, met uitleg.
 *
 * Draait als Supabase Edge Function, zodat de sleutel voor het taalmodel nooit in
 * de app staat. Volgorde, en die is met opzet:
 *
 * 1. Nalopen wat er binnenkomt.
 * 2. Een beurt aftellen via coach_beurt(), met het token van de trainer zelf.
 *    Daarmee bewijst de database dat hij is wie hij zegt, dat hij lid is van dit
 *    team en dat hij vandaag nog mag. Pas daarna kost het geld.
 * 3. Het taalmodel vragen, en alleen een antwoord in de afgesproken vorm
 *    teruggeven.
 *
 * Uitrollen staat in supabase/LEESMIJ.md.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { bericht, CoachVraagSchema, kanOpstellen, SYSTEEM, voorstelSchema } from './vraag.ts';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MAX_BYTES = 400_000;

function antwoord(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS, 'Content-Type': 'application/json' }
	});
}

const fout = (status: number, tekst: string) => antwoord(status, { fout: tekst });

/** Een beurt aftellen. Geeft terug hoeveel er vandaag over zijn, of een Response als het niet mag. */
async function beurt(req: Request, teamId: string): Promise<number | Response> {
	const token = req.headers.get('authorization');
	const apikey = req.headers.get('apikey');
	if (!token || !apikey) return fout(401, 'Log eerst in bij Synchroniseren.');

	const r = await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/rpc/coach_beurt', {
		method: 'POST',
		headers: { Authorization: token, apikey, 'Content-Type': 'application/json' },
		body: JSON.stringify({ p_team: teamId })
	});
	if (r.ok) return Number(await r.json());
	if (r.status === 429) return fout(429, 'Je hebt de assistent vandaag al vaak genoeg gevraagd. Morgen weer.');
	if (r.status === 401) return fout(401, 'Je inlog is verlopen. Log opnieuw in bij Synchroniseren.');
	if (r.status === 403) return fout(403, 'Je bent geen trainer van dit team.');
	console.error('coach_beurt', r.status, await r.text());
	return fout(502, 'De server kon niet nagaan of je de assistent mag vragen.');
}

const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
	if (req.method !== 'POST') return fout(405, 'Alleen POST.');

	const ruw = await req.text();
	if (ruw.length > MAX_BYTES) return fout(413, 'Dat is te veel om mee te sturen.');
	let json: unknown;
	try {
		json = JSON.parse(ruw);
	} catch {
		return fout(400, 'Geen geldige vraag.');
	}
	const gelezen = CoachVraagSchema.safeParse(json);
	if (!gelezen.success) return fout(400, 'Geen geldige vraag.');
	const vraag = gelezen.data;
	const kan = kanOpstellen(vraag);
	if (kan) return fout(400, kan);

	const over = await beurt(req, vraag.teamId);
	if (over instanceof Response) return over;

	try {
		const r = await client.beta.messages.parse({
			model: 'claude-opus-5',
			max_tokens: 16000,
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: 'default',
			thinking: { type: 'adaptive' },
			/* medium: een opstelling is geen wiskunde, en de trainer staat te wachten */
			output_config: { effort: 'medium', format: betaZodOutputFormat(voorstelSchema(vraag)) },
			system: SYSTEEM,
			messages: [{ role: 'user', content: bericht(vraag) }]
		});
		if (r.stop_reason === 'refusal') return fout(502, 'De assistent wilde hier geen antwoord op geven.');
		if (r.stop_reason === 'max_tokens' || !r.parsed_output) {
			console.error('coach: geen bruikbaar antwoord', r.stop_reason);
			return fout(502, 'De assistent kwam niet tot een bruikbaar antwoord. Probeer het nog eens.');
		}
		return antwoord(200, { voorstel: r.parsed_output, over });
	} catch (e) {
		if (e instanceof Anthropic.RateLimitError)
			return fout(503, 'De assistent heeft het even te druk. Probeer het zo nog eens.');
		if (e instanceof Anthropic.AuthenticationError) {
			console.error('coach: sleutel voor het taalmodel klopt niet');
			return fout(503, 'De assistent is niet goed ingesteld.');
		}
		if (e instanceof Anthropic.APIError) {
			console.error('coach: taalmodel', e.status, e.message);
			return fout(502, 'De assistent is nu niet bereikbaar. Probeer het zo nog eens.');
		}
		console.error('coach', e);
		return fout(502, 'De assistent is nu niet bereikbaar. Probeer het zo nog eens.');
	}
});
