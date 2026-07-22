"use client";

// „Neues Objekt anlegen" (Grunddaten). Legt ein Draft-Objekt an (POST /properties)
// und leitet zur Objekt-Detailseite, wo Fotos/Preise/Publish folgen. Währung wird
// aus dem Land abgeleitet (currencyForCountry) — kein €-Hardcode (Wurzel 4).
import { currencyForCountry, LAENDER } from "@nextdays/laender";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";

import { createProperty } from "@/lib/properties-actions";

const TYPES = [
  "ferienhaus", "appartement", "glamping", "tiny_house", "stellplatz",
  "hausboot", "einzelzimmer", "doppelzimmer", "zweibettzimmer",
  "familienzimmer", "junior_suite", "suite",
] as const;

export function NeuesObjektForm() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [country, setCountry] = useState("DE");

  // Währung folgt dem Land (Datenquelle, nicht hartkodiert). Anzeige nur.
  const currency = currencyForCountry(country);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await createProperty({
      title: String(fd.get("title") ?? "").trim(),
      property_type: String(fd.get("property_type") ?? "ferienhaus"),
      max_guests: Number(fd.get("max_guests") ?? 1),
      currency,
      country,
      city: String(fd.get("city") ?? "").trim() || undefined,
      street: String(fd.get("street") ?? "").trim() || undefined,
      house_number: String(fd.get("house_number") ?? "").trim() || undefined,
      postal_code: String(fd.get("postal_code") ?? "").trim() || undefined,
    });
    setPending(false);
    if (res.ok) {
      toast.success(t("titel"));
      router.push(`/objekte/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">{t("feldTitel")}</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          placeholder={t("feldTitelPlatzhalter")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="property_type">{t("feldTyp")}</Label>
          <NativeSelect id="property_type" name="property_type" defaultValue="ferienhaus">
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`typen.${ty}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_guests">{t("feldGaeste")}</Label>
          <Input
            id="max_guests"
            name="max_guests"
            type="number"
            min={1}
            max={99}
            defaultValue={2}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country">{t("feldLand")}</Label>
          <NativeSelect
            id="country"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {LAENDER.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {t("waehrungHinweis")}: {currency || "—"}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">{t("feldStadt")}</Label>
          <Input id="city" name="city" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_6rem_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="street">{t("feldStrasse")}</Label>
          <Input id="street" name="street" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="house_number">{t("feldHausnummer")}</Label>
          <Input id="house_number" name="house_number" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postal_code">{t("feldPlz")}</Label>
          <Input id="postal_code" name="postal_code" />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? t("anlegenLaeuft") : t("anlegen")}
      </Button>
    </form>
  );
}
