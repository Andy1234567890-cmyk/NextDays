"use client";

// Warteschlange der geplanten Bewertungen ÜBER Gäste.
//
// Warum es sie gibt: eine abgeschickte öffentliche Bewertung lässt sich bei
// keinem Portal zurücknehmen. Deshalb steht sie hier zuerst als Entwurf mit
// Restfrist — sichtbar, änderbar, überspringbar — und geht erst mit dem Tick
// raus. Vorher lief die Automatik blind.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { channelLabel } from "@/lib/channel-logos";
import {
  type QueueEntry,
  type QueueStatus,
  listQueue,
  sendQueueEntry,
  skipQueueEntry,
  updateQueueEntry,
} from "@/lib/reviews";
import { MARKETPLACE_CHANNEL } from "@/lib/reviews-kanal";
import { formatDate } from "@/lib/utils";

const SEITE = 25;

const STATUS: QueueStatus[] = [
  "geplant",
  "gesendet",
  "uebersprungen",
  "abgelaufen",
  "fehler",
];

export function Warteschlange({
  initial,
  initialTotal,
  canManage,
}: {
  initial: QueueEntry[];
  initialTotal: number;
  canManage: boolean;
}) {
  const t = useTranslations("reviews");
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState<QueueStatus | "">("geplant");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Die erste Seite kommt gefiltert auf „geplant" vom Server; jede weitere
  // Filteränderung lädt nach (damit `total` zur Auswahl passt).
  const [erstLauf, setErstLauf] = useState(true);
  useEffect(() => {
    if (erstLauf) {
      setErstLauf(false);
      return;
    }
    startTransition(async () => {
      const res = await listQueue({ status: status || undefined, limit: SEITE });
      if (res.ok) {
        setItems(res.data.items);
        setTotal(res.data.total);
        setFehler(null);
      } else {
        setFehler(res.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function ersetzen(neu: QueueEntry) {
    // Passt der Eintrag nicht mehr zum Filter, verschwindet er aus der Liste —
    // sonst stünde ein „gesendet" unter „geplant". Der Zähler muss mitgehen,
    // sonst steht da „0 von 1".
    const faelltRaus = Boolean(status) && neu.status !== status;
    setItems((alt) =>
      faelltRaus
        ? alt.filter((x) => x.id !== neu.id)
        : alt.map((x) => (x.id === neu.id ? neu : x)),
    );
    if (faelltRaus) setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("queueTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("queueSubtitle")}</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("queueStatus")}
          </span>
          <NativeSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as QueueStatus | "")}
          >
            <option value="">{t("queueAll")}</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {t(`queueState.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </header>

      {fehler && <Card className="p-4 text-sm text-destructive">{fehler}</Card>}

      {items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("queueEmpty")}</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((e) => (
            <Zeile
              key={e.id}
              eintrag={e}
              canManage={canManage}
              onChanged={ersetzen}
              onFehler={setFehler}
            />
          ))}
        </div>
      )}

      {total > items.length && (
        <p className="text-sm text-muted-foreground">
          {t("queueShown", { shown: items.length, total })}
        </p>
      )}
      {pending && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
    </div>
  );
}

function Frist({ eintrag }: { eintrag: QueueEntry }) {
  const t = useTranslations("reviews");
  if (eintrag.status !== "geplant") return null;
  // Die Frist des Kanals hat Vorrang: sie entscheidet, ob es überhaupt noch
  // geht. Ist sie unbekannt, zeigen wir die Fälligkeit — nie eine geratene Zahl.
  if (eintrag.days_left != null) {
    const knapp = eintrag.days_left <= 3;
    return (
      <span className={knapp ? "text-sm text-destructive" : "text-sm text-amber-600"}>
        {t("queueDaysLeft", { days: eintrag.days_left })}
      </span>
    );
  }
  if (eintrag.days_until_send != null && eintrag.days_until_send > 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("queueDaysUntilSend", { days: eintrag.days_until_send })}
      </span>
    );
  }
  return <span className="text-sm text-amber-600">{t("queueDueNow")}</span>;
}

function Zeile({
  eintrag,
  canManage,
  onChanged,
  onFehler,
}: {
  eintrag: QueueEntry;
  canManage: boolean;
  onChanged: (neu: QueueEntry) => void;
  onFehler: (msg: string | null) => void;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [offen, setOffen] = useState(false);
  const [note, setNote] = useState(eintrag.rating);
  const [text, setText] = useState(eintrag.text ?? "");
  const [privat, setPrivat] = useState(eintrag.private_text ?? "");
  const [empfehlung, setEmpfehlung] = useState(eintrag.recommended);
  const [pending, startTransition] = useTransition();

  const geplant = eintrag.status === "geplant";
  const kanal =
    eintrag.source === "marketplace" ? MARKETPLACE_CHANNEL : channelLabel("AirBNB");

  function speichern() {
    onFehler(null);
    startTransition(async () => {
      const res = await updateQueueEntry(eintrag.id, {
        rating: note,
        text: text.trim() || null,
        private_text: privat.trim() || null,
        recommended: empfehlung,
      });
      if (res.ok) {
        onChanged(res.data);
        setOffen(false);
      } else {
        onFehler(res.error);
      }
    });
  }

  function aktion(fn: () => Promise<{ ok: true; data: QueueEntry } | { ok: false; error: string }>) {
    onFehler(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) onChanged(res.data);
      else onFehler(res.error);
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{kanal}</span>
            {eintrag.guest_name && (
              <span className="text-muted-foreground">· {eintrag.guest_name}</span>
            )}
            {eintrag.property_title && (
              <span className="text-muted-foreground">
                · {eintrag.property_title}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {t("queueSendAt", { date: formatDate(eintrag.send_at, locale) })}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">
            {t(`queueState.${eintrag.status}`)}
          </span>
          <Frist eintrag={eintrag} />
        </div>
      </div>

      {eintrag.error && (
        <p className="text-sm text-destructive">{eintrag.error}</p>
      )}

      {offen ? (
        <div className="flex flex-col gap-3 rounded-(--radius) border border-border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              {t("autoRating")}
              <NativeSelect
                value={String(note)}
                onChange={(e) => setNote(Number(e.target.value))}
                className="w-20"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2 text-sm">
              {t("queueRecommend")}
              <Switch checked={empfehlung} onCheckedChange={setEmpfehlung} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("publicText")}
            </span>
            <Textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("privateText")}
            </span>
            <Textarea
              rows={2}
              value={privat}
              onChange={(e) => setPrivat(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button onClick={speichern} disabled={pending}>
              {t("save")}
            </Button>
            <Button variant="outline" onClick={() => setOffen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon
                  key={i}
                  icon={i <= eintrag.rating ? "ph:star-fill" : "ph:star"}
                  className="size-4 text-amber-500"
                />
              ))}
            </span>
            {!eintrag.recommended && (
              <span className="text-xs text-muted-foreground">
                {t("queueNotRecommended")}
              </span>
            )}
          </div>
          {eintrag.text && (
            <p className="text-sm whitespace-pre-line">{eintrag.text}</p>
          )}
        </>
      )}

      {canManage && geplant && !offen && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOffen(true)}>
            <Icon icon="ph:pencil-simple" className="size-4" />
            {t("queueEdit")}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => aktion(() => skipQueueEntry(eintrag.id))}
          >
            <Icon icon="ph:prohibit" className="size-4" />
            {t("queueSkip")}
          </Button>
          <Button
            disabled={pending}
            onClick={() => aktion(() => sendQueueEntry(eintrag.id))}
          >
            <Icon icon="ph:paper-plane-tilt" className="size-4" />
            {t("queueSendNow")}
          </Button>
        </div>
      )}
    </Card>
  );
}
