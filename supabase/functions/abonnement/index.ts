/**
 * Het teamseizoen vastleggen. Twee afzenders:
 *
 * - de app, vlak na een aankoop en bij elk openen: `{ "transactie": "<JWS>" }`;
 * - Apple zelf (App Store Server Notifications V2): `{ "signedPayload": "<JWS>" }`,
 *   bij een terugbetaling.
 *
 * Geen geheim nodig: wat erin komt is door Apple getekend, en dat kijken we na
 * tegen het rootcertificaat van Apple. Verify JWT staat uit.
 *
 * Secret (Edge Functions → Secrets): APP_APPLE_ID, het nummer van de app in App
 * Store Connect (App Information → Apple ID). Zonder dat nummer worden alleen
 * proefaankopen (TestFlight) aangenomen.
 */
import { Environment, SignedDataVerifier } from "npm:@apple/app-store-server-library@1.6.0";
import { Buffer } from "node:buffer";
import { APPLE_ROOT_G3 } from "./apple-root.ts";
import { type Nakijker, omgevingVan, verwerk } from "./verwerk.ts";

const basis = Deno.env.get("SUPABASE_URL")!;
const dienst = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const bundel = Deno.env.get("APNS_BUNDEL") ?? "app.blaadje.ios";
const appAppleId = Number(Deno.env.get("APP_APPLE_ID") ?? "") || undefined;
const wortels = [Buffer.from(APPLE_ROOT_G3, "base64")];

/* Alleen Production en Sandbox: bij Xcode en LocalTesting kijkt de bibliotheek niets na. */
const nakijkers: Record<string, SignedDataVerifier> = {
  Sandbox: new SignedDataVerifier(wortels, true, Environment.SANDBOX, bundel),
};
if (appAppleId) nakijkers.Production = new SignedDataVerifier(wortels, true, Environment.PRODUCTION, bundel, appAppleId);

function kies(jws: string): SignedDataVerifier {
  const n = nakijkers[omgevingVan(jws) ?? ""];
  if (!n) throw new Error("onbekende omgeving");
  return n;
}

const nakijker: Nakijker = {
  aankoop: (jws) => kies(jws).verifyAndDecodeTransaction(jws),
  bericht: (jws) => kies(jws).verifyAndDecodeNotification(jws),
};

Deno.serve(async (verzoek) => {
  let lichaam: unknown;
  try {
    lichaam = await verzoek.json();
  } catch {
    return new Response("geen json", { status: 400 });
  }
  let regel;
  try {
    regel = await verwerk(lichaam, nakijker);
  } catch (e) {
    console.error("niet van Apple:", e);
    return new Response("niet nagekeken", { status: 400 });
  }
  // Niets over een team (een ander product, of een bericht zonder aankoop): klaar.
  if (!regel) return Response.json({ vastgelegd: false });

  const r = await fetch(`${basis}/rest/v1/rpc/abonnement_bij`, {
    method: "POST",
    headers: { apikey: dienst, authorization: `Bearer ${dienst}`, "content-type": "application/json" },
    body: JSON.stringify({
      p_id: regel.id, p_team: regel.team, p_product: regel.product,
      p_verloopt: regel.verloopt, p_omgeving: regel.omgeving, p_ingetrokken: regel.ingetrokken,
    }),
  });
  if (!r.ok) {
    console.error("vastleggen lukte niet:", r.status, await r.text());
    // Apple probeert het dan later opnieuw.
    return new Response("vastleggen lukte niet", { status: 500 });
  }
  return Response.json({ vastgelegd: true, verloopt: regel.verloopt });
});
