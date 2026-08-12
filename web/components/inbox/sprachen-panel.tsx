"use client";

// „Sprachen verwalten" — Stufe 2 im Automatisieren-Panel.
//
// Die Sprachen entscheiden, welcher Wortlaut an einen Gast geht: für jede
// verwaltete Sprache lässt sich in Vorlagen und Regeln eine eigene Fassung
// pflegen, und genau EINE ist der Standard (der Rückfall, wenn die Sprache des
// Gastes keine Fassung hat).
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
                    if (!window.confirm(`${t("langRemove")} — ${t("langBaseHint")}`)) {
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
