"use client";

// Akte-Reiter „Änderungen" (Vertrag §3.1): terminierte Akte-Änderungen.
//
// WAS DAS FACHLICH IST
// --------------------
// Eine Lohnerhöhung zum 1. des nächsten Monats, ein Stundenwechsel nach der
// Probezeit, ein Positionswechsel zum Quartalsbeginn. Bisher musste jemand am
// richtigen Tag daran denken und die Akte von Hand ändern — hier wird die
// Änderung EINMAL erfasst und der stündliche Takt (`aenderungen_anwenden`)
// setzt sie am Stichtag.
//
// WARUM NUR EINE AUSWAHL VON FELDERN
// ----------------------------------
// Die Liste steht in `AENDERUNG_FELDER` (personal-betrieb-typen.ts) und
// enthält bewusst NICHT die verschlüsselten Kennungen (Steuer-ID, SV-Nummer,
// IBAN): sie würden hier als Klartext-JSON monatelang in einer Warteschlange
// liegen. Der Server prüft die Liste ohnehin nach und antwortet mit 422
// `feld_unbekannt` — die Auswahl hier ist die freundliche Vorstufe, nicht der
// Schutz (Wurzel 3: der Schutz sitzt am Server).
//
// LÖSCHEN NUR SOLANGE NICHT ANGEWENDET
// ------------------------------------
// Eine angewendete Änderung ist Geschichte, nicht Plan: sie steht schon in der
// Akte, und ein Löschen hier würde die Akte NICHT zurückdrehen. Der Knopf
// verschwindet deshalb, sobald `angewendet_am` gesetzt ist — und der Server
// antwortet in dem Fall 409 `schon_angewendet`, was hier als Satz erscheint.
//
// FEHLERCODES: `feld_unbekannt`, `wert_ungueltig`, `gueltig_ab_vergangen`,
// `schon_angewendet` — alle über `personal.fehlercode.<code>`.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  createAkteAenderung,
  deleteAkteAenderung,
  listAkteAenderungen,
} from "@/lib/personal-betrieb";
import {
  AENDERUNG_FELDER,
  type AenderungFeld,
  type AkteAenderung,
} from "@/lib/personal-betrieb-typen";
import { BESCHAEFTIGUNGSARTEN, type Fremdfirma, heuteIso } from "@/lib/personal-typen";
import { formatDate, formatDateTime } from "@/lib/utils";

import { Modal, ReiterKopf, textZuMinor, zahlOderNull } from "./kartei-helfer";

/** Eine Zeile im Anlege-Dialog: gewähltes Feld + eingegebener Text. */
type Zeile = { key: string; text: string };

