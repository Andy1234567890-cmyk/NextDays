"use client";

// Die Bewertungs-KI: Haltungs-Katalog, Zustellung, Test-KI.
//
// Gebaut nach demselben Muster wie die KI-Seite des Posteingangs
// (`inbox/ki-seite.tsx`): der grosse Schalter in der Kopfzeile über allem,
// weil er für alles gilt, und rechts daneben — nur wenn er aus ist — das
// Abzeichen „Deaktiviert". Ein eingeschalteter Zustand braucht keine
// Beschriftung, ein ausgeschalteter schon, sonst pflegt jemand einen Katalog,
// der nichts tut.
//
// Der Katalog ist der Kern. Zehn Fragen, in Worten des Betriebs beantwortet,
// sind die Stilvorlage im Prompt. Warum nicht EIN Freitextfeld „Beschreibe
// deinen Stil": ein leeres Feld bleibt leer oder bekommt einen Satz. Zehn
// konkrete Fragen bekommen zehn konkrete Antworten — und im Protokoll ist
// ablesbar, WELCHE Haltung eine schiefe Antwort getragen hat.
//
// BEIDE RICHTUNGEN teilen sich den Katalog: es ist derselbe Betrieb, der
// redet. Die Zustellart steht je Richtung, weil sie unterschiedlich riskant
// sind — eine Gastbewertung sieht ausser dem Gast kaum jemand, eine
// öffentliche Antwort auf eine 1-Stern-Bewertung lesen alle künftigen Gäste.
import { Icon } from "@iconify/react";
import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type KiKatalogAntwort,
  type KiKatalogFrage,
  type KiSettings,
  type KiZustellart,
  getKiKatalog,
  saveKiKatalogFrage,
  saveKiSettings,
} from "@/lib/reviews";

import { KiTestPanel } from "./ki-test-panel";

type Objekt = { id: string; title: string };

