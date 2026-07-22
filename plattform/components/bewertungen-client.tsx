// Bewertungen (Client-Insel): eigene Bewertungen anzeigen/bearbeiten + Formular
// „abgeschlossene Buchung bewerten" (Sterne 1–5 + Text). Für vergangene
// Buchungen ohne Bewertung ein CTA.
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { Sterne, SterneWahl } from "@/components/sterne";
import {
  type MyReview,
  aktualisiereBewertung,
  erstelleBewertung,
} from "@/lib/guest-reviews";
import { formatDate } from "@/lib/format";

// Vergangene Buchung, die (noch) bewertet werden kann.
export type BewertbareBuchung = {
  reservation_id: string;
  property_id: string;
  title: string;
  photo: string | null;
  check_in: string;
  check_out: string;
};

type FormState = {
  reservationId: string;
  reviewId: string | null; // gesetzt = Bearbeitung
  title: string;
  rating: number;
  text: string;
};

export function BewertungenClient({
  initialReviews,
  bewertbar,
  reviewTitles,
  autoReservation,
}: {
  initialReviews: MyReview[];
  bewertbar: BewertbareBuchung[];
  // property_id → Objekt-Titel (für die Anzeige eigener Bewertungen).
  reviewTitles: Record<string, string>;
  // ?reservation=<id> → Formular direkt öffnen.
  autoReservation: string | null;
}) {
  const [reviews, setReviews] = useState<MyReview[]>(initialReviews);
  const [offen, setOffen] = useState<BewertbareBuchung[]>(bewertbar);
  const [form, setForm] = useState<FormState | null>(() => {
    if (!autoReservation) return null;
    const b = bewertbar.find((x) => x.reservation_id === autoReservation);
    if (!b) return null;
    return {
      reservationId: b.reservation_id,
      reviewId: null,
      title: b.title,
      rating: 5,
      text: "",
    };
  });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function starteNeu(b: BewertbareBuchung) {
    setFehler(null);
    setForm({
      reservationId: b.reservation_id,
      reviewId: null,
      title: b.title,
      rating: 5,
      text: "",
    });
  }

  function starteBearbeiten(r: MyReview) {
    setFehler(null);
    setForm({
      // reservation_id kann null sein (FK on delete set null) — beim Bearbeiten
      // einer bestehenden Bewertung wird ohnehin nur reviewId (PATCH) genutzt.
      reservationId: r.reservation_id ?? "",
      reviewId: r.id,
      title: reviewTitles[r.property_id] ?? "Unterkunft",
      rating: r.rating,
      text: r.text ?? "",
    });
  }

  async function absenden() {
    if (!form || busy) return;
    setBusy(true);
    setFehler(null);
    const res = form.reviewId
      ? await aktualisiereBewertung(form.reviewId, {
          rating: form.rating,
          text: form.text.trim() || undefined,
        })
      : await erstelleBewertung({
          reservation_id: form.reservationId,
          rating: form.rating,
          text: form.text.trim() || undefined,
        });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    const gespeichert = res.data;
    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.id === gespeichert.id);
      if (idx >= 0) {
        const kopie = [...prev];
        kopie[idx] = gespeichert;
        return kopie;
      }
      return [gespeichert, ...prev];
    });
    // War es eine neue Bewertung, aus der „offen"-Liste entfernen.
    if (!form.reviewId) {
      setOffen((o) =>
        o.filter((b) => b.reservation_id !== form.reservationId),
      );
    }
    setForm(null);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Formular */}
      {form && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              {form.reviewId ? "Bewertung bearbeiten" : "Aufenthalt bewerten"}
            </h2>
            <button
              type="button"
              onClick={() => setForm(null)}
              aria-label="Schließen"
              className="text-muted-foreground hover:text-foreground"
            >
              <Icon icon="ph:x" className="size-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{form.title}</p>

          <div className="mt-4">
            <SterneWahl
              wert={form.rating}
              onChange={(n) => setForm({ ...form, rating: n })}
            />
          </div>

          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            rows={4}
            placeholder="Wie war dein Aufenthalt? (optional)"
            className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
          />

          {fehler && (
            <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
              {fehler}
            </p>
          )}

          <button
            type="button"
            onClick={absenden}
            disabled={busy}
            className="mt-4 flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Icon icon="ph:spinner" className="size-4 animate-spin" />}
            {form.reviewId ? "Änderungen speichern" : "Bewertung abgeben"}
          </button>
        </div>
      )}

      {/* Offene Bewertungen (CTA) */}
      {offen.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">
            Warten auf deine Bewertung
          </h2>
          <div className="flex flex-col gap-3">
            {offen.map((b) => (
              <div
                key={b.reservation_id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {b.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.photo}
                      alt={b.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground">
                      <Icon icon="ph:image" className="size-5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(b.check_in)} – {formatDate(b.check_out)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => starteNeu(b)}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
                >
                  <Icon icon="ph:star" className="size-4" />
                  Bewerten
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Eigene Bewertungen */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Deine Bewertungen
        </h2>
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Icon icon="ph:star" className="size-7" />
            </span>
            <p className="text-sm text-muted-foreground">
              Du hast noch keine Bewertungen abgegeben.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {reviewTitles[r.property_id] ?? "Unterkunft"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Sterne wert={r.rating} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => starteBearbeiten(r)}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    <Icon icon="ph:pencil-simple" className="size-3.5" />
                    Bearbeiten
                  </button>
                </div>
                {r.text && (
                  <p className="mt-3 whitespace-pre-line text-sm text-foreground">
                    {r.text}
                  </p>
                )}
                {r.host_reply && (
                  <div className="mt-3 rounded-xl bg-secondary p-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Antwort des Gastgebers
                      {r.host_reply_at ? ` · ${formatDate(r.host_reply_at)}` : ""}
                    </p>
                    <p className="mt-1 text-sm">{r.host_reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