export function AkteAenderungen({
  userId,
  initial,
  fremdfirmen,
  currency,
  kannBearbeiten,
}: {
  userId: string;
  initial: AkteAenderung[];
  /** Für das Feld `firma_id` — ohne Firmen wird es nicht angeboten. */
  fremdfirmen: Fremdfirma[];
  /** Währung der Akte. Fehlt sie, werden Geldfelder NICHT angeboten: ein
   *  Betrag ohne Währung ist ein Datenfehler, kein Vorschlag (Wurzel 4). */
  currency: string | null;
  kannBearbeiten: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [liste, setListe] = useState(initial);
  const [neu, setNeu] = useState(false);

  const nachladen = useCallback(async () => {
    const res = await listAkteAenderungen(userId);
    if (res.ok) setListe(res.data);
  }, [userId]);

  async function loeschen(a: AkteAenderung) {
    if (a.angewendet_am) {
      toast.error(t("akte.aenderungen.nurOffene"));
      return;
    }
    if (!window.confirm(t("akte.aenderungen.loeschenFrage", { datum: formatDate(a.gueltig_ab, locale) })))
      return;
    const res = await deleteAkteAenderung(a.id);
    if (!res.ok) return void toast.error(fehlerText(t, res.details?.code, res.error));
    toast.success(t("akte.aenderungen.geloescht"));
    void nachladen();
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <ReiterKopf
        titel={t("akte.aenderungen.titel")}
        hint={t("akte.aenderungen.hint")}
        onNeu={kannBearbeiten ? () => setNeu(true) : undefined}
        neuLabel={t("akte.aenderungen.neu")}
      />

      {liste.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("akte.aenderungen.keine")}</p>
      ) : (
        <ul className="divide-y">
          {liste.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  a.angewendet_am
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {a.angewendet_am
                  ? t("akte.aenderungen.angewendet", {
                      datum: formatDate(a.angewendet_am, locale),
                    })
                  : t("akte.aenderungen.offen")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t("akte.aenderungen.gueltigAb")}: {formatDate(a.gueltig_ab, locale)}
                </p>
                {/* Felder in Klartext, nicht als JSON-Dump: „Stundenlohn:
                    18,50" statt {"stundenlohn_minor":1850}. */}
                <ul className="mt-1 text-xs text-muted-foreground">
                  {Object.entries(a.felder).map(([k, v]) => (
                    <li key={k}>
                      {feldLabel(t, k)}: <span className="font-medium">{wertText(t, locale, k, v, currency)}</span>
                    </li>
                  ))}
                </ul>
                {a.grund && <p className="mt-1 text-xs text-muted-foreground">{a.grund}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.erstellt_von_name
                    ? t("akte.aenderungen.erstelltVon", { name: a.erstellt_von_name })
                    : ""}
                  {a.created_at ? ` · ${formatDateTime(a.created_at, locale)}` : ""}
                </p>
              </div>
              {kannBearbeiten && !a.angewendet_am && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("loeschen")}
                  onClick={() => void loeschen(a)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {neu && (
        <NeuDialog
          userId={userId}
          fremdfirmen={fremdfirmen}
          currency={currency}
          onClose={() => setNeu(false)}
          onSaved={() => {
            setNeu(false);
            void nachladen();
          }}
        />
      )}
    </section>
  );
}

/** Fehlercode als Satz; unbekannte Codes zeigen die Servermeldung (Wurzel 5). */
function fehlerText(
  t: ReturnType<typeof useTranslations<"personal">>,
  code: unknown,
  ersatz: string,
): string {
  if (typeof code !== "string") return ersatz;
  const schluessel = `fehlercode.${code}`;
  return t.has(schluessel) ? t(schluessel) : ersatz;
}

/**
 * Beschriftung eines Akte-Feldes.
 *
 * Die Akte benennt ihre Felder unter `personal.akte.felder.<feld>` — dort
 * heissen die Geldfelder aber ohne das `_minor`-Suffix (die Maske zeigt Major),
 * und `firma_id` heisst dort `firma`. Diese Abbildung ist deshalb kein
 * Notbehelf, sondern die Bruecke zwischen DB-Spaltennamen (die der Vertrag
 * fuer `felder` verlangt) und den bestehenden Beschriftungen — statt in
 * `de.json` sechs Dubletten anzulegen.
 */
const LABEL_ALIAS: Record<string, string> = {
  stundenlohn_minor: "akte.felder.stundenlohn",
  gehalt_minor: "akte.felder.gehalt",
  firma_id: "akte.felder.firma",
  verdienstgrenze_minor: "akte.verdienstgrenze.betrag",
};

function feldLabel(t: ReturnType<typeof useTranslations<"personal">>, key: string): string {
  const alias = LABEL_ALIAS[key];
  if (alias && t.has(alias)) return t(alias);
  const direkt = `akte.felder.${key}`;
  if (t.has(direkt)) return t(direkt);
  // Kein erfundener Klartext: der technische Name ist ehrlicher als ein
  // geratener (Wurzel 4).
  return key;
}

/** Rohwert einer geplanten Änderung menschenlesbar. */
function wertText(
  t: ReturnType<typeof useTranslations<"personal">>,
  locale: string,
  key: string,
  wert: unknown,
  currency: string | null,
): string {
  if (wert === null || wert === undefined || wert === "") return "—";
  const feld = AENDERUNG_FELDER.find((f) => f.key === key);
  if (feld?.typ === "geld" && typeof wert === "number") {
    // Minor → Major. OHNE Währung wird der reine Betrag gezeigt und kein
    // Symbol erfunden (Wurzel 4); `formatCurrency` verlangt eine Währung.
    const betrag = (wert / 100).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency ? `${betrag} ${currency}` : betrag;
  }
  if (feld?.typ === "datum" && typeof wert === "string") return formatDate(wert, locale);
  if (feld?.typ === "beschaeftigungsart" && typeof wert === "string") {
    const k = `beschaeftigungsart.${wert}`;
    return t.has(k) ? t(k) : wert;
  }
  return String(wert);
}

function NeuDialog({
  userId,
  fremdfirmen,
  currency,
  onClose,
  onSaved,
}: {
  userId: string;
  fremdfirmen: Fremdfirma[];
  currency: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("personal");
  const heute = heuteIso();
  const [gueltigAb, setGueltigAb] = useState("");
  const [grund, setGrund] = useState("");
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [busy, setBusy] = useState(false);

  /** Felder, die noch nicht gewählt sind — und die überhaupt angeboten werden
   *  dürfen: Geld nur mit Währung, `firma_id` nur mit Fremdfirmen. */
  const verfuegbar = AENDERUNG_FELDER.filter(
    (f) =>
      !zeilen.some((z) => z.key === f.key) &&
      (f.typ !== "geld" || currency !== null) &&
      (f.key !== "firma_id" || fremdfirmen.length > 0),
  );

  function hinzufuegen(key: string) {
    if (!key) return;
    setZeilen((v) => [...v, { key, text: "" }]);
  }

  /** Text → Wert je Feldtyp. `null` heißt „leeren" — das ist eine gültige
   *  Änderung (Austritt entfernen), aber KEIN stiller Ersatzwert. */
  function wertFuer(feld: AenderungFeld, text: string): unknown | "ungueltig" {
    const s = text.trim();
    if (!s) return null;
    if (feld.typ === "geld") {
      const minor = textZuMinor(s);
      return minor === null ? "ungueltig" : minor;
    }
    if (feld.typ === "zahl") {
      const n = zahlOderNull(s);
      return n === null ? "ungueltig" : n;
    }
    if (feld.typ === "datum") return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "ungueltig";
    return s;
  }

  const gueltig =
    gueltigAb !== "" &&
    gueltigAb >= heute &&
    zeilen.length > 0 &&
    zeilen.some((z) => z.text.trim() !== "");

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (gueltigAb < heute) {
      toast.error(t("fehlercode.gueltig_ab_vergangen"));
      return;
    }
    const felder: Record<string, unknown> = {};
    for (const z of zeilen) {
      const feld = AENDERUNG_FELDER.find((f) => f.key === z.key);
      if (!feld) continue;
      const w = wertFuer(feld, z.text);
      if (w === "ungueltig") {
        toast.error(`${feldLabel(t, z.key)}: ${t("fehlercode.wert_ungueltig")}`);
        return;
      }
      felder[z.key] = w;
    }
    if (Object.keys(felder).length === 0) {
      toast.error(t("akte.aenderungen.leerHinweis"));
      return;
    }
    setBusy(true);
    const res = await createAkteAenderung(userId, {
      gueltig_ab: gueltigAb,
      felder,
      grund: grund.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return void toast.error(fehlerText(t, res.details?.code, res.error));
    toast.success(t("akte.aenderungen.gespeichert"));
    onSaved();
  }

  return (
    <Modal
      titel={t("akte.aenderungen.neu")}
      onClose={onClose}
      onSubmit={absenden}
      busy={busy || !gueltig}
      breit
    >
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t("akte.aenderungen.gueltigAb")}</span>
        {/* Der DatePicker kennt keine Untergrenze — die Prüfung sitzt deshalb
            im Absenden (und noch einmal am Server, 422
            `gueltig_ab_vergangen`). Ein vergangenes Datum wird hier sofort
            benannt, statt es abzuschicken. */}
        <DatePicker value={gueltigAb} onChange={setGueltigAb} />
        {gueltigAb !== "" && gueltigAb < heute && (
          <span className="text-xs text-destructive">{t("fehlercode.gueltig_ab_vergangen")}</span>
        )}
        <span className="text-xs text-muted-foreground">{t("akte.aenderungen.gueltigAbHint")}</span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-medium">{t("akte.aenderungen.felder")}</span>
        <span className="text-xs text-muted-foreground">{t("akte.aenderungen.felderHint")}</span>
        {zeilen.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("akte.aenderungen.keineFelder")}</p>
        )}
        {zeilen.map((z, i) => {
          const feld = AENDERUNG_FELDER.find((f) => f.key === z.key);
          return (
            <div key={z.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <span className="text-sm">{feldLabel(t, z.key)}</span>
              {feld?.typ === "beschaeftigungsart" ? (
                <NativeSelect
                  value={z.text}
                  onChange={(e) =>
                    setZeilen((v) => v.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                >
                  <option value="">—</option>
                  {BESCHAEFTIGUNGSARTEN.map((b) => (
                    <option key={b} value={b}>
                      {t(`beschaeftigungsart.${b}`)}
                    </option>
                  ))}
                </NativeSelect>
              ) : feld?.typ === "firma" ? (
                <NativeSelect
                  value={z.text}
                  onChange={(e) =>
                    setZeilen((v) => v.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                >
                  <option value="">—</option>
                  {fremdfirmen.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </NativeSelect>
              ) : feld?.typ === "datum" ? (
                <DatePicker
                  value={z.text}
                  onChange={(v) =>
                    setZeilen((x) => x.map((y, j) => (j === i ? { ...y, text: v } : y)))
                  }
                />
              ) : (
                <Input
                  value={z.text}
                  inputMode={feld?.typ === "geld" || feld?.typ === "zahl" ? "decimal" : "text"}
                  placeholder={feld?.typ === "geld" && currency ? currency : undefined}
                  onChange={(e) =>
                    setZeilen((v) => v.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("loeschen")}
                onClick={() => setZeilen((v) => v.filter((_, j) => j !== i))}
              >
                <Icon icon="ph:x" className="size-4" />
              </Button>
            </div>
          );
        })}
        {verfuegbar.length > 0 && (
          <NativeSelect
            value=""
            className="w-fit"
            onChange={(e) => {
              hinzufuegen(e.target.value);
              e.currentTarget.value = "";
            }}
          >
            <option value="">{t("akte.aenderungen.feldWaehlen")}</option>
            {verfuegbar.map((f) => (
              <option key={f.key} value={f.key}>
                {feldLabel(t, f.key)}
              </option>
            ))}
          </NativeSelect>
        )}
        {currency === null && (
          <p className="text-xs text-amber-700">{t("akte.aenderungen.ohneWaehrung")}</p>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-medium">{t("akte.aenderungen.grund")}</span>
        <Textarea rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} />
      </label>
    </Modal>
  );
}
