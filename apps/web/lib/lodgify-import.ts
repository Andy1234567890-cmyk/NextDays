// Lodgify-Objekt-Import (Login-Scrape). Meldet sich mit den Zugangsdaten des
// Kunden bei Lodgify an und liest über die INTERNEN App-APIs seine Objekte aus:
//   1) /api/v4/property            → Liste aller Objekte (id, name, Bild, status)
//   2) /api/v2/property/{id}/overview → Detail (Beschreibung mehrsprachig, Typ,
//      Fläche, Gästezahl, Räume/Betten, Ausstattung)
// Kein Datenimport von Buchungen — nur die PROPERTIES (Objekte) wandern rüber.
//
// Läuft NUR im Web-Teil (apps/web), weil hier Chromium über PLAYWRIGHT_BROWSERS_PATH
// bereitsteht (wie der PDF-Dienst) — NICHT im Python-Backend (dort kein Playwright).
// Das Kunden-Passwort wird ausschließlich flüchtig für den einen Login benutzt und
// NIE gespeichert (weder Datei noch DB noch Log).
import { chromium, type Browser, type Page } from "playwright-core";

const LOGIN_URL = "https://app.lodgify.com/login/en";
const LIST_API = "https://app.lodgify.com/api/v4/property?culture=en";
const DETAIL_API = (id: number | string) =>
  `https://app.lodgify.com/api/v2/property/${id}/overview`;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

export class LodgifyImportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// -- Debugging (nur wenn LODGIFY_DEBUG=1) --------------------------------------
// Schreibt Screenshot + aktuelle URL/Title an jedem Schritt in den Ordner
// LODGIFY_DEBUG_DIR (Default: ./.lodgify-debug), damit man GENAU sieht, wo der
// Login hängt. Im Prod aus (kein Env → keine Ausgabe, keine Kosten).
const DEBUG = process.env.LODGIFY_DEBUG === "1";
const DEBUG_DIR = process.env.LODGIFY_DEBUG_DIR || ".lodgify-debug";

async function dbg(page: Page, label: string): Promise<void> {
  if (!DEBUG) return;
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(DEBUG_DIR, { recursive: true });
    const url = page.url();
    let title = "";
    try {
      title = await page.title();
    } catch {
      title = "(no title)";
    }
    // eslint-disable-next-line no-console
    console.log(`[lodgify-debug] ${label} | url=${url} | title=${title}`);
    await page.screenshot({
      path: `${DEBUG_DIR}/${label}.png`,
      fullPage: true,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`[lodgify-debug] ${label} screenshot fehlgeschlagen:`, e);
  }
}

/** Ergebnis von Schritt 1 des Logins: entweder fertig eingeloggt (dann sind die
 *  Objekte gleich lesbar) oder 2FA nötig (dann bleibt der Browser offen und wir
 *  warten auf den SMS-Code über die sessionId). */
export type LoginStepResult =
  | { status: "logged_in"; page: Page }
  | { status: "needs_2fa" };

/** E-Mail + Passwort in das Lodgify-Login-Formular eintippen und absenden. Robust
 *  gegen Autofill (Feld hart leeren) und gegen React (echtes Tippen + Enter). */
