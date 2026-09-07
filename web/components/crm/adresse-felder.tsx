"use client";

// Anschrift strikt getrennt (Lastenheft §6): Straße, Hausnummer, PLZ, Ort,
// Land — fünf Felder, kein Freitext. Land als ISO-2-Auswahl aus der geteilten
// Länderliste; der Server normalisiert und lehnt Unbekanntes mit 422 ab.
import { useTranslations } from "next-intl";

import { COUNTRIES } from "@nextdays/ui/countries";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";

export type Adresse = {
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
};

export function AdresseFelder({
  wert,
  onChange,
  disabled = false,
}: {
  wert: Adresse;
  onChange: (patch: Partial<Adresse>) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("crm");
  const feld = "flex flex-col gap-1";
  const label = "text-xs font-medium text-muted-foreground";
  return (
    <div className="grid grid-cols-6 gap-3">
      <label className={`${feld} col-span-4`}>
        <span className={label}>{t("allgemein.strasse")}</span>
        <Input
          value={wert.street ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ street: e.target.value })}
        />
      </label>
      <label className={`${feld} col-span-2`}>
        <span className={label}>{t("allgemein.hausnummer")}</span>
        <Input
          value={wert.house_number ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ house_number: e.target.value })}
        />
      </label>
      <label className={`${feld} col-span-2`}>
        <span className={label}>{t("allgemein.plz")}</span>
        <Input
          value={wert.postal_code ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ postal_code: e.target.value })}
        />
      </label>
      <label className={`${feld} col-span-4`}>
        <span className={label}>{t("allgemein.ort")}</span>
        <Input
          value={wert.city ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ city: e.target.value })}
        />
      </label>
      <label className={`${feld} col-span-6`}>
        <span className={label}>{t("allgemein.land")}</span>
        <NativeSelect
          value={wert.country ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ country: e.target.value || null })}
        >
          <option value="">{t("allgemein.landWaehlen")}</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </label>
    </div>
  );
}

/** Einzeilige Anzeige einer Anschrift; leer → null. */
export function adresseZeile(a: Adresse): string | null {
  const zeile1 = [a.street, a.house_number].filter(Boolean).join(" ");
  const zeile2 = [a.postal_code, a.city].filter(Boolean).join(" ");
  const teile = [zeile1, zeile2, a.country].filter(Boolean);
  return teile.length ? teile.join(", ") : null;
}
