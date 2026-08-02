"use client";

// Bewertungen des Gastgebers (myBestDays-Look): Kennzahlen oben, darunter die
// Bewertungen aller Kanäle mit Antwortfeld.
//
// Die Note kommt in zwei Skalen aus dem Backend (Portale 0..10, myBestDays
// 1..5). Sterne kommen aus `score_5`; fehlt eine Note, werden KEINE Sterne
// gezeigt — eine leere Sternreihe wäre eine Null-Bewertung.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { antworteAufBewertung } from "@/lib/bewertungen-actions";
import {
  MARKETPLACE_CHANNEL,
  type ReviewSummary,
  type UnifiedReview,
} from "@/lib/bewertungen";
import { useRealtime } from "@/lib/use-realtime";

// Portal-Codes, deren technischer Name nicht der Markenname ist. Alle anderen
// Codes SIND der Markenname und werden unverändert gezeigt (nichts geraten).
const KANAL_LABEL: Record<string, string> = {
  BookingCom: "Booking.com",
  AirBNB: "Airbnb",
  GoogleHotelARI: "Google",
  CTrip: "Trip.com",
};

function kanalLabel(code: string): string {
  return KANAL_LABEL[code] ?? code;
}

export function BewertungenListe({
  initial,
  kennzahlen,
}: {
  initial: UnifiedReview[];
  kennzahlen: ReviewSummary | null;
}) {
  const t = useTranslations("bewertungen");
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [nurOffen, setNurOffen] = useState(false);

  // Realtime auf beiden Quellen: `reviews` speist myBestDays, `channex_review`
  // die Portale. Kein Polling, kein manuelles Neuladen — router.refresh() lässt
  // die Server Component neu laden (Muster wie objekte-liste).
  useRealtime({ table: "reviews", onChange: () => router.refresh() });
  useRealtime({ table: "channex_review", onChange: () => router.refresh() });

  const sichtbar = nurOffen ? items.filter((r) => !r.is_replied) : items;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">{t("titel")}</h1>
          <p className="text-sm text-muted-foreground">{t("untertitel")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={nurOffen}
            onChange={(e) => setNurOffen(e.target.checked)}
          />
          {t("nurOffen")}
        </label>
      </header>

      {kennzahlen && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Kachel
            label={t("durchschnitt")}
            wert={
              kennzahlen.average_5 == null
                ? "–"
                : kennzahlen.average_5.toFixed(2)
            }
          />
          <Kachel label={t("anzahl")} wert={String(kennzahlen.count)} />
          <Kachel
            label={t("unbeantwortet")}
            wert={String(kennzahlen.unanswered)}
          />
        </div>
      )}

      {sichtbar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <Icon
              icon="solar:star-bold-duotone"
              className="size-7 text-muted-foreground"
            />
          </span>
          <p className="text-lg font-semibold">{t("leer")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {sichtbar.map((r) => (
            <li key={`${r.source}-${r.id}`}>
              <Zeile
                review={r}
                onChanged={(neu) =>
                  setItems((alt) =>
                    alt.map((x) =>
                      x.source === neu.source && x.id === neu.id ? neu : x,
                    ),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kachel({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border p-5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{wert}</span>
    </div>
  );
}

function Sterne({ score }: { score: number | null }) {
  if (score == null) return null;
  const voll = Math.round(score);
  return (
    <span className="flex items-center gap-0.5" aria-label={String(score)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          icon={i <= voll ? "solar:star-bold" : "solar:star-linear"}
          className="size-4 text-amber-500"
        />
      ))}
    </span>
  );
}

function Zeile({
  review,
  onChanged,
}: {
  review: UnifiedReview;
  onChanged: (neu: UnifiedReview) => void;
}) {
  const t = useTranslations("bewertungen");
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState(review.reply ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function senden() {
    if (!text.trim()) return;
    setFehler(null);
    startTransition(async () => {
      const res = await antworteAufBewertung(
        review.source,
        review.id,
        text.trim(),
      );
      if (res.ok) {
        onChanged(res.review);
        setOffen(false);
      } else {
        setFehler(res.error);
      }
    });
  }

  const verdeckt =
    review.is_hidden ||
    (review.source === "marketplace" && !review.published_at);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              {review.channel_code === MARKETPLACE_CHANNEL
                ? review.channel_code
                : kanalLabel(review.channel_code)}
            </span>
            <span className="text-muted-foreground">· {review.author}</span>
            {review.property_title && (
              <span className="text-muted-foreground">
                · {review.property_title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Sterne score={review.score_5} />
            {review.score != null && (
              <span className="text-xs text-muted-foreground">
                {review.score} / {review.scale === "0-10" ? 10 : 5}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <span
            className={
              review.is_replied ? "text-muted-foreground" : "text-amber-600"
            }
          >
            {review.is_replied ? t("beantwortet") : t("offen")}
          </span>
          {verdeckt && (
            <span className="text-muted-foreground">{t("verdeckt")}</span>
          )}
          {!review.can_reply && (
            <span className="text-muted-foreground">{t("abgelaufen")}</span>
          )}
        </div>
      </div>

      {review.text && (
        <p className="text-sm whitespace-pre-line">{review.text}</p>
      )}

      {review.reply && !offen && (
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("deineAntwort")}
          </p>
          <p className="text-sm whitespace-pre-line">{review.reply}</p>
        </div>
      )}

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      {review.can_reply &&
        (offen ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("platzhalter")}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={senden}
                disabled={pending || !text.trim()}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t("senden")}
              </button>
              <button
                type="button"
                onClick={() => setOffen(false)}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
              >
                {t("abbrechen")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOffen(true)}
            className="self-start rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            {review.reply ? t("antwortAendern") : t("antworten")}
          </button>
        ))}
    </div>
  );
}
