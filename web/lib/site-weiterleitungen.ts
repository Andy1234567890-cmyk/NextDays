"use server";

// URL-Weiterleitungen der Kunden-Website (0430) — Server-Actions gegen
// /api/v1/site-config/redirects.
//
// Eigene Datei und nicht an `site-config.ts` angehängt: die dortigen Aktionen
// arbeiten alle auf EINEM Datensatz (dem Branding) und auf Domains. Eine
// Weiterleitung ist eine eigene Ressource mit Liste, Anlegen, Ändern, Löschen
// und Import — dieselbe Trennung wie zwischen `site-config.ts` und
// `site-pages.ts`.
//
// Wichtig zu `"use server"`: hier dürfen AUSSCHLIESSLICH async functions
// exportiert werden. Typen sind erlaubt (sie verschwinden beim Kompilieren),
// ein `const` oder Objekt bricht den Build erst in „Collecting page data".
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** 301 = dauerhaft (gibt die Suchmaschinen-Platzierung an die neue Adresse
 *  weiter), 302 = vorübergehend (behält sie bei der alten). Der Unterschied ist
 *  der Grund, warum es die Wahl gibt. */
export type RedirectType = "301" | "302";

export type Weiterleitung = {
  id: string;
  source_path: string;
  target: string;
  redirect_type: RedirectType;
  is_active: boolean;
  created_at: string | null;
};

export type WeiterleitungEingabe = {
  source_path: string;
  target: string;
  redirect_type?: RedirectType;
  is_active?: boolean;
};

/** Ergebnis eines CSV-Imports, nach WIRKUNG getrennt.
 *
 *  Drei Zahlen und nicht eine: „12 importiert" verschweigt, dass 8 davon
 *  bestehende Weiterleitungen überschrieben haben. */
