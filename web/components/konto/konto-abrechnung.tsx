"use client";

// Konto → Abrechnung: das Guthaben des Betriebs und seine Auszahlungen.
//
// ZWEI TÖPFE, bewusst getrennt dargestellt — sie verhalten sich verschieden:
//  * „Dein Guthaben" = Stripe-Saldo des VERBUNDENEN KONTOS. Alles, was der
//    Betrieb selbst kassiert hat (Zusatzleistungen per Zahlungslink,
//    Direktbuchungen). Das Geld war nie bei uns; ausgezahlt wird es von Stripe
//    auf sein Bankkonto — nach Rhythmus oder auf Antrag.
//  * „Marktplatz-Buchungen" = Plattform-Ledger. Buchungen über myBestDays
//    laufen über unseren Saldo und werden nach der Abreise transferiert.
//
// Der Saldo ist eine EXTERNE Quelle (Stripe), kein DB-Datensatz — dafür gibt es
// kein Realtime-Abo, das etwas Echtes melden könnte. Deshalb: einmal laden,
// nach eigener Aktion aus der Antwort aktualisieren, plus ein sichtbarer
// Aktualisieren-Knopf. Kein verstecktes Polling.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Separator } from "@nextdays/ui/separator";

import {
  auszahlungAnfordern,
  getGuthaben,
  getPlattformAuszahlungen,
  getProtokoll,
  rhythmusSetzen,
  type Guthaben,
  type PayoutRhythmus,
  type PlattformUebersicht,
  type Protokoll,
  type ProtokollEintrag,
} from "@/lib/abrechnung";
import { formatCurrency } from "@/lib/currency";

const RHYTHMEN: PayoutRhythmus[] = ["manual", "daily", "weekly", "monthly"];

// Auszahlungs-Status, die Stripe kennt. Ein unbekannter Wert wird ROH gezeigt
// statt über einen fehlenden Übersetzungsschlüssel zu stolpern (MISSING_MESSAGE)
// oder als falscher Nachbar-Status zu erscheinen.
const STATUS_KEYS = ["paid", "pending", "in_transit", "canceled", "failed"];

// Die drei Reiter. „Empfangen" und „Versendet" sind zwei Blicke auf dasselbe
// Konto — getrennt, weil die Fragen verschieden sind: „Ist das Geld da?" gegen
// „Was ist rausgegangen?".
const REITER = ["abrechnung", "empfangen", "versendet"] as const;
type Reiter = (typeof REITER)[number];

// Stripe-Bewegungstypen, für die wir eine eigene Bezeichnung führen. Ein
// unbekannter Typ wird ROH gezeigt, statt über einen fehlenden
// Übersetzungsschlüssel zu stolpern oder als falscher Nachbar zu erscheinen.
const TYP_KEYS = [
  "charge",
  "payment",
  "payout",
  "refund",
  "payment_refund",
  "application_fee",
  "stripe_fee",
  "adjustment",
  "transfer",
];

function statusLabel(status: string, t: (key: string) => string): string {
  return STATUS_KEYS.includes(status) ? t(`status.${status}`) : status;
}