async function fillAndSubmitLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  try {
    await page.waitForSelector('input[name="email"]', { timeout: 20000 });
    await page.waitForSelector('input[name="password"]', { timeout: 20000 });
  } catch {
    await dbg(page, "no-login-fields");
    throw new LodgifyImportError(
      "Lodgify-Anmeldeseite konnte nicht geladen werden. Bitte später erneut.",
      502,
    );
  }
  const emailInput = page.locator('input[name="email"]');
  const pwInput = page.locator('input[name="password"]');

  await emailInput.click();
  await emailInput.press("ControlOrMeta+A");
  await emailInput.press("Delete");
  await emailInput.pressSequentially(email, { delay: 30 });

  await pwInput.click();
  await pwInput.press("ControlOrMeta+A");
  await pwInput.press("Delete");
  await pwInput.pressSequentially(password, { delay: 30 });

  const typedEmail = (await emailInput.inputValue()).trim().toLowerCase();
  if (typedEmail !== email.trim().toLowerCase()) {
    await dbg(page, "email-mismatch");
    throw new LodgifyImportError(
      `E-Mail wurde nicht korrekt übernommen (Feld: „${typedEmail}"). Bitte erneut.`,
      500,
    );
  }

  await dbg(page, "before-submit");
  await pwInput.press("Enter");
  try {
    const btn = page
      .locator('button[type="submit"], button:has-text("Login")')
      .first();
    if (await btn.isEnabled({ timeout: 2000 })) await btn.click();
  } catch {
    // Enter hat bereits ausgelöst.
  }
}

/** Prüft, ob wir nach dem Login WIRKLICH in der App sind (nicht mehr auf
 *  login/identityserver/signin-oidc). */
function inLodgifyApp(u: string): boolean {
  return (
    u.includes("app.lodgify.com") &&
    !u.includes("/login") &&
    !u.includes("/signin-oidc") &&
    !u.includes("identityserver")
  );
}

/** Auf der 2FA-Seite die SMS-Methode auswählen (falls eine Methodenliste
 *  erscheint) und auf das Code-Eingabefeld warten. */
async function chooseSmsAndWaitForCodeField(page: Page): Promise<void> {
  // Falls eine Methodenauswahl da ist ("Verifizierung per SMS"): anklicken.
  const smsOption = page
    .locator(
      'text=/SMS/i, [class*="method" i]:has-text("SMS"), button:has-text("SMS"), a:has-text("SMS")',
    )
    .first();
  try {
    if ((await smsOption.count()) > 0) {
      await smsOption.click({ timeout: 5000 });
      await dbg(page, "2fa-sms-chosen");
      await page.waitForTimeout(2000);
    }
  } catch {
    // Vielleicht gibt es keine Auswahl, sondern direkt ein Code-Feld — ok.
  }
}

/** Erkennt, ob nach dem Login eine 2-Faktor-/SMS-Bestätigung verlangt wird.
 *  Prüft URL, sichtbaren Text und typische Code-/OTP-Eingabefelder. */
async function isTwoFactorPage(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (
    url.includes("2fa") ||
    url.includes("mfa") ||
    url.includes("two-factor") ||
    url.includes("twofactor") ||
    url.includes("verify") ||
    url.includes("otp")
  ) {
    return true;
  }
  try {
    const body = (await page.locator("body").innerText()).toLowerCase();
    const hints = [
      "verification code",
      "two-factor",
      "two factor",
      "bestätigungscode",
      "verifizierung",
      "sicherheitscode",
      "sms",
      "authenticator",
      "enter the code",
      "code gesendet",
    ];
    if (hints.some((h) => body.includes(h))) {
      // Zusätzlich ein plausibles Code-Eingabefeld verlangen, um Fehlalarme
      // (z. B. Marketing-Text „SMS") zu vermeiden.
      const codeInput = page.locator(
        'input[autocomplete="one-time-code"], input[name*="code" i], ' +
          'input[name*="otp" i], input[inputmode="numeric"]',
      );
      if ((await codeInput.count()) > 0) return true;
    }
  } catch {
    // Kein Body lesbar → keine 2FA angenommen.
  }
  return false;
}

/** Sichtbaren Login-Fehlertext von der Lodgify-Seite lesen (falls vorhanden),
 *  damit die Meldung den echten Grund nennt statt nur „fehlgeschlagen". */
async function loginErrorText(page: Page): Promise<string | null> {
  const selectors = [
    '[role="alert"]',
    ".error",
    ".field-validation-error",
    'div[class*="error" i]',
    'p[class*="error" i]',
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0) {
        const t = (await el.innerText()).trim();
        if (t && t.length < 300) return t;
      }
    } catch {
      // Selektor traf nicht — nächsten versuchen.
    }
  }
  return null;
}

