"use server";

// Mediathek des Website-Baukastens: Ordner, Bild-Metadaten, Verwendungsnachweis,
// Bild-Ersetzen und Stock-Fotos (0460/0461).
//
// Eigenes Modul und nicht weitere 250 Zeilen in `site-pages.ts`: dort stehen
// Seiten und Blöcke, hier steht die Bildablage. Die drei Bild-Aufrufe, die es
// schon gab (`listMedia`/`uploadMedium`/`removeMedium`), bleiben aus einem
// Grund dort: sie werden aus dem Auswahl-Dialog heraus benutzt, der an Blöcken
// hängt — sie umzuziehen hieße, zwanzig Importzeilen für nichts anzufassen.
//
// Der API-Schlüssel der Stock-Anbieter kommt hier NIE vor. Die Suche läuft über
// den Proxy in apps/api (`/site-config/stock/...`); alles, was der Browser
// sieht, ist die Trefferliste. Ein Schlüssel im Frontend wäre ein
// veröffentlichter Schlüssel (Wurzel 6/7).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import type { Medium, MediumArt } from "@/lib/site-pages";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
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

function touch() {
  revalidatePath("/website", "layout");
}

// --- Ordner -----------------------------------------------------------------

/** Ein Ordner der Mediathek. `parent_id === null` = erste Ebene. */
export type MediaOrdner = {
  id: string;
  parent_id: string | null;
  name: string;
  /** Bilder DIREKT in diesem Ordner, nicht in Unterordnern. */
  media_count: number;
  created_at: string | null;
};

export type MediaOrdnerListe = {
  items: MediaOrdner[];
  total: number;
  /** Bilder in keinem Ordner. Kommt vom Server, wird NICHT aus
   *  „Gesamt minus Summe" gerechnet — die Rechnung wäre falsch, sobald
   *  zwischen zwei Abfragen etwas verschoben wird. */
  root_media_count: number;
};

/** Der Ordnerbaum mit Zählern.
 *
 *  `art` zählt NUR diese Medienart: die Oberfläche zeigt immer einen Reiter,
 *  und ein Ordner mit „2" neben dem Namen, in dem im offenen Reiter nichts
 *  liegt, wäre eine Falschaussage. */
export async function listMediaOrdner(
  art?: MediumArt,
): Promise<Result<MediaOrdnerListe>> {
  const p = art ? `?kind=${art}` : "";
  return call(`/site-config/media-folders${p}`);
}

export async function createMediaOrdner(
  name: string,
  parentId: string | null = null,
): Promise<Result<MediaOrdner>> {
  const res = await call<MediaOrdner>("/site-config/media-folders", {
    method: "POST",
    body: { name, parent_id: parentId },
  });
  if (res.ok) touch();
  return res;
}

/** Umbenennen und/oder verschieben — bewusst EIN Aufruf.
 *
 *  Zwei getrennte Aufrufe hätten einen Zwischenzustand, in dem der Ordner schon
 *  verschoben, aber noch alt benannt ist und mit einem Nachbarn kollidiert. */
export async function updateMediaOrdner(
  folderId: string,
  aenderung: { name?: string; parent_id?: string | null },
): Promise<Result<MediaOrdner>> {
  const res = await call<MediaOrdner>(
    `/site-config/media-folders/${folderId}`,
    { method: "PATCH", body: aenderung },
  );
  if (res.ok) touch();
  return res;
}

export type OrdnerLoeschVorschau = {
  folder_id: string;
  subfolder_count: number;
  /** Bilder, die dabei in die Wurzel rutschen. Sie werden NICHT gelöscht. */
  media_count: number;
};

/** Was ein Löschen anrichten würde — VOR dem Löschen (Wurzel 1). Ein Ordner mit
 *  80 Fotos sieht in der Oberfläche aus wie ein leerer. */
export async function previewMediaOrdnerLoeschen(
  folderId: string,
): Promise<Result<OrdnerLoeschVorschau>> {
  return call(`/site-config/media-folders/${folderId}/delete-preview`);
}

