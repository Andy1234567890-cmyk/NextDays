"use client";

// Textvorlagen (Buchhaltung → Textvorlagen): Liste + Anlegen/Ändern im Sheet +
// Löschen. Form nach dem alten Werkzeug (Name, Kategorie, Verwendung, Position,
// Text mit Platzhalter-Chips, Standard, „Nur für mich"); Regeln liegen im
// Server (nh3-Bereinigung, ein Standard je Art, private Vorlagen nur für den
// Ersteller). Nach jeder Aktion `router.refresh()` — kein Realtime auf der
// server-only Tabelle (Wurzel 6, 0695).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import {
  createTextTemplate,
  deleteTextTemplate,
  updateTextTemplate,
} from "@/lib/buchhaltung-versand";
import {
  PLATZHALTER,
  TEMPLATE_CATEGORIES,
  TEMPLATE_OBJECT_TYPES,
  TEXT_TYPES_JE_KATEGORIE,
  type TemplateCategory,
  type TemplateObjectType,
  type TemplateTextType,
  type TextTemplate,
  type TextTemplateInput,
} from "@/lib/buchhaltung-versand-typen";

type Form = {
  name: string;
  category: TemplateCategory;
  objectType: TemplateObjectType;
  textType: TemplateTextType;
  text: string;
  language: string;
  isDefault: boolean;
  isPrivate: boolean;
};

const LEER: Form = {
  name: "",
  category: "DOCUMENT",
  objectType: "INVOICE",
  textType: "HEAD",
  text: "",
  language: "",
  isDefault: false,
  isPrivate: false,
};

function ausVorlage(v: TextTemplate): Form {
  return {
    name: v.name,
    category: v.category,
    objectType: v.objectType,
    textType: v.textType,
    text: v.text,
    language: v.language ?? "",
    isDefault: v.isDefault,
    isPrivate: v.isPrivate,
  };
}