export function KiSeite({
  katalog: initialKatalog,
  settings: initialSettings,
  objekte,
  canManage,
}: {
  katalog: KiKatalogAntwort;
  settings: KiSettings;
  objekte: Objekt[];
  canManage: boolean;
}) {
  const t = useTranslations("reviews");
  const [katalog, setKatalog] = useState(initialKatalog);
  const [s, setS] = useState(initialSettings);
  const [gespeichert, setGespeichert] = useState(initialSettings);
  const [panelOffen, setPanelOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const offen = JSON.stringify(s) !== JSON.stringify(gespeichert);

  const speichern = useCallback(
    (naechster?: KiSettings) => {
      const wert = naechster ?? s;
      setFehler(null);
      start(async () => {
        const res = await saveKiSettings(wert);
        if (res.ok) {
          setS(res.data);
          setGespeichert(res.data);
        } else {
          setFehler(res.error);
        }
      });
    },
    [s],
  );

  // Der grosse Schalter speichert SOFORT, ohne den Speichern-Knopf. Er ist
  // keine Einstellung unter anderen: wer ihn umlegt, will, dass es sofort
  // gilt, und würde einen zusätzlichen Klick als Fehler lesen („ich hab's
  // doch ausgeschaltet"). Die Felder darunter speichern gesammelt.
  function grosserSchalter(an: boolean) {
    const naechster = { ...s, ki_aktiv: an };
    setS(naechster);
    speichern(naechster);
  }

  const nachladen = useCallback(async () => {
    const res = await getKiKatalog();
    if (res.ok) setKatalog(res.data);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-extrabold">{t("kiTitle")}</h2>
          {!s.ki_aktiv && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {t("kiBadgeDisabled")}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={s.ki_aktiv}
              onCheckedChange={grosserSchalter}
              disabled={pending || !canManage}
              aria-label={t("kiMasterSwitch")}
            />
            <span className="text-sm">
              {s.ki_aktiv ? t("kiMasterOn") : t("kiMasterOff")}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPanelOffen((v) => !v)}
            disabled={!canManage}
          >
            <Icon icon="ph:flask" className="size-4" />
            {t("kiTestOpen")}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => speichern()}
            disabled={pending || !offen || !canManage}
          >
            <Icon icon="ph:check" className="size-4" />
            {t("save")}
          </Button>
        </div>
      </header>

      {fehler && (
        <p className="mx-6 mt-3 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            <Zustellung wert={s} onChange={setS} readOnly={!canManage} />
            <Katalog
              katalog={katalog}
              readOnly={!canManage}
              onGespeichert={nachladen}
              onFehler={setFehler}
            />
          </div>
        </div>

        {panelOffen && (
          <KiTestPanel objekte={objekte} onSchliessen={() => setPanelOffen(false)} />
        )}
      </div>
    </div>
  );
}

function Zustellung({
  wert,
  onChange,
  readOnly,
}: {
  wert: KiSettings;
  onChange: (s: KiSettings) => void;
  readOnly: boolean;
}) {
  const t = useTranslations("reviews");
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-semibold">{t("kiDeliveryTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("kiDeliveryHint")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="za-antwort">
            {t("kiDirectionReply")}
          </label>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("kiDirectionReplyHint")}
          </p>
          <NativeSelect
            id="za-antwort"
            value={wert.zustellart_antwort}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                ...wert,
                zustellart_antwort: e.target.value as KiZustellart,
              })
            }
          >
            <option value="entwurf">{t("kiDeliveryDraft")}</option>
            <option value="automatisch">{t("kiDeliveryAuto")}</option>
          </NativeSelect>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="za-gast">
            {t("kiDirectionRateGuest")}
          </label>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("kiDirectionRateGuestHint")}
          </p>
          <NativeSelect
            id="za-gast"
            value={wert.zustellart_gast_bewerten}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                ...wert,
                zustellart_gast_bewerten: e.target.value as KiZustellart,
              })
            }
          >
            <option value="entwurf">{t("kiDeliveryDraft")}</option>
            <option value="automatisch">{t("kiDeliveryAuto")}</option>
          </NativeSelect>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="za-schwelle">
            {t("kiThreshold")}
          </label>
          <p className="mb-1 text-xs text-muted-foreground">
            {t("kiThresholdHint")}
          </p>
          <NativeSelect
            id="za-schwelle"
            value={wert.antwort_mensch_ab_note ?? ""}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                ...wert,
                antwort_mensch_ab_note: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          >
            <option value="">{t("kiThresholdNone")}</option>
            {[5, 4, 3, 2].map((n) => (
              <option key={n} value={n}>
                {t("kiThresholdBelow", { note: n })}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="za-ton">
            {t("kiTone")}
          </label>
          <p className="mb-1 text-xs text-muted-foreground">{t("kiToneHint")}</p>
          <NativeSelect
            id="za-ton"
            value={wert.tonfall}
            disabled={readOnly}
            onChange={(e) => onChange({ ...wert, tonfall: e.target.value })}
          >
            <option value="freundlich">{t("kiToneFriendly")}</option>
            <option value="formell">{t("kiToneFormal")}</option>
            <option value="locker">{t("kiToneCasual")}</option>
            <option value="herzlich">{t("kiToneWarm")}</option>
          </NativeSelect>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="za-signatur">
          {t("kiSignature")}
        </label>
        <p className="mb-1 text-xs text-muted-foreground">
          {t("kiSignatureHint")}
        </p>
        <Textarea
          id="za-signatur"
          value={wert.unterschrift ?? ""}
          disabled={readOnly}
          rows={2}
          maxLength={300}
          onChange={(e) =>
            onChange({ ...wert, unterschrift: e.target.value || null })
          }
        />
      </div>
    </Card>
  );
}

function Katalog({
  katalog,
  readOnly,
  onGespeichert,
  onFehler,
}: {
  katalog: KiKatalogAntwort;
  readOnly: boolean;
  onGespeichert: () => void;
  onFehler: (f: string | null) => void;
}) {
  const t = useTranslations("reviews");
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h3 className="font-semibold">{t("kiCatalogTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("kiCatalogHint")}</p>
        </div>
        {/* Der Füllstand ist die einzige Zahl, die dem Betrieb sagt, ob die
            KI genug über ihn weiss. */}
        <span className="rounded-full bg-muted px-3 py-1 text-sm tabular-nums">
          {t("kiCatalogProgress", {
            beantwortet: katalog.beantwortet,
            gesamt: katalog.gesamt,
          })}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {katalog.fragen.map((f) => (
          <KatalogFrage
            key={f.schluessel}
            frage={f}
            readOnly={readOnly}
            onGespeichert={onGespeichert}
            onFehler={onFehler}
          />
        ))}
      </div>
    </Card>
  );
}

function KatalogFrage({
  frage,
  readOnly,
  onGespeichert,
  onFehler,
}: {
  frage: KiKatalogFrage;
  readOnly: boolean;
  onGespeichert: () => void;
  onFehler: (f: string | null) => void;
}) {
  const t = useTranslations("reviews");
  const [wert, setWert] = useState(frage.antwort ?? "");
  const [pending, start] = useTransition();

  // Der zuletzt gespeicherte Stand kommt aus der Eigenschaft. Ein `useEffect`,
  // der ihn bei jeder Neuladung zurückschreibt, würde eine gerade getippte
  // Antwort überschreiben — deshalb wird nur beim Speichern abgeglichen.
  const geaendert = wert.trim() !== (frage.antwort ?? "").trim();

  function speichern() {
    onFehler(null);
    start(async () => {
      const res = await saveKiKatalogFrage(frage.schluessel, wert);
      if (res.ok) onGespeichert();
      else onFehler(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{t(`kiQuestion.${frage.schluessel}` as never)}</span>
        {/* Bei welchen Noten diese Antwort greift. Ohne diesen Hinweis wirkt
            der Katalog wie zehn gleichrangige Felder, und niemand versteht,
            warum eine Antwort bei 5 Sternen keine Wirkung hat. */}
        {frage.noten.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {frage.noten.map((n) => `${n}★`).join(" · ")}
          </span>
        )}
        {frage.richtungen.length === 1 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {frage.richtungen[0] === "antwort"
              ? t("kiDirectionReply")
              : t("kiDirectionRateGuest")}
          </span>
        )}
      </div>

      <Textarea
        value={wert}
        disabled={readOnly}
        rows={2}
        maxLength={1500}
        placeholder={t(`kiExample.${frage.schluessel}` as never)}
        onChange={(e) => setWert(e.target.value)}
      />

      {geaendert && !readOnly && (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={speichern} disabled={pending}>
            <Icon
              icon={pending ? "ph:spinner" : "ph:check"}
              className={pending ? "size-4 animate-spin" : "size-4"}
            />
            {t("save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setWert(frage.antwort ?? "")}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
