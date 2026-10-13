/**
 * Een melding bij Apple afleveren.
 *
 * Los van de rest, zodat het zonder Apple en zonder database te testen is: wie
 * dit aanroept geeft mee hoe er een verzoek de deur uit gaat.
 */

export type Sleutel = { p8: string; sleutelId: string; teamId: string; bundel: string };
export type Ontvanger = { token: string; omgeving: string };
export type Melding = { titel: string; tekst: string; wedstrijd?: string };
export type Haal = (url: string, init: RequestInit) => Promise<Response>;

const b64url = (bytes: Uint8Array | string) => {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

/** De sleutel uit het .p8-bestand van Apple, met of zonder de regels eromheen. */
export async function leesSleutel(p8: string): Promise<CryptoKey> {
  const kaal = p8.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(kaal), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** Het bewijs waarmee Apple weet dat wij het zijn. Een uur geldig; wij maken per ronde een nieuw. */
export async function bewijs(s: Sleutel, nu: number): Promise<string> {
  const kop = b64url(JSON.stringify({ alg: "ES256", kid: s.sleutelId }));
  const inhoud = b64url(JSON.stringify({ iss: s.teamId, iat: Math.floor(nu / 1000) }));
  const handtekening = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await leesSleutel(s.p8),
    new TextEncoder().encode(`${kop}.${inhoud}`),
  );
  return `${kop}.${inhoud}.${b64url(new Uint8Array(handtekening))}`;
}

export type Uitkomst = { afgeleverd: number; vergeten: string[]; mislukt: string[] };

/**
 * Stuurt de melding naar elke telefoon. `vergeten` zijn adressen die Apple niet
 * meer kent (de app is eraf): die mogen uit de lijst. `mislukt` is al het andere,
 * en daar doen we niets mee: een gemiste melding sturen we niet later alsnog.
 */
export async function verstuur(m: Melding, aan: Ontvanger[], s: Sleutel, haal: Haal, nu = Date.now()): Promise<Uitkomst> {
  const uit: Uitkomst = { afgeleverd: 0, vergeten: [], mislukt: [] };
  if (!aan.length) return uit;
  const token = await bewijs(s, nu);
  const body = JSON.stringify({
    aps: { alert: { title: m.titel, body: m.tekst }, sound: "default", "thread-id": m.wedstrijd ?? "blaadje" },
    wedstrijd: m.wedstrijd,
  });
  await Promise.all(aan.map(async (o) => {
    const host = o.omgeving === "proef" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    try {
      const r = await haal(`https://${host}/3/device/${o.token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${token}`,
          "apns-topic": s.bundel,
          "apns-push-type": "alert",
          "apns-priority": "10",
          // Na een kwartier is een doelpunt geen nieuws meer.
          "apns-expiration": String(Math.floor(nu / 1000) + 900),
        },
        body,
      });
      if (r.status === 200) uit.afgeleverd++;
      else {
        const reden = ((await r.json().catch(() => ({}))) as { reason?: string }).reason ?? "";
        if (r.status === 410 || reden === "BadDeviceToken" || reden === "Unregistered") uit.vergeten.push(o.token);
        else uit.mislukt.push(`${r.status} ${reden}`);
      }
    } catch (e) {
      uit.mislukt.push(String(e));
    }
  }));
  return uit;
}
