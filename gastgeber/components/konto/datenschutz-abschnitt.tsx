"use client";

// Abschnitt „Datenschutz" der Kontoeinstellungen (Airbnb „Konto → Datenschutz").
// Echte, persistierte Präferenz-Schalter (GET/PATCH /privacy-settings) in vier
// Gruppen: Nachrichten (Lesebestätigungen), Listings (Suchmaschinen-Indexierung),
// Bewertungen (welche Detailfelder sichtbar sind), Datenschutz (KI-Feature-Beitrag).
// Darunter Verweis-Aktionen (Datenexport, Konto löschen, Cookie-Präferenzen), die
// KEINE Präferenzen sind und ehrlich als „in Vorbereitung" markiert werden, solange
// dahinter kein eigener Flow steht (kein toter Button, Wurzel 5).
//
// Kein Realtime: privacy_settings ist streng per-User und liegt bewusst NICHT in
// der Realtime-Publication (Sicherheitsgrenze). Der Server ist die Quelle der
// Wahrheit — jeder Schalter übernimmt die vom PATCH zurückgegebenen Werte.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Switch } from "@nextdays/ui/switch";

import type { PrivacyKey, PrivacySettings } from "@/lib/datenschutz";
import { setzeDatenschutz } from "@/lib/konto-actions";

import { BlockiertePersonen } from "./blockierte-personen";

// Reihenfolge und Gruppierung wie im Airbnb-Datenschutz-Tab.
const GRUPPEN: { titelKey: string; textKey?: string; schalter: PrivacyKey[] }[] = [
  { titelKey: "dsMessagesTitel", schalter: ["message_read_receipts"] },
  { titelKey: "dsListingsTitel", schalter: ["listings_search_engine_indexing"] },
  {
    titelKey: "dsReviewsTitel",
    textKey: "dsReviewsText",
    schalter: [
      "review_show_home_city",
      "review_show_trip_type",
      "review_show_length_of_stay",
      "review_show_booked_services",
    ],
  },
  { titelKey: "dsDataTitel", schalter: ["ai_features_contribution"] },
];

// Übersetzungs-Key für Label/Beschreibung je Schalter — abgeleitet aus dem
// Feldnamen (message_read_receipts → dsToggle_messageReadReceipts).
function toggleKey(key: PrivacyKey, teil: "Label" | "Text"): string {
  const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return `dsToggle_${camel}${teil}`;
}

export function DatenschutzAbschnitt({
  settings,
}: {
  settings: PrivacySettings | null;
}) {
  const t = useTranslations("konto");
  const [werte, setWerte] = useState<PrivacySettings | null>(settings);
  const [busy, setBusy] = useState<PrivacyKey | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function umschalten(key: PrivacyKey, next: boolean) {
    if (!werte) return;
    setBusy(key);
    setFehler(null);
    // Optimistisch setzen; bei Fehlschlag den alten Wert wiederherstellen.
    const vorher = werte[key];
    setWerte({ ...werte, [key]: next });
    const res = await setzeDatenschutz(key, next);
    setBusy(null);
    if (res.ok) {
      setWerte(res.settings);
    } else {
      setWerte((w) => (w ? { ...w, [key]: vorher } : w));
      setFehler(res.error);
    }
  }

  return (
    <section>
      <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
        {t("datenschutzTitel")}
      </h1>

      {werte === null ? (
        <p className="text-sm text-destructive">{t("dsLadeFehler")}</p>
      ) : (
        <div className="space-y-12">
          {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

          {GRUPPEN.map((gruppe) => (
            <div key={gruppe.titelKey}>
              <h2 className="mb-1 text-xl font-semibold">{t(gruppe.titelKey)}</h2>
              {gruppe.textKey ? (
                <p className="mb-4 max-w-lg text-sm text-muted-foreground">
                  {t(gruppe.textKey)}
                </p>
              ) : (
                <div className="mb-2" />
              )}
              <div className="divide-y divide-border rounded-2xl border border-border">
                {gruppe.schalter.map((key) => (
                  <ToggleZeile
                    key={key}
                    label={t(toggleKey(key, "Label"))}
                    hint={t(toggleKey(key, "Text"))}
                    checked={werte[key]}
                    busy={busy === key}
                    onChange={(v) => void umschalten(key, v)}
                  />
                ))}
              </div>
              {/* „Blockierte Personen" gehört (wie bei Airbnb) unter Nachrichten. */}
              {gruppe.titelKey === "dsMessagesTitel" && (
                <div className="mt-3">
                  <BlockiertePersonen />
                </div>
              )}
            </div>
          ))}

          {/* Verweis-Aktionen — keine Präferenzen, eigener Flow folgt. */}
          <div>
            <h2 className="mb-4 text-xl font-semibold">{t("dsAktionenTitel")}</h2>
            <div className="divide-y divide-border rounded-2xl border border-border">
              <VorbereitungZeile
                icon="solar:download-minimalistic-line-duotone"
                label={t("dsDatenExport")}
                hint={t("dsDatenExportText")}
              />
              <VorbereitungZeile
                icon="solar:cookie-line-duotone"
                label={t("dsCookies")}
                hint={t("dsCookiesText")}
              />
              <VorbereitungZeile
                icon="solar:trash-bin-trash-line-duotone"
                label={t("dsKontoLoeschen")}
                hint={t("dsKontoLoeschenText")}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ToggleZeile({
  label,
  hint,
  checked,
  busy,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 p-5">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={checked}
        disabled={busy}
        onCheckedChange={onChange}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

// Verweis-Zeile ohne Backend: ehrlich als „in Vorbereitung" markiert, kein
// klickbarer Schein-Button (Wurzel 5).
function VorbereitungZeile({
  icon,
  label,
  hint,
}: {
  icon: string;
  label: string;
  hint: string;
}) {
  const t = useTranslations("konto");
  return (
    <div className="flex items-center gap-4 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon icon={icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        {t("dsInVorbereitung")}
      </span>
    </div>
  );
}
