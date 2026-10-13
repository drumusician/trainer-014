import { assertEquals } from "jsr:@std/assert@1";
import { bewijs, verstuur } from "./apns.ts";

/** Een sleutel zoals Apple hem uitgeeft, voor de test ter plekke gemaakt. */
async function proefsleutel() {
  const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", paar.privateKey));
  const p8 = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
  return { sleutel: { p8, sleutelId: "ABC123", teamId: "TEAM456", bundel: "app.blaadje.ios" }, openbaar: paar.publicKey };
}

const vanB64url = (s: string) => Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

Deno.test("het bewijs voor Apple is echt getekend met onze sleutel", async () => {
  const { sleutel, openbaar } = await proefsleutel();
  const [kop, inhoud, handtekening] = (await bewijs(sleutel, 1_760_000_000_000)).split(".");
  assertEquals(JSON.parse(new TextDecoder().decode(vanB64url(kop))), { alg: "ES256", kid: "ABC123" });
  assertEquals(JSON.parse(new TextDecoder().decode(vanB64url(inhoud))), { iss: "TEAM456", iat: 1_760_000_000 });
  const klopt = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" }, openbaar, vanB64url(handtekening), new TextEncoder().encode(`${kop}.${inhoud}`));
  assertEquals(klopt, true);
});

Deno.test("elke telefoon krijgt de melding, via de deur van zijn omgeving", async () => {
  const { sleutel } = await proefsleutel();
  const gevraagd: { url: string; kop: Record<string, string>; body: unknown }[] = [];
  const uit = await verstuur(
    { titel: "Sparta – JO14-1  0–1", tekst: "Doelpunt van Sem!", wedstrijd: "w1" },
    [{ token: "aaa", omgeving: "echt" }, { token: "bbb", omgeving: "proef" }],
    sleutel,
    (url, init) => {
      gevraagd.push({ url, kop: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
      return Promise.resolve(new Response(null, { status: 200 }));
    },
    1_760_000_000_000,
  );
  assertEquals(uit, { afgeleverd: 2, vergeten: [], mislukt: [] });
  assertEquals(gevraagd.map((g) => g.url).sort(), [
    "https://api.push.apple.com/3/device/aaa",
    "https://api.sandbox.push.apple.com/3/device/bbb",
  ]);
  assertEquals(gevraagd[0].kop["apns-topic"], "app.blaadje.ios");
  assertEquals(gevraagd[0].kop["apns-push-type"], "alert");
  assertEquals(gevraagd[0].kop["apns-expiration"], String(1_760_000_000 + 900));
  assertEquals((gevraagd[0].body as { aps: { alert: unknown } }).aps.alert, { title: "Sparta – JO14-1  0–1", body: "Doelpunt van Sem!" });
});

Deno.test("een telefoon die Apple niet meer kent mag uit de lijst, een storing niet", async () => {
  const { sleutel } = await proefsleutel();
  const antwoorden: Record<string, Response> = {
    weg: Response.json({ reason: "Unregistered" }, { status: 410 }),
    fout: Response.json({ reason: "BadDeviceToken" }, { status: 400 }),
    druk: Response.json({ reason: "TooManyRequests" }, { status: 429 }),
    goed: new Response(null, { status: 200 }),
  };
  const uit = await verstuur(
    { titel: "t", tekst: "x" },
    ["weg", "fout", "druk", "goed", "plat"].map((token) => ({ token, omgeving: "echt" })),
    sleutel,
    (url) => {
      const token = url.split("/").pop()!;
      return token === "plat" ? Promise.reject(new Error("geen verbinding")) : Promise.resolve(antwoorden[token]);
    },
  );
  assertEquals(uit.afgeleverd, 1);
  assertEquals(uit.vergeten.sort(), ["fout", "weg"]);
  assertEquals(uit.mislukt.length, 2, "te druk en geen verbinding: niets weggooien");
});

Deno.test("zonder volgers gaat er niets de deur uit", async () => {
  const { sleutel } = await proefsleutel();
  let keren = 0;
  const uit = await verstuur({ titel: "t", tekst: "x" }, [], sleutel, () => { keren++; return Promise.resolve(new Response()); });
  assertEquals(uit.afgeleverd + keren, 0);
});