export function TextvorlagenVerwaltung({ templates }: { templates: TextTemplate[] }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<TextTemplate | null>(null);
  const [form, setForm] = useState<Form>(LEER);
  const [speichert, setSpeichert] = useState(false);
  const [loeschtId, setLoeschtId] = useState<string | null>(null);
  const [filterKategorie, setFilterKategorie] = useState<"" | TemplateCategory>("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const kategorieLabel = (k: TemplateCategory) => t(`textvorlagenPage.category.${k}`);
  const objektLabel = (o: TemplateObjectType) => t(`textvorlagenPage.objectType.${o}`);
  const positionLabel = (p: TemplateTextType) => t(`textvorlagenPage.textType.${p}`);

  const sichtbar = useMemo(
    () => (filterKategorie ? templates.filter((v) => v.category === filterKategorie) : templates),
    [templates, filterKategorie],
  );

  const oeffnenNeu = () => {
    setBearbeitet(null);
    setForm(LEER);
    setOffen(true);
  };
  const oeffnenBearbeiten = (v: TextTemplate) => {
    setBearbeitet(v);
    setForm(ausVorlage(v));
    setOffen(true);
  };

  const setKategorie = (category: TemplateCategory) => {
    const erlaubt = TEXT_TYPES_JE_KATEGORIE[category];
    setForm((f) => ({
      ...f,
      category,
      textType: erlaubt.includes(f.textType) ? f.textType : erlaubt[0],
    }));
  };

  const platzhalterEinfuegen = (ph: string) => {
    const el = textRef.current;
    const start = el?.selectionStart ?? form.text.length;
    const ende = el?.selectionEnd ?? form.text.length;
    const neu = form.text.slice(0, start) + ph + form.text.slice(ende);
    setForm((f) => ({ ...f, text: neu }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + ph.length, start + ph.length);
    });
  };

  const speichern = async () => {
    if (!form.name.trim() || !form.text.trim()) {
      toast.error(t("textvorlagenPage.toasts.fieldsRequired"));
      return;
    }
    setSpeichert(true);
    const input: TextTemplateInput = {
      name: form.name.trim(),
      category: form.category,
      objectType: form.objectType,
      textType: form.textType,
      text: form.text,
      language: form.language.trim() ? form.language.trim().toLowerCase() : null,
      isDefault: form.isDefault,
      isPrivate: form.isPrivate,
    };
    const res = bearbeitet
      ? await updateTextTemplate(bearbeitet.id, input)
      : await createTextTemplate(input);
    setSpeichert(false);
    if (!res.ok) {
      toast.error(t("textvorlagenPage.toasts.saveError", { error: res.error }));
      return;
    }
    toast.success(
      bearbeitet ? t("textvorlagenPage.toasts.updated") : t("textvorlagenPage.toasts.created"),
    );
    setOffen(false);
    router.refresh();
  };

  const loeschen = async (v: TextTemplate) => {
    if (!window.confirm(t("textvorlagenPage.confirmDelete", { name: v.name }))) return;
    setLoeschtId(v.id);
    const res = await deleteTextTemplate(v.id);
    setLoeschtId(null);
    if (!res.ok) {
      toast.error(t("textvorlagenPage.toasts.deleteError", { error: res.error }));
      return;
    }
    toast.success(t("textvorlagenPage.toasts.deleted"));
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="font-display text-2xl font-extrabold">{t("textvorlagenPage.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("textvorlagenPage.subtitle")}</p>
          </div>
          <InfoHinweis
            ariaLabel={t("textvorlagenPage.infoAria")}
            text={[t("textvorlagenPage.infoText1"), t("textvorlagenPage.infoText2")]}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <NativeSelect
              aria-label={t("textvorlagenPage.filterCategory")}
              value={filterKategorie}
              onChange={(e) => setFilterKategorie(e.target.value as "" | TemplateCategory)}
            >
              <option value="">{t("textvorlagenPage.allCategories")}</option>
              {TEMPLATE_CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {kategorieLabel(k)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="button" className="rounded-full" onClick={oeffnenNeu}>
            <Icon icon="ph:plus" className="mr-1.5 size-4" />
            {t("textvorlagenPage.newTemplate")}
          </Button>
        </div>
      </div>

      {sichtbar.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:text-align-left" className="size-7 text-muted-foreground" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold">{t("textvorlagenPage.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("textvorlagenPage.emptySubtitle")}</p>
          </div>
          <Button type="button" className="rounded-full" onClick={oeffnenNeu}>
            <Icon icon="ph:plus" className="mr-1.5 size-4" />
            {t("textvorlagenPage.newTemplate")}
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("textvorlagenPage.columnName")}</th>
                  <th className="px-4 py-3 font-medium">{t("textvorlagenPage.columnCategory")}</th>
                  <th className="px-4 py-3 font-medium">{t("textvorlagenPage.columnObjectType")}</th>
                  <th className="px-4 py-3 font-medium">{t("textvorlagenPage.columnTextType")}</th>
                  <th className="px-4 py-3 font-medium">{t("textvorlagenPage.columnLanguage")}</th>
                  <th className="px-4 py-3 font-medium">{t("textvorlagenPage.columnFlags")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sichtbar.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => oeffnenBearbeiten(v)}
                      >
                        {v.name}
                      </button>
                      <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{v.text}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{kategorieLabel(v.category)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{objektLabel(v.objectType)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{positionLabel(v.textType)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.language ? v.language.toUpperCase() : t("textvorlagenPage.allLanguages")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {v.isDefault && (
                          <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                            {t("textvorlagenPage.defaultBadge")}
                          </span>
                        )}
                        {v.isPrivate && (
                          <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            {t("textvorlagenPage.privateBadge")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-full"
                          aria-label={t("textvorlagenPage.edit")}
                          onClick={() => oeffnenBearbeiten(v)}
                        >
                          <Icon icon="ph:pencil-simple" className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-full text-destructive"
                          aria-label={t("textvorlagenPage.delete")}
                          disabled={loeschtId === v.id}
                          onClick={() => void loeschen(v)}
                        >
                          <Icon
                            icon={loeschtId === v.id ? "ph:spinner" : "ph:trash"}
                            className={`size-4 ${loeschtId === v.id ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Sheet open={offen} onOpenChange={setOffen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {bearbeitet ? t("textvorlagenPage.sheetEditTitle") : t("textvorlagenPage.sheetNewTitle")}
            </SheetTitle>
            <SheetDescription>{t("textvorlagenPage.sheetDescription")}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tv-name">{t("textvorlagenPage.fieldName")}</Label>
              <Input
                id="tv-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("textvorlagenPage.fieldNamePlaceholder")}
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tv-category">{t("textvorlagenPage.fieldCategory")}</Label>
                <NativeSelect
                  id="tv-category"
                  value={form.category}
                  onChange={(e) => setKategorie(e.target.value as TemplateCategory)}
                >
                  {TEMPLATE_CATEGORIES.map((k) => (
                    <option key={k} value={k}>
                      {kategorieLabel(k)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tv-object">{t("textvorlagenPage.fieldObjectType")}</Label>
                <NativeSelect
                  id="tv-object"
                  value={form.objectType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, objectType: e.target.value as TemplateObjectType }))
                  }
                >
                  {TEMPLATE_OBJECT_TYPES.map((o) => (
                    <option key={o} value={o}>
                      {objektLabel(o)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tv-position">{t("textvorlagenPage.fieldTextType")}</Label>
                <NativeSelect
                  id="tv-position"
                  value={form.textType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, textType: e.target.value as TemplateTextType }))
                  }
                >
                  {TEXT_TYPES_JE_KATEGORIE[form.category].map((p) => (
                    <option key={p} value={p}>
                      {positionLabel(p)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="tv-language">{t("textvorlagenPage.fieldLanguage")}</Label>
                <InfoHinweis
                  ariaLabel={t("textvorlagenPage.fieldLanguageInfoAria")}
                  text={t("textvorlagenPage.fieldLanguageInfo")}
                />
              </div>
              <Input
                id="tv-language"
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                placeholder={t("textvorlagenPage.fieldLanguagePlaceholder")}
                maxLength={2}
                className="w-28 uppercase"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="tv-text">{t("textvorlagenPage.fieldText")}</Label>
                <InfoHinweis
                  ariaLabel={t("textvorlagenPage.fieldTextInfoAria")}
                  text={[t("textvorlagenPage.fieldTextInfo1"), t("textvorlagenPage.fieldTextInfo2")]}
                />
              </div>
              <Textarea
                id="tv-text"
                ref={textRef}
                rows={8}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder={t("textvorlagenPage.fieldTextPlaceholder")}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PLATZHALTER.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
                    onClick={() => platzhalterEinfuegen(ph)}
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="tv-default">{t("textvorlagenPage.fieldDefault")}</Label>
                  <InfoHinweis
                    ariaLabel={t("textvorlagenPage.fieldDefaultInfoAria")}
                    text={t("textvorlagenPage.fieldDefaultInfo")}
                  />
                </div>
                <Switch
                  id="tv-default"
                  checked={form.isDefault}
                  onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, isDefault: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="tv-private">{t("textvorlagenPage.fieldPrivate")}</Label>
                  <InfoHinweis
                    ariaLabel={t("textvorlagenPage.fieldPrivateInfoAria")}
                    text={t("textvorlagenPage.fieldPrivateInfo")}
                  />
                </div>
                <Switch
                  id="tv-private"
                  checked={form.isPrivate}
                  onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, isPrivate: v }))}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="mt-auto">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setOffen(false)}
              disabled={speichert}
            >
              {t("textvorlagenPage.cancel")}
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void speichern()} disabled={speichert}>
              {speichert && <Icon icon="ph:spinner" className="mr-1.5 size-4 animate-spin" />}
              {bearbeitet ? t("textvorlagenPage.save") : t("textvorlagenPage.create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