// -- Rohformen der Lodgify-API (nur die Felder, die wir wirklich lesen) --------
type RawListItem = {
  propertyId: number;
  propertyName: string | null;
  propertyInternalName: string | null;
  imageUrl: string | null;
  status: string | null;
};

type RawRoom = { count?: number; room?: string; privacy?: string };
type RawRentalType = {
  areaUnit?: string;
  area?: number;
  numberOfPersons?: number;
  units?: number;
  sleepingRooms?: RawRoom[];
  otherRooms?: RawRoom[];
};
// Lodgify liefert je Sprache ein Objekt, dessen `description`-Feld ein
// verschachteltes Objekt { name, headline, description(HTML) } ist (verifiziert).
// Ältere/andere Konten liefern das evtl. als JSON-String — beides wird gelesen.
type RawDescInner = { name?: string; headline?: string; description?: string };
type RawDescription = {
  language?: string;
  languageCode?: string;
  description?: string | RawDescInner;
  text?: string | RawDescInner;
};

// -- Ergebnis, das wir an den Import-Endpunkt geben ----------------------------
export type LodgifyProperty = {
  lodgifyId: number;
  name: string;
  internalName: string | null;
  imageUrl: string | null;
  status: string | null;
  propertyType: string | null;
  areaSqm: number | null;
  maxGuests: number | null;
  units: number | null;
  // { code -> anzahl }, z. B. { DoubleBed: 1, TwinSingleBed: 1 }
  beds: Record<string, number>;
  rooms: Record<string, number>;
  amenities: string[];
  // Beschreibung je Sprache (HTML), z. B. { de: "<p>…", en: "<p>…" }
  descriptions: Record<string, string>;
};

/** Beschreibungs-Block normalisieren: Lodgify liefert text als JSON-String ODER
 *  als Objekt. Wir ziehen die reine description je Sprache heraus. */
function extractDescription(d: RawDescription): { lang: string; html: string } | null {
  const lang = (d.language || d.languageCode || "").toLowerCase();
  if (!lang) return null;
  // Der eigentliche Inhalt liegt bei Lodgify in `description` (Objekt), Fallback
  // `text`. Beide können Objekt { description: HTML } oder JSON-String sein.
  const raw = d.description ?? d.text;
  let inner: RawDescInner | null = null;
  if (typeof raw === "string") {
    try {
      inner = JSON.parse(raw) as RawDescInner;
    } catch {
      inner = { description: raw };
    }
  } else if (raw && typeof raw === "object") {
    inner = raw;
  }
  const html = inner?.description ?? "";
  if (!html) return null;
  return { lang, html };
}

/** Räume/Betten-Liste zu { code: anzahl } zusammenfassen. */
function countRooms(list: RawRoom[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of list ?? []) {
    const key = r.room;
    if (!key) continue;
    out[key] = (out[key] ?? 0) + (r.count ?? 1);
  }
  return out;
}

function mapDetail(item: RawListItem, overview: Record<string, unknown>): LodgifyProperty {
  const rentalTypes = (overview.rentalTypes as RawRentalType[] | undefined) ?? [];
  const rt = rentalTypes[0] ?? {};
  const amenitiesRaw = (overview.amenities as unknown[] | undefined) ?? [];
  const customRaw = (overview.customAmenities as unknown[] | undefined) ?? [];
  const amenities = [...amenitiesRaw, ...customRaw]
    .map((a) =>
      typeof a === "string"
        ? a
        : ((a as { name?: string; title?: string; code?: string })?.name ??
          (a as { title?: string })?.title ??
          (a as { code?: string })?.code ??
          null),
    )
    .filter((a): a is string => !!a);

  const descriptions: Record<string, string> = {};
  for (const d of (overview.descriptions as RawDescription[] | undefined) ?? []) {
    const ex = extractDescription(d);
    if (ex) descriptions[ex.lang] = ex.html;
  }

  return {
    lodgifyId: item.propertyId,
    name: item.propertyName ?? item.propertyInternalName ?? `Objekt ${item.propertyId}`,
    internalName: item.propertyInternalName,
    imageUrl: item.imageUrl ? normalizeImageUrl(item.imageUrl) : null,
    status: item.status,
    propertyType: (overview.propertyType as string | undefined) ?? null,
    areaSqm: typeof rt.area === "number" ? rt.area : null,
    maxGuests: typeof rt.numberOfPersons === "number" ? rt.numberOfPersons : null,
    units: typeof rt.units === "number" ? rt.units : null,
    beds: countRooms(rt.sleepingRooms),
    rooms: countRooms(rt.otherRooms),
    amenities,
    descriptions,
  };
}

