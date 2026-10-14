/**
 * Meldingen naar wie een wedstrijd volgt.
 *
 * Twee manieren van aanroepen:
 *
 * - door de database bij elke nieuwe rij in `gebeurtenissen` (een Database
 *   Webhook): de aftrap, een doelpunt, de rust, het einde;
 * - elke minuut door een klok in de database (pg_cron), met `{ "type": "KLOK" }`:
 *   de herinneringen voor taken (`herinneringen` in supabase/taken.sql).
 *
 * Welke melding erbij hoort, naar wie, en of hij al verstuurd is, beslist de
 * database; hier wordt hij alleen bij Apple afgeleverd.
 *
 * Geheimen (Edge Functions → Secrets): APNS_P8, APNS_SLEUTEL_ID, APNS_TEAM_ID, MELD_GEHEIM.
 */
import { type Ontvanger, verstuur } from "./apns.ts";

const basis = Deno.env.get("SUPABASE_URL")!;
const dienst = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function rpc(naam: string, inhoud: unknown) {
  const r = await fetch(`${basis}/rest/v1/rpc/${naam}`, {
    method: "POST",
    headers: { apikey: dienst, authorization: `Bearer ${dienst}`, "content-type": "application/json" },
    body: JSON.stringify(inhoud),
  });
  if (!r.ok) throw new Error(`${naam}: ${r.status} ${await r.text()}`);
  const tekst = await r.text();
  return tekst ? JSON.parse(tekst) : null;
}

Deno.serve(async (verzoek) => {
  try {
    // Alleen de database zelf mag dit aanroepen. Die stuurt een geheim mee dat
    // alleen hier en in de webhook staat (MELD_GEHEIM), of de sleutel van de server.
    const geheim = Deno.env.get("MELD_GEHEIM");
    const magErin = (geheim && verzoek.headers.get("x-meld-geheim") === geheim) ||
      verzoek.headers.get("authorization") === `Bearer ${dienst}`;
    if (!magErin) return new Response("nee", { status: 401 });
    const sleutels = {
      p8: Deno.env.get("APNS_P8")!,
      sleutelId: Deno.env.get("APNS_SLEUTEL_ID")!,
      teamId: Deno.env.get("APNS_TEAM_ID")!,
      bundel: Deno.env.get("APNS_BUNDEL") ?? "app.blaadje.ios",
    };
    const { type, table, record } = await verzoek.json();

    if (type === "KLOK") {
      const lijst = ((await rpc("herinneringen", {})) ?? []) as { titel: string; tekst: string; tokens: Ontvanger[] }[];
      let afgeleverd = 0;
      for (const melding of lijst) {
        const uitkomst = await verstuur(melding, melding.tokens, sleutels, fetch);
        afgeleverd += uitkomst.afgeleverd;
        for (const token of uitkomst.vergeten) await rpc("vergeet_token", { p_token: token });
        if (uitkomst.mislukt.length) console.error("niet afgeleverd:", uitkomst.mislukt);
      }
      return Response.json({ herinneringen: lijst.length, afgeleverd });
    }

    if (type !== "INSERT" || table !== "gebeurtenissen" || !record?.id) return Response.json({ gemeld: false });

    let melding = await rpc("melding_voor", { p_gebeurtenis: record.id });
    if (melding?.inhalen) {
      // Dit gebeurde al even geleden: de trainer had geen bereik en nu komt alles
      // tegelijk binnen. Even wachten tot de stapel er is, en dan één samenvatting.
      await new Promise((klaar) => setTimeout(klaar, 8000));
      melding = await rpc("inhaalmelding", { p_wedstrijd: melding.wedstrijd });
    }
    if (!melding) return Response.json({ gemeld: false });

    const uitkomst = await verstuur(melding, melding.tokens, sleutels, fetch);
    for (const token of uitkomst.vergeten) await rpc("vergeet_token", { p_token: token });
    if (uitkomst.mislukt.length) console.error("niet afgeleverd:", uitkomst.mislukt);
    return Response.json({ gemeld: true, afgeleverd: uitkomst.afgeleverd, vergeten: uitkomst.vergeten.length, mislukt: uitkomst.mislukt.length });
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
