"use client";

// Extra (Zusatzleistung) im Umfang des Branchenstandards, im Layout der
// Preise-Seite (live abgelesen 04.08.2026, Lodgify `/pricing/<id>/addon/<id>`):
//
//   Gilt für / Nicht unterstützt von · Betrag (Wert + Währung + zwei Achsen) ·
//   USt-Satz · Name und Beschreibung je Sprache · Foto · Sichtbarkeit
//
// WARUM DIESER EDITOR NEU IST: die Preise-Seite pflegte Extras bis 04.08.2026 in
// `type_attributes.pricing.addOns` — einem Blob, den NIEMAND gelesen hat. Nicht
// der Preis-Resolver, nicht die Buchungsstrecke, nicht die Rechnung. Der Betrieb
// legte „Wäschepaket 150 kr" an, und im Gast-Angebot stand es nie. Die echte
// Quelle ist `property_addons` (Migrationen 0074/0075, lib/addons.ts): sie wird
// vom Resolver gerechnet, auf der Buchungsstrecke verkauft, ins Gast-Portal
// gestellt und ins Owner-Statement gezogen. Dieser Editor pflegt sie.
//
// ZWEI ABWEICHUNGEN VOM STANDARD, jeweils mit Grund:
//   * Kein Prozent-Modus. `property_addons.price` ist ein Betrag; ein Prozentsatz
//     auf „den Aufenthalt" wäre bei einem dazugebuchten Frühstück ohnehin keine
//     sinnvolle Größe. Kein erfundenes Feld, das der Server verwirft (Wurzel 4).
//   * Statt „Einschränkungen" auf Kanäle: „erscheint in" (Buchungsstrecke ·
//     Gast-Portal · Check-in). Extras sind Sache der eigenen Strecken — Portale
//     haben für ein dazubuchbares Extra kein Feld. Die drei Flächen sind die
//     Achse, die es hier wirklich gibt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { PortalReichweite } from "@/components/objekte/pricing/portal-reichweite";
import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import {
  createAddon,
  updateAddon,
  uploadAddonMedia,
  type Addon,
  type AddonBasis,
  type AddonInput,
  type AddonSurface,
} from "@/lib/addons";
import type { AbgabePostenStatus } from "@/lib/channex";
import { currencySymbol, type Currency } from "@/lib/pricing-meta";
import { type Locale, LOCALES, LOCALE_LABELS } from "@/i18n/locales";

const BASEN: AddonBasis[] = ["per_stay", "per_night", "per_guest", "per_unit"];
const FLAECHEN: AddonSurface[] = ["booking_engine", "guest_portal", "checkin"];

