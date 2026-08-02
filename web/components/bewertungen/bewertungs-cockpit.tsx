"use client";

// Bewertungs-Cockpit: EINE Liste über alle Kanäle (myBestDays + Portale),
// Kennzahlen oben, Filter darunter, Antwort direkt an der Zeile.
//
// Die Note kommt in zwei Skalen aus dem Backend (Portale 0..10, myBestDays
// 1..5). Angezeigt werden Sterne aus `score_5`; die Rohnote steht daneben, damit
// niemand die Umrechnung für die Wahrheit hält. Fehlt eine Note, werden KEINE
// Sterne gezeigt (statt 0 zu erfinden).
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { channelLabel, channelLogo } from "@/lib/channel-logos";
import { formatDate } from "@/lib/utils";
import {
  type ReviewSource,
  type ReviewSummary,
  type UnifiedReview,
  deleteReviewReply,
  listReviews,
  rateGuest,
  replyToReview,
  sendOtaGuestReview,
  syncOtaReviews,
} from "@/lib/reviews";
import { MARKETPLACE_CHANNEL } from "@/lib/reviews-kanal";

const SEITE = 25;

// Gast bewerten geht nur dort, wo der Kanal es zulässt: auf dem eigenen
// Marktplatz immer (sofern die Bewertung an einer Reservierung hängt), bei den
// Portalen ausschließlich bei Airbnb — Booking.com und Expedia kennen keine
// Bewertung des Gasts. Für andere Portale wird der Button NICHT gezeigt, statt
// ihn in einen Fehler laufen zu lassen.
function kannGastBewerten(review: UnifiedReview): boolean {
  if (review.guest_rated) return false;
  if (review.source === "marketplace") return Boolean(review.reservation_id);
  return review.channel_code === "AirBNB";
}

// Kategorien, für die es einen Übersetzungsschlüssel gibt: die 6 eigenen
// (myBestDays) plus die von Booking.com/Airbnb gelieferten. Alles andere wird
// als Rohwert gezeigt.
const KATEGORIEN = new Set([
  "cleanliness",
  "communication",
  "location",
  "value",
  "accuracy",
  "checkin",
  "clean",
  "comfort",
  "facilities",
  "staff",
  "services",
]);

type Props = {
  initial: UnifiedReview[];
  initialTotal: number;
  summary: ReviewSummary | null;
  canManage: boolean;
};

