"use client";

// Tab „Unternehmensdaten" (Airbnb-Vorbild: /account-settings/business-details).
//
// Aufbau exakt wie dort: oben ein Hinweisbanner, solange Pflichtangaben fehlen,
// darunter Zeilen mit Bezeichnung, Wert und „Hinzufügen"/„Bearbeiten" rechts.
// Fehlt ein Wert, steht „Nicht angegeben" da — nie ein erfundener Platzhalter.
//
// Bearbeitet wird im Zeilen-Inline-Modus (wie Airbnb), nicht in einem Dialog:
// Der Nutzer sieht die übrigen Angaben weiter und verliert den Kontext nicht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  speichereUnternehmensdaten,
  type UnternehmensFeld,
} from "@/lib/unternehmen-actions";
import type { Unternehmensprofil } from "@/lib/unternehmen";

/** Eine bearbeitbare Zeile. `titel`/`label`/`hinweis` sind Textschlüssel. */
type Zeile = {
  titel: string;
  felder: { key: UnternehmensFeld; label: string; typ?: string }[];
  /** Wie der gespeicherte Wert angezeigt wird. */
  anzeige: (p: Unternehmensprofil) => string;
  hinweis?: string;
};

const ZEILEN: Zeile[] = [
  {
    titel: "utZeileTelefon",
    felder: [{ key: "phoneNumber", label: "utFeldTelefon", typ: "tel" }],
    anzeige: (p) => p.phoneNumber,
  },
  {
    titel: "utZeileEmail",
    felder: [{ key: "email", label: "utFeldEmail", typ: "email" }],
    anzeige: (p) => p.email,
  },
  {
    titel: "utZeileWebsite",
    felder: [{ key: "website", label: "utFeldWebsite", typ: "url" }],
    anzeige: (p) => p.website,
  },
  {
    titel: "utZeileAdresse",
    felder: [
      { key: "companyStreet", label: "utFeldStrasse" },
      { key: "companyHouseNumber", label: "utFeldHausnummer" },
      { key: "companyPostalCode", label: "utFeldPlz" },
      { key: "companyCity", label: "utFeldOrt" },
      { key: "companyState", label: "utFeldRegion" },
      { key: "companyCountry", label: "utFeldLand" },
    ],
    anzeige: (p) =>
      [
        [p.companyStreet, p.companyHouseNumber].filter(Boolean).join(" "),
        [p.companyPostalCode, p.companyCity].filter(Boolean).join(" "),
        p.companyCountry,
      ]
        .filter(Boolean)
        .join(", "),
  },
  {
    titel: "utZeileFirma",
    felder: [
      { key: "companyName", label: "utFeldFirmenname" },
      { key: "legalForm", label: "utFeldRechtsform" },
    ],
    anzeige: (p) => [p.companyName, p.legalForm].filter(Boolean).join(" · "),
  },
  {
    titel: "utZeileRegister",
    felder: [
      { key: "companyRegister", label: "utFeldRegisternummer" },
      { key: "districtCourt", label: "utFeldRegistergericht" },
    ],
    anzeige: (p) =>
      [p.companyRegister, p.districtCourt].filter(Boolean).join(" · "),
  },
  {
    titel: "utZeileSteuern",
    felder: [
      { key: "vatId", label: "utFeldUstId" },
      { key: "taxNumber", label: "utFeldSteuernummer" },
    ],
    anzeige: (p) => [p.vatId, p.taxNumber].filter(Boolean).join(" · "),
  },
  {
    titel: "utZeileVertretung",
    felder: [
      { key: "firstName", label: "utFeldVorname" },
      { key: "lastName", label: "utFeldNachname" },
    ],
    anzeige: (p) => [p.firstName, p.lastName].filter(Boolean).join(" "),
    hinweis: "utVertretungHinweis",
  },
];

