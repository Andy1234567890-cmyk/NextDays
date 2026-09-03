"use client";

// Gästeliste mit Suche + Filtern (gesperrt/unvollständig). Zeilen verlinken auf
// die Gästekarte. Felder sind serverseitig maskiert — wir rendern nur, was
// kommt (null → „—"). Neuanlage öffnet einen schlanken Dialog.
//
// UNVOLLSTÄNDIGE GÄSTE: Airbnb liefert über Channex nie einen Gastnamen. Weil
// `guests.name` NOT NULL ist, steht dort wörtlich „—". Beim Beta-Betrieb waren
// das 150 von 293 Zeilen — die Kartei sah dadurch komplett leer aus, obwohl 143
// Gäste gepflegt waren (30.08.2026).
//
// Statt des nackten Strichs zeigt die Zeile jetzt den GRUND und die
// Buchungsherkunft: „Airbnb-Gast · Feriehus Line · 02.08.2026". Ein namenloser
// Gast ist nicht identitätslos — an Objekt und Anreise erkennt der Betrieb ihn
// wieder. Airbnb macht es im eigenen Kalender genauso.
//
// Erfunden wird dabei nichts (Wurzel 4): fehlt auch der Buchungsbezug, bleibt
// es beim Strich mit dem Hinweis „ohne Namen".
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import type { GuestAccess } from "@/lib/guests-access";
import { channelLabel, channelLogo } from "@/lib/channel-logos";
import { GuestDuplicates } from "@/components/gaeste/guest-duplicates";
import { type GuestListItem, createGuest, listGuests } from "@/lib/guests";

/** Zeilen je Seite. Muss zum `limit` der Server-Komponente (gaeste/page.tsx)
 *  passen, sonst stimmt die erste Seite nicht mit den nachgeladenen überein. */
const SEITENGROESSE = 50;

