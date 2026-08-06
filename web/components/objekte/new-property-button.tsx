"use client";

// „Neues Objekt"-Button + Anlage-Sheet.
//
// Zwei Schritte statt einem: erst die Kernfelder (Name, Typ, Gäste), dann die
// Vertriebskanäle. Der zweite Schritt existiert, weil beim Anlegen die
// wichtigste Frage unbeantwortet blieb — WO soll das Objekt verkauft werden und
// was braucht jedes Portal dafür? Jedes Feld trägt seine Kanal-Kennzeichnung
// (lib/kanal-felder.ts), die Kanalauswahl schaltet die drei vorhandenen Achsen
// (Portale / eigene Plattform / eigene Website) — es gibt keine vierte.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { ChannelBadge } from "@nextdays/ui/channel-badge";
import { usePropertyLabels } from "@/lib/use-property-labels";
import { createProperty, type PropertyType } from "@/lib/properties";
import { useKanalZeilen } from "@/lib/use-kanal-felder";

export function NewPropertyButton({
  accommodationType,
}: {
  // Betriebsart (0090): Hotel legt ZIMMER an (Zimmertypen), Ferienvermietung
  // Ferienobjekte — Liste und Wortlaut passen sich an.
  accommodationType?: "vacation_rental" | "hotel" | null;
}) {
  const t = useTranslations("objects");
  const router = useRouter();
  const isHotel = accommodationType === "hotel";
  const { typeOptionsFor } = usePropertyLabels();
  const typeOptions = typeOptionsFor(accommodationType);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PropertyType>(
    isHotel ? "doppelzimmer" : "ferienhaus",
  );
  const [guests, setGuests] = useState(2);
  const [schritt, setSchritt] = useState<1 | 2>(1);
  // Vertriebskanäle: dieselben drei Achsen wie am fertigen Objekt. Portale sind
  // beim Anlegen aus, weil ein Objekt ohne Preis, Fotos und Richtlinien dort
  // nichts verloren hat — der zweite Schritt sagt, was noch fehlt.
  const [portale, setPortale] = useState(false);
  const [plattform, setPlattform] = useState(true);
  const [website, setWebsite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 409 = Stripe-Konto noch nicht freigeschaltet → Hinweis + Weg zur Einrichtung.
  const [needsPayments, setNeedsPayments] = useState(false);
  const titelKanaele = useKanalZeilen("titel");
  const typKanaele = useKanalZeilen("objekttyp");
  const belegungKanaele = useKanalZeilen("belegung");

  async function save() {
    setBusy(true);
    setError(null);
    setNeedsPayments(false);
    const res = await createProperty({
      title,
      property_type: type,
      max_guests: guests,
      listed_on_marketplace: plattform,
      listed_on_website: website,
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setTitle("");
      setSchritt(1);
      router.push(`/objekte/${res.data.id}`);
      router.refresh();
    } else {
      setError(res.error);
      if (res.status === 409) setNeedsPayments(true);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Icon icon="ph:plus" className="size-4" />
        {isHotel ? t("newPropertyButton.newRoom") : t("newPropertyButton.newProperty")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl font-extrabold">
              {isHotel ? t("newPropertyButton.newRoom") : t("newPropertyButton.newProperty")}
            </SheetTitle>
            <SheetDescription>
              {t("newPropertyButton.sheetDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {/* Schrittanzeige — zwei Schritte, kein Fortschrittsbalken für zwei. */}
            <p className="text-xs font-medium text-muted-foreground">
              {t("newPropertyButton.stepOf", { schritt, gesamt: 2 })}
            </p>

            {schritt === 1 ? (
              <>
            <div className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <Label htmlFor="title">{t("newPropertyButton.nameLabel")}</Label>
                <ChannelBadge kanaele={titelKanaele} />
              </span>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isHotel
                    ? t("newPropertyButton.namePlaceholderHotel")
                    : t("newPropertyButton.namePlaceholderVacationRental")
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <Label>{t("newPropertyButton.typeLabel")}</Label>
                <ChannelBadge kanaele={typKanaele} />
              </span>
              <Select
                value={type}
                onValueChange={(v) => setType(v as PropertyType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <Label htmlFor="guests">
                  {t("newPropertyButton.maxGuestsLabel")}
                </Label>
                <ChannelBadge kanaele={belegungKanaele} />
              </span>
              <Input
                id="guests"
                type="number"
                min={1}
                max={99}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value) || 1)}
              />
            </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {t("newPropertyButton.channelsHint")}
                </p>

                <KanalSchalter
                  an={portale}
                  setzen={setPortale}
                  titel={t("newPropertyButton.channelPortals")}
                  beschreibung={t("newPropertyButton.channelPortalsHint")}
                  icon="ph:globe-hemisphere-west"
                />
                <KanalSchalter
                  an={plattform}
                  setzen={setPlattform}
                  titel={t("newPropertyButton.channelPlatform")}
                  beschreibung={t("newPropertyButton.channelPlatformHint")}
                  icon="ph:buildings"
                />
                <KanalSchalter
                  an={website}
                  setzen={setWebsite}
                  titel={t("newPropertyButton.channelWebsite")}
                  beschreibung={t("newPropertyButton.channelWebsiteHint")}
                  icon="ph:browser"
                />

                {portale ? (
                  <div className="flex flex-col gap-2 rounded-(--radius) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <span className="flex items-start gap-2 font-medium">
                      <Icon
                        icon="ph:warning-circle"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      {t("newPropertyButton.readinessTitle")}
                    </span>
                    <ul className="ml-6 flex list-disc flex-col gap-1">
                      {[
                        "readinessPhotos",
                        "readinessPrice",
                        "readinessAddress",
                        "readinessPolicies",
                        "readinessCancellation",
                      ].map((k) => (
                        <li key={k}>{t(`newPropertyButton.${k}`)}</li>
                      ))}
                    </ul>
                    <span className="text-xs">
                      {t("newPropertyButton.readinessFooter")}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
            {error && !needsPayments && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {needsPayments ? (
              <div className="flex flex-col gap-3 rounded-(--radius) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <span className="flex items-start gap-2">
                  <Icon icon="ph:warning-circle" className="mt-0.5 size-4 shrink-0" />
                  {error}
                </span>
                <Button
                  variant="outline"
                  className="self-start gap-2"
                  onClick={() => {
                    setOpen(false);
                    router.push("/konto");
                  }}
                >
                  <Icon icon="ph:credit-card" className="size-4" />
                  {t("newPropertyButton.setUpPayments")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {schritt === 2 ? (
                  <Button variant="outline" onClick={() => setSchritt(1)}>
                    {t("newPropertyButton.back")}
                  </Button>
                ) : null}
                {schritt === 1 ? (
                  <Button onClick={() => setSchritt(2)} disabled={!title.trim()}>
                    {t("newPropertyButton.next")}
                  </Button>
                ) : (
                  <Button onClick={save} disabled={busy || !title.trim()}>
                    {busy
                      ? t("newPropertyButton.creating")
                      : isHotel
                        ? t("newPropertyButton.createRoom")
                        : t("newPropertyButton.createProperty")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Ein Vertriebskanal als Zeile mit Schalter. */
function KanalSchalter({
  an,
  setzen,
  titel,
  beschreibung,
  icon,
}: {
  an: boolean;
  setzen: (wert: boolean) => void;
  titel: string;
  beschreibung: string;
  icon: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-(--radius) border p-3">
      <input
        type="checkbox"
        checked={an}
        onChange={(e) => setzen(e.target.checked)}
        className="mt-1 size-4"
      />
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 font-medium">
          <Icon icon={icon} className="size-4 text-muted-foreground" />
          {titel}
        </span>
        <span className="text-xs text-muted-foreground">{beschreibung}</span>
      </span>
    </label>
  );
}