export async function deleteMediaOrdner(
  folderId: string,
): Promise<Result<null>> {
  const res = await call<null>(`/site-config/media-folders/${folderId}`, {
    method: "DELETE",
  });
  if (res.ok) touch();
  return res;
}

// --- Bilder: filtern, ändern, verschieben -----------------------------------

/** Wonach die Mediathek sortiert. Ein ENUM und kein durchgereichter
 *  Spaltenname — der Server nimmt nichts anderes an. */
export type MediaSortierung = "neueste" | "aelteste" | "name" | "groesse";

export type MediaFilter = {
  /** Der Reiter: nur diese Art. `undefined` = alle Arten (0479). */
  art?: MediumArt;
  /** Genau dieser Ordner. */
  folderId?: string | null;
  /** true = nur Bilder in KEINEM Ordner. Etwas anderes als „kein folderId"
   *  (= alle Bilder), und die Oberfläche braucht beide. */
  nurWurzel?: boolean;
  suche?: string;
  sortierung?: MediaSortierung;
  limit?: number;
  offset?: number;
};

export async function listMediaGefiltert(
  filter: MediaFilter = {},
): Promise<Result<{ items: Medium[]; total: number }>> {
  const p = new URLSearchParams();
  p.set("limit", String(filter.limit ?? 100));
  p.set("offset", String(filter.offset ?? 0));
  if (filter.folderId) p.set("folder_id", filter.folderId);
  if (filter.nurWurzel) p.set("root", "true");
  if (filter.suche?.trim()) p.set("q", filter.suche.trim());
  if (filter.sortierung) p.set("sort", filter.sortierung);
  if (filter.art) p.set("kind", filter.art);
  return call(`/site-config/media?${p.toString()}`);
}

/** Bestand je Art und je Herkunft — die Zahlen der linken Spalte (0479).
 *
 *  Kommt vom Server. Aus der geladenen Seite gezählt wären es die SICHTBAREN
 *  Medien (höchstens 200), und die Zahl neben „Hochgeladen" wäre plausibel
 *  falsch. */
export type MediaUebersichtDaten = {
  total: number;
  /** Art → Anzahl. Immer alle fünf Arten, auch mit 0. */
  je_art: Record<MediumArt, number>;
  /** Art → hochgeladene Medien dieser Art. JE ART, weil die Zahl unter dem
   *  offenen Reiter steht: artenübergreifend stünde „Hochgeladen 2" über einem
   *  leeren Symbolbestand. */
  hochgeladen_je_art: Record<MediumArt, number>;
  /** Art → gekaufte Medien. Heute überall 0 — es gibt keinen bezahlten
   *  Anbieter. Gezählt und nicht hartkodiert. */
  gekauft_je_art: Record<MediumArt, number>;
  /** Bestandsgrenze je Betrieb, damit die Oberfläche „65 von 500" zeigen kann,
   *  ohne die Zahl selbst zu kennen. */
  grenze: number;
};

export async function mediaUebersicht(): Promise<Result<MediaUebersichtDaten>> {
  return call("/site-config/media/uebersicht");
}

/** Ein Bild von einer fremden Adresse in die Mediathek holen.
 *
 *  Es geht NUR die Adresse hinaus. Ob sie abgerufen werden darf (interne Netze,
 *  Metadaten-Dienst, DNS-Rebinding), was dahinter liegt und wie groß es ist,
 *  entscheidet der Server — hier ist keine Prüfung, die etwas wert wäre. */
export async function importiereMediumVonUrl(
  url: string,
  folderId: string | null = null,
): Promise<Result<Medium>> {
  const res = await call<Medium>("/site-config/media/import", {
    method: "POST",
    body: { url, folder_id: folderId },
  });
  if (res.ok) touch();
  return res;
}

/** Mehrere Medien auf einmal löschen.
 *
 *  EIN Aufruf statt n — und anders als beim Verschieben ist das hier
 *  unumkehrbar, weshalb der Server den Scope ALLER IDs prüft, bevor die erste
 *  Zeile fällt. */
