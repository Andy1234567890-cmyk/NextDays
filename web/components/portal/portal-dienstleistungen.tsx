"use client";

// Eigentümer-Portal · Dienstleistungen buchen.
//
// Der Katalog kommt VOM SERVER (/public-portal/service-types): Endreinigung,
// Hauptreinigung, Fensterreinigung, Rasenmähen, Terrassenreinigung als
// Systemvorgaben plus eigene Typen des Betriebs. Die UI führt keine eigene
// Liste — ein neuer Typ im Katalog erscheint hier ohne Codeänderung (Wurzel 4).
// Der Anzeigename entsteht aus dem stabilen `key` über
// `portal.services.type.<key>`; fehlt ein Label, steht der Schlüssel da —
// sichtbar falsch statt still leer.
//
// Zusätzlich der Freitext-Weg: „Sonstiges" schaltet auf ein Textfeld um. Der
// Contract verlangt ENTWEDER `service_type_id` ODER `freitext` — nie beides,
// nie keines (sonst 422). Genau so schickt diese Fläche es.
//
// Doppelklick: der Knopf ist während des Sendens gesperrt; der echte Schutz
// liegt im Backend, das denselben Auftrag am selben Tag idempotent behandelt
// (Wurzel 2).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type PortalProperty,
  type ServiceRequest,
  type ServiceType,
  createServiceRequest,
} from "@/lib/portal";

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

