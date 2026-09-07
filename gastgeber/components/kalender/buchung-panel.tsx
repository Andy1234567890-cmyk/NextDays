"use client";

// Rechtes Panel des Multi-Kalenders für eine BUCHUNG (Vorbild: Airbnbs
// „Buchung"-Slider): Kopfzeile mit Status, Gästezahl und Nächten, dann die
// Eckdaten als Zeilen, darunter die private Notiz.
//
// Der Betrag heißt „Auszahlung" nur dann, wenn er es ist. Bei einer Buchung
// über den Marktplatz behalten wir die Provision ein, bei einer Portalbuchung
// das Portal — beides steht in der Buchung selbst und wird hier nicht
// nachgerechnet. Deshalb: „Gesamtbetrag", und die Aufteilung zeigt der
// Kontostand (Wurzel 4 — keine erfundene Zahl an einer prominenten Stelle).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@nextdays/currency";

import { useFormatierung } from "@/lib/formatierung";
import { alsDatum } from "@/lib/kalender-datum";
import { PANEL_REM } from "@/lib/kalender-mass";
import {
  ladeBuchung,
  notizAnlegen,
  type BuchungDetail,
  type BuchungsNotiz,
} from "@/lib/kalender-actions";

const STATUS_SCHLUESSEL: Record<string, string> = {
  pending: "statusPending",
  confirmed: "statusConfirmed",
  cancelled: "statusCancelled",
  completed: "statusCompleted",
};

export function BuchungPanel({
  id,
  onSchliessen,
}: {
  id: string;
  onSchliessen: () => void;
}) {
  const t = useTranslations("kalender");
  const f = useFormatierung();
  const [buchung, setBuchung] = useState<BuchungDetail | null>(null);
  const [notizen, setNotizen] = useState<BuchungsNotiz[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    let aktiv = true;
    setBuchung(null);
    setFehler(null);
    void ladeBuchung(id).then((res) => {
      if (!aktiv) return;
      if (res.ok) {
        setBuchung(res.data.buchung);
        setNotizen(res.data.notizen);
      } else {
        setFehler(res.fehler);
      }
    });
    return () => {
      aktiv = false;
    };
  }, [id]);

  async function notizSpeichern() {
    setLaeuft(true);
    const res = await notizAnlegen(id, entwurf);
    setLaeuft(false);
    if (res.ok) {
      setNotizen([res.data, ...notizen]);
      setEntwurf("");
      toast.success(t("notizGespeichert"));
    } else {
      toast.error(res.fehler);
    }
  }

  return (
    <aside style={{ width: `${PANEL_REM}rem` }}
      className="flex shrink-0 flex-col overflow-y-auto border-s border-border">
      <div className="flex items-center justify-between px-5 pt-5">
        <button
          type="button"
          onClick={onSchliessen}
          aria-label={t("schliessen")}
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>

      <div className="px-5 pb-8">
        {fehler ? (
          <p className="mt-4 rounded-xl bg-rose-50 p-4 text-[0.9375rem] text-rose-900">
            {fehler}
          </p>
        ) : !buchung ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
            {t("laedt")}
          </p>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {buchung.is_owner_stay ? t("eigennutzung") : t("buchung")}
            </h2>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">
              {[
                t(STATUS_SCHLUESSEL[buchung.status] ?? "statusUnbekannt"),
                buchung.num_guests === 1
                  ? t("einGast")
                  : t("gaeste", { anzahl: buchung.num_guests }),
                buchung.nights === 1
                  ? t("eineNacht")
                  : t("naechte", { anzahl: buchung.nights }),
              ].join(" · ")}
            </p>

            <p className="mt-5 font-medium">{buchung.guest_name}</p>
            <p className="text-sm text-muted-foreground">{buchung.property_title}</p>
            <Link
              href="/nachrichten"
              className="mt-2 inline-block text-sm font-medium underline underline-offset-4 hover:opacity-70"
            >
              {t("zumPosteingang")}
            </Link>

            <dl className="mt-6">
              <Zeile label={t("checkIn")}>
                {f.datum(alsDatum(buchung.check_in), {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
                {buchung.checkin_time ? ` · ${buchung.checkin_time.slice(0, 5)}` : ""}
              </Zeile>
              <Zeile label={t("checkOut")}>
                {f.datum(alsDatum(buchung.check_out), {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
                {buchung.checkout_time ? ` · ${buchung.checkout_time.slice(0, 5)}` : ""}
              </Zeile>
              <Zeile label={t("gaesteGesamt")}>
                {t("gaesteAufteilung", {
                  erwachsene: buchung.adults,
                  kinder: buchung.children,
                })}
              </Zeile>
              <Zeile label={t("kanal")}>
                {buchung.ota_name || t(`kanal_${buchung.channel}`)}
              </Zeile>
              {/* Kein Betrag = keine Betrags-Sichtbarkeit für diese Rolle oder
                  eine Eigennutzung. Dann steht hier nichts, keine Null. */}
              {buchung.total_amount != null && (
                <Zeile label={t("gesamtbetrag")}>
                  {formatCurrency(buchung.total_amount, buchung.currency)}
                </Zeile>
              )}
              {buchung.paid_amount != null && buchung.total_amount != null && (
                <Zeile label={t("bezahlt")}>
                  {formatCurrency(buchung.paid_amount, buchung.currency)}
                </Zeile>
              )}
              {/* Wann der Gast WIRKLICH gebucht hat. Fehlt der Wert, wird der
                  Eingang bei uns als solcher benannt — nie unsere Uhr als
                  fremder Buchungszeitpunkt (Wurzel 5b). */}
              {(buchung.booked_at || buchung.created_at) && (
                <Zeile
                  label={buchung.booked_at ? t("gebuchtAm") : t("eingangBeiUns")}
                >
                  {f.datum(alsDatum(buchung.booked_at ?? buchung.created_at!), {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Zeile>
              )}
            </dl>

            <section className="mt-8">
              <h3 className="font-medium">{t("notizTitel")}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("notizHinweis")}
              </p>
              <textarea
                value={entwurf}
                onChange={(e) => setEntwurf(e.target.value)}
                rows={3}
                placeholder={t("notizPlatzhalter")}
                aria-label={t("notizTitel")}
                className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:border-foreground"
              />
              <button
                type="button"
                onClick={() => void notizSpeichern()}
                disabled={laeuft || entwurf.trim().length === 0}
                className="mt-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {laeuft ? t("wirdGespeichert") : t("notizSpeichern")}
              </button>

              <ul className="mt-4 space-y-3">
                {notizen.map((n) => (
                  <li key={n.id} className="rounded-xl bg-muted/50 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        n.author_name,
                        n.created_at
                          ? f.datumZeit(alsDatum(n.created_at), {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function Zeile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-[0.9375rem] text-muted-foreground">{label}</dt>
      <dd className="text-end text-[0.9375rem] font-medium">{children}</dd>
    </div>
  );
}