/** Lodgify-Bild-URLs kommen protokoll-relativ (//l.icdbcdn.com/…) und mit einem
 *  Größen-Query (?f=32). Auf https anheben, Mini-Vorschau-Query entfernen. */
function normalizeImageUrl(url: string): string {
  let u = url.startsWith("//") ? `https:${url}` : url;
  u = u.replace(/\?f=\d+$/, "");
  return u;
}

// -- Mapping Lodgify → NextDays-Objekt (PropertyInput) -------------------------
// NextDays-Objekttypen für Ferienvermietung (Spiegel von PropertyType/VR_TYPES im
// Backend). Unbekannte Lodgify-Typen fallen auf 'ferienhaus' (neutraler Basistyp
// für Häuser) — das ist KEIN erfundener Wert, sondern der vorhandene Default.
const LODGIFY_TYPE_MAP: Record<string, string> = {
  normalhouse: "ferienhaus",
  house: "ferienhaus",
  villa: "ferienhaus",
  cottage: "ferienhaus",
  chalet: "ferienhaus",
  apartment: "appartement",
  flat: "appartement",
  studio: "appartement",
  condo: "appartement",
  tinyhouse: "tiny_house",
  cabin: "tiny_house",
  boat: "hausboot",
  houseboat: "hausboot",
  camping: "glamping",
  glamping: "glamping",
};

/** Eine gescrapte Lodgify-Property auf unser PropertyInput mappen. Bevorzugt die
 *  deutsche Beschreibung, fällt auf en/erste vorhandene zurück. Betten/Räume/m²
 *  landen strukturiert in type_attributes (das flexible JSON-Feld). Die
 *  lodgify_property_id wird mitgeführt → Idempotenz beim erneuten Import. */
export function toPropertyInput(p: LodgifyProperty): Record<string, unknown> {
  const description =
    p.descriptions.de ??
    p.descriptions.en ??
    Object.values(p.descriptions)[0] ??
    null;
  const typeKey = (p.propertyType ?? "").toLowerCase();
  const property_type = LODGIFY_TYPE_MAP[typeKey] ?? "ferienhaus";
  // max_guests im Backend auf 1..99 begrenzt.
  const max_guests = Math.min(Math.max(p.maxGuests ?? 1, 1), 99);

  return {
    title: p.name,
    description,
    property_type,
    max_guests,
    amenities: p.amenities,
    photos: p.imageUrl ? [p.imageUrl] : [],
    type_attributes: {
      // Herkunft + Rohdaten für Idempotenz und spätere Vervollständigung.
      lodgify_property_id: p.lodgifyId,
      imported_from: "lodgify",
      internal_name: p.internalName,
      area_sqm: p.areaSqm,
      units: p.units,
      beds: p.beds,
      rooms: p.rooms,
      descriptions: p.descriptions,
    },
  };
}

/** Ruft eine Lodgify-App-API IM SEITENKONTEXT auf. Nötig, weil die interne API
 *  einen Bearer-Token erwartet, den nur Lodgifys eigenes JavaScript setzt —
 *  page.request.* würde 403 liefern. `credentials:'include'` schickt die Session,
 *  Lodgifys fetch-Wrapper hängt den Authorization-Header an. */
