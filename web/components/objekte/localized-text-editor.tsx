"use client";

// Mehrsprachiger Rich-Text-Editor (Rental agreement):
//  - Sprachwahl (Deutsch / English / Dansk) per Dropdown
//  - Rich-Text-Editor (B/I/U/S/Link) je Sprache
//  - „Übersetzen"-Button: übersetzt den aktuellen Text in andere Sprachen
//    (Google Cloud Translation über das Backend; Key bleibt serverseitig).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import {
  type Lang,
  type LocalizedText,
  LANG_FLAGS,
  LANG_LABELS,
  LANGS,
  stripHtml,
} from "@/lib/policy-meta";
import { translateText } from "@/lib/translate";

export function LocalizedTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  placeholder?: string;
}) {
  const t = useTranslations("objects");
  const [lang, setLang] = useState<Lang>("de");
  const [busy, setBusy] = useState<Lang | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setText(html: string) {
    onChange({ ...value, [lang]: html });
  }

  // Übersetzt den Text der AKTUELLEN Sprache in eine Zielsprache.
  async function translateTo(target: Lang) {
    const sourceHtml = value[lang];
    if (!stripHtml(sourceHtml).trim()) {
      setError(t("localizedTextEditor.noTextToTranslate"));
      return;
    }
    setBusy(target);
    setError(null);
    const res = await translateText(sourceHtml, target, lang);
    setBusy(null);
    if (res.ok) {
      onChange({ ...value, [target]: res.data.text });
      setLang(target); // zur übersetzten Sprache wechseln, damit man es sieht
    } else {
      setError(res.error);
    }
  }

  const targets = LANGS.filter((l) => l !== lang);

  return (
    <div className="flex flex-col gap-3">
      {/* Sprach- und Übersetzungs-Leiste */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sprachwahl */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Icon icon={LANG_FLAGS[lang]} className="size-4" />
              {LANG_LABELS[lang]}
              <Icon icon="ph:caret-down" className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {LANGS.map((l) => (
              <DropdownMenuItem key={l} onClick={() => setLang(l)}>
                <Icon icon={LANG_FLAGS[l]} className="size-4" />
                {LANG_LABELS[l]}
                {l === lang && <Icon icon="ph:check" className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Übersetzen */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={busy !== null}>
              <Icon icon="ph:translate" className="size-4" />
              {busy ? t("localizedTextEditor.translating") : t("localizedTextEditor.translate")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>
              {t("localizedTextEditor.fromLangTo", { lang: LANG_LABELS[lang] })}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {targets.map((target) => (
              <DropdownMenuItem key={target} onClick={() => translateTo(target)}>
                <Icon icon={LANG_FLAGS[target]} className="size-4" />
                {LANG_LABELS[target]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor (pro Sprache eigene Instanz via key) */}
      <RichTextEditor
        key={lang}
        value={value[lang]}
        onChange={setText}
        placeholder={placeholder}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