export function KontoAbrechnung() {
  const t = useTranslations("abrechnung");
  const locale = useLocale();
  const [guthaben, setGuthaben] = useState<Guthaben | null>(null);
  const [plattform, setPlattform] = useState<PlattformUebersicht | null>(null);
  const [protokoll, setProtokoll] = useState<Protokoll | null>(null);
  const [reiter, setReiter] = useState<Reiter>("abrechnung");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    setLaedt(true);
    const [g, p, pr] = await Promise.all([
      getGuthaben(),
      getPlattformAuszahlungen(),
      getProtokoll(),
    ]);
    if (g.ok) {
      setGuthaben(g.data);
      setFehler(null);
    } else {
      // Fehler NICHT als leeren Saldo darstellen: „0" wäre eine Aussage über
      // das Geld des Betriebs, die wir gerade nicht treffen können.
      setGuthaben(null);
      setFehler(g.error);
    }
    // Der Marktplatz-Teil darf fehlen (z. B. ohne Portal-Buchungen) — er ist
    // eine Ergänzung, kein Grund, die Seite scheitern zu lassen.
    setPlattform(p.ok ? p.data : null);
    setProtokoll(pr.ok ? pr.data : null);
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const geld = (cents: number, currency: string) =>
    formatCurrency(cents / 100, currency, locale);

  async function auszahlen(currency: string) {
    setBusy(true);
    const res = await auszahlungAnfordern(currency);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      t("auszahlungAngestossen", {
        betrag: geld(res.data.amount_cents, res.data.currency),
      }),
    );
    await laden();
  }

  async function rhythmusWaehlen(interval: PayoutRhythmus) {
    setBusy(true);
    const res = await rhythmusSetzen(
      interval,
      interval === "weekly"
        ? { weeklyAnchor: "thursday" }
        : interval === "monthly"
          ? { monthlyAnchor: 15 }
          : {},
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setGuthaben(res.data);
    toast.success(t("rhythmusGespeichert"));
  }

  if (laedt) {
    return <p className="text-sm text-muted-foreground">{t("laedt")}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("titel")}</h1>
          <p className="text-sm text-muted-foreground">{t("untertitel")}</p>
        </div>
        <Button variant="outline" onClick={() => void laden()} disabled={busy}>
          <Icon icon="ph:arrows-clockwise" className="size-4" />
          {t("aktualisieren")}
        </Button>
      </header>

      {fehler && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          <Icon
            icon="ph:warning"
            className="mr-1.5 inline size-4 align-text-bottom text-destructive"
          />
          {fehler}
        </div>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {REITER.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReiter(r)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              reiter === r
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`reiter.${r}`)}
          </button>
        ))}
      </nav>

      {reiter !== "abrechnung" && (
        <Bewegungen
          protokoll={protokoll}
          richtung={reiter === "empfangen" ? "eingang" : "ausgang"}
          geld={geld}
          locale={locale}
        />
      )}

      {reiter === "abrechnung" && guthaben && !guthaben.konto_verbunden && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <p className="text-sm text-foreground">{t("keinKonto")}</p>
            <Button asChild>
              <Link href="/konto">{t("kontoEinrichten")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {reiter === "abrechnung" && guthaben?.konto_verbunden && (
        <>
          <Saldo
            guthaben={guthaben}
            geld={geld}
            busy={busy}
            onAuszahlen={auszahlen}
          />
          <Rhythmus
            guthaben={guthaben}
            busy={busy}
            onWaehlen={rhythmusWaehlen}
          />
          <Historie guthaben={guthaben} geld={geld} locale={locale} />
        </>
      )}

      {reiter === "abrechnung" && (
        <Marktplatz uebersicht={plattform} geld={geld} />
      )}
    </div>
  );
}