async function fetchInPage<T>(page: Page, url: string): Promise<T> {
  const res = (await page.evaluate(async (u: string) => {
    const r = await fetch(u, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return { status: r.status as number, body: await r.text() };
  }, url)) as { status: number; body: string };
  if (res.status < 200 || res.status >= 300) {
    throw new LodgifyImportError(
      `Lodgify-API ${url} antwortete mit HTTP ${res.status}.`,
      502,
    );
  }
  return JSON.parse(res.body) as T;
}

// -- Cookie-Session-Modus (bevorzugt: kein Passwort nötig) ---------------------
// Genau diese Cookies bilden die Lodgify-Session (verifiziert: reichen für die
// interne API). Die httpOnly-Cookies kann nur eine Browser-Extension auslesen —
// darüber kommen sie hierher. Weitere Cookies schaden nicht, werden mitgeladen.
export const REQUIRED_LODGIFY_COOKIES = [
  ".lodgifytoken",
  ".lodgifysession",
  ".lodgifycdn",
  "idsrv.session",
  "csrf_token",
] as const;

export type SessionCookie = {
  name: string;
  value: string;
  domain: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  // Unix-Sekunden; -1/undefined = Session-Cookie.
  expires?: number;
  sameSite?: "Strict" | "Lax" | "None";
};

/** Liest die Objekte aus einer bereits EINGELOGGTEN Playwright-Page (Liste +
 *  Detail je Objekt). Von beiden Einstiegen (Cookie & Passwort) genutzt. */
async function readPropertiesFromPage(page: Page): Promise<LodgifyProperty[]> {
  // In die App navigieren, damit Lodgifys JS den Bearer-Token setzt (die interne
  // API braucht ihn; wir rufen sie im Seitenkontext per fetch auf).
  try {
    await page.goto("https://app.lodgify.com/rentals-list", {
      waitUntil: "networkidle",
      timeout: 45000,
    });
  } catch {
    // Nur Session-Aufwärmung; Timeout hier ist kein Abbruchgrund.
  }
  await page.waitForTimeout(2500);

  const listJson = await fetchInPage<{ data?: { items?: RawListItem[] } }>(
    page,
    LIST_API,
  );
  const items = listJson.data?.items ?? [];
  if (items.length === 0) return [];

  const result: LodgifyProperty[] = [];
  for (const item of items) {
    try {
      const ovJson = await fetchInPage<{ data?: Record<string, unknown> }>(
        page,
        DETAIL_API(item.propertyId),
      );
      result.push(mapDetail(item, ovJson.data ?? {}));
    } catch {
      // Ein einzelnes fehlerhaftes Detail darf den Gesamt-Import nicht kippen.
      result.push(mapDetail(item, {}));
    }
  }
  return result;
}

/** Bevorzugter Weg: Import mit der SESSION des Users (Cookies von der Browser-
 *  Extension) — ohne Passwort, funktioniert für Google/Apple/Passwort-Logins.
 *  Wirft 401, wenn die Session ungültig/abgelaufen ist (Rückwurf auf /login). */
export async function importLodgifyWithCookies(
  cookies: SessionCookie[],
): Promise<LodgifyProperty[]> {
  const have = new Set(cookies.map((c) => c.name));
  const missing = REQUIRED_LODGIFY_COOKIES.filter((n) => !have.has(n));
  if (missing.length > 0) {
    throw new LodgifyImportError(
      `Sitzungsdaten unvollständig (fehlt: ${missing.join(", ")}). ` +
        "Bitte in Lodgify anmelden und erneut versuchen.",
      422,
    );
  }
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ userAgent: UA, locale: "de-DE" });
    // Cookies in den frischen Context laden (Playwright-Format).
    await ctx.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || "/",
        httpOnly: c.httpOnly ?? false,
        secure: c.secure ?? true,
        expires: typeof c.expires === "number" ? c.expires : -1,
        sameSite: c.sameSite ?? "Lax",
      })),
    );
    const page = await ctx.newPage();
    // Prüfen, ob die Session gültig ist: App aufrufen; landen wir auf /login,
    // ist die Session abgelaufen → klare 401 (nicht importieren).
    await page.goto("https://app.lodgify.com/rentals-list", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      await dbg(page, "cookie-session-invalid");
      throw new LodgifyImportError(
        "Lodgify-Sitzung ist abgelaufen. Bitte in Lodgify neu anmelden und den " +
          "Import erneut starten.",
        401,
      );
    }
    return await readPropertiesFromPage(page);
  } catch (err) {
    if (err instanceof LodgifyImportError) throw err;
    throw new LodgifyImportError(
      err instanceof Error ? err.message : "Import fehlgeschlagen.",
      500,
    );
  } finally {
    if (browser) await browser.close();
  }
}