export function GuestsList({
  guests,
  total,
  error,
  access,
}: {
  guests: GuestListItem[];
  total: number;
  error: string | null;
  access: GuestAccess;
}) {
  const t = useTranslations("guests");
  const router = useRouter();
  const [rows, setRows] = useState<GuestListItem[]>(guests);
  const [gesamt, setGesamt] = useState(total);
  const [q, setQ] = useState("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [showNew, setShowNew] = useState(false);
  // Angezeigte Seite (0-basiert). Der Server liefert `total` mit, daraus ergibt
  // sich die Seitenzahl — kein Raten am Ende der Liste.
  const [seite, setSeite] = useState(0);
  const [pending, start] = useTransition();

  // Realtime-Pflicht: RealtimeRefresh (gaeste/page.tsx) löst router.refresh()
  // aus → neue, serverseitig maskierte guests-Props. Den lokalen State damit
  // synchronisieren, sonst zeigt die Tabelle bis zur nächsten Suche alte Daten.
  useEffect(() => {
    setRows(guests);
    setGesamt(total);
  }, [guests, total]);

  const reload = (opts: {
    q?: string;
    blocked?: boolean;
    needsReview?: boolean;
    seite?: number;
  }) =>
    start(async () => {
      const ziel = opts.seite ?? 0;
      const res = await listGuests({
        ...opts,
        limit: SEITENGROESSE,
        offset: ziel * SEITENGROESSE,
      });
      if (res.ok) {
        setRows(res.data.items);
        // `total` ist die Gesamtzahl der TREFFER, nicht der geladenen Zeilen —
        // die Blätter-Leiste muss sich nach dem Filtern mitverkleinern.
        setGesamt(res.data.total);
        setSeite(ziel);
      }
    });

  // Ein Ort für den aktuellen Filterstand: sonst vergisst jeder neue Auslöser
  // (Suchknopf, Enter, eine zweite Checkbox) irgendeinen Teil und setzt ihn
  // still zurück.
  const filterStand = (
    aenderung: {
      blocked?: boolean;
      needsReview?: boolean;
      seite?: number;
    } = {},
  ) => ({
    q: q || undefined,
    blocked: (aenderung.blocked ?? onlyBlocked) || undefined,
    needsReview: (aenderung.needsReview ?? onlyIncomplete) || undefined,
    // Ohne `seite` heisst jede Filter-/Suchaenderung: zurueck auf Seite 1.
    // Sonst stünde man nach dem Filtern auf Seite 7 einer dreiseitigen
    // Treffermenge und die Tabelle wäre leer.
    seite: aenderung.seite ?? 0,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("count", { count: gesamt })}
          </p>
        </div>
        {access.canEdit && (
          <Button type="button" onClick={() => setShowNew(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("new")}
          </Button>
        )}
      </div>

      {/* Dubletten-Vorschlag: erscheint nur, wenn es welche gibt. Über der
          Suche, weil er den Bestand betrifft und nicht die aktuelle Sicht. */}
      <GuestDuplicates
        canEdit={access.canEdit}
        onMerged={() => reload(filterStand({ seite }))}
      />

      {/* Suche + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-60">
          <Icon
            icon="ph:magnifying-glass"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reload(filterStand())}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <label className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={onlyBlocked}
            onChange={(e) => {
              setOnlyBlocked(e.target.checked);
              reload(filterStand({ blocked: e.target.checked }));
            }}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t("filterBlocked")}
        </label>
        {/* Filter „Unvollständig": der Weg zur gezielten Nachpflege. Ohne ihn
            liegen die namenlosen Gäste zwar hinten, sind aber nur durch
            Blättern erreichbar. */}
        <label className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={onlyIncomplete}
            onChange={(e) => {
              setOnlyIncomplete(e.target.checked);
              reload(filterStand({ needsReview: e.target.checked }));
            }}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t("filterIncomplete")}
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => reload(filterStand())}
          disabled={pending}
        >
          {t("search")}
        </Button>
      </div>

      {error && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Tabelle */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t("colName")}</th>
              {access.contact && <th className="px-4 py-2 font-medium">{t("colContact")}</th>}
              <th className="px-4 py-2 font-medium">{t("colCompany")}</th>
              <th className="px-4 py-2 font-medium">{t("colVip")}</th>
              <th className="px-4 py-2 font-medium">{t("colStays")}</th>
              <th className="px-4 py-2 font-medium">{t("colLastStay")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => router.push(`/gaeste/${g.id}`)}
                  className="cursor-pointer border-t border-border hover:bg-muted/30"
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      {g.is_blocked && (
                        <Icon icon="ph:prohibit" className="size-4 text-destructive" />
                      )}
                      <GastName g={g} />
                    </span>
                  </td>
                  {access.contact && (
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {g.email ?? g.phone ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-muted-foreground">{g.company ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {g.vip_code ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {g.vip_code}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.stays_count}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {g.last_stay_at ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Blaetterleiste
        seite={seite}
        gesamt={gesamt}
        geladen={rows.length}
        pending={pending}
        onSeite={(z) => reload(filterStand({ seite: z }))}
      />

      {showNew && (
        <NewGuestDialog
          onClose={() => setShowNew(false)}
          onCreated={(id) => router.push(`/gaeste/${id}`)}
        />
      )}
    </div>
  );
}

/** Blättern durch die Gästeliste.
 *
 *  WARUM ES DAS BRAUCHT: Der Server begrenzt die Liste auf `limit` Zeilen
 *  (Wurzel 8), im Frontend wurde `offset` aber nie gesetzt. Bei 510 Gästen sah
 *  der Betrieb dauerhaft die ersten 50 — die anderen 460 waren nur über die
 *  Suche erreichbar, und wer den Namen nicht kannte, kam nicht an sie heran.
 *
 *  Die Seitenzahl kommt aus `total` (der Server zählt exakt, `count="exact"`),
 *  nicht aus „sind es genau `limit` Zeilen?" — das wäre auf der letzten,
 *  vollen Seite falsch.
 */
function Blaetterleiste({
  seite,
  gesamt,
  geladen,
  pending,
  onSeite,
}: {
  seite: number;
  gesamt: number;
  geladen: number;
  pending: boolean;
  onSeite: (seite: number) => void;
}) {
  const t = useTranslations("guests");
  const seiten = Math.max(1, Math.ceil(gesamt / SEITENGROESSE));
  // Eine einzige Seite braucht keine Leiste.
  if (seiten <= 1) return null;

  const von = seite * SEITENGROESSE + 1;
  const bis = seite * SEITENGROESSE + geladen;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {t("pageRange", { from: von, to: bis, total: gesamt })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSeite(seite - 1)}
          disabled={pending || seite === 0}
        >
          <Icon icon="ph:caret-left" className="size-4" />
          {t("prevPage")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("pageOf", { page: seite + 1, pages: seiten })}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => onSeite(seite + 1)}
          disabled={pending || seite + 1 >= seiten}
        >
          {t("nextPage")}
          <Icon icon="ph:caret-right" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Name einer Gästezeile — oder, wenn keiner geliefert wurde, der Grund.
 *
 *  Der Betrieb soll nicht raten, warum eine Zeile leer ist. Drei Stufen, je
 *  nachdem, was tatsächlich vorliegt (nichts davon wird erfunden, Wurzel 4):
 *
 *  1. echter Name              → er allein
 *  2. kein Name, aber Buchung  → „Airbnb-Gast" + Objekt + Anreise
 *  3. gar nichts               → „—" mit dem Hinweis „ohne Namen"
 */
function GastName({ g }: { g: GuestListItem }) {
  const t = useTranslations("guests");
  const format = useFormatter();

  // Der Server liefert bei unvollständigen Gästen den Strich als Namen, weil
  // `guests.name` NOT NULL ist. Für die Anzeige zählt das nicht als Name.
  const echterName = !g.needs_review && g.name && g.name.trim() !== "—";
  if (echterName) return <>{g.name}</>;

  const logo = g.letzter_kanal ? channelLogo(g.letzter_kanal) : null;
  const kanal = g.letzter_kanal ? channelLabel(g.letzter_kanal) : null;
  const anreise = g.letzte_anreise
    ? format.dateTime(new Date(g.letzte_anreise), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;
  // Nur die Teile, die es wirklich gibt — sonst stünden dort leere Trenner.
  const bezug = [g.letztes_objekt, anreise].filter(Boolean).join(" · ");

  return (
    <span className="flex min-w-0 items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Kanal-Logos sind
        // lokale, feste Dateien (lib/channel-logos); next/image brächte hier nur
        // Layout-Overhead für ein 16px-Symbol.
        <img src={logo} alt="" className="size-4 shrink-0 rounded-[0.1875rem]" />
      ) : (
        <Icon
          icon="ph:user-circle-dashed"
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0">
        <span className="block truncate text-muted-foreground italic">
          {kanal ? t("unnamedFromChannel", { channel: kanal }) : t("unnamed")}
        </span>
        {bezug && (
          <span className="block truncate text-xs text-muted-foreground/70">
            {bezug}
          </span>
        )}
      </span>
    </span>
  );
}

function NewGuestDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("guests");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await createGuest({
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
      });
      if (res.ok) onCreated(res.data.id);
      else setError(res.error);
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t("newTitle")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}>
            <Icon icon="ph:x" className="size-5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label={t("firstName")} value={firstName} onChange={setFirstName} />
          <Field label={t("lastName")} value={lastName} onChange={setLastName} />
          <Field label={t("email")} value={email} onChange={setEmail} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {t("create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-(--radius) border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent/40"
      />
    </label>
  );
}
