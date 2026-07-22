"use client";

// KI-Antworten-Tab: Einstellungen für die KI-Antwortvorschläge (Groq).
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type AiSettings, getAiSettings, saveAiSettings } from "@/lib/inbox";

const TONES = ["freundlich", "formell", "locker"];
const LANGS = ["auto", "de", "en", "fr", "es", "it"];

export function AiSettingsTab() {
  const t = useTranslations("inbox");
  const [s, setS] = useState<AiSettings>({
    tone: "freundlich",
    language: "auto",
    signature: "",
    extra_prompt: "",
    auto_suggest: true,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const res = await getAiSettings();
      if (res.ok) setS(res.data);
    })();
  }, []);

  function save() {
    setSaved(false);
    setError(null);
    start(async () => {
      const res = await saveAiSettings(s);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="flex max-w-2xl flex-col gap-5">
        <h2 className="font-display text-lg font-extrabold">{t("tabAiReplies")}</h2>

        <Row label={t("aiTone")}>
          <NativeSelect
            value={s.tone}
            onChange={(e) => setS({ ...s, tone: e.target.value })}
            className="w-auto self-start"
          >
            {TONES.map((x) => (
              <option key={x} value={x}>
                {t(`aiTone_${x}` as never) ?? x}
              </option>
            ))}
          </NativeSelect>
        </Row>

        <Row label={t("aiLanguage")}>
          <NativeSelect
            value={s.language}
            onChange={(e) => setS({ ...s, language: e.target.value })}
            className="w-auto self-start"
          >
            {LANGS.map((x) => (
              <option key={x} value={x}>
                {x === "auto" ? t("aiLangAuto") : x.toUpperCase()}
              </option>
            ))}
          </NativeSelect>
        </Row>

        <Row label={t("aiSignature")}>
          <Input
            value={s.signature ?? ""}
            onChange={(e) => setS({ ...s, signature: e.target.value })}
            placeholder={t("aiSignaturePlaceholder")}
          />
        </Row>

        <Row label={t("aiExtraPrompt")}>
          <textarea
            value={s.extra_prompt ?? ""}
            onChange={(e) => setS({ ...s, extra_prompt: e.target.value })}
            rows={4}
            placeholder={t("aiExtraPromptPlaceholder")}
            className="w-full resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
        </Row>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.auto_suggest}
            onChange={(e) => setS({ ...s, auto_suggest: e.target.checked })}
          />
          {t("aiAutoSuggest")}
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">{t("aiSaved")}</p>}

        <div>
          <Button type="button" onClick={save} disabled={pending}>
            {t("templateSave")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
