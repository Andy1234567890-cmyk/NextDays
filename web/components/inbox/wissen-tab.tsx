"use client";

// Wissensdatenbank für die KI-Antworten.
//
// Der Antwortvorschlag darf sich keine Fakten ausdenken — der System-Prompt
// verbietet es ausdrücklich, und das ist richtig so. Auf „Wie ist das
// WLAN-Passwort?" konnte er deshalb bislang nur um Klärung bitten. Hier steht
// die Menge an Angaben, die er benutzen DARF.
//
// Ein Fakt gilt entweder betriebsweit (ohne Objekt) oder für genau ein Objekt.
// Beim Beantworten gelten beide zusammen, objektbezogene zuerst.
//
// Kein Realtime-Abo: `inbox_knowledge_fact` ist für anon/authenticated bewusst
// gesperrt (0260 — dort stehen Zugangsdaten). Ein Abo darauf wäre eine stumme
// Attrappe. Die Liste lädt nach jeder eigenen Änderung neu; eine Fremdänderung
// erscheint beim nächsten Aufruf.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type KnowledgeFact,
  createKnowledge,
  deleteKnowledge,
  listKnowledge,
  updateKnowledge,
} from "@/lib/inbox";
import { listProperties } from "@/lib/properties";

type Prop = { id: string; title: string };

const QUELLE_ICON: Record<KnowledgeFact["source"], string> = {
  manual: "ph:pencil-simple",
  document: "ph:file-text",
  message: "ph:chat-circle-text",
};

export function WissenTab() {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<KnowledgeFact[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [editing, setEditing] = useState<KnowledgeFact | null>(null);
  const [fact, setFact] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function load(objekt: string) {
    const res = await listKnowledge(objekt || undefined);
    if (res.ok) setItems(res.data.items);
    else setError(res.error);
  }

  useEffect(() => {
    void load(filter);
  }, [filter]);

  useEffect(() => {
    void listProperties().then((p) => {
      if (p.ok) setProps(p.data.items.map((x) => ({ id: x.id, title: x.title })));
    });
  }, []);

  function reset() {
    setEditing(null);
    setFact("");
    setPropertyId("");
    setError(null);
  }

  function save() {
    const text = fact.trim();
    if (!text) {
      setError(t("knowledgeRequired"));
      return;
    }
    setError(null);
    start(async () => {
      const eingabe = { property_id: propertyId || null, fact: text };
      const res = editing
        ? await updateKnowledge(editing.id, eingabe)
        : await createKnowledge(eingabe);
      if (res.ok) {
        reset();
        await load(filter);
      } else {
        setError(res.error);
      }
    });
  }

  function edit(f: KnowledgeFact) {
    setEditing(f);
    setFact(f.fact);
    setPropertyId(f.property_id ?? "");
    setError(null);
  }

  function remove(id: string) {
    start(async () => {
      await deleteKnowledge(id);
      if (editing?.id === id) reset();
      await load(filter);
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 overflow-y-auto p-6">
      <div className="col-span-12 lg:col-span-7">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-extrabold">{t("tabKnowledge")}</h2>
          <NativeSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-56"
          >
            <option value="">{t("knowledgeAllProperties")}</option>
            {props.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </NativeSelect>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t("knowledgeIntro")}</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("knowledgeEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((f) => (
              <li
                key={f.id}
                className="flex items-start gap-3 rounded-2xl border border-border p-3"
              >
                <Icon
                  icon={QUELLE_ICON[f.source]}
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm">{f.fact}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.property_title ?? t("knowledgeCompanyWide")}
                    {" · "}
                    {t(`knowledgeSource_${f.source}` as never)}
                    {f.source_ref ? ` · ${f.source_ref}` : ""}
                  </span>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => edit(f)}>
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(f.id)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="col-span-12 flex flex-col gap-3 rounded-2xl border border-border p-4 lg:col-span-5">
        <h3 className="font-semibold">
          {editing ? t("knowledgeEdit") : t("knowledgeNew")}
        </h3>
        <label className="text-sm font-medium">{t("knowledgeScope")}</label>
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          <option value="">{t("knowledgeCompanyWide")}</option>
          {props.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <textarea
          value={fact}
          onChange={(e) => setFact(e.target.value)}
          placeholder={t("knowledgePlaceholder")}
          rows={5}
          maxLength={2000}
          className="resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          {editing && (
            <Button type="button" variant="outline" onClick={reset}>
              {t("templateCancel")}
            </Button>
          )}
          <Button type="button" onClick={save} disabled={pending}>
            {t("templateSave")}
          </Button>
        </div>
      </div>
    </div>
  );
}