/** Nach dem Submit warten, bis wir in der App sind. Wirft mit klarer Ursache,
 *  wenn wir stattdessen wieder auf /login landen (falsche Zugangsdaten). */
async function waitUntilInAppOrFail(page: Page): Promise<Page> {
  try {
    await page.waitForURL((u) => inLodgifyApp(u.toString()), { timeout: 60000 });
  } catch {
    try {
      await page.goto("https://app.lodgify.com/dashboard/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch {
      // finale Prüfung unten entscheidet
    }
    if (!inLodgifyApp(page.url())) {
      await dbg(page, "login-failed");
      const detail = await loginErrorText(page);
      // eslint-disable-next-line no-console
      console.error(
        `[lodgify-import] Login nicht in App. url=${page.url()} | ` +
          `fehlertext=${detail ?? "(keiner)"}`,
      );
      throw new LodgifyImportError(
        detail
          ? `Login bei Lodgify fehlgeschlagen: ${detail}`
          : "Login bei Lodgify fehlgeschlagen. Bitte E-Mail und Passwort prüfen.",
        401,
      );
    }
  }
  await dbg(page, "after-login");
  return page;
}

/** Schritt 1: Mit E-Mail/Passwort anmelden. Zwei Ausgänge:
 *  - "logged_in": fertig eingeloggt → Objekte direkt lesbar (Browser via
 *    session-store offen gehalten, damit Schritt 2 die Objekte holen kann).
 *  - "needs_2fa": Konto verlangt SMS-Code → Browser bleibt offen, sessionId zurück.
 *  Der Aufrufer schließt die Session (closeLoginSession) nach Gebrauch. */
export async function startLodgifyLogin(
  email: string,
  password: string,
): Promise<
  | { status: "logged_in"; sessionId: string }
  | { status: "needs_2fa"; sessionId: string }
> {
  if (!email || !password) {
    throw new LodgifyImportError("E-Mail und Passwort erforderlich.", 422);
  }
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-features=AutofillServerCommunication,PasswordManagerOnboarding",
      "--disable-save-password-bubble",
    ],
  });
  try {
    const ctx = await browser.newContext({ userAgent: UA, locale: "de-DE" });
    const page = await ctx.newPage();

    await fillAndSubmitLogin(page, email, password);

    // Kurz warten, Zwischenzustand festhalten, auf 2FA prüfen.
    await page.waitForTimeout(3000);
    await dbg(page, "after-submit");

    if (await isTwoFactorPage(page)) {
      await dbg(page, "two-factor-required");
      await chooseSmsAndWaitForCodeField(page);
      // eslint-disable-next-line no-console
      console.error("[lodgify-import] 2FA/SMS-Code erforderlich — halte Session offen.");
      const { putLoginSession } = await import("@/lib/lodgify-login-session");
      const sessionId = putLoginSession(browser, page);
      return { status: "needs_2fa", sessionId };
    }

    // Kein 2FA → normal fertig einloggen; Session offen halten für Schritt „lesen".
    await waitUntilInAppOrFail(page);
    const { putLoginSession } = await import("@/lib/lodgify-login-session");
    const sessionId = putLoginSession(browser, page);
    return { status: "logged_in", sessionId };
  } catch (err) {
    await browser.close().catch(() => {});
    if (err instanceof LodgifyImportError) throw err;
    throw new LodgifyImportError(
      err instanceof Error ? err.message : "Login fehlgeschlagen.",
      500,
    );
  }
}

