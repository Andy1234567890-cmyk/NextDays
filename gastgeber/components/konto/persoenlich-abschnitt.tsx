"use client";

// Abschnitt „Persönliche Informationen" der Kontoeinstellungen (Airbnb-Muster).
// Verwaltet den offen-State (nur EINE Zeile offen) und ruft die echten Server
// Actions. Nach Erfolg router.refresh() — der Server-Read liefert den frischen
// Wert (kein optimistisches Raten). Fehler → Inline-Meldung (Wurzel 5).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdressSuche } from "@/components/objekt-editor/adress-suche";
import { SuchAuswahl } from "@/components/ui/such-auswahl";
import { useLaender } from "@/lib/laender";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import type { Account } from "@/lib/konto";
import { updateEmail, updateName, updateProfile } from "@/lib/konto-actions";

import { IdentitaetZeile } from "./identitaet-zeile";
import { KontoZeile } from "./konto-zeile";
import { TelefonZeile } from "./telefon-zeile";

type Feld =
  | "name"
  | "vorname"
  | "email"
  | "telefon"
  | "website"
  | "wohnadresse"
  | "postadresse"
  | "notfall"
  | null;

export function PersoenlichAbschnitt({ account }: { account: Account }) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [offen, setOffen] = useState<Feld>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const nichts = t("nichtAngegeben");

  function schliessen() {
    setOffen(null);
    setFehler(null);
  }

  async function speichern(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setFehler(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      schliessen();
      router.refresh();
    } else {
      setFehler(res.error ?? "Fehler");
    }
  }

  return (
    <section>
      <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
        {t("persoenlichTitel")}
      </h1>

      <KontoZeile
        label={t("name")}
        value={account.full_name || nichts}
        hasValue={!!account.full_name}
        open={offen === "name"}
        dimmed={offen !== null && offen !== "name"}
        onOpen={() => setOffen("name")}
        onClose={schliessen}
      >
        <EditFeld
          defaultValue={account.full_name ?? ""}
          busy={busy}
          fehler={fehler}
          onSave={(v) => speichern(() => updateName(v))}
          onCancel={schliessen}
        />
      </KontoZeile>

      <KontoZeile
        label={t("bevorzugterVorname")}
        value={account.preferred_first_name || nichts}
        hasValue={!!account.preferred_first_name}
        open={offen === "vorname"}
        dimmed={offen !== null && offen !== "vorname"}
        onOpen={() => setOffen("vorname")}
        onClose={schliessen}
      >
        <EditFeld
          defaultValue={account.preferred_first_name ?? ""}
          busy={busy}
          fehler={fehler}
          onSave={(v) =>
            speichern(() => updateProfile({ preferred_first_name: v }))
          }
          onCancel={schliessen}
        />
      </KontoZeile>

      <KontoZeile
        label={t("email")}
        value={
          <span className="flex flex-col gap-2">
            <span>{account.email || nichts}</span>
          </span>
        }
        hasValue={!!account.email}
        open={offen === "email"}
        dimmed={offen !== null && offen !== "email"}
        onOpen={() => setOffen("email")}
        onClose={schliessen}
      >
        <EditFeld
          type="email"
          defaultValue={account.email ?? ""}
          busy={busy}
          fehler={fehler}
          onSave={(v) => speichern(() => updateEmail(v))}
          onCancel={schliessen}
        />
      </KontoZeile>

      {/* Telefon mit SMS-Verifizierung (Airbnb-„Confirm account") */}
      <TelefonZeile
        account={account}
        offen={offen === "telefon"}
        dimmed={offen !== null && offen !== "telefon"}
        onOpen={() => setOffen("telefon")}
        onClose={schliessen}
      />

      <KontoZeile
        label={t("website")}
        value={account.website || nichts}
        hasValue={!!account.website}
        open={offen === "website"}
        dimmed={offen !== null && offen !== "website"}
        onOpen={() => setOffen("website")}
        onClose={schliessen}
      >
        <EditFeld
          type="url"
          defaultValue={account.website ?? ""}
          busy={busy}
          fehler={fehler}
          onSave={(v) => speichern(() => updateProfile({ website: v }))}
          onCancel={schliessen}
        />
      </KontoZeile>

      {/* Identitätsprüfung — echter Stripe-Identity-Status + Verifizieren. */}
      <IdentitaetZeile status={account.identity_status} />

      {/* Wohnadresse (mehrfeldrig) */}
      <KontoZeile
        label={t("wohnadresse")}
        value={adresseText(
          account.residential_street,
          account.residential_postal_code,
          account.residential_city,
          account.residential_country,
          nichts,
        )}
        hasValue={
          !!(account.residential_street || account.residential_city)
        }
        open={offen === "wohnadresse"}
        dimmed={offen !== null && offen !== "wohnadresse"}
        onOpen={() => setOffen("wohnadresse")}
        onClose={schliessen}
      >
        <AdressFeld
          strasse={account.residential_street}
          plz={account.residential_postal_code}
          ort={account.residential_city}
          land={account.residential_country}
          busy={busy}
          fehler={fehler}
          onSave={(f) =>
            speichern(() =>
              updateProfile({
                residential_street: f.strasse,
                residential_postal_code: f.plz,
                residential_city: f.ort,
                residential_country: f.land,
              }),
            )
          }
          onCancel={schliessen}
        />
      </KontoZeile>

      {/* Postadresse */}
      <KontoZeile
        label={t("postadresse")}
        value={adresseText(
          account.mailing_street,
          account.mailing_postal_code,
          account.mailing_city,
          account.mailing_country,
          nichts,
        )}
        hasValue={!!(account.mailing_street || account.mailing_city)}
        open={offen === "postadresse"}
        dimmed={offen !== null && offen !== "postadresse"}
        onOpen={() => setOffen("postadresse")}
        onClose={schliessen}
      >
        <AdressFeld
          strasse={account.mailing_street}
          plz={account.mailing_postal_code}
          ort={account.mailing_city}
          land={account.mailing_country}
          busy={busy}
          fehler={fehler}
          onSave={(f) =>
            speichern(() =>
              updateProfile({
                mailing_street: f.strasse,
                mailing_postal_code: f.plz,
                mailing_city: f.ort,
                mailing_country: f.land,
              }),
            )
          }
          onCancel={schliessen}
        />
      </KontoZeile>

      {/* Notfallkontakt (Name + Telefon) */}
      <KontoZeile
        label={t("notfallkontakt")}
        value={
          account.emergency_contact_name || account.emergency_contact_phone
            ? [account.emergency_contact_name, account.emergency_contact_phone]
                .filter(Boolean)
                .join(" · ")
            : nichts
        }
        hasValue={
          !!(account.emergency_contact_name || account.emergency_contact_phone)
        }
        open={offen === "notfall"}
        dimmed={offen !== null && offen !== "notfall"}
        onOpen={() => setOffen("notfall")}
        onClose={schliessen}
      >
        <NotfallFeld
          name={account.emergency_contact_name}
          phone={account.emergency_contact_phone}
          busy={busy}
          fehler={fehler}
          onSave={(f) =>
            speichern(() =>
              updateProfile({
                emergency_contact_name: f.name,
                emergency_contact_phone: f.phone,
              }),
            )
          }
          onCancel={schliessen}
        />
      </KontoZeile>

      {/* FAQ-Info-Block (Airbnb-Muster, rein informativ) */}
      <div className="mt-8 rounded-2xl border border-border p-2">
        <Faq
          icon="solar:lock-keyhole-line-duotone"
          titel={t("faqTitel1")}
          text={t("faqText1")}
        />
        <Faq
          icon="solar:lock-password-line-duotone"
          titel={t("faqTitel2")}
          text={t("faqText2")}
          trenner
        />
        <Faq
          icon="solar:eye-line-duotone"
          titel={t("faqTitel3")}
          text={t("faqText3")}
          trenner
        />
      </div>
    </section>
  );
}