export type ImportErgebnis = {
  created: number;
  updated: number;
  skipped: number;
  /** Je Fehler eine Zeile mit der Zeilennummer aus der Datei. */
  errors: string[];
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

/** Ein Befund der SEO-Prüfung (Etappe B).
 *
 *  `code` und kein fertiger Satz: die Oberfläche übersetzt ihn in 24 Sprachen.
 *  Ein Text aus dem Backend wäre auf Deutsch — und der Betrieb kann sein
 *  Dashboard auf Dänisch führen. */
export type SeoBefund = {
  code: string;
  schwere: "fehler" | "warnung" | "hinweis";
  /** Die VOLLE Zahl betroffener Seiten oder Objekte. */
  anzahl: number;
  /** Höchstens die ersten zehn, namentlich. `slug` ist bei Objekten leer. */
  seiten: Array<{ id: string; titel: string; slug: string }>;
};

export type SeoPruefung = {
  items: SeoBefund[];
  /** Geprüfte, veröffentlichte Seiten. Ohne diese Zahl ist eine leere
   *  Befundliste zweideutig: alles gepflegt — oder noch nichts veröffentlicht? */
  geprueft: number;
};

export async function seoPruefung(): Promise<Result<SeoPruefung>> {
  return call("/site-config/seo/pruefung");
}

/** Eine Formular-Einsendung (0436). */
export type FormEinsendung = {
  id: string;
  block_id: string | null;
  form_name: string | null;
  /** Die Antworten als {feldname: wert}. Welche Felder es sind, hat der Betrieb
   *  selbst festgelegt — deshalb ein freies Objekt und keine feste Form. */
  daten: Record<string, string>;
  created_at: string | null;
  is_read: boolean;
};

export async function listFormEinsendungen(
  limit = 50,
  offset = 0,
): Promise<Result<{ items: FormEinsendung[]; total: number }>> {
  return call(
    `/site-config/form-submissions?limit=${limit}&offset=${offset}`,
  );
}

/** Eine Anlage aus einer Formular-Einsendung (0445).
 *
 *  `url` ist eine SIGNIERTE Adresse und gilt fünf Minuten. Sie wird bei jedem
 *  Abruf neu erzeugt und darf deshalb NICHT zwischengespeichert werden — eine
 *  gespeicherte Adresse wäre ein dauerhafter Leseschlüssel auf eine Datei, die
 *  ein Fremder geschickt hat.
 *
 *  `null` heißt: die Signatur ist fehlgeschlagen. Die Oberfläche zeigt den
 *  Namen dann ohne Link, statt auf ein totes Ziel zu führen (Wurzel 4). */
export type FormAnlage = {
  id: string;
  feld: string;
  name: string;
  groesse: number;
  mime: string;
  url: string | null;
  verfaellt_am: string | null;
};

/** Die Anlagen EINER Einsendung.
 *
 *  Eigener Aufruf und nicht Teil der Liste: die Adressen werden je Abruf frisch
 *  signiert, und für 50 Anfragen 50 Signaturen zu bauen, von denen niemand eine
 *  anklickt, wäre Arbeit ohne Zweck. Geladen wird erst, wenn jemand eine
 *  Anfrage aufklappt. */
export async function listFormAnlagen(
  submissionId: string,
): Promise<Result<{ items: FormAnlage[] }>> {
  return call(`/site-config/form-submissions/${submissionId}/uploads`);
}

export async function markiereEinsendungGelesen(
  id: string,
): Promise<Result<null>> {
  const res = await call<null>(`/site-config/form-submissions/${id}/read`, {
    method: "POST",
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

/** Endgültig löschen — ohne Papierkorb.
 *
 *  Absichtlich: es sind personenbezogene Daten, und ein Löschbegehren nach
 *  Art. 17 DSGVO muss zu einem echten Löschen führen. */
export async function loescheEinsendung(id: string): Promise<Result<null>> {
  const res = await call<null>(`/site-config/form-submissions/${id}`, {
    method: "DELETE",
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

/** Die Einsendungen als CSV-Text.
 *
 *  Serverseitig erzeugt, damit die Spaltenreihenfolge EINE Wahrheit hat: die
 *  Felder unterscheiden sich je Formular, und zwei Fassungen (Browser/Server)
 *  würden bei einem geänderten Formular verschiedene Dateien liefern.
 *
 *  Semikolon als Trennzeichen: Excel in der deutschen Einstellung liest Komma
 *  nicht als Spaltentrenner, und die Datei landet dann in EINER Spalte. */
export async function einsendungenAlsCsv(
  items: FormEinsendung[],
): Promise<string> {
  // Alle vorkommenden Feldnamen sammeln — auch aus älteren Einsendungen, deren
  // Formular inzwischen anders aussieht. Sonst fehlen genau die Spalten, die
  // jemand exportieren wollte.
  const spalten = new Set<string>();
  for (const e of items) for (const k of Object.keys(e.daten)) spalten.add(k);
  const felder = [...spalten].sort();

  const escape = (v: string) =>
    // Anführungszeichen verdoppeln, dann einschließen: die Regel aus RFC 4180.
    // Ohne sie zerlegt ein Semikolon oder Zeilenumbruch im Freitext die Datei.
    `"${v.replace(/"/g, '""')}"`;

  const kopf = ["Datum", "Formular", ...felder].map(escape).join(";");
  const zeilen = items.map((e) =>
    [
      e.created_at ?? "",
      e.form_name ?? "",
      ...felder.map((f) => e.daten[f] ?? ""),
    ]
      .map(escape)
      .join(";"),
  );
  // BOM voran: ohne ihn zeigt Excel Umlaute als Buchstabensalat.
  return "\ufeff" + [kopf, ...zeilen].join("\r\n");
}

export async function listWeiterleitungen(): Promise<
  Result<{ items: Weiterleitung[]; total: number }>
> {
  return call("/site-config/redirects");
}

export async function addWeiterleitung(
  input: WeiterleitungEingabe,
): Promise<Result<Weiterleitung>> {
  const res = await call<Weiterleitung>("/site-config/redirects", {
    method: "POST",
    body: input,
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

export async function updateWeiterleitung(
  redirectId: string,
  input: Partial<Omit<WeiterleitungEingabe, "source_path">>,
): Promise<Result<Weiterleitung>> {
  // `source_path` ist NICHT änderbar: der Pfad IST die Identität der
  // Weiterleitung. Wer ihn ändern will, legt eine neue an und löscht die alte —
  // dann ist der Zwischenzustand sichtbar statt still.
  const res = await call<Weiterleitung>(
    `/site-config/redirects/${redirectId}`,
    { method: "PATCH", body: input },
  );
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

export async function removeWeiterleitung(
  redirectId: string,
): Promise<Result<null>> {
  const res = await call<null>(`/site-config/redirects/${redirectId}`, {
    method: "DELETE",
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

export async function importWeiterleitungen(
  items: WeiterleitungEingabe[],
  overwrite = false,
): Promise<Result<ImportErgebnis>> {
  const res = await call<ImportErgebnis>("/site-config/redirects/import", {
    method: "POST",
    body: { items, overwrite },
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

/** Eine CSV-Datei in Weiterleitungs-Eingaben zerlegen.
 *
 *  Erwartet zwei bis drei Spalten: Quellpfad, Ziel, optional der Typ (301/302).
 *  Trennzeichen sind Komma UND Semikolon — Excel exportiert in der deutschen
 *  Einstellung mit Semikolon, und eine Datei aus Excel ist der Normalfall.
 *
 *  Eine Kopfzeile wird erkannt und übersprungen (erste Zelle enthält keinen
 *  Pfad). Leere Zeilen fallen weg. Alles andere wird NICHT geraten: der Server
 *  prüft jede Zeile und meldet die fehlerhaften mit Zeilennummer zurück.
 *
 *  Läuft hier und nicht im Browser, damit die Zerlegung eine Wahrheit hat —
 *  eine zweite Fassung im Client wäre die Art Dublette, die auseinanderläuft. */
export async function csvZuWeiterleitungen(
  text: string,
): Promise<WeiterleitungEingabe[]> {
  const zeilen = text
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter(Boolean);
  const out: WeiterleitungEingabe[] = [];
  for (const zeile of zeilen) {
    const spalten = zeile
      .split(/[;,]/)
      .map((z) => z.trim().replace(/^"|"$/g, ""));
    const [quelle, ziel, typ] = spalten;
    if (!quelle || !ziel) continue;
    // Kopfzeile: eine Quellspalte, die kein Pfad ist und auch nicht zu einem
    // gemacht werden kann. „old url" hat ein Leerzeichen, ein Pfad nie.
    if (/\s/.test(quelle)) continue;
    out.push({
      source_path: quelle,
      target: ziel,
      redirect_type: typ === "302" ? "302" : "301",
    });
  }
  return out;
}
