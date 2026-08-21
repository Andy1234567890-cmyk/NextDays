// Gastgeber · Bewertungen. Eine Liste über ALLE Kanäle (myBestDays-Marktplatz
// und die Portale) über /api/v1/reviews, mit Antwortfeld.
//
// Die Note kommt in zwei Skalen aus dem Backend (Portale 0..10, myBestDays
// 1..5). Sterne kommen aus `score_5`; fehlt eine Note, werden KEINE Sterne
// gezeigt — eine leere Sternreihe wäre eine Null-Bewertung (Wurzel 4).
//
// Realtime: `reviews` speist die Marktplatz-Bewertungen. Die Portal-Bewertungen
// (`channex_review`) sind seit Migration 0337 gesperrt und laufen nicht mehr
// live — Begründung an der Stelle des ehemaligen Abos.
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Row, Segmented, Spinner, Star, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useRealtime } from "@/lib/realtime";
import {
  MARKETPLACE_CHANNEL,
  listReviews,
  replyToReview,
  reviewSummary,
  type ReviewSummary,
  type UnifiedReview,
} from "@/lib/reviews";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

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

export default function HostReviews() {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<UnifiedReview[] | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [nurOffen, setNurOffen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [liste, kennzahlen] = await Promise.all([
      listReviews({ unanswered: nurOffen, limit: 50 }),
      reviewSummary(),
    ]);
    setItems(liste.ok ? liste.data.items : []);
    setSummary(kennzahlen.ok ? kennzahlen.data : null);
  }, [nurOffen]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({ table: "reviews", onChange: load });
  // `channex_review` (Portal-Bewertungen) ist seit Migration 0337 für
  // `authenticated` gesperrt (Wurzel 6: revoke + raus aus der Publikation
  // supabase_realtime) — das Abo verband sauber und bekam nie ein Event. Eine
  // Ersatzquelle gibt es nicht: eine neue Portal-Bewertung kommt über den
  // Channex-Feed und ändert keine offene Tabelle (insbesondere keine
  // reservations-Zeile). Ehrlich: eine NEUE Bewertung von Booking.com/Airbnb
  // erscheint erst beim Öffnen des Tabs oder per Zug-zum-Aktualisieren;
  // myBestDays-Bewertungen bleiben live.

  async function aktualisieren() {
    setBusy(true);
    await load();
    setBusy(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: unterkante + 24,
          gap: 16,
        }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={aktualisieren} />}
      >
        <Txt v="display">Bewertungen</Txt>

        {summary ? (
          <Row gap={10}>
            <Kachel
              label="Durchschnitt"
              wert={summary.average_5 == null ? "—" : summary.average_5.toFixed(2)}
            />
            <Kachel label="Bewertungen" wert={String(summary.count)} />
            <Kachel label="Offen" wert={String(summary.unanswered)} />
          </Row>
        ) : null}

        <Segmented
          options={["Alle", "Unbeantwortet"]}
          value={nurOffen ? 1 : 0}
          onChange={(i) => setNurOffen(i === 1)}
        />

        {items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState
            icon="star"
            titel="Noch keine Bewertungen"
            text="Sobald Gäste bewerten, erscheinen die Bewertungen hier — aus allen Kanälen."
          />
        ) : (
          <Col gap={12}>
            {items.map((r) => (
              <Zeile
                key={`${r.source}-${r.id}`}
                review={r}
                onChanged={(neu) =>
                  setItems((alt) =>
                    (alt ?? []).map((x) =>
                      x.source === neu.source && x.id === neu.id ? neu : x,
                    ),
                  )
                }
              />
            ))}
          </Col>
        )}
      </ScrollView>
    </View>
  );
}

function Kachel({ label, wert }: { label: string; wert: string }) {
  return (
    <Card style={{ flex: 1, padding: 14 }}>
      <Txt v="xs" soft>
        {label}
      </Txt>
      <Txt v="h2">{wert}</Txt>
    </Card>
  );
}

function Sterne({ score }: { score: number | null }) {
  const t = useTheme();
  if (score == null) return null;
  const voll = Math.round(score);
  return (
    <Row gap={2}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= voll ? (
          <Star key={i} s={14} />
        ) : (
          <Icon key={i} n="star" s={14} c={t.palette.faint} sw={1.2} />
        ),
      )}
    </Row>
  );
}

function Zeile({
  review,
  onChanged,
}: {
  review: UnifiedReview;
  onChanged: (neu: UnifiedReview) => void;
}) {
  const t = useTheme();
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState(review.reply ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function senden() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setFehler(null);
    const res = await replyToReview(review.source, review.id, text.trim());
    setBusy(false);
    if (res.ok) {
      onChanged(res.data);
      setOffen(false);
    } else {
      setFehler(res.error);
    }
  }

  const verdeckt =
    review.is_hidden || (review.source === "marketplace" && !review.published_at);

  return (
    <Card style={{ padding: 14, gap: 8 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Col gap={4} style={{ flex: 1 }}>
          <Txt v="sm">
            {review.channel_code === MARKETPLACE_CHANNEL
              ? review.channel_code
              : kanalLabel(review.channel_code)}
            {"  ·  "}
            {review.author}
          </Txt>
          {review.property_title ? (
            <Txt v="xs" soft>
              {review.property_title}
            </Txt>
          ) : null}
          <Row gap={6} style={{ alignItems: "center" }}>
            <Sterne score={review.score_5} />
            {review.score != null ? (
              <Txt v="xs" soft>
                {review.score} / {review.scale === "0-10" ? 10 : 5}
              </Txt>
            ) : null}
          </Row>
        </Col>
        <Col gap={2} style={{ alignItems: "flex-end" }}>
          <Txt v="xs" soft>
            {review.is_replied ? "Beantwortet" : "Offen"}
          </Txt>
          {verdeckt ? (
            <Txt v="xs" soft>
              Noch nicht veröffentlicht
            </Txt>
          ) : null}
          {!review.can_reply ? (
            <Txt v="xs" soft>
              Frist abgelaufen
            </Txt>
          ) : null}
        </Col>
      </Row>

      {review.text ? <Txt v="sm">{review.text}</Txt> : null}

      {review.reply && !offen ? (
        <View style={{ backgroundColor: t.palette.surface2, borderRadius: 12, padding: 10 }}>
          <Txt v="xs" soft>
            Deine Antwort
          </Txt>
          <Txt v="sm">{review.reply}</Txt>
        </View>
      ) : null}

      {fehler ? (
        <Txt v="xs" style={{ color: t.palette.accent }}>
          {fehler}
        </Txt>
      ) : null}

      {review.can_reply ? (
        offen ? (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Col gap={8}>
              <TextInput
                autoFocus
                multiline
                value={text}
                onChangeText={setText}
                placeholder="Antwort an den Gast …"
                placeholderTextColor={t.palette.faint}
                style={{
                  minHeight: 72,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  padding: 10,
                  color: t.palette.ink,
                  textAlignVertical: "top",
                }}
              />
              <Row gap={8}>
                <Btn onPress={senden}>Senden</Btn>
                <Btn variant="outline" onPress={() => setOffen(false)}>
                  Abbrechen
                </Btn>
              </Row>
            </Col>
          </KeyboardAvoidingView>
        ) : (
          <Pressable onPress={() => setOffen(true)} style={{ alignSelf: "flex-start" }}>
            <Txt v="sm" style={{ color: t.palette.accent }}>
              {review.reply ? "Antwort ändern" : "Antworten"}
            </Txt>
          </Pressable>
        )
      ) : null}
    </Card>
  );
}
