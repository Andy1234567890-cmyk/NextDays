"use client";

// „Schnellantworten" — Stufe 2 und 3 im Automatisieren-Panel.
//
// Dieselben Daten wie der Vorlagen-Tab (`message_template`): eine Schnellantwort
// IST eine Nachrichten-Vorlage. Es gibt bewusst keine zweite Tabelle daneben —
// wer im Chat „Schnellantworten" öffnet, soll dieselben Texte sehen, die als
// Vorlage gepflegt sind, sonst pflegt der Betrieb zweimal dasselbe.
//
// Der Unterschied zum Tab ist die BEDIENFORM: hier eine Liste im Panel, ein
// Detail je Antwort und darin „Inhalt bearbeiten" mit Sprach-Reitern — die Form,
// die Lodgify dafür gefunden hat (live abgelesen 11.08.2026). Sie passt zum
// Panel, weil man nebenbei einen Verlauf liest und nicht in eine Maske
// wechseln will.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
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
  createTemplate,
  deleteTemplate,
  listAvailableLanguages,
  listMessageLanguages,
  listTemplates,
  updateTemplate,
} from "@/lib/inbox";
import { useRef } from "react";

const LEER = { subject: "", body: "" };

type Ansicht = "liste" | { vorlage: MessageTemplate | null };

