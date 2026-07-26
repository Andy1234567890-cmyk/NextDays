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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  speichereUnternehmensdaten,
  type UnternehmensFeld,
} from "@/lib/unternehmen-actions";
import type { Unternehmensprofil } from "@/lib/unternehmen";
import { useRealtime } from "@/lib/use-realtime";

/** Eine bearbeitbare Zeile. `mehrfach` = mehrere Felder in einer Zeile. */
type Zeile = {
  titel: string;
  felder: { key: UnternehmensFeld; label: string; typ?: string }[];
  /** Wie der gespeicherte Wert angezeigt wird. */
  anzeige: (p: Unternehmensprofil) => string;
  hinweis?: string;
};

const ZEILEN: Zeile[] = [
  {
    titel: "Geschäftliche Telefonnummer",
    felder: [{ key: "phoneNumber", label: "Telefonnummer", typ: "tel" }],
    anzeige: (p) => p.phoneNumber,
  },
  {
    titel: "Geschäftliche E-Mail-Adresse",
    felder: [{ key: "email", label: "E-Mail-Adresse", typ: "email" }],
    anzeige: (p) => p.email,
  },
  {
    titel: "Website",
    felder: [{ key: "website", label: "Website", typ: "url" }],
    anzeige: (p) => p.website,
  },
  {
    titel: "Eingetragene Geschäftsadresse",
    felder: [
      { key: "companyStreet", label: "Straße" },
      { key: "companyHouseNumber", label: "Hausnummer" },
      { key: "companyPostalCode", label: "Postleitzahl" },
      { key: "companyCity", label: "Ort" },
      { key: "companyState", label: "Bundesland / Region" },
      { key: "companyCountry", label: "Land (zweistellig, z. B. DE)" },
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
    titel: "Offizieller Firmenname",
    felder: [
      { key: "companyName", label: "Firmenname" },
      { key: "legalForm", label: "Rechtsform (z. B. GmbH, Einzelunternehmen)" },
    ],
    anzeige: (p) => [p.companyName, p.legalForm].filter(Boolean).join(" · "),
  },
  {
    titel: "Registereintrag",
    felder: [
      { key: "companyRegister", label: "Handelsregisternummer" },
      { key: "districtCourt", label: "Registergericht" },
    ],
    anzeige: (p) =>
      [p.companyRegister, p.districtCourt].filter(Boolean).join(" · "),
  },
  {
    titel: "Steuernummern",
    felder: [
      { key: "vatId", label: "Umsatzsteuer-Identifikationsnummer" },
      { key: "taxNumber", label: "Steuernummer" },
    ],
    anzeige: (p) => [p.vatId, p.taxNumber].filter(Boolean).join(" · "),
  },
  {
    titel: "Vertretungsberechtigte Person",
    felder: [
      { key: "firstName", label: "Vorname" },
      { key: "lastName", label: "Nachname" },
    ],
    anzeige: (p) => [p.firstName, p.lastName].filter(Boolean).join(" "),
    hinweis:
      "Wird für die Freischaltung von Zahlungen benötigt und nicht öffentlich gezeigt.",
  },
];

export function UnternehmenTab({ profil }: { profil: Unternehmensprofil | null }) {
  const router = useRouter();
  const [offen, setOffen] = useState<string | null>(null);

  // Realtime: Die Daten ändern sich auch serverseitig — der Sync-Status beim
  // Zahlungsanbieter wird per Webhook zurückgeschrieben.
  useRealtime({
    table: "tenant_billing_profile",
    onChange: () => router.refresh(),
  });

  if (!profil) {
    return (
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Unternehmensdaten
        </h2>
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">
          Die Unternehmensdaten sind gerade nicht abrufbar. Bitte später erneut
          versuchen.
        </p>
      </div>
    );
  }

  // Pflichtangaben für die Zahlungsfreischaltung. Fehlt eine, zeigt Airbnb
  // oben ein Banner — wir nennen konkret, was fehlt, statt allgemein zu warnen.
  const fehlend = [
    !profil.email && "E-Mail-Adresse",
    !profil.companyCountry && "Land",
    !profil.companyStreet && "Adresse",
  ].filter(Boolean) as string[];

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">
        Unternehmensdaten
      </h2>

      {fehlend.length > 0 && (
        <div className="mt-6 flex gap-4 rounded-2xl border border-border p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Icon icon="solar:danger-bold" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">Angaben vervollständigen</p>
            <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">
              Ohne {fehlend.join(", ")} können wir keine Zahlungen für dich
              freischalten.
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
          Die letzte Übertragung an unseren Zahlungsdienst schlug fehl:{" "}
          {profil.stripeSyncError}
        </div>
      )}

      <p className="mt-6 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        Je nach Standort erscheinen einige dieser Angaben in deinen Inseraten.
        Sie werden außerdem für die Freischaltung von Zahlungen und für deine
        Rechnungen verwendet.
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
            <p className="font-medium">Art der Vermietung</p>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">
              {profil.accountType === "company"
                ? "Gewerblich — du vermietest als Unternehmen."
                : "Privat — du vermietest als Privatperson."}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground/80">
          Gewerblich vermietest du in der Regel, wenn die Vermietung deine
          Haupteinnahmequelle ist, du im Handelsregister eingetragen oder
          umsatzsteuerpflichtig bist oder regelmäßig mit Gewinnabsicht
          vermietest. Dieser Status wird Gästen im Europäischen
          Wirtschaftsraum, in Großbritannien und der Schweiz angezeigt.
        </p>
        <p className="mt-2 text-sm text-muted-foreground/80">
          Wir dürfen deinen Status nicht selbst festlegen. Wenn er sich ändert,
          wende dich bitte an den Support. Im Zweifel hilft dir eine
          Rechtsberatung weiter.
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
        Änderungen an bereits geprüften Angaben können eine erneute Prüfung
        auslösen. Bis sie abgeschlossen ist, bleiben deine Zahlungen aktiv.
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
      toast.success("Gespeichert.");
      aufSchliessen();
    } else {
      toast.error(res.fehler);
    }
  }

  return (
    <div className="border-b border-border py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{zeile.titel}</p>
          {!offen && (
            <p
              className={`mt-0.5 text-[0.9375rem] ${
                wert ? "text-muted-foreground" : "text-muted-foreground/70"
              }`}
            >
              {/* Kein erfundener Platzhalter — leer heißt leer (Wurzel 4). */}
              {wert || "Nicht angegeben"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={offen ? aufSchliessen : starten}
          className="shrink-0 text-[0.9375rem] font-medium underline underline-offset-4 outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-foreground/20"
        >
          {offen ? "Abbrechen" : wert ? "Bearbeiten" : "Hinzufügen"}
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
                {f.label}
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
            <p className="text-sm text-muted-foreground">{zeile.hinweis}</p>
          )}

          <button
            type="button"
            onClick={() => void speichern()}
            disabled={laeuft}
            className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
          >
            {laeuft ? "Wird gespeichert …" : "Speichern"}
          </button>
        </div>
      )}
    </div>
  );
}