/** Schritt 2 (nur bei 2FA): den SMS-Code in die offene Session eintippen und den
 *  Login abschließen. Bei falschem Code klare 401. */
export async function completeLodgify2FA(
  sessionId: string,
  code: string,
): Promise<void> {
  const { getLoginSession } = await import("@/lib/lodgify-login-session");
  const session = getLoginSession(sessionId);
  if (!session) {
    throw new LodgifyImportError(
      "Die Anmeldung ist abgelaufen. Bitte den Import neu starten.",
      440,
    );
  }
  const { page } = session;
  const codeInput = page
    .locator(
      'input[autocomplete="one-time-code"], input[name*="code" i], ' +
        'input[name*="otp" i], input[inputmode="numeric"], input[type="tel"]',
    )
    .first();
  try {
    await codeInput.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    await dbg(page, "2fa-no-code-field");
    throw new LodgifyImportError(
      "Code-Eingabefeld nicht gefunden. Bitte den Import neu starten.",
      500,
    );
  }
  await codeInput.click();
  await codeInput.pressSequentially(code.trim(), { delay: 40 });
  await dbg(page, "2fa-before-verify");
  await codeInput.press("Enter");
  try {
    const verifyBtn = page
      .locator(
        'button[type="submit"], button:has-text("Verify"), ' +
          'button:has-text("Bestätigen"), button:has-text("Überprüfen")',
      )
      .first();
    if (await verifyBtn.isEnabled({ timeout: 2000 })) await verifyBtn.click();
  } catch {
    // Enter hat schon ausgelöst.
  }
  await page.waitForTimeout(2500);
  await dbg(page, "2fa-after-verify");
  // Falscher Code → wir bleiben auf der 2FA-Seite.
  if (await isTwoFactorPage(page)) {
    const detail = await loginErrorText(page);
    throw new LodgifyImportError(
      detail
        ? `Code abgelehnt: ${detail}`
        : "Der eingegebene Code ist falsch oder abgelaufen. Bitte erneut versuchen.",
      401,
    );
  }
  await waitUntilInAppOrFail(page);
}

/** Objekte aus einer offenen, eingeloggten Login-Session lesen und die Session
 *  danach schließen (Browser beenden). */
export async function readAndCloseSession(
  sessionId: string,
): Promise<LodgifyProperty[]> {
  const { getLoginSession, closeLoginSession } = await import(
    "@/lib/lodgify-login-session"
  );
  const session = getLoginSession(sessionId);
  if (!session) {
    throw new LodgifyImportError(
      "Die Anmeldung ist abgelaufen. Bitte den Import neu starten.",
      440,
    );
  }
  try {
    return await readPropertiesFromPage(session.page);
  } finally {
    await closeLoginSession(sessionId);
  }
}

/** Einstufiger Weg (Konten OHNE 2FA): anmelden und Objekte lesen. Bricht mit
 *  klarer Meldung ab, wenn das Konto 2FA verlangt (dann muss der zweistufige
 *  Weg genutzt werden). */
export async function importLodgifyProperties(
  email: string,
  password: string,
): Promise<LodgifyProperty[]> {
  const started = await startLodgifyLogin(email, password);
  if (started.status === "needs_2fa") {
    const { closeLoginSession } = await import("@/lib/lodgify-login-session");
    await closeLoginSession(started.sessionId);
    throw new LodgifyImportError(
      "Dein Lodgify-Konto verlangt einen SMS-Code. Bitte den 2-Faktor-Weg nutzen.",
      401,
    );
  }
  return readAndCloseSession(started.sessionId);
}