export async function loescheMedienMehrfach(
  mediaIds: string[],
): Promise<Result<{ deleted: number }>> {
  const res = await call<{ deleted: number }>("/site-config/media/bulk-delete", {
    method: "POST",
    body: { media_ids: mediaIds },
  });
  if (res.ok) touch();
  return res;
}

export async function getMedium(mediumId: string): Promise<Result<Medium>> {
  return call(`/site-config/media/${mediumId}`);
}

/** Anzeigename, Ordner und Alt-Text ändern.
 *
 *  `folder_id: null` ist ein ECHTER Wert („raus aus dem Ordner"), nicht
 *  „unverändert" — deshalb wird das Objekt so weitergereicht, wie es kommt,
 *  und nicht von `undefined` gesäubert. */
export async function updateMedium(
  mediumId: string,
  aenderung: {
    filename?: string | null;
    folder_id?: string | null;
    alt_text?: string | null;
  },
): Promise<Result<Medium>> {
  const res = await call<Medium>(`/site-config/media/${mediumId}`, {
    method: "PATCH",
    body: aenderung,
  });
  if (res.ok) touch();
  return res;
}

/** Mehrere Bilder auf einmal in einen Ordner schieben.
 *
 *  EIN Aufruf statt n: bei 50 Bildern wären es sonst 50 Rundreisen, von denen
 *  die 30. scheitern kann — und dann liegen 29 verschoben und 21 nicht. */
export async function moveMedia(
  mediaIds: string[],
  folderId: string | null,
): Promise<Result<{ items: Medium[]; total: number }>> {
  const res = await call<{ items: Medium[]; total: number }>(
    "/site-config/media/move",
    { method: "POST", body: { media_ids: mediaIds, folder_id: folderId } },
  );
  if (res.ok) touch();
  return res;
}

// --- Verwendung und Ersetzen ------------------------------------------------

/** Eine Stelle, an der die Adresse eines Bildes steht. */
export type MediaVerwendung = {
  /** `block` · `page` (SEO-/Titelbild) · `branding` (Logo, Favicon …) ·
   *  `code` (freies HTML/JS — gemeldet, aber nie automatisch geändert). */
  kind: "block" | "page" | "branding" | "code";
  page_id: string | null;
  page_title: string | null;
  block_id: string | null;
  block_type: string | null;
  field: string | null;
  count: number;
  /** false = gefunden, aber bewusst nicht ersetzbar. Die Oberfläche MUSS das
   *  benennen, statt „fertig" zu melden, während irgendwo die alte Adresse
   *  steht. */
  replaceable: boolean;
};

/** Wo wird dieses Bild verwendet? Der Gegenzustand zum Löschen (Wurzel 1). */
export async function mediumVerwendung(
  mediumId: string,
): Promise<Result<{ medium_id: string; items: MediaVerwendung[]; total: number }>> {
  return call(`/site-config/media/${mediumId}/usage`);
}

export type ErsetzenErgebnis = {
  medium_id: string;
  replacement_id: string;
  replaced: number;
  /** Fundstellen, die von Hand nachgezogen werden müssen (freies HTML/JS). */
  manual: number;
  items: MediaVerwendung[];
};

/** Ein Bild an ALLEN Verwendungsstellen austauschen.
 *
 *  Das alte Bild bleibt in der Mediathek — Tauschen und Löschen sind zwei
 *  Entscheidungen, und die zweite ist unumkehrbar. */
export async function replaceMedium(
  mediumId: string,
  ersatzId: string,
): Promise<Result<ErsetzenErgebnis>> {
  const res = await call<ErsetzenErgebnis>(
    `/site-config/media/${mediumId}/replace`,
    { method: "POST", body: { replacement_id: ersatzId } },
  );
  if (res.ok) touch();
  return res;
}

// --- Stock-Fotos ------------------------------------------------------------

export type StockAnbieter = {
  id: "pexels" | "unsplash";
  name: string;
  /** true = die Oberfläche MUSS den Bildnachweis anzeigen (Unsplash). */
  attribution_required: boolean;
  homepage: string;
  /** true = kostenpflichtig. Trennt „Kostenlose Bilder" von „Premium-Bilder";
   *  die zweite Gruppe ist heute leer (kein Anbieter scharf). */
  bezahlt: boolean;
};