export function SchnellantwortenAnsicht({
  onTitel,
}: {
  /** Meldet dem Panel, was im Kopf stehen soll (im Detail der Name der
   *  Antwort, in der Liste der Abschnittstitel). */
  onTitel?: (titel: string | null) => void;
}) {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [sprachen, setSprachen] = useState<MessageLanguage[]>([]);
  const [namen, setNamen] = useState<Record<string, string>>({});
  const [geladen, setGeladen] = useState(false);
  const [ansicht, setAnsicht] = useState<Ansicht>("liste");

  async function load(): Promise<MessageTemplate[]> {
    const [res, spr, kat] = await Promise.all([
      listTemplates(),
      listMessageLanguages(),
      listAvailableLanguages(),
    ]);
    const liste = res.ok ? res.data.items : [];
    if (res.ok) setItems(liste);
    if (spr.ok) setSprachen(spr.data.items);
    if (kat.ok) setNamen(Object.fromEntries(kat.data.items.map((o) => [o.code, o.name])));
    setGeladen(true);
    return liste;
  }
  useEffect(() => {
    void load();
  }, []);

  if (ansicht !== "liste") {
    return (
      <Bearbeiten
        vorlage={ansicht.vorlage}
        sprachen={sprachen}
        namen={namen}
        onSpracheHinzugefuegt={setSprachen}
        onFertig={async () => {
          await load();
          setAnsicht("liste");
          onTitel?.(null);
        }}
        onAbbrechen={() => {
          setAnsicht("liste");
          onTitel?.(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {!geladen ? (
          <p className="text-sm text-muted-foreground">{t("autoLoading")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("quickEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAnsicht({ vorlage: v });
                    onTitel?.(v.title);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left hover:border-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{v.title}</span>
                    {/* Anriss als KLARTEXT (`body`), nie `body_html` per
                        dangerouslySetInnerHTML — die Zeile braucht keine
                        Formatierung und öffnete sonst einen HTML-Sink. */}
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {v.body}
                    </span>
                    {v.texts.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {v.texts.map((x) => (
                          <span
                            key={x.lang}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {x.lang.toUpperCase()}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <Icon
                    icon="ph:caret-right"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border p-4">
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            setAnsicht({ vorlage: null });
            onTitel?.(t("templateNew"));
          }}
        >
          <Icon icon="ph:plus" className="size-4" />
          {t("autoPanelCreate")}
        </Button>
      </div>
    </div>
  );
}

/** Stufe 3 — Name, Inhalt je Sprache, Löschen. */
function Bearbeiten({
  vorlage,
  sprachen,
  namen,
  onSpracheHinzugefuegt,
  onFertig,
  onAbbrechen,
}: {
  /** null = neu anlegen. */
  vorlage: MessageTemplate | null;
  sprachen: MessageLanguage[];
  namen: Record<string, string>;
  /** Neue Sprache im Editor angelegt — die Liste wandert nach oben, damit
   *  auch die Übersicht den neuen Reiter kennt. */
  onSpracheHinzugefuegt: (sprachen: MessageLanguage[]) => void;
  onFertig: () => void | Promise<void>;
  onAbbrechen: () => void;
}) {
  const t = useTranslations("inbox");
  const [title, setTitle] = useState(vorlage?.title ?? "");
  const [fassungen, setFassungen] = useState<Fassungen>(() => {
    const start: Fassungen = {
      [GRUNDFASSUNG]: {
        subject: vorlage?.subject ?? "",
        // `body_html === ""` heißt „noch nie formatiert" (Bestandsvorlage) —
        // dann baut `textZuHtml` den Editor-Inhalt aus dem Klartext auf.
        body: vorlage ? vorlage.body_html || textZuHtml(vorlage.body) : "",
      },
    };
    for (const s of sprachen) {
      const f = vorlage?.texts.find((x) => x.lang === s.code);
      start[s.code] = f
        ? { subject: f.subject, body: f.body_html || textZuHtml(f.body) }
        : LEER;
    }
    return start;
  });
  const [aktiv, setAktiv] = useState<string>(GRUNDFASSUNG);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const griff = useRef<ComposerGriff | null>(null);

  function speichern() {
    const grund = fassungen[GRUNDFASSUNG] ?? LEER;
    if (!title.trim() || htmlIstLeer(grund.body)) {
      setFehler(t("templateRequired"));
      return;
    }
    const eingabe = {
      title,
      body_html: grund.body,
      subject: grund.subject,
      texts: sprachen
        .map((s) => ({ lang: s.code, ...(fassungen[s.code] ?? LEER) }))
        .filter((f) => !htmlIstLeer(f.body) || f.subject.trim())
        .map((f) => ({ lang: f.lang, subject: f.subject, body_html: f.body })),
    };
    setFehler(null);
    start(async () => {
      const res = vorlage
        ? await updateTemplate(vorlage.id, eingabe)
        : await createTemplate(eingabe);
      if (res.ok) await onFertig();
      else setFehler(res.error);
    });
  }

  function loeschen() {
    if (!vorlage) return;
    start(async () => {
      await deleteTemplate(vorlage.id);
      await onFertig();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <label className="text-sm font-medium" htmlFor="schnellantwort-titel">
          {t("templateTitle")}
        </label>
        <Input
          id="schnellantwort-titel"
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
            onSpracheHinzugefuegt(liste);
            setAktiv(code);
          }}
          onSpracheEntfernt={(liste, code) => {
            onSpracheHinzugefuegt(liste);
            setAktiv((vorher) => (vorher === code ? GRUNDFASSUNG : vorher));
            setFassungen((prev) => {
              const rest = { ...prev };
              delete rest[code];
              return rest;
            });
          }}
        />
        {aktiv === GRUNDFASSUNG && sprachen.length > 0 && (
          <p className="text-xs text-muted-foreground">{t("langBaseHint")}</p>
        )}
        <FassungFelder
          // Neu aufbauen beim Reiterwechsel (s. Vorlagen-Tab).
          key={aktiv}
          fassung={fassungen[aktiv] ?? LEER}
          onChange={(f) => setFassungen((prev) => ({ ...prev, [aktiv]: f }))}
          griff={griff}
          hoeheSchluessel="inbox.schnellantwort.hoehe"
          testId="inbox-schnellantwort-textarea"
          platzhalter={t("templateBody")}
          uebersetzenZiel={aktiv === GRUNDFASSUNG ? undefined : aktiv}
          grundfassung={fassungen[GRUNDFASSUNG]}
        />
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        {vorlage && (
          <Button
            type="button"
            variant="outline"
            onClick={loeschen}
            disabled={pending}
            className="w-fit text-destructive"
          >
            <Icon icon="ph:trash" className="size-4" />
            {t("autoDelete")}
          </Button>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button type="button" variant="outline" onClick={onAbbrechen} disabled={pending}>
          {t("autoCancel")}
        </Button>
        <Button type="button" onClick={speichern} disabled={pending}>
          {t("autoSave")}
        </Button>
      </div>
    </div>
  );
}
