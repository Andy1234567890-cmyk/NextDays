"use client";

// Tab „Vermieterdaten" (Airbnb-Vorbild: /account-settings/business-details).
//
// Airbnb lässt Privatpersonen UND Unternehmen vermieten — und der Gastgeber
// erklärt SELBST, was zutrifft („Vermietest du als Unternehmen?"). Vorher
// verlangte dieser Tab von jedem Firmenname, Registereintrag und Steuernummern
// und behauptete, wir dürften den Status nicht ändern. Beides falsch: ohne
// die Wahl konnte eine Privatperson ihr Zahlungskonto nie freischalten.
//
// Aufbau wie bei Airbnb: oben ein Hinweisbanner, solange Pflichtangaben
// fehlen, dann die Wahl Privat/Gewerblich, darunter Zeilen mit Bezeichnung,
// Wert und „Hinzufügen"/„Bearbeiten". Welche Zeilen erscheinen, hängt vom
// gewählten Typ ab — die Pflichtfelder sind die, die Stripe für diesen
// Kontotyp verlangt (individual.* bzw. company.* + Vertreter).
//
// Fehlt ein Wert, steht „Nicht angegeben" da — nie ein erfundener Platzhalter.
// Bearbeitet wird inline, nicht im Dialog: der Nutzer behält den Kontext.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ladeLandAnforderungen,
  setzeKennnummer,
} from "@/lib/auszahlung-actions";
import type { Account } from "@/lib/konto";
import type { AuszahlungsStatus, LandAnforderungen } from "@/lib/payments";
import {
  speichereUnternehmensdaten,
  type UnternehmensFeld,
} from "@/lib/unternehmen-actions";
import type { Unternehmensprofil } from "@/lib/unternehmen";

type Kontotyp = "individual" | "company";

/** Eine bearbeitbare Zeile. `titel`/`label`/`hinweis` sind Textschlüssel. */
type Zeile = {
  titel: string;
  felder: { key: UnternehmensFeld; label: string; typ?: string; hinweis?: string }[];
  /** Wie der gespeicherte Wert angezeigt wird. */
  anzeige: (p: Unternehmensprofil) => string;
  hinweis?: string;
  /** Aus dem Konto vorbelegen, wenn das Profil hier noch leer ist. */
  vorbelegung?: (a: Account) => Partial<Record<UnternehmensFeld, string>>;
};

const ADRESSE_FELDER: Zeile["felder"] = [
  { key: "companyStreet", label: "utFeldStrasse" },
  { key: "companyHouseNumber", label: "utFeldHausnummer" },
  { key: "companyPostalCode", label: "utFeldPlz" },
  { key: "companyCity", label: "utFeldOrt" },
  { key: "companyState", label: "utFeldRegion" },
  { key: "companyCountry", label: "utFeldLand", hinweis: "utLandHinweis" },
];

const adresseAnzeige = (p: Unternehmensprofil) =>
  [
    [p.companyStreet, p.companyHouseNumber].filter(Boolean).join(" "),
    [p.companyPostalCode, p.companyCity].filter(Boolean).join(" "),
    p.companyCountry,
  ]
    .filter(Boolean)
    .join(", ");

