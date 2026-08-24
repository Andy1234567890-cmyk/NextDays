"use client";

// „Sprachen verwalten" — Stufe 2 im Automatisieren-Panel.
//
// Die Sprachen entscheiden, welcher Wortlaut an einen Gast geht: für jede
// verwaltete Sprache lässt sich in Vorlagen und Regeln eine eigene Fassung
// pflegen, und genau EINE ist der Standard — der Rückfall für JEDEN Gast, dessen
// Sprache nicht gepflegt ist. Erst wenn auch die Standardsprache keine Fassung
// hat, greift die Grundfassung (`sprachen.fassung_waehlen`).
//
// WARUM DAS SPEICHERN SOFORT PASSIERT, ohne „Speichern"-Knopf: jede Zeile hier
// ist eine einzelne Entscheidung („diese Sprache pflegen wir", „diese ist der
// Standard"), und der Server führt sie einzeln aus — mit Gegenzustand
// (Standard umstellen räumt den alten Standard weg, Entfernen nimmt die
// Fassungen dieser Sprache mit). Ein Sammel-Speichern müsste diesen
// Gegenzustand im Client nachbauen und käme bei einem Fehler auf halbem Weg
// zum Stehen.
//
// Löschen ist deshalb ausdrücklich als solches beschriftet: mit der Sprache
// verschwinden IHRE Texte in allen Vorlagen und Regeln. Das steht auch am
// Bestätigungsdialog.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type LanguageOption,
  type MessageLanguage,
  addMessageLanguage,
  listAvailableLanguages,
  listMessageLanguages,
  removeMessageLanguage,
  setDefaultMessageLanguage,
} from "@/lib/inbox";

export function SprachenAnsicht() {
  const t = useTranslations("inbox");
  const tGemein = useTranslations("common");
  const [sprachen, setSprachen] = useState<MessageLanguage[]>([]);
  const [katalog, setKatalog] = useState<LanguageOption[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    void Promise.all([listMessageLanguages(), listAvailableLanguages()]).then(
      ([spr, kat]) => {
        if (spr.ok) setSprachen(spr.data.items);
        if (kat.ok) setKatalog(kat.data.items);
        setGeladen(true);
      },
    );
  }, []);

  const namen = Object.fromEntries(katalog.map((o) => [o.code, o.name]));
  // Schon gepflegte Sprachen stehen nicht mehr in der Auswahl — sie erneut
  // anzubieten sähe aus, als könnte man sie zweimal führen.
  const offen = katalog.filter((o) => !sprachen.some((s) => s.code === o.code));
  const standard = sprachen.find((s) => s.is_default) ?? null;

  /** Antwort des Servers übernehmen; ein Fehler wird ANGEZEIGT, nicht
   *  verschluckt (der Server begründet z. B., warum die Standardsprache nicht
   *  entfernt werden kann). */
  function anwenden(
    aktion: () => Promise<
      { ok: true; data: { items: MessageLanguage[] } } | { ok: false; error: string }
    >,
  ) {
    setFehler(null);
    start(async () => {
      const res = await aktion();
      if (res.ok) setSprachen(res.data.items);
      else setFehler(res.error);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {/* Die Rangfolge steht hier, wo sie entschieden wird. Ohne sie ist der
          Stern eine Geschmacksfrage; mit ihr ist er die Antwort auf „warum
          bekommt mein italienischer Gast Deutsch". */}
      <div className="flex items-center gap-1.5">
        <h3 className="font-semibold">{t("autoLanguagesTitle")}</h3>
        <InfoHinweis
          titel={t("langChainTitle")}
          text={t("langChainText")}
          ariaLabel={tGemein("explain", { label: t("langChainTitle") })}
        />
      </div>

      <NativeSelect
        value=""
        disabled={pending || offen.length === 0}
        onChange={(e) => {
          const code = e.target.value;
          if (code) anwenden(() => addMessageLanguage(code));
        }}
        aria-label={t("langAdd")}
      >
        <option value="">{t("langAdd")}</option>
        {offen.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </NativeSelect>

      {geladen && sprachen.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("langEmpty")}</p>
      )}

      {/* WAS „STANDARD" KOSTET, STEHT JETZT DA. Der Stern war bis 24.08.2026 ein
          Sternsymbol ohne Aussage — die Folge (jeder Gast, dessen Sprache nicht
          gepflegt ist, bekommt DIESE Fassung) stand nirgends. Live führte das
          dazu, dass der Beta-Betrieb `de` zum Standard machte, obwohl seine
          Grundfassungen englisch sind: ein italienischer Booking.com-Gast bekam
          am 24.08. die deutsche Vorlage, nicht die englische Grundfassung. Die
          Zeile nennt die Sprache beim Namen, damit die Wahl sichtbar ist. */}
      {standard && (
        <p className="text-sm text-muted-foreground">
          {t("langDefaultHint", {
            sprache: namen[standard.code] ?? standard.code.toUpperCase(),
          })}
        </p>
      )}

      <ul className="flex flex-col rounded-2xl border border-border">
        {sprachen.map((s) => (
          <li
            key={s.code}
            className="flex items-center gap-2 border-b border-border p-3 last:border-b-0"
          >
            <span className="min-w-0 flex-1 font-medium">
              {namen[s.code] ?? s.code.toUpperCase()}
            </span>
            {s.is_default ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                {t("langDefault")}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  title={t("langSetDefault")}
                  aria-label={t("langSetDefault")}
                  disabled={pending}
                  onClick={() => anwenden(() => setDefaultMessageLanguage(s.code))}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Icon icon="ph:star" className="size-4" />
                </button>
                <button
                  type="button"
                  title={t("langRemove")}
                  aria-label={t("langRemove")}
                  disabled={pending}
                  onClick={() => {
                    // Die Folge steht IM Dialog: mit der Sprache gehen ihre
                    // Texte in allen Vorlagen und Regeln.
                    // `langBaseHint` stand hier falsch: es beschreibt die
                    // Grundfassung, nicht die Folge des Löschens.
                    if (
                      !window.confirm(
                        `${t("langRemove")} — ${t("langRemoveHint")}`,
                      )
                    ) {
                      return;
                    }
                    anwenden(() => removeMessageLanguage(s.code));
                  }}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
    </div>
  );
}
