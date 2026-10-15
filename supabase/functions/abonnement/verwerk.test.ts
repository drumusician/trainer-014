/**
 * Het nakijken echt laten gebeuren, met onze eigen nakijker (nakijk.ts), maar met een
 * nagemaakte keten (proef/): een eigen root, een tussencertificaat en een blad
 * met dezelfde kenmerken als die van Apple. Zo bewijst de proef dat een goed
 * getekende aankoop erdoor komt en een vervalste niet, in Deno.
 */
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { maakNakijker } from "./nakijk.ts";
import { omgevingVan, seizoenTot, verwerk } from "./verwerk.ts";
import { APPLE_ROOT_G3 } from "./apple-root.ts";

const hier = new URL("./proef/", import.meta.url);
const pem = (naam: string) => Deno.readTextFileSync(new URL(naam, hier));
const der = (p: string) => p.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function teken(inhoud: object, keten = ["blad.pem", "tussen.pem", "root.pem"]): Promise<string> {
  const sleutel = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(der(pem("blad.p8.pem"))), (c) => c.charCodeAt(0)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const kop = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", x5c: keten.map((k) => der(pem(k))) })));
  const lijf = b64url(new TextEncoder().encode(JSON.stringify(inhoud)));
  const handtekening = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, sleutel, new TextEncoder().encode(kop + "." + lijf));
  return kop + "." + lijf + "." + b64url(new Uint8Array(handtekening));
}

const nakijker = maakNakijker([der(pem("root.pem"))], "app.blaadje.ios", "Sandbox");

const team = "11111111-1111-4111-8111-111111111111";
const aankoop = (extra: object = {}) => ({
  transactionId: "2000000001", originalTransactionId: "1000000123", bundleId: "app.blaadje.ios",
  productId: "app.blaadje.ios.seizoen", type: "Non-Renewing Subscription", environment: "Sandbox",
  signedDate: Date.now(), purchaseDate: Date.UTC(2026, 9, 14),
  appAccountToken: team, ...extra,
});

Deno.test("een aankoop van de app zet het team aan tot het einde van het seizoen", async () => {
  const regel = await verwerk({ transactie: await teken(aankoop()) }, nakijker);
  assertEquals(regel, {
    id: "1000000123", team, product: "app.blaadje.ios.seizoen",
    verloopt: "2027-07-31T22:00:00.000Z", omgeving: "Sandbox", ingetrokken: false,
  });
});

Deno.test("het seizoen loopt tot 31 juli, en vanaf 1 mei koop je het volgende", () => {
  const tot = (iso: string) => seizoenTot(Date.parse(iso));
  assertEquals(tot("2026-08-20T10:00:00Z"), "2027-07-31T22:00:00.000Z");
  assertEquals(tot("2027-01-15T10:00:00Z"), "2027-07-31T22:00:00.000Z");
  assertEquals(tot("2027-04-30T21:59:00Z"), "2027-07-31T22:00:00.000Z", "30 april, nog net dit seizoen");
  assertEquals(tot("2027-04-30T22:30:00Z"), "2028-07-31T22:00:00.000Z", "1 mei in Nederland: het volgende seizoen");
  assertEquals(tot("2027-06-30T10:00:00Z"), "2028-07-31T22:00:00.000Z");
  assertEquals(tot("2027-07-15T10:00:00Z"), "2028-07-31T22:00:00.000Z");
});

Deno.test("een bericht van Apple over een verlenging of terugbetaling", async () => {
  const transactie = await teken(aankoop({ revocationDate: Date.now() }));
  const bericht = await teken({
    notificationType: "REFUND", notificationUUID: "x", version: "2.0", signedDate: Date.now(),
    data: { bundleId: "app.blaadje.ios", environment: "Sandbox", signedTransactionInfo: transactie },
  });
  const regel = await verwerk({ signedPayload: bericht }, nakijker);
  assertEquals(regel?.ingetrokken, true);
  assertEquals(regel?.verloopt, "2027-07-31T22:00:00.000Z");
});

Deno.test("een vervalste aankoop komt er niet door", async () => {
  const echt = await teken(aankoop());
  const [kop, , handtekening] = echt.split(".");
  const anders = btoa(JSON.stringify(aankoop({ appAccountToken: "22222222-2222-4222-8222-222222222222" }))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  await assertRejects(() => verwerk({ transactie: `${kop}.${anders}.${handtekening}` }, nakijker));
});

Deno.test("een keten die niet van Apple komt, of zonder tussencertificaat, komt er niet door", async () => {
  // Dezelfde aankoop, maar nagekeken tegen de echte root van Apple: onze nagemaakte keten hoort daar niet bij.
  const tegenApple = maakNakijker([APPLE_ROOT_G3], "app.blaadje.ios", "Sandbox");
  await assertRejects(async () => verwerk({ transactie: await teken(aankoop()) }, tegenApple));
  const zonderTussen = await teken(aankoop(), ["blad.pem", "blad.pem", "root.pem"]);
  await assertRejects(() => verwerk({ transactie: zonderTussen }, nakijker));
});

Deno.test("een andere app of een ander product legt niets vast", async () => {
  await assertRejects(async () => verwerk({ transactie: await teken(aankoop({ bundleId: "nl.iemand.anders" })) }, nakijker));
  assertEquals(await verwerk({ transactie: await teken(aankoop({ productId: "iets.anders" })) }, nakijker), null);
  assertEquals(await verwerk({ transactie: await teken(aankoop({ appAccountToken: undefined })) }, nakijker), null);
  assertEquals(await verwerk({}, nakijker), null);
});

Deno.test("de omgeving staat in de aankoop en in het bericht", async () => {
  assertEquals(omgevingVan(await teken(aankoop())), "Sandbox");
  assertEquals(omgevingVan(await teken({ data: { environment: "Production" } })), "Production");
  assertEquals(omgevingVan("onzin"), undefined);
});

Deno.test("een keten zoals die van Apple, met P-384 en SHA-384, komt erdoor", async () => {
  const metP384 = maakNakijker([der(pem("root384.pem"))], "app.blaadje.ios", "Sandbox");
  const regel = await verwerk({ transactie: await teken(aankoop(), ["blad384.pem", "tussen384.pem", "root384.pem"]) }, metP384);
  assertEquals(regel?.team, team);
  // en die keten hoort niet bij de andere root
  await assertRejects(async () => verwerk({ transactie: await teken(aankoop(), ["blad384.pem", "tussen384.pem", "root384.pem"]) }, nakijker));
});

Deno.test("een aankoop uit een andere omgeving of van na het verlopen van de keten komt er niet door", async () => {
  await assertRejects(async () => verwerk({ transactie: await teken(aankoop({ environment: "Production" })) }, nakijker));
  await assertRejects(async () => verwerk({ transactie: await teken(aankoop({ signedDate: Date.UTC(2200, 0, 1) })) }, nakijker));
});

Deno.test("de nakijker gebruikt geen node:crypto, want dat mist op de server", async () => {
  for (const bestand of ["nakijk.ts", "index.ts", "verwerk.ts"]) {
    const tekst = await Deno.readTextFile(new URL(bestand, import.meta.url));
    assertEquals(/node:crypto|app-store-server-library/.test(tekst.replace(/\/\*[\s\S]*?\*\//g, "")), false, bestand);
  }
});