// Vor-/Nachname aus dem Anzeigenamen des Kontos: letztes Wort = Nachname.
// Nur eine VORBELEGUNG im Eingabefeld — gespeichert wird, was der Nutzer
// bestätigt (Ableiten statt raten, aber nie hinter seinem Rücken).
function nameAusKonto(a: Account): Partial<Record<UnternehmensFeld, string>> {
  const teile = (a.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return {};
  if (teile.length === 1) return { firstName: teile[0] };
  return { firstName: teile.slice(0, -1).join(" "), lastName: teile[teile.length - 1] };
}

const NAME_ZEILE: Zeile = {
  titel: "utZeileName",
  felder: [
    { key: "firstName", label: "utFeldVorname" },
    { key: "lastName", label: "utFeldNachname" },
  ],
  anzeige: (p) => [p.firstName, p.lastName].filter(Boolean).join(" "),
  vorbelegung: nameAusKonto,
};

const GEBURTSDATUM_ZEILE: Zeile = {
  titel: "utZeileGeburtsdatum",
  felder: [{ key: "ownerDob", label: "utFeldGeburtsdatum", typ: "date" }],
  anzeige: (p) => p.ownerDob,
  hinweis: "utGeburtsdatumHinweis",
};

/** Privatperson: genau die Angaben, die Stripe für `individual` verlangt. */
const ZEILEN_PRIVAT: Zeile[] = [
  NAME_ZEILE,
  GEBURTSDATUM_ZEILE,
  {
    titel: "utZeileAdressePrivat",
    felder: ADRESSE_FELDER,
    anzeige: adresseAnzeige,
    vorbelegung: (a) => ({
      companyStreet: a.residential_street ?? "",
      companyPostalCode: a.residential_postal_code ?? "",
      companyCity: a.residential_city ?? "",
      companyCountry: a.residential_country ?? a.tenant_country ?? "",
    }),
  },
  {
    titel: "utZeileTelefonPrivat",
    felder: [{ key: "phoneNumber", label: "utFeldTelefon", typ: "tel" }],
    anzeige: (p) => p.phoneNumber,
    vorbelegung: (a) => ({ phoneNumber: a.phone ?? "" }),
  },
  {
    titel: "utZeileEmailPrivat",
    felder: [{ key: "email", label: "utFeldEmail", typ: "email" }],
    anzeige: (p) => p.email,
    vorbelegung: (a) => ({ email: a.email ?? "" }),
  },
  {
    titel: "utZeileWebsite",
    felder: [{ key: "website", label: "utFeldWebsite", typ: "url" }],
    anzeige: (p) => p.website,
  },
  {
    titel: "utZeileSteuernummerPrivat",
    felder: [{ key: "taxNumber", label: "utFeldSteuernummer" }],
    anzeige: (p) => p.taxNumber,
  },
];

/** Unternehmen: Firmenebene + vertretungsberechtigte Person (Persons-API). */
const ZEILEN_GEWERBLICH: Zeile[] = [
  {
    titel: "utZeileFirma",
    felder: [
      { key: "companyName", label: "utFeldFirmenname" },
      { key: "legalForm", label: "utFeldRechtsform" },
    ],
    anzeige: (p) => [p.companyName, p.legalForm].filter(Boolean).join(" · "),
  },
  {
    titel: "utZeileAdresse",
    felder: ADRESSE_FELDER,
    anzeige: adresseAnzeige,
    vorbelegung: (a) => ({ companyCountry: a.tenant_country ?? "" }),
  },
  {
    titel: "utZeileTelefon",
    felder: [{ key: "phoneNumber", label: "utFeldTelefon", typ: "tel" }],
    anzeige: (p) => p.phoneNumber,
    vorbelegung: (a) => ({ phoneNumber: a.phone ?? "" }),
  },
  {
    titel: "utZeileEmail",
    felder: [{ key: "email", label: "utFeldEmail", typ: "email" }],
    anzeige: (p) => p.email,
    vorbelegung: (a) => ({ email: a.email ?? "" }),
  },
  {
    titel: "utZeileWebsite",
    felder: [{ key: "website", label: "utFeldWebsite", typ: "url" }],
    anzeige: (p) => p.website,
  },
  {
    titel: "utZeileRegister",
    felder: [
      { key: "companyRegister", label: "utFeldRegisternummer" },
      { key: "districtCourt", label: "utFeldRegistergericht" },
    ],
    anzeige: (p) => [p.companyRegister, p.districtCourt].filter(Boolean).join(" · "),
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
      { key: "ownerDob", label: "utFeldGeburtsdatum", typ: "date" },
    ],
    anzeige: (p) =>
      [[p.firstName, p.lastName].filter(Boolean).join(" "), p.ownerDob]
        .filter(Boolean)
        .join(" · "),
    hinweis: "utVertretungHinweis",
    vorbelegung: nameAusKonto,
  },
];

/** Was für die Freischaltung noch fehlt — als Textschlüssel, je Kontotyp. */
function fehlendeAngaben(p: Unternehmensprofil, typ: Kontotyp): string[] {
  const f: string[] = [];
  if (typ === "company" && !p.companyName) f.push("utFehlendFirmenname");
  if (!p.firstName || !p.lastName) f.push("utFehlendName");
  if (!p.ownerDob) f.push("utFehlendGeburtsdatum");
  if (!p.companyStreet || !p.companyCity) f.push("utFehlendAdresse");
  if (!p.companyCountry) f.push("utFehlendLand");
  if (!p.email) f.push("utFehlendEmail");
  return f;
}

