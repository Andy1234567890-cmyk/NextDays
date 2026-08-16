"use client";

// Vorlagen-Tab: Nachrichten-Vorlagen anlegen, bearbeiten, löschen.
//
// Seit 0363 hat eine Vorlage MEHRERE Fassungen: eine Grundfassung ohne
// Sprachangabe und je verwalteter Sprache eine eigene (Betreff + Text). Welche
// beim Gast ankommt, entscheidet der Server nach dessen Sprache — hier wird nur
// gepflegt. Die Reiter erscheinen erst, wenn der Betrieb Sprachen verwaltet
// (Posteingang → Automatisieren → Sprachen verwalten); vorher sieht die Maske
// aus wie bisher, mit genau einem Text.
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import {
  htmlIstLeer,
  textZuHtml,
  type ComposerGriff,
} from "@/components/inbox/composer-editor";
import {
  FassungFelder,
  GRUNDFASSUNG,
  SprachReiter,
  type Fassungen,
} from "@/components/inbox/sprach-fassungen";
import {
  type MessageLanguage,
  type MessageTemplate,
  type TemplateTextInput,
  createTemplate,
  deleteTemplate,
  listAvailableLanguages,
  listMessageLanguages,
  listTemplates,
  updateTemplate,
} from "@/lib/inbox";

/** Leere Fassung — eine Konstante, damit „neu" und „Reiter noch nie berührt"
 *  denselben Startwert benutzen. */
const LEER = { subject: "", body: "" };

export function TemplatesTab() {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [sprachen, setSprachen] = useState<MessageLanguage[]>([]);
  // Sprachcode → Name. Kommt vom Server (EINE Quelle, `core.languages`), damit
  // nicht 31 Sprachnamen in 24 Sprachdateien gepflegt werden müssen.
  const [namen, setNamen] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [title, setTitle] = useState("");
  // Alle Fassungen im Editor, Schlüssel = Sprachcode bzw. GRUNDFASSUNG. Das
  // AUTORENFORMAT ist HTML (`body_html`); den Klartext für den Versand leitet
  // der Server daraus ab — er wird hier nie geschrieben.
  const [fassungen, setFassungen] = useState<Fassungen>({ [GRUNDFASSUNG]: LEER });
  const [aktiv, setAktiv] = useState<string>(GRUNDFASSUNG);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editorGriff = useRef<ComposerGriff | null>(null);

  async function load() {
    const [res, spr, kat] = await Promise.all([
      listTemplates(),
      listMessageLanguages(),
      listAvailableLanguages(),
    ]);
    if (res.ok) setItems(res.data.items);
    if (spr.ok) setSprachen(spr.data.items);
    if (kat.ok) {
      setNamen(Object.fromEntries(kat.data.items.map((o) => [o.code, o.name])));
    }
  }
  useEffect(() => {
    load();
  }, []);

  const aktuelleFassung = fassungen[aktiv] ?? LEER;

  function reset() {
    setEditing(null);
    setTitle("");
    setFassungen({ [GRUNDFASSUNG]: LEER });
    setAktiv(GRUNDFASSUNG);
    setError(null);
  }

  /** Sprachfassungen für die API. Leere Reiter fallen weg — der Server würde sie
   *  ohnehin verwerfen, und eine leere Fassung darf die Grundfassung nicht
   *  verdrängen. */
  function texteFuerApi(): TemplateTextInput[] {
    return sprachen
      .map((s) => ({ lang: s.code, ...(fassungen[s.code] ?? LEER) }))
      .filter((f) => !htmlIstLeer(f.body) || f.subject.trim())
      .map((f) => ({ lang: f.lang, subject: f.subject, body_html: f.body }));
  }

  function save() {
    const grund = fassungen[GRUNDFASSUNG] ?? LEER;
    // Leer-Prüfung auf den INHALT, nicht auf die Zeichenkette: ein leerer
    // Editor liefert „<p></p>" — das ist als String nicht leer, als Nachricht
    // schon. Geprüft wird die GRUNDFASSUNG: sie ist der Rückfall für jede
    // Sprache ohne eigene Fassung, also darf sie nicht fehlen.
    if (!title.trim() || htmlIstLeer(grund.body)) {
      setError(t("templateRequired"));
      return;
    }
    const eingabe = {
      title,
      body_html: grund.body,
      subject: grund.subject,
      texts: texteFuerApi(),
    };
    start(async () => {
      const res = editing
        ? await updateTemplate(editing.id, eingabe)
        : await createTemplate(eingabe);
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
    const geladen: Fassungen = {
      [GRUNDFASSUNG]: {
        subject: tpl.subject,
        body: tpl.body_html || textZuHtml(tpl.body),
      },
    };
    for (const s of sprachen) {
      const fassung = tpl.texts.find((x) => x.lang === s.code);
      geladen[s.code] = fassung
        ? {
            subject: fassung.subject,
            body: fassung.body_html || textZuHtml(fassung.body),
          }
        : LEER;
    }
    setFassungen(geladen);
    setAktiv(GRUNDFASSUNG);
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
                  {/* Welche Sprachen gepflegt sind, ohne die Vorlage zu öffnen —
                      sonst sieht man eine halb übersetzte Vorlage nicht. */}
                  {tpl.texts.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {tpl.texts.map((x) => (
                        <span
                          key={x.lang}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {x.lang.toUpperCase()}
                        </span>
                      ))}
                    </span>
                  )}
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
        <SprachReiter
          sprachen={sprachen}
          aktiv={aktiv}
          onAktiv={setAktiv}
          fassungen={fassungen}
          namen={namen}
          onSpracheHinzugefuegt={(liste, code) => {
            setSprachen(liste);
            setAktiv(code);
          }}
        />
        {aktiv === GRUNDFASSUNG && sprachen.length > 0 && (
          <p className="text-xs text-muted-foreground">{t("langBaseHint")}</p>
        )}
        <FassungFelder
          // Beim Reiterwechsel MUSS der Editor neu aufgebaut werden: TipTap
          // führt sein Dokument selbst und übernimmt einen von außen gesetzten
          // Wert nur, wenn er sich vom zuletzt Herausgegebenen unterscheidet.
          // Zwei Fassungen mit identischem Text (etwa beide leer) sähen für ihn
          // nach „unverändert" aus, und der Reiter zeigte weiter den Text der
          // vorigen Sprache.
          key={aktiv}
          fassung={aktuelleFassung}
          onChange={(f) => setFassungen((prev) => ({ ...prev, [aktiv]: f }))}
          griff={editorGriff}
          hoeheSchluessel="inbox.vorlage.hoehe"
          testId="inbox-template-textarea"
          platzhalter={t("templateBody")}
          uebersetzenZiel={aktiv === GRUNDFASSUNG ? undefined : aktiv}
          grundfassung={fassungen[GRUNDFASSUNG]}
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
