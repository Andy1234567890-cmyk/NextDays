"use client";

// Portal-Abzugssätze: was jedes Vertriebsportal je Buchung einbehält.
//
// WARUM ZWEI SÄTZE UND NICHT EINER:
// Booking.com erhebt ZWEI getrennte Abzüge — 15 % Vermittlungsprovision plus
// 1,5 % Zahlungsgebühr, zusammen die 16,5 %, mit denen die Buchhaltung rechnet.
// Airbnb erhebt nur die Provision (15,5 %) und keine Zahlungsgebühr. Ein
// zusammengefasstes Feld wäre in der Abrechnung nicht nachvollziehbar: der
// Betrieb sieht in seiner Portal-Abrechnung beide Posten getrennt.
//
// WARUM DIE ZAHLUNGSGEBÜHR LEER BLEIBEN DARF:
// „erhebt keine" (Airbnb) ist ein anderer Zustand als „0 % vereinbart". Ein
// Feld mit Pflicht-0 hätte beides gleich aussehen lassen (Wurzel 4).
//
// WARUM HISTORIE STATT „DER AKTUELLE SATZ":
// Portale ändern ihre Sätze. Eine Abrechnung für den Juli muss mit dem
// Juli-Satz rechnen, egal wann sie erzeugt wird — sonst ergäbe dieselbe
// Abrechnung je Erzeugungstag eine andere Zahl. Eine Ablösung ist deshalb ein
// NEUER Satz ab Datum X, kein Überschreiben des alten; „Bearbeiten" ist für den
// Tippfehler.
//
// WO DIE ZAHL WIRKT: nur dort, wo das Portal seine Provision NICHT mitmeldet.
// Zieht das Portal das Geld ein (`payment_collect='ota'`), gilt der gemeldete
// Betrag — er ist die Tatsache, der Satz nur unsere Rekonstruktion.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLabelLoose, channelLogoLoose } from "@/lib/channel-logos";
import {
  createPortalAbzugssatz,
  deletePortalAbzugssatz,
  listPortalAbzugssaetze,
  updatePortalAbzugssatz,
  type PortalAbzugssatz,
} from "@/lib/owner-billing";
import { formatDate } from "@/lib/utils";

/**
 * Kanäle, für die ein Satz gepflegt werden kann.
 *
 * Bewusst die Schreibweise von `reservations.channel` (klein), damit die
 * Rechenkette ohne Übersetzungstabelle zuordnet. Die Anzeige holt Label und
 * Logo über die zentralen Helfer — keine zweite Liste mit Marken-Namen.
 */
const KANAELE = [
  "booking",
  "airbnb",
  "expedia",
  "vrbo",
  "agoda",
  "hostelworld",
  "tripcom",
] as const;

type FormState = {
  kanal: string;
  provision_pct: string;
  zahlungsgebuehr_pct: string;
  gueltig_ab: string;
  gueltig_bis: string;
  notiz: string;
};

function leeresFormular(heute: string): FormState {
  return {
    kanal: "booking",
    // KEIN Vorschlagswert: eine vorbelegte Zahl sähe in der Maske aus wie eine
    // Vereinbarung, die niemand getroffen hat (Wurzel 4).
    provision_pct: "",
    zahlungsgebuehr_pct: "",
    gueltig_ab: heute,
    gueltig_bis: "",
    notiz: "",
  };
}

function ausSatz(s: PortalAbzugssatz): FormState {
  return {
    kanal: s.kanal,
    provision_pct: String(s.provision_pct),
    zahlungsgebuehr_pct:
      s.zahlungsgebuehr_pct != null ? String(s.zahlungsgebuehr_pct) : "",
    gueltig_ab: s.gueltig_ab,
    gueltig_bis: s.gueltig_bis ?? "",
    notiz: s.notiz ?? "",
  };
}

