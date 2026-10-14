/**
 * Het nakijken echt laten gebeuren, met de bibliotheek van Apple, maar met een
 * nagemaakte keten (proef/): een eigen root, een tussencertificaat en een blad
 * met dezelfde kenmerken als die van Apple. Zo bewijst de proef dat een goed
 * getekende aankoop erdoor komt en een vervalste niet, in Deno.
 */
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { Environment, SignedDataVerifier } from "npm:@apple/app-store-server-library@1.6.0";
import { Buffer } from "node:buffer";
import { type Nakijker, omgevingVan, verwerk } from "./verwerk.ts";
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

const nep = new SignedDataVerifier([Buffer.from(der(pem("root.pem")), "base64")], false, Environment.SANDBOX, "app.blaadje.ios");
const nakijker: Nakijker = {
  aankoop: (j) => nep.verifyAndDecodeTransaction(j),
  bericht: (j) => nep.verifyAndDecodeNotification(j),
};

const team = "11111111-1111-4111-8111-111111111111";
const aankoop = (extra: object = {}) => ({
  transactionId: "2000000001", originalTransactionId: "1000000123", bundleId: "app.blaadje.ios",
  productId: "app.blaadje.ios.team", type: "Auto-Renewable Subscription", environment: "Sandbox",
  signedDate: Date.now(), purchaseDate: Date.now(), expiresDate: Date.UTC(2027, 9, 14),
  appAccountToken: team, ...extra,
});

Deno.test("een aankoop van de app zet het team aan tot de verloopdatum", async () => {
  const regel = await verwerk({ transactie: await teken(aankoop()) }, nakijker);
  assertEquals(regel, {
    id: "1000000123", team, product: "app.blaadje.ios.team",
    verloopt: "2027-10-14T00:00:00.000Z", omgeving: "Sandbox", ingetrokken: false,
  });
});

Deno.test("een bericht van Apple over een verlenging of terugbetaling", async () => {
  const transactie = await teken(aankoop({ expiresDate: Date.UTC(2028, 9, 14), revocationDate: Date.now() }));
  const bericht = await teken({
    notificationType: "REFUND", notificationUUID: "x", version: "2.0", signedDate: Date.now(),
    data: { bundleId: "app.blaadje.ios", environment: "Sandbox", signedTransactionInfo: transactie },
  });
  const regel = await verwerk({ signedPayload: bericht }, nakijker);
  assertEquals(regel?.ingetrokken, true);
  assertEquals(regel?.verloopt, "2028-10-14T00:00:00.000Z");
});

Deno.test("een vervalste aankoop komt er niet door", async () => {
  const echt = await teken(aankoop());
  const [kop, , handtekening] = echt.split(".");
  const anders = btoa(JSON.stringify(aankoop({ expiresDate: Date.UTC(2099, 0, 1) }))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  await assertRejects(() => verwerk({ transactie: `${kop}.${anders}.${handtekening}` }, nakijker));
});

Deno.test("een keten die niet van Apple komt, of zonder tussencertificaat, komt er niet door", async () => {
  // Dezelfde aankoop, maar nagekeken tegen de echte root van Apple: onze nagemaakte keten hoort daar niet bij.
  const echtApple = new SignedDataVerifier([Buffer.from(APPLE_ROOT_G3, "base64")], false, Environment.SANDBOX, "app.blaadje.ios");
  const tegenApple: Nakijker = { aankoop: (j) => echtApple.verifyAndDecodeTransaction(j), bericht: (j) => echtApple.verifyAndDecodeNotification(j) };
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