// Adresse aus Einzelteilen zu einer Zeile („Straße, PLZ Ort, Land") — leere
// Teile werden weggelassen; ganz leer → nichts-Text.
function adresseText(
  strasse: string | null,
  plz: string | null,
  ort: string | null,
  land: string | null,
  nichts: string,
): string {
  const ortZeile = [plz, ort].filter(Boolean).join(" ");
  const teile = [strasse, ortZeile, land].filter(Boolean);
  return teile.length ? teile.join(", ") : nichts;
}

type Adresse = { strasse: string; plz: string; ort: string; land: string };

// Mehrfeldrige Adress-Bearbeitung (Straße, PLZ, Ort, Land).
function AdressFeld({
  strasse,
  plz,
  ort,
  land,
  busy,
  fehler,
  onSave,
  onCancel,
}: {
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  busy: boolean;
  fehler: string | null;
  onSave: (f: Adresse) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("konto");
  const laender = useLaender();
  const [f, setF] = useState<Adresse>({
    strasse: strasse ?? "",
    plz: plz ?? "",
    ort: ort ?? "",
    land: land ?? "",
  });

  return (
    <div className="max-w-lg space-y-3">
      <Feldchen label={t("wohnadresseStrasse")}>
        {/* Die Adresssuche sitzt AUF dem Strassenfeld, nicht als eigenes Feld
            daneben: sonst tippt man dieselbe Adresse zweimal und hinterlaesst
            zwei Wahrheiten. Ein Treffer fuellt Strasse, PLZ, Ort und Land in
            EINEM Zustandswechsel; wer nichts auswaehlt, tippt weiter wie
            bisher (16.09.2026). */}
        <AdressSuche
          value={f.strasse}
          onChange={(v) => setF({ ...f, strasse: v })}
          onPick={(a) =>
            setF({
              // Strasse und Hausnummer kommen getrennt von Google, dieses
              // Formular fuehrt EIN Feld — also zusammensetzen statt eines
              // davon zu verlieren.
              strasse: [a.street, a.houseNumber].filter(Boolean).join(" "),
              plz: a.postalCode,
              ort: a.city,
              // ISO-2, genau was das Landfeld erwartet (maxLength 2).
              land: a.country,
            })
          }
        />
      </Feldchen>
      <div className="grid grid-cols-2 gap-3">
        <Feldchen label={t("wohnadressePlz")}>
          <Input
            value={f.plz}
            onChange={(e) => setF({ ...f, plz: e.target.value })}
            disabled={busy}
          />
        </Feldchen>
        <Feldchen label={t("wohnadresseOrt")}>
          <Input
            value={f.ort}
            onChange={(e) => setF({ ...f, ort: e.target.value })}
            disabled={busy}
          />
        </Feldchen>
      </div>
      <Feldchen label={t("wohnadresseLand")}>
        {/* AUSWAHL statt Freitext (16.09.2026). Hier stand ein Textfeld mit dem
            Hinweis „Land (ISO-2, z. B. DE)" und einem harten
            `.toUpperCase().slice(0, 2)` auf jeder Eingabe. Zwei Fehler in
            einem: ein Kunde muss nicht wissen, was ISO-3166 ist — und wer
            „Dänemark" tippte, bekam wortlos „DÄ" gespeichert. Ein
            abgeschnittener Wert, der aussieht wie ein Ländercode, ist
            schlimmer als eine Fehlermeldung (Wurzel 4).
            Die Namen kommen aus `Intl.DisplayNames` in der Sprache des
            Nutzers, gespeichert wird weiter der ISO-Code. */}
        <SuchAuswahl
          optionen={laender.alle().map((l) => ({
            wert: l.code,
            label: l.name,
            stichworte: l.code,
          }))}
          wert={f.land}
          onChange={(v) => setF({ ...f, land: v })}
          suchPlatzhalter={t("landSuchen")}
        />
      </Feldchen>
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      <SpeichernAbbrechen
        busy={busy}
        onSave={() =>
          onSave({
            strasse: f.strasse.trim(),
            plz: f.plz.trim(),
            ort: f.ort.trim(),
            land: f.land.trim(),
          })
        }
        onCancel={onCancel}
      />
    </div>
  );
}

// Notfallkontakt (Name + Telefon).
function NotfallFeld({
  name,
  phone,
  busy,
  fehler,
  onSave,
  onCancel,
}: {
  name: string | null;
  phone: string | null;
  busy: boolean;
  fehler: string | null;
  onSave: (f: { name: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("konto");
  const [n, setN] = useState(name ?? "");
  const [p, setP] = useState(phone ?? "");

  return (
    <div className="max-w-lg space-y-3">
      <Feldchen label={t("name")}>
        <Input
          value={n}
          onChange={(e) => setN(e.target.value)}
          disabled={busy}
          autoFocus
        />
      </Feldchen>
      <Feldchen label={t("telefon")}>
        <Input
          type="tel"
          value={p}
          onChange={(e) => setP(e.target.value)}
          disabled={busy}
        />
      </Feldchen>
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      <SpeichernAbbrechen
        busy={busy}
        onSave={() => onSave({ name: n.trim(), phone: p.trim() })}
        onCancel={onCancel}
      />
    </div>
  );
}

// Kleines beschriftetes Eingabefeld.
function Feldchen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

// Speichern/Abbrechen-Leiste (wiederverwendet).
function SpeichernAbbrechen({
  busy,
  onSave,
  onCancel,
}: {
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("konto");
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button type="button" onClick={onSave} disabled={busy}>
        {t("speichern")}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
      >
        {t("abbrechen")}
      </button>
    </div>
  );
}

// Eine FAQ-Zeile im Info-Block (Icon links, Titel + Text).
function Faq({
  icon,
  titel,
  text,
  trenner,
}: {
  icon: string;
  titel: string;
  text: string;
  trenner?: boolean;
}) {
  return (
    <div className={`flex gap-4 p-4 ${trenner ? "border-t border-border" : ""}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
        <Icon icon={icon} className="size-5" />
      </span>
      <div>
        <p className="font-medium">{titel}</p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function EditFeld({
  defaultValue,
  type = "text",
  busy,
  fehler,
  onSave,
  onCancel,
}: {
  defaultValue: string;
  type?: string;
  busy: boolean;
  fehler: string | null;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("konto");
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="max-w-lg">
      <Input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        autoFocus
      />
      {fehler && <p className="mt-2 text-sm text-destructive">{fehler}</p>}
      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          onClick={() => onSave(value.trim())}
          disabled={busy || !value.trim()}
        >
          {t("speichern")}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
        >
          {t("abbrechen")}
        </button>
      </div>
    </div>
  );
}