export type StockFoto = {
  provider: "pexels" | "unsplash";
  external_id: string;
  thumb_url: string;
  full_url: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  credit_name: string;
  credit_url: string;
  provider_name: string;
  provider_url: string;
  attribution_required: boolean;
};

/** Welche Bildanbieter dieser Server anbietet.
 *
 *  Leere Liste heißt: keiner ist eingerichtet. Dann zeigt die Oberfläche gar
 *  keine Stock-Suche, statt eine anzubieten, die verlässlich scheitert
 *  (Wurzel 4). Shutterstock ist bewusst nicht dabei — bezahltes Abo und
 *  AGB-Erweiterung nötig. */
export async function listStockAnbieter(): Promise<
  Result<{ items: StockAnbieter[] }>
> {
  return call("/site-config/stock/providers");
}

/** Bildsuche über den serverseitigen Proxy.
 *
 *  Ein 429 heißt: das Kontingent des Anbieters ist für den Moment aufgebraucht.
 *  Das ist eine eigene Aussage und darf in der Oberfläche NICHT wie „nichts
 *  gefunden" aussehen. */
export async function sucheStockFotos(
  provider: string,
  begriff: string,
  seite = 1,
): Promise<
  Result<{ provider: string; items: StockFoto[]; page: number; has_more: boolean }>
> {
  const p = new URLSearchParams({
    provider,
    q: begriff,
    page: String(seite),
    per_page: "24",
  });
  return call(`/site-config/stock/search?${p.toString()}`);
}

/** Ein Stock-Foto in die Mediathek übernehmen.
 *
 *  Es gehen NUR Anbieter und Kennung hinaus; Bildadresse und Bildnachweis holt
 *  der Server frisch beim Anbieter. Bei Unsplash pingt er dabei
 *  `links.download_location` an — Vertragspflicht, kein Download. */
export async function uebernehmeStockFoto(
  provider: string,
  externalId: string,
  folderId: string | null = null,
): Promise<Result<Medium>> {
  const res = await call<Medium>("/site-config/stock/import", {
    method: "POST",
    body: { provider, external_id: externalId, folder_id: folderId },
  });
  if (res.ok) touch();
  return res;
}

// --- Symbole (0479) ---------------------------------------------------------

/** Ein Symbol aus der Bibliothek. `lizenz` steht schon im Treffer: unter
 *  welcher Lizenz ein Symbol steht, gehört VOR die Entscheidung, es zu
 *  benutzen. */
export type IconTreffer = {
  /** Kennung in der Form `satz:name`, z. B. `ph:house`. */
  icon: string;
  svg_url: string;
  satz: string;
  lizenz: string | null;
};

/** Symbolsuche über den serverseitigen Proxy.
 *
 *  Wie die Stock-Suche: der ausgehende Aufruf gehört auf den Server (Deckel,
 *  IP-Pinning, eigener Rate-Limit-Eimer). */
export async function sucheIcons(
  begriff: string,
  anzahl = 48,
): Promise<Result<{ items: IconTreffer[]; total: number }>> {
  const p = new URLSearchParams({ q: begriff, per_page: String(anzahl) });
  return call(`/site-config/icons/search?${p.toString()}`);
}

/** Ein Symbol in die Mediathek übernehmen.
 *
 *  Es geht NUR die Kennung hinaus; Adresse, Satzname und Lizenz holt der Server
 *  frisch bei der Bibliothek — ein aus dem Browser mitgeschickter „Nachweis"
 *  wäre ein Feld, in das der Client schreibt. */
export async function uebernehmeIcon(
  icon: string,
  folderId: string | null = null,
): Promise<Result<Medium>> {
  const res = await call<Medium>("/site-config/icons/import", {
    method: "POST",
    body: { icon, folder_id: folderId },
  });
  if (res.ok) touch();
  return res;
}
