/**
 * Een aankoop van het teamseizoen verwerken: van de app (vlak na het kopen, en
 * bij elk openen) of van Apple zelf (een terugbetaling, ook als niemand de app
 * opent).
 *
 * Wat erin komt is door Apple getekend. Pas als die handtekening klopt, geloven
 * we wat erin staat: welk team (de app gaf het team mee als `appAccountToken`),
 * wanneer het gekocht is, en of het is ingetrokken.
 *
 * Een teamseizoen verlengt niet vanzelf (bij Apple een "Non-Renewing
 * Subscription"): tot wanneer het geldt rekenen we hier zelf uit. Het geldt tot
 * het einde van het voetbalseizoen, 31 juli, zodat het team de zomer door
 * aanstaat. Wie vanaf 1 mei koopt, koopt het volgende seizoen.
 */

/** Wat Apple over één aankoop zegt, na het nakijken. */
export interface Aankoop {
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  environment?: string;
}

export interface Nakijker {
  aankoop(jws: string): Promise<Aankoop>;
  bericht(jws: string): Promise<{ data?: { signedTransactionInfo?: string } }>;
}

export interface Vastlegging {
  id: string;
  team: string;
  product: string;
  verloopt: string;
  omgeving: string;
  ingetrokken: boolean;
}

export const PRODUCTEN = ["app.blaadje.ios.seizoen"];

/**
 * Tot wanneer een teamseizoen geldt dat op dit moment gekocht is: 1 augustus,
 * 0:00 in Nederland, na het seizoen. Gekocht van 1 mei tot en met 30 juni telt
 * voor het seizoen daarna.
 */
export function seizoenTot(gekocht: number): string {
  const delen = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "numeric" })
    .formatToParts(new Date(gekocht));
  const jaar = Number(delen.find((d) => d.type === "year")!.value);
  const maand = Number(delen.find((d) => d.type === "month")!.value);
  const begin = maand >= 5 ? jaar : jaar - 1;
  // In augustus is het in Nederland altijd zomertijd.
  return new Date(`${begin + 1}-08-01T00:00:00+02:00`).toISOString();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Een nagekeken aankoop als regel voor de database, of null als hij niet over een team gaat. */
export function alsVastlegging(a: Aankoop): Vastlegging | null {
  if (!a.originalTransactionId || !a.productId || !PRODUCTEN.includes(a.productId)) return null;
  if (!a.appAccountToken || !UUID.test(a.appAccountToken) || !a.purchaseDate) return null;
  if (a.environment !== "Production" && a.environment !== "Sandbox") return null;
  return {
    id: a.originalTransactionId,
    team: a.appAccountToken.toLowerCase(),
    product: a.productId,
    verloopt: seizoenTot(a.purchaseDate),
    omgeving: a.environment,
    ingetrokken: a.revocationDate !== undefined && a.revocationDate !== null,
  };
}

/**
 * Wat er binnenkwam. `{ transactie }` van de app, `{ signedPayload }` van Apple.
 * Geeft de vastlegging terug, of null als er niets vast te leggen valt. Een
 * handtekening die niet klopt gooit: dan is het geen aankoop.
 */
export async function verwerk(lichaam: unknown, nakijker: Nakijker): Promise<Vastlegging | null> {
  const l = (lichaam ?? {}) as { transactie?: unknown; signedPayload?: unknown };
  let transactie: string | undefined;
  if (typeof l.transactie === "string") {
    transactie = l.transactie;
  } else if (typeof l.signedPayload === "string") {
    const bericht = await nakijker.bericht(l.signedPayload);
    transactie = bericht.data?.signedTransactionInfo;
  }
  if (!transactie) return null;
  return alsVastlegging(await nakijker.aankoop(transactie));
}

/** De omgeving uit een JWS, zonder na te kijken: om de juiste nakijker te kiezen. */
export function omgevingVan(jws: string): string | undefined {
  try {
    const deel = jws.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const o = JSON.parse(atob(deel + "=".repeat((4 - (deel.length % 4)) % 4)));
    return o.environment ?? o.data?.environment;
  } catch {
    return undefined;
  }
}
