"use client";

// Reiter „Allgemein": Tonfall, Antwortlänge, Sprache, Signatur, Zusatzanweisung
// und die Wartezeit vor dem automatischen Versand.
//
// Ton, Sprache und Signatur stehen BEWUSST hier und nicht als Regel. Als Regel
// formuliert („antworte immer freundlich") träfen sie auf jede Nachricht zu und
// hebelten damit die Zustell-Logik aus: jede Nachricht hätte eine passende
// Regel, und ob automatisch gesendet wird, entschiede der Zufall der
// Reihenfolge.
//
// Der Zustand liegt in der Elternkomponente (`ki-seite.tsx`), weil der
// Speichern-Knopf oben in der Kopfzeile sitzt — er muss wissen, ob es
// ungespeicherte Änderungen gibt.
import { useTranslations } from "next-intl";

import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { LOCALES } from "@/i18n/locales";
import type { AiSettings } from "@/lib/inbox";

const TONFALL = ["freundlich", "neutral", "formell", "locker"] as const;
const LAENGEN = ["kurz", "standard", "ausfuehrlich"] as const;

// Auswahl statt freiem Zahlenfeld: „7 Minuten" bringt gegenüber „5" nichts,
// und eine Liste ist auf dem Telefon bedienbar.
const WARTEZEITEN = [0, 1, 3, 5, 10, 15, 30, 60] as const;

const MAX_SIGNATUR = 200;
const MAX_ZUSATZ = 1000;

export function KiAllgemeinTab({
  wert,
  onChange,
}: {
  wert: AiSettings;
  onChange: (s: AiSettings) => void;
}) {
  const t = useTranslations("inbox");
  // Die Sprachnamen stehen in `common.languages` — EIN Katalog für die ganze
  // Anwendung. Ein zweiter im inbox-Namensraum liefe auseinander.
  const tSprache = useTranslations("common.languages");
  const setzen = (teil: Partial<AiSettings>) => onChange({ ...wert, ...teil });

  return (
    <div className="flex max-w-3xl flex-col gap-6 p-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold">{t("kiTabGeneral")}</h3>
        <hr className="border-border" />

        <Zeile label={t("aiTone")} pflicht>
          <NativeSelect
            value={wert.tone}
            onChange={(e) => setzen({ tone: e.target.value })}
          >
            {TONFALL.map((x) => (
              <option key={x} value={x}>
                {t(`aiTone_${x}` as never)}
              </option>
            ))}
          </NativeSelect>
        </Zeile>

        <Zeile label={t("kiLength")} pflicht hinweis={t("kiLengthHint")}>
          <NativeSelect
            value={wert.antwortlaenge}
            onChange={(e) =>
              setzen({ antwortlaenge: e.target.value as AiSettings["antwortlaenge"] })
            }
          >
            {LAENGEN.map((x) => (
              <option key={x} value={x}>
                {t(`kiLength_${x}` as never)}
              </option>
            ))}
          </NativeSelect>
        </Zeile>

        <Zeile
          label={t("aiLanguage")}
          pflicht
          hinweis={wert.language === "auto" ? t("kiLanguageAutoHint") : undefined}
        >
          <NativeSelect
            value={wert.language}
            onChange={(e) => setzen({ language: e.target.value })}
          >
            <option value="auto">{t("aiLangAuto")}</option>
            {LOCALES.map((x) => (
              <option key={x} value={x}>
                {tSprache(x as never)}
              </option>
            ))}
          </NativeSelect>
        </Zeile>

        <Zeile label={t("aiSignature")}>
          <Input
            value={wert.signature ?? ""}
            maxLength={MAX_SIGNATUR}
            onChange={(e) => setzen({ signature: e.target.value })}
            placeholder={t("aiSignaturePlaceholder")}
          />
        </Zeile>

        <Zeile label={t("aiExtraPrompt")}>
          <textarea
            value={wert.extra_prompt ?? ""}
            onChange={(e) => setzen({ extra_prompt: e.target.value })}
            rows={4}
            maxLength={MAX_ZUSATZ}
            placeholder={t("aiExtraPromptPlaceholder")}
            className="w-full resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <span className="self-end text-xs text-muted-foreground tabular-nums">
            {(wert.extra_prompt ?? "").length} / {MAX_ZUSATZ}
          </span>
        </Zeile>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold">{t("kiCardAutoReply")}</h3>
        {/* Der Schalter allein tut nichts — das ist die häufigste Rückfrage,
            und sie gehört hierhin beantwortet, nicht in eine Hilfeseite. */}
        <p className="text-sm text-muted-foreground">{t("kiAutoReplyExplain")}</p>
        <hr className="border-border" />

        <Zeile
          label={t("aiAutoReplyDelay")}
          pflicht
          hinweis={t("aiAutoReplyDelayHint")}
        >
          <NativeSelect
            value={String(wert.autoantwort_verzoegerung_minuten)}
            onChange={(e) =>
              setzen({ autoantwort_verzoegerung_minuten: Number(e.target.value) })
            }
          >
            {WARTEZEITEN.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? t("kiDelayNone") : t("kiDelayMinutes", { count: m })}
              </option>
            ))}
          </NativeSelect>
        </Zeile>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={wert.auto_suggest}
            onChange={(e) => setzen({ auto_suggest: e.target.checked })}
          />
          <span>
            <span className="font-medium">{t("aiAutoSuggest")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("kiAutoSuggestHint")}
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}

function Zeile({
  label,
  pflicht,
  hinweis,
  children,
}: {
  label: string;
  pflicht?: boolean;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
      <span className="text-sm font-medium sm:w-56 sm:shrink-0 sm:pt-2">
        {label}
        {pflicht && <span className="ml-0.5 text-accent">*</span>}
      </span>
      <div className="flex max-w-md flex-1 flex-col gap-1">
        {children}
        {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
      </div>
    </div>
  );
}