export function BewertungsCockpit({
  initial,
  initialTotal,
  summary,
  canManage,
}: Props) {
  const t = useTranslations("reviews");
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [quelle, setQuelle] = useState<ReviewSource | "">("");
  const [kanal, setKanal] = useState("");
  const [nurOffen, setNurOffen] = useState(false);
  const [seite, setSeite] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Ungefilterte Startansicht = die Server-Wahrheit. Nach einem Realtime-
  // Ereignis lädt RealtimeRefresh die Server Component neu und schickt frische
  // Props — ohne diesen Abgleich behielte `useState` den alten Stand und die
  // Liste zeigte z. B. weiter „noch nicht veröffentlicht", obwohl die Gegenseite
  // längst bewertet hat. Nur im Standardzustand übernehmen: sonst würde ein
  // Ereignis eine gefilterte oder geblätterte Ansicht zurücksetzen.
  const standardAnsicht = !quelle && !kanal && !nurOffen && seite === 0;
  useEffect(() => {
    if (!standardAnsicht) return;
    setItems(initial);
    setTotal(initialTotal);
  }, [initial, initialTotal, standardAnsicht]);

  // Jede Filter- oder Seitenänderung lädt serverseitig neu (damit `total` und
  // die Sortierung über beide Quellen stimmen).
  const [erstLauf, setErstLauf] = useState(true);
  useEffect(() => {
    if (erstLauf) {
      setErstLauf(false);
      return;
    }
    startTransition(async () => {
      const res = await listReviews({
        source: quelle || undefined,
        channelCode: kanal || undefined,
        unanswered: nurOffen,
        limit: SEITE,
        offset: seite * SEITE,
      });
      if (res.ok) {
        setItems(res.data.items);
        setTotal(res.data.total);
        setFehler(null);
      } else {
        setFehler(res.error);
      }
    });
    // erstLauf ist bewusst nicht in den Abhängigkeiten: der Effekt soll auf
    // Filterwechsel reagieren, nicht auf das eigene Zurücksetzen des Flags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quelle, kanal, nurOffen, seite]);

  const kanaele = useMemo(
    () => (summary?.by_channel ?? []).map((c) => c.channel_code),
    [summary],
  );

  function neuLaden() {
    startTransition(async () => {
      const res = await listReviews({
        source: quelle || undefined,
        channelCode: kanal || undefined,
        unanswered: nurOffen,
        limit: SEITE,
        offset: seite * SEITE,
      });
      if (res.ok) {
        setItems(res.data.items);
        setTotal(res.data.total);
      }
    });
  }

  function abgleichen() {
    setFehler(null);
    startTransition(async () => {
      const res = await syncOtaReviews();
      if (res.ok) neuLaden();
      else setFehler(res.error);
    });
  }

  const seiten = Math.max(1, Math.ceil(total / SEITE));

  return (
    <div className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={abgleichen} disabled={pending}>
            <Icon icon="ph:arrows-clockwise" className="size-4" />
            {t("sync")}
          </Button>
        )}
      </header>

      {summary && <Kennzahlen summary={summary} />}

      <div className="flex flex-wrap items-end gap-3 rounded-(--radius) border border-border bg-card p-4">
        <label className="flex min-w-40 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filterSource")}
          </span>
          <NativeSelect
            value={quelle}
            onChange={(e) => {
              setSeite(0);
              setQuelle(e.target.value as ReviewSource | "");
            }}
          >
            <option value="">{t("allSources")}</option>
            <option value="marketplace">{t("sourceMarketplace")}</option>
            <option value="ota">{t("sourceOta")}</option>
          </NativeSelect>
        </label>
        <label className="flex min-w-40 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filterChannel")}
          </span>
          <NativeSelect
            value={kanal}
            onChange={(e) => {
              setSeite(0);
              setKanal(e.target.value);
            }}
          >
            <option value="">{t("allChannels")}</option>
            {kanaele.map((code) => (
              <option key={code} value={code}>
                {code === MARKETPLACE_CHANNEL ? code : channelLabel(code)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={nurOffen}
            onChange={(e) => {
              setSeite(0);
              setNurOffen(e.target.checked);
            }}
          />
          {t("onlyUnanswered")}
        </label>
      </div>

      {fehler && (
        <Card className="p-4 text-sm text-destructive">{fehler}</Card>
      )}

      {items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("empty")}</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((r) => (
            <BewertungsZeile
              key={`${r.source}-${r.id}`}
              review={r}
              canManage={canManage}
              onChanged={(neu) =>
                setItems((alt) =>
                  alt.map((x) =>
                    x.source === neu.source && x.id === neu.id ? neu : x,
                  ),
                )
              }
            />
          ))}
        </div>
      )}

      {seiten > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={seite === 0 || pending}
            onClick={() => setSeite((s) => Math.max(0, s - 1))}
          >
            {t("prev")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("page", { current: seite + 1, total: seiten })}
          </span>
          <Button
            variant="outline"
            disabled={seite + 1 >= seiten || pending}
            onClick={() => setSeite((s) => s + 1)}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Kennzahlen({ summary }: { summary: ReviewSummary }) {
  const t = useTranslations("reviews");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{t("kpiAverage")}</span>
        <span className="text-2xl font-semibold">
          {summary.average_5 == null ? "–" : summary.average_5.toFixed(2)}
        </span>
      </Card>
      <Card className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{t("kpiCount")}</span>
        <span className="text-2xl font-semibold">{summary.count}</span>
      </Card>
      <Card className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">
          {t("kpiUnanswered")}
        </span>
        <span className="text-2xl font-semibold">{summary.unanswered}</span>
        <span className="text-xs text-muted-foreground">
          {summary.response_rate == null
            ? t("noResponseRate")
            : t("responseRate", {
                pct: Math.round(summary.response_rate * 100),
              })}
        </span>
      </Card>
    </div>
  );
}

function Sterne({ score }: { score: number | null }) {
  // Ohne Note keine Sterne — eine leere Sternreihe wäre eine 0-Bewertung.
  if (score == null) return null;
  const voll = Math.round(score);
  return (
    <span className="flex items-center gap-0.5" aria-label={String(score)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          icon={i <= voll ? "ph:star-fill" : "ph:star"}
          className="size-4 text-amber-500"
        />
      ))}
    </span>
  );
}