function Saldo({
  guthaben,
  geld,
  busy,
  onAuszahlen,
}: {
  guthaben: Guthaben;
  geld: (cents: number, currency: string) => string;
  busy: boolean;
  onAuszahlen: (currency: string) => Promise<void>;
}) {
  const t = useTranslations("abrechnung");
  // Währungen aus BEIDEN Töpfen, damit eine Währung mit nur ausstehendem
  // Guthaben nicht unsichtbar wird.
  const waehrungen = Array.from(
    new Set([
      ...guthaben.verfuegbar.map((p) => p.currency),
      ...guthaben.ausstehend.map((p) => p.currency),
    ]),
  );
  const betrag = (liste: { currency: string; amount_cents: number }[], cur: string) =>
    liste.find((p) => p.currency === cur)?.amount_cents ?? 0;
  const nurAufAntrag = guthaben.interval === "manual";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("guthaben.titel")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("guthaben.hinweis")}</p>
        </div>

        {waehrungen.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("guthaben.leer")}</p>
        )}

        {waehrungen.map((cur) => {
          const verfuegbar = betrag(guthaben.verfuegbar, cur);
          const ausstehend = betrag(guthaben.ausstehend, cur);
          // Sicherheitseinlage (0473): zurückgehaltene Deckung für mögliche
          // Erstattungen. `auszahlbar` kommt vom Server und wird NICHT hier aus
          // verfügbar − einlage gebildet — sonst zeigt die Oberfläche irgendwann
          // eine andere Zahl als die, mit der der Server rechnet.
          const einlage = betrag(guthaben.einlage, cur);
          const auszahlbar = betrag(guthaben.auszahlbar, cur);
          return (
            <div
              key={cur}
              className="flex flex-wrap items-end justify-between gap-4 rounded-(--radius) border border-border p-4"
            >
              <div className="flex flex-wrap gap-8">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("guthaben.verfuegbar")}
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {geld(verfuegbar, cur)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("guthaben.ausstehend")}
                  </p>
                  <p className="text-lg text-muted-foreground">
                    {geld(ausstehend, cur)}
                  </p>
                </div>
                {/* Die Einlage wird nur gezeigt, wenn wirklich etwas
                    zurückgehalten wird. Eine Dauerzeile „0,00" würde eine
                    Einschränkung suggerieren, die nicht besteht. */}
                {einlage > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("guthaben.einlage")}
                    </p>
                    <p className="text-lg text-foreground">
                      {geld(einlage, cur)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {guthaben.einlage_frei_ab
                        ? t("guthaben.einlageFreiAb", {
                            datum: new Date(
                              guthaben.einlage_frei_ab,
                            ).toLocaleDateString(),
                          })
                        : t("guthaben.einlageErstattungFaellig")}
                    </p>
                  </div>
                )}
              </div>
              <Button
                onClick={() => void onAuszahlen(cur)}
                disabled={
                  busy ||
                  auszahlbar <= 0 ||
                  !nurAufAntrag ||
                  !guthaben.payouts_enabled
                }
              >
                <Icon icon="ph:bank" className="size-4" />
                {t("guthaben.auszahlen")}
              </Button>
            </div>
          );
        })}

        {/* Der Unterschied zwischen „kein Guthaben" und „gebundenes Guthaben"
            muss im Klartext stehen: Sonst liest der Betrieb einen Betrag und
            einen ausgegrauten Knopf ohne Erklärung. */}
        {waehrungen.some(
          (cur) =>
            betrag(guthaben.einlage, cur) > 0 &&
            betrag(guthaben.auszahlbar, cur) <= 0,
        ) && (
          <p className="text-sm text-muted-foreground">
            <Icon
              icon="ph:shield-check"
              className="mr-1.5 inline size-4 align-text-bottom"
            />
            {t("guthaben.einlageHinweis")}
          </p>
        )}
        {!guthaben.payouts_enabled && (
          <p className="text-sm text-muted-foreground">
            <Icon
              icon="ph:info"
              className="mr-1.5 inline size-4 align-text-bottom"
            />
            {t("guthaben.nochNichtFreigeschaltet")}
          </p>
        )}
        {guthaben.payouts_enabled && !nurAufAntrag && (
          <p className="text-sm text-muted-foreground">
            <Icon
              icon="ph:info"
              className="mr-1.5 inline size-4 align-text-bottom"
            />
            {t("guthaben.automatischHinweis")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("guthaben.ausstehendHinweis")}
        </p>
      </CardContent>
    </Card>
  );
}

function Rhythmus({
  guthaben,
  busy,
  onWaehlen,
}: {
  guthaben: Guthaben;
  busy: boolean;
  onWaehlen: (interval: PayoutRhythmus) => Promise<void>;
}) {
  const t = useTranslations("abrechnung");
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("rhythmus.titel")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("rhythmus.hinweis")}</p>
        </div>
        <NativeSelect
          className="max-w-sm"
          value={guthaben.interval || ""}
          disabled={busy}
          onChange={(e) => void onWaehlen(e.target.value as PayoutRhythmus)}
        >
          {/* Leerer Eintrag nur, solange Stripe keinen Rhythmus meldet — nie
              einen Wert vortäuschen, der dort nicht steht. */}
          {!guthaben.interval && <option value="">—</option>}
          {RHYTHMEN.map((r) => (
            <option key={r} value={r}>
              {t(`rhythmus.${r}`)}
            </option>
          ))}
        </NativeSelect>
      </CardContent>
    </Card>
  );
}