export function UnternehmenTab({ profil }: { profil: Unternehmensprofil | null }) {
  const t = useTranslations("konto");
  const [offen, setOffen] = useState<string | null>(null);

  // Kein Realtime-Abo: tenant_billing_profile ist für authenticated bewusst
  // gesperrt (0169, Wurzel 6 — Stripe-Connect-Daten, IBAN, Steuer), ein Abo
  // darauf wäre eine stumme Attrappe. Der Sync-Status vom Zahlungsanbieter
  // kommt per Webhook ausschließlich in diese Tabelle, es gibt also keine
  // erlaubte Ersatzquelle: er erscheint beim nächsten Laden der Seite — nach
  // dem Onboarding-Rücksprung ohnehin ein frischer Seitenaufbau.
  // Geprüft mit scripts/realtime/abos-pruefen.sh.

  if (!profil) {
    return (
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          {t("utTitel")}
        </h2>
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">
          {t("utNichtAbrufbar")}
        </p>
      </div>
    );
  }

  // Pflichtangaben für die Zahlungsfreischaltung. Fehlt eine, zeigt Airbnb
  // oben ein Banner — wir nennen konkret, was fehlt, statt allgemein zu warnen.
  const fehlend = [
    !profil.email && t("utFehlendEmail"),
    !profil.companyCountry && t("utFehlendLand"),
    !profil.companyStreet && t("utFehlendAdresse"),
  ].filter(Boolean) as string[];

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">
        {t("utTitel")}
      </h2>

      {fehlend.length > 0 && (
        <div className="mt-6 flex gap-4 rounded-2xl border border-border p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Icon icon="solar:danger-bold" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">{t("utBannerTitel")}</p>
            <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">
              {t("utBannerText", { fehlend: fehlend.join(", ") })}
            </p>
          </div>
        </div>
      )}

      {profil.stripeSyncError && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-5 text-[0.9375rem] text-amber-900">
          <Icon
            icon="solar:info-circle-bold"
            className="mr-1.5 inline size-4 align-text-bottom"
          />
          {t("utSyncFehler", { fehler: profil.stripeSyncError })}
        </div>
      )}

      <p className="mt-6 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        {t("utEinleitung")}
      </p>

      {/* Gewerbestatus: Muss im EWR, in Großbritannien und der Schweiz erklärt
          werden (Know-Your-Customer + Verbraucherschutz) und wird Gästen dort
          angezeigt. Wichtig: Der Status ergibt sich NICHT allein aus der
          Rechtsform — es zählen Haupterwerb, Registrierung, Umsatzsteuerpflicht
          und Regelmäßigkeit. Deshalb hier nur anzeigen und die Kriterien
          nennen, statt eine Einordnung zu behaupten, die wir nicht treffen
          dürfen (Wurzel 4). */}
      <div className="mt-8 rounded-2xl border border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium">{t("utArtTitel")}</p>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">
              {profil.accountType === "company"
                ? t("utArtGewerblich")
                : t("utArtPrivat")}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground/80">
          {t("utArtKriterien")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground/80">
          {t("utArtHinweis")}
        </p>
      </div>

      <div className="mt-4">
        {ZEILEN.map((z) => (
          <ZeilenEintrag
            key={z.titel}
            zeile={z}
            profil={profil}
            offen={offen === z.titel}
            aufKlappen={() => setOffen(offen === z.titel ? null : z.titel)}
            aufSchliessen={() => setOffen(null)}
          />
        ))}
      </div>

      <p className="mt-6 max-w-xl text-sm text-muted-foreground/80">
        {t("utPruefungHinweis")}
      </p>
    </div>
  );
}

function ZeilenEintrag({
  zeile,
  profil,
  offen,
  aufKlappen,
  aufSchliessen,
}: {
  zeile: Zeile;
  profil: Unternehmensprofil;
  offen: boolean;
  aufKlappen: () => void;
  aufSchliessen: () => void;
}) {
  const t = useTranslations("konto");
  const wert = zeile.anzeige(profil);
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [laeuft, setLaeuft] = useState(false);

  function starten() {
    // Beim Aufklappen die gespeicherten Werte übernehmen, damit der Nutzer
    // bestehende Angaben ändern statt neu tippen muss.
    const vorbelegt: Record<string, string> = {};
    for (const f of zeile.felder) {
      vorbelegt[f.key] = (profil[f.key] as string) ?? "";
    }
    setEntwurf(vorbelegt);
    aufKlappen();
  }

  async function speichern() {
    setLaeuft(true);
    const res = await speichereUnternehmensdaten(
      profil,
      entwurf as Partial<Record<UnternehmensFeld, string>>,
    );
    setLaeuft(false);
    if (res.ok) {
      toast.success(t("utGespeichert"));
      aufSchliessen();
    } else {
      toast.error(res.fehler);
    }
  }

  return (
    <div className="border-b border-border py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t(zeile.titel)}</p>
          {!offen && (
            <p
              className={`mt-0.5 text-[0.9375rem] ${
                wert ? "text-muted-foreground" : "text-muted-foreground/70"
              }`}
            >
              {/* Kein erfundener Platzhalter — leer heißt leer (Wurzel 4). */}
              {wert || t("nichtAngegeben")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={offen ? aufSchliessen : starten}
          className="shrink-0 text-[0.9375rem] font-medium underline underline-offset-4 outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-foreground/20"
        >
          {offen
            ? t("abbrechen")
            : wert
              ? t("bearbeiten")
              : t("hinzufuegen")}
        </button>
      </div>

      {offen && (
        <div className="mt-5 space-y-4">
          {zeile.felder.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`feld-${f.key}`}
                className="block text-sm text-muted-foreground"
              >
                {t(f.label)}
              </label>
              <input
                id={`feld-${f.key}`}
                type={f.typ ?? "text"}
                value={entwurf[f.key] ?? ""}
                onChange={(e) =>
                  setEntwurf({ ...entwurf, [f.key]: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus-visible:border-foreground"
              />
            </div>
          ))}

          {zeile.hinweis && (
            <p className="text-sm text-muted-foreground">{t(zeile.hinweis)}</p>
          )}

          <button
            type="button"
            onClick={() => void speichern()}
            disabled={laeuft}
            className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
          >
            {laeuft ? t("utSpeichernLaeuft") : t("speichern")}
          </button>
        </div>
      )}
    </div>
  );
}