export function ExtraEditor({
  propertyId,
  currency,
  vorhanden,
  /** Einsortierung am Ende der Liste — der Katalog ist sortierbar. */
  naechsteReihenfolge,
  status,
  portale,
  onSaved,
  onClose,
}: {
  propertyId: string;
  currency: Currency | "";
  /** Bestehendes Extra (Bearbeiten) oder `undefined` (Neu). */
  vorhanden?: Addon;
  naechsteReihenfolge: number;
  status: AbgabePostenStatus[] | null;
  portale: string[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");

  const [v, setV] = useState<AddonInput>(() =>
    vorhanden
      ? {
          name: { ...vorhanden.name },
          description: { ...vorhanden.description },
          media: [...vorhanden.media],
          price: vorhanden.price,
          basis: vorhanden.basis,
          mandatory: vorhanden.mandatory,
          appears_in: [...vorhanden.appears_in],
          available_until: vorhanden.available_until,
          tax_rate: vorhanden.tax_rate,
          active: vorhanden.active,
          sort_order: vorhanden.sort_order,
        }
      : {
          name: {},
          description: {},
          media: [],
          price: 0,
          basis: "per_stay",
          mandatory: false,
          appears_in: ["booking_engine", "guest_portal"],
          available_until: "anytime",
          tax_rate: null,
          active: true,
          sort_order: naechsteReihenfolge,
        },
  );
  const [sprache, setSprache] = useState<Locale>("de");
  // USt als eigener Schalter wie an der Gebühr: aus = das Extra folgt dem
  // Übernachtungssatz des Objekts (kein erfundener eigener Satz, Wurzel 4).
  const [ustAn, setUstAn] = useState<boolean>(v.tax_rate != null);
  const [fotoFehler, setFotoFehler] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);

  const { busy, error, run } = useSaver(speichern);

  async function speichern(): Promise<true | string> {
    const eingabe: AddonInput = {
      ...v,
      // Der Schalter ist die Wahrheit: aus heißt „kein eigener Satz", nicht
      // „Satz 0" — sonst stünde 0 % USt auf der Rechnung.
      tax_rate: ustAn ? (v.tax_rate ?? 0) : null,
    };
    const res = vorhanden
      ? await updateAddon(vorhanden.id, eingabe)
      : await createAddon(propertyId, eingabe);
    if (!res.ok) return res.error;
    onSaved();
    return true;
  }

  async function fotoWaehlen(file: File) {
    if (!vorhanden) return;
    setFotoBusy(true);
    setFotoFehler(null);
    const res = await uploadAddonMedia(vorhanden.id, file);
    setFotoBusy(false);
    if (!res.ok) {
      // Nicht verschlucken: ohne Meldung sähe der leere Rahmen wie „kein Foto
      // gewählt" aus, obwohl der Upload gescheitert ist (Wurzel 5).
      setFotoFehler(res.error);
      return;
    }
    setV((alt) => ({ ...alt, media: res.data.media }));
  }

  const setzeText = (feld: "name" | "description", text: string) =>
    setV((alt) => ({ ...alt, [feld]: { ...(alt[feld] ?? {}), [sprache]: text } }));

  const flaecheUmschalten = (flaeche: AddonSurface) =>
    setV((alt) => {
      const jetzt = alt.appears_in ?? [];
      return {
        ...alt,
        appears_in: jetzt.includes(flaeche)
          ? jetzt.filter((x) => x !== flaeche)
          : [...jetzt, flaeche],
      };
    });

  // Ein Extra ohne Namen ist in der Liste des Gastes eine leere Zeile. Geprüft
  // wird auf IRGENDEINE Sprache, nicht auf die gerade offene: wer nur Dänisch
  // pflegt, hat einen Namen.
  const hatNamen = Object.values(v.name ?? {}).some((x) => x.trim());
  const namenAnzahl = Object.values(v.name ?? {}).filter((x) => x.trim()).length;

  return (
    <EditorShell
      title={vorhanden ? t("pricingForm.extraEditTitle") : t("pricingForm.extraAddTitle")}
      subtitle={t("pricingForm.extrasHint")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => void run()}
          disabled={!hatNamen}
        />
      }
    >
      <PortalReichweite schluessel="addons" status={status} portale={portale} />

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.amountSectionTitle")}
        </h3>
        <Field label={t("pricingForm.amountLabel")} required>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={v.price ?? 0}
              onChange={(e) => setV({ ...v, price: Number(e.target.value) || 0 })}
            />
            {/* Währung kommt aus dem Objekt, ist hier keine Wahl. Ohne gewählte
                Objektwährung bleibt die Fläche leer statt „€". */}
            <span className="min-w-8 text-sm text-muted-foreground">
              {currencySymbol(currency)}
            </span>
          </div>
        </Field>
        <Field label={t("pricingForm.calculationLabel")}>
          <Select
            value={v.basis ?? "per_stay"}
            onValueChange={(val) => setV({ ...v, basis: val as AddonBasis })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASEN.map((b) => (
                <SelectItem key={b} value={b}>
                  {t(`pricingForm.extraBasis.${b}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="font-display text-lg font-extrabold">
            {t("pricingForm.vatLabel")}
          </span>
          <Switch
            checked={ustAn}
            onCheckedChange={(c) => {
              setUstAn(c);
              if (!c) setV({ ...v, tax_rate: null });
            }}
          />
        </label>
        {ustAn && (
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={v.tax_rate ?? 0}
              onChange={(e) =>
                setV({
                  ...v,
                  tax_rate: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                })
              }
              className="pr-8"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.guestFacingNameTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.guestFacingNameHint")}
        </p>
        {/* 24 EU-Amtssprachen (i18n/locales.ts) als Dropdown statt 24
            Schaltflächen — dieselbe Form wie im Steuer-Editor. Gepflegte
            Sprachen bekommen ein Häkchen. */}
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                {LOCALE_LABELS[sprache]}
                <Icon icon="ph:caret-down" className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {LOCALES.map((l) => (
                <DropdownMenuItem key={l} onClick={() => setSprache(l)}>
                  {LOCALE_LABELS[l]}
                  {v.name?.[l]?.trim() && (
                    <Icon icon="ph:check" className="ml-auto size-4 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs text-muted-foreground">
            {t("pricingForm.languagesFilled", {
              count: namenAnzahl,
              total: LOCALES.length,
            })}
          </span>
        </div>
        <Field label={t("pricingForm.nameLabel")} required>
          <Input
            value={v.name?.[sprache] ?? ""}
            placeholder={t("pricingForm.extraNamePlaceholder")}
            onChange={(e) => setzeText("name", e.target.value)}
          />
        </Field>
        <Field label={t("pricingForm.extraDescriptionLabel")}>
          <Textarea
            value={v.description?.[sprache] ?? ""}
            onChange={(e) => setzeText("description", e.target.value)}
          />
        </Field>
      </section>

      <Field label={t("pricingForm.extraPhotoLabel")} hint={t("pricingForm.extraPhotoHint")}>
        <div className="flex flex-wrap items-center gap-2">
          {(v.media ?? []).map((url) => (
            <span
              key={url}
              className="size-16 overflow-hidden rounded-(--radius) bg-secondary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </span>
          ))}
          {/* Der Upload braucht die Kennung des Extras (er schreibt direkt an
              `property_addons`). Solange es die nicht gibt, steht hier der
              Grund — ein toter Knopf wäre die schlechtere Auskunft. */}
          {vorhanden ? (
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-(--radius) border border-dashed text-muted-foreground hover:text-foreground">
              <Icon
                icon={fotoBusy ? "ph:circle-notch" : "ph:plus"}
                className={fotoBusy ? "size-5 animate-spin" : "size-5"}
              />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void fotoWaehlen(file);
                }}
              />
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("pricingForm.extraPhotoAfterSave")}
            </span>
          )}
        </div>
      </Field>
      {fotoFehler && (
        <p role="alert" className="text-sm text-destructive">
          {fotoFehler}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.extraSurfacesTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.extraSurfacesHint")}
        </p>
        <div className="flex flex-col gap-2">
          {FLAECHEN.map((f) => (
            <label key={f} className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={(v.appears_in ?? []).includes(f)}
                onCheckedChange={() => flaecheUmschalten(f)}
              />
              <span>{t(`pricingForm.extraSurface.${f}`)}</span>
            </label>
          ))}
        </div>
        {/* Ohne Fläche ist das Extra nirgends kaufbar. Das kann Absicht sein
            (Vorbereitung), sieht aber wie ein fertiges Extra aus — deshalb der
            Hinweis, statt es stillschweigend zu speichern. */}
        {(v.appears_in ?? []).length === 0 && (
          <Hint>{t("pricingForm.extraNoSurfaceHint")}</Hint>
        )}
        <Field label={t("pricingForm.extraAvailableUntilLabel")}>
          <Select
            value={v.available_until ?? "anytime"}
            onValueChange={(val) =>
              setV({ ...v, available_until: val as Addon["available_until"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anytime">
                {t("pricingForm.extraAvailability.anytime")}
              </SelectItem>
              <SelectItem value="before_checkin">
                {t("pricingForm.extraAvailability.before_checkin")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </section>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.extraMandatoryLabel")}</span>
        <Switch
          checked={v.mandatory ?? false}
          onCheckedChange={(c) => setV({ ...v, mandatory: c })}
        />
      </label>
      {v.mandatory && <Hint>{t("pricingForm.extraMandatoryHint")}</Hint>}

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.activated")}</span>
        <Switch
          checked={v.active ?? true}
          onCheckedChange={(c) => setV({ ...v, active: c })}
        />
      </label>
    </EditorShell>
  );
}