function gueltigesDatum(s: string): boolean {
  if (!DATUM_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

// Wert im Auswahlfeld, der den Freitext-Weg öffnet. Kein Katalog-Typ trägt
// diesen Schlüssel (Katalog-Keys sind endreinigung, hauptreinigung, …).
const FREITEXT = "__freitext__";

const STATUS_KEYS: Record<string, string> = {
  pending: "services.status.pending",
  accepted: "services.status.accepted",
  scheduled: "services.status.scheduled",
  done: "services.status.done",
  rejected: "services.status.rejected",
  cancelled: "services.status.cancelled",
};

export function PortalDienstleistungen({
  properties,
  types,
  requests,
  error,
  typesError,
}: {
  properties: PortalProperty[];
  types: ServiceType[];
  requests: ServiceRequest[];
  error: string | null;
  typesError: string | null;
}) {
  const t = useTranslations("portal");

  const [liste, setListe] = useState<ServiceRequest[]>(requests);
  // Kein eigener Lade-Fehlerzustand mehr: die Liste wird ausschliesslich von
  // der Server-Komponente geladen (`error`), und der eigene neue Auftrag kommt
  // als Antwort des POST herein. Ein zweiter Fehlerkanal ohne Aufrufer waere
  // toter Code.
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [auswahl, setAuswahl] = useState<string>(types[0]?.id ?? FREITEXT);
  const [freitext, setFreitext] = useState("");
  const [datum, setDatum] = useState("");
  const [datumBis, setDatumBis] = useState("");
  const [notiz, setNotiz] = useState("");
  const [sendet, setSendet] = useState(false);

  const istFreitext = auswahl === FREITEXT;

  const senden = async () => {
    if (sendet || !propertyId) return;
    if (!gueltigesDatum(datum)) {
      toast.error(t("services.invalidDate"));
      return;
    }
    // Optionales Ende: gesetzt heißt gültig UND nicht vor dem Start.
    if (datumBis && (!gueltigesDatum(datumBis) || datumBis < datum)) {
      toast.error(t("services.invalidDate"));
      return;
    }
    if (istFreitext && !freitext.trim()) {
      toast.error(t("services.noteRequired"));
      return;
    }
    setSendet(true);
    // Genau EIN Weg wird gesetzt — der Contract lehnt beides/keines ab (422).
    const res = await createServiceRequest({
      property_id: propertyId,
      service_type_id: istFreitext ? null : auswahl,
      freitext: istFreitext ? freitext.trim() : null,
      datum,
      datum_bis: datumBis || null,
      notiz: notiz.trim() || null,
    });
    setSendet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("services.sent"));
    setFreitext("");
    setDatum("");
    setDatumBis("");
    setNotiz("");
    // Die ANTWORT ist der neue Auftrag — sie wird der Liste vorangestellt.
    // Vorher holte das `tasks`-Abo ihn herein; dieses Abo gibt es aus gutem
    // Grund nicht mehr (siehe unten beim Rendern). Kein Refetch: das ist die
    // eigene Antwort des Servers, sie ist bereits durch dieselbe Maske
    // gelaufen wie die Liste.
    setListe((alt) => [res.data, ...alt]);
  };

  /** Anzeigename eines Katalogtyps: Label aus dem Message-Katalog, sonst der
   *  Schlüssel selbst (sichtbar falsch statt still leer, Wurzel 4). */
  const typLabel = (key: string) =>
    t.has(`services.type.${key}`) ? t(`services.type.${key}`) : key;

  return (
    <div className="flex flex-col gap-6">
      {/* KEIN Realtime-Abo auf `tasks` (Wurzel 3/§4.3).
          `postgres_changes` liefert die VOLLE Zeile — inklusive `assignee_id`,
          also WER putzt. Genau dieses Feld laesst `ServiceRequestItem`
          bewusst weg: der Personaleinsatz des Betriebs geht den Eigentuemer
          nichts an, er erfaehrt nur, OB jemand dran ist (`zugewiesen`). Das
          Abo lieferte den Datensplit also am Serviceverlauf vorbei direkt aus
          der Datenbank — die RLS begrenzt es auf seine Objekte, aber nicht auf
          seine SPALTEN.
          Ersatz: der eigene neue Auftrag wird optimistisch eingefuegt (siehe
          `senden`). Fuer den STATUS-Wechsel durch den Betrieb gibt es keine
          erlaubte Quelle — er erscheint beim naechsten Laden der Seite. Das
          ist hier so benannt, statt ein Leck offen zu lassen oder eine stumme
          Attrappe hinzustellen. */}

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("services.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("services.hint")}</p>
      </header>

      {(error || typesError) && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? typesError}
        </div>
      )}

      {properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:house-line" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("properties.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dl-objekt">{t("services.property")}</Label>
                <NativeSelect
                  id="dl-objekt"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dl-art">{t("services.kind")}</Label>
                <NativeSelect
                  id="dl-art"
                  value={auswahl}
                  onChange={(e) => setAuswahl(e.target.value)}
                >
                  {types.map((typ) => (
                    <option key={typ.id} value={typ.id}>
                      {typLabel(typ.key)}
                    </option>
                  ))}
                  <option value={FREITEXT}>{t("services.kinds.custom")}</option>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dl-datum">{t("services.date")}</Label>
                <Input
                  id="dl-datum"
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dl-datum-bis">{t("services.dateTo")}</Label>
                <Input
                  id="dl-datum-bis"
                  type="date"
                  value={datumBis}
                  onChange={(e) => setDatumBis(e.target.value)}
                />
              </div>
            </div>

            {istFreitext && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dl-freitext">
                  {t("services.kinds.custom")}
                </Label>
                <Input
                  id="dl-freitext"
                  value={freitext}
                  placeholder={t("services.notePlaceholder")}
                  onChange={(e) => setFreitext(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dl-notiz">{t("services.note")}</Label>
              <Textarea
                id="dl-notiz"
                rows={3}
                value={notiz}
                placeholder={t("services.notePlaceholder")}
                onChange={(e) => setNotiz(e.target.value)}
              />
            </div>

            <div>
              <Button
                type="button"
                onClick={() => void senden()}
                disabled={sendet || !propertyId || !datum}
              >
                {sendet ? t("services.sending") : t("services.submit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">
          {t("services.listTitle")}
        </h2>

        {liste.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Icon icon="ph:broom" className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                {t("services.listEmpty")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
            {liste.map((r) => {
              const objekt = properties.find((p) => p.id === r.property_id);
              const statusKey = STATUS_KEYS[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-4 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon icon="ph:broom" className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {/* Katalog-Auftrag → übersetztes Label; Freitext-Auftrag
                          → der vom Eigentümer selbst gewählte Titel. */}
                      {r.service_key ? typLabel(r.service_key) : r.titel}
                      {r.start_at ? ` · ${r.start_at}` : ""}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {objekt?.title ?? r.property_id ?? ""}
                      {r.notiz ? ` · ${r.notiz}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                    {statusKey ? t(statusKey) : r.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
