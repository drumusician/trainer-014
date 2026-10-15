/**
 * Nakijken of iets echt van Apple komt: dezelfde controles als de bibliotheek
 * van Apple (app-store-server-library), maar alleen met WebCrypto en een
 * x509-lezer in gewoon TypeScript. De bibliotheek van Apple leunt op
 * `node:crypto`, en daarvan mist de Deno van Supabase stukken
 * (X509Certificate.toString): daar liep elke aankoop op vast.
 *
 * Een JWS van Apple draagt in zijn kop de keten: blad, tussencertificaat, root.
 * Wat we nakijken:
 * 1. het tussencertificaat is getekend door een root die wij vertrouwen (die van Apple);
 * 2. het blad is getekend door het tussencertificaat, dat een CA is;
 * 3. de kenmerken van Apple staan erin (blad 1.2.840.113635.100.6.11.1, tussen 1.2.840.113635.100.6.2.1);
 * 4. alle drie zijn geldig op het moment dat Apple tekende (`signedDate`);
 * 5. de handtekening over kop en inhoud klopt met de sleutel van het blad;
 * 6. de bundel en de omgeving zijn de onze.
 */
import * as x509 from "npm:@peculiar/x509@1.12.3";
import type { Aankoop, Nakijker } from "./verwerk.ts";

const BLAD = "1.2.840.113635.100.6.11.1";
const TUSSEN = "1.2.840.113635.100.6.2.1";

const vanBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const vanBase64Url = (s: string) => vanBase64(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
const json = (deel: string) => JSON.parse(new TextDecoder().decode(vanBase64Url(deel)));

function geldig(c: x509.X509Certificate, op: Date) {
  if (op < c.notBefore || op > c.notAfter) throw new Error(`certificaat niet geldig op ${op.toISOString()}: ${c.subject}`);
}

/**
 * - `wortels`: de roots die we vertrouwen, als base64 DER;
 * - `bundel`: app.blaadje.ios;
 * - `omgeving`: "Sandbox" of "Production";
 * - `appAppleId`: in Production moet een bericht van Apple over onze app gaan.
 */
export function maakNakijker(wortels: string[], bundel: string, omgeving: string, appAppleId?: number) {
  const vertrouwd = wortels.map((w) => new x509.X509Certificate(vanBase64(w)));

  async function kijkNa(jws: string): Promise<Record<string, unknown>> {
    const delen = jws.split(".");
    if (delen.length !== 3) throw new Error("geen JWS");
    const [kopDeel, inhoudDeel, handtekeningDeel] = delen;
    const kop = json(kopDeel) as { alg?: string; x5c?: string[] };
    if (kop.alg !== "ES256" || !Array.isArray(kop.x5c) || kop.x5c.length < 2) throw new Error("geen keten van Apple");
    const inhoud = json(inhoudDeel) as Record<string, unknown>;
    const blad = new x509.X509Certificate(vanBase64(kop.x5c[0]));
    const tussen = new x509.X509Certificate(vanBase64(kop.x5c[1]));

    const getekend = typeof inhoud.signedDate === "number" ? new Date(inhoud.signedDate) : new Date();

    // 1. tussen ← een vertrouwde root
    let root: x509.X509Certificate | undefined;
    for (const w of vertrouwd) {
      if (tussen.issuer === w.subject && (await tussen.verify({ publicKey: w.publicKey, signatureOnly: true }))) root = w;
    }
    if (!root) throw new Error("niet getekend door een root die we vertrouwen");
    // 2. blad ← tussen, en tussen is een CA
    if (blad.issuer !== tussen.subject || !(await blad.verify({ publicKey: tussen.publicKey, signatureOnly: true }))) {
      throw new Error("blad niet getekend door het tussencertificaat");
    }
    const grenzen = tussen.getExtension(x509.BasicConstraintsExtension);
    if (!grenzen?.ca) throw new Error("tussencertificaat is geen CA");
    // 3. de kenmerken van Apple
    if (!blad.getExtension(BLAD) || !tussen.getExtension(TUSSEN)) throw new Error("kenmerken van Apple ontbreken");
    // 4. geldig toen Apple tekende
    for (const c of [blad, tussen, root]) geldig(c, getekend);
    // 5. de handtekening (ES256: r en s achter elkaar, zoals WebCrypto ze wil)
    const sleutel = await blad.publicKey.export({ name: "ECDSA", namedCurve: "P-256" }, ["verify"]);
    const klopt = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      sleutel,
      vanBase64Url(handtekeningDeel),
      new TextEncoder().encode(kopDeel + "." + inhoudDeel),
    );
    if (!klopt) throw new Error("handtekening klopt niet");
    return inhoud;
  }

  const nakijker: Nakijker = {
    async aankoop(jws) {
      const a = await kijkNa(jws);
      if (a.bundleId !== bundel) throw new Error(`andere app: ${a.bundleId}`);
      if (a.environment !== omgeving) throw new Error(`andere omgeving: ${a.environment}`);
      return a as Aankoop;
    },
    async bericht(jws) {
      const b = (await kijkNa(jws)) as { data?: { bundleId?: string; environment?: string; appAppleId?: number; signedTransactionInfo?: string } };
      if (b.data?.bundleId !== bundel) throw new Error(`andere app: ${b.data?.bundleId}`);
      if (b.data?.environment !== omgeving) throw new Error(`andere omgeving: ${b.data?.environment}`);
      if (omgeving === "Production" && appAppleId !== undefined && b.data?.appAppleId !== appAppleId) throw new Error("ander app-nummer");
      return b;
    },
  };
  return nakijker;
}
