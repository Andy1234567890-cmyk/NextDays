"use client";

// Vorlagen-Tab: Nachrichten-Vorlagen anlegen, bearbeiten, löschen.
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import {
  ComposerEditor,
  htmlIstLeer,
  textZuHtml,
  type ComposerGriff,
} from "@/components/inbox/composer-editor";
import { FeldPicker } from "@/components/inbox/feld-picker";
import {
  type MessageTemplate,
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "@/lib/inbox";

export function TemplatesTab() {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [title, setTitle] = useState("");
  // Das AUTORENFORMAT der Vorlage ist HTML (`body_html`). Den Klartext für den
  // Versand (`body`) leitet der Server daraus ab — er ist die Versandquelle,
  // wird hier aber nie geschrieben; ein mitgeschicktes `body` ignoriert die API.
  const [bodyHtml, setBodyHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editorGriff = useRef<ComposerGriff | null>(null);

  async function load() {
    const res = await listTemplates();
    if (res.ok) setItems(res.data.items);
  }
  useEffect(() => {
    load();
  }, []);

  function reset() {
    setEditing(null);
    setTitle("");
    setBodyHtml("");
    setError(null);
  }

  function save() {
    // Leer-Prüfung auf den INHALT, nicht auf die Zeichenkette: ein leerer
    // Editor liefert „<p></p>" — das ist als String nicht leer, als Nachricht
    // schon.
    if (!title.trim() || htmlIstLeer(bodyHtml)) {
      setError(t("templateRequired"));
      return;
    }
    start(async () => {
      const res = editing
        ? await updateTemplate(editing.id, { title, body_html: bodyHtml })
        : await createTemplate({ title, body_html: bodyHtml });
      if (res.ok) {
        reset();
        await load();
      } else {
        setError(res.error);
      }
    });
  }

  function edit(tpl: MessageTemplate) {
    setEditing(tpl);
    setTitle(tpl.title);
    // `body_html === ""` heißt „noch nie formatiert" (Bestandsvorlage). Dann
    // baut `textZuHtml` den Editor-Inhalt aus dem vorhandenen Klartext auf —
    // Aufzählungen und Absätze werden dabei wieder zu echten Knoten, sodass
    // sich die Vorlage sofort weiterschreiben lässt.
    setBodyHtml(tpl.body_html || textZuHtml(tpl.body));
    setError(null);
  }

  function remove(id: string) {
    start(async () => {
      await deleteTemplate(id);
      if (editing?.id === id) reset();
      await load();
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 overflow-y-auto p-6">
      {/* Liste */}
      <div className="col-span-12 lg:col-span-7">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("tabTemplates")}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("templatesEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((tpl) => (
              <li
                key={tpl.id}
                className="flex items-start gap-3 rounded-2xl border border-border p-3"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{tpl.title}</span>
                  {/* BEWUSST der Klartext `body`, kein `dangerouslySetInnerHTML`
                      auf `body_html`: die Zeile ist ein zweizeiliger Anriss,
                      Formatierung brächte dort nichts — sie öffnete nur einen
                      HTML-Sink ohne Not. Eine sichere Render-Komponente gibt es
                      im Repo nicht. */}
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {tpl.body}
                  </span>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => edit(tpl)}>
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(tpl.id)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Editor */}
      <div className="col-span-12 flex flex-col gap-3 rounded-2xl border border-border p-4 lg:col-span-5">
        <h3 className="font-semibold">
          {editing ? t("templateEdit") : t("templateNew")}
        </h3>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("templateTitle")}
        />
        {/* Derselbe Editor wie im Chat — eine Vorlage wird schließlich zu
            einer Nachricht. Eigener Speicherplatz für die Höhe: hier
            schreibt man lange Texte, im Chat kurze.
            `format="html"`: hier ist HTML das Autorenformat (siehe
            Kopfkommentar von `composer-editor`), im Chat bleibt es Klartext. */}
        <div className="flex flex-col rounded-2xl border border-border bg-background focus-within:ring-2 focus-within:ring-accent/40">
          <ComposerEditor
            wert={bodyHtml}
            onChange={setBodyHtml}
            format="html"
            platzhalter={t("templateBody")}
            griff={editorGriff}
            hoeheSchluessel="inbox.vorlage.hoehe"
            griffSeite="unten"
            leisteSeite="unten"
            testId="inbox-template-textarea"
            etiketten={{
              bold: t("formatBold"),
              italic: t("formatItalic"),
              underline: t("formatUnderline"),
              bulletList: t("formatBulletList"),
              orderedList: t("formatOrderedList"),
              link: t("formatLink"),
              code: t("formatCode"),
              linkPrompt: t("formatLinkPrompt"),
              resize: t("formatResize"),
            }}
          />
        </div>
        <FeldPicker onInsert={(p) => editorGriff.current?.einfuegen(p)} />
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