export function UnternehmenTab({
  profil,
  account,
  kontoId,
  kontoStatus,
}: {
  profil: Unternehmensprofil | null;
  account: Account;
  /** Stripe-Konto des Betriebs — null, solange es noch nicht besteht. */
  kontoId: string | null;
  kontoStatus: AuszahlungsStatus | null;
}) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [offen, setOffen] = useState<string | null>(null);
  const [typLaeuft, setTypLaeuft] = useState(false);

  // Kein Realtime-Abo: tenant_billing_profile ist für authenticated bewusst
  // gesperrt (0169, Wurzel 6 — Stripe-Connect-Daten, IBAN, Steuer), ein Abo
  // darauf wäre eine stumme Attrappe. Nach jedem Speichern router.refresh().
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

  // Backend-Default ist `individual` (kein erfundener Firmenzwang).
  const typ: Kontotyp = profil.accountType === "company" ? "company" : "individual";
  const zeilen = typ === "company" ? ZEILEN_GEWERBLICH : ZEILEN_PRIVAT;
  const fehlend = fehlendeAngaben(profil, typ).map((k) => t(k));

  async function typWaehlen(neu: Kontotyp) {
    if (neu === typ) return;
    setTypLaeuft(true);
    // Gegenzustand (Wurzel 1): eine Firmen-Rechtsform widerspricht „privat" —
    // Stripe leitet den Kontotyp aus der Rechtsform ab, nicht aus dem groben
    // Typ. Beim Wechsel zu privat wird sie deshalb geleert, sonst bliebe das
    // Konto eine Firma mit Vertretern.
    const res = await speichereUnternehmensdaten(profil!, {
      accountType: neu,
      ...(neu === "individual" ? { legalForm: "" } : {}),
    });
    setTypLaeuft(false);
    if (res.ok) {
      toast.success(t("utArtGespeichert"));
      router.refresh();
    } else {
      toast.error(res.fehler);
    }
  }

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

      {/* Art der Vermietung — der Gastgeber wählt selbst (Airbnb-Muster). Der
          Status wird Gästen im EWR, in Großbritannien und der Schweiz gezeigt
          (Verbraucherschutz); die Kriterien stehen dabei, eine Einordnung
          treffen wir nicht (Wurzel 4). */}
      <div className="mt-8">
        <p className="font-medium">{t("utArtTitel")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: "individual", titel: "utArtPrivatKurz", text: "utArtPrivatText", icon: "solar:user-bold-duotone" },
              { key: "company", titel: "utArtGewerblichKurz", text: "utArtGewerblichText", icon: "solar:buildings-2-bold-duotone" },
            ] as const
          ).map((o) => {
            const gewaehlt = typ === o.key;
            return (
              <button
                key={o.key}
                type="button"
                disabled={typLaeuft}
                aria-pressed={gewaehlt}
                onClick={() => void typWaehlen(o.key)}
                className={`flex items-start gap-3 rounded-2xl p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-60 ${
                  gewaehlt ? "border-2 border-foreground" : "border border-border hover:shadow-md"
                }`}
              >
                <Icon icon={o.icon} className="mt-0.5 size-6 shrink-0" />
                <span>
                  <span className="block font-semibold">{t(o.titel)}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {t(o.text)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted-foreground/80">{t("utArtKriterien")}</p>
        <p className="mt-2 text-sm text-muted-foreground/80">{t("utArtWahlHinweis")}</p>
      </div>

      <div className="mt-4">
        {zeilen.map((z) => (
          <ZeilenEintrag
            key={z.titel}
            zeile={z}
            profil={profil}
            account={account}
            offen={offen === z.titel}
            aufKlappen={() => setOffen(offen === z.titel ? null : z.titel)}
            aufSchliessen={() => setOffen(null)}
          />
        ))}
        {typ === "individual" && (
          <KennnummerZeile
            land={profil.companyCountry}
            kontoId={kontoId}
            kontoStatus={kontoStatus}
          />
        )}
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
  account,
  offen,
  aufKlappen,
  aufSchliessen,
}: {
  zeile: Zeile;
  profil: Unternehmensprofil;
  account: Account;
  offen: boolean;
  aufKlappen: () => void;
  aufSchliessen: () => void;
}) {
  const t = useTranslations("konto");
  const router = useRouter();
  const wert = zeile.anzeige(profil);
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [laeuft, setLaeuft] = useState(false);

  function starten() {
    // Gespeicherte Werte übernehmen; ist das Profil hier leer, aus dem Konto
    // vorbelegen (Name, E-Mail, Telefon, Wohnadresse) — nichts doppelt tippen.
    const vorbelegt: Record<string, string> = {};
    const ausKonto = zeile.vorbelegung?.(account) ?? {};
    for (const f of zeile.felder) {
      vorbelegt[f.key] = (profil[f.key] as string) || ausKonto[f.key] || "";
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
      router.refresh();
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
          {offen ? t("abbrechen") : wert ? t("bearbeiten") : t("hinzufuegen")}
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
              {f.hinweis && (
                <p className="mt-1.5 text-sm text-muted-foreground">{t(f.hinweis)}</p>
              )}
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

/**
 * Persönliche Kennnummer (individual.id_number) — nur, wenn Stripe sie für
 * dieses Land verlangt (live aus den country_specs) oder sie in den offenen
 * Anforderungen des Kontos steht. Sie geht DIREKT an Stripe und wird bei uns
 * nicht gespeichert (Ausweisdatum); angezeigt wird deshalb nur der Zustand.
 * Vor diesem Feld blieb ein Konto in ES/IT/PT/SE für immer eingeschränkt, und
 * die Karte nannte ein Feld, das es nirgends gab.
 */
function KennnummerZeile({
  land,
  kontoId,
  kontoStatus,
}: {
  land: string;
  kontoId: string | null;
  kontoStatus: AuszahlungsStatus | null;
}) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [regeln, setRegeln] = useState<LandAnforderungen | null>(null);
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (!land || land.length !== 2) return;
    let aktiv = true;
    void ladeLandAnforderungen(land).then((res) => {
      if (aktiv && res.ok) setRegeln(res.data);
    });
    return () => {
      aktiv = false;
    };
  }, [land]);

  const alleOffen = kontoStatus
    ? [...kontoStatus.requirements, ...kontoStatus.past_due, ...kontoStatus.eventually_due]
    : [];
  const vonStripeVerlangt = alleOffen.some((r) => r.includes("id_number"));
  const imLand = !!regeln?.individual.minimum.some((r) => r.includes("id_number"));
  if (!vonStripeVerlangt && !imLand) return null;

  // Hinterlegt = Stripe verlangt sie (in diesem Land) nicht mehr.
  const hinterlegt = !!kontoStatus && !vonStripeVerlangt;

  async function speichern() {
    if (!kontoId) return;
    setLaeuft(true);
    const res = await setzeKennnummer(kontoId, wert);
    setLaeuft(false);
    if (res.ok) {
      toast.success(t("utKennnummerGespeichert"));
      setWert("");
      setOffen(false);
      router.refresh();
    } else {
      toast.error(res.fehler);
    }
  }

  return (
    <div className="border-b border-border py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("utZeileKennnummer")}</p>
          {!offen && (
            <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">
              {hinterlegt ? t("utKennnummerHinterlegt") : t("utKennnummerOffen")}
            </p>
          )}
        </div>
        {kontoId && (
          <button
            type="button"
            onClick={() => setOffen(!offen)}
            className="shrink-0 text-[0.9375rem] font-medium underline underline-offset-4 outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            {offen ? t("abbrechen") : hinterlegt ? t("bearbeiten") : t("hinzufuegen")}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {kontoId
          ? t("utKennnummerHinweis", { land })
          : t("utKennnummerKontoFehlt")}
      </p>
      {offen && kontoId && (
        <div className="mt-4 space-y-4">
          <input
            id="feld-idNumber"
            type="text"
            value={wert}
            onChange={(e) => setWert(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono outline-none focus-visible:border-foreground"
          />
          <button
            type="button"
            onClick={() => void speichern()}
            disabled={laeuft || wert.trim().length < 4}
            className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
          >
            {laeuft ? t("utSpeichernLaeuft") : t("speichern")}
          </button>
        </div>
      )}
    </div>
  );
}