function Historie({
  guthaben,
  geld,
  locale,
}: {
  guthaben: Guthaben;
  geld: (cents: number, currency: string) => string;
  locale: string;
}) {
  const t = useTranslations("abrechnung");
  const datum = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale) : "—";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <h2 className="text-base font-semibold text-foreground">
          {t("historie.titel")}
        </h2>
        {guthaben.letzte_auszahlungen.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("historie.leer")}</p>
        ) : (
          <ul className="flex flex-col">
            {guthaben.letzte_auszahlungen.map((p, i) => (
              <li key={p.id}>
                {i > 0 && <Separator className="my-2" />}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {geld(p.amount_cents, p.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(p.automatic ? "historie.automatisch" : "historie.beantragt")}
                      {" · "}
                      {t("historie.angelegt", { datum: datum(p.created) })}
                      {p.arrival_date
                        ? ` · ${t("historie.gutschrift", { datum: datum(p.arrival_date) })}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {statusLabel(p.status, t)}
                  </span>
                </div>
                {p.failure_message && (
                  <p className="mt-1 text-xs text-destructive">{p.failure_message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Marktplatz({
  uebersicht,
  geld,
}: {
  uebersicht: PlattformUebersicht | null;
  geld: (cents: number, currency: string) => string;
}) {
  const t = useTranslations("abrechnung");
  const summen = uebersicht?.summary ?? [];
  if (summen.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("marktplatz.titel")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("marktplatz.hinweis")}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {summen.map((s) => (
            <li
              key={s.currency}
              className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-border p-3"
            >
              <span className="text-sm text-muted-foreground">
                {t("marktplatz.offen")}
              </span>
              <span className="text-sm font-medium text-foreground">
                {geld(s.pending_amount_cents, s.currency)}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("marktplatz.ausgezahlt")}
              </span>
              <span className="text-sm text-foreground">
                {geld(s.paid_amount_cents, s.currency)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// --- Protokoll: empfangene bzw. versendete Zahlungen -------------------------
//
// Quelle ist Stripe selbst, damit auch Bewegungen auftauchen, die nie durch
// unsere Oberfläche liefen (Erstattung im Stripe-Dashboard, Gebühr,
// Rückbelastung). Im Eingang stehen zusätzlich die OFFENEN Forderungen — ohne
// sie zeigte das Protokoll nur, was schon da ist, und nie, worauf der Betrieb
// noch wartet.
function Bewegungen({
  protokoll,
  richtung,
  geld,
  locale,
}: {
  protokoll: Protokoll | null;
  richtung: "eingang" | "ausgang";
  geld: (cents: number, currency: string) => string;
  locale: string;
}) {
  const t = useTranslations("abrechnung");
  const zeilen = richtung === "eingang" ? protokoll?.eingang : protokoll?.ausgang;
  const offen = richtung === "eingang" ? (protokoll?.offen ?? []) : [];
  const datum = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale) : "—";

  return (
    <div className="flex flex-col gap-4">
      {offen.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("protokoll.offenTitel")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("protokoll.offenHinweis")}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {offen.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-border p-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-foreground">
                      {p.positionen.length > 0
                        ? p.positionen.join(", ")
                        : t("protokoll.zusatzleistungen")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {datum(p.created_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      {t("protokoll.statusOffen")}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {geld(p.amount_cents, p.currency)}
                    </span>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline"
                    >
                      {t("protokoll.zahlseite")}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t(richtung === "eingang" ? "protokoll.eingangTitel" : "protokoll.ausgangTitel")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                richtung === "eingang"
                  ? "protokoll.eingangHinweis"
                  : "protokoll.ausgangHinweis",
              )}
            </p>
          </div>

          {!zeilen || zeilen.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("protokoll.leer")}</p>
          ) : (
            <ul className="flex flex-col">
              {zeilen.map((z, i) => (
                <li key={z.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <Zeile eintrag={z} geld={geld} datum={datum} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Zeile({
  eintrag,
  geld,
  datum,
}: {
  eintrag: ProtokollEintrag;
  geld: (cents: number, currency: string) => string;
  datum: (iso: string | null) => string;
}) {
  const t = useTranslations("abrechnung");
  const typLabel = TYP_KEYS.includes(eintrag.typ)
    ? t(`protokoll.typ.${eintrag.typ}`)
    : eintrag.typ;
  // Gebühren nur zeigen, wenn welche anfielen — eine Zeile „Gebühr 0,00" ist
  // Rauschen.
  const mitGebuehr = eintrag.fee_cents !== 0;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <span>{typLabel}</span>
          {eintrag.zusatzleistungen.length > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
              {eintrag.zusatzleistungen.join(", ")}
            </span>
          )}
          {eintrag.richtung === "eingang" && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
              {t("protokoll.statusBezahlt")}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {datum(eintrag.created)}
          {eintrag.beschreibung ? ` · ${eintrag.beschreibung}` : ""}
          {eintrag.available_on
            ? ` · ${t("protokoll.verfuegbarAb", { datum: datum(eintrag.available_on) })}`
            : ""}
        </p>
        {eintrag.reservation_id && (
          <Link
            href={`/reservierungen/${eintrag.reservation_id}`}
            className="text-xs text-accent hover:underline"
          >
            {t("protokoll.zurBuchung")}
          </Link>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-foreground">
          {geld(eintrag.amount_cents, eintrag.currency)}
        </p>
        {mitGebuehr && (
          <p className="text-xs text-muted-foreground">
            {t("protokoll.gebuehr", {
              betrag: geld(eintrag.fee_cents, eintrag.currency),
            })}
            {" · "}
            {t("protokoll.netto", {
              betrag: geld(eintrag.net_cents, eintrag.currency),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