function BewertungsZeile({
  review,
  canManage,
  onChanged,
}: {
  review: UnifiedReview;
  canManage: boolean;
  onChanged: (neu: UnifiedReview) => void;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [offen, setOffen] = useState(false);
  const [gastOffen, setGastOffen] = useState(false);
  const [gastNote, setGastNote] = useState(5);
  const [gastText, setGastText] = useState("");
  const [text, setText] = useState(review.reply ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const logo = channelLogo(review.channel_code);

  // Gast bewerten. Airbnb veröffentlicht erst, wenn beide Seiten abgegeben
  // haben oder die 14-Tage-Frist abläuft — und nimmt genau EINE Bewertung an.
  function gastBewerten() {
    setFehler(null);
    startTransition(async () => {
      const res =
        review.source === "marketplace"
          ? await rateGuest({
              reservation_id: review.reservation_id ?? "",
              rating: gastNote,
              text: gastText.trim() || null,
            })
          : await sendOtaGuestReview(review.id, {
              rating: gastNote,
              public_review: gastText.trim() || null,
              recommended: gastNote >= 4,
            });
      if (res.ok) {
        onChanged({ ...review, guest_rated: true });
        setGastOffen(false);
      } else {
        setFehler(res.error);
      }
    });
  }

  function senden() {
    if (!text.trim()) return;
    setFehler(null);
    startTransition(async () => {
      const res = await replyToReview(review.source, review.id, text.trim());
      if (res.ok) {
        onChanged(res.data);
        setOffen(false);
      } else {
        setFehler(res.error);
      }
    });
  }

  function entfernen() {
    setFehler(null);
    startTransition(async () => {
      const res = await deleteReviewReply(review.id);
      if (res.ok) {
        onChanged({ ...review, reply: null, reply_at: null, is_replied: false });
        setText("");
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {logo ? (
              <Image
                src={logo}
                alt={channelLabel(review.channel_code)}
                width={16}
                height={16}
                className="size-4 object-contain"
              />
            ) : null}
            <span className="text-sm font-medium">
              {review.channel_code === MARKETPLACE_CHANNEL
                ? review.channel_code
                : channelLabel(review.channel_code)}
            </span>
            <span className="text-sm text-muted-foreground">
              · {review.author}
            </span>
            {review.property_title && (
              <span className="text-sm text-muted-foreground">
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
            {review.received_at && (
              // Mit EXPLIZITER Sprache formatieren: `toLocaleDateString()` ohne
              // Locale nimmt serverseitig die des Node-Prozesses und im Browser
              // die des Nutzers — daraus wurde ein Hydration-Mismatch
              // (7/22/2026 gegen 22.7.2026).
              <span className="text-xs text-muted-foreground">
                {formatDate(review.received_at, locale)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {review.is_replied ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Icon icon="ph:check-circle" className="size-4" />
              {t("answered")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Icon icon="ph:clock" className="size-4" />
              {t("open")}
            </span>
          )}
          {/* Verdeckt: myBestDays wartet auf die Gegenseite, Airbnb hält die
              Bewertung zurück, bis beide abgegeben haben. */}
          {(review.is_hidden ||
            (review.source === "marketplace" && !review.published_at)) && (
            <span className="text-xs text-muted-foreground">{t("hidden")}</span>
          )}
          {!review.can_reply && (
            <span className="text-xs text-muted-foreground">{t("expired")}</span>
          )}
        </div>
      </div>

      {review.text && <p className="text-sm whitespace-pre-line">{review.text}</p>}

      {review.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.categories.map((c) => (
            <span
              key={c.key}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {/* Nur bekannte Kategorien werden übersetzt. Ein neuer
                  Portal-Schlüssel erscheint als Rohwert statt als
                  MISSING_MESSAGE die Zeile zu zerlegen. */}
              {KATEGORIEN.has(c.key) ? t(`category.${c.key}`) : c.key}: {c.score}
            </span>
          ))}
        </div>
      )}

      {review.reply && !offen && (
        <div className="rounded-(--radius) border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("yourReply")}
          </p>
          <p className="text-sm whitespace-pre-line">{review.reply}</p>
        </div>
      )}

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      {canManage && gastOffen && (
        <div className="flex flex-col gap-2 rounded-(--radius) border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("rateGuestHint")}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm">{t("autoRating")}</span>
            <NativeSelect
              value={String(gastNote)}
              onChange={(e) => setGastNote(Number(e.target.value))}
              className="w-20"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Textarea
            rows={2}
            value={gastText}
            onChange={(e) => setGastText(e.target.value)}
            placeholder={t("rateGuestPlaceholder")}
          />
          <div className="flex gap-2">
            <Button onClick={gastBewerten} disabled={pending}>
              {t("send")}
            </Button>
            <Button variant="outline" onClick={() => setGastOffen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {canManage && review.can_reply && (
        <div className="flex flex-col gap-2">
          {offen ? (
            <>
              <Textarea
                autoFocus
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("replyPlaceholder")}
              />
              <div className="flex gap-2">
                <Button onClick={senden} disabled={pending || !text.trim()}>
                  {t("send")}
                </Button>
                <Button variant="outline" onClick={() => setOffen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setOffen(true)}>
                <Icon icon="ph:chat-circle-text" className="size-4" />
                {review.reply ? t("editReply") : t("reply")}
              </Button>
              {/* Portale kennen kein Zurücknehmen einer Antwort — nur der
                  eigene Marktplatz. */}
              {review.reply && review.source === "marketplace" && (
                <Button variant="outline" onClick={entfernen} disabled={pending}>
                  {t("deleteReply")}
                </Button>
              )}
              {kannGastBewerten(review) && (
                <Button variant="outline" onClick={() => setGastOffen(true)}>
                  <Icon icon="ph:user-check" className="size-4" />
                  {t("rateGuest")}
                </Button>
              )}
              {review.guest_rated && (
                <span className="self-center text-xs text-muted-foreground">
                  {t("guestRated")}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
