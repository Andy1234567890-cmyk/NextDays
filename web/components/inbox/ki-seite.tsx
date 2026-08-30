"use client";

// Die KI-Seite: EIN Rahmen für Allgemein, Regeln und Wissensdatenbank.
//
// Bis hierher waren das DREI gleichrangige Reiter in der Posteingang-Leiste
// („KI-Antworten", „Regeln", „Wissensdatenbank"), zwischen Vorlagen und
// Automationen. Das verbarg den Zusammenhang: Wer die Wissensdatenbank pflegt,
// tut es FÜR die KI-Antwort, und wer den grossen Schalter sucht, findet ihn nur
// im ersten der drei.
//
// Der grosse Schalter steht deshalb in der Kopfzeile — über allen drei
// Bereichen, weil er für alle drei gilt. Rechts daneben, NUR wenn er aus ist,
// das Abzeichen „Deaktiviert": ein eingeschalteter Zustand braucht keine
// Beschriftung, ein ausgeschalteter schon (sonst pflegt jemand Regeln, die
// nichts tun).
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Switch } from "@nextdays/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nextdays/ui/tooltip";
import { type AiSettings, getAiSettings, saveAiSettings } from "@/lib/inbox";

import { KiAllgemeinTab } from "./ki-allgemein-tab";
import { KiRegelnTab } from "./ki-regeln-tab";
import { KiTestPanel } from "./ki-test-panel";
import { WissenTab } from "./wissen-tab";

type Unterreiter = "allgemein" | "regeln" | "wissen";

const VORGABE: AiSettings = {
  tone: "freundlich",
  language: "auto",
  signature: "",
  extra_prompt: "",
  auto_suggest: true,
  autoantwort_aktiv: false,
  autoantwort_verzoegerung_minuten: 5,
  antwortlaenge: "standard",
};

export function KiSeite() {
  const t = useTranslations("inbox");
  const [reiter, setReiter] = useState<Unterreiter>("allgemein");
  const [s, setS] = useState<AiSettings>(VORGABE);
  // Der zuletzt GESPEICHERTE Stand. Ohne ihn liesse sich nicht sagen, ob es
  // ungespeicherte Änderungen gibt — und der Speichern-Knopf wäre entweder
  // immer aktiv (dann ist er kein Hinweis) oder nie (dann ist er nutzlos).
  const [gespeichert, setGespeichert] = useState<AiSettings>(VORGABE);
  const [panelOffen, setPanelOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const laden = useCallback(async () => {
    const res = await getAiSettings();
    if (res.ok) {
      setS(res.data);
      setGespeichert(res.data);
    } else {
      setFehler(res.error);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const offen = JSON.stringify(s) !== JSON.stringify(gespeichert);

  const speichern = useCallback(
    (naechster?: AiSettings) => {
      const wert = naechster ?? s;
      setFehler(null);
      start(async () => {
        const res = await saveAiSettings(wert);
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
  // keine Einstellung unter anderen: wer ihn umlegt, will, dass es sofort gilt
  // — und würde einen zusätzlichen Klick als Fehler lesen („ich hab's doch
  // ausgeschaltet"). Die Felder darunter speichern gesammelt.
  function grossenSchalter(an: boolean) {
    const naechster = { ...s, autoantwort_aktiv: an };
    setS(naechster);
    speichern(naechster);
  }

  function wechseln(ziel: Unterreiter) {
    // Ungespeicherte Änderungen beim Reiterwechsel wären ein Datenverlust, den
    // niemand bemerkt — eine geänderte Tonfall-Einstellung verfällt still.
    if (offen && !window.confirm(t("kiUnsavedLeave"))) return;
    if (offen) setS(gespeichert);
    setReiter(ziel);
  }

  const REITER: { key: Unterreiter; label: string }[] = [
    { key: "allgemein", label: t("kiTabGeneral") },
    { key: "regeln", label: t("tabKiRules") },
    { key: "wissen", label: t("tabKnowledge") },
  ];

  return (
    <div className="ki-flaechen flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-extrabold">{t("tabAiReplies")}</h2>
          {!s.autoantwort_aktiv && (
            <span className="ki-abzeichen-aus rounded-full px-2 py-0.5 text-xs font-medium">
              {t("kiBadgeDisabled")}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-5 text-sm">
          {REITER.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => wechseln(r.key)}
              className={
                r.key === reiter
                  ? "border-b-2 border-accent pb-1 font-semibold text-accent"
                  : "pb-1 text-muted-foreground hover:text-foreground"
              }
            >
              {r.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Switch
                checked={s.autoantwort_aktiv}
                onCheckedChange={grossenSchalter}
                disabled={pending}
                aria-label={t("kiMasterSwitch")}
              />
              <span className="text-sm">
                {s.autoantwort_aktiv ? t("kiMasterOn") : t("kiMasterOff")}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("kiMasterHelp")}
                  >
                    <Icon icon="ph:question" className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {t("kiMasterHelp")}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPanelOffen((v) => !v)}
          >
            <Icon icon="ph:flask" className="size-4" />
            {t("kiTestOpen")}
          </Button>

          {reiter === "allgemein" && (
            <Button
              type="button"
              size="sm"
              onClick={() => speichern()}
              disabled={pending || !offen}
            >
              <Icon icon="ph:check" className="size-4" />
              {t("templateSave")}
            </Button>
          )}
        </div>
      </header>

      {fehler && (
        <p className="mx-6 mt-3 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {reiter === "allgemein" ? (
            <KiAllgemeinTab wert={s} onChange={setS} />
          ) : reiter === "regeln" ? (
            <KiRegelnTab autoantwortAktiv={s.autoantwort_aktiv} onEinschalten={() => grossenSchalter(true)} />
          ) : (
            <WissenTab />
          )}
        </div>

        {panelOffen && (
          <KiTestPanel onSchliessen={() => setPanelOffen(false)} />
        )}
      </div>
    </div>
  );
}