export function PortalAbzugssaetze() {
  const t = useTranslations("portalSaetze");
  const locale = useLocale();
  const [items, setItems] = useState<PortalAbzugssatz[]>([]);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await listPortalAbzugssaetze();
    setLaedt(false);
    if (res.ok) {
      setItems(res.data.items);
      setLadefehler(null);
      return;
    }
    // Kein `?? []`: eine leere Liste wäre die Aussage „es gibt keine Sätze" —
    // eine andere Tatsache als „konnte nicht geladen werden".
    setLadefehler(res.error);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function speichern() {
    if (!form) return;
    const provision = Number(form.provision_pct);
    if (!form.provision_pct.trim() || Number.isNaN(provision)) {
      setFehler(t("errorProvisionRequired"));
      return;
    }
    setBusy(true);
    setFehler(null);
    // Leeres Feld → null, nicht 0: „erhebt keine Zahlungsgebühr" ist etwas
    // anderes als „0 % vereinbart".
    const gebuehr = form.zahlungsgebuehr_pct.trim()
      ? Number(form.zahlungsgebuehr_pct)
      : null;
    const res = editId
      ? await updatePortalAbzugssatz(editId, {
          provision_pct: provision,
          ...(gebuehr == null
            ? { ohne_zahlungsgebuehr: true }
            : { zahlungsgebuehr_pct: gebuehr }),
          gueltig_ab: form.gueltig_ab,
          ...(form.gueltig_bis.trim()
            ? { gueltig_bis: form.gueltig_bis }
            : { ohne_gueltig_bis: true }),
          notiz: form.notiz.trim() || null,
        })
      : await createPortalAbzugssatz({
          kanal: form.kanal,
          provision_pct: provision,
          zahlungsgebuehr_pct: gebuehr,
          gueltig_ab: form.gueltig_ab,
          gueltig_bis: form.gueltig_bis.trim() || null,
          notiz: form.notiz.trim() || null,
        });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    toast.success(editId ? t("saved") : t("created"));
    setForm(null);
    setEditId(null);
    await laden();
  }

  async function loeschen(satz: PortalAbzugssatz) {
    const res = await deletePortalAbzugssatz(satz.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("deleted"));
    await laden();
  }

  const heute = new Date().toISOString().slice(0, 10);

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-extrabold">{t("title")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("intro")}
          </p>
        </div>
        {form === null && (
          <Button
            onClick={() => {
              setForm(leeresFormular(heute));
              setEditId(null);
              setFehler(null);
            }}
          >
            <Icon icon="ph:plus" className="size-4" />
            {t("add")}
          </Button>
        )}
      </div>

      {ladefehler && (
        <p className="text-sm text-destructive">{ladefehler}</p>
      )}

      {form !== null && (
        <div className="flex flex-col gap-4 rounded-(--radius) border border-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("channel")}</span>
              <NativeSelect
                value={form.kanal}
                disabled={editId !== null}
                onChange={(e) => set("kanal", e.target.value)}
              >
                {KANAELE.map((k) => (
                  <option key={k} value={k}>
                    {channelLabelLoose(k) || k}
                  </option>
                ))}
              </NativeSelect>
              {editId !== null && (
                <span className="text-xs text-muted-foreground">
                  {t("channelLocked")}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {t("provision")}
                <InfoHinweis
                  text={t("provisionInfo")}
                  ariaLabel={t("provision")}
                />
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.provision_pct}
                onChange={(e) => set("provision_pct", e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {t("payoutFee")}
                <InfoHinweis
                  text={t("payoutFeeInfo")}
                  ariaLabel={t("payoutFee")}
                />
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                placeholder={t("payoutFeeNone")}
                value={form.zahlungsgebuehr_pct}
                onChange={(e) => set("zahlungsgebuehr_pct", e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("validFrom")}</span>
              <Input
                type="date"
                value={form.gueltig_ab}
                onChange={(e) => set("gueltig_ab", e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {t("validTo")}
                <InfoHinweis text={t("validToInfo")} ariaLabel={t("validTo")} />
              </span>
              <Input
                type="date"
                placeholder={t("validToOpen")}
                value={form.gueltig_bis}
                onChange={(e) => set("gueltig_bis", e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium">{t("note")}</span>
              <Input
                value={form.notiz}
                placeholder={t("notePlaceholder")}
                onChange={(e) => set("notiz", e.target.value)}
              />
            </label>
          </div>

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void speichern()} disabled={busy}>
              {busy && (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              )}
              {editId ? t("save") : t("create")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setForm(null);
                setEditId(null);
                setFehler(null);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {laedt ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : items.length === 0 && !ladefehler ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((s) => {
            const logo = channelLogoLoose(s.kanal);
            const label = channelLabelLoose(s.kanal) || s.kanal;
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-(--radius) border border-border p-3"
              >
                <span className="flex min-w-32 items-center gap-2">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt={label}
                      // Wortmarken, keine quadratischen Icons — Höhe vorgeben,
                      // Breite mitlaufen lassen.
                      className="h-4 w-auto max-w-20 shrink-0"
                    />
                  ) : (
                    <span className="text-sm font-medium">{label}</span>
                  )}
                </span>

                <span className="flex flex-col text-sm">
                  <span className="font-semibold">
                    {t("total", { pct: s.gesamt_pct })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.zahlungsgebuehr_pct != null
                      ? t("breakdown", {
                          provision: s.provision_pct,
                          fee: s.zahlungsgebuehr_pct,
                        })
                      : t("breakdownNoFee", { provision: s.provision_pct })}
                  </span>
                </span>

                <span className="flex flex-col text-xs text-muted-foreground">
                  <span>
                    {s.gueltig_bis
                      ? t("period", {
                          von: formatDate(s.gueltig_ab, locale),
                          bis: formatDate(s.gueltig_bis, locale),
                        })
                      : t("periodOpen", {
                          von: formatDate(s.gueltig_ab, locale),
                        })}
                  </span>
                  {s.notiz && <span>{s.notiz}</span>}
                </span>

                {s.aktuell && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {t("current")}
                  </span>
                )}

                <span className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("edit")}
                    onClick={() => {
                      setForm(ausSatz(s));
                      setEditId(s.id);
                      setFehler(null);
                    }}
                  >
                    <Icon icon="ph:pencil-simple" className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("delete")}
                    onClick={() => void loeschen(s)}
                  >
                    <Icon icon="ph:trash" className="size-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
